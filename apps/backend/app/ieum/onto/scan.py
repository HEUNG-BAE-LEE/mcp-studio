"""DB 스캔으로 자동 구성: 스키마를 읽어 객체, 링크, 병합 후보를 제안한다.

스캔은 읽기만 한다. 결과는 제안(proposals)이고, 사용자가 고른 것만 apply 가 온톨로지에 쓴다(새 객체는 검토 필요 상태로).
무엇을 근거로 제안하는지는 전부 규칙이다(LLM 을 부르지 않는다):
  객체   키가 있는 테이블(또는 키를 아는 뷰) 중 이력·로그·코드표·큰 일별 기록 테이블은 빼고 제안한다.
         하위(상세) 테이블은 부모 객체가 생긴 뒤에 제안한다. 뷰가 기본 테이블의 키를 노출하면 그 뷰를 객체로 보고 기본 테이블은 뺀다.
  링크   외래키(FK), 뷰 정의의 조인 조건, 그리고 FK 가 없는 키 컬럼의 값 일치율(컬럼 이름이 키 이름으로 끝나고 값의 90% 이상이 상대 키에 있을 때).
         다른 연결(온톨로지)의 객체와도 같은 방법으로 이어 본다(DB 간 링크). 일치율 95% 미만은 확인 필요로 표시한다.
  병합   다른 온톨로지에 이미 같은 대상(업무 키 값이 거의 같은 테이블)이 있으면 새 객체 대신 그 객체의 원본으로 추가하자고 제안한다.
스캔은 몇 초에서 몇 분이 걸릴 수 있어 작업(job)으로 돌고, 화면이 상태를 폴링한다. 작업은 메모리에만 있다(서버를 다시 띄우면 다시 스캔하면 된다).
"""
import copy
import re
import threading
import time
import uuid
from typing import Dict, List, Optional, Tuple

from app.ieum.onto import conn as dbconn
from app.ieum.onto import dictionary as dic
from app.ieum.onto import layout, links as lk, profile, reader, store

STEP_TITLES = ["스키마 읽기", "키와 제약 분석", "기존 객체, 마트와 대조", "값 분포 샘플링", "개인정보 컬럼 감지", "객체와 링크 추론", "기존 온톨로지와 대조"]
MATCH_MIN = 0.9            # 비어 있지 않은 값 중 상대 키에 있는 비율이 이 이상이면 링크로 제안
REC_MIN = 0.95             # 이 이상이면 권장, 미만이면 확인 필요
MERGE_MIN = 0.8            # 업무 키 값이 이만큼 겹치면 같은 대상으로 본다
MAX_JOBS = 20

JOBS: Dict[str, dict] = {}
_POOL: Dict[str, dict] = {}                # 작업 id -> {objects, links, merges, samples}
_JLOCK = threading.RLock()


class ScanError(ValueError):
    pass


# ── 공용: 쓰는 테이블, 값 일치 ──────────────────────────────────────────────

def mart_tables(c: dict, sql: str) -> List[str]:
    """마트 SQL 이 읽는 이 연결의 테이블 이름(별칭.테이블 형태에서 뽑는다)"""
    return sorted({m.group(1).upper() for m in re.finditer(r"\b%s\.(\w+)" % re.escape(c["alias"]), sql or "", re.I)})


def table_use(c: dict) -> Dict[str, dict]:
    """연결의 테이블마다 쓰는 곳: {테이블: {'objs': [[id, 이름]], 'marts': [[id, 이름]]}}"""
    use: Dict[str, dict] = {}
    for o in store.conn_objects(c["id"]):
        if o["kind"] != "mart":
            use.setdefault(o["tname"], {"objs": [], "marts": []})["objs"].append([o["id"], o["name"]])
    for mid, m in store.all_marts().items():
        if m.get("home") == c["id"]:
            for t in mart_tables(c, m.get("sql", "")):
                use.setdefault(t, {"objs": [], "marts": []})["marts"].append([mid, m["name"]])
    return use


def _keyish(col: str) -> bool:
    return col.upper().endswith(("_NO", "_CD", "_ID", "_CODE")) or col.upper() in ("NO", "CD", "ID")


def name_match(pcol: str, qcol: str) -> bool:
    """pcol 이 qcol 과 같거나 `_<qcol>` 로 끝나는가(CHRG_EMP_NO 와 EMP_NO)"""
    p, q = pcol.upper(), qcol.upper()
    return p == q or p.endswith("_" + q)


def column_values(c: dict, tname: str, col: str, n: int = 1000) -> List:
    """표본 행(앞 n 행)의 컬럼 값. 비어 있는 값도 그대로 둔다(일치율의 분모가 된다)."""
    return [r[0] for r in reader.sample_rows(c, tname, [col], n).rows]


def overlap(target_conn: dict, target_table: str, target_col: str, values: List) -> Optional[dict]:
    """values 가 target_table.target_col 에 얼마나 있는가. {rate, blank, matched, rows, distinct, hit} (표본이 너무 작으면 None)"""
    rows = len(values)
    blanks = sum(1 for v in values if v in (None, ""))
    nb = [v for v in values if v not in (None, "")]
    distinct = list(dict.fromkeys(nb))
    if len(nb) < 3 or not distinct:
        return None
    hit = reader.matched_values(target_conn, target_table, target_col, distinct)
    matched_rows = sum(1 for v in nb if v in hit)
    return {"rate": matched_rows / rows, "blank": blanks / rows, "match_nb": matched_rows / len(nb), "matched": matched_rows, "rows": rows, "distinct": len(distinct), "hit": len(hit)}


# ── 작업 ───────────────────────────────────────────────────────────────────

def _view(job: dict) -> dict:
    allobj = store.all_objects()
    existing = set(allobj)                                 # 다른 온톨로지의 객체도 링크가 가리킬 수 있다
    out = {k: job[k] for k in ("id", "conn", "mode", "start", "sample", "pii", "state", "an", "steps", "skip", "empty", "rel", "error", "created")}
    props = []
    for p in job["proposals"]:
        q = dict(p)
        q["done"] = _done(p, existing)
        props.append(q)
    out["proposals"] = props
    out["existing"] = sorted(existing)
    out["names"] = {k: v["name"] for k, v in allobj.items()}
    return out


def _done(p: dict, existing: set) -> bool:
    add = p["add"]
    if "ot" in add:
        return add["ot"] in existing
    if "ol" in add:
        pool = _POOL.get(p.get("job"), {})
        l = pool.get("links", {}).get(add["ol"])
        return bool(l) and any(x["from"] == l["from"] and x["to"] == l["to"] and x["keys"] == l["keys"] for x in store.all_links())
    if "merge" in add:
        o = store.get_object(add["merge"]["into"])
        return bool(o) and any(a.get("table") == add["merge"]["table"] for a in o.get("alt", []))
    return False


def get(job_id: str) -> dict:
    with _JLOCK:
        job = JOBS.get(job_id)
        if job is None:
            raise ScanError("스캔 작업을 찾을 수 없습니다. 서버를 다시 띄웠다면 스캔을 다시 시작해 주세요.")
        return _view(job)


def start(conn_id: str, mode: str = "all", start_table: str = "", sample: bool = True, pii: bool = True, sync: bool = False) -> dict:
    c = dbconn.need(conn_id)
    if mode not in ("all", "rel"):
        raise ScanError("스캔 범위를 알 수 없습니다.")
    if mode == "rel" and not start_table:
        raise ScanError("시작 테이블을 골라 주세요.")
    job = {"id": uuid.uuid4().hex[:12], "conn": c["id"], "mode": mode, "start": start_table, "sample": bool(sample), "pii": bool(pii), "state": "running", "an": 0,
           "steps": [{"title": t, "result": "", "state": "wait"} for t in STEP_TITLES], "proposals": [], "skip": "", "empty": "", "rel": None, "error": "", "created": time.time()}
    with _JLOCK:
        if len(JOBS) >= MAX_JOBS:
            for k in sorted(JOBS, key=lambda k: JOBS[k]["created"])[: len(JOBS) - MAX_JOBS + 1]:
                JOBS.pop(k, None)
                _POOL.pop(k, None)
        JOBS[job["id"]] = job
        _POOL[job["id"]] = {"objects": {}, "links": {}, "merges": {}}
    if sync:
        _run(job)
    else:
        threading.Thread(target=_run, args=(job,), daemon=True, name="onto-scan-" + job["id"]).start()
    return _view(job)


def _step(job: dict, i: int, result: str = "", state: str = "ok") -> None:
    with _JLOCK:
        job["steps"][i].update(result=result, state=state)
        job["an"] = i + 1 if state == "ok" else i
        if state == "ok" and i + 1 < len(job["steps"]):
            job["steps"][i + 1]["state"] = "run"


def _run(job: dict) -> None:
    try:
        job["steps"][0]["state"] = "run"
        _analyze(job)
        with _JLOCK:
            job["state"] = "done"
    except Exception as e:                      # noqa: BLE001 — 화면에 원인을 보인다
        with _JLOCK:
            job["state"] = "error"
            job["error"] = str(e) if isinstance(e, ValueError) else "스캔하지 못했습니다. %s" % str(e)[:300]


# ── 분석 ───────────────────────────────────────────────────────────────────

def _roles(schema: dict, book: dict) -> Dict[str, Tuple[str, str]]:
    roles = {t["name"]: profile.classify(t, book["absorbed"]) for t in schema["tables"]}
    by = {t["name"]: t for t in schema["tables"]}
    for t in schema["tables"]:                   # 뷰가 기본 테이블의 키를 보여 주면 그 뷰를 객체로 본다
        vw = t.get("view")
        if t["kind"] == "view" and roles[t["name"]][0] == "entity" and vw and vw.get("base") in by:
            base = by[vw["base"]]
            if base["pk"] and roles.get(base["name"], ("",))[0] == "entity" and t["pk"]:
                roles[base["name"]] = ("covered", "%s 뷰가 이 테이블을 이미 쓰고 있어요" % t["name"])
    return roles


def _neighbors(schema: dict, start: str) -> List[str]:
    out = []
    for t in schema["tables"]:
        if t["name"] == start:
            out += [f["ref"] for f in t["fks"]]
        elif any(f["ref"] == start for f in t["fks"]):
            out.append(t["name"])
    return list(dict.fromkeys(out))


def _analyze(job: dict) -> None:
    c = dbconn.need(job["conn"])
    pool = _POOL[job["id"]]
    schema = reader.read(c)
    _step(job, 0, "테이블 %d개, 뷰 %d개" % (schema["tableCount"], schema["viewCount"]))
    tables = schema["tables"]
    by = {t["name"]: t for t in tables}
    _step(job, 1, "PK %d개, FK %d개" % (sum(len(t["pk"]) > 0 for t in tables if t["kind"] == "table"), sum(len(t["fks"]) for t in tables)))
    book = profile.code_book(c, schema)
    roles = _roles(schema, book)
    existing = store.conn_objects(c["id"])
    use = table_use(c)
    used = set(use)
    ex_by_table = {o["tname"]: o for o in existing if o["kind"] != "mart"}
    cand: List[str] = []
    deferred: List[str] = []
    for t in tables:
        role = roles[t["name"]][0]
        if t["name"] in used:
            continue
        if role == "entity":
            cand.append(t["name"])
        elif role == "detail":
            parent = profile.parent_of(t)
            (cand if parent in ex_by_table else deferred).append(t["name"])
    if job["mode"] == "rel":
        if job["start"] not in by:
            raise ScanError("시작 테이블 %s 을(를) 찾을 수 없습니다." % job["start"])
        reach = {job["start"], *_neighbors(schema, job["start"])}
        cand = [x for x in cand if x in reach]
        deferred = [x for x in deferred if x in reach]
    _step(job, 2, ("이미 쓰는 테이블 %d개 건너뜀" % len(used)) if used else "쓰고 있는 테이블 없음")
    # 값 분포 샘플링과 객체 초안
    taken = {o["api"] for o in existing}
    samples: Dict[str, List[dict]] = {}
    objs: Dict[str, dict] = {}
    for name in cand:
        t = by[name]
        rows = reader.sample_rows(c, name, None, profile.SAMPLE_ROWS).dicts() if job["sample"] else []
        samples[name] = rows
        o = profile.profile_object(c, t, book, taken, rows=rows, pii=job["pii"])
        taken.add(o["api"])
        objs[name] = o
    _step(job, 3, ("테이블당 최대 %s행 (%d개 테이블)" % ("{:,}".format(profile.SAMPLE_ROWS), len(cand))) if job["sample"] else "건너뜀 (표본을 읽지 않음)")
    masked = sum(1 for o in objs.values() for p in o["props"] if "mask" in p["flags"])
    _step(job, 4, ("%d개 컬럼 마스킹 제안" % masked) if job["pii"] else "건너뜀")
    # 병합 후보: 다른 온톨로지에 같은 대상이 이미 있는 테이블
    others = [o for o in store.all_objects().values() if o["conn"] != c["id"] and o["kind"] != "mart"]
    merges: Dict[str, dict] = {}
    if job["sample"]:
        for name in list(objs):
            m = _merge_candidate(c, by[name], objs[name], samples[name], others, tables)
            if m:
                merges[name] = m
                del objs[name]
    # 링크
    all_obj = dict(ex_by_table)
    all_obj.update(objs)                                       # 테이블 이름 -> 객체(기존 + 제안)
    new_links = _link_candidates(c, schema, by, objs, all_obj, samples, others, job)
    # 링크 이름 중복 정리와 중복 관계 표시
    _mark_redundant(new_links, by)
    for o in objs.values():
        pool["objects"][o["id"]] = o
    for i, l in enumerate(new_links):
        l["id"] = "s%d" % (i + 1)
        pool["links"][l["id"]] = l
    pool["merges"] = merges
    pool["samples"] = {}
    _step(job, 5, "객체 %d개, 링크 %d개" % (len(objs), len(new_links)))
    props = _proposals(c, job, objs, new_links, merges, by, all_obj, roles)
    others_conn = [x for x in store.conns.load() if x["id"] != c["id"]]
    _step(job, 6, ("병합 후보 %d개" % len(merges)) if others_conn else "비교할 다른 온톨로지 없음")
    skip_parts = []
    hist = [t["name"] for t in tables if roles[t["name"]][0] == "history" and t["name"] not in used]
    code = [t["name"] for t in tables if roles[t["name"]][0] == "code"]
    fact = [t["name"] for t in tables if roles[t["name"]][0] == "fact" and t["name"] not in used]
    if hist or code:
        skip_parts.append("%s는 제외했어요." % "와 ".join(x for x in ["이력 테이블 %d개" % len(hist) if hist else "", "코드성 테이블 %d개" % len(code) if code else ""] if x))
    if fact:
        skip_parts.append("일별 기록 테이블 %d개(%s)는 마트로 집계한 뒤 객체로 지정하기를 권장해요." % (len(fact), ", ".join(fact[:3])))
    if deferred:
        skip_parts.append("하위 테이블 %d개(%s)는 부모 객체를 반영한 뒤 다시 스캔하면 제안해요." % (len(deferred), ", ".join(deferred[:3])))
    job["skip"] = " ".join(skip_parts)
    if not props:
        job["empty"] = "새로 제안할 객체가 없어요. 핵심 테이블은 이미 객체나 마트로 쓰고 있어요." + ((" " + " ".join(skip_parts)) if skip_parts else "")
    if job["mode"] == "rel":
        job["rel"] = _rel_figure(c, job["start"], by, all_obj, new_links, existing_names={o["id"]: o for o in list(objs.values()) + existing})
    job["proposals"] = props
    for p in props:
        p["job"] = job["id"]


def _merge_candidate(c: dict, t: dict, o: dict, rows: List[dict], others: List[dict], tables: List[dict]) -> Optional[dict]:
    """t 가 다른 온톨로지 객체와 같은 대상인가. 조건: FK 가 없고 아무도 참조하지 않으며, 업무 키(유일한 키 모양 컬럼)의 값이 상대 객체 키와 MERGE_MIN 이상 겹친다."""
    if t["fks"] or any(f["ref"] == t["name"] for x in tables for f in x["fks"]) or t["kind"] != "table":
        return None
    for p in o["props"]:
        if "hidden" in p["flags"] or "filter" in p["flags"] or p["col"] in t["pk"] or not _keyish(p["col"]):
            continue
        vals = [r.get(p["col"]) for r in rows]
        nb = [v for v in vals if v not in (None, "")]
        if len(nb) < 3 or len(set(nb)) != len(nb):                            # 이 컬럼이 이 테이블 안에서 유일해야 업무 키다
            continue
        for oo in others:
            oc = dbconn.get(oo["conn"])
            if oc is None:
                continue
            for q in oo["props"]:
                if "hidden" in q["flags"] or "filter" in q["flags"] or not name_match(p["col"], q["col"]) or not _keyish(q["col"]):
                    continue
                if not (q["col"] in oo.get("pk", []) and len(oo.get("pk", [])) == 1) and not reader.is_unique(oc, oo["tname"], q["col"]):
                    continue
                ov = overlap(oc, oo["tname"], q["col"], vals)
                if ov and ov["hit"] / ov["distinct"] >= MERGE_MIN:
                    return {"table": "%s.%s" % (c["alias"], t["name"]), "tname": t["name"], "conn": c["id"], "col": p["col"], "into": oo["id"], "intoCol": q["col"], "hit": ov["hit"],
                            "total": ov["distinct"], "name": o["name"], "keyName": p["name"]}
    return None


def _link_candidates(c: dict, schema: dict, by: Dict[str, dict], objs: Dict[str, dict], all_obj: Dict[str, dict], samples: Dict[str, List[dict]], others: List[dict], job: dict) -> List[dict]:
    out: List[dict] = []
    seen = set()
    existing_links = store.all_links()

    def add(frm: dict, to: dict, keys, kind: str, basis: str, rate: Optional[float] = None) -> None:
        sig = (frm["id"], to["id"], tuple(map(tuple, keys)))
        if sig in seen or any(x["from"] == frm["id"] and x["to"] == to["id"] and x["keys"] == [list(k) for k in keys] for x in existing_links):
            return
        seen.add(sig)
        taken = {x["api"] for x in out if x["from"] == frm["id"]} | {x["api"] for x in existing_links if x["from"] == frm["id"]}
        out.append(lk.new_link(frm, to, keys, kind, basis, rate=rate, taken_api=taken))
    new_ids = {o["id"] for o in objs.values()}
    # 외래키
    for t in schema["tables"]:
        frm = all_obj.get(t["name"])
        if not frm or t["kind"] != "table":
            continue
        for f in t["fks"]:
            to = all_obj.get(f["ref"])
            if not to or (frm["id"] not in new_ids and to["id"] not in new_ids):
                continue
            add(frm, to, list(zip(f["cols"], f["refcols"])), "fk", lk.basis_text("fk"))
    # 뷰 정의의 조인
    for t in schema["tables"]:
        frm, vw = all_obj.get(t["name"]), t.get("view")
        if not frm or t["kind"] != "view" or not vw:
            continue
        for j in vw["joins"]:
            for (xa, xc), (yb, yc) in (((j["a"], j["ac"]), (j["b"], j["bc"])), ((j["b"], j["bc"]), (j["a"], j["ac"]))):
                if xa != vw["base"]:
                    continue
                out_col = next((s["out"] for s in vw["select"] if s["table"] == xa and s["col"].upper() == xc.upper()), None)
                to = all_obj.get(yb)
                if out_col and to and to["id"] != frm["id"] and (frm["id"] in new_ids or to["id"] in new_ids):
                    add(frm, to, [[out_col, yc]], "view", lk.basis_text("view"))
    if not job["sample"]:
        _mark_all(out, all_obj, objs)
        return out
    # 값 일치로 이어 보기(FK 없는 키 컬럼): 새 객체 -> 같은 연결, 다른 연결의 객체
    targets = [o for o in all_obj.values()] + others
    for name, frm in objs.items():
        t = by[name]
        skip = {col for f in t["fks"] for col in f["cols"]}
        for to, keys, ov in infer_links(c, frm, samples.get(name, []), t["pk"], skip, targets):
            cross = to["conn"] != c["id"]
            add(frm, to, keys, "cross" if cross else "infer", lk.basis_text("cross" if cross else "infer", ov["rate"], ov["blank"]), rate=ov["rate"])
    _mark_all(out, all_obj, objs)
    return out


def infer_links(c: dict, frm: dict, rows: List[dict], pk: List[str], skip_cols: set, targets: List[dict]) -> List[tuple]:
    """FK 없는 키 컬럼의 값이 다른 객체의 키 컬럼에 얼마나 있는지로 링크를 찾는다. [(대상 객체, [[내 컬럼, 상대 컬럼]], 일치 정보)]"""
    found: List[tuple] = []
    for p in frm["props"]:
        if {"hidden", "filter", "code"} & set(p["flags"]) or p["col"] in skip_cols or not _keyish(p["col"]) or (p["col"] in pk and len(pk) == 1):
            continue
        vals = [r.get(p["col"]) for r in rows]
        for to in targets:
            if (to["tname"] == frm["tname"] and to["conn"] == frm["conn"]) or to["kind"] == "mart" or to["id"] == frm["id"]:
                continue
            tc = c if to["conn"] == c["id"] else dbconn.get(to["conn"])
            if tc is None:
                continue
            hit = None
            for q in to["props"]:
                if {"hidden", "filter"} & set(q["flags"]) or not name_match(p["col"], q["col"]) or not _keyish(q["col"]):
                    continue
                if to.get("pk") != [q["col"]] and not reader.is_unique(tc, to["tname"], q["col"]):
                    continue
                ov = overlap(tc, to["tname"], q["col"], vals)
                if ov and ov["match_nb"] >= MATCH_MIN and ov["matched"] >= 3:
                    hit = (to, [[p["col"], q["col"]]], ov)
                    break
            if hit:
                found.append(hit)
                break
    return found


def _mark_all(link_list: List[dict], all_obj: Dict[str, dict], objs: Dict[str, dict]) -> None:
    """새 링크의 키 컬럼에 링크 키 특성을 단다(제안된 객체에만)."""
    by_id = {o["id"]: o for o in all_obj.values()}
    by_id.update({o["id"]: o for o in store.all_objects().values()})
    for l in link_list:
        frm, to = by_id.get(l["from"]), by_id.get(l["to"])
        if frm and to and frm["id"] in {o["id"] for o in objs.values()}:
            lk.mark_keys(frm, to, l["keys"])


def _mark_redundant(link_list: List[dict], by: Dict[str, dict]) -> None:
    """A→C 가 A→B→C 로도 갈 수 있고 같은 컬럼 이름으로 이어지면 중복 관계로 표시한다(권장 안 함)."""
    idx = {}
    for l in link_list:
        idx.setdefault(l["from"], []).append(l)
    for l in link_list:
        if l["kind"] != "fk":
            continue
        for mid in idx.get(l["from"], []):
            if mid is l or mid["kind"] != "fk":
                continue
            for far in idx.get(mid["to"], []):
                if far["to"] == l["to"] and far["keys"][0][0].upper() == l["keys"][0][0].upper():
                    l["via"] = mid["to"]
                    break


def _rel_figure(c: dict, start: str, by: Dict[str, dict], all_obj: Dict[str, dict], new_links: List[dict], existing_names: Dict[str, dict]) -> dict:
    """시작 테이블과 이어진 테이블 그림의 자료: 시작 테이블, 이웃(테이블, 이름, 객체 여부, 이어주는 키)"""
    nodes = []
    t = by[start]
    for f in t["fks"]:
        nodes.append({"table": f["ref"], "label": dic.table_names(f["ref"])[0], "object": f["ref"] in all_obj, "via": ", ".join(f["cols"])})
    for x in by.values():
        for f in x["fks"]:
            if f["ref"] == start:
                nodes.append({"table": x["name"], "label": dic.table_names(x["name"])[0], "object": x["name"] in all_obj, "via": "하위 테이블" if profile.parent_of(x) == start else ", ".join(f["cols"]) + "로 참조"})
    me = all_obj.get(start)
    for l in new_links:
        if me and l["from"] == me["id"] and l["cross"]:
            to = existing_names.get(l["to"]) or store.get_object(l["to"])
            if to:
                nodes.append({"table": to["tname"], "label": "%s (%s)" % (to["name"], lk.store_conn_name(to["conn"])), "object": True, "via": l["keys"][0][0]})
    seen, out = set(), []
    for n in nodes:
        if n["table"] not in seen:
            seen.add(n["table"])
            out.append(n)
    return {"start": {"table": start, "label": dic.table_names(start)[0]}, "nodes": out}


def _proposals(c: dict, job: dict, objs: Dict[str, dict], new_links: List[dict], merges: Dict[str, dict], by: Dict[str, dict], all_obj: Dict[str, dict], roles: dict) -> List[dict]:
    props: List[dict] = []
    ref_by: Dict[str, List[str]] = {}
    for t in by.values():
        for f in t["fks"]:
            ref_by.setdefault(f["ref"], []).append(dic.table_names(t["name"])[0])
    for name, o in objs.items():
        t = by[name]
        sub = "%s, %s행" % (o["table"], "{:,}".format(o["rows"] or 0))
        if t["fks"]:
            sub += ", 다른 테이블과 FK %d개" % len(t["fks"])
        elif ref_by.get(name):
            sub += ", %s 참조" % dic.jo(ref_by[name][0], "이", "가")
        props.append({"id": "o:" + o["id"], "kind": "객체", "title": "%s (%s)" % (o["name"], o["api"]), "sub": sub, "rec": "yes", "add": {"ot": o["id"]}})
    for name, m in merges.items():
        into = _name_of(m["into"])
        props.append({"id": "m:" + name, "kind": "병합", "title": "%s 기존 %s 같은 대상" % (dic.jo(m["name"], "은", "는"), dic.jo(into, "과", "와")),
                      "sub": "%s 새 객체로 만들지 않고 %s의 원본으로 추가합니다. %s 일치 %s/%s건" % (dic.jo(m["table"], "을", "를"), into, m["keyName"], "{:,}".format(m["hit"]), "{:,}".format(m["total"])),
                      "rec": "yes", "add": {"merge": m}})
    names = {o["id"]: o for o in all_obj.values()}
    names.update({o["id"]: o for o in store.all_objects().values()})
    for l in new_links:
        frm, to = names[l["from"]], names[l["to"]]
        role = dic.role_of(l["keys"][0][0])
        label = "%s → %s" % (frm["name"], to["name"])
        if l["cross"]:
            label += " (DB 간%s)" % (", " + role[0] if role else "")
        elif role:
            label += " (%s)" % role[0]
        sub = l["basis"].replace("DB 간 링크: ", "").replace("추론: ", "")
        rec = "yes"
        if l.get("via"):
            rec, sub = "no", "%s를 거쳐 갈 수 있는 중복 관계예요" % names[l["via"]]["name"]
        elif l["kind"] in ("infer", "cross") and l["rate"] is not None and l["rate"] < REC_MIN:
            rec = "check"
            sub += ". 일치하지 않는 값은 직접 입력한 값일 수 있어요"
        props.append({"id": "l:" + l["id"], "kind": "링크", "title": label, "sub": sub, "rec": rec, "add": {"ol": l["id"]}, "needs": [l["from"], l["to"]]})
    return props


def _name_of(oid: str) -> str:
    o = store.get_object(oid)
    return o["name"] if o else oid


# ── 반영 ───────────────────────────────────────────────────────────────────

def apply(job_id: str, picked: List[str]) -> dict:
    """고른 제안을 온톨로지에 쓴다. 새 객체는 검토 필요 상태다. 링크는 양쪽 객체가 있을 때만 쓴다(없으면 건너뛰고 이유를 알린다)."""
    with _JLOCK:
        job = JOBS.get(job_id)
        pool = _POOL.get(job_id)
    if job is None or pool is None:
        raise ScanError("스캔 작업을 찾을 수 없습니다. 스캔을 다시 시작해 주세요.")
    if job["state"] != "done":
        raise ScanError("스캔이 끝난 뒤에 반영할 수 있습니다.")
    want = set(picked or [])
    res = {"objects": [], "links": [], "merges": [], "skipped": []}
    with store.LOCK:
        for p in job["proposals"]:
            if p["id"] in want and p["kind"] == "객체" and store.get_object(p["add"]["ot"]) is None:
                o = copy.deepcopy(pool["objects"][p["add"]["ot"]])
                o["reviewNote"] = "스캔이 테이블 이름, 컬럼 구성, 다른 테이블의 참조 관계로 제안한 객체입니다. 속성 이름과 링크가 맞는지 확인한 뒤 검토를 마쳐 주세요."
                store.put_object(o)
                res["objects"].append(o["id"])
        for p in job["proposals"]:
            if p["id"] not in want or p["kind"] != "링크":
                continue
            l = copy.deepcopy(pool["links"][p["add"]["ol"]])
            frm, to = store.get_object(l["from"]), store.get_object(l["to"])
            if frm is None or to is None:
                res["skipped"].append({"id": p["id"], "why": "%s 객체도 함께 반영할 때만 만들 수 있어요" % ", ".join(_name_of(x) for x in (l["from"], l["to"]) if store.get_object(x) is None)})
                continue
            if any(x["from"] == l["from"] and x["to"] == l["to"] and x["keys"] == l["keys"] for x in store.all_links()):
                continue
            l["id"] = store.next_link_id()
            l["api"] = _free_api(l["from"], l["api"])
            store.put_links([l])
            lk.mark_keys(frm, to, l["keys"])
            store.put_object(frm)
            res["links"].append(l["id"])
        for p in job["proposals"]:
            if p["id"] not in want or p["kind"] != "병합":
                continue
            m = p["add"]["merge"]
            into = store.get_object(m["into"])
            if into is None:
                continue

            def mut(o, m=m):
                o.setdefault("alt", []).append({"conn": m["conn"], "table": m["table"], "col": m["col"], "intoCol": m["intoCol"], "hit": m["hit"], "total": m["total"]})
                o["mergeNote"] = "%s의 %s도 원본으로 사용" % (lk.store_conn_name(m["conn"]), m["table"])
            store.update_object(m["into"], mut)
            res["merges"].append(m["into"])
        _place(job["conn"])
        _review_notes(job["conn"], res["objects"])
        dbconn.update(job["conn"], {"scanned": time.time()})
    return res


def _free_api(oid: str, api: str) -> str:
    taken = {x["api"] for x in store.all_links() if x["from"] == oid}
    base, n = api, 2
    while api in taken:
        api, n = "%s%d" % (base, n), n + 1
    return api


def _place(conn_id: str) -> None:
    objs = store.conn_objects(conn_id)
    ls = store.all_links()
    layout.place(objs, ls)
    store.put_objects(objs)


def _review_notes(conn_id: str, new_ids: List[str]) -> None:
    """새 객체의 검토 안내에, 다른 온톨로지를 가리키는 링크가 있으면 확인해 달라는 말을 더한다."""
    ls = store.all_links()
    for oid in new_ids:
        names = [l["name"] for l in ls if l["from"] == oid and l["cross"]]
        if names:
            def mut(o, names=names):
                o["reviewNote"] += " %s 링크가 DB 간 링크라 확인이 필요합니다." % ", ".join(names)
            store.update_object(oid, mut)

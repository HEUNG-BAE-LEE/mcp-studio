"""객체 구축: 원본 테이블 목록, 객체 생성(테이블 또는 마트에서), 객체·속성·링크 고치기, 검토 완료와 공개 전환.

객체 생성 마법사는 세 단계다.
  1. 원본 선택   테이블 하나, 또는 빌드에 성공해 아직 객체로 지정하지 않은 마트 하나
  2. 객체 정의   이름, API 이름, 설명, 포함할 속성, 기본키(복합 가능), 제목
  3. 링크와 확인  이어질 만한 기존 객체(FK, 값 일치율)를 고른다
draft() 가 1~2 단계의 초안과 3 단계의 후보를 한 번에 돌려주고, create() 가 사용자가 고친 정의를 받아 저장한다.
"""
import copy
import re
from typing import List, Optional

from app.ieum.onto import conn as dbconn
from app.ieum.onto import dictionary as dic
from app.ieum.onto import layout, links as lk, marts, profile, reader, scan, store

API_RX = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,59}$")
PROP_API_RX = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,59}$")


class BuildError(ValueError):
    """사용자에게 그대로 보일 오류."""


# ── 원본 테이블 목록 ────────────────────────────────────────────────────────

def source_tables(conn_id: str, fresh: bool = False) -> dict:
    """연결의 원본 테이블과 쓰는 곳. 객체 구축 탭의 목록과 객체 생성 마법사 1 단계가 쓴다."""
    c = dbconn.need(conn_id)
    schema = reader.read_cached(c, fresh=fresh)
    book = profile.code_book(c, schema)
    roles = scan._roles(schema, book)
    use = scan.table_use(c)
    rows = []
    for t in schema["tables"]:
        role, why = roles[t["name"]]
        u = use.get(t["name"], {"objs": [], "marts": []})
        tag = "뷰" if t["kind"] == "view" else {"history": "이력", "code": "코드"}.get(role, "")
        hint = ""
        if u["objs"]:
            hint = "이미 %s 객체의 원본이에요" % ", ".join(x[1] for x in u["objs"])
        elif role in ("history", "code", "fact", "covered", "nokey"):
            hint = why
        elif role == "detail":
            parent = profile.parent_of(t)
            if not any(o["tname"] == parent for o in store.conn_objects(conn_id)):
                hint = "부모 테이블(%s)의 객체를 먼저 만들면 링크도 함께 만들 수 있어요" % parent
        rows.append({"name": t["name"], "key": "%s.%s" % (c["alias"], t["name"]), "rows": t["rows"], "kind": t["kind"], "tag": tag, "role": role, "pk": t["pk"],
                     "objs": u["objs"], "marts": u["marts"], "ok": not u["objs"], "why": hint})
    used = sum(1 for r in rows if r["objs"] or r["marts"])
    return {"conn": conn_id, "tables": rows, "total": len(rows), "used": used, "unused": len(rows) - used}


def check_key(conn_id: str, table: str, cols: List[str]) -> dict:
    """고른 컬럼이 행을 구별하는가. {unique, rows, distinct}"""
    c = dbconn.need(conn_id)
    schema = reader.read_cached(c)
    t = next((x for x in schema["tables"] if x["name"] == table), None)
    if t is None:
        raise BuildError("테이블을 찾을 수 없습니다: %s" % table)
    names = {x["name"] for x in t["cols"]}
    if not cols or any(x not in names for x in cols):
        raise BuildError("기본키로 쓸 컬럼을 골라 주세요.")
    qc = ", ".join(reader.q(c, x) for x in cols)
    tab = reader.qualified(c, table)
    total = int(dbconn.run(c, "SELECT COUNT(*) FROM %s" % tab, limit=1).rows[0][0])
    distinct = int(dbconn.run(c, "SELECT COUNT(*) FROM (SELECT DISTINCT %s FROM %s) d" % (qc, tab), limit=1).rows[0][0])
    return {"unique": total == distinct, "rows": total, "distinct": distinct}


# ── 초안 ───────────────────────────────────────────────────────────────────

def _col_row(p: dict) -> dict:
    sys_ = bool({"hidden", "filter"} & set(p["flags"]))
    return {"c": p["col"], "ct": p["ctype"], "t": p["type"], "name": p["name"], "api": p["api"], "flags": list(p["flags"]), "note": p["note"], "ex": list(p["ex"]), "sys": sys_}


def draft(conn_id: str, src: str, pick: str) -> dict:
    """객체 정의 초안. src 는 table 또는 mart, pick 은 테이블 이름 또는 마트 id"""
    c = dbconn.need(conn_id)
    taken = {o["api"] for o in store.conn_objects(conn_id)}
    if src == "table":
        schema = reader.read_cached(c)
        t = next((x for x in schema["tables"] if x["name"] == pick), None)
        if t is None:
            raise BuildError("테이블을 찾을 수 없습니다: %s" % pick)
        if any(o["tname"] == pick and o["kind"] != "mart" for o in store.conn_objects(conn_id)):
            raise BuildError("이미 객체의 원본으로 쓰는 테이블입니다.")
        book = profile.code_book(c, schema)
        o = profile.profile_object(c, t, book, taken)
        cols = [_col_row(p) for p in o["props"]]
        pk = [p["col"] for p in o["props"] if "pk" in p["flags"]]
        title = next((p["col"] for p in o["props"] if "title" in p["flags"]), pk[0] if pk else "")
        d = {"src": "table", "pick": pick, "conn": conn_id, "name": o["name"], "api": o["api"], "desc": o["desc"], "table": o["table"], "rows": o["rows"], "filter": o["filter"],
             "view": o["kind"] == "view", "cols": cols, "pk": pk, "title": title, "sourceLabel": "원본 테이블 %s, %s행" % (o["table"], "{:,}".format(o["rows"] or 0))}
        d["links"] = link_candidates(c, d, o)
        return d
    if src == "mart":
        m = store.get_mart(pick)
        if m is None or m.get("home") != conn_id:
            raise BuildError("마트를 찾을 수 없습니다.")
        if m.get("obj"):
            raise BuildError("이미 객체로 지정한 마트입니다.")
        if m["status"] != "ok":
            raise BuildError("빌드에 성공한 마트만 객체로 지정할 수 있습니다.")
        o = mart_object(c, m, taken)
        cols = [_col_row(p) for p in o["props"]]
        d = {"src": "mart", "pick": pick, "conn": conn_id, "name": o["name"], "api": o["api"], "desc": o["desc"], "table": o["table"], "rows": o["rows"], "filter": None, "view": False,
             "cols": cols, "pk": list(o["pk"]), "title": next((p["col"] for p in o["props"] if "title" in p["flags"]), ""),
             "sourceLabel": "원본 마트 %s, %s행, %s 갱신" % (m["name"], "{:,}".format(m.get("rows") or 0), marts.REFRESH.get(m["refresh"], m["refresh"]))}
        d["links"] = link_candidates(c, d, o)
        return d
    raise BuildError("원본 종류를 알 수 없습니다.")


def mart_object(c: dict, m: dict, taken: set) -> dict:
    """마트를 원본으로 하는 객체 초안(속성은 마트 컬럼). 키와 제목은 마트의 제안(od)을 따른다."""
    rows = marts.sample(m["id"])
    cols = [{"name": n, "type": t, "nullable": True, "pk": False} for n, t in m["cols"]]
    od = m.get("od") or marts.suggest_od(m, rows)
    t = {"name": m["id"], "kind": "mart", "cols": cols, "pk": list(od["pk"]), "fks": []}
    mart_conn = dict(dbconn.MART_CONN)
    props: List[dict] = []
    for col in cols:
        ko, en = dic.mart_col_names(col["name"])
        p = {"col": col["name"], "ctype": col["type"], "name": ko, "api": en, "type": "string", "flags": [], "note": "", "ex": [], "mask": "", "codeGroup": "", "codes": {}, "fmt": "", "unit": ""}
        vals = [r.get(col["name"]) for r in rows]
        p["type"], p["fmt"] = profile._prop_type(col, col["name"].upper(), vals)
        if p["type"] in ("decimal", "integer") and set(col["name"].upper().split("_")) & {"AMT", "PRC"}:
            p["unit"] = "원"
        mk = dic.mask_name_kind(col["name"])
        if mk and p["type"] == "string":
            p["mask"] = mk[0]
            p["flags"].append("mask")
            if mk[1]:
                p["flags"].append("pii")
        if col["name"] in od["pk"]:
            p["flags"].append("pk")
        if col["name"] == od.get("title"):
            p["flags"] += ["title", "search"]
        props.append(p)
    profile._notes(props, t, list(od["pk"]), {})
    for p in props:
        p["ex"] = profile._examples(p, [r.get(p["col"]) for r in rows])
        order = ["pk", "title", "link", "search", "mask", "pii", "code", "hidden", "filter", "perm"]
        p["flags"] = sorted(set(p["flags"]), key=lambda f: order.index(f) if f in order else 20)
    api = od.get("api") or dic.pascal(re.sub(r"^mart_", "", m["id"]))
    base, n = api, 2
    while api in taken:
        api, n = "%s%d" % (base, n), n + 1
    return {"id": "%s.%s" % (c["id"], api), "conn": c["id"], "name": od.get("name") or m["name"], "api": api, "desc": m.get("desc") or "", "table": "MART.%s" % m["id"], "tname": m["id"],
            "kind": "mart", "mart": m["id"], "rows": m.get("rows"), "status": "review", "aiOff": False, "pos": None, "filter": None, "props": props, "pk": list(od["pk"]), "perm": None,
            "actions": [], "reviewNote": "", "mergeNote": "", "alt": [], "view": None, "_sample": rows, "_mart_conn": mart_conn["id"]}


# ── 링크 후보 ──────────────────────────────────────────────────────────────

def link_candidates(c: dict, d: dict, o: dict) -> List[dict]:
    """초안의 링크 후보: 기존 객체로의 FK 와 값 일치 링크. 각 후보는 key 로 구별한다."""
    existing = store.conn_objects(c["id"])
    by_table = {x["tname"]: x for x in existing if x["kind"] != "mart"}
    others = [x for x in store.all_objects().values() if x["conn"] != c["id"] and x["kind"] != "mart"]
    cands: List[dict] = []
    seen = set()

    def add(to: dict, keys, kind: str, basis: str, rate: Optional[float], rec: bool = True, why: str = "") -> None:
        sig = (to["id"], tuple(map(tuple, keys)))
        if sig in seen:
            return
        seen.add(sig)
        frm = {"id": o["id"], "conn": c["id"], "tname": o["tname"], "name": d["name"], "api": d["api"], "props": o["props"], "pk": o["pk"]}
        lnk = lk.new_link(frm, to, keys, kind, basis, rate=rate)
        cands.append({"key": "%s|%s" % (to["id"], ",".join("%s:%s" % tuple(k) for k in keys)), "to": to["id"], "toName": to["name"], "label": "%s → %s" % (d["name"], to["name"]),
                      "sub": why or basis, "cross": lnk["cross"], "rec": rec, "link": lnk})
    if d["src"] == "table":
        schema = reader.read_cached(c)
        t = next(x for x in schema["tables"] if x["name"] == d["pick"])
        for f in t["fks"]:
            to = by_table.get(f["ref"])
            if to:
                add(to, list(zip(f["cols"], f["refcols"])), "fk", lk.basis_text("fk"), None)
        vw = t.get("view")
        if vw:
            for j in vw["joins"]:
                for (xa, xc), (yb, yc) in (((j["a"], j["ac"]), (j["b"], j["bc"])), ((j["b"], j["bc"]), (j["a"], j["ac"]))):
                    out_col = next((s["out"] for s in vw["select"] if s["table"] == xa and s["col"].upper() == xc.upper()), None) if xa == vw["base"] else None
                    to = by_table.get(yb)
                    if out_col and to:
                        add(to, [[out_col, yc]], "view", lk.basis_text("view"), None)
        rows = o.get("_sample") or reader.sample_rows(c, d["pick"], None, profile.SAMPLE_ROWS).dicts()
        skip = {col for f in t["fks"] for col in f["cols"]}
        pk = t["pk"]
    else:
        rows = o.get("_sample", [])
        skip, pk = set(), []
    targets = list(existing) + others
    me = dict(o)
    for to, keys, ov in scan.infer_links(c, me, rows, pk, skip, [x for x in targets if x["id"] != o["id"]]):
        cross = to["conn"] != c["id"]
        add(to, keys, "cross" if cross else "infer", lk.basis_text("cross" if cross else "infer", ov["rate"], ov["blank"]), ov["rate"], rec=ov["rate"] >= scan.REC_MIN)
    # 이미 다른 후보로 갈 수 있는 FK 는 중복 관계로 표시
    exist_links = store.all_links()
    for cd in cands:
        if cd["link"]["kind"] != "fk":
            continue
        for mid in cands:
            if mid is cd or mid["link"]["kind"] != "fk":
                continue
            if any(l["from"] == mid["to"] and l["to"] == cd["to"] and l["keys"][0][0].upper() == cd["link"]["keys"][0][0].upper() for l in exist_links):
                cd["rec"] = False
                cd["sub"] = "%s를 거쳐 갈 수 있는 중복 관계예요" % mid["toName"]
    return cands


# ── 생성 ───────────────────────────────────────────────────────────────────

def create(conn_id: str, p: dict) -> dict:
    """사용자가 고친 정의로 객체를 만든다. 새 객체는 검토 필요(review) 상태다."""
    c = dbconn.need(conn_id)
    d = draft(conn_id, p.get("src") or "table", p.get("pick") or "")
    name = (p.get("name") or "").strip()
    api = (p.get("api") or "").strip()
    if not name:
        raise BuildError("표시 이름을 입력해 주세요.")
    if not API_RX.match(api):
        raise BuildError("API 이름은 영문으로 시작하는 영문·숫자 조합이어야 합니다(예: PurchaseOrder).")
    if any(o["api"] == api for o in store.conn_objects(conn_id)):
        raise BuildError("이 온톨로지에 이미 같은 API 이름의 객체가 있습니다: %s" % api)
    include = set(p["include"]) if p.get("include") is not None else {x["c"] for x in d["cols"] if not x["sys"]}
    pk = [x for x in (p["pk"] if p.get("pk") is not None else d["pk"]) if x in {col["c"] for col in d["cols"]}]
    if not pk:
        raise BuildError("기본키를 하나 이상 골라 주세요.")
    if d["src"] == "table":
        chk = check_key(conn_id, d["pick"], pk)
        if not chk["unique"]:
            raise BuildError("기본키 %s 로는 행을 구별할 수 없어요. %s행 중 서로 다른 값은 %s개뿐입니다." % (" + ".join(pk), "{:,}".format(chk["rows"]), "{:,}".format(chk["distinct"])))
    include |= set(pk)
    title = p.get("title") or d["title"]
    names = p.get("names") or {}
    # 정의 만들기: 초안을 다시 만들어 사용자가 고른 것만 반영한다
    if d["src"] == "table":
        schema = reader.read_cached(c)
        t = next(x for x in schema["tables"] if x["name"] == d["pick"])
        o = profile.profile_object(c, t, profile.code_book(c, schema), {x["api"] for x in store.conn_objects(conn_id)})
    else:
        m = store.get_mart(d["pick"])
        o = mart_object(c, m, {x["api"] for x in store.conn_objects(conn_id)})
    o.pop("_mart_conn", None)
    props = []
    for pr in o["props"]:
        sys_ = bool({"hidden", "filter"} & set(pr["flags"]))
        if not sys_ and pr["col"] not in include:
            continue
        pr["name"] = (names.get(pr["col"]) or pr["name"]).strip()
        if not sys_:
            flags = {f for f in pr["flags"] if f not in ("pk", "title")}
            if pr["col"] in pk:
                flags.add("pk")
            if pr["col"] == title:
                flags |= {"title", "search"}
            pr["flags"] = sorted(flags, key=lambda f: ["pk", "title", "link", "search", "mask", "pii", "code", "hidden", "filter", "perm"].index(f) if f in ["pk", "title", "link", "search", "mask", "pii", "code", "hidden", "filter", "perm"] else 20)
        props.append(pr)
    o.update(name=name, api=api, desc=(p.get("desc") or o["desc"]).strip(), props=props, pk=pk, id="%s.%s" % (conn_id, api))
    cands = link_candidates(c, d, o)
    o.pop("_sample", None)
    o["reviewNote"] = ("테이블을 원본으로 직접 만든 객체입니다. 속성 이름과 권한을 확인해 주세요." if d["src"] == "table"
                       else "마트를 원본으로 지정한 객체입니다. 속성 이름과 링크, 금액 속성의 권한을 확인해 주세요.")
    with store.LOCK:
        store.put_object(o)
        picked = set(p.get("links") or [])
        made = []
        for cd in cands:
            if cd["key"] in picked:
                l = copy.deepcopy(cd["link"])
                l.update(id=store.next_link_id(), **{"from": o["id"]})
                to = store.get_object(l["to"])
                l["api"] = scan._free_api(o["id"], l["api"])
                store.put_links([l])
                lk.mark_keys(o, to, l["keys"])
                made.append(l["id"])
        store.put_object(o)
        if d["src"] == "mart":
            store.update_mart(d["pick"], lambda m: m.update(obj=o["id"]))
        objs = store.conn_objects(conn_id)
        layout.place(objs, store.all_links())
        store.put_objects(objs)
        scan._review_notes(conn_id, [o["id"]])
    return store.get_object(o["id"])


# ── 고치기 ─────────────────────────────────────────────────────────────────

def update_prop(oid: str, col: str, patch: dict) -> dict:
    """속성의 표시 이름, API 이름, 설명을 고친다."""
    def mut(o: dict) -> None:
        p = next((x for x in o["props"] if x["col"] == col), None)
        if p is None:
            raise BuildError("속성을 찾을 수 없습니다.")
        if "name" in patch:
            nm = (patch["name"] or "").strip()
            if not nm:
                raise BuildError("표시 이름을 입력해 주세요.")
            p["name"] = nm
        if "api" in patch:
            a = (patch["api"] or "").strip()
            if p["api"] == "" and not a:
                pass
            elif not PROP_API_RX.match(a):
                raise BuildError("API 이름은 영문으로 시작하는 영문·숫자 조합이어야 합니다(예: orderDate).")
            elif any(x is not p and x["api"] == a for x in o["props"]):
                raise BuildError("같은 API 이름의 속성이 이미 있습니다: %s" % a)
            else:
                p["api"] = a
        if "note" in patch:
            p["note"] = (patch["note"] or "").strip()[:200]
    try:
        return store.update_object(oid, mut)
    except KeyError:
        raise BuildError("객체를 찾을 수 없습니다.")


def update_object(oid: str, patch: dict) -> dict:
    """객체의 이름, 설명을 고친다(API 이름은 도구 이름에 쓰이므로 만든 뒤에는 바꾸지 않는다)."""
    def mut(o: dict) -> None:
        if "name" in patch:
            nm = (patch["name"] or "").strip()
            if not nm:
                raise BuildError("표시 이름을 입력해 주세요.")
            o["name"] = nm
        if "desc" in patch:
            o["desc"] = (patch["desc"] or "").strip()[:500]
    try:
        return store.update_object(oid, mut)
    except KeyError:
        raise BuildError("객체를 찾을 수 없습니다.")


def finish_review(oid: str) -> dict:
    """검토 완료 또는 공개로 전환: 상태를 공개(pub)로 바꾸고, 양쪽 끝이 공개인 링크도 공개로 바꾼다."""
    with store.LOCK:
        o = store.get_object(oid)
        if o is None:
            raise BuildError("객체를 찾을 수 없습니다.")
        o["status"] = "pub"
        o["reviewNote"] = ""
        store.put_object(o)
        objs = store.all_objects()
        ls = store.all_links()
        for l in ls:
            if oid in (l["from"], l["to"]) and objs[l["from"]]["status"] == "pub" and objs[l["to"]]["status"] == "pub":
                l["status"] = "pub"
        store.links.save(ls)
    return store.get_object(oid)


def set_ai(oid: str, on: bool) -> dict:
    o = store.get_object(oid)
    if o is None:
        raise BuildError("객체를 찾을 수 없습니다.")
    if o["status"] != "pub":
        raise BuildError("공개한 객체만 AI 공개를 켜고 끌 수 있습니다.")
    return store.update_object(oid, lambda x: x.update(aiOff=not on))


def update_link(lid: str, patch: dict) -> dict:
    """링크 이름(정방향 api/name, 역방향 rapi/rev)을 고친다."""
    with store.LOCK:
        ls = store.all_links()
        l = next((x for x in ls if x["id"] == lid), None)
        if l is None:
            raise BuildError("링크를 찾을 수 없습니다.")
        for k in ("api", "rapi"):
            if k in patch:
                v = (patch[k] or "").strip()
                if not PROP_API_RX.match(v):
                    raise BuildError("API 이름은 영문으로 시작하는 영문·숫자 조합이어야 합니다.")
                l[k] = v
        for k in ("name", "rev"):
            if k in patch:
                v = (patch[k] or "").strip()
                if not v:
                    raise BuildError("이름을 입력해 주세요.")
                l[k] = v
        # 같은 객체에서 나가는 링크 이름이 겹치면 AI 도구 이름이 겹친다
        if sum(1 for x in ls if x["from"] == l["from"] and x["api"] == l["api"]) > 1 or sum(1 for x in ls if x["to"] == l["to"] and x["rapi"] == l["rapi"]) > 1:
            raise BuildError("같은 이름의 링크가 이미 있습니다.")
        store.links.save(ls)
        return l

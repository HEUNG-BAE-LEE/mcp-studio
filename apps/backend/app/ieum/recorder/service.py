"""기록이 끝난 뒤의 흐름과 업무 기능 다루기.

종료 → 분석 → 검증 → 검토. 검증은 기록 세션의 브라우저가 살아 있을 때 해야 같은 세션 쿠키·페이지·원값을 쓸 수 있어서,
검증이 끝날 때까지 브라우저를 닫지 않는다. 분석은 CPU 를 쓰므로 스레드로 넘긴다.

도구 후보로 등록하는 것이 곧 확정이다(따로 확정하지 않는다). 등록하면 스크린샷을 지운다(그림 속 개인정보). 등록 뒤 근거는
마스킹된 ARIA 텍스트로 보여 준다. 조회 단계만 남은 검증한 업무는 업무 도구(kind "flow") 하나로 등록하고(register_flow),
쓰기가 섞인 업무는 단계별 도구로 등록한다(register_steps). 단계마다 출처가 다를 수 있어(결재 시스템 등) 출처별 원본 시스템을 만든다.
도구 정책(실행 방식·마스킹·캐시·한도)은 변환 스튜디오에서만 정하므로 업무 기능의 policy 는 받지 않는다.
"""
import asyncio
import copy
import json
import logging
import re
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from app.ieum.discovery import infer
from app.ieum.discovery.policy import Policy
from app.ieum.discovery.jobs import _slug
from app.ieum.discovery.masking import Masker, is_masked
from app.ieum.gateway import credentials, session_auth, spec
from app.ieum.recorder import analyze, htmltable, replay, store
from app.ieum.repositories import logs as log_repo
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo

log = logging.getLogger(__name__)


def _audit(bf: dict, rec: dict, verification: dict, kind: str) -> None:
    """Replay 실행마다 감사 기록을 남긴다. 업무 기능 id·종류·상태·사유 코드·단계 id 만 쓴다(값·주소 없음)."""
    try:
        parts = []
        for run in verification.get("runs") or []:
            for st in run.get("steps") or []:
                parts.append(f"{st.get('id')}:{st.get('reason') or ('ok' if st.get('ok') else 'fail')}")
            if run.get("reason"):
                parts.append(f"{run.get('kind')}={run['reason']}")
        if verification.get("reason"):
            parts.append(verification["reason"])
        note = f"Replay {kind}: {verification.get('status')}" + (" [" + ", ".join(parts) + "]" if parts else "")
        ok_ = verification.get("status") in ("verified", "partial", "skipped")
        log_repo.append("recorder", bf["id"], "ok" if ok_ else "err", 0, None, rec.get("owner") or "", note)
    except Exception:
        log.exception("Replay 감사 기록을 남기지 못했습니다: %s", bf.get("id"))


async def finish(rid: str, session) -> None:
    """종료 후 흐름. 어떤 예외도 밖으로 내보내지 않고, 끝나면 반드시 세션을 닫는다."""
    from app.ieum.recorder.manager import MANAGER

    async def say(status, **extra):
        await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status=status, **extra))
        if session is not None:
            try:
                await session.broadcast(dict({"t": "status", "status": status}, **extra))
            except Exception:
                log.exception("상태 알림을 보내지 못했습니다: %s", rid)
    bf = None
    try:
        await say("analyzing")
        rec = await asyncio.to_thread(store.get_recording, rid)
        spans = await asyncio.to_thread(store.read_spans, rid)
        bf = await asyncio.to_thread(analyze.analyze, rec, spans)
        await asyncio.to_thread(store.save_function, bf)
        await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(functionId=bf["id"]))
        await say("verifying")
        if bf["steps"]:
            result = await replay.verify(bf, rec, spans, session)
            bf = await asyncio.to_thread(store.update_function, bf["id"], lambda b: b.update(
                verification=result["verification"], executionMode=result["executionMode"]))
            await asyncio.to_thread(_audit, bf, rec, result["verification"], "검증")
        await say("review")
    except Exception as exc:
        log.exception("종료 후 분석·검증에 실패했습니다: %s", rid)
        msg = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
        try:
            if bf is not None:
                def mark(b):
                    b["verification"] = {"status": "failed", "at": time.time(), "runs": [], "reason": "pipeline_error"}
                    b["notes"] = list(b.get("notes") or []) + [f"분석·검증 중 오류: {msg}"]
                await asyncio.to_thread(store.update_function, bf["id"], mark)
            await say("failed", error=f"분석·검증 중 오류: {msg}", endedAt=time.time())
        except Exception:
            log.exception("실패 상태를 남기지 못했습니다: %s", rid)
    finally:
        try:
            await MANAGER.close(rid)
        except Exception:
            log.exception("기록 세션을 닫지 못했습니다: %s", rid)


SOURCES = (analyze.USER_INPUT, analyze.PREVIOUS_STEP_OUTPUT, analyze.SESSION_CONTEXT, analyze.SYSTEM_CONFIG, analyze.DERIVED, analyze.CONSTANT)
TYPES = ("string", "number", "date")
FID = re.compile(r"^bf_[0-9a-f]{8}$")


class Busy(Exception):
    """이미 분석·검증 중이라 지금은 다시 검증할 수 없다."""


_REVERIFYING: set = set()


def _bad(msg: str):
    raise ValueError(msg)


def _validate_inputs(bf: dict, items) -> Dict[str, dict]:
    if not isinstance(items, list) or not all(isinstance(i, dict) for i in items):
        _bad("inputs 는 객체 목록이어야 합니다.")
    names = {i["name"] for i in bf["inputs"]}
    by: Dict[str, dict] = {}
    for i in items:
        n = i.get("name")
        if n not in names:
            _bad(f"알 수 없는 입력입니다: {str(n)[:40]}")
        if "source" in i and i["source"] not in SOURCES:
            _bad("입력 출처가 올바르지 않습니다.")
        if "type" in i and i["type"] not in TYPES:
            _bad("입력 유형은 string, number, date 중 하나여야 합니다.")
        if "required" in i and not isinstance(i["required"], bool):
            _bad("required 는 참/거짓이어야 합니다.")
        if "screenLabel" in i and (not isinstance(i["screenLabel"], str) or len(i["screenLabel"]) > 60):
            _bad("화면 이름은 60자 이하의 글이어야 합니다.")
        by[n] = i
    return by


def _input_of(p: dict) -> str:
    """파라미터가 짝지어진 입력 이름. 출처(input.<이름>)가 기준이다 — 이름이 겹친 경로 자리는 입력이 id_ 처럼 바뀌어 p["a"] 와 다르다.
    고정값으로 바꾼 뒤에는 남겨 둔 input, 예전 기록은 p["a"]."""
    src = p.get("from") or ""
    if src.startswith("input."):
        return src[6:]
    return p.get("input") or p["a"]


def _validate_steps(bf: dict, items) -> List[dict]:
    if not isinstance(items, list) or not all(isinstance(i, dict) and isinstance(i.get("id"), str) for i in items):
        _bad("steps 는 {id, skip, write} 목록이어야 합니다.")
    ids = [i["id"] for i in items]
    if len(set(ids)) != len(ids):
        _bad("단계 id 가 겹칩니다.")
    have = {s["id"] for s in bf["steps"]}
    if set(ids) - have:
        _bad("알 수 없는 단계 id 입니다.")
    if have - set(ids):
        _bad("모든 단계를 한 번씩 적어야 합니다(건너뛰려면 skip: true).")
    if any("skip" in i and not isinstance(i["skip"], bool) for i in items):
        _bad("skip 은 참/거짓이어야 합니다.")
    if any("write" in i and not isinstance(i["write"], bool) for i in items):
        _bad("write 는 참/거짓이어야 합니다.")
    skipped = {i["id"] for i in items if i.get("skip")}
    by_id = {s["id"]: s for s in bf["steps"]}
    for i in items:
        if i["id"] in skipped:
            continue
        for p in by_id[i["id"]]["params"]:
            if p.get("source") == analyze.PREVIOUS_STEP_OUTPUT and (p.get("from") or "").split(".", 1)[0] in skipped:
                _bad(f"건너뛴 단계의 결과를 {i['id']} 단계가 쓰고 있어 건너뛸 수 없습니다.")
    if len(skipped) == len(items):
        _bad("모든 단계를 건너뛸 수는 없습니다. 적어도 한 단계는 남겨 주세요.")
    return items


def _reoutput(bf: dict, spans: List[dict]) -> None:
    """결과(output)를 남은 단계로 다시 정한다: 건너뛰지 않은 마지막 핵심 단계(없으면 마지막 단계). 늘 지금 단계로 다시 구하므로
    건너뛰기를 되돌리면 분석이 정한 결과가 그대로 돌아온다(처음 분석 결과는 outputAnalyzed 에 둔다).
    필드는 분석과 같은 규칙(그 단계 응답 잎 중 그 행동 직후 화면에 보인 것)으로, 화면 기록이 없으면 비운다."""
    active = [s for s in bf["steps"] if not s.get("skip")]
    if not active:
        return
    last = ([s for s in active if s.get("role") == "core"] or active)[-1]
    orig = bf.setdefault("outputAnalyzed", copy.deepcopy(bf.get("output") or {"from": None, "fields": []}))
    if orig.get("from") == last["id"]:
        bf["output"] = copy.deepcopy(orig)
        return
    data = last.get("recordedData") or infer.parse_json(last.get("recordedRes") or "")
    by_seq = {sp.get("seq"): sp for sp in spans}
    seqs = [q for q in (bf.get("evidence") or {}).get(last["id"]) or [] if q in by_seq]
    human = [q for q in seqs if ((by_seq[q].get("action") or {}).get("type")) != "open"]
    sp = by_seq[(human or seqs)[0]] if seqs else {}
    aria = (sp.get("post") or {}).get("aria") or ""
    fields = analyze.output_fields(data, aria) if data is not None and aria else []
    if orig.get("from") is None and not fields:
        bf["output"] = copy.deepcopy(orig)                   # 분석이 결과를 정하지 못한 업무: 의미 있는 결과가 생기지 않으면 지어내지 않는다
        return
    bf["output"] = {"from": last["id"], "fields": fields}


def _next_step_id(bf: dict) -> str:
    nums = [int(m.group(1)) for s in bf["steps"] for m in [re.fullmatch(r"s(\d+)", s["id"])] if m]
    return f"s{max(nums or [0]) + 1}"


def _reop(bf: dict) -> None:
    """작업 유형(policy.operation)만 남은 단계로 다시 구한다. 설명 문장(analyze._describe)에만 쓰고 정책으로 보이지 않는다."""
    fresh = analyze.policy_for([analyze.step_op(s) for s in bf["steps"] if not s.get("skip")])
    bf.setdefault("policy", {})["operation"] = fresh["operation"]


EDIT_KEYS = ("name", "desc", "inputs", "steps", "promote")


def update_function(fid: str, patch: dict) -> dict:
    if not isinstance(patch, dict):
        _bad("본문은 객체여야 합니다.")
    patch = {k: v for k, v in patch.items() if k != "policy"}     # 도구 정책은 변환 스튜디오에서만 정한다(받아도 버린다)
    spans: List[dict] = []
    if "steps" in patch:                                   # 결과 단계를 다시 정할 때 쓸 화면 기록. 잠금(store.LOCK) 밖에서 미리 읽는다
        try:
            spans = store.read_spans(store.get_function(fid)["source"]["recordingId"])
        except Exception:
            spans = []

    def apply(bf: dict) -> None:
        stale = False
        write_changed = False
        for k in ("name", "desc"):
            if k in patch and not isinstance(patch[k], str):
                _bad(f"{k} 는 글이어야 합니다.")
        by = _validate_inputs(bf, patch["inputs"]) if "inputs" in patch else {}
        order = _validate_steps(bf, patch["steps"]) if "steps" in patch else None
        want = patch.get("promote")
        if "promote" in patch and not (isinstance(want, dict) and isinstance(want.get("method"), str) and isinstance(want.get("path"), str)):
            _bad("promote 는 method 와 path 글이 필요합니다.")
        hit = None
        if want is not None:
            hit = next((x for x in bf["excluded"] if x["method"] == want["method"] and x["path"] == want["path"]), None)
            if hit is None:
                _bad("제외된 요청 목록에 없는 요청입니다.")
        # 검증을 모두 마친 뒤에만 고친다
        for k in ("name", "desc"):
            if k in patch:
                bf[k] = patch[k][:300]
        for inp in bf["inputs"]:
            new = by.get(inp["name"])
            if new:
                for k in ("source", "screenLabel", "required", "type"):
                    if k in new:
                        inp[k] = new[k]
                inp["confidence"] = "high"
                for st in bf["steps"]:
                    for p in st["params"]:
                        if _input_of(p) == inp["name"] and (p.get("from") or "").startswith(("input.", "const:", "config.")):
                            p["input"] = inp["name"]                 # 고정값으로 바꿔도 어느 입력의 파라미터인지 남긴다
                            p["source"] = inp["source"]
                            p["from"] = f"input.{inp['name']}" if inp["source"] == analyze.USER_INPUT else f"const:{p.get('ex', '')}"
                stale = True
        if order is not None:
            flags = {i["id"]: bool(i.get("skip")) for i in order}
            by_id = {s["id"]: s for s in bf["steps"]}
            new_steps = []
            for i in order:
                st = dict(by_id[i["id"]], skip=flags[i["id"]])
                if "write" in i:
                    if i["write"] != bool(st.get("write")):
                        write_changed = True
                    st.update(write=i["write"], writeWhy="사람이 지정")      # 명시한 값은 같아도 사람이 확인한 것으로 남긴다
                new_steps.append(st)
            bf["steps"] = new_steps
            _reoutput(bf, spans)
            stale = True
            if write_changed:                                              # 단계의 write 로 작업 유형을 다시 구한다
                _reop(bf)
        if hit is not None:
            bf["excluded"].remove(hit)
            bf["references"] = [x for x in bf["references"] if x["path"] != hit["path"]]
            base = (hit.get("base") or bf["source"]["base"]).rstrip("/")
            write, why = analyze.classify_write({"method": hit["method"], "url": base + hit["path"], "rtype": "xhr", "post": None},
                                                Policy(base=bf["source"]["base"], read_post=""))
            new = {"id": _next_step_id(bf), "role": "prereq", "base": base, "origin": hit.get("origin") or "",
                   "method": hit["method"], "path": hit["path"], "discriminator": "", "kind": "json", "charset": None,
                   "exec": "http", "formPage": None, "write": write, "writeWhy": why, "label": "", "headers": {},
                   "outputs": {}, "params": [], "recordedRes": "", "recordedData": None, "recordedStatus": None}
            bf["steps"].append(new)
            if write:
                _reop(bf)
            stale = True
        if stale:
            bf["verification"]["status"] = "stale"
        # 고치면 등록한 도구(등록 순간의 스냅샷)와 달라진다: 다시 등록할 수 있게 "등록 전"으로 돌린다(registered 기록은 남긴다)
        if bf.get("status") in ("confirmed", "registered") and any(k in patch for k in EDIT_KEYS):
            bf["status"] = "draft"
    return store.update_function(fid, apply)


def _active(bf: dict) -> dict:
    """검증·등록에 쓰는 단계만 남긴 사본(건너뛴 단계는 보관만 한다)."""
    return dict(bf, steps=[s for s in bf["steps"] if not s.get("skip")])


def _signature(bf: dict) -> str:
    return json.dumps([bf["inputs"], bf["steps"]], sort_keys=True, ensure_ascii=False)


async def reverify(fid: str, values: Optional[Dict[str, str]] = None) -> dict:
    bf = await asyncio.to_thread(store.get_function, fid)
    rid = bf["source"]["recordingId"]
    rec = await asyncio.to_thread(store.get_recording, rid)
    if rec.get("status") in ("analyzing", "verifying") or fid in _REVERIFYING:
        raise Busy("분석·검증이 진행 중입니다. 끝난 뒤 다시 시도해 주세요.")
    _REVERIFYING.add(fid)
    try:
        spans = await asyncio.to_thread(store.read_spans, rid)
        from app.ieum.recorder.manager import MANAGER
        before = _signature(bf)
        result = await replay.verify(_active(bf), rec, spans, MANAGER.get(rid), values)

        def apply(b: dict) -> None:
            v = dict(result["verification"])
            if _signature(b) != before and v.get("status") == "verified":
                v["status"] = "stale"                 # 검증하는 사이 입력·단계가 바뀌었다. 낡은 결과를 새 정의의 통과로 읽지 않게 한다
            b.update(verification=v, executionMode=result["executionMode"] or b.get("executionMode"))
        out = await asyncio.to_thread(store.update_function, fid, apply)
    finally:
        _REVERIFYING.discard(fid)
    await asyncio.to_thread(_audit, out, rec, result["verification"], "다시 검증")
    return out


# 사람이 쓴 글(설명·이름·제목)과 키는 건드리지 않는다. 값 자리(예시·기본값·샘플)만 비운다.
_TEXT_KEYS = ("desc", "name", "title", "description", "confirmQ", "d", "o", "a")


def _scrub(x, key=None):
    """안전망: 도구 정의 어디에도 가린 문자열을 남기지 않는다(예시·응답 샘플은 비운다)."""
    if isinstance(x, dict):
        return {k: _scrub(v, k) for k, v in x.items()}
    if isinstance(x, list):
        return [_scrub(v, key) for v in x]
    return "" if isinstance(x, str) and key not in _TEXT_KEYS and is_masked(x) else x


def _tool_from_step(bf: dict, st: dict, taken: set, title: str) -> dict:
    # 이름만으로 조회라고 본 GET 이 아닌 단계는 사람이 확인하기 전까지 쓰기 도구(확인 필요)로 등록한다
    unconfirmed = str(st.get("method") or "").upper() not in ("GET", "HEAD") and st.get("writeWhy") != "사람이 지정"
    mode = "write" if (st.get("write") or unconfirmed) else "read"
    params = []
    for p in st["params"]:
        # 앞 단계 출력·세션 값은 도구 하나로는 채울 수 없어 뺀다. 다만 경로 자리는 빼면 {id} 가 그대로 나가므로 출처와 상관없이 필수 입력이다
        if p.get("source") in (analyze.PREVIOUS_STEP_OUTPUT, analyze.SESSION_CONTEXT) and p.get("loc") != "path":
            continue
        ex = p.get("ex") or ""
        masked = is_masked(ex)                           # 가린 값은 고정값·기본값·예시로 굳히지 않는다
        sch = {"type": {"number": "integer"}.get(p.get("type"), "string")}
        if ex and not masked:
            sch["example"] = ex
        label = next((i.get("screenLabel") for i in bf["inputs"] if i["name"] == _input_of(p)), None)
        required = bool(p.get("required")) or masked or p.get("loc") == "path"
        q = spec._param(p["a"], p["loc"], sch, required, label)
        if p.get("source") in (analyze.CONSTANT, analyze.SYSTEM_CONFIG) and not masked:
            q.update(rule="inject", v=ex)
        params.append(q)
    for k, v in (st.get("headers") or {}).items():
        if is_masked(v):
            continue
        params.append({"o": "-".join(w.capitalize() for w in k.split("-")), "ot": "string", "a": "", "at": "string", "loc": "header",
                       "rule": "inject", "d": "화면이 항상 같은 값으로 보내는 헤더", "ex": v, "v": v})
    res, _ = infer.build_res(st.get("recordedRes") or "", Masker(pii=True))
    tool = {"id": infer.tool_name(st["path"], "", mode, taken), "method": st["method"], "path": st["path"], "title": title,
            "status": "review", "mode": mode, "desc": bf.get("desc") or bf["name"],
            "confirmQ": f"{title} 작업을 실행할까요?" if mode == "write" else None, "params": params, "res": res, "guess": 0,
            "rec": {"function": bf["id"], "recording": bf["source"]["recordingId"]}}
    return _scrub(tool)


def _source_for_base(bf: dict, base: str, sources: List[dict], cred: dict, recipe) -> Tuple[dict, bool]:
    """단계 base 의 원본 시스템(proto "disc"): 있으면 그것, 없으면 새로. 기록 시작 주소의 원본이면 기록 계정으로 로그인 정보를 채운다.
    (원본 시스템, 로그인 정보가 있는가). 원본 시스템 저장은 부른 쪽이 한다."""
    existing = next((x for x in sources if x.get("proto") == "disc" and x.get("base") == base), None)
    sid = existing["id"] if existing else _slug(bf["name"], {x["id"] for x in sources}, urlsplit(base).netloc)
    primary = base == bf["source"]["base"].rstrip("/")
    src = {"id": sid, "name": existing["name"] if existing else (bf["name"] if primary else urlsplit(base).netloc),
           "desc": "", "proto": "disc", "spec": "업무 기록으로 추론", "base": base,
           "auth": "세션 (서비스 계정)", "authType": "session", "sync": "방금", "specUrl": None}
    known = False
    if primary and cred.get("username") and recipe:
        if not credentials.get(sid):         # 이미 있는 원본 시스템의 인증 정보는 덮어쓰지 않는다
            credentials.put(sid, {"type": "session", "username": cred["username"], "password": cred.get("password", ""), "recipe": recipe})
            session_auth.invalidate(sid)
        known = True
    return src, known or bool(credentials.get(sid))


def _register(bf: dict, steps: List[dict]) -> dict:
    by_base: Dict[str, List[dict]] = {}
    for st in steps:
        by_base.setdefault((st.get("base") or bf["source"]["base"]).rstrip("/"), []).append(st)
    rid = bf["source"]["recordingId"]
    cred = credentials.get(f"rec:{rid}") or {}
    recipe = (bf.get("auth") or {}).get("recipe")
    out_sources, out_tools, login_known = [], [], {}
    with store.LOCK:         # 원본 시스템·도구 읽기, 이름 정하기, 쓰기를 한 번에 한다(재진입 가능). 겹친 등록·스튜디오 저장이 서로를 지우지 않게
        for base, group in by_base.items():
            src, known = _source_for_base(bf, base, src_repo.list_sources(), cred, recipe)
            sid = src["id"]
            current = list(tool_repo.all_tools().get(sid, []))
            taken = {t["id"] for t in tool_repo.flat_tools()}
            login_known[sid] = known
            ids = set()
            for st in group:
                title = bf["name"] if len(steps) == 1 else f"{bf['name']} — {st['path'].rsplit('/', 1)[-1]}"
                old = next((t for t in current if (t.get("rec") or {}).get("function") == bf["id"] and t.get("kind") != "flow"
                            and t.get("method") == st["method"] and t.get("path") == st["path"]), None)
                tool = _tool_from_step(bf, st, taken, title)
                if old is not None:                  # 다시 등록하면 같은 도구를 제자리에서 바꾼다(이름·id 유지)
                    taken.discard(tool["id"])
                    tool["id"] = old["id"]
                tool = tool_repo.with_defaults(tool, src)
                if old is not None:
                    tool["calls"] = old.get("calls", 0)
                    current[current.index(old)] = tool
                else:
                    current.append(tool)
                ids.add(tool["id"])
            src["desc"] = f"도구 {len(current)}개"
            out_sources.append(src_repo.upsert_source(src))
            saved = tool_repo.replace_source_tools(sid, current)
            out_tools += [t for t in saved if t["id"] in ids]
    return {"sources": out_sources, "tools": out_tools, "loginKnown": login_known}


def _mark_registered(fid: str, mode: str, tool_ids: List[str]) -> dict:
    """등록 = 확정(설계 4절 2판). 등록 상태·확정 시각·등록한 도구를 남긴다. 부른 쪽이 store.LOCK 을 쥐고 있다."""
    now = time.time()

    def apply(b: dict) -> None:
        b.update(status="registered", confirmedAt=now, registered={"at": now, "mode": mode, "tools": list(tool_ids)})
    return store.update_function(fid, apply)


def _register_and_mark(fid: str, mode: str, build) -> dict:
    """잠금 안에서 업무 기능을 다시 읽어 등록하고 등록 완료를 남긴다. 조건을 못 채우거나 실패하면 아무것도 바꾸지 않는다.
    스크린샷 지우기는 파일 일이라 잠금 밖에서 한다."""
    with store.LOCK:
        bf = store.get_function(fid)
        out = build(bf)
        out["function"] = _mark_registered(fid, mode, [t["id"] for t in out["tools"]])
    store.delete_shots(bf["source"]["recordingId"])
    return out


def register_single(fid: str) -> dict:
    """예전 호출 호환(단계가 하나인 업무를 낱개 도구로). 화면은 flow/steps 를 쓴다."""
    def build(bf):
        bf = _active(bf)
        if len(bf["steps"]) != 1:
            raise ValueError("여러 단계 업무는 다음 작업에서 도구 하나로 등록할 수 있습니다. 지금은 단계를 낱개 도구로 등록해 주세요.")
        return _register(bf, bf["steps"])
    return _register_and_mark(fid, "steps", build)


def register_steps(fid: str) -> dict:
    def build(bf):
        bf = _active(bf)
        if not bf["steps"]:
            raise ValueError("등록할 단계가 없습니다.")
        return _register(bf, bf["steps"])
    return _register_and_mark(fid, "steps", build)


# ── 업무 도구(kind "flow") ─────────────────────────────────────────────────
FLOW_MAX_STEPS = 10
_FLOW_PARAM_KEYS = ("a", "loc", "from", "ex", "type", "needsValue")


def _is_read(st: dict) -> bool:
    """업무 도구에 넣을 수 있는 조회 단계: GET/HEAD, 또는 사람이 조회로 확정한 POST(write 가 명시적으로 False)."""
    if st.get("write"):
        return False
    if str(st.get("method") or "").upper() in ("GET", "HEAD"):
        return True
    return st.get("writeWhy") == "사람이 지정" and st.get("write") is False


def flow_blockers(bf: dict) -> List[str]:
    """업무 도구로 등록하지 못하는 이유(화면이 버튼 아래에 보여 준다). 빈 목록이면 등록할 수 있다."""
    out: List[str] = []
    v = bf.get("verification") or {}
    same_ok = any(r.get("kind") == "same-values" and r.get("ok") for r in v.get("runs") or [])
    # 낡음(stale)은 검증 뒤 정의가 바뀐 것이라 예전 실행 결과로 통과시키지 않는다. 부분 통과는 같은 값 실행이 성공했을 때만
    if not (v.get("status") == "verified" or (v.get("status") == "partial" and same_ok)):
        out.append("검증을 통과해야 등록할 수 있습니다.")
    steps = [s for s in bf.get("steps") or [] if not s.get("skip")]
    if not steps:
        out.append("등록할 단계가 없습니다.")
    elif len(steps) > FLOW_MAX_STEPS:
        out.append(f"남은 단계가 {len(steps)}개라 업무 도구 상한 {FLOW_MAX_STEPS}개를 넘습니다. 단계를 건너뛰거나 단계별로 등록하세요.")
    for st in steps:
        if not _is_read(st):
            out.append(f"쓰기 단계 {st['id']} 가 남아 있습니다. 건너뛰거나 단계별로 등록하세요.")
        if st.get("exec") == "browser":
            out.append(f"브라우저에서만 돌아가는 단계 {st['id']} 가 있습니다. 단계별로 등록하세요.")
    return out


def _flow_step(bf: dict, st: dict) -> dict:
    """도구 안에 얼리는 단계 사본. 응답 원문은 넣지 않고 판정에 쓰는 모양·기록 때 본 오류 문구만 넣는다."""
    if st.get("kind") == "html":
        shape: Optional[list] = sorted(htmltable.shape(st.get("recordedData") or {}))
    else:
        rec = infer.parse_json(st.get("recordedRes") or "")
        # 기록 응답이 JSON 으로 읽히지 않으면 모양 키를 넣지 않는다: 빈 모양([])이 있으면 core.judge 가 JSON 이 아닌 응답을 늘 모양 불일치로 본다
        shape = sorted(replay._keys(rec)) if rec is not None else None
    out = {"id": st["id"], "base": st.get("base") or bf["source"]["base"], "method": st["method"], "path": st["path"],
           "params": [{k: p[k] for k in _FLOW_PARAM_KEYS if k in p} for p in st.get("params") or []],
           "headers": {k: v for k, v in (st.get("headers") or {}).items() if not is_masked(v)},
           "outputs": dict(st.get("outputs") or {}), "kind": st.get("kind"), "charset": st.get("charset"),
           "recordedErrSeen": list(st.get("recordedErrSeen") or []),
           "write": False}                       # 실행기는 GET/HEAD 가 아닌 단계를 write 가 명시적으로 False 일 때만 보낸다
    if shape is not None:
        out["recordedShape"] = shape
    return out


def _pick_of(steps: List[dict], names: set) -> Optional[dict]:
    """고르는 지점: 앞 단계 목록의 묶음 안 주소 후보(links[틀@묶음][k.j/n…])를 출처로 쓰는 첫 단계.
    tpl 은 실행기가 행을 세는 틀이다 — analyze.get_path 가 k 를 [k.j/n@행틀] 의 행 틀(없으면 틀)로 세므로 같은 것을 쓴다."""
    ids = {s["id"] for s in steps}
    for st in steps:
        for p in st.get("params") or []:
            frm = p.get("from") or ""
            sid, _, expr = frm.partition(".")
            if sid not in ids or not expr.startswith("links["):
                continue
            m = analyze.LINK_EXPR.match(expr)
            if not m or m.group(3) is None:           # 예전 꼴 [k] 는 행 순번이 아니라 고를 수 없다
                continue
            tpl, group = analyze._split_tpl(m.group(1))
            if not group:
                continue
            arg = lambda n: n + "_" if n in names else n      # noqa: E731
            return {"list": sid, "step": st["id"], "tpl": m.group(5) or tpl, "group": group,
                    "args": {"index": arg("index"), "match": arg("match")}}
    return None


def _flow_tool(bf: dict, steps: List[dict], taken: set) -> dict:
    used = {_input_of(p) for st in steps for p in st.get("params") or [] if (p.get("from") or "").startswith("input.")}
    path_inputs = {_input_of(p) for st in steps for p in st.get("params") or []
                   if p.get("loc") == "path" and (p.get("from") or "").startswith("input.")}
    params = []
    for inp in bf["inputs"]:
        n = inp["name"]
        if n not in used:
            continue
        ex = inp.get("ex") or ""
        masked = is_masked(ex)                           # 가린 기록 값은 예시로 굳히지 않고 필수로 받는다
        sch = {"type": {"number": "integer"}.get(inp.get("type"), "string")}
        if ex and not masked:
            sch["example"] = ex
        required = bool(inp.get("required")) or masked or n in path_inputs
        q = spec._param(n, "input", sch, required, inp.get("screenLabel") or None)
        q["loc"] = "input"
        params.append(q)
    names = {inp["name"] for inp in bf["inputs"]} | {p["a"] for p in params}
    pick = _pick_of(steps, names)
    if pick:
        a = pick["args"]
        params.append({"o": a["index"], "a": a["index"], "at": "integer", "loc": "pick", "rule": "keep", "req": False,
                       "d": "목록에서 몇 번째 항목인지(1부터). 없으면 목록을 돌려줍니다."})
        params.append({"o": a["match"], "a": a["match"], "at": "string", "loc": "pick", "rule": "keep", "req": False,
                       "d": "목록 행 글자에 이 말이 든 첫 항목"})
    last = steps[-1]
    res, _ = infer.build_res(last.get("recordedRes") or "", Masker(pii=True))
    tool = {"id": infer.tool_name(last["path"], "", "read", taken), "kind": "flow", "title": bf["name"],
            "desc": bf.get("desc") or bf["name"], "status": "review", "mode": "read", "params": params, "res": res, "guess": 0,
            "flow": {"version": 1, "steps": [_flow_step(bf, st) for st in steps], "pick": pick,
                     "verifiedAt": (bf.get("verification") or {}).get("at")},
            "rec": {"function": bf["id"], "recording": bf["source"]["recordingId"]}}
    return _scrub(tool)


def _merge_flow(old: dict, new: dict) -> dict:
    """다시 등록: 이름(id)·호출 수와 스튜디오에서 고친 제목·설명·파라미터 설명·응답 매핑·정책은 옛 값을 두고 단계와 파라미터만 새로 쓴다."""
    old_d = {p.get("a"): p.get("d") for p in old.get("params") or [] if "d" in p}
    params = [dict(p, d=old_d[p["a"]]) if p.get("a") in old_d else p for p in new["params"]]
    return dict(old, kind="flow", mode="read", flow=new["flow"], params=params, rec=new["rec"])


def _register_flow(bf: dict) -> dict:
    why = flow_blockers(bf)
    if why:
        raise ValueError(" ".join(why))
    steps = _active(bf)["steps"]
    rid = bf["source"]["recordingId"]
    cred = credentials.get(f"rec:{rid}") or {}
    recipe = (bf.get("auth") or {}).get("recipe")
    primary = bf["source"]["base"].rstrip("/")
    bases = [primary] + [b for b in dict.fromkeys((st.get("base") or primary).rstrip("/") for st in steps) if b != primary]
    out_sources, login_known = [], {}
    with store.LOCK:         # _register 와 같은 이유. 재진입 가능
        main_src = None
        # 다른 주소 단계의 원본도 만든다(실행기가 단계 base 로 인증을 찾는다). 시작 주소의 원본부터 하나씩 바로 저장한다 —
        # 저장하기 전에 다음 원본의 id 를 정하면 _slug 가 같은 이름에서 같은 id 를 내어 서로 덮어쓴다
        for base in bases:
            src, known = _source_for_base(bf, base, src_repo.list_sources(), cred, recipe)
            login_known[src["id"]] = known
            src["desc"] = f"도구 {len(tool_repo.all_tools().get(src['id'], []))}개"
            saved_src = src_repo.upsert_source(src)
            if base == primary:
                main_src = src
            else:
                out_sources.append(saved_src)
        sid = main_src["id"]
        current = list(tool_repo.all_tools().get(sid, []))
        taken = {t["id"] for t in tool_repo.flat_tools()}
        old = next((t for t in current if t.get("kind") == "flow" and (t.get("rec") or {}).get("function") == bf["id"]), None)
        if old is not None:
            taken.discard(old["id"])
        tool = _flow_tool(bf, steps, taken)
        if old is not None:
            tool = _merge_flow(old, tool)
            current[current.index(old)] = tool_repo.with_defaults(tool, main_src)
        else:
            tool = tool_repo.with_defaults(tool, main_src)
            current.append(tool)
        main_src["desc"] = f"도구 {len(current)}개"
        out_sources.insert(0, src_repo.upsert_source(main_src))
        saved = tool_repo.replace_source_tools(sid, current)
    return {"sources": out_sources, "tools": [t for t in saved if t["id"] == tool["id"]], "loginKnown": login_known}


def register_flow(fid: str) -> dict:
    """검증한 조회 업무를 업무 도구 하나로 등록한다(설계 4절). 등록이 곧 확정이다."""
    return _register_and_mark(fid, "flow", _register_flow)

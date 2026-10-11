"""기록이 끝난 뒤의 흐름과 업무 기능 다루기.

종료 → 분석 → 검증 → 검토. 검증은 기록 세션의 브라우저가 살아 있을 때 해야 같은 세션 쿠키·페이지·원값을 쓸 수 있어서,
검증이 끝날 때까지 브라우저를 닫지 않는다. 분석은 CPU 를 쓰므로 스레드로 넘긴다.

확정하면 스크린샷을 지운다(그림 속 개인정보). 확정 뒤 근거는 마스킹된 ARIA 텍스트로 보여 준다.
도구 등록은 단계가 하나일 때만 "업무 기능 = 도구 하나"다. 여러 단계를 도구 하나로 실행하는 것은 다음 작업이다.
단계마다 출처가 다를 수 있어(결재 시스템 등) 출처별 원본 시스템 아래에 등록한다.
"""
import asyncio
import copy
import json
import logging
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import infer
from app.ieum.discovery.policy import Policy
from app.ieum.discovery.jobs import _slug
from app.ieum.discovery.masking import Masker, is_masked
from app.ieum.gateway import credentials, session_auth, spec
from app.ieum.recorder import analyze, replay, store
from app.ieum.repositories import logs as log_repo
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo

log = logging.getLogger(__name__)
EDITABLE_POLICY = ("operation", "risk", "approval", "scope", "sensitivity")


def _incomplete(bf: dict) -> bool:
    return bf["policy"].get("scope") is None or bf["policy"].get("sensitivity") is None


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
POLICY_ENUMS = {"operation": tuple(analyze._ORDER), "risk": ("LOW", "MEDIUM", "HIGH", "CRITICAL"), "approval": ("NONE", "CONFIRM", "HITL")}
FREE_POLICY = ("scope", "sensitivity")          # 분석은 비워 두고 사람이 짧은 글로 채운다
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


_LEVELS = {"risk": ("LOW", "MEDIUM", "HIGH", "CRITICAL"), "approval": ("NONE", "CONFIRM", "HITL")}


def _apply_policy(cur: dict, fresh: dict, keep_higher: bool) -> None:
    """다시 계산한 정책을 적용한다. 쓰기가 있으면 사람이 올려 둔 위험도·승인은 내리지 않는다."""
    for k in ("operation", "risk", "approval", "envPolicy"):
        old, new = cur.get(k), fresh[k]
        if keep_higher and k in _LEVELS and old in _LEVELS[k]:
            new = max(old, new, key=_LEVELS[k].index)
        cur[k] = new


def update_function(fid: str, patch: dict) -> dict:
    if not isinstance(patch, dict):
        _bad("본문은 객체여야 합니다.")
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
        pol = patch.get("policy")
        if "policy" in patch:
            if not isinstance(pol, dict):
                _bad("policy 는 객체여야 합니다.")
            for k, v in pol.items():
                if k in POLICY_ENUMS:
                    if v not in POLICY_ENUMS[k]:
                        _bad(f"{k} 값이 올바르지 않습니다.")
                elif k in FREE_POLICY:
                    if v is not None and (not isinstance(v, str) or len(v) > 60):
                        _bad(f"{k} 는 60자 이하의 글이어야 합니다.")
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
            if write_changed:                                              # 설계 3판 6절: 단계의 write 로 정책을 다시 구한다
                fresh = analyze.policy_for([analyze.step_op(s) for s in new_steps if not s.get("skip")])
                _apply_policy(bf["policy"], fresh, keep_higher=any(x.get("write") for x in new_steps if not x.get("skip")))
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
                fresh = analyze.policy_for([analyze.step_op(x) for x in bf["steps"] if not x.get("skip")])
                _apply_policy(bf["policy"], fresh, keep_higher=True)
            stale = True
        if pol:
            for k in EDITABLE_POLICY:
                if k in pol:
                    bf["policy"][k] = pol[k] or None
        bf["policyIncomplete"] = _incomplete(bf)
        if stale:
            bf["verification"]["status"] = "stale"
        if bf.get("status") == "confirmed":
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


def confirm(fid: str) -> dict:
    def apply(b: dict) -> None:
        b["status"] = "confirmed"
        b["policyIncomplete"] = _incomplete(b)
        b["confirmedAt"] = time.time()
    bf = store.update_function(fid, apply)
    store.delete_shots(bf["source"]["recordingId"])
    return bf


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
            sources = src_repo.list_sources()
            existing = next((x for x in sources if x.get("proto") == "disc" and x.get("base") == base), None)
            sid = existing["id"] if existing else _slug(bf["name"], {x["id"] for x in sources}, urlsplit(base).netloc)
            current = list(tool_repo.all_tools().get(sid, []))
            taken = {t["id"] for t in tool_repo.flat_tools()}
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
            login_known[sid] = known or bool(credentials.get(sid))
            ids = set()
            for st in group:
                title = bf["name"] if len(steps) == 1 else f"{bf['name']} — {st['path'].rsplit('/', 1)[-1]}"
                old = next((t for t in current if (t.get("rec") or {}).get("function") == bf["id"]
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


def register_single(fid: str) -> dict:
    bf = _active(store.get_function(fid))
    if len(bf["steps"]) != 1:
        raise ValueError("여러 단계 업무는 다음 작업에서 도구 하나로 등록할 수 있습니다. 지금은 단계를 낱개 도구로 등록해 주세요.")
    return _register(bf, bf["steps"])


def register_steps(fid: str) -> dict:
    bf = _active(store.get_function(fid))
    if not bf["steps"]:
        raise ValueError("등록할 단계가 없습니다.")
    return _register(bf, bf["steps"])

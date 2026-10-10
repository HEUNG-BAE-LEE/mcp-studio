"""기록이 끝난 뒤의 흐름과 업무 기능 다루기.

종료 → 분석 → 검증 → 검토. 검증은 기록 세션의 브라우저가 살아 있을 때 해야 같은 세션 쿠키·페이지·원값을 쓸 수 있어서,
검증이 끝날 때까지 브라우저를 닫지 않는다. 분석은 CPU 를 쓰므로 스레드로 넘긴다.

확정하면 스크린샷을 지운다(그림 속 개인정보). 확정 뒤 근거는 마스킹된 ARIA 텍스트로 보여 준다.
도구 등록은 단계가 하나일 때만 "업무 기능 = 도구 하나"다. 여러 단계를 도구 하나로 실행하는 것은 다음 작업이다.
단계마다 출처가 다를 수 있어(결재 시스템 등) 출처별 원본 시스템 아래에 등록한다.
"""
import asyncio
import logging
import time
from typing import Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import infer
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
            bf.update(verification=result["verification"], executionMode=result["executionMode"])
            await asyncio.to_thread(store.save_function, bf)
            await asyncio.to_thread(_audit, bf, rec, result["verification"], "검증")
        await say("review")
    except Exception as exc:
        log.exception("종료 후 분석·검증에 실패했습니다: %s", rid)
        msg = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
        try:
            if bf is not None:
                bf["verification"] = {"status": "failed", "at": time.time(), "runs": [], "reason": "pipeline_error"}
                bf["notes"] = list(bf.get("notes") or []) + [f"분석·검증 중 오류: {msg}"]
                await asyncio.to_thread(store.save_function, bf)
            await say("failed", error=f"분석·검증 중 오류: {msg}", endedAt=time.time())
        except Exception:
            log.exception("실패 상태를 남기지 못했습니다: %s", rid)
    finally:
        try:
            await MANAGER.close(rid)
        except Exception:
            log.exception("기록 세션을 닫지 못했습니다: %s", rid)


def update_function(fid: str, patch: dict) -> dict:
    bf = store.get_function(fid)
    stale = False
    for k in ("name", "desc"):
        if k in patch:
            bf[k] = str(patch[k])[:300]
    if "inputs" in patch:
        by = {i["name"]: i for i in patch["inputs"]}
        for inp in bf["inputs"]:
            new = by.get(inp["name"])
            if new:
                for k in ("source", "screenLabel", "required", "type"):
                    if k in new:
                        inp[k] = new[k]
                inp["confidence"] = "high"
                for st in bf["steps"]:
                    for p in st["params"]:
                        if p["a"] == inp["name"] and (p.get("from") or "").startswith(("input.", "const:", "config.")):
                            p["source"] = inp["source"]
                            p["from"] = f"input.{p['a']}" if inp["source"] == analyze.USER_INPUT else f"const:{p.get('ex', '')}"
                stale = True
    if "steps" in patch:
        order = [s["id"] for s in patch["steps"] if not s.get("skip")]
        bf["steps"] = [s for sid in order for s in bf["steps"] if s["id"] == sid]
        stale = True
    if "promote" in patch:
        want = patch["promote"]
        hit = next((x for x in bf["excluded"] if x["method"] == want["method"] and x["path"] == want["path"]), None)
        if hit:
            bf["excluded"].remove(hit)
            bf["references"] = [x for x in bf["references"] if x["path"] != hit["path"]]
            bf["steps"].append({"id": f"s{len(bf['steps']) + 1}", "role": "prereq", "base": bf["source"]["base"], "origin": "",
                                "method": hit["method"], "path": hit["path"], "discriminator": "", "kind": "json", "charset": None,
                                "exec": "http", "formPage": None, "write": hit["method"] not in ("GET", "HEAD"), "headers": {},
                                "outputs": {}, "params": [], "recordedRes": "", "recordedData": None, "recordedStatus": None})
            stale = True
    if "policy" in patch:
        for k in EDITABLE_POLICY:
            if k in patch["policy"]:
                bf["policy"][k] = patch["policy"][k] or None
    bf["policyIncomplete"] = _incomplete(bf)
    if stale:
        bf["verification"]["status"] = "stale"
    if bf.get("status") == "confirmed":
        bf["status"] = "draft"
    store.save_function(bf)
    return bf


async def reverify(fid: str, values: Optional[Dict[str, str]] = None) -> dict:
    bf = await asyncio.to_thread(store.get_function, fid)
    rid = bf["source"]["recordingId"]
    rec = await asyncio.to_thread(store.get_recording, rid)
    spans = await asyncio.to_thread(store.read_spans, rid)
    from app.ieum.recorder.manager import MANAGER
    result = await replay.verify(bf, rec, spans, MANAGER.get(rid), values)
    bf.update(verification=result["verification"], executionMode=result["executionMode"] or bf.get("executionMode"))
    await asyncio.to_thread(store.save_function, bf)
    await asyncio.to_thread(_audit, bf, rec, result["verification"], "다시 검증")
    return bf


def confirm(fid: str) -> dict:
    bf = store.get_function(fid)
    bf["status"] = "confirmed"
    bf["policyIncomplete"] = _incomplete(bf)
    bf["confirmedAt"] = time.time()
    store.save_function(bf)
    store.delete_shots(bf["source"]["recordingId"])
    return bf


def _scrub(x):
    """안전망: 도구 정의 어디에도 가린 문자열을 남기지 않는다(예시·응답 샘플은 비운다)."""
    if isinstance(x, dict):
        return {k: _scrub(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_scrub(v) for v in x]
    return "" if isinstance(x, str) and is_masked(x) else x


def _tool_from_step(bf: dict, st: dict, taken: set, title: str) -> dict:
    mode = "write" if st.get("write") else "read"
    params = []
    for p in st["params"]:
        if p.get("source") in (analyze.PREVIOUS_STEP_OUTPUT, analyze.SESSION_CONTEXT):
            continue
        ex = p.get("ex") or ""
        masked = is_masked(ex)                           # 가린 값은 고정값·기본값·예시로 굳히지 않는다
        sch = {"type": {"number": "integer"}.get(p.get("type"), "string")}
        if ex and not masked:
            sch["example"] = ex
        label = next((i.get("screenLabel") for i in bf["inputs"] if i["name"] == p["a"]), None)
        required = bool(p.get("required")) or masked
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
    out_sources, out_tools = [], []
    for base, group in by_base.items():
        sources = src_repo.list_sources()
        existing = next((x for x in sources if x.get("proto") == "disc" and x.get("base") == base), None)
        sid = existing["id"] if existing else _slug(bf["name"], {x["id"] for x in sources}, urlsplit(base).netloc)
        current = tool_repo.all_tools().get(sid, [])
        taken = {t["id"] for t in tool_repo.flat_tools()}
        primary = base == bf["source"]["base"].rstrip("/")
        src = {"id": sid, "name": existing["name"] if existing else (bf["name"] if primary else urlsplit(base).netloc),
               "desc": f"도구 {len(current) + len(group)}개", "proto": "disc", "spec": "업무 기록으로 추론", "base": base,
               "auth": "세션 (서비스 계정)", "authType": "session", "sync": "방금", "specUrl": None}
        if primary and cred.get("username") and recipe:
            credentials.put(sid, {"type": "session", "username": cred["username"], "password": cred.get("password", ""), "recipe": recipe})
            session_auth.invalidate(sid)
        out_sources.append(src_repo.upsert_source(src))
        new = []
        for st in group:
            title = bf["name"] if len(steps) == 1 else f"{bf['name']} — {st['path'].rsplit('/', 1)[-1]}"
            new.append(tool_repo.with_defaults(_tool_from_step(bf, st, taken, title), src))
        saved = tool_repo.replace_source_tools(sid, current + new)
        ids = {t["id"] for t in new}
        out_tools += [t for t in saved if t["id"] in ids]
    return {"sources": out_sources, "tools": out_tools, "loginKnown": bool(cred.get("username") and recipe)}


def register_single(fid: str) -> dict:
    bf = store.get_function(fid)
    if len(bf["steps"]) != 1:
        raise ValueError("여러 단계 업무는 다음 작업에서 도구 하나로 등록할 수 있습니다. 지금은 단계를 낱개 도구로 등록해 주세요.")
    return _register(bf, bf["steps"])


def register_steps(fid: str) -> dict:
    bf = store.get_function(fid)
    if not bf["steps"]:
        raise ValueError("등록할 단계가 없습니다.")
    return _register(bf, bf["steps"])

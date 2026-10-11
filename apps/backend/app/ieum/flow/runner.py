"""업무 도구 하나를 실행한다: 고르기(목록·index·match) → 단계 실행(flow.core) → 마지막 결과 변환.
게이트웨이(engine.invoke)가 kind == "flow" 인 도구를 여기로 넘긴다. 조회 단계만 있는 업무 도구만 만들어지므로 쓰기를 묻지 않는다.

배포한 MCP 서버 프로세스가 이 모듈을 불러오므로 Playwright·레코더 세션(recorder.session/manager)을 import 하지 않는다."""
import asyncio
import copy
import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from app.ieum.flow import core
from app.ieum.gateway import credentials, engine, session_auth
from app.ieum.recorder import analyze, htmltable
from app.ieum.repositories import sources as src_repo

LIST_MAX, ROW_TEXT, GAP, CALL_TIMEOUT, MAX_STEPS = 20, 120, 0.6, 60, 10
HINT = "index 나 match 로 다시 부르면 그 항목의 상세를 가져옵니다."
_K = re.compile(r"(\.links\[.*\]\[)\d+(\.)")
_K_OUT = re.compile(r"^(links\[.*\]\[)\d+(\.)")          # 목록 단계 outputs 의 이름·경로(단계 id 접두어 없음)
_LOCAL = ("localhost", "127.0.0.1", "::1")

# run_steps 의 이유 코드 → 도구 오류 문구. needs_value 는 바깥에 masked_value 로 알린다
_MSG = {
    "chain_broken": "앞 단계 응답에서 다음 단계에 넣을 값을 찾지 못했습니다. 화면 구성이 바뀌었을 수 있습니다.",
    "masked_value": "가린 값이 남아 있어 보내지 않았습니다. 업무 기록에서 값을 다시 확인해 주세요.",
    "unresolved_path": "주소의 {자리}를 채우지 못했습니다.",
    "http_error": "원본 시스템이 오류를 돌려줬거나 연결하지 못했습니다.",
    "blocked": "차단된 주소라 보내지 않았습니다.",
    "waf_blocked": "원본 시스템의 방화벽이 요청을 막았습니다.",
    "error_response": "원본 시스템이 오류 화면을 돌려줬습니다.",
    "shape_mismatch": "응답 모양이 기록 때와 다릅니다. 화면이 바뀌었을 수 있습니다.",
    "auth_expired": "서비스 계정으로 다시 로그인했지만 원본 시스템이 로그인을 요구합니다. 계정 권한을 확인해 주세요.",
    "write_denied": "조회가 아닌 단계라 보내지 않았습니다.",
    "browser_needed": "브라우저로만 보낼 수 있는 단계라 실행하지 못했습니다.",
}


class _Fail(Exception):
    def __init__(self, code: str, msg: str, step: Optional[str] = None):
        super().__init__(msg)
        self.code, self.msg, self.step = code, msg, step


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s or "").lower()


def _rows(data, pick) -> list:
    """목록 단계 data 의 고르는 묶음 행들: [(행 번호 ri, 행 글자)]."""
    ids = analyze._row_ids(pick["tpl"], data, pick["group"])
    text = {}
    for c in htmltable.links_of(data):
        if c.get("ri") is not None and c["ri"] not in text:
            text[c["ri"]] = c["row"]
    return [(ri, text.get(ri, "")) for ri in ids]


def _listing(rows) -> dict:
    return {"items": [{"index": i + 1, "text": t[:ROW_TEXT]} for i, (_, t) in enumerate(rows[:LIST_MAX])], "total": len(rows), "hint": HINT}


def _sub_k(rx, s: str, k: int) -> str:
    return rx.sub(lambda m: m.group(1) + str(k) + m.group(2), s, count=1)


def _with_k(steps, pick, k: int) -> list:
    """고르는 단계의 목록 출처 k 를 고른 행 순번으로 바꾼 단계 사본. 원 단계는 건드리지 않는다.
    값은 목록 단계의 outputs 에서 이름으로 찾으므로(core.value_of), 목록 단계 outputs 의 같은 이름도 k 를 바꿔 둔다."""
    out = copy.deepcopy(steps)
    prefix = pick["list"] + ".links["
    renamed: Dict[str, str] = {}                           # 목록 단계 outputs 이름: 예전 → 새
    for st in out:
        if st["id"] != pick["step"]:
            continue
        for p in st.get("params") or []:
            frm = p.get("from") or ""
            if frm.startswith(prefix):
                p["from"] = _sub_k(_K, frm, k)
                renamed[frm[len(pick["list"]) + 1:]] = p["from"][len(pick["list"]) + 1:]
    for st in out:
        if st["id"] != pick["list"] or not renamed:
            continue
        outs = {}
        for name, path in (st.get("outputs") or {}).items():
            if name in renamed:
                outs[renamed[name]] = _sub_k(_K_OUT, path, k)
            else:
                outs[name] = path
        st["outputs"] = outs
    return out


def _without_link_outputs(steps, pick) -> list:
    """목록만 볼 때: 목록 단계의 주소 후보 출력(기록 때 행 순번)은 뒤 단계용이라 빼 둔다(행이 줄어도 목록은 보인다)."""
    out = copy.deepcopy(steps)
    for st in out:
        if st["id"] == pick["list"]:
            st["outputs"] = {n: p for n, p in (st.get("outputs") or {}).items() if not str(n).startswith("links[")}
    return out


def _check(tool: dict, args: dict) -> Tuple[Optional[int], Optional[str]]:
    """입력 확인. (index, match) 를 돌려준다."""
    if not isinstance(args, dict):
        raise _Fail("missing_input", "arguments 는 객체여야 합니다.")
    missing = [p["a"] for p in tool.get("params") or []
               if p.get("loc") == "input" and p.get("req") and args.get(p["a"]) in (None, "")]
    if missing:
        raise _Fail("missing_input", "필수 값이 없습니다: " + ", ".join(missing))
    pick = (tool.get("flow") or {}).get("pick")
    if not pick:
        return None, None
    names = pick.get("args") or {}
    raw_i, raw_m = args.get(names.get("index", "index")), args.get(names.get("match", "match"))
    index = None
    if raw_i not in (None, ""):
        if isinstance(raw_i, bool):
            raise _Fail("bad_index", "index 는 1 이상 정수여야 합니다.")
        if isinstance(raw_i, int):
            index = raw_i
        elif isinstance(raw_i, str) and raw_i.strip().isdigit():
            index = int(raw_i.strip())
        if index is None or index < 1:
            raise _Fail("bad_index", "index 는 1 이상 정수여야 합니다.")
    match = str(raw_m) if raw_m not in (None, "") and index is None else None
    return index, match


def _origin(url: str) -> str:
    p = urlsplit(url or "")
    return f"{p.scheme}://{p.netloc}".lower()


def _source_for(base: str, source: dict, all_sources: List[dict]) -> Optional[dict]:
    """단계 base 에 맞는 원본 시스템. 같은 proto·같은 base 인 것, 없으면 도구의 원본(같은 출처일 때만 — 다른 호스트에 인증을 보내지 않는다)."""
    b = (base or "").rstrip("/")
    for s in all_sources:
        if (s.get("base") or "").rstrip("/") == b and s.get("proto") == source.get("proto"):
            return s
    if _origin(source.get("base") or "") == _origin(b):
        return source
    return None


class _Recording:
    """HttpTransport 를 감싸 단계별 요청·응답을 기록한다. cache 에 든 단계는 다시 보내지 않고 앞서 받은 응답을 돌려준다
    (목록을 보고 행을 고른 뒤 같은 목록을 또 부르지 않으려고)."""
    mode = "session"

    def __init__(self, inner: core.HttpTransport, pace: list):
        self.inner, self.pace = inner, pace
        self.records: List[dict] = []
        self.cache: Dict[str, tuple] = {}
        self.last_sent = 0.0

    @property
    def cookies(self):
        return self.inner.cookies

    @cookies.setter
    def cookies(self, value):
        self.inner.cookies = value

    async def send(self, step, url, headers, params, form, json_body):
        if step["id"] in self.cache:
            self.pace[0] = self.last_sent                  # 보내지 않았으므로 간격 기준을 되돌린다
            return self.cache[step["id"]]
        full = url + (("&" if "?" in url else "?") + core.encode(params, step.get("charset")) if params else "")
        body = core.encode(form, step.get("charset")) if form else (json.dumps(json_body, ensure_ascii=False) if json_body is not None else "")
        sent = dict(headers)
        ck = self.inner._cookie_header(full)
        if ck:
            sent["Cookie"] = ck
        rec = {"id": step["id"], "originRequest": {"method": step["method"], "url": engine._redact_url(full),
                                                   "headers": engine._redact(sent), "body": engine._clip(body)}}
        self.records.append(rec)
        t0 = time.time()
        try:
            got = await self.inner.send(step, url, headers, params, form, json_body)
        finally:
            rec["sourceMs"] = int((time.time() - t0) * 1000)
            self.last_sent = self.pace[0]
        status, _, _, text = got
        rec["originResponse"] = {"status": status, "body": engine._clip(text or "")}
        self.cache[step["id"]] = got
        return got


async def _deny_write(_st):
    return False                                           # 업무 도구는 조회만 — 쓰기로 보이는 단계는 막는다


def _first_fail(res: dict) -> Tuple[str, Optional[str], Optional[str]]:
    bad = next((s for s in reversed(res.get("steps") or []) if not s.get("ok")), {})
    reason = res.get("reason") or bad.get("reason") or "http_error"
    note = bad.get("note")
    if reason == "needs_value":
        reason = "masked_value"
    if reason == "http_error" and (note or "").startswith("차단"):
        reason = "blocked"
    return reason, bad.get("id"), note


async def _auth(steps: List[dict], source: dict) -> Tuple[List[dict], List[dict], List[str]]:
    """단계마다 맞는 원본 시스템의 금고 값으로 인증을 붙인다. (단계 사본, 쿠키 목록, 세션 원본 id들)"""
    all_sources = await asyncio.to_thread(src_repo.list_sources)
    out = copy.deepcopy(steps)
    cookies: List[dict] = []
    session_ids: List[str] = []
    done_hosts = set()
    for st in out:
        base = (st.get("base") or source.get("base") or "").rstrip("/")
        src = _source_for(base, source, all_sources)
        if not src or not src.get("id"):
            continue
        cred = await asyncio.to_thread(credentials.get, src["id"]) or {}
        t = cred.get("type")
        if t == "session":
            host = (urlsplit(base).hostname or "").lower()
            if (src["id"], host) in done_hosts:
                continue
            done_hosts.add((src["id"], host))
            try:
                header = await asyncio.to_thread(session_auth.cookie_header, src["id"], src.get("base") or base, cred)
            except session_auth.LoginError as exc:
                raise _Fail("auth_expired", "서비스 계정으로 로그인하지 못했습니다. (%s)" % exc, st["id"])
            for part in (header or "").split(";"):
                name, eq, value = part.strip().partition("=")
                if eq and name:
                    cookies.append({"name": name, "value": value, "domain": host, "path": "/"})
            if src["id"] not in session_ids:
                session_ids.append(src["id"])
        elif t in ("key", "bearer", "basic"):
            headers, query = engine.auth_headers(src, cred)
            st["headers"] = dict(st.get("headers") or {}, **headers)
            for k, v in query.items():                      # 쿼리로 보내는 키
                st["params"] = list(st.get("params") or []) + [{"a": k, "loc": "query", "from": "const:" + str(v), "ex": ""}]
    return out, cookies, session_ids


async def _run(source: dict, tool: dict, args: dict, index: Optional[int], match: Optional[str], trace: dict,
               pace: list) -> Tuple[Any, Optional[dict], bool]:
    """한 번 실행한다. 세션이 끊기면 _Fail("auth_expired") 를 일으킨다. (마지막 단계 data 또는 목록, 고른 항목, 목록인가)"""
    flow = tool.get("flow") or {}
    pick = flow.get("pick")
    steps = flow.get("steps") or []
    default_base = source.get("base") or (steps[0].get("base") if steps else "") or ""
    steps, cookies, session_ids = await _auth(steps, source)
    gap = 0.0 if all((urlsplit((st.get("base") or default_base)).hostname or "").lower() in _LOCAL for st in steps) else GAP
    rec = _Recording(core.HttpTransport(cookies), pace)
    trace["_rec"] = rec
    inputs = {p["a"]: str(args[p["a"]]) for p in tool.get("params") or [] if p.get("loc") == "input" and p["a"] in args}

    async def run(ss, stop_after=None):
        res = await core.run_steps(ss, default_base, inputs, {}, rec, None, _deny_write, gap, needs={}, pace=pace, stop_after=stop_after)
        by_id = {s["id"]: s for s in res.get("steps") or []}
        for r in rec.records:                              # 이번 실행에서 보낸 단계에 판정을 붙인다
            if "ok" not in r and r["id"] in by_id:
                r["ok"], r["reason"] = by_id[r["id"]].get("ok"), by_id[r["id"]].get("reason")
        if not res["ok"]:
            code, sid, note = _first_fail(res)
            if code == "auth_expired":
                raise _Fail("auth_expired", _MSG["auth_expired"], sid)
            msg = _MSG.get(code, "단계를 실행하지 못했습니다.") + (f" ({note})" if note and code != "blocked" else "")
            raise _Fail(code, msg, sid)
        return res

    trace["_sessions"] = session_ids
    if not pick:
        res = await run(steps)
        return res["data"].get(steps[-1]["id"]), None, False
    res = await run(_without_link_outputs(steps, pick), stop_after=pick["list"])
    rows = _rows(res["data"].get(pick["list"]), pick)
    listing = _listing(rows)
    if index is None and match is None:
        return listing, None, True
    if index is not None:
        if index > len(rows):
            trace["list"] = listing
            raise _Fail("index_out_of_range", f"index {index} 는 목록 범위(1~{len(rows)})를 넘습니다.", pick["list"])
        k = index - 1
    else:
        want = _norm(match)
        k = next((i for i, (_, t) in enumerate(rows) if want in _norm(t)), None)
        if k is None:
            trace["list"] = listing
            raise _Fail("no_match", f"목록에서 \"{match}\" 가 든 항목을 찾지 못했습니다.", pick["list"])
    res = await run(_with_k(steps, pick, k))
    return res["data"].get(steps[-1]["id"]), {"index": k + 1, "text": rows[k][1][:ROW_TEXT]}, False


def _finish_trace(trace: dict) -> None:
    rec: Optional[_Recording] = trace.pop("_rec", None)
    trace.pop("_sessions", None)
    steps = [{"id": r["id"], "originRequest": r.get("originRequest"), "originResponse": r.get("originResponse"),
              "sourceMs": r.get("sourceMs", 0), "ok": r.get("ok"), "reason": r.get("reason")} for r in (rec.records if rec else [])]
    trace["steps"] = steps
    if steps:
        trace["originRequest"], trace["originResponse"] = steps[-1]["originRequest"], steps[-1]["originResponse"]
    trace["sourceMs"] = sum(s["sourceMs"] for s in steps)


async def _invoke(source: dict, tool: dict, args: dict, ctx: dict) -> Tuple[Any, dict]:
    trace: Dict[str, Any] = {"args": args, "steps": [], "rulesReq": [], "rulesRes": []}
    t0 = time.time()

    def err(f: _Fail):
        _finish_trace(trace)
        trace.setdefault("convertMs", int((time.time() - t0) * 1000))
        where = f" (단계 {f.step})" if f.step else ""
        return engine.ToolError(f"[{f.code}] {f.msg}{where}", trace)

    try:
        steps = (tool.get("flow") or {}).get("steps") or []
        if not steps:
            raise _Fail("chain_broken", "업무 도구에 단계가 없습니다.")
        if len(steps) > MAX_STEPS:
            raise _Fail("too_many_steps", f"단계가 {len(steps)}개로 상한 {MAX_STEPS}개를 넘습니다.")
        index, match = _check(tool, args)
        trace["convertMs"] = int((time.time() - t0) * 1000)
        pace = [0.0]

        async def attempt():
            try:
                return await _run(source, tool, args, index, match, trace, pace)
            except _Fail as f:
                sessions = trace.get("_sessions") or []
                if f.code != "auth_expired" or not sessions:
                    raise
                for sid in sessions:                       # 세션이 끊겼다: 다시 로그인해 처음 단계부터 한 번 더(조회뿐이라 안전하다)
                    await asyncio.to_thread(session_auth.invalidate, sid)
                prev = trace["_rec"].records
                out = await _run(source, tool, args, index, match, trace, pace)
                trace["_rec"].records[:0] = prev
                return out

        try:
            data, picked, is_list = await asyncio.wait_for(attempt(), CALL_TIMEOUT)
        except asyncio.TimeoutError:
            raise _Fail("timeout", f"한 호출 상한 {CALL_TIMEOUT}초 안에 끝나지 않았습니다.")
    except _Fail as f:
        raise err(f) from None

    t1 = time.time()
    if is_list:
        result = data                                      # 목록 보기는 변환하지 않고 그대로 돌려준다
    else:
        x = htmltable.without_links(data) if htmltable.is_copy(data) else data
        result = engine.convert_response(tool, x, mask=tool.get("mask", True)) if isinstance(x, (dict, list)) else None
        if not result:
            result = x
        if picked is not None:
            result = dict(result, picked=picked) if isinstance(result, dict) else {"result": result, "picked": picked}
    _finish_trace(trace)
    trace["convertMs"] = trace.get("convertMs", 0) + int((time.time() - t1) * 1000)
    trace["aiResult"] = result
    return result, trace


def invoke(source: dict, tool: dict, args: dict, ctx: Optional[dict] = None) -> Tuple[Any, dict]:
    """동기 진입점. MCP 서버·테스트 실행은 스레드 풀에서 부르므로 이벤트 루프가 없다. 실패는 engine.ToolError("[이유코드] …")."""
    return asyncio.run(_invoke(source, tool, args or {}, ctx or {}))

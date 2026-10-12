"""Replay 검증: 업무 기능을 실제로 다시 실행해 본다.

두 번 돌린다. 같은 값으로 한 번(기록이 재현되는가), 사용자 입력만 바꿔 한 번(입력이 정말 바꿀 수 있는 값이고, 단계
연결이 새 값으로도 이어지는가). 다른 값은 지어내지 않는다. 날짜는 한 달 앞으로, 그 밖에는 기록 안의 다른 값을 쓴다.

같은 값은 메모리의 원값으로 보낸다. 저장된 값은 마스킹되어 있어(010****5678) 그대로 보내면 실패한다. 세션이 끝나
원값이 없으면 "값 다시 입력 필요"로 멈추고, 사람이 검토 화면에서 넣은 값으로만 다시 검증한다(그 값도 저장하지 않는다).

성공은 HTTP 200 만으로 판단하지 않는다. 로그인 화면으로 튕기지 않았고, 응답 구조(JSON 키 또는 HTML 표 열)가 기록과
같고, 오류 표시가 없고, 다음 단계로 넘길 값을 실제로 꺼낼 수 있어야 한다.

단계마다 자기 출처로 보내고, 폼은 기록한 인코딩으로 보낸다(EUC-KR 레거시). 매번 바뀌는 숨은 토큰이 필요한 단계는
브라우저 안에서 직전 화면을 다시 열어 새 토큰을 받아 제출한다. 운영 쓰기 단계는 직전에 다시 승인을 받는다.
"""
import asyncio
import datetime as dt
import json
import re
import time
from typing import Any, Awaitable, Callable, Dict, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import infer
from app.ieum.flow import core
# 단계 실행 핵심은 flow.core 로 옮겼다. 시험과 다른 모듈이 replay.<이름> 으로 쓰므로 여기서 다시 들여와 이름을 유지한다
from app.ieum.flow.core import (TIMEOUT, UA, encode, judge, HttpTransport, NeedsValue, _looks_error, _keys, _ERR_TEXT,  # noqa: F401
                                _ERR_KEY, ERR_PAGE_TEXT, _TITLE, _PLACEHOLDER, normalize_path as _normalize_path,
                                _recovered, value_of as _value)
from app.ieum.gateway import credentials, session_auth
from app.ieum.gateway.session_auth import LoginError
from app.ieum.recorder import config, htmltable, scope
from app.ieum.discovery.masking import is_masked
from app.ieum.recorder.analyze import leaves


_FETCH_HIDDEN = """async ([formPage, hidden]) => {
    const html = await (await fetch(formPage, {credentials: 'include'})).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = {};
    for (const name of hidden) { const el = doc.querySelector('input[type=hidden][name="' + name + '"]'); if (el) out[name] = el.value; }
    return out;
}"""
_FETCH_SEND = """async ([m, u, h, body]) => {
    const r = await fetch(u, {method: m, headers: h, body, redirect: 'manual', credentials: 'include'});
    return [r.type === 'opaqueredirect' ? 0 : r.status, r.headers.get('location'), r.headers.get('content-type') || '', await r.text()];
}"""


class BrowserTransport:
    """기록 세션 페이지 안에서 보낸다. 숨은 토큰이 필요하면 직전 화면(formPage)을 다시 받아 새 값을 채운다.
    본문은 파이썬에서 기록한 인코딩으로 미리 만들어 문자열로 넘긴다(URLSearchParams 는 항상 UTF-8)."""
    mode = "browser"

    def __init__(self, page, guard=None):
        self.page, self.guard = page, guard

    async def send(self, step, url, headers, params, form, json_body):
        form = dict(form or {})
        hidden = [p["a"] for p in step["params"] if (p.get("from") or "").startswith("session.hidden.")]
        if step.get("formPage") and hidden:
            form.update(await self.page.evaluate(_FETCH_HIDDEN, [step["formPage"], hidden]) or {})
        if any(is_masked(v) for v in form.values()):     # 화면에서 토큰을 못 찾아 가린 값이 남았다
            raise NeedsValue()
        if any(not form.get(h) for h in hidden):          # 비밀 이름의 토큰(ex="")을 화면에서 못 찾았다. 빈 값으로 보내지 않는다
            raise NeedsValue()
        if any(is_masked(v) for v in (params or {}).values()) or (
                json_body is not None and any(is_masked(v) for _, v in leaves(json_body))):
            raise NeedsValue()                            # 쿼리·JSON 본문은 새로 받지 않으므로 가린 값이 남으면 보내지 않는다
        headers = dict(headers)
        if params:
            url = url + ("&" if "?" in url else "?") + encode(params, step.get("charset"))
        body = None
        if json_body is not None:
            body, headers["content-type"] = json.dumps(json_body, ensure_ascii=False), "application/json"
        elif form:
            body = encode(form, step.get("charset"))
            headers["content-type"] = f"application/x-www-form-urlencoded; charset={step.get('charset') or 'UTF-8'}"
        # 승인받은 쓰기는 기록 가드를 다시 지난다. 바로 이 요청(메서드·최종 주소·본문)만, 보내는 동안만 통과시킨다.
        # 표시 헤더를 붙이는 방식은 쓰지 않는다(다른 출처면 CORS 사전 요청이 생겨 그것이 붙잡힌다).
        # 조회로 분류된 비GET 단계도 같다: run_once 가 보내기 직전에 승인을 받았다(설계 3판 7절).
        exact = step.get("write") or str(step.get("method") or "").upper() not in ("GET", "HEAD")
        token = self.guard.allow_exact(step["method"], url, body) if (self.guard is not None and exact) else None
        try:
            r = await self.page.evaluate(_FETCH_SEND, [step["method"], url, headers, body])
        finally:
            if token is not None:
                self.guard.revoke(token)
        return r[0], r[1], r[2], (r[3] or "")[:htmltable.MAX_SCAN]


_is_masked = is_masked


async def run_once(bf: dict, inputs: Dict[str, str], raw: Dict[str, Optional[str]], http, browser,
                   ask_write: Callable[[dict], Awaitable[Any]], gap: float, kind: str = "same-values",
                   relogin: Optional[Callable[[], Awaitable[Optional[Any]]]] = None, pace: Optional[list] = None) -> dict:
    """업무 기능 하나를 다시 실행한다(실행 핵심은 flow.core.run_steps). 결과에서 data 는 저장하지 않으므로 뺀다."""
    needs = {i["name"]: bool(i.get("needsValue")) for i in bf.get("inputs", [])}
    out = await core.run_steps(bf["steps"], bf["source"]["base"], inputs, raw, http, browser, ask_write, gap,
                               needs=needs, kind=kind, relogin=relogin, pace=pace)
    out.pop("data", None)
    return out


def _shift_month(v: str) -> str:
    """같은 날의 한 달 전. 그 달에 그 날이 없거나 원래 날이 그 달의 마지막 날이면 한 달 전 달의 마지막 날."""
    d = dt.date(int(v[:4]), int(v[4:6]), int(v[6:]))
    last_prev = d.replace(day=1) - dt.timedelta(days=1)
    next_first = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    if d == next_first - dt.timedelta(days=1):
        return last_prev.strftime("%Y%m%d")
    return last_prev.replace(day=min(d.day, last_prev.day)).strftime("%Y%m%d")


def varied_inputs(bf: dict, spans: list) -> Optional[Dict[str, str]]:
    out, changed = {}, False
    for inp in bf.get("inputs", []):
        v = str(inp.get("ex") or "")
        if inp.get("source") != "USER_INPUT" or not v or inp.get("needsValue"):
            out[inp["name"]] = v
            continue
        if inp.get("type") == "date" and re.fullmatch(r"\d{8}", v):
            out[inp["name"]] = _shift_month(v)
            changed = True
            continue
        alt = _alternative(inp["name"], v, spans)
        out[inp["name"]] = alt or v
        changed = changed or bool(alt)
    return out if changed else None


def _alternative(name: str, value: str, spans: list) -> Optional[str]:
    want = name.lower().replace("_", "")
    for sp in spans:
        for n in sp.get("network", []):
            data = n.get("data") or infer.parse_json(n.get("res") or "")
            for path, v in leaves(data) if data is not None else []:
                if path.startswith("$.link") and htmltable.is_copy(data):
                    continue                                # 주소 후보는 다른 값 찾기에 쓰지 않는다
                key = path.rsplit(".", 1)[-1].split("[")[0].lower().replace("_", "")
                if key == want and str(v) and str(v) != value and "*" not in str(v):
                    return str(v)
    return None


async def verify(bf: dict, rec: dict, spans: list, session=None, values: Optional[Dict[str, str]] = None) -> dict:
    """어떤 예외도 밖으로 내보내지 않는다. 예상 못한 오류는 failed 로 남긴다."""
    try:
        return await _verify(bf, rec, spans, session, values)
    except Exception as exc:
        run = {"kind": "same-values", "ok": False, "steps": [], "reason": "unexpected_error", "note": type(exc).__name__}
        return {"verification": {"status": "failed", "at": time.time(), "runs": [run], "reason": "unexpected_error"}, "executionMode": None}


async def _verify(bf: dict, rec: dict, spans: list, session=None, values: Optional[Dict[str, str]] = None) -> dict:
    host = urlsplit(bf["source"]["base"]).hostname or ""
    gap = 0 if host in ("localhost", "127.0.0.1", "::1") else 0.6
    raw: Dict[str, Optional[str]] = {}
    browser = None
    relogin = None
    login = rec.get("login") or {}
    auto = login.get("mode") == "auto" and bool(login.get("recipe"))
    # 기록 중 로그인을 한 번도 보지 못했으면(레시피·로그인 경로·login 승인 기록 모두 없음) 공개 화면으로 보고 세션 밖에서 쿠키 없이 다시 검증한다
    anonymous = (not login.get("recipe") and not login.get("path")
                 and not any((a or {}).get("decision") == "login" for a in rec.get("approvals") or [])
                 and not (rec.get("approvalsDropped") or 0) > 0)       # 승인 기록이 잘렸으면 로그인 항목이 빠졌을 수 있다

    def result(status, runs, reason=""):
        v = {"status": status, "at": time.time(), "runs": runs}
        if reason:
            v["reason"] = reason
        return {"verification": v, "executionMode": None}

    async def do_login():
        cred = await asyncio.to_thread(credentials.get, f"rec:{rec['id']}") or {}
        return await asyncio.to_thread(session_auth.login, bf["source"]["base"], dict(cred, recipe=login["recipe"]))

    async def relogin_cb():
        recipe = login["recipe"]
        origin = f"{urlsplit(bf['source']['base']).scheme}://{urlsplit(bf['source']['base']).netloc}"
        for rel in (recipe.get("loginRel", "/login.do"), recipe.get("actionRel", "/loginProc.do")):
            why = scope.blocked(session_auth._url(bf["source"]["base"], rel), origin, config.deny_entries())
            if why:
                relogin_cb.note = "다시 로그인 생략: 차단 주소 " + str(why)
                return None
        try:
            return await do_login()
        except Exception:
            relogin_cb.note = "다시 로그인 실패"
            return None

    outside = session is None or session.closed           # 세션 밖 재검증(익명 실행 포함)
    try:
        if not outside:
            cookies = [{"name": c["name"], "value": c["value"], "domain": c.get("domain", ""), "path": c.get("path", "/")}
                       for c in await session.ctx.cookies()]
            http, browser, raw = HttpTransport(cookies, host=host), BrowserTransport(session.page, session.guard), dict(session.trace.raw)

            async def ask(st):
                label = f"Replay 검증: {st['path']}"
                if not st.get("write"):
                    label = f"조회로 보이는 {str(st.get('method') or '').upper()} — " + label     # 조회로 분류됐지만 GET 이 아니라 묻는다
                ok = await session.guard.ask(st["method"], (st.get("base") or bf["source"]["base"]) + st["path"], label)
                return ("approve" if session.guard.env == "op" else "staging") if ok else False     # 사람 승인인지 결과 문구가 가린다
        else:
            if not auto and not anonymous:
                return result("needs-login", [])

            http = HttpTransport(await do_login() if auto else [], host=host)

            async def ask(st):
                # 기록 화면 밖 재검증: 운영 쓰기는 물을 창이 없으니 보내지 않는다. 사람이 검토 화면에서 조회로 확정한 POST
                # (writeWhy "사람이 지정" + write 가 명시적으로 False)만 업무 도구 실행(flow.runner._read_only)과 같은 기준으로 보낸다.
                # "approve" 가 아닌 값을 돌려줘 결과에 "승인했지만" 이 남지 않게 한다
                if config.is_staging(bf["source"].get("env")):
                    return "staging"
                return "read" if st.get("writeWhy") == "사람이 지정" and st.get("write") is False else False
    except LoginError:
        return result("needs-login", [])
    except Exception as exc:
        return result("failed", [{"kind": "same-values", "ok": False, "steps": [], "reason": "login_failed", "note": type(exc).__name__}], "login_failed")
    if auto:
        relogin = relogin_cb

    pace = [0.0]
    same_inputs = {i["name"]: str((values or {}).get(i["name"], i.get("ex") or "")) for i in bf.get("inputs", [])}
    same = await run_once(bf, same_inputs, raw, http, browser, ask, gap, relogin=relogin, pace=pace)
    mode = "browser" if any(s.get("via") == "browser" for s in same["steps"]) else ("session" if bf.get("auth", {}).get("mode") == "session" else "direct")
    if not same["ok"] and browser is not None and same["reason"] in ("shape_mismatch", "http_error", "waf_blocked", "error_response"):
        if same.get("wrote"):
            same["note"] = "쓰기가 이미 나가 다시 실행하지 않음"       # 같은 쓰기를 한 번 더 보내지 않는다
        else:
            forced = dict(bf, steps=[dict(s, exec="browser") for s in bf["steps"]])
            alt = await run_once(forced, same_inputs, raw, http, browser, ask, gap, pace=pace)
            if alt["ok"]:
                same, mode = dict(alt, note="browser_only"), "browser"
    runs = [same]
    varied = None if any(s.get("write") for s in bf["steps"]) else varied_inputs(bf, spans)
    if varied and values:
        for i in bf.get("inputs", []):
            n = i["name"]
            if n in values and n in varied and (i.get("needsValue") or _is_masked(i.get("ex"))):
                varied[n] = str(values[n])
    if varied and varied == same_inputs:
        varied = None                                        # 같은 값이면 다른 값 검증이 아니다
    if same["ok"] and varied:
        runs.append(await run_once(bf, varied, raw, http, browser, ask, gap, kind="varied-values", relogin=relogin, pace=pace))
    elif same["ok"]:
        runs.append({"kind": "varied-values", "ok": None, "steps": [], "reason": "skipped"})
    if same["reason"] == "needs_value":
        status = "needs-value"
    elif outside and not auto and same["reason"] == "auth_expired":
        status = "needs-login"                                # 쿠키 없이 보냈더니 로그인으로 보냈다: 공개 화면이 아니었다
    elif not same["ok"]:
        status = "failed"
    elif all(r["ok"] is not False for r in runs):
        status = "verified"
    else:
        status = "partial"
    return {"verification": {"status": status, "at": time.time(), "runs": runs}, "executionMode": mode if same["ok"] else None}

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
import re
import time
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple
from urllib.parse import quote, urlsplit

import httpx

from app.ieum.discovery import infer
from app.ieum.gateway import credentials, session_auth
from app.ieum.recorder import config, htmltable, scope
from app.ieum.discovery.masking import HIDDEN
from app.ieum.recorder.analyze import _MASKED, get_path, leaves

TIMEOUT = 15
UA = "Mozilla/5.0 (compatible; IeumRecorder/1.0)"
_ERR_KEY = re.compile(r"^(rslt|result_?code|code|status)$", re.I)
_ERR_TEXT = ("권한이 없습니다", "오류가 발생", "처리 중 오류")


def encode(pairs: Dict[str, str], charset: Optional[str]) -> str:
    enc = (charset or "utf-8").lower()
    try:
        "".encode(enc)
    except LookupError:
        enc = "utf-8"
    return "&".join(f"{quote(str(k), safe='', encoding=enc)}={quote(str(v), safe='', encoding=enc, errors='replace')}" for k, v in pairs.items())


def _keys(d) -> set:
    return {re.sub(r"\[\d+\]", "[]", p) for p, _ in leaves(d, 200)}


def _looks_error(data, text: str) -> bool:
    if isinstance(data, dict):
        for k, v in data.items():
            if _ERR_KEY.match(str(k)) and isinstance(v, str) and (v.upper().startswith("E") or v.upper() in ("FAIL", "ERROR")):
                return True
    return any(t in (text or "") for t in _ERR_TEXT)


def judge(status: int, location: Optional[str], ctype: str, text: str, step: dict, headers_sent: dict) -> Tuple[bool, str, Any]:
    if session_auth.expired(status, location, ctype, text or ""):
        return False, "auth_expired", None
    if status >= 400:
        sent = {k.lower() for k in (headers_sent or {})}
        return False, ("waf_blocked" if status in (400, 403) and "x-requested-with" not in sent else "http_error"), None
    if step.get("kind") == "html":
        data = htmltable.to_data(text or "")
        before = htmltable.shape(step.get("recordedData") or {})
        if _looks_error(None, text):
            return False, "error_response", data
        if before and (data is None or len(before & htmltable.shape(data)) / len(before) < 0.6):
            return False, "shape_mismatch", data
        return True, "", data
    data, before = infer.parse_json(text or ""), infer.parse_json(step.get("recordedRes") or "")
    if _looks_error(data, text):
        return False, "error_response", data
    if before is not None:
        kb = _keys(before)
        if data is None or (kb and len(kb & _keys(data)) / len(kb) < 0.6):
            return False, "shape_mismatch", data
    return True, "", data


class HttpTransport:
    mode = "session"

    def __init__(self, cookies: Dict[str, str]):
        self.cookies = cookies

    async def send(self, step, url, headers, params, form, json_body):
        if params:
            url = url + ("&" if "?" in url else "?") + encode(params, step.get("charset"))
        content = None
        if form:
            content = encode(form, step.get("charset"))
            headers = dict(headers, **{"content-type": f"application/x-www-form-urlencoded; charset={step.get('charset') or 'UTF-8'}"})
        async with httpx.AsyncClient(follow_redirects=False, timeout=TIMEOUT, cookies=self.cookies, verify=False) as c:
            r = await c.request(step["method"], url, headers=headers, content=content, json=json_body)
            return r.status_code, r.headers.get("location"), r.headers.get("content-type", ""), r.text[:200_000]


class BrowserTransport:
    """기록 세션 페이지 안에서 보낸다. 숨은 토큰이 필요하면 직전 화면(formPage)을 다시 받아 새 값을 채운다."""
    mode = "browser"

    def __init__(self, page):
        self.page = page

    async def send(self, step, url, headers, params, form, json_body):
        r = await self.page.evaluate("""async ([m, u, h, q, f, j, formPage, hidden, cs]) => {
            if (q && Object.keys(q).length) u += (u.includes('?') ? '&' : '?') + new URLSearchParams(q).toString();
            if (formPage && hidden.length) {
              const html = await (await fetch(formPage, {credentials: 'include'})).text();
              const doc = new DOMParser().parseFromString(html, 'text/html');
              for (const name of hidden) { const el = doc.querySelector('input[type=hidden][name="' + name + '"]'); if (el) f[name] = el.value; }
            }
            let body = null;
            if (j) { body = JSON.stringify(j); h['content-type'] = 'application/json'; }
            else if (f && Object.keys(f).length) { body = new URLSearchParams(f).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
            const r = await fetch(u, {method: m, headers: h, body, redirect: 'manual', credentials: 'include'});
            return [r.status, r.headers.get('location'), r.headers.get('content-type') || '', await r.text()];
        }""", [step["method"], url, headers, params or {}, dict(form or {}), json_body, step.get("formPage"),
               [p["a"] for p in step["params"] if (p.get("from") or "").startswith("session.hidden.")], step.get("charset")])
        return r[0], r[1], r[2], (r[3] or "")[:200_000]


def _is_masked(v: Optional[str]) -> bool:
    return v is not None and (HIDDEN in v or bool(_MASKED.search(v)))


def _recovered(v: str, p: dict, raw: Dict[str, Optional[str]]) -> Optional[str]:
    """가린 값이면 원값 지도에서 되살린다. 모호한(None) 항목은 되살리지 않는다."""
    for key in (v, p.get("ex") or ""):
        if key and raw.get(key) is not None:
            return raw[key]
    return v


def _value(p: dict, inputs: Dict[str, str], raw: Dict[str, Optional[str]], outs: Dict[str, Dict[str, Any]],
           needs: Dict[str, bool]) -> Optional[str]:
    """값 결정 순서: 사람이 넣은 입력값(이름) -> 원값 지도 -> 앞 단계 출력·세션·상수. 가린 채 남으면 호출자가 막는다."""
    src = p.get("from") or ""
    if src.startswith("input."):
        name = src[6:]
        v = inputs.get(name)
        if v is None:
            v = p.get("ex", "")
        if (v == "" or _is_masked(v)) and needs.get(name):
            v = _recovered(v, p, raw) if v else ""
            if v == "":
                return HIDDEN                       # 값이 필요한데 없다 -> needs_value
        return _recovered(v, p, raw) if _is_masked(v) else v
    if src.startswith("const:"):
        v = src[6:]
    elif src.startswith(("session.", "config.")):
        v = p.get("ex", "")
    elif "." in src:
        sid, name = src.split(".", 1)
        got = outs.get(sid, {}).get(name)
        return None if got is None else str(got)
    else:
        v = p.get("ex", "")
    if v == "" and p.get("needsValue"):
        return HIDDEN
    return _recovered(v, p, raw) if _is_masked(v) else v


async def run_once(bf: dict, inputs: Dict[str, str], raw: Dict[str, Optional[str]], http, browser,
                   ask_write: Callable[[dict], Awaitable[bool]], gap: float, kind: str = "same-values") -> dict:
    outs: Dict[str, Dict[str, Any]] = {}
    results = []
    needs = {i["name"]: bool(i.get("needsValue")) for i in bf.get("inputs", [])}

    def fail(st, reason, status=None):
        results.append({"id": st["id"], "status": status, "ok": False, "reason": reason})
        return {"kind": kind, "ok": False, "steps": results, "reason": reason}

    for i, st in enumerate(bf["steps"]):
        if i and gap:
            await asyncio.sleep(gap)
        base = (st.get("base") or bf["source"]["base"]).rstrip("/")
        url = base + st["path"]
        if scope.blocked(url, f"{urlsplit(bf['source']['base']).scheme}://{urlsplit(bf['source']['base']).netloc}", config.deny_entries()):
            return fail(st, "http_error")
        if st.get("write") and not await ask_write(st):
            return fail(st, "write_denied")
        transport = browser if st.get("exec") == "browser" else http
        if transport is None:
            return fail(st, "browser_needed")
        headers = {"User-Agent": UA, "Referer": base + "/", **(st.get("headers") or {})}
        params, form, body = {}, {}, None
        for p in st["params"]:
            v = _value(p, inputs, raw, outs, needs)
            if v is None:
                return fail(st, "chain_broken")
            if _is_masked(v):
                return fail(st, "needs_value")
            if p["loc"] == "query":
                params[p["a"]] = v
            elif p["loc"] == "form":
                form[p["a"]] = v
            elif p["loc"] == "body":
                body = dict(body or {}, **{p["a"]: v})
            elif p["loc"] == "header":
                headers[p["a"]] = v
        url_noq = url.split("?")[0]
        try:
            status, loc, ctype, text = await transport.send(st, url_noq, headers, params, form, body)
        except Exception as exc:
            results.append({"id": st["id"], "status": None, "ok": False, "reason": "http_error", "note": type(exc).__name__})
            return {"kind": kind, "ok": False, "steps": results, "reason": "http_error"}
        ok, why, data = await asyncio.to_thread(judge, status, loc, ctype, text, st, headers)
        if ok:
            outs[st["id"]] = {}
            for name, path in (st.get("outputs") or {}).items():
                v = get_path(data, path) if data is not None else None
                if v is None:
                    ok, why = False, "chain_broken"
                    break
                outs[st["id"]][name] = v
        results.append({"id": st["id"], "status": status, "ok": ok, "reason": why, "via": transport.mode})
        if not ok:
            return {"kind": kind, "ok": False, "steps": results, "reason": why}
    return {"kind": kind, "ok": True, "steps": results, "reason": ""}


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
                key = path.rsplit(".", 1)[-1].split("[")[0].lower().replace("_", "")
                if key == want and str(v) and str(v) != value and "*" not in str(v):
                    return str(v)
    return None


async def verify(bf: dict, rec: dict, spans: list, session=None, values: Optional[Dict[str, str]] = None) -> dict:
    host = urlsplit(bf["source"]["base"]).hostname or ""
    gap = 0 if host in ("localhost", "127.0.0.1", "::1") else 0.6
    raw: Dict[str, str] = {}
    browser = None
    if session is not None and not session.closed:
        cookies = {c["name"]: c["value"] for c in await session.ctx.cookies()}
        http, browser, raw = HttpTransport(cookies), BrowserTransport(session.page), dict(session.trace.raw)

        async def ask(st):
            return await session.guard.ask(st["method"], (st.get("base") or bf["source"]["base"]) + st["path"], f"Replay 검증: {st['path']}")
    else:
        if (rec.get("login") or {}).get("mode") != "auto" or not (rec.get("login") or {}).get("recipe"):
            return {"verification": {"status": "needs-login", "at": time.time(), "runs": []}, "executionMode": None}
        cred = await asyncio.to_thread(credentials.get, f"rec:{rec['id']}") or {}
        cookies = await asyncio.to_thread(session_auth.login, bf["source"]["base"], dict(cred, recipe=rec["login"]["recipe"]))
        http = HttpTransport(cookies)

        async def ask(st):
            return bf["source"].get("env") != "op"        # 기록 화면 밖 재검증: 운영 쓰기는 물을 창이 없으니 보내지 않는다

    same_inputs = {i["name"]: str((values or {}).get(i["name"], i.get("ex") or "")) for i in bf.get("inputs", [])}
    same = await run_once(bf, same_inputs, raw, http, browser, ask, gap)
    mode = "browser" if any(s.get("via") == "browser" for s in same["steps"]) else ("session" if bf.get("auth", {}).get("mode") == "session" else "direct")
    if not same["ok"] and browser is not None and same["reason"] in ("shape_mismatch", "http_error", "waf_blocked", "error_response"):
        forced = dict(bf, steps=[dict(s, exec="browser") for s in bf["steps"]])
        alt = await run_once(forced, same_inputs, raw, http, browser, ask, gap)
        if alt["ok"]:
            same, mode = dict(alt, note="browser_only"), "browser"
    runs = [same]
    varied = None if any(s.get("write") for s in bf["steps"]) else varied_inputs(bf, spans)
    if same["ok"] and varied:
        runs.append(await run_once(bf, dict(varied, **{k: str(v) for k, v in (values or {}).items() if k in varied}), raw, http, browser, ask, gap, kind="varied-values"))
    elif same["ok"]:
        runs.append({"kind": "varied-values", "ok": None, "steps": [], "reason": "skipped"})
    if same["reason"] == "needs_value":
        status = "needs-value"
    elif not same["ok"]:
        status = "failed"
    elif all(r["ok"] is not False for r in runs):
        status = "verified"
    else:
        status = "partial"
    return {"verification": {"status": status, "at": time.time(), "runs": runs}, "executionMode": mode if same["ok"] else None}

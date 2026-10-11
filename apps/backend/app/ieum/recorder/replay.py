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
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple
from urllib.parse import quote, unquote, urlsplit

import httpx

from app.ieum.discovery import infer
from app.ieum.gateway import credentials, session_auth
from app.ieum.gateway.session_auth import LoginError
from app.ieum.recorder import config, htmltable, scope
from app.ieum.discovery.masking import HIDDEN, is_masked
from app.ieum.recorder.analyze import get_path, leaves

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


_HTML_HINT = re.compile(r"<\s*(html|body|head|div|p|table|script)\b", re.I)
_HIDDEN_BLOCK = re.compile(r"<(script|style|noscript|template)\b.*?</\1\s*>|<!--.*?-->", re.I | re.S)


def _visible_text(text: str) -> str:
    """HTML 이면 스크립트·스타일·주석을 빼고 화면에 보이는 글자만 남긴다. HTML 이 아니면 그대로 둔다."""
    text = text or ""
    if not _HTML_HINT.search(text):
        return text
    return re.sub(r"<[^>]+>", " ", _HIDDEN_BLOCK.sub(" ", text))


def _looks_error(data, text: str, recorded: str = "") -> bool:
    if isinstance(data, dict):
        for k, v in data.items():
            if _ERR_KEY.match(str(k)) and isinstance(v, str) and (v.upper().startswith("E") or v.upper() in ("FAIL", "ERROR")):
                return True
    # 오류 문구는 화면에 보이는 글자에서만 찾는다(정상 화면의 스크립트에 alert('오류가 발생했습니다') 가 흔하다).
    # 기록 때 정상 응답에도 보이던 문구(바닥글 안내 등)는 오류 표시로 보지 않는다.
    seen, before = _visible_text(text), _visible_text(recorded)
    return any(t in seen and t not in before for t in _ERR_TEXT)


def judge(status: int, location: Optional[str], ctype: str, text: str, step: dict, headers_sent: dict) -> Tuple[bool, str, Any]:
    if status == 0:                                   # fetch redirect:'manual' 의 opaqueredirect: 로그인으로 보낸 것으로 본다
        return False, "auth_expired", None
    if session_auth.expired(status, location, ctype, text or ""):
        return False, "auth_expired", None
    if status >= 400:
        sent = {k.lower() for k in (headers_sent or {})}
        return False, ("waf_blocked" if status in (400, 403) and "x-requested-with" not in sent else "http_error"), None
    if step.get("kind") == "html":
        data = htmltable.to_data(text or "")
        before = htmltable.shape(step.get("recordedData") or {})
        if _looks_error(None, text, step.get("recordedRes") or ""):
            return False, "error_response", data
        if before and (data is None or len(before & htmltable.shape(data)) / len(before) < 0.6):
            return False, "shape_mismatch", data
        return True, "", data
    data, before = infer.parse_json(text or ""), infer.parse_json(step.get("recordedRes") or "")
    if _looks_error(data, text, step.get("recordedRes") or ""):
        return False, "error_response", data
    if before is not None:
        kb = _keys(before)
        if data is None or (kb and len(kb & _keys(data)) / len(kb) < 0.6):
            return False, "shape_mismatch", data
    return True, "", data


class HttpTransport:
    mode = "session"

    def __init__(self, cookies, host: Optional[str] = None, transport=None):
        """cookies: {이름: 값} 또는 [{name, value, domain, path}]. 도메인이 있는 쿠키는 그 주소로만 보낸다.
        {이름: 값} 은 host 가 주어지면 그 host 에만 묶는다."""
        items = []
        if isinstance(cookies, dict):
            items = [{"name": k, "value": v, "domain": host or "", "path": "/"} for k, v in cookies.items()]
        else:
            items = [dict(c) for c in (cookies or [])]
        for c in items:                                # 도메인 없는 쿠키는 기록 원본 호스트에 묶는다(호스트를 모르면 보내지 않는다)
            if not c.get("domain"):
                c["domain"] = host or ""
        self.items = items
        self.host = host
        self._transport = transport

    @property
    def cookies(self):
        return {c["name"]: c["value"] for c in self.items}

    @cookies.setter
    def cookies(self, value):
        self.__init__(value, self.host, self._transport)

    def _cookie_header(self, url: str) -> str:
        parts = urlsplit(url)
        host, path = (parts.hostname or "").lower(), parts.path or "/"
        out = []
        for c in self.items:
            dom = (c.get("domain") or "").lower()
            d = dom.lstrip(".")
            if not d:
                continue                               # 어디에 묶이는지 모르는 쿠키는 보내지 않는다
            if dom.startswith("."):
                if host != d and not host.endswith("." + d):
                    continue
            elif host != d:                            # 점 없는 도메인은 그 호스트 한 곳에만
                continue
            cp = c.get("path") or "/"
            if cp != "/" and path != cp and not path.startswith(cp.rstrip("/") + "/"):
                continue
            if c.get("secure") and parts.scheme != "https":
                continue
            out.append(f"{c['name']}={c['value']}")
        return "; ".join(out)

    async def send(self, step, url, headers, params, form, json_body):
        if params:
            url = url + ("&" if "?" in url else "?") + encode(params, step.get("charset"))
        content = None
        headers = dict(headers)
        if form:
            content = encode(form, step.get("charset"))
            headers["content-type"] = f"application/x-www-form-urlencoded; charset={step.get('charset') or 'UTF-8'}"
        ck = self._cookie_header(url)
        if ck:
            headers["Cookie"] = ck
        async with httpx.AsyncClient(follow_redirects=False, timeout=TIMEOUT, verify=False, transport=self._transport) as c:
            r = await c.request(step["method"], url, headers=headers, content=content, json=json_body)
            return r.status_code, r.headers.get("location"), r.headers.get("content-type", ""), r.text[:200_000]


class NeedsValue(Exception):
    """보내기 직전에 가린 값이 남은 것이 드러났다."""


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
        return r[0], r[1], r[2], (r[3] or "")[:200_000]


_is_masked = is_masked
_PLACEHOLDER = re.compile(r"\{[^{}/]+\}")


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
                   ask_write: Callable[[dict], Awaitable[Any]], gap: float, kind: str = "same-values",
                   relogin: Optional[Callable[[], Awaitable[Optional[Any]]]] = None, pace: Optional[list] = None) -> dict:
    """pace: [마지막 전송 시각] — 실행 사이에도 요청 간격을 지키려고 호출자가 같은 리스트를 넘긴다.
    relogin: 세션 만료 시 금고 계정으로 다시 로그인해 새 쿠키를 돌려준다(실행당 한 번)."""
    outs: Dict[str, Dict[str, Any]] = {}
    results: list = []
    pace = pace if pace is not None else [0.0]
    needs = {i["name"]: bool(i.get("needsValue")) for i in bf.get("inputs", [])}
    state = {"wrote": False, "relogged": False}
    origin = f"{urlsplit(bf['source']['base']).scheme}://{urlsplit(bf['source']['base']).netloc}"

    async def pause():
        wait = gap - (time.monotonic() - pace[0])
        if gap and pace[0] and wait > 0:
            await asyncio.sleep(wait)

    def done(ok, reason):
        return {"kind": kind, "ok": ok, "steps": results, "reason": reason, "wrote": state["wrote"]}

    def fail(st, reason, status=None, note=None):
        r = {"id": st["id"], "status": status, "ok": False, "reason": reason}
        if note:
            r["note"] = note
        results.append(r)
        return done(False, reason)

    for st in bf["steps"]:
        base = (st.get("base") or bf["source"]["base"]).rstrip("/")
        url = base + st["path"]
        why_blocked = scope.blocked(url, origin, config.deny_entries())
        if why_blocked:
            return fail(st, "http_error", note="차단: " + str(why_blocked))
        transport = browser if st.get("exec") == "browser" else http
        if transport is None:
            return fail(st, "browser_needed")
        headers = {"User-Agent": UA, "Referer": base + "/", **(st.get("headers") or {})}
        params, form, body = {}, {}, None
        refreshed = transport.mode == "browser" and bool(st.get("formPage"))
        for p in st["params"]:
            hidden = (p.get("from") or "").startswith("session.hidden.")
            if hidden and not st.get("formPage"):
                return fail(st, "needs_value", note="숨은 토큰을 새로 받을 화면 주소가 없음")
            if hidden and p["loc"] != "form":
                # 새 토큰은 폼에만 채운다. 쿼리·본문·헤더의 토큰은 새로 받을 수 없어 기록 값(가렸거나 지난 값)이 나간다
                return fail(st, "needs_value", note="폼이 아닌 곳의 숨은 토큰은 새로 받지 못함")
            v = _value(p, inputs, raw, outs, needs)
            if v is None:
                return fail(st, "chain_broken")
            if _is_masked(v) and not (hidden and refreshed):
                return fail(st, "needs_value")
            if hidden and v == "" and not refreshed:
                return fail(st, "needs_value", note="숨은 토큰 값이 비어 있음")
            if p["loc"] == "query":
                params[p["a"]] = v
            elif p["loc"] == "form":
                form[p["a"]] = v
            elif p["loc"] == "body":
                body = dict(body or {}, **{p["a"]: v})
            elif p["loc"] == "header":
                headers[p["a"]] = v
            elif p["loc"] == "path":                         # 설계 4판: 경로 {자리}. 앞 단계 주소 후보 등에서 꺼낸 값을 한 조각으로 넣는다
                url = url.replace("{" + p["a"] + "}", quote(unquote(str(v)), safe=""))
        if any(p.get("loc") == "path" for p in st["params"]):
            why_blocked = scope.blocked(url, origin, config.deny_entries())     # 채운 경로로 다시 본다(차단 목록이 경로 단위일 수 있다)
            if why_blocked:
                return fail(st, "http_error", note="차단: " + str(why_blocked))
        # 보내기 직전 마지막 점검: 경로·헤더·화면 주소에 가린 값이 남았는가, 채우지 못한 {자리}가 있는가
        if any(_is_masked(unquote(x)) for x in [url, st.get("formPage") or ""] + [str(h) for h in headers.values()]):
            return fail(st, "needs_value", note="경로·헤더에 가린 값이 남음")
        if any(_is_masked(str(v)) for v in params.values()) or (body is not None and any(_is_masked(v) for _, v in leaves(body))):
            return fail(st, "needs_value", note="쿼리·본문에 가린 값이 남음")
        if _PLACEHOLDER.search(url):
            return fail(st, "unresolved_path", note="경로의 {자리}를 채우지 못함")
        # 설계 3판 7절: GET/HEAD 가 아니면 조회로 분류됐어도 보내기 직전에 묻는다(운영은 사람 승인, 스테이징은 묻지 않고 "staging",
        # 세션 밖 운영은 물을 창이 없어 거절). 보내지 않을 요청에는 묻지 않도록 점검 뒤에 묻는다
        needs_ask = bool(st.get("write")) or str(st.get("method") or "").upper() not in ("GET", "HEAD")
        said = await ask_write(st) if needs_ask else None
        if needs_ask and not said:
            return fail(st, "write_denied")
        url_noq = url.split("?")[0]
        # 쓰기를 보내기 전에 멈추면 결과에 남긴다. 사람이 승인한 것("approve")만 "승인했지만" 이라 적는다(스테이징·세션 밖은 승인이 없었다)
        approved = ("승인했지만 보내지 않음: " if said == "approve" else "보내지 않음: ") if needs_ask else ""
        note = None
        while True:
            await pause()
            if needs_ask:
                state["wrote"] = True                         # 승인받아 나간 비GET(조회 분류 포함)은 실패해도 브라우저로 다시 보내지 않는다
            try:
                pace[0] = time.monotonic()
                status, loc, ctype, text = await transport.send(st, url_noq, headers, params, form, body)
            except NeedsValue:
                return fail(st, "needs_value", note=approved + "숨은 토큰을 화면에서 찾지 못해 가린 값이 남음")
            except Exception as exc:
                return fail(st, "http_error", note=(approved.replace("보내지 않음", "보내지 못함") if approved else "") + type(exc).__name__)
            ok, why, data = await asyncio.to_thread(judge, status, loc, ctype, text, st, headers)
            if why == "auth_expired" and relogin and not state["relogged"] and transport is http and not needs_ask:
                state["relogged"] = True                      # 실행당 한 번만 다시 로그인하고 이 단계부터 이어 간다
                await pause()
                cookies = await relogin()
                pace[0] = time.monotonic()
                if cookies:
                    http.cookies = cookies
                    continue
                note = getattr(relogin, "note", None) or "다시 로그인하지 못함"
            elif why == "auth_expired":
                if st.get("write"):
                    note = "쓰기 단계라 다시 로그인해 재전송하지 않음"
                elif needs_ask:
                    note = "GET 이 아닌 단계라 다시 로그인해 재전송하지 않음"     # 승인 한 번에 한 번만 보낸다
                elif transport is not http:
                    note = "브라우저 단계라 다시 로그인하지 않음"
                elif state["relogged"]:
                    note = "다시 로그인했는데도 세션이 만료됨"
            break
        if ok:
            outs[st["id"]] = {}
            for name, path in (st.get("outputs") or {}).items():
                v = get_path(data, path) if data is not None else None
                if v is None:
                    ok, why = False, "chain_broken"
                    break
                outs[st["id"]][name] = v
        entry = {"id": st["id"], "status": status, "ok": ok, "reason": why, "via": transport.mode}
        if note and not ok:
            entry["note"] = note
        results.append(entry)
        if not ok:
            return done(False, why)
    return done(True, "")


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
                if path.startswith("$.links"):
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

    try:
        if session is not None and not session.closed:
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
            if not auto:
                return result("needs-login", [])

            http = HttpTransport(await do_login(), host=host)

            async def ask(st):
                return "staging" if config.is_staging(bf["source"].get("env")) else False    # 기록 화면 밖 재검증: 운영 쓰기는 물을 창이 없으니 보내지 않는다
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
    elif not same["ok"]:
        status = "failed"
    elif all(r["ok"] is not False for r in runs):
        status = "verified"
    else:
        status = "partial"
    return {"verification": {"status": status, "at": time.time(), "runs": runs}, "executionMode": mode if same["ok"] else None}

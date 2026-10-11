"""단계 실행 핵심: 업무 기능의 단계를 차례로 보내고 응답을 판정한다.

레코더 재실행 검증(recorder.replay)과 업무 도구(flow.runner)가 함께 쓴다. 기록 세션·Playwright 를 불러오지 않는다
(브라우저로 보내는 단계는 호출자가 넘긴 transport 가 맡는다).
"""
import asyncio
import re
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple
from urllib.parse import quote, unquote, urlsplit

import httpx

from app.ieum.discovery import infer
from app.ieum.gateway import session_auth
from app.ieum.recorder import config, htmltable, scope
from app.ieum.discovery.masking import HIDDEN, is_masked
from app.ieum.recorder.analyze import get_path, leaves

TIMEOUT = 15
UA = "Mozilla/5.0 (compatible; IeumRecorder/1.0)"
_ERR_KEY = re.compile(r"^(rslt|result_?code|code|status)$", re.I)
_ERR_TEXT = htmltable.ERR_TEXT


def encode(pairs: Dict[str, str], charset: Optional[str]) -> str:
    enc = (charset or "utf-8").lower()
    try:
        "".encode(enc)
    except LookupError:
        enc = "utf-8"
    return "&".join(f"{quote(str(k), safe='', encoding=enc)}={quote(str(v), safe='', encoding=enc, errors='replace')}" for k, v in pairs.items())


def _keys(d) -> set:
    return {re.sub(r"\[\d+\]", "[]", p) for p, _ in leaves(d, 200)}


_TITLE = re.compile(r"<title\b[^>]*>(.*?)</title\s*>", re.I | re.S)
ERR_PAGE_TEXT = 5000            # 화면 글자가 이보다 짧아야 오류 화면으로 본다(긴 정상 화면의 오류 코드표·안내를 오류로 보지 않게)


def _looks_error(data, text: str, recorded: str = "", seen_before=None) -> bool:
    if isinstance(data, dict):
        for k, v in data.items():
            if _ERR_KEY.match(str(k)) and isinstance(v, str) and (v.upper().startswith("E") or v.upper() in ("FAIL", "ERROR")):
                return True
    # 오류 문구는 화면에 보이는 글자에서만 찾는다(정상 화면의 스크립트에 alert('오류가 발생했습니다') 가 흔하다).
    # 기록 때 정상 응답에도 보이던 문구는 오류 표시로 보지 않는다: 기록 때 전체 화면에서 찾은 목록(seen_before)이 있으면 그것,
    # 없으면(예전 기록) 저장된 앞부분 본문(recorded)과 비교한다.
    text = text or ""
    seen = htmltable.visible_text(text)
    ignore = set(seen_before or ()) | {t for t in _ERR_TEXT if t in htmltable.visible_text(recorded)}
    hits = [t for t in _ERR_TEXT if t in seen and t not in ignore]
    if not hits:
        return False
    if not htmltable.HTML_HINT.search(text):
        return True
    # HTML 은 오류 화면처럼 보일 때만: 보이는 글자가 짧거나 제목에 문구가 있다
    m = _TITLE.search(text)
    title = m.group(1) if m else ""
    return len(" ".join(seen.split())) < ERR_PAGE_TEXT or any(t in title for t in hits)


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
        # 업무 도구 단계 사본은 recordedData 대신 판정에 쓰는 모양(recordedShape)만 든다
        before = set(step["recordedShape"]) if "recordedShape" in step else htmltable.shape(step.get("recordedData") or {})
        if _looks_error(None, text, step.get("recordedRes") or "", step.get("recordedErrSeen")):
            return False, "error_response", data
        if before and (data is None or len(before & htmltable.shape(data)) / len(before) < 0.6):
            return False, "shape_mismatch", data
        return True, "", data
    data, before = infer.parse_json(text or ""), infer.parse_json(step.get("recordedRes") or "")
    if _looks_error(data, text, step.get("recordedRes") or "", step.get("recordedErrSeen")):
        return False, "error_response", data
    # 업무 도구 단계 사본은 recordedRes 없이 recordedShape 만 들므로 그것만 있어도 모양을 본다
    if "recordedShape" in step or before is not None:
        kb = set(step["recordedShape"]) if "recordedShape" in step else _keys(before)
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
            return r.status_code, r.headers.get("location"), r.headers.get("content-type", ""), r.text[:htmltable.MAX_SCAN]


class NeedsValue(Exception):
    """보내기 직전에 가린 값이 남은 것이 드러났다."""


_is_masked = is_masked
_PLACEHOLDER = re.compile(r"\{[^{}/]+\}")


def normalize_path(url: str) -> str:
    """주소 경로의 . 과 .. 조각을 푼다(%2e 포함). 차단 목록 검사와 전송이 같은 최종 경로를 보게 한다."""
    parts = urlsplit(url)
    out: list = []
    segs = parts.path.split("/")
    for seg in segs[1:]:
        low = unquote(seg)
        if low == ".":
            continue
        if low == "..":
            if out:
                out.pop()
            continue
        out.append(seg)
    trail = "/" if segs[-1:] and unquote(segs[-1]) in (".", "..") else ""
    return parts._replace(path="/" + "/".join(out) + trail).geturl()


_normalize_path = normalize_path


def _recovered(v: str, p: dict, raw: Dict[str, Optional[str]]) -> Optional[str]:
    """가린 값이면 원값 지도에서 되살린다. 모호한(None) 항목은 되살리지 않는다."""
    for key in (v, p.get("ex") or ""):
        if key and raw.get(key) is not None:
            return raw[key]
    return v


def value_of(p: dict, inputs: Dict[str, str], raw: Dict[str, Optional[str]], outs: Dict[str, Dict[str, Any]],
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


_value = value_of


async def run_steps(steps: List[dict], base: str, inputs: Dict[str, str], raw: Dict[str, Optional[str]], http, browser,
                    ask_write: Optional[Callable[[dict], Awaitable[Any]]], gap: float, *, needs: Dict[str, bool],
                    kind: str = "same-values", relogin: Optional[Callable[[], Awaitable[Optional[Any]]]] = None,
                    pace: Optional[list] = None, stop_after: Optional[str] = None) -> dict:
    """단계를 차례로 보낸다. base: 단계에 base 가 없을 때 쓰는 주소(업무 기능의 source.base).
    needs: 입력 이름별 "값 다시 입력 필요" 여부.
    pace: [마지막 전송 시각] — 실행 사이에도 요청 간격을 지키려고 호출자가 같은 리스트를 넘긴다.
    relogin: 세션 만료 시 금고 계정으로 다시 로그인해 새 쿠키를 돌려준다(실행당 한 번).
    stop_after: 이 단계를 마치면 거기서 성공으로 끝낸다(업무 도구의 목록 보기). 결과의 data 는 단계별 판정 data(메모리에만)."""
    outs: Dict[str, Dict[str, Any]] = {}
    results: list = []
    datas: Dict[str, Any] = {}
    pace = pace if pace is not None else [0.0]
    state = {"wrote": False, "relogged": False}
    default_base = base
    origin = f"{urlsplit(default_base).scheme}://{urlsplit(default_base).netloc}"

    async def pause():
        wait = gap - (time.monotonic() - pace[0])
        if gap and pace[0] and wait > 0:
            await asyncio.sleep(wait)

    def done(ok, reason):
        return {"kind": kind, "ok": ok, "steps": results, "reason": reason, "wrote": state["wrote"], "data": datas}

    def fail(st, reason, status=None, note=None):
        r = {"id": st["id"], "status": status, "ok": False, "reason": reason}
        if note:
            r["note"] = note
        results.append(r)
        return done(False, reason)

    for st in steps:
        base = (st.get("base") or default_base).rstrip("/")
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
                raw_v = unquote(str(v))
                if raw_v in (".", "..") or "/" in raw_v or "\\" in raw_v:
                    return fail(st, "chain_broken", note="경로 자리 값이 경로 조각이 아님")     # 다른 경로로 새지 않게 보내지 않는다
                url = url.replace("{" + p["a"] + "}", quote(raw_v, safe=""))
        if any(p.get("loc") == "path" for p in st["params"]):
            url = _normalize_path(url)
            why_blocked = scope.blocked(url, origin, config.deny_entries())     # 정규화한 최종 경로로 다시 본다(차단 목록이 경로 단위일 수 있다)
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
        datas[st["id"]] = data
        if stop_after and st["id"] == stop_after:
            return done(True, "")
    return done(True, "")

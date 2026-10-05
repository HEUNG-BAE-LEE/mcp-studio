"""AI 호출 인자를 원본 요청으로 바꾸고, 원본 응답을 AI가 읽기 쉬운 결과로 바꾸는 변환 엔진."""
import base64
import datetime as dt
import json
import re
import time
import xml.etree.ElementTree as ET
from urllib.parse import quote
from xml.sax.saxutils import escape

import httpx

from app.ieum.gateway import credentials, session_auth

TIMEOUT = 10
MAX_BODY = 1024 * 1024
HIDDEN = {"inject", "page", "calc", "ctx"}
SECRET_HEADERS = {"authorization", "x-api-key", "cookie", "proxy-authorization"}
_TOKEN_CACHE = {}


class ToolError(Exception):
    """AI에게 그대로 돌려줄 수 있는 호출 오류."""

    def __init__(self, message, trace=None, status="err"):
        super().__init__(message)
        self.trace, self.status = trace or {}, status


# ------------------------------------------------------------------ 값 변환
def _to_origin(p, v):
    rule = p.get("rule")
    if v is None:
        return None
    if rule == "date":
        s = str(v)
        fmt = p.get("ot", "")
        if fmt == "YYYYMMDD":
            return s[:10].replace("-", "")
        if fmt == "YYYYMM":
            return s[:7].replace("-", "")
        if fmt == "YYYY":
            return s[:4]
        if fmt == "MM":
            return s[5:7]
        if fmt == "epoch":
            return int(dt.datetime.fromisoformat(s).timestamp() * 1000)
        return s
    if rule == "time":
        return str(v).replace(":", "")
    if rule == "pad":
        return str(v).zfill(2)
    if rule == "num":
        return str(v)
    if rule == "code" and p.get("codes"):
        for c in p["codes"]:
            if str(c[1]).lower() == str(v).lower():
                return c[0]
        raise ToolError("%s 값 \"%s\" 은(는) 사용할 수 없습니다. 가능한 값: %s" % (p.get("a"), v, ", ".join(str(c[1]) for c in p["codes"])))
    return v


def _from_origin(r, v):
    rule = r.get("rule")
    if v is None:
        return None
    if rule == "date":
        s = str(v)
        if re.fullmatch(r"\d{8}", s):
            return "%s-%s-%s" % (s[:4], s[4:6], s[6:])
        if re.fullmatch(r"\d{6}", s):
            return "%s-%s" % (s[:4], s[4:])
        if re.fullmatch(r"\d{13}", s):
            return dt.datetime.fromtimestamp(int(s) / 1000, dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="seconds")
        return v
    if rule == "time":
        s = str(v)
        return "%s:%s" % (s[:2], s[2:4]) if re.fullmatch(r"\d{4}", s) else v
    if rule == "num":
        try:
            f = float(str(v).replace(",", ""))
            return int(f) if f.is_integer() else f
        except (TypeError, ValueError):
            return v
    if rule == "code" and r.get("codes"):
        for c in r["codes"]:
            if str(c[0]) == str(v):
                return c[1]
        return v
    if rule == "strip":
        return re.sub(r"<[^>]+>", "", str(v)).strip()
    if rule == "mask":
        return _mask(str(v))
    return v


def _mask(s):
    if "@" in s:
        name, host = s.split("@", 1)
        return (name[:1] + "*" * max(len(name) - 1, 1)) + "@" + host
    digits = re.sub(r"\D", "", s)
    if len(digits) >= 9:
        return re.sub(r"\d(?=(?:\D*\d){4})", "*", s)
    return s[:1] + "*" * max(len(s) - 1, 1)


# ------------------------------------------------------------------ 경로 접근
def _get_path(obj, path):
    """a.b[].c 경로 값을 꺼낸다. 배열이 있으면 리스트로 돌려준다."""
    cur, is_list = [obj], False
    for seg in path.split("."):
        arr = seg.endswith("[]")
        key = seg[:-2] if arr else seg
        nxt = []
        for c in cur:
            v = c.get(key) if isinstance(c, dict) and key else c
            if arr:
                if isinstance(v, dict):
                    v = [v]  # XML 변환 시 항목이 하나면 객체로 온다
                if isinstance(v, list):
                    nxt.extend(v)
                is_list = True
            elif v is not None:
                nxt.append(v)
        cur = nxt
    return cur if is_list else (cur[0] if cur else None)


def _set_path(out, path, value):
    parts = path.split(".")
    if "[]" in path:
        value = value if isinstance(value, list) else [value]
        node = out
        for i, seg in enumerate(parts):
            arr = seg.endswith("[]")
            key = seg[:-2] if arr else seg
            if arr and i == len(parts) - 1:
                node[key] = value
                return
            if arr:
                lst = node.setdefault(key, [])
                while len(lst) < len(value):
                    lst.append({})
                rest = ".".join(parts[i + 1:])
                for item, v in zip(lst, value):
                    _set_path(item, rest, v)
                return
            node = node.setdefault(key, {})
        return
    node = out
    for seg in parts[:-1]:
        node = node.setdefault(seg, {})
    node[parts[-1]] = value


# ------------------------------------------------------------------ 요청 만들기
def visible_params(tool):
    seen, out = set(), []
    for p in tool.get("params", []):
        if p.get("a") and p.get("rule") not in HIDDEN and p["a"] not in seen:
            seen.add(p["a"])
            out.append(p)
    return out


def check_args(tool, args):
    if not isinstance(args, dict):
        raise ToolError("arguments 는 객체여야 합니다.")
    missing = [p["a"] for p in visible_params(tool) if p.get("req") and args.get(p["a"]) in (None, "")]
    if missing:
        raise ToolError("필수 값이 없습니다: %s" % ", ".join(missing))


def auth_headers(source, cred):
    t = cred.get("type", "none")
    headers, query = {}, {}
    if t == "key":
        (headers if cred.get("in", "header") == "header" else query)[cred.get("name") or "X-API-KEY"] = cred.get("key", "")
    elif t == "bearer":
        headers["Authorization"] = "Bearer " + cred.get("key", "")
    elif t == "basic":
        headers["Authorization"] = "Basic " + base64.b64encode(("%s:%s" % (cred.get("username", ""), cred.get("password", ""))).encode()).decode()
    elif t == "oauth":
        headers["Authorization"] = "Bearer " + _oauth_token(source["id"], cred)
    elif t == "session":
        try:
            headers["Cookie"] = session_auth.cookie_header(source["id"], source["base"], cred)
        except session_auth.LoginError as exc:
            raise ToolError(str(exc))
    return headers, query


def _oauth_token(source_id, cred):
    c = _TOKEN_CACHE.get(source_id)
    if c and c[1] > time.time() + 30:
        return c[0]
    try:
        r = httpx.post(cred["tokenUrl"], data={"grant_type": "client_credentials", "client_id": cred.get("clientId"),
                                               "client_secret": cred.get("clientSecret")}, timeout=TIMEOUT)
        r.raise_for_status()
        j = r.json()
        _TOKEN_CACHE[source_id] = (j["access_token"], time.time() + int(j.get("expires_in", 300)))
        return j["access_token"]
    except Exception as e:
        raise ToolError("원본 시스템 인증 토큰을 받지 못했습니다. 연결 설정의 인증 정보를 확인해 주세요. (%s)" % e)


def build_request(source, tool, args, ctx):
    """AI 인자 -> 원본 요청. {method, url, headers, params, json, data, content}"""
    cred = credentials.get(source["id"])
    base = source["base"].rstrip("/")
    headers, query = auth_headers(source, cred)

    if source["proto"] == "soap":
        return _build_soap(source, tool, args, ctx, cred, headers)

    path = tool.get("path") or "/" + tool.get("op", "")
    body, form = {}, {}
    for p in tool["params"]:
        rule = p.get("rule")
        if rule == "inject":
            v = p.get("v", p.get("ex"))
        elif rule == "ctx":
            v = ctx.get(p.get("ctxKey", "user_id"))
        elif rule in ("page", "calc"):
            continue
        else:
            v = args.get(p["a"]) if p.get("a") else None
            if v is None:
                continue
            v = _to_origin(p, v)
        loc = p.get("loc", "query" if tool.get("method", "GET") == "GET" else "body")
        if v is None:
            continue
        if loc == "path":
            path = path.replace("{%s}" % p["o"], quote(str(v), safe=""))
        elif loc == "query":
            query[p["o"]] = v
        elif loc == "header":
            headers[p["o"]] = str(v)
        elif loc == "form":
            form[p["o"]] = v
        else:
            _set_path(body, p["o"], v)
    req = {"method": tool.get("method", "GET"), "url": base + path, "headers": headers, "params": query}
    if body:
        req["json"] = body
    if form:
        req["data"] = form
    return req


def _build_soap(source, tool, args, ctx, cred, headers):
    ns = source.get("ns", "")
    rows = []
    for p in tool["params"]:
        if p.get("rule") == "inject":
            v = p.get("v", p.get("ex"))
        elif p.get("rule") == "ctx":
            v = ctx.get(p.get("ctxKey", "user_id"))
        else:
            v = _to_origin(p, args.get(p["a"])) if p.get("a") and args.get(p["a"]) is not None else None
        if v is not None:
            rows.append("      <ws:%s>%s</ws:%s>" % (p["o"], escape(str(v)), p["o"]))
    sec = ""
    if cred.get("type") == "wss":
        sec = ('<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">'
               "<wsse:UsernameToken><wsse:Username>%s</wsse:Username><wsse:Password>%s</wsse:Password></wsse:UsernameToken></wsse:Security>"
               % (escape(cred.get("username", "")), escape(cred.get("password", ""))))
    el = tool.get("inEl") or tool["op"]
    envelope = ('<?xml version="1.0" encoding="UTF-8"?>\n<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="%s">\n'
                "  <soapenv:Header>%s</soapenv:Header>\n  <soapenv:Body>\n    <ws:%s>\n%s\n    </ws:%s>\n  </soapenv:Body>\n</soapenv:Envelope>"
                % (escape(ns), sec, el, "\n".join(rows), el))
    headers = dict(headers, **{"Content-Type": "text/xml; charset=UTF-8", "SOAPAction": '"%s"' % tool.get("soapAction", "")})
    return {"method": "POST", "url": source["base"], "headers": headers, "params": {}, "content": envelope.encode("utf-8")}


# ------------------------------------------------------------------ 응답 해석
def _xml_to_obj(el):
    kids = list(el)
    if not kids:
        return (el.text or "").strip()
    out = {}
    for k in kids:
        name = k.tag.rsplit("}", 1)[-1]
        v = _xml_to_obj(k)
        if name in out:
            if not isinstance(out[name], list):
                out[name] = [out[name]]
            out[name].append(v)
        else:
            out[name] = v
    return out


def parse_body(resp_text, content_type):
    s = resp_text.lstrip()
    if s.startswith("{") or s.startswith("["):
        try:
            return json.loads(s)
        except ValueError:
            pass
    if s.startswith("<"):
        try:
            root = ET.fromstring(s.encode("utf-8"))
            tag = root.tag.rsplit("}", 1)[-1]
            obj = _xml_to_obj(root)
            if tag == "Envelope":  # SOAP: Body 안쪽만
                body = obj.get("Body", obj) if isinstance(obj, dict) else obj
                if isinstance(body, dict) and len(body) == 1:
                    body = next(iter(body.values()))
                if isinstance(obj, dict) and isinstance(obj.get("Body"), dict) and "Fault" in obj["Body"]:
                    raise ToolError("SOAP 오류: %s" % (obj["Body"]["Fault"].get("faultstring") or "Fault"))
                return body
            return {tag: obj}
        except ET.ParseError:
            pass
    return resp_text


def convert_response(tool, data, mask=True):
    out = {}
    for r in tool.get("res", []):
        if not r.get("o") and not r.get("newO"):
            continue
        v = _get_path(data, (r.get("newO") if r.get("fixed") and r.get("newO") else r["o"])) if isinstance(data, (dict, list)) else None
        if r.get("rule") == "mask" and not mask:
            conv = lambda x: x
        else:
            conv = lambda x, r=r: _from_origin(r, x)
        v = [conv(x) for x in v] if isinstance(v, list) else conv(v)
        if v is None or v == []:
            continue
        _set_path(out, r["a"], v)
    return out


# ------------------------------------------------------------------ 호출
def _redact(headers):
    return {k: ("••••••••" if k.lower() in SECRET_HEADERS else v) for k, v in headers.items()}


def _clip(s, n=8000):
    return s if len(s) <= n else s[:n] + "\n… (%d자 생략)" % (len(s) - n)


def read_capped(resp, limit):
    """스트리밍 응답을 limit 바이트까지만 읽는다. 넘쳤는지 알 수 있게 1바이트를 더 읽는다."""
    buf = bytearray()
    for chunk in resp.iter_bytes():
        buf += chunk
        if len(buf) > limit:
            break
    return bytes(buf[:limit + 1])


class _SessionExpired(Exception):
    """세션 로그인 원본 시스템이 "로그인하라"고 답했다. 다시 로그인해서 한 번 더 보낸다."""


def invoke(source, tool, args, ctx=None):
    """도구를 실제로 실행한다. {'result', 'trace'} 를 돌려주고, 실패하면 trace 를 담은 ToolError 를 일으킨다."""
    try:
        return _invoke_once(source, tool, args, ctx, retry=True)
    except _SessionExpired:
        session_auth.invalidate(source["id"])
        return _invoke_once(source, tool, args, ctx, retry=False)


def _invoke_once(source, tool, args, ctx, retry):
    ctx = ctx or {}
    trace = {"args": args}
    t0 = time.time()
    try:
        check_args(tool, args)
        req = build_request(source, tool, args, ctx)
    except ToolError as e:
        e.trace = dict(trace, convertMs=int((time.time() - t0) * 1000))
        raise
    convert_ms = int((time.time() - t0) * 1000)
    # build_request 로 만들어야 User-Agent, Accept 같은 기본 헤더가 붙는다. 원본 시스템 중에는
    # 이게 없으면 400 을 내는 곳이 있다. 리다이렉트는 따라가지 않는다(httpx 기본값).
    with httpx.Client(timeout=TIMEOUT) as client:
        prepared = client.build_request(req["method"], req["url"], headers=req["headers"], params=req["params"],
                                        json=req.get("json"), data=req.get("data"), content=req.get("content"))
        trace["originRequest"] = {"method": prepared.method, "url": _redact_url(str(prepared.url)), "headers": _redact(dict(prepared.headers)),
                                  "body": _clip(prepared.content.decode("utf-8", "replace"))}
        trace["convertMs"] = convert_ms
        t1 = time.time()
        try:
            resp = client.send(prepared, stream=True)
            try:
                raw = read_capped(resp, MAX_BODY)
            finally:
                resp.close()
            text = raw[:MAX_BODY].decode(resp.encoding or "utf-8", "replace")
        except httpx.HTTPError as e:
            trace["sourceMs"] = int((time.time() - t1) * 1000)
            raise ToolError("원본 시스템에 연결하지 못했습니다. (%s)" % type(e).__name__, trace)
    trace["sourceMs"] = int((time.time() - t1) * 1000)
    trace["originResponse"] = {"status": resp.status_code, "headers": {k: v for k, v in resp.headers.items() if k.lower() in ("content-type", "content-length")},
                               "body": _clip(text)}
    if credentials.get(source["id"]).get("type") == "session" and session_auth.expired(
            resp.status_code, resp.headers.get("Location"), resp.headers.get("Content-Type", ""), text):
        if retry:
            raise _SessionExpired()
        raise ToolError("서비스 계정으로 다시 로그인했지만 원본 시스템이 로그인을 요구합니다. 계정 권한을 확인해 주세요.", trace)
    if resp.status_code >= 400:
        raise ToolError("원본 시스템이 오류를 돌려줬습니다. (HTTP %d) %s" % (resp.status_code, _clip(text, 200)), trace)

    t2 = time.time()
    try:
        data = parse_body(text, resp.headers.get("Content-Type", ""))
        if isinstance(data, (dict, list)) and "json" in resp.headers.get("Content-Type", ""):
            trace["originResponse"]["body"] = _clip(json.dumps(data, ensure_ascii=False, indent=2))
        result = convert_response(tool, data, mask=tool.get("mask", True))
        if not result and isinstance(data, (dict, list)) and not tool.get("res"):
            result = data
        if not result and isinstance(data, str):
            result = {"text": data[:2000]}
    except ToolError as e:
        e.trace = trace
        raise
    trace["convertMs"] += int((time.time() - t2) * 1000)
    trace["aiResult"] = result
    trace["rulesReq"] = sorted({p["rule"] for p in tool["params"] if p.get("rule") not in (None, "keep", "name")})
    trace["rulesRes"] = sorted({r["rule"] for r in tool.get("res", []) if r.get("rule") not in (None, "keep", "name")})
    return result, trace


def _redact_url(url):
    return re.sub(r"((?:service)?key|api_?key|token|secret)=([^&]+)", lambda m: m.group(1) + "=••••••••", url, flags=re.I)

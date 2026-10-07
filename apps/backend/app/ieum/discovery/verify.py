"""찾은 API 를 실제로 한 번씩 불러 확인한다.

안전 규칙은 둘이다.

1) 운영에는 **읽기로 증명된 것만** 다시 보낸다. 화면이 이미 GET 으로 불러 성공한 것, 또는 소스가 매퍼까지
   따라가 SELECT 라고 확인한 것. 이름이 쓰기처럼 보이면(policy.risky_call) 증명돼 있어도 부르지 않는다.
2) 쓰기는 운영에 보내지 않는다. 사용자가 스테이징 주소를 줬을 때만 스테이징에서 부른다.

결과 태그는 화면과 약속돼 있다: ok(운영 성공) file(파일 응답) 404 err(검증 실패) stg(스테이징 성공)
stgerr(스테이징 실패) block(쓰기라 보내지 않음) out(범위 밖) none(검증하지 않음).
"""
import time
from typing import Callable, Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit

import httpx

from app.ieum.discovery.policy import Policy, risky_call
from app.ieum.gateway import session_auth

TIMEOUT = 15
MAX_BODY = 200_000
FILE_TYPES = ("spreadsheetml", "ms-excel", "octet-stream", "pdf", "zip", "msword", "hwp")
UA = "Mozilla/5.0 (compatible; IeumDiscovery/1.0)"


def _cookie_header(cookies: List[dict], url: str) -> str:
    """Playwright 쿠키 중 이 주소에 보낼 것만 Cookie 헤더로 만든다."""
    u = urlsplit(url)
    out = []
    for c in cookies:
        dom = (c.get("domain") or "").lstrip(".")
        path = c.get("path") or "/"
        if (u.hostname == dom or (u.hostname or "").endswith("." + dom)) and (u.path == path.rstrip("/") or u.path.startswith(path.rstrip("/") + "/") or path == "/"):
            out.append(f"{c['name']}={c['value']}")
    return "; ".join(out)


def _classify(resp: httpx.Response, ms: int) -> dict:
    ctype = resp.headers.get("content-type", "")
    if resp.status_code == 404:
        return {"k": "404", "code": 404, "ms": ms}
    if "attachment" in resp.headers.get("content-disposition", "").lower() or any(t in ctype.lower() for t in FILE_TYPES):
        return {"k": "file", "code": resp.status_code, "ms": ms}
    if 200 <= resp.status_code < 300:
        return {"k": "ok", "code": resp.status_code, "ms": ms}
    return {"k": "err", "code": resp.status_code, "ms": ms}


def _sample_value(p: dict) -> str:
    """스테이징 쓰기 호출에 쓸 값. 관찰한 값이 있으면 그것을, 없으면 타입에 맞는 시험값을 쓴다."""
    if p.get("obs"):
        return str(p["obs"][0])
    ot = (p.get("ot") or "").lower()
    if ot in ("int", "integer", "long", "short"):
        return "1"
    if ot in ("double", "float", "bigdecimal", "number"):
        return "1.0"
    if ot == "boolean":
        return "true"
    if p.get("rule") == "date" or str(p.get("o", "")).lower().endswith(("ymd", "dt", "date")):
        return "20260101"
    return "test"


class Verifier:
    def __init__(self, policy: Policy, cookies: List[dict], recipe: Optional[dict], creds: dict, opts: dict, *, emit: Callable, cancelled: Callable[[], bool]):
        self.policy, self.cookies, self.recipe, self.creds, self.opts = policy, cookies, recipe, creds, opts
        self._emit, self._cancelled = emit, cancelled
        self._stg_cookies: Optional[Dict[str, str]] = None
        self.pause = 0.0 if policy.host in ("localhost", "127.0.0.1", "::1") else 0.4

    # ── 전체 ────────────────────────────────────────────────────────────────

    def run(self, apis: List[dict]) -> None:
        stg = (self.opts.get("stgUrl") or "").strip() if self.opts.get("stg") else ""
        if not self.cookies and self.recipe and self.creds.get("username"):
            # 화면 탐색을 하지 않았다면 쿠키가 없다. 레시피로 로그인해서 읽기 검증에 쓴다.
            try:
                got = session_auth.login(self.policy.base, {"recipe": self.recipe, **self.creds})
                self.cookies = [{"name": k, "value": val, "domain": self.policy.host, "path": "/"} for k, val in got.items()]
            except session_auth.LoginError:
                pass
        with httpx.Client(timeout=TIMEOUT, follow_redirects=False, headers={"User-Agent": UA}) as client:
            for a in apis:
                if self._cancelled():
                    return
                try:
                    self._one(client, a, stg)
                except httpx.HTTPError as exc:
                    a["verify"] = {"k": "err", "code": None, "ms": None, "note": f"호출하지 못했습니다 ({type(exc).__name__})"}
                    self._event(a, "err", None, None)
                time.sleep(self.pause)

    def _one(self, client: httpx.Client, a: dict, stg: str) -> None:
        if a["verify"]["k"] == "out" or a["dep"] and not a["src"]:
            return
        tr, src = a["tr"], a["src"]
        if a["mode"] == "write":
            if tr and tr["blocked"] and not (stg and src):
                a["verify"] = {"k": "block"}
                return
            if stg and src and not a["dep"] and a["verify"]["k"] != "out":
                self._stage(client, a, stg)
            return
        # 읽기: 증명된 것만 운영에 다시 보낸다
        if risky_call(a["path"]):
            a["verify"] = {"k": "none", "note": "이름이 쓰기처럼 보여 호출하지 않았습니다"}
            return
        proven = (tr and not tr["blocked"] and a["m"] == "GET") or (src and src["sql"] == "SELECT" and a["m"] == "GET")
        if not proven:
            a["verify"] = {"k": "none", "note": "읽기라는 근거가 부족해 운영에는 호출하지 않았습니다"}
            return
        self._read(client, a)

    # ── 운영 읽기 ───────────────────────────────────────────────────────────

    def _read(self, client: httpx.Client, a: dict) -> None:
        base = self.policy.base.rstrip("/")
        group = a.get("_group")
        if group:                                                   # 화면이 부른 요청을 그대로 다시 보낸다
            first = next((o for o in group.items if not o.blocked), group.items[0])
            url = first.url
            headers = dict(first.headers or {})
        else:                                                       # 소스만 아는 API: 필수 파라미터를 모르면 부르지 않는다
            if any(p.get("req") and p.get("loc") in ("query", "path") for p in a["params"]):
                a["verify"] = {"k": "none", "note": "필수 파라미터의 값을 몰라 호출하지 않았습니다"}
                return
            url = base + a["path"]
            headers = {"x-requested-with": "XMLHttpRequest"}
        headers.pop("content-type", None)
        headers["cookie"] = _cookie_header(self.cookies, url)
        t0 = time.time()
        resp = client.get(url, headers=headers)
        ms = int((time.time() - t0) * 1000)
        a["verify"] = _classify(resp, ms)
        if a["verify"]["k"] == "ok":
            a["_body"] = resp.text[:MAX_BODY]
            if session_auth.expired(resp.status_code, None, resp.headers.get("content-type", ""), resp.text[:3000]):
                a["verify"] = {"k": "err", "code": resp.status_code, "ms": ms, "note": "로그인 화면이 돌아왔습니다"}
        self._event(a, {"ok": "ok", "file": "file", "404": "nf"}.get(a["verify"]["k"], "err"), a["verify"].get("code"), ms)

    # ── 스테이징 쓰기 ───────────────────────────────────────────────────────

    def _stage(self, client: httpx.Client, a: dict, stg: str) -> None:
        if self._stg_cookies is None:
            self._stg_cookies = self._login_stg(stg)
        if not self._stg_cookies:
            a["verify"] = {"k": "none", "note": "스테이징에 로그인하지 못해 검증하지 않았습니다"}
            return
        url = stg.rstrip("/") + a["path"]
        fields = {p["o"]: _sample_value(p) for p in a["params"] if p.get("loc") in ("form", "body", "query") and p.get("rule") != "inject"}
        group = a.get("_group")
        if group and group.items[0].post and "json" not in (group.items[0].headers or {}).get("content-type", ""):
            fields = dict(parse_qsl(group.items[0].post, keep_blank_values=True)) or fields   # 화면이 보낸 본문이 있으면 그대로
        headers = {"X-Requested-With": "XMLHttpRequest", "Cookie": "; ".join(f"{k}={v}" for k, v in self._stg_cookies.items())}
        t0 = time.time()
        if a["m"] == "GET":
            resp = client.get(url + ("?" + urlencode(fields) if fields else ""), headers=headers)
        elif any(p.get("loc") == "body" for p in a["params"]):
            resp = client.request(a["m"], url, json=fields, headers=headers)
        else:
            resp = client.request(a["m"], url, data=fields, headers=headers)
        ms = int((time.time() - t0) * 1000)
        good = 200 <= resp.status_code < 300
        a["verify"] = {"k": "stg" if good else "stgerr", "code": resp.status_code, "ms": ms,
                       "note": "" if good else "스테이징 응답: " + (resp.text.strip().replace("\n", " ")[:160])}
        self._event(a, "stg" if good else "err", resp.status_code, ms, env="stg")

    def _login_stg(self, stg: str) -> Dict[str, str]:
        if not self.recipe or not self.creds.get("username"):
            return {}
        try:
            return session_auth.login(stg, {"recipe": self.recipe, **self.creds})
        except session_auth.LoginError:
            return {}

    def _event(self, a: dict, tag: str, code, ms, env: str = "") -> None:
        fields = {"m": a["m"], "p": a["path"], "code": code, "ms": ms, "tag": tag, "api": a["id"]}
        if env:
            fields["env"] = env
        self._emit("vfy", "call", **fields)

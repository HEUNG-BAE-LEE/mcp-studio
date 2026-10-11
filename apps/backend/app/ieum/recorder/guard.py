# apps/backend/app/ieum/recorder/guard.py
"""쓰기 가드(설계 3판 8절): 기록 중 쓰기는 붙잡지 않고 보내 기록하고, 서버 보호 주소와 외부 통계는 막는다.

기록하는 사람은 자기 업무를 실제로 하는 중이다. 자기 브라우저로 해도 같은 요청이 나가므로 기록 중에는 묻지 않는다.
사람 모르게 운영 데이터가 바뀔 위험은 기록 뒤 시스템이 다시 보내는 재실행에 있고, 그 승인은 ask() 가 받는다.

순서: 1 항상 차단 → 2 조회 → 3 재실행이 승인받은 바로 그 요청 → 4 다른 출처 외부 통계 → 5 종료 마무리 뒤 쓰기 거절
→ 6 그 밖의 쓰기는 보내고 sent(로그인은 login)로 남긴다.

판단은 버튼 글자가 아니라 나가는 요청으로 한다(2026-10-09 실험: 글자로 하자 "승인대기" 행이 금지어 "승인"에 걸렸다).
글자(label)는 기록의 설명으로만 쓴다. 자동 탐색과 달리 가짜 응답을 만들지 않는다.

로그인 판정은 세션 레시피를 남기는 데만 쓴다. 비밀번호 계열 필드가 있을 때만 로그인으로 본다. masking.is_secret_key 는
token 도 비밀로 봐서, 그걸 쓰면 csrfToken 이 든 저장 요청을 로그인으로 오인해 그 요청이 레시피가 된다.

종료가 마지막 쓰기를 기다릴 수 있게, 보낸 쓰기가 끝날(응답·실패) 때까지 진행 중으로 센다(writes_in_flight).
"""
import asyncio
import itertools
import re
import time
import uuid
from typing import Awaitable, Callable, Dict, List, Optional
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.masking import HIDDEN, Masker
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import config, scope

_PW_ENDS = ("pw", "pwd", "passwd", "password")
_ID_PARTS = ("user", "login", "account", "email", "usr")
_LOGIN_CTYPES = ("application/x-www-form-urlencoded",)   # multipart 는 parse_form 이 못 읽으므로 뺐다
SENT_LOG_MAX = 500             # 기록 중 보낸 쓰기·종료 뒤 거절 이력의 기록당 상한. 넘으면 개수만 센다(sent_dropped)


def _compact(name: str) -> str:
    """이름을 소문자로 하고 영문·숫자만 남긴다. j_username, passWord, login_id 를 같은 꼴로 본다."""
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def _is_password_field(name: str) -> bool:
    c = _compact(name)
    return c == "pass" or any(c.endswith(p) for p in _PW_ENDS)


def _is_id_field(name: str) -> bool:
    c = _compact(name)
    return any(p in c for p in _ID_PARTS) or c.endswith("id")


_TOKEN_NAME = re.compile(r"csrf|xsrf|token|viewstate|eventvalidation|nonce", re.I)


def hide_token_pairs(pairs):
    """csrf·nonce 같은 토큰 이름의 값을 숨긴다. Masker 는 token 낱말만 비밀로 보아 _csrf 값이 남는다."""
    return [(k, HIDDEN if v and _TOKEN_NAME.search(str(k)) else v) for k, v in pairs]


def _norm_url(url: str) -> str:
    """정확히 맞출 때 쓰는 주소: 스킴·호스트를 소문자로 하고 기본 포트(:80, :443)를 뗀다. 경로·쿼리는 그대로 비교한다."""
    p = urlsplit(url)
    scheme, host = p.scheme.lower(), (p.hostname or "").lower()
    if ":" in host:
        host = f"[{host}]"
    port = p.port
    netloc = host if port is None or (scheme, port) in (("http", 80), ("https", 443)) else f"{host}:{port}"
    if p.username or p.password:
        netloc = p.netloc.rsplit("@", 1)[0] + "@" + netloc
    return p._replace(scheme=scheme, netloc=netloc).geturl()


def mask_url(masker: Masker, url: str, hide_tokens: bool = False) -> str:
    """주소의 쿼리와 경로 조각에 든 개인정보·비밀을 가린다. 경로 모양(조각 수)은 그대로 둔다.
    hide_tokens 면 csrf 같은 토큰 이름의 값도 숨긴다(승인 기록용. 묶음은 분석이 토큰을 알아보도록 그대로 둔다)."""
    parts = urlsplit(url)

    def seg(s: str) -> str:
        raw = unquote(s)
        m = masker.text(raw)
        return s if m == raw else quote(m, safe="*•")
    path = "/".join(seg(x) for x in parts.path.split("/"))
    pairs = masker.pairs(parse_qsl(parts.query, keep_blank_values=True))
    if hide_tokens:
        pairs = hide_token_pairs(pairs)
    query = urlencode(pairs, safe="*•")
    return parts._replace(path=path, query=query).geturl()


_CHANGE_PREFIXES = ("new", "old", "cur", "confirm", "chg", "change", "reset")
# 변경·수정에 더해 가입·생성·결제 동작의 경로 단어. 이 경로의 비밀번호 요청은 로그인이 아니다.
_CHANGE_PATH_WORDS = frozenset("change modify update reset chg edit save mod upd "
                               "join regist register insert create add signup pay order".split())
_CHANGE_PATH_PARTS = ("change", "modify", "update", "reset", "signup", "register")
_WORD = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+")


def _is_change_field(name: str) -> bool:
    """새 비밀번호·현재 비밀번호 같은 변경용 필드 이름인가."""
    c = _compact(name)
    return any(c.startswith(p) for p in _CHANGE_PREFIXES)


def _is_change_path(url: str) -> bool:
    """경로가 변경·수정·가입·생성·결제 동작을 가리키는가. 마지막 조각의 단어, 또는 경로 전체의 압축 표기로 본다."""
    path = urlsplit(url).path
    last = path.rsplit("/", 1)[-1]
    words = {w.lower() for w in _WORD.findall(last)}
    return bool(words & _CHANGE_PATH_WORDS) or any(p in _compact(path) for p in _CHANGE_PATH_PARTS)


def _host_matches(host: str, entry: str) -> bool:
    """정확 일치 또는 '.' 경계 접미 일치. evil-google-analytics.com 은 google-analytics.com 과 다르다."""
    return host == entry or host.endswith("." + entry)


def is_beacon(url: str, rtype: str) -> bool:
    """외부 통계·beacon 요청인가. ping 타입(sendBeacon, <a ping>)이거나 통계 호스트 목록에 맞는다."""
    if rtype == "ping":
        return True
    p = urlsplit(url)
    host = (p.hostname or "").lower().rstrip(".")
    if not host:
        return False
    if any(_host_matches(host, e) for e in config.beacon_hosts()):
        return True
    path = p.path.rstrip("/") if p.path != "/" else p.path
    return _host_matches(host, "google.com") and path in config.BEACON_GOOGLE_PATHS


class Guard:
    def __init__(self, policy: Policy, env: str, notify: Callable[[dict], Awaitable[None]], timeout: float = 120.0):
        self.policy, self.env, self.notify, self.timeout = policy, env, notify, timeout
        parts = urlsplit(policy.base)
        self.target_origin = f"{parts.scheme}://{parts.netloc}"
        self.label = ""
        self.login_req: Optional[dict] = None
        self.decisions: List[dict] = []
        self.decided_requests: Dict[int, str] = {}
        self._holds: Dict[str, asyncio.Future] = {}
        self.pending: Dict[str, dict] = {}            # 화면에 띄운 승인 창 내용. 늦게 붙은 구독자에게 다시 보낸다
        self._replay_holds: set = set()               # Replay 가 ask 로 띄운 승인 창. 기록을 멈춘 뒤에도 이것만 승인받는다
        self._tokens = itertools.count(1)
        self._exact: Dict[int, tuple] = {}            # Replay 가 승인받아 지금 보내는 요청 (메서드, 주소, 본문). 보내는 동안만 있다
        self._masker = Masker(pii=True)
        self.closing = False                          # 기록 종료 마무리가 끝났다. 이 뒤 페이지가 스스로 보낸 쓰기는 거절한다
        self.sent_logged = 0                          # decisions 에 남긴 sent·종료 뒤 거절 수(상한 SENT_LOG_MAX)
        self.sent_dropped = 0                         # 상한을 넘어 개수만 센 것
        self._writes: Dict[int, object] = {}          # 보내고 아직 끝나지 않은 기록 중 쓰기(id(request) → request)
        self.last_write_at = time.monotonic()         # 쓰기가 마지막으로 나가거나 끝난 시각(종료의 조용한 시간 기준)
        self.beacon_count = 0                         # 자동으로 막은 외부 통계 요청 수(주소별 첫 1건만 decisions 에 남는다)
        self._beacon_seen: set = set()

    def closing_now(self) -> None:
        """기록 종료 마무리(마지막 묶음을 닫은 뒤). 이후 페이지가 보낸 쓰기는 즉시 거절한다(Replay 의 ask 는 영향받지 않는다)."""
        self.closing = True

    @property
    def writes_in_flight(self) -> int:
        return len(self._writes)

    def inflight_writes(self) -> list:
        return list(self._writes.values())

    def on_request_done(self, request) -> None:
        """요청이 끝났다(requestfinished·requestfailed). 보낸 쓰기였으면 진행 중에서 뺀다. 재지정된 요청은 원래 요청까지 거슬러 뺀다."""
        r, seen = request, 0
        while r is not None and seen < 20:
            if self._writes.pop(id(r), None) is not None:
                self.last_write_at = time.monotonic()
            r = getattr(r, "redirected_from", None)
            seen += 1

    @property
    def holding(self) -> bool:
        return bool(self._holds)

    async def route(self, route, request) -> None:
        try:
            await self._route(route, request)
        except Exception:
            # 실패하면 닫는다. 읽기로 확정된 요청만 보내고, 쓰기일 수 있는 것은 버리고 기록한다.
            if self._provably_read(request):
                try:
                    await route.continue_()
                except Exception:
                    pass
                return
            try:
                self._log(request.method.upper(), request.url, "error")
            except Exception:
                pass
            try:
                await route.abort("blockedbyclient")
            except Exception:
                pass

    def _is_write_req(self, url: str, method: str, rtype: str) -> bool:
        """쓰기로 다룰 요청인가. GET/HEAD 가 아니면 주소 모양·자원 종류와 상관없이 쓰기다(예: imgSave.do?name=logo.png)."""
        if method not in ("GET", "HEAD"):
            return True
        return capture.is_write(url, method, rtype, self.policy)

    def _provably_read(self, request) -> bool:
        """예외가 난 뒤에도 보내도 되는 요청인가. 확실히 읽기일 때만 참이다. 판단이 실패하면 거짓(막는다)."""
        try:
            url, method, rtype = request.url, request.method.upper(), request.resource_type
            if scope.blocked(url, self.target_origin, config.deny_entries()):
                return False
            return not self._is_write_req(url, method, rtype)
        except Exception:
            return False

    def _is_login(self, request, url: str) -> bool:
        """로그인은 대상 출처로 가는 POST 폼·JSON 이고, 비밀번호 필드와 아이디 계열 필드가 함께 있을 때만이다.
        통과 여부는 가르지 않는다(기록 중 쓰기는 모두 보낸다). 세션 레시피로 남길 요청을 고르는 데만 쓴다."""
        try:
            if request.method.upper() != "POST" or not self.policy.same_origin(url):
                return False
            ctype = ((request.headers or {}).get("content-type", "") or "").lower()
            if not (any(c in ctype for c in _LOGIN_CTYPES) or "json" in ctype):
                return False
            names = list(capture.parse_form(request.post_data, ctype).keys())
            pw_names = [k for k in names if _is_password_field(k)]
            if not pw_names:
                return False
            # 비밀번호 변경·가입은 로그인이 아니다: 변경용 필드(newPw, confirmPw...)나 변경 동작의 경로(pwChange.do...)면
            # 레시피로 남기지 않는다(재실행이 그 요청을 로그인으로 다시 보내면 비밀번호가 바뀐다).
            if any(_is_change_field(k) for k in pw_names) or _is_change_path(url):
                return False
            return any(k != pk and _is_id_field(k) for pk in pw_names for k in names)
        except Exception:
            return False

    async def _route(self, route, request) -> None:
        url, method, rtype = request.url, request.method.upper(), request.resource_type
        why = scope.blocked(url, self.target_origin, config.deny_entries())
        if why:
            self._log(method, url, "denied-host", label=why)
            await self.notify({"t": "blocked", "url": self.safe_url(url)[:200], "why": why})
            await route.abort("blockedbyclient")
            return
        if not self._is_write_req(url, method, rtype):
            await route.continue_()
            return
        if self._consume_exact(method, url, request.post_data):
            # Replay 가 승인받고 지금 보내는 바로 그 요청(메서드·주소·본문이 같다)이다. 같은 요청을 두 번 묻지 않는다(결정은 ask 가 남겼다).
            self.decided_requests[id(request)] = "approve"
            await route.continue_()
            return
        if not self.policy.same_origin(url) and is_beacon(url, rtype):
            # 외부 통계는 사람이 판단할 일이 아니다. 승인 창 없이 막고, 같은 (호스트, 경로)는 첫 1건만 기록한다
            self.beacon_count += 1
            sp = urlsplit(url)
            key = ((sp.hostname or "").lower(), sp.path)
            if key not in self._beacon_seen:
                self._beacon_seen.add(key)
                self._log(method, url, "beacon", label="외부 통계")
            await route.abort("blockedbyclient")
            return
        if self.closing:
            # 마지막 묶음을 닫은 뒤 페이지가 스스로 보낸 쓰기(떠날 때 자동 저장, 오류 재시도). 사람이 한 동작이 아니다
            self._log(method, url, "deny", label="기록 종료 중", capped=True)
            self.decided_requests[id(request)] = "deny"
            await route.abort("blockedbyclient")
            return
        # 사람의 동작으로 나간 쓰기다. 묻지 않고 보내고 이력에 남긴다(운영·스테이징 같음, 어느 출처든)
        is_login = self._is_login(request, url)
        decision = "login" if is_login else "sent"
        self.decided_requests[id(request)] = decision
        self._writes[id(request)] = request             # continue 전에 센다: 응답이 continue_ 반환보다 먼저 올 수 있다
        self.last_write_at = time.monotonic()
        try:
            await route.continue_()
        except BaseException:
            self._writes.pop(id(request), None)
            raise
        if is_login:
            self._log(method, url, "login")
            self._remember_login(request, url, method)
        else:
            self._log(method, url, "sent", capped=True)

    def _remember_login(self, request, url: str, method: str) -> None:
        frame_url = getattr(getattr(request, "frame", None), "url", "") or ""
        self.login_req = {"url": url, "method": method, "post": request.post_data,
                          "ctype": (request.headers or {}).get("content-type", ""), "page": frame_url}

    async def ask(self, method: str, url: str, label: str) -> bool:
        """Replay 쓰기 단계의 승인. 기록을 멈춘 뒤에도 이 승인 창의 결정은 받는다(is_replay_hold)."""
        if self.env != "op":
            self._log(method, url, "staging", label=label)
            return True
        return await self._hold(method, url, label, replay=True) == "approve"

    def is_replay_hold(self, hold_id: str) -> bool:
        return hold_id in self._replay_holds

    def allow_exact(self, method: str, url: str, body: Optional[str]) -> int:
        """승인받은 Replay 요청을 브라우저로 보내는 동안만 그 요청 하나를 통과시킨다. 보낸 뒤 revoke 로 지운다.
        메서드·주소(쿼리 포함)·본문이 모두 같아야 하므로 멈춘 화면이 같은 경로로 보내는 다른 쓰기는 여전히 붙잡힌다."""
        token = next(self._tokens)
        self._exact[token] = (method.upper(), _norm_url(url), body or "")
        return token

    def revoke(self, token: int) -> None:
        self._exact.pop(token, None)

    def _consume_exact(self, method: str, url: str, body: Optional[str]) -> bool:
        key = (method.upper(), _norm_url(url), body or "")
        for token, v in list(self._exact.items()):
            if v == key:
                del self._exact[token]
                return True
        return False

    async def _hold(self, method: str, url: str, label: str, replay: bool = False) -> str:
        hid = uuid.uuid4().hex[:8]
        fut = asyncio.get_running_loop().create_future()
        self._holds[hid] = fut
        if replay:
            self._replay_holds.add(hid)
        msg = self.pending[hid] = {"t": "hold", "id": hid, "method": method, "path": self.policy.display(self.safe_url(url)), "label": label}
        try:
            await self.notify(msg)
            ok = await asyncio.wait_for(asyncio.shield(fut), self.timeout)
            decision = "approve" if ok else "deny"
        except asyncio.TimeoutError:
            decision = "timeout"
        except Exception:
            decision = "error"                        # 승인 창을 못 띄웠다. 승인이 없으므로 보내지 않는다.
        finally:
            self._holds.pop(hid, None)
            self.pending.pop(hid, None)
            self._replay_holds.discard(hid)
        self._log(method, url, decision, hid, label)
        try:
            await self.notify({"t": "hold-end", "id": hid, "decision": decision})
        except Exception:
            pass                                      # 종료 알림 실패는 결정을 바꾸지 않는다(결정은 decisions 에 남는다)
        return decision

    def decide(self, hold_id: str, ok: bool) -> bool:
        fut = self._holds.get(hold_id)
        if fut is None or fut.done():
            return False
        fut.set_result(bool(ok))
        return True

    def deny_all(self) -> int:
        """대기 중인 승인을 모두 거부로 닫는다(기록을 멈출 때). 결정은 각 _hold 가 decisions 에 deny 로 남긴다."""
        n = 0
        for hid in list(self._holds):
            if self.decide(hid, False):
                n += 1
        return n

    def safe_url(self, url: str) -> str:
        """화면·승인 기록에 남길 주소. 쿼리와 경로의 개인정보·토큰을 가린다(승인 기록은 저장되고 API 로 나간다)."""
        try:
            return mask_url(self._masker, url, hide_tokens=True)
        except Exception:
            return urlsplit(url)._replace(query="").geturl()

    def _log(self, method: str, url: str, decision: str, hid: str = "", label: str = "", capped: bool = False) -> None:
        """이력을 남긴다. capped 이력(sent, 종료 뒤 거절)은 기록당 SENT_LOG_MAX 건까지만 남기고 나머지는 개수만 센다."""
        if capped:
            if self.sent_logged >= SENT_LOG_MAX:
                self.sent_dropped += 1
                return
            self.sent_logged += 1
        url = self.safe_url(url)
        self.decisions.append({"id": hid, "method": method, "url": self.policy.display(url), "path": urlsplit(url).path,
                               "label": label or self.label, "decision": decision, "at": time.time()})

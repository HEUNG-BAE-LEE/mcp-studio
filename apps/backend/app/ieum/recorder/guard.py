# apps/backend/app/ieum/recorder/guard.py
"""쓰기 가드: 운영에서 쓰기 요청은 붙잡아 사람에게 묻고, 서버 보호 주소는 막는다.

판단은 버튼 글자가 아니라 나가는 요청으로 한다(2026-10-09 실험: 글자로 하자 "승인대기" 행이 금지어 "승인"에 걸렸다).
글자(label)는 승인 창의 설명으로만 쓴다. 어느 출처로 가는 쓰기든 같다 — 결재 시스템의 저장도 운영 데이터를 바꾼다.

자동 탐색과 달리 가짜 응답을 만들지 않는다. 가짜 {} 를 받은 화면은 다음 단계에 필요한 값(생성 번호)이 없어 헤맨다.

로그인은 비밀번호 계열 필드가 있을 때만 로그인으로 본다. masking.is_secret_key 는 token 도 비밀로 봐서, 그걸 쓰면
csrfToken 이 든 저장 요청을 로그인으로 오인해 승인 없이 보낸다.
"""
import asyncio
import re
import time
import uuid
from typing import Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import config, scope

_PW_WORDS = frozenset("pw pwd pass passwd password".split())
_WORD = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+")


def _is_password_field(name: str) -> bool:
    return any(w.lower() in _PW_WORDS for w in _WORD.findall(str(name)))


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

    def _provably_read(self, request) -> bool:
        """예외가 난 뒤에도 보내도 되는 요청인가. 확실히 읽기일 때만 참이다. 판단이 실패하면 거짓(막는다)."""
        try:
            url, method, rtype = request.url, request.method.upper(), request.resource_type
            if scope.blocked(url, self.target_origin, config.deny_entries()):
                return False
            if not capture.is_write(url, method, rtype, self.policy):
                return True
            return bool(self.policy.is_read_post(url))
        except Exception:
            return False

    def _is_login(self, request) -> bool:
        try:
            fields = capture.parse_form(request.post_data, (request.headers or {}).get("content-type", ""))
        except Exception:
            return False
        return any(_is_password_field(k) for k in fields)

    async def _route(self, route, request) -> None:
        url, method, rtype = request.url, request.method.upper(), request.resource_type
        why = scope.blocked(url, self.target_origin, config.deny_entries())
        if why:
            self._log(method, url, "denied-host", label=why)
            await self.notify({"t": "blocked", "url": url[:200], "why": why})
            await route.abort("blockedbyclient")
            return
        if not capture.is_write(url, method, rtype, self.policy):
            await route.continue_()
            return
        if self._is_login(request):
            frame_url = getattr(getattr(request, "frame", None), "url", "") or ""
            self.login_req = {"url": url, "method": method, "post": request.post_data,
                              "ctype": (request.headers or {}).get("content-type", ""), "page": frame_url}
            await route.continue_()
            return
        if self.policy.is_read_post(url):
            await route.continue_()
            return
        if self.env != "op":
            self._log(method, url, "staging")
            self.decided_requests[id(request)] = "staging"
            await route.continue_()
            return
        decision = await self._hold(method, url, self.label)
        self.decided_requests[id(request)] = decision
        if decision == "approve":
            await route.continue_()
        else:
            await route.abort("blockedbyclient")

    async def ask(self, method: str, url: str, label: str) -> bool:
        if self.env != "op":
            self._log(method, url, "staging", label=label)
            return True
        return await self._hold(method, url, label) == "approve"

    async def _hold(self, method: str, url: str, label: str) -> str:
        hid = uuid.uuid4().hex[:8]
        fut = asyncio.get_running_loop().create_future()
        self._holds[hid] = fut
        try:
            await self.notify({"t": "hold", "id": hid, "method": method, "path": self.policy.display(url), "label": label})
            ok = await asyncio.wait_for(asyncio.shield(fut), self.timeout)
            decision = "approve" if ok else "deny"
        except asyncio.TimeoutError:
            decision = "timeout"
        except Exception:
            decision = "error"                        # 승인 창을 못 띄웠다. 승인이 없으므로 보내지 않는다.
        finally:
            self._holds.pop(hid, None)
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

    def _log(self, method: str, url: str, decision: str, hid: str = "", label: str = "") -> None:
        self.decisions.append({"id": hid, "method": method, "url": self.policy.display(url), "path": urlsplit(url).path,
                               "label": label or self.label, "decision": decision, "at": time.time()})

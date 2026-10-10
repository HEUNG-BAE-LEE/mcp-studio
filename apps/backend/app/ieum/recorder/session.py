# apps/backend/app/ieum/recorder/session.py
"""기록 세션 하나 = 사용자 한 명의 서버 브라우저.

세션마다 Chromium 을 따로 띄워 쿠키와 기록이 섞이지 않게 한다. 화면은 CDP 스트리밍으로 구독자마다 최신 프레임만 보내고,
입력은 relay 로 넣는다. 입력을 넣기 직전에 trace.begin() 을 불러 직전 화면을 뜬다.

쓰기 승인 창이 떠 있는 동안에는 다른 입력을 받지 않는다(승인 창 아래 클릭이 엉뚱한 곳에 들어가지 않게).
대상 사이트의 alert/confirm 은 사용자에게 그대로 묻는다. 자동 탐색처럼 항상 취소하지 않는다.
"""
import asyncio
import secrets
import time
from typing import Callable, Dict, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import login, relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace


class RecorderSession:
    def __init__(self, rec: dict, creds: Optional[dict], on_dead: Optional[Callable[[str], None]] = None):
        self.rid, self.rec, self.creds, self.owner = rec["id"], rec, creds, rec.get("owner") or ""
        self.token = secrets.token_urlsafe(18)
        self.policy = Policy(base=rec["sourceBase"], read_post=rec.get("readPost", ""))
        self.guard = Guard(self.policy, rec["env"], self.broadcast)
        self.trace = Trace(self.rid, self.policy, self.guard, self.broadcast, on_closed=self._after_span)
        self.subs: Dict[object, relay.LatestSender] = {}
        self.started = time.time()
        self.last_input = time.time()
        self.closed = False
        self.stopping = False
        self.browser = self.ctx = self.page = self.cdp = None
        self.pages: list = []
        self._dialog = None
        self._last_frame: Optional[str] = None
        self._loop = None
        self._on_dead = on_dead

    # ── 구독 ───────────────────────────────────────────────────────────────
    def subscribe(self, ws) -> None:
        sender = self.subs[ws] = relay.LatestSender(lambda data, ws=ws: ws.send_json({"t": "frame", "data": data}))
        if self._last_frame is not None:
            self._offer_threadsafe(sender, self._last_frame)         # 화면이 멈춰 있으면 새 프레임이 안 온다. 늦게 붙은 구독자에게 마지막 화면을 준다

    def unsubscribe(self, ws) -> None:
        self.subs.pop(ws, None)

    def _offer_threadsafe(self, sender, data: str) -> None:
        """펌프는 세션의 루프에서 돌려야 한다. 루프 밖에서 부르는 경로는 시험용이다(운영에서는 라우터가 루프 안에서 부른다)."""
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is not None and running is self._loop:
            sender.offer(data)
        elif self._loop is not None and not self._loop.is_closed():
            try:
                self._loop.call_soon_threadsafe(sender.offer, data)
            except RuntimeError:
                pass                                      # 루프가 막 닫혔다. 보낼 곳이 없다

    def _prune(self) -> None:
        """보내기가 실패한 구독자(끊긴 WebSocket)는 다시 시도하지 않고 뺀다."""
        for ws, sender in list(self.subs.items()):
            if sender.failed:
                self.subs.pop(ws, None)

    def _frame(self, data: str) -> None:
        self._last_frame = data
        self._prune()
        for sender in list(self.subs.values()):
            sender.offer(data)

    async def broadcast(self, msg: dict) -> None:
        """구독자에게 보낸다. trace 의 잠금 안에서 불리므로 trace.begin/finish 를 부르지 않는다(교착)."""
        self._prune()
        for ws in list(self.subs):
            try:
                await ws.send_json(msg)
            except Exception:
                self.subs.pop(ws, None)

    # ── 시작 ───────────────────────────────────────────────────────────────
    async def start(self, pw) -> None:
        self._loop = asyncio.get_running_loop()
        self.browser, _ = await browser_mod.launch_async(pw)
        self.browser.on("disconnected", lambda _: asyncio.ensure_future(self._on_disconnected()))
        self.ctx = await self.browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H}, locale="ko-KR",
                                                  ignore_https_errors=True, accept_downloads=False)
        await self.ctx.expose_binding("__ieumRec", self.trace.on_dom_event)
        await self.ctx.add_init_script(INIT_JS)
        await self.ctx.route("**/*", self.guard.route)
        self.ctx.on("request", self.trace.on_request)
        self.ctx.on("requestfinished", self.trace.on_request_done)
        self.ctx.on("requestfailed", self.trace.on_request_done)
        self.ctx.on("response", self.trace.on_response)
        page = await self.ctx.new_page()
        await self._activate(page)
        self.ctx.on("page", lambda p: asyncio.ensure_future(self._on_page(p)))   # 첫 페이지를 만든 뒤에 건다
        await page.goto(self.policy.base + (self.rec.get("start") or ""), wait_until="domcontentloaded", timeout=30_000)
        if await login.on_login_page(page):
            if self.creds and await login.auto_login(page, self.creds):
                await self.broadcast({"t": "login", "state": "done", "msg": "서비스 계정으로 로그인했습니다."})
            else:
                msg = "자동 로그인에 실패했습니다. 화면에서 직접 로그인해 주세요." if self.creds else "화면에서 직접 로그인해 주세요."
                await self.broadcast({"t": "login", "state": "needed", "msg": msg})

    async def _on_disconnected(self) -> None:
        if self.closed:
            return
        self.closed = True

        def mark(r):
            if r["status"] in store.ACTIVE:
                r.update(status="interrupted", endedAt=time.time(), error="브라우저가 예기치 않게 종료되어 기록이 중단되었습니다.")
        try:
            await asyncio.to_thread(store.update_recording, self.rid, mark)
        except KeyError:
            pass
        await self.broadcast({"t": "status", "status": "interrupted", "error": "브라우저가 종료되었습니다."})
        if self._on_dead:
            self._on_dead(self.rid)

    async def _on_page(self, page) -> None:
        if page not in self.pages:
            await self._activate(page)

    async def _activate(self, page) -> None:
        if page not in self.pages:
            self.pages.append(page)
            page.on("dialog", lambda d: asyncio.ensure_future(self._on_dialog(d)))
            page.on("filechooser", lambda fc: asyncio.ensure_future(self.broadcast(
                {"t": "notice", "msg": "파일 업로드는 아직 지원하지 않습니다. 업로드 단계는 빼고 기록해 주세요."})))
            page.on("close", lambda _: asyncio.ensure_future(self._on_close(page)))
        if self.cdp is not None:
            await relay.stop_screencast(self.cdp)
        self.page = page
        self.cdp = await self.ctx.new_cdp_session(page)
        await relay.start_screencast(self.cdp, self._frame)
        await self.send_tabs()

    async def _on_close(self, page) -> None:
        if page in self.pages:
            self.pages.remove(page)
        if page is self.page and self.pages and not self.closed:
            await self._activate(self.pages[-1])
        else:
            await self.send_tabs()

    async def send_tabs(self) -> None:
        tabs = []
        for i, p in enumerate(self.pages):
            try:
                tabs.append({"index": i, "url": self.policy.display(p.url), "title": await p.title()})
            except Exception:
                tabs.append({"index": i, "url": "", "title": ""})
        await self.broadcast({"t": "tabs", "tabs": tabs, "active": self.pages.index(self.page) if self.page in self.pages else 0})

    async def _on_dialog(self, dialog) -> None:
        self._dialog = dialog
        await self.broadcast({"t": "dialog", "type": dialog.type, "message": dialog.message})

    async def _after_span(self, page, span: dict) -> None:
        """기록 도중 로그인 화면으로 튕겼으면 알린다. 기록은 이어진다(가드가 로그인 요청을 통과시킨다).

        trace 의 잠금 안에서 불리므로 trace.begin/finish 를 부르지 않는다(교착)."""
        if page is not None and span["seq"] > 1 and await login.on_login_page(page):
            await self.broadcast({"t": "login", "state": "needed", "msg": "세션이 끊겼습니다. 화면에서 다시 로그인해 주세요. 기록은 이어집니다."})

    # ── 입력 ───────────────────────────────────────────────────────────────
    async def handle(self, msg: dict) -> None:
        t = msg.get("t")
        self.last_input = time.time()
        if t == "approve":
            if self.stopping:
                return                                  # 멈추는 중에는 승인·거부를 받지 않는다(멈출 때 모두 거부로 닫는다)
            self.guard.decide(str(msg.get("id")), bool(msg.get("ok")))
            return
        if t == "dialog" and self._dialog is not None:
            d, self._dialog = self._dialog, None
            try:
                await (d.accept(msg.get("text") or "") if msg.get("ok") else d.dismiss())
            except Exception:
                pass
            return
        if t == "pause":
            self.trace.paused = bool(msg.get("on"))
            return
        if t == "tab":
            i = int(msg.get("index", 0))
            if 0 <= i < len(self.pages):
                await self._activate(self.pages[i])
            return
        if self.guard.holding or self.cdp is None or self.stopping:
            return                                      # 승인 창이 떠 있는 동안 다른 입력은 받지 않는다
        if t == "click":
            x, y = relay.to_page(msg["x"], msg["y"], msg["w"], msg["h"])
            await self.trace.begin(self.page, "click")
            await relay.click(self.cdp, x, y)
        elif t == "wheel":
            x, y = relay.to_page(msg["x"], msg["y"], msg["w"], msg["h"])
            await relay.wheel(self.cdp, x, y, float(msg.get("dy", 0)))
        elif t == "text":
            await relay.insert_text(self.cdp, str(msg.get("data") or "")[:500])
        elif t == "key" and msg.get("key") in relay.KEYS:
            if msg["key"] == "Enter":
                await self.trace.begin(self.page, "key")
            await relay.key(self.cdp, msg["key"])

    # ── 끝 ─────────────────────────────────────────────────────────────────
    async def _deny_pending(self) -> None:
        """대기 중인 쓰기 승인을 거부로 닫고, 각 _hold 가 decisions 에 deny 를 남길 때까지 잠깐 기다린다."""
        self.guard.deny_all()
        for _ in range(100):
            if not self.guard.holding:
                return
            await asyncio.sleep(0.02)

    async def stop(self) -> None:
        self.stopping = True
        await self._deny_pending()
        await self.trace.finish(self.page)
        await self._deny_pending()
        recipe = await login.recipe_for(self.guard.login_req, self.policy, self.creds)
        login_path = urlsplit(self.guard.login_req["url"]).path if self.guard.login_req else ""

        def fin(r):
            r["endedAt"] = time.time()
            r["approvals"] = list(self.guard.decisions)
            r["login"]["recipe"] = recipe
            r["login"]["path"] = login_path
        await asyncio.to_thread(store.update_recording, self.rid, fin)

    async def close(self) -> None:
        if self.closed and self.browser is None:
            return
        self.closed = True
        try:
            if self.cdp is not None:
                await relay.stop_screencast(self.cdp)
            if self.browser is not None:
                await self.browser.close()
        except Exception:
            pass
        self.browser = None
        await self.broadcast({"t": "status", "status": "closed"})

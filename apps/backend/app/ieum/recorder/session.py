# apps/backend/app/ieum/recorder/session.py
"""기록 세션 하나 = 사용자 한 명의 서버 브라우저.

세션마다 Chromium 을 따로 띄워 쿠키와 기록이 섞이지 않게 한다. 화면은 CDP 스트리밍으로 구독자마다 최신 프레임만 보내고,
입력은 relay 로 넣는다. 입력을 넣기 직전에 trace.begin() 을 불러 직전 화면을 뜬다.

쓰기 승인 창이 떠 있는 동안에는 다른 입력을 받지 않는다(승인 창 아래 클릭이 엉뚱한 곳에 들어가지 않게).
화면에서 오는 메시지는 둘로 나눈다(dispatch). 제어(승인·확인 창·일시 정지·탭)는 받는 즉시 처리하고, 입력(클릭·휠·글자·키)은
세션마다 한 줄에 넣어 소비 작업 하나가 도착 순서대로 처리한다. 확인 창이 열린 페이지에서 입력 처리(스냅샷)가 막혀도
같은 연결로 온 확인 창 응답이 그 뒤에 갇히지 않게 하려는 것이다.
대상 사이트의 alert/confirm 은 사용자에게 그대로 묻는다. 자동 탐색처럼 항상 취소하지 않는다.
"""
import asyncio
import logging
import re
import secrets
import time
from collections import deque
from typing import Callable, Dict, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import login, relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace

log = logging.getLogger(__name__)
_CONN_ERR = re.compile(r"ERR_(CONNECTION_|TIMED_OUT|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE|INTERNET_DISCONNECTED|SSL_|CERT_)")
TAB_TITLE_SEC = 5.0
FAIL_NOTICE_SEC = 30.0         # 같은 연결 실패 문구는 이 시간에 한 번만 알린다
INPUT_KINDS = ("click", "wheel", "text", "key")
INPUT_MAX = 50                 # 입력 줄 상한. 넘치면 오래된 휠부터 버린다
DIALOG_REPLY_SEC = 5.0


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
        self.stopping_at = 0.0                        # 멈춤을 시작한 시각(리퍼가 오래 멈추는 중인 세션을 회수한다)
        self.accept_replay = False                    # 멈춘 뒤 Replay 검증이 띄운 승인 창의 결정만 받는다
        self.browser = self.ctx = self.page = self.cdp = None
        self.pages: list = []
        self._dialog = None
        self._closed_dialog_notice = False
        self._fail_seen: Dict[str, float] = {}
        self.trace.dialog_open = self.dialog_open
        self._last_frame: Optional[str] = None
        self._loop = None
        self._on_dead = on_dead
        self._inputs: deque = deque()
        self._input_ready = asyncio.Event()
        self._input_task: Optional[asyncio.Task] = None
        self._ctl_task: Optional[asyncio.Task] = None

    def dialog_open(self, page) -> bool:
        """그 페이지에 확인 창이 열려 있는가(열린 창이 있는 페이지는 Playwright 호출이 돌아오지 않는다)."""
        d = self._dialog
        if d is None:
            return False
        try:
            return d.page is page
        except Exception:
            return True

    # ── 구독 ───────────────────────────────────────────────────────────────
    def subscribe(self, ws) -> None:
        sender = self.subs[ws] = relay.LatestSender(lambda data, ws=ws: ws.send_json({"t": "frame", "data": data}))
        if self._last_frame is not None:
            self._offer_threadsafe(sender, self._last_frame)         # 화면이 멈춰 있으면 새 프레임이 안 온다. 늦게 붙은 구독자에게 마지막 화면을 준다
        pending = list(self.guard.pending.values()) + ([{"t": "dialog", "type": self._dialog.type, "message": self._dialog.message}] if self._dialog is not None else [])
        for msg in pending:                                          # 떠 있는 승인 창·확인 창도 다시 보낸다(목록에서 다시 연 화면이 승인 창을 놓치지 않게)
            self._send_threadsafe(ws, msg)

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

    def _send_threadsafe(self, ws, msg: dict) -> None:
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is not None and running is self._loop:
            running.create_task(self._safe_send(ws, msg))
        elif self._loop is not None and not self._loop.is_closed():
            try:
                asyncio.run_coroutine_threadsafe(self._safe_send(ws, msg), self._loop)
            except RuntimeError:
                pass

    @staticmethod
    async def _safe_send(ws, msg: dict) -> None:
        try:
            await ws.send_json(msg)
        except Exception:
            pass

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
        # 서비스 워커가 가로챈 요청은 context.route 에 보이지 않는다. 막지 않으면 쓰기가 가드를 비켜 간다
        self.ctx = await self.browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H}, locale="ko-KR",
                                                  ignore_https_errors=True, accept_downloads=False, service_workers="block")
        await self.ctx.expose_binding("__ieumRec", self.trace.on_dom_event)
        await self.ctx.add_init_script(INIT_JS)
        await self.ctx.route("**/*", self.guard.route)
        self.ctx.on("request", self.trace.on_request)
        self.ctx.on("requestfinished", self.trace.on_request_done)
        self.ctx.on("requestfailed", self.trace.on_request_done)
        self.ctx.on("requestfailed", lambda r: asyncio.ensure_future(self._on_request_failed(r)))
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
        self._stop_inputs()

        await self._deny_pending()                      # 보낼 브라우저가 없다. 대기 승인을 거부로 닫고 그 결정이 남을 때까지 기다린다

        def mark(r):
            r["approvals"] = list(self.guard.decisions)  # 멈춤과 같이 승인 기록을 남긴다(끊겨도 무엇을 보냈는지는 남아야 한다)
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
        if self._dialog is not None and self.dialog_open(page):
            self._dialog = None                           # 닫힌 페이지의 확인 창은 더 응답할 수 없다
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
                title = "" if self.dialog_open(p) else await asyncio.wait_for(p.title(), TAB_TITLE_SEC)   # 확인 창이 열린 페이지는 title() 이 멈춘다
                tabs.append({"index": i, "url": self.policy.display(p.url), "title": title})
            except Exception:
                tabs.append({"index": i, "url": "", "title": ""})
        await self.broadcast({"t": "tabs", "tabs": tabs, "active": self.pages.index(self.page) if self.page in self.pages else 0})

    async def _on_request_failed(self, request) -> None:
        """문서 요청이 연결 단계에서 실패하면 원인 문구를 로그와 콘솔에 남긴다(같은 문구는 30초에 한 번)."""
        try:
            if request.resource_type != "document" or request.frame.parent_frame is not None:
                return                                   # 최상위 문서만. 광고 iframe 의 실패는 알리지 않는다
            err = (request.failure or "").strip()
            if not _CONN_ERR.search(err):
                return                                   # 취소·가드 차단 같은 오류는 연결 실패가 아니다
            now = time.time()
            if now - self._fail_seen.get(err, 0.0) < FAIL_NOTICE_SEC:
                return
            self._fail_seen[err] = now
            p = urlsplit(request.url)
            shown = self.policy.display(f"{p.scheme}://{p.netloc}{p.path}")      # 쿼리는 남기지 않는다
            log.warning("대상 사이트 연결 실패 rid=%s %s %s", self.rid, shown, err)
            await self.broadcast({"t": "notice", "msg": f"대상 사이트 연결 실패: {err}"})
        except Exception:
            pass

    async def _close_dialog_for_stop(self, dialog) -> None:
        """기록을 멈추는 중에는 대상 사이트의 확인 창을 사람이 닫을 수 없다. 열려 있으면 스냅샷·종료가 멈추므로 닫는다."""
        try:
            await dialog.dismiss()
        except Exception:
            pass
        if not self._closed_dialog_notice:
            self._closed_dialog_notice = True
            await self.broadcast({"t": "notice", "msg": "기록 종료 중이라 대상 사이트의 확인 창을 닫았습니다."})

    async def _on_dialog(self, dialog) -> None:
        if self.stopping:
            await self._close_dialog_for_stop(dialog)
            return
        self._dialog = dialog
        await self.broadcast({"t": "dialog", "type": dialog.type, "message": dialog.message})

    async def _after_span(self, page, span: dict) -> None:
        """기록 도중 로그인 화면으로 튕겼으면 알린다. 기록은 이어진다(가드가 로그인 요청을 통과시킨다).

        trace 의 잠금 안에서 불리므로 trace.begin/finish 를 부르지 않는다(교착)."""
        if page is None or span["seq"] <= 1 or self.dialog_open(page):
            return                                       # 확인 창이 열린 페이지에는 질의가 돌아오지 않는다
        try:
            on_login = await asyncio.wait_for(login.on_login_page(page), TAB_TITLE_SEC)
        except Exception:
            return
        if on_login:
            await self.broadcast({"t": "login", "state": "needed", "msg": "세션이 끊겼습니다. 화면에서 다시 로그인해 주세요. 기록은 이어집니다."})

    # ── 입력 ───────────────────────────────────────────────────────────────
    async def dispatch(self, msg: dict) -> None:
        """WebSocket 메시지 처리 입구. 입력은 줄에 넣고 바로 돌아오고, 제어는 바로 처리한다."""
        t = msg.get("t")
        if t in INPUT_KINDS:
            self.last_input = time.time()
            self._enqueue_input(msg)
            return
        if t in ("pause", "tab"):
            # 일시 정지·탭 전환은 trace 잠금·CDP 를 기다릴 수 있다. 수신 루프를 막지 않게 따로 돌리되 둘끼리는 순서를 지킨다
            self.last_input = time.time()
            prev = self._ctl_task
            self._ctl_task = asyncio.get_running_loop().create_task(self._ordered_control(prev, msg))
            return
        await self.handle(msg)                           # 승인·확인 창 응답은 기다릴 것이 없다. 바로 처리한다

    async def _ordered_control(self, prev: Optional[asyncio.Task], msg: dict) -> None:
        if prev is not None and not prev.done():
            await asyncio.wait({prev})
        if self.closed:
            return
        try:
            await self.handle(msg)
        except Exception:
            log.exception("기록 화면 제어 메시지 처리에 실패했습니다: %s", self.rid)

    def _enqueue_input(self, msg: dict) -> None:
        if self.closed:
            return
        self._inputs.append(msg)
        if len(self._inputs) > INPUT_MAX:
            drop = next((m for m in self._inputs if m.get("t") == "wheel"), None)
            if drop is not None:
                self._inputs.remove(drop)               # 휠은 버려도 화면이 조금 덜 움직일 뿐이다
            else:
                log.warning("기록 입력 줄이 넘쳐 가장 오래된 입력을 버립니다: %s", self.rid)
                self._inputs.popleft()
        self._input_ready.set()
        if self._input_task is None or self._input_task.done():
            self._input_task = asyncio.get_running_loop().create_task(self._consume_inputs())

    async def _consume_inputs(self) -> None:
        """세션당 하나. 입력을 도착 순서대로 처리한다. 하나가 실패해도 다음 입력은 처리한다."""
        while not self.closed:
            if not self._inputs:
                self._input_ready.clear()
                await self._input_ready.wait()
                continue
            msg = self._inputs.popleft()
            try:
                await self._handle_input(msg)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("기록 화면 입력 처리에 실패했습니다: %s", self.rid)

    def _stop_inputs(self) -> list:
        """입력 줄을 비우고 소비 작업을 취소한다(세션이 닫힐 때). 취소한 작업을 돌려준다."""
        self._inputs.clear()
        live = [t for t in (self._input_task, self._ctl_task) if t is not None and not t.done()]
        for task in live:
            task.cancel()
        self._input_task = self._ctl_task = None
        return live

    async def handle(self, msg: dict) -> None:
        """메시지 하나를 바로 처리한다. 입력도 여기서 바로 처리하므로 WebSocket 경로는 dispatch 를 거친다."""
        t = msg.get("t")
        self.last_input = time.time()
        if t == "approve":
            hid = str(msg.get("id"))
            if self.stopping:
                # 멈추는 중·멈춘 뒤에는 기록 중에 붙잡은 요청의 승인을 받지 않는다(멈출 때 모두 거부로 닫는다).
                # 멈춘 뒤 Replay 검증이 묻는 쓰기 승인만 받는다. 안 받으면 승인 창이 떠 있는데 2분을 기다리다 거부가 된다
                if self.accept_replay and self.guard.is_replay_hold(hid):
                    self.guard.decide(hid, bool(msg.get("ok")))
                return
            self.guard.decide(hid, bool(msg.get("ok")))
            return
        if t == "dialog" and self._dialog is not None:
            d, self._dialog = self._dialog, None
            try:
                await asyncio.wait_for(d.accept(msg.get("text") or "") if msg.get("ok") else d.dismiss(), DIALOG_REPLY_SEC)
            except Exception:
                pass
            return
        if t == "pause":
            await self.trace.set_paused(bool(msg.get("on")), self.page)
            return
        if t == "tab":
            i = int(msg.get("index", 0))
            if 0 <= i < len(self.pages):
                await self._activate(self.pages[i])
            return
        await self._handle_input(msg)

    async def _handle_input(self, msg: dict) -> None:
        t = msg.get("t")
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

    async def begin_stopping(self) -> None:
        """멈춤의 시작: 입력을 끊고, 이 뒤에 붙잡힐 기록 쪽 쓰기는 바로 거절하고, 열려 있는 확인 창을 닫는다(정상 멈춤·유휴 멈춤 공통)."""
        self.stopping = True
        if not self.stopping_at:
            self.stopping_at = time.time()
        self._inputs.clear()                             # 줄에 남은 입력은 멈춤 뒤에 처리하지 않는다
        self.guard.closing_now()
        if self._dialog is not None:
            d = self._dialog
            try:
                await asyncio.wait_for(self._close_dialog_for_stop(d), 5)
                if self._dialog is d:
                    self._dialog = None                  # 닫는 사이 새로 뜬 창은 지우지 않는다
            except Exception:
                pass                                     # 닫지 못해도 멈춤은 계속한다. _dialog 를 남겨 두어 스냅샷이 그 페이지를 계속 건너뛴다

    async def stop(self) -> None:
        await self.begin_stopping()
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
        self.accept_replay = True                       # 기록 쪽 승인은 모두 닫았다. 이제부터 오는 승인 창은 Replay 의 것이다

    async def close(self) -> None:
        me = asyncio.current_task()
        left = [t for t in self._stop_inputs() if t is not me]
        if left:
            await asyncio.wait(left, timeout=2)          # 취소가 실제로 끝날 때까지 잠깐 기다린다(누수 없음)
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

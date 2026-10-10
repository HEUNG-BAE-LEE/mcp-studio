"""화면 중계: 서버 브라우저 화면을 영상으로 보내고, 사용자의 입력을 CDP 로 되돌려 넣는다.

무엇을 눌렀는지는 영상이 아니라 브라우저 안 이벤트로 안다(trace.py). 여기서는 입력을 진짜 입력으로 넣기만 한다.
CDP Input.dispatch* 로 넣은 입력은 페이지에서 isTrusted=true 다(2026-10-09 실험).

한글은 사용자 쪽에서 조합이 끝난 글자를 Input.insertText 로 넣는다. 키를 하나씩 보내면 자모가 깨진다.

느린 사용자에게 프레임을 쌓아 두면 메모리가 늘고 화면이 점점 늦어진다. 구독자마다 최신 프레임 하나만 들고,
보내는 중에 새 프레임이 오면 앞 것을 버린다(LatestSender).
"""
import asyncio
from typing import Awaitable, Callable, Dict, Optional, Tuple

VIEW_W, VIEW_H = 1280, 800
KEYS: Dict[str, Tuple[int, str]] = {
    "Enter": (13, "\r"), "Backspace": (8, ""), "Tab": (9, ""), "Escape": (27, ""), "Delete": (46, ""),
    "ArrowUp": (38, ""), "ArrowDown": (40, ""), "ArrowLeft": (37, ""), "ArrowRight": (39, ""), "Home": (36, ""), "End": (35, ""),
}


def to_page(x: float, y: float, w: float, h: float) -> Tuple[float, float]:
    # 화면 크기가 0 이하로 올 수 있다(아직 레이아웃이 없을 때). 0으로 나누지 않도록 1로 본다.
    w, h = max(w, 1), max(h, 1)
    px = min(max(x * VIEW_W / w, 0.0), VIEW_W - 1)
    py = min(max(y * VIEW_H / h, 0.0), VIEW_H - 1)
    return float(px), float(py)


async def click(cdp, x: float, y: float) -> None:
    for typ in ("mouseMoved", "mousePressed", "mouseReleased"):
        await cdp.send("Input.dispatchMouseEvent", {"type": typ, "x": x, "y": y, "button": "left", "clickCount": 1})


async def wheel(cdp, x: float, y: float, dy: float) -> None:
    await cdp.send("Input.dispatchMouseEvent", {"type": "mouseWheel", "x": x, "y": y, "deltaX": 0, "deltaY": dy})


async def insert_text(cdp, text: str) -> None:
    await cdp.send("Input.insertText", {"text": text})


async def key(cdp, name: str) -> None:
    code, text = KEYS[name]
    base = {"key": name, "code": name, "windowsVirtualKeyCode": code}
    await cdp.send("Input.dispatchKeyEvent", dict(base, type="keyDown", **({"text": text} if text else {})))
    await cdp.send("Input.dispatchKeyEvent", dict(base, type="keyUp"))


async def start_screencast(cdp, on_frame: Callable[[str], None]) -> None:
    async def handle(p):
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception:
            return
        on_frame(p["data"])
    cdp.on("Page.screencastFrame", handle)
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 60, "maxWidth": VIEW_W, "maxHeight": VIEW_H})


async def stop_screencast(cdp) -> None:
    try:
        await cdp.send("Page.stopScreencast")
    except Exception:
        pass


class LatestSender:
    """구독자 하나에 최신 프레임만 보낸다. 보내기가 한 번이라도 실패하면 failed 를 세우고 더 받지 않는다."""

    def __init__(self, send: Callable[[str], Awaitable[None]]):
        self._send = send
        self._latest: Optional[str] = None
        self._busy = False
        self._task: Optional[asyncio.Future] = None  # 펌프 작업을 붙잡아 두어 중간에 수거되지 않게 한다
        self.failed = False
        self.dropped = 0
        self.sent = 0

    def offer(self, data: str) -> None:
        if self.failed:
            return
        if self._latest is not None:
            self.dropped += 1
        self._latest = data
        if not self._busy:
            self._busy = True
            self._task = asyncio.ensure_future(self._pump())

    async def _pump(self) -> None:
        try:
            while self._latest is not None:
                data, self._latest = self._latest, None
                await self._send(data)
                self.sent += 1
        except Exception:
            # 끊긴 구독자다. 세션이 failed 를 보고 목록에서 뺀다.
            self.failed = True
            self._latest = None
        finally:
            self._busy = False

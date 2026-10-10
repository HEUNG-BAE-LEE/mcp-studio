"""화면 중계: 좌표 환산·최신 프레임만 보내기는 순수 시험, 클릭·한글 입력은 실제 브라우저로 시험한다."""
import asyncio
import os

import pytest

from app.ieum.discovery.browser import capabilities
from app.ieum.recorder import relay

browser_needed = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


def test_줄여_보인_좌표를_브라우저_좌표로_바꾼다():
    assert relay.to_page(480, 300, 960, 600) == (640.0, 400.0)
    assert relay.to_page(2000, -5, 960, 600) == (relay.VIEW_W - 1, 0.0)
    assert relay.to_page(10, 10, 0, 0) == (relay.VIEW_W - 1, relay.VIEW_H - 1)


def test_느린_구독자에게는_최신_프레임만_간다():
    got = []

    async def slow_send(data):
        await asyncio.sleep(0.05)
        got.append(data)

    async def go():
        s = relay.LatestSender(slow_send)
        for i in range(20):
            s.offer(str(i))
            await asyncio.sleep(0.005)
        await asyncio.sleep(0.3)
        return s
    s = asyncio.new_event_loop().run_until_complete(go())
    assert got[-1] == "19" and len(got) < 20 and s.dropped == 20 - len(got)


def test_보내기가_실패하면_표시하고_이후_프레임은_받지_않는다():
    calls = []

    async def broken_send(data):
        calls.append(data)
        raise RuntimeError("구독자 끊김")

    async def go():
        s = relay.LatestSender(broken_send)
        s.offer("a")
        await asyncio.sleep(0.05)
        s.offer("b")
        s.offer("c")
        await asyncio.sleep(0.05)
        return s
    s = asyncio.new_event_loop().run_until_complete(go())
    assert s.failed is True
    assert calls == ["a"]


@browser_needed
def test_클릭과_한글_입력이_진짜_입력으로_들어간다():
    from playwright.async_api import async_playwright

    from app.ieum.discovery.browser import launch_async

    async def go():
        async with async_playwright() as pw:
            browser, _ = await launch_async(pw)
            ctx = await browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H})
            page = await ctx.new_page()
            await page.set_content('<input id="q" style="position:absolute;left:100px;top:100px;width:200px;height:30px">'
                                   '<script>window.got=[];document.addEventListener("click",e=>got.push(e.isTrusted))</script>')
            cdp = await ctx.new_cdp_session(page)
            frames = []
            await relay.start_screencast(cdp, lambda data: frames.append(len(data)))
            await relay.click(cdp, 200, 115)
            await relay.insert_text(cdp, "한빛")
            await relay.key(cdp, "Backspace")
            await page.wait_for_timeout(300)
            value, trusted = await page.input_value("#q"), await page.evaluate("window.got")
            await relay.stop_screencast(cdp)
            await browser.close()
            return value, trusted, len(frames)
    value, trusted, n = asyncio.new_event_loop().run_until_complete(go())
    assert value == "한" and trusted == [True] and n > 0

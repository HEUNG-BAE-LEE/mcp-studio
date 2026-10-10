# apps/backend/tests/test_ieum_recorder_trace.py
"""행동 묶음 기록: 실제 화면 없는 브라우저로 작은 페이지를 열어 클릭 → 요청 → 화면 변화를 묶는다."""
import asyncio
import os

import pytest

from app.ieum.discovery.browser import capabilities
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")

PAGE = """<title>발주 현황</title><h1>발주 현황</h1><input type="hidden" name="_csrf" value="tok-1">
<input id="tel" aria-label="연락처">
<button id="btnSearch" style="position:absolute;left:10px;top:120px;width:80px;height:30px">조회</button>
<table id="t"></table>
<script>
document.getElementById('btnSearch').onclick = async () => {
  const tel = document.getElementById('tel').value;
  const r = await fetch('/po/poList.do?tel=' + tel, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
  const d = await r.json();
  document.getElementById('t').innerHTML = d.resultList.map(x => '<tr><td>' + x.PO_NO + '</td><td>' + x.TEL + '</td></tr>').join('');
};
</script>"""
RES = '{"resultList":[{"PO_NO":"PO-2609-0142","TEL":"010-4821-5678"}]}'
SSR = ('<table><tr><th>거래처코드</th><th>거래처명</th></tr><tr><td><a href="vendDetail.do?vendCd=V0012">V0012</a></td>'
       '<td>한빛상사</td></tr></table>')


def _record(ieum_state, steps):
    rec = store.new_recording("t", "홍길동", "http://rec.test/po", "", "op", "manual", "")
    store.save_recording(rec)
    sent = []

    async def notify(msg):
        sent.append(msg)

    async def go():
        from playwright.async_api import async_playwright

        from app.ieum.discovery.browser import launch_async
        async with async_playwright() as pw:
            browser, _ = await launch_async(pw)
            ctx = await browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H})
            policy = Policy(base="http://rec.test/po")
            guard = Guard(policy, "op", notify)
            tr = Trace(rec["id"], policy, guard, notify)
            await ctx.expose_binding("__ieumRec", tr.on_dom_event)
            await ctx.add_init_script(INIT_JS)
            ctx.on("request", tr.on_request)
            ctx.on("requestfinished", tr.on_request_done)
            ctx.on("requestfailed", tr.on_request_done)
            ctx.on("response", tr.on_response)

            async def fake(route):
                u = route.request.url
                if u.endswith("/po/list.html"):
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=PAGE)
                elif "/po/vendSearch.do" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=SSR)
                else:
                    await route.fulfill(status=200, content_type="application/json", body=RES)
            await ctx.route("http://rec.test/**", fake)
            page = await ctx.new_page()
            await page.goto("http://rec.test/po/list.html")
            cdp = await ctx.new_cdp_session(page)
            await steps(page, cdp, tr)
            await tr.finish(page)
            await browser.close()
            return tr
    tr = asyncio.new_event_loop().run_until_complete(go())
    return rec, sent, tr


def test_클릭과_요청과_화면_변화를_한_묶음으로_저장하고_개인정보는_가린다(ieum_state):
    async def steps(page, cdp, tr):
        await page.fill("#tel", "010-4821-5678")
        await tr.begin(page, "click")
        await relay.click(cdp, 50, 135)
        await page.wait_for_timeout(500)
    rec, sent, tr = _record(ieum_state, steps)
    span = store.read_spans(rec["id"])[0]
    assert span["action"]["target"]["id"] == "btnSearch" and span["action"]["isTrusted"] is True
    assert span["pre"]["title"] == "발주 현황" and span["pre"]["hidden"] == {"_csrf": "tok-1"}
    assert "PO-2609-0142" in span["post"]["aria"] and "010-4821-5678" not in span["post"]["aria"]   # ARIA 도 마스킹한다
    net = span["network"][0]
    assert net["path"] == "/poList.do" and net["base"] == "http://rec.test/po" and net["primary"] is True
    assert "010-4821-5678" not in net["url"] and "010-4821-5678" not in net["res"]
    assert "010-4821-5678" in tr.raw.values()                     # 원값은 메모리 지도에만 있다
    assert (store.rec_dir(rec["id"]) / "1-pre.jpg").exists() and any(m["t"] == "span" for m in sent)


def test_서버가_그린_화면_응답도_기록하고_표를_바꾼다(ieum_state):
    async def steps(page, cdp, tr):
        await tr.begin(page, "click")
        await page.goto("http://rec.test/po/vendSearch.do?vendNm=x")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps)
    net = [n for s in store.read_spans(rec["id"]) for n in s["network"] if n["path"] == "/vendSearch.do"][0]
    assert net["rtype"] == "document" and net["data"]["tables"][0]["rows"][0]["거래처코드"] == "V0012"


def test_일시정지_중에는_묶음을_만들지_않는다(ieum_state):
    rec = store.new_recording("t", "", "http://rec.test/po", "", "op", "manual", "")
    store.save_recording(rec)

    async def notify(msg):
        pass
    p = Policy(base="http://rec.test/po")
    tr = Trace(rec["id"], p, Guard(p, "op", notify), notify)
    tr.paused = True
    assert asyncio.new_event_loop().run_until_complete(tr.begin(None, "click")) is None

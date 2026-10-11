# apps/backend/tests/test_ieum_recorder_trace.py
"""행동 묶음 기록: 실제 화면 없는 브라우저로 작은 페이지를 열어 클릭 → 요청 → 화면 변화를 묶는다."""
import asyncio
import json
import os

import pytest

from app.ieum.discovery.browser import capabilities
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")

PAGE = """<title>발주 현황</title><h1>발주 현황</h1><input type="hidden" name="_csrf" value="tok-1"><input type="hidden" name="accessToken" value="abc123">
<input id="tel" aria-label="연락처">
<button id="btnSearch" style="position:absolute;left:10px;top:120px;width:80px;height:30px">조회</button>
<button id="btnSlow" style="position:absolute;left:110px;top:120px;width:80px;height:30px">느린조회</button>
<table id="t"></table>
<script>
document.getElementById('btnSlow').onclick = async () => { const r = await fetch('/po/slowList.do'); await r.text(); };
document.getElementById('btnSearch').onclick = async () => {
  const tel = document.getElementById('tel').value;
  const r = await fetch('/po/poList.do?tel=' + tel, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
  const d = await r.json();
  document.getElementById('t').innerHTML = d.resultList.map(x => '<tr><td>' + x.PO_NO + '</td><td>' + x.TEL + '</td></tr>').join('');
};
</script>"""
ENTER_PAGE = """<title>검색</title><form action="vendSearch.do" method="get"><input id="vendNm" name="vendNm" aria-label="거래처명">
<input id="pwd" name="pwd" type="password" aria-label="비밀번호"><input id="note" name="note" type="text"><button type="submit">검색</button></form>"""
SECRETS_PAGE = """<title>비밀</title><input id="a" type="password" aria-label="암호A"><input id="b" type="password" aria-label="암호B">
<input id="c" type="text" name="pin" aria-label="핀"><input id="d" type="text" name="otp" aria-label="일회용"><input id="e" type="text" autocomplete="one-time-code" aria-label="코드">
<input id="n" type="text" aria-label="이름"><div id="host"></div>
<script>const r = document.getElementById('host').attachShadow({mode: 'open'});
r.innerHTML = '<input id="sh" type="password" aria-label="섀도암호">';</script>"""
TABLEPW_PAGE = """<title>표</title><table><tr><th><label for="u">아이디</label></th><td><input id="u" type="text"></td></tr>
<tr><th><label for="pw">비밀번호</label></th><td><input id="pw" type="password"></td></tr>
<tr><th>인증</th><td><input id="lab" type="text" aria-label="인증번호 입력"></td></tr></table>
<div role="row" id="rr"><div role="cell"><input id="rc" type="password" aria-label="셀암호"></div></div><input id="n" aria-label="이름">"""
RES = '{"resultList":[{"PO_NO":"PO-2609-0142","TEL":"010-4821-5678"}]}'
SSR = ('<table><tr><th>거래처코드</th><th>거래처명</th></tr><tr><td><a href="vendDetail.do?vendCd=V0012">V0012</a></td>'
       '<td>한빛상사</td></tr></table>')


def _record(ieum_state, steps, start="list.html"):
    rec = store.new_recording("t", "홍길동", "http://rec.test/po", "", "op", "manual")
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
                if "/po/list.html" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=PAGE)
                elif "/po/slowList.do" in u:
                    await asyncio.sleep(0.3)
                    await route.fulfill(status=200, content_type="application/json", body='{"ok":1}')
                elif "/po/tablepw.html" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=TABLEPW_PAGE)
                elif "/po/secrets.html" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=SECRETS_PAGE)
                elif "/po/enter.html" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=ENTER_PAGE)
                elif "/po/vendSearch.do" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=SSR)
                else:
                    await route.fulfill(status=200, content_type="application/json", body=RES)
            await ctx.route("http://rec.test/**", fake)
            page = await ctx.new_page()
            await page.goto("http://rec.test/po/" + start)
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
    assert span["pre"]["title"] == "발주 현황" and span["pre"]["hidden"] == {"_csrf": "tok-1", "accessToken": "••••••••"}
    assert "PO-2609-0142" in span["post"]["aria"] and "010-4821-5678" not in span["post"]["aria"]   # ARIA 도 마스킹한다
    net = span["network"][0]
    assert net["path"] == "/poList.do" and net["base"] == "http://rec.test/po" and net["primary"] is True
    assert "010-4821-5678" not in net["url"] and "010-4821-5678" not in net["res"]
    assert "010-4821-5678" in tr.raw.values()                     # 원값은 메모리 지도에만 있다
    assert (store.rec_dir(rec["id"]) / "1-pre.jpg").exists() and any(m["t"] == "span" for m in sent)


def test_입력칸을_눌러도_입력_원값이_행동_대상에_남지_않는다(ieum_state):
    async def steps(page, cdp, tr):
        await page.fill("#tel", "010-4821-5678")
        await tr.begin(page, "click")
        await page.click("#tel")
        await page.wait_for_timeout(500)
    rec, sent, tr = _record(ieum_state, steps)
    span = store.read_spans(rec["id"])[0]
    assert span["action"]["target"]["id"] == "tel" and "010-4821-5678" not in str(span["action"])


def test_서버가_그린_화면_응답도_기록하고_표를_바꾼다(ieum_state):
    async def steps(page, cdp, tr):
        await tr.begin(page, "click")
        await page.goto("http://rec.test/po/vendSearch.do?vendNm=x")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps)
    net = [n for s in store.read_spans(rec["id"]) for n in s["network"] if n["path"] == "/vendSearch.do"][0]
    assert net["rtype"] == "document" and net["data"]["tables"][0]["rows"][0]["거래처코드"] == "V0012"


def test_일시정지_중에는_묶음을_만들지_않는다(ieum_state):
    rec = store.new_recording("t", "", "http://rec.test/po", "", "op", "manual")
    store.save_recording(rec)

    async def notify(msg):
        pass
    p = Policy(base="http://rec.test/po")
    tr = Trace(rec["id"], p, Guard(p, "op", notify), notify)
    tr.paused = True
    assert asyncio.new_event_loop().run_until_complete(tr.begin(None, "click")) is None


def test_주소_쿼리의_개인정보도_스냅샷_url에_남기지_않는다(ieum_state):
    async def steps(page, cdp, tr):
        await page.goto("http://rec.test/po/list.html?tel=010-4821-5678")
        await tr.begin(page, "click")
        await relay.click(cdp, 50, 135)
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps)
    span = store.read_spans(rec["id"])[0]
    for side in ("pre", "post"):
        assert "010-4821-5678" not in span[side]["url"] and "010-4821-5678" not in span[side]["href"]


def test_진정_대기_중에_도착한_응답도_묶음에_담긴다(ieum_state):
    async def steps(page, cdp, tr):
        await tr.begin(page, "click")
        await relay.click(cdp, 150, 135)
        await tr.finish(page)
    rec, sent, tr = _record(ieum_state, steps)
    span = store.read_spans(rec["id"])[0]
    assert any(n["path"] == "/slowList.do" for n in span["network"])


def _bare_trace():
    p = Policy(base="http://rec.test/po")

    async def notify(msg):
        pass
    return Trace("x", p, Guard(p, "op", notify), notify)


def test_json도_폼도_아닌_요청_본문은_본문_전체를_가린다():
    tr = _bare_trace()
    out = tr._post("<req><tel>010-4821-5678</tel></req>", "text/xml")
    assert "010-4821-5678" not in out and "5678" in out
    assert "010-4821-5678" not in tr._post("tel=010-4821-5678", "application/x-www-form-urlencoded")


def test_원값_지도는_입력칸_값만_담고_충돌하면_None이다():
    tr = _bare_trace()
    tr.current = {"action": {"target": None}, "fills": []}
    tr.on_dom_event(None, {"type": "change", "el": {"name": "tel"}, "value": "010-1111-5678"})
    assert tr.raw == {"***-****-5678": "010-1111-5678"}
    tr.on_dom_event(None, {"type": "change", "el": {"name": "tel2"}, "value": "010-2222-5678"})
    assert tr.raw["***-****-5678"] is None
    tr._url("http://h/po/x.do?tel=010-9999-0000")
    assert "***-****-0000" not in tr.raw                       # 주소 쿼리는 지도에 넣지 않는다


def test_비밀_이름의_입력칸은_숨기고_지도에_두지_않는다():
    tr = _bare_trace()
    tr.current = {"action": {"target": None}, "fills": []}
    tr.on_dom_event(None, {"type": "change", "el": {"name": "accessToken"}, "value": "abc123"})
    assert tr.current["fills"][0]["value"] == "••••••••" and not tr.raw


def test_쿼리를_다시_부호화해도_뜻이_같다():
    from urllib.parse import parse_qsl, urlsplit
    tr = _bare_trace()
    out = tr._url("http://h/po/x.do?q=a%26b+c")
    assert parse_qsl(urlsplit(out).query) == [("q", "a&b c")]


def test_평문_본문의_쌍도_가린다():
    tr = _bare_trace()
    for ct in ("text/plain;charset=UTF-8", ""):
        out = tr._post("userId=kim&userPw=s3cret", ct)
        assert "s3cret" not in out and "kim" in out


def test_soap_본문의_비밀_태그를_가린다():
    tr = _bare_trace()
    out = tr._post("<soap:Body><login><userId>kim</userId><password>s3cret</password></login></soap:Body>", "text/xml")
    assert "s3cret" not in out and "kim" in out


def test_같은_묶음을_두_번_닫지_않는다(ieum_state):
    async def steps(page, cdp, tr):
        await tr.begin(page, "click")
        await asyncio.gather(tr.finish(page), tr.finish(page))
    rec, sent, tr = _record(ieum_state, steps)
    assert len(store.read_spans(rec["id"])) == 1
    assert len([m for m in sent if m["t"] == "span"]) == 1


def test_잘린_표_본문은_조각난_값을_남기지_않는다():
    import re

    from app.ieum.discovery import capture
    row = "<tr><td>PO-0001</td><td>010-4821-5678</td></tr>"
    head = "<html><body><table><tr><th>번호</th><th>TEL</th></tr>"
    off = len("<tr><td>PO-0001</td><td>010-48")
    filler = (capture.MAX_BODY - off - len(head)) % len(row)
    c = filler if filler >= 7 else filler + len(row)
    body = head + "<!--" + "x" * (c - 7) + "-->" + row * 2000
    assert body[:capture.MAX_BODY].endswith("010-48")         # 경계가 전화번호 한가운데에 떨어진다

    class Req:
        resource_type, method, headers, post_data = "document", "GET", {}, None

    class Resp:
        url, status, headers, request = "http://rec.test/po/big.do", 200, {"content-type": "text/html; charset=utf-8"}, Req()

        async def text(self):
            return body

    tr = _bare_trace()
    tr.current = {"network": []}
    asyncio.new_event_loop().run_until_complete(tr.on_response(Resp()))
    data = tr.current["network"][0]["data"]
    tels = [r.get("TEL") for t in data["tables"] for r in t["rows"]]
    assert tels and all(re.match(r"^\*\*\*-\*\*\*\*-5678$", v) for v in tels), tels[-3:]


def _fake_trace():
    tr = _bare_trace()
    stored = []

    async def snap(page, seq, when):
        await asyncio.sleep(0.05)
        return {"url": "", "href": "", "title": "", "aria": "", "hidden": {}, "shot": None}

    async def settle():
        return None
    tr._snapshot, tr._settle = snap, settle
    import app.ieum.recorder.trace as mod
    return tr, stored, mod


def test_겹친_begin도_묶음을_잃지_않는다(monkeypatch):
    tr, stored, mod = _fake_trace()
    monkeypatch.setattr(mod.store, "append_span", lambda rid, span: stored.append(span["seq"]))

    async def go():
        await asyncio.gather(tr.begin(None, "click"), tr.begin(None, "click"))
        await tr.finish(None)
    asyncio.new_event_loop().run_until_complete(go())
    assert stored == [1, 2]


def test_스냅샷_중_finish가_와도_열린_묶음이_저장되고_이후_begin은_거절된다(monkeypatch):
    tr, stored, mod = _fake_trace()
    monkeypatch.setattr(mod.store, "append_span", lambda rid, span: stored.append(span["seq"]))

    async def go():
        b = asyncio.ensure_future(tr.begin(None, "click"))
        await asyncio.sleep(0.01)                       # begin 이 직전 스냅샷을 뜨는 중
        await tr.finish(None)
        await b
        return await tr.begin(None, "click")
    late = asyncio.new_event_loop().run_until_complete(go())
    assert tr.current is None and stored == [1] and late is None


def test_끝에_앰퍼샌드가_붙거나_연속인_본문도_쌍으로_가린다():
    tr = _bare_trace()
    assert "s3cret" not in tr._post("userPw=s3cret&", "text/plain")
    assert "s3cret" not in tr._post("a=1&&userPw=s3cret", "")


def test_cdata와_속성의_비밀도_가린다():
    tr = _bare_trace()
    out = tr._post("<login><password><![CDATA[s3cret]]></password><userId>kim</userId></login>", "text/xml")
    assert "s3cret" not in out and "kim" in out
    out = tr._post('<a auth_token="s3cret" name="kim"/>', "text/xml")
    assert "s3cret" not in out and "kim" in out


def test_Enter로_제출하면_묶음의_대상과_입력값이_기록된다(ieum_state):
    async def steps(page, cdp, tr):
        await page.fill("#vendNm", "한빛상사")
        await tr.begin(page, "key")
        await relay.key(cdp, "Enter")
        await page.wait_for_timeout(600)
    rec, sent, tr = _record(ieum_state, steps, "enter.html")
    span = store.read_spans(rec["id"])[0]
    assert span["action"]["type"] == "key" and (span["action"]["target"] or {}).get("id") == "vendNm"
    assert "한빛상사" not in str(span["action"])                      # 대상 글자는 입력값이 아니라 라벨이다
    vals = [f["value"] for f in span["fills"] if (f["target"] or {}).get("id") == "vendNm"]
    assert vals == ["한빛상사"]                                         # change 가 늦게 와도 중복되지 않는다
    assert span["network"] and span["network"][0]["path"] == "/vendSearch.do"


def test_비밀번호_칸에서_Enter를_눌러도_비밀번호는_어디에도_남지_않는다(ieum_state):
    async def steps(page, cdp, tr):
        await page.fill("#pwd", "Zx9-secret-pw")
        await tr.begin(page, "key")
        await relay.key(cdp, "Enter")
        await page.wait_for_timeout(600)
    rec, sent, tr = _record(ieum_state, steps, "enter.html")
    span = store.read_spans(rec["id"])[0]
    assert (span["action"]["target"] or {}).get("id") == "pwd"
    assert not [f for f in span["fills"] if (f["target"] or {}).get("id") == "pwd" and f["value"] not in ("", "••••••••")]
    blob = json.dumps(span, ensure_ascii=False) + json.dumps(tr.raw, ensure_ascii=False)
    for f in store.rec_dir(rec["id"]).iterdir():
        if f.suffix != ".jpg":
            blob += f.read_text(encoding="utf-8", errors="ignore")
    assert "Zx9-secret-pw" not in blob and "Zx9" not in blob


def test_key_이벤트는_대상이_비었을_때만_채우고_같은_값은_한_번만_넣는다():
    tr = _bare_trace()
    tr.current = {"seq": 1, "action": {"type": "key", "target": None, "isTrusted": None, "t": 0}, "fills": [], "network": []}
    el = {"tag": "INPUT", "id": "q", "name": "q", "role": "", "text": "검색어", "label": "검색어"}
    tr.on_dom_event(None, {"type": "key", "key": "Enter", "el": el, "value": "한빛", "isTrusted": True})
    tr.on_dom_event(None, {"type": "change", "el": el, "value": "한빛"})
    assert tr.current["action"]["target"]["id"] == "q" and tr.current["action"]["isTrusted"] is True
    assert [f["value"] for f in tr.current["fills"]] == ["한빛"]
    sec = {"tag": "INPUT", "id": "accessToken", "name": "accessToken", "text": "", "label": ""}
    tr.on_dom_event(None, {"type": "key", "key": "Enter", "el": sec, "value": "abc123"})
    assert tr.current["fills"][-1]["value"] == "••••••••" and "abc123" not in tr.raw.values()


def _secrets_steps(page_values):
    async def steps(page, cdp, tr):
        for sel, v in page_values:
            await page.fill(sel, v)
        await tr.begin(page, "click")
        await page.click("#n")
        await page.wait_for_timeout(300)
    return steps


def _all_saved(rec, tr):
    blob = json.dumps(tr.raw, ensure_ascii=False)
    for f in store.rec_dir(rec["id"]).iterdir():
        if f.suffix != ".jpg":
            blob += f.read_text(encoding="utf-8", errors="ignore")
    return blob


def test_비밀_입력칸의_값은_화면_구조_기록_어디에도_남지_않는다(ieum_state):
    vals = [("#a", "1234"), ("#b", "  ab  "), ("#c", "7788"), ("#d", "p9o9t9"), ("#e", "Q8w8e8"), ("#n", "홍길동")]
    async def steps(page, cdp, tr):
        await _secrets_steps(vals)(page, cdp, tr)
        await page.locator("#host").evaluate("h => { h.shadowRoot.getElementById('sh').value = 'shadowPw77'; }")
        await tr.begin(page, "click")
        await page.click("#n")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps, "secrets.html")
    blob = _all_saved(rec, tr)
    for v in ("1234", "7788", "p9o9t9", "Q8w8e8", "shadowPw77"):
        assert v not in blob, v
    assert '"ab"' not in blob and ": ab" not in blob
    assert "홍길동" in blob                                            # 비밀이 아닌 입력값은 남는다


def test_비밀_판정을_못_하면_모든_입력_줄의_값을_가린다(ieum_state, monkeypatch):
    async def boom(self, *a, **k):
        raise RuntimeError("evaluate 실패")
    from playwright.async_api import Frame
    orig = Frame.evaluate

    async def evaluate(self, expr, *a, **k):
        if "secretName" in expr:
            raise RuntimeError("evaluate 실패")
        return await orig(self, expr, *a, **k)
    monkeypatch.setattr(Frame, "evaluate", evaluate)
    rec, sent, tr = _record(ieum_state, _secrets_steps([("#a", "1234"), ("#n", "홍길동")]), "secrets.html")
    blob = _all_saved(rec, tr)
    assert "1234" not in blob and "홍길동" not in json.dumps([s["pre"]["aria"] + s["post"]["aria"] for s in store.read_spans(rec["id"])], ensure_ascii=False)


def test_입력_줄_가리기는_따옴표_값과_짧은_값도_다룬다():
    from app.ieum.recorder.trace import mask_input_lines
    text = '- textbox "암호": "1234"\n- textbox "기타": ab\n- textbox "이름": 홍길동\n- button "확인"'
    out = mask_input_lines(text, [{"names": ["암호"], "value": "1234"}, {"names": [], "value": "  ab "}])
    assert "1234" not in out and ": ab" not in out and "홍길동" in out and '- button "확인"' in out
    assert "홍길동" not in mask_input_lines(text, None) and '- button "확인"' in mask_input_lines(text, None)


def _demo_login_html():
    from app.ieum.demo_legacy.pages import login_page
    return login_page("op")


def test_표_행과_칸_이름에_실린_비밀번호도_가린다(ieum_state):
    vals = [("#u", "kim"), ("#pw", "ab12"), ("#lab", "993311"), ("#rc", "zz")]
    async def steps(page, cdp, tr):
        for sel, v in vals:
            await page.fill(sel, v)
        await tr.begin(page, "click")
        await page.click("#n")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps, "tablepw.html")
    spans = store.read_spans(rec["id"])
    aria = " ".join(s["pre"]["aria"] + s["post"]["aria"] for s in spans)
    blob = _all_saved(rec, tr)
    assert "ab12" not in blob and "993311" not in blob and '"zz' not in aria and "zz\"" not in aria and ": zz" not in aria
    assert "kim" in aria                                               # 비밀이 아닌 값은 남는다


def test_시연_로그인_화면에서_비밀번호가_화면_구조_어디에도_남지_않는다(ieum_state):
    html = _demo_login_html()
    async def steps(page, cdp, tr):
        await page.set_content(html)
        await page.fill("#userPw", "Demo!2026")
        await tr.begin(page, "click")
        await page.click("#userId")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps)
    assert "Demo!2026" not in _all_saved(rec, tr)


def test_판정을_못_하면_행과_칸_이름도_가린다(ieum_state, monkeypatch):
    from playwright.async_api import Frame
    orig = Frame.evaluate

    async def evaluate(self, expr, *a, **k):
        if "secretName" in expr:
            raise RuntimeError("실패")
        return await orig(self, expr, *a, **k)
    monkeypatch.setattr(Frame, "evaluate", evaluate)
    async def steps(page, cdp, tr):
        await page.fill("#pw", "ab12")
        await tr.begin(page, "click")
        await page.click("#n")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps, "tablepw.html")
    assert "ab12" not in _all_saved(rec, tr)


def test_pin_otp는_레코더_안에서만_좁게_비밀로_본다():
    from app.ieum.discovery.masking import is_secret_key
    from app.ieum.recorder.trace import recorder_secret_name
    for n in ("pin", "pinNo", "otpCode", "userPin"):
        assert recorder_secret_name(n), n
    for n in ("otpYn", "pinYn", "mapPin", "vendNm"):
        assert not recorder_secret_name(n), n
    assert not is_secret_key("pin") and not is_secret_key("otpCode")      # 공용 규칙은 그대로다


def test_접근_이름에_비밀_낱말이_있으면_이름이_무엇이든_비밀이다(ieum_state):
    async def steps(page, cdp, tr):
        await page.fill("#lab", "55667788")
        await tr.begin(page, "click")
        await page.click("#n")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps, "tablepw.html")
    assert "55667788" not in _all_saved(rec, tr)

# apps/backend/tests/test_ieum_recorder_listlinks.py
"""설계 4판: 표가 아닌 목록(카드·li 나열·onclick)에서 누른 링크 기준으로 다음 단계 주소 값을 잇는다.

외부 사이트에 접속하지 않는다. 화면은 문자열 HTML 이고, 재실행은 시험 안의 작은 http.server 로 보낸다.
"""
import asyncio
import http.server
import json
import threading

import pytest

from app.ieum.recorder import analyze, htmltable, replay

REC = {"id": "rec_00000010", "name": "목록에서 상세 보기", "owner": "홍길동", "sourceBase": "http://h:8080", "env": "op", "readPost": "",
       "login": {}, "approvals": []}

# 필터 메뉴(li 반복, 링크 있음)와 결과 카드(div.item 반복)가 함께 있는 화면
CARDS = """<html><body>
<ul class="filter"><li class="opt"><a href="/list.do?type=file">파일데이터</a></li><li class="opt"><a href="/list.do?type=api">오픈API</a></li></ul>
<div class="result">
 <div class="item"><p class="title"><a href="/data/{a}/fileData.do">서울특별시_시간별 대기</a></p><p class="desc">대기 측정 자료</p></div>
 <div class="item"><p class="title"><a href="/data/{b}/fileData.do">부산광역시_버스 노선</a></p><p class="desc">노선 정보</p></div>
 <div class="item"><p class="title"><a href="/data/{c}/fileData.do">대구광역시_공원 현황</a></p><p class="desc">공원 목록</p></div>
</div>
<a href="#">맨 위로</a><a href="javascript:void(0)">닫기</a>
</body></html>"""

# li 나열 + 링크마다 통계용 onclick, 상세는 onclick 인자 하나로만 연다
LIS = """<html><body>
<ul class="menu"><li><a href="javascript:;" onclick="setTab('news', 'all')">뉴스</a></li><li><a href="javascript:;" onclick="setTab('blog', 'all')">블로그</a></li></ul>
<ul class="c-list">
 <li><strong>서울특별시_시간별 대기</strong><a href="javascript:;" onclick="goView('15000001'); return false;">보기</a></li>
 <li><strong>부산광역시_버스 노선</strong><a href="javascript:;" onclick="goView('15000002'); return false;">보기</a></li>
 <li><strong>대구광역시_공원 현황</strong><a href="javascript:;" onclick="goView('15000003'); return false;">보기</a></li>
</ul></body></html>"""

TABLE = """<table class="list"><tr><th>제목</th><th>기관</th></tr>
<tr><td><a href="/data/15000001/fileData.do">서울특별시_시간별 대기</a></td><td>서울</td></tr>
<tr><td><a href="/data/15000002/fileData.do">부산광역시_버스 노선</a></td><td>부산</td></tr>
<tr><td><a href="/data/15000003/fileData.do">대구광역시_공원 현황</a></td><td>대구</td></tr></table>"""

NAVER = """<html><body><div class="sds-comps-base">
 <div class="kx92Jd"><a class="q8xZ_" href="https://n.news.naver.com/mnews/article/052/0002416854" data-heatmap-target=".tit">첫 기사 제목</a><span>연합</span></div>
 <div class="kx92Jd"><a class="q8xZ_" href="https://n.news.naver.com/mnews/article/052/0002416855" data-heatmap-target=".tit">둘째 기사 제목</a><span>연합</span></div>
 <div class="kx92Jd"><a class="q8xZ_" href="https://n.news.naver.com/mnews/article/021/0000101010" data-heatmap-target=".tit">셋째 기사 제목</a><span>문화</span></div>
</div></body></html>"""

DETAIL = "<html><body><h2>부산광역시_버스 노선</h2><p>노선별 정류장 자료</p></body></html>"


def _cards(a="15000001", b="15000002", c="15000003"):
    return CARDS.replace("{a}", a).replace("{b}", b).replace("{c}", c)


# ── htmltable: 주소 후보 links ─────────────────────────────────────────────
def test_카드형_화면은_주소_후보를_문서_순서로_모으고_행_글자는_카드다():
    d = htmltable.to_data(_cards())
    assert d is not None and d["tables"] == []
    vs = [x["v"] for x in htmltable.links_of(d)]
    assert vs == ["/list.do?type=file", "/list.do?type=api", "/data/15000001/fileData.do", "/data/15000002/fileData.do", "/data/15000003/fileData.do"]
    rows = {x["v"]: x["row"] for x in htmltable.links_of(d)}
    assert rows["/data/15000002/fileData.do"] == "부산광역시_버스 노선 노선 정보"          # 누른 링크에서 위로: 반복되는 div.item
    assert rows["/list.do?type=api"] == "오픈API"                                       # 필터 링크는 자기 li 가 행이다(결과 카드와 섞이지 않는다)


def test_li_나열과_onclick_인자를_후보로_모은다():
    d = htmltable.to_data(LIS)
    vs = [x["v"] for x in htmltable.links_of(d)]
    assert vs == ["news", "all", "blog", "all", "15000001", "15000002", "15000003"]                # javascript:; 는 빈 값이라 뺀다
    row = next(x["row"] for x in htmltable.links_of(d) if x["v"] == "15000002")
    assert row == "부산광역시_버스 노선 보기"


def test_표_화면은_기존_동작_그대로이고_후보도_모은다():
    d = htmltable.to_data(TABLE)
    assert d["tables"][0]["columns"] == ["제목", "기관"] and d["tables"][0]["rows"][1]["_links"] == ["/data/15000002/fileData.do"]
    row = next(x["row"] for x in htmltable.links_of(d) if x["v"] == "/data/15000002/fileData.do")
    assert row == "부산광역시_버스 노선 부산"                                            # 칸이 아니라 행(tr)


def test_data_속성과_form_action_도_후보이고_상한을_지킨다():
    html = ('<form action="/search.do"><input name="q"></form><div data-id="A-77" data-x="">x</div>'
            + f'<a href="/{"y" * 400}">긴 주소</a>' + "".join(f'<p><a href="/v/{i}">{i}</a></p>' for i in range(700)))
    d = htmltable.to_data(html)
    vs = [x["v"] for x in htmltable.links_of(d)]
    assert vs[:3] == ["/search.do", "A-77", "/v/0"] and len(vs) == 2 + htmltable.MAX_LINKS_PER_GROUP and all(len(v) <= htmltable.MAX_LINK_LEN for v in vs)


def test_표도_후보도_없으면_여전히_None():
    assert htmltable.to_data("<div>안녕하세요</div><a href='#'>위로</a>") is None


# ── analyze: 틀 맞추기 연결 ─────────────────────────────────────────────────
def _net(method, url, res="", data=None, rtype="document"):
    from urllib.parse import urlsplit
    p = urlsplit(url)
    origin = f"{p.scheme}://{p.netloc}"
    return {"method": method, "url": url, "origin": origin, "base": origin, "path": p.path, "status": 200, "ctype": "text/html", "charset": None,
            "rtype": rtype, "headers": {}, "post": None, "res": res, "data": data, "file": False, "held": False, "decision": "", "primary": True, "t": 0}


def _span(seq, text, network, aria):
    return {"seq": seq, "action": {"type": "click", "target": {"tag": "A", "text": text}, "isTrusted": True, "t": seq}, "fills": [],
            "pre": {"url": "/x", "href": "http://h:8080/x", "title": "목록", "aria": "", "hidden": {}, "shot": None},
            "network": network, "post": {"url": "/x", "href": "http://h:8080/x", "title": "목록", "aria": aria, "hidden": {}, "shot": None}}


def _record(list_html, detail_url, base="http://h:8080", list_res=None):
    res = list_res if list_res is not None else list_html
    data = htmltable.to_data(list_html) if list_res is None else None
    return [
        _span(1, "검색", [_net("GET", base + "/list.do?q=bus", res, data, rtype="document" if list_res is None else "xhr")],
              "- text: 서울특별시_시간별 대기 부산광역시_버스 노선 첫 기사 제목"),
        _span(2, "부산광역시_버스 노선", [_net("GET", detail_url, DETAIL)], "- heading: 부산광역시_버스 노선\n- text: 노선별 정류장 자료"),
    ]


@pytest.mark.parametrize("html", [_cards(), LIS, TABLE], ids=["카드", "li_onclick", "표"])
def test_두번째_카드를_눌러_연_상세_주소의_자리를_앞_단계_후보_k1_로_잇는다(html):
    bf = analyze.analyze(REC, _record(html, "http://h:8080/data/15000002/fileData.do"))
    s1, s2 = bf["steps"]
    assert s2["path"] == "/data/{id}/fileData.do"
    p = next(p for p in s2["params"] if p["loc"] == "path")
    assert p["a"] == "id" and p["source"] == "PREVIOUS_STEP_OUTPUT" and p["ex"] == "15000002"
    head, expr = p["from"].split(".", 1)
    assert head == "s1" and s1["outputs"][expr] == expr
    assert analyze.get_path(htmltable.to_data(html), expr) == "15000002"
    assert s2["pickedIndex"] == 1 and s2["pickedRow"].startswith("부산광역시_버스 노선")
    assert p["confidence"] == "mid"                                                       # 후보가 여럿이라 순번에 기댄다


def test_카드형_출처_문법():
    bf = analyze.analyze(REC, _record(_cards(), "http://h:8080/data/15000002/fileData.do"))
    p = next(p for p in bf["steps"][1]["params"] if p["loc"] == "path")
    assert p["from"] == "s1.links[/data/{id}/fileData.do@div.result>div.item][1.0/1].id"


def test_다른_출처_절대주소_링크도_잇는다():
    bf = analyze.analyze(REC, _record(NAVER, "https://n.news.naver.com/mnews/article/052/0002416855", base="https://search.naver.com"))
    s1, s2 = bf["steps"]
    assert s2["base"] == "https://n.news.naver.com" and s2["path"] == "/mnews/article/{id}/{id2}"
    ps = {p["a"]: p for p in s2["params"] if p["loc"] == "path"}
    assert ps["id"]["from"] == "s1.links[/mnews/article/{id}/{id2}@div.sds-comps-base>div.kxJd][1.0/1].id"
    assert ps["id2"]["from"] == "s1.links[/mnews/article/{id}/{id2}@div.sds-comps-base>div.kxJd][1.0/1].id2"
    assert s2["pickedIndex"] == 1 and s2["pickedRow"].startswith("둘째 기사 제목")


def test_JSON_문자열_값도_주소_후보다():
    res = json.dumps({"items": [{"title": "가", "url": "/data/15000001/fileData.do"}, {"title": "나", "url": "/data/15000002/fileData.do"}]}, ensure_ascii=False)
    bf = analyze.analyze(REC, _record("", "http://h:8080/data/15000002/fileData.do", list_res=res))
    p = next(p for p in bf["steps"][1]["params"] if p["loc"] == "path")
    assert p["from"] == "s1.links[/data/{id}/fileData.do][1].id"
    assert analyze.get_path(json.loads(res), "links[/data/{id}/fileData.do][1].id") == "15000002"


def test_쿼리_값이_onclick_인자에만_있으면_후보_순번으로_잇는다():
    bf = analyze.analyze(REC, _record(LIS, "http://h:8080/lsInfoP.do?lsiSeq=15000002"))
    p = next(p for p in bf["steps"][1]["params"] if p["a"] == "lsiSeq")
    assert p["source"] == "PREVIOUS_STEP_OUTPUT" and p["from"] == "s1.links[{lsiSeq:d}@ul.c-list>li][1.0/1].lsiSeq"
    assert bf["steps"][1]["pickedIndex"] == 1


def test_쿼리_값은_같은_주소를_가리키는_링크의_쿼리에서_잇는다():
    html = "".join(f'<li><a href="/news/view.do?articleId={i}&amp;from=list">기사 {i}</a></li>' for i in (7001, 7002, 7003))
    bf = analyze.analyze(REC, _record(f"<ul>{html}</ul>", "http://h:8080/news/view.do?articleId=7002"))
    p = next(p for p in bf["steps"][1]["params"] if p["a"] == "articleId")
    assert p["from"] == "s1.links[/news/view.do?articleId={articleId}@ul>li][1.0/1].articleId" and p["confidence"] == "low"   # 짧은 숫자 하나뿐


def test_후보가_하나뿐이면_확신도_high():
    html = '<div><a href="/data/15000002/fileData.do">부산광역시_버스 노선</a></div>'
    p = next(p for p in analyze.analyze(REC, _record(html, "http://h:8080/data/15000002/fileData.do"))["steps"][1]["params"] if p["loc"] == "path")
    assert p["confidence"] == "high"


def test_JSON_목록은_기존_JSON_경로_연결이_먼저다():
    res = json.dumps({"list": [{"bidNo": "R26BK00001"}, {"bidNo": "R26BK00002"}]})
    bf = analyze.analyze(REC, _record("", "http://h:8080/bidDetail.do?bidNo=R26BK00002", list_res=res))
    s1, s2 = bf["steps"]
    p = next(p for p in s2["params"] if p["a"] == "bidNo")
    assert p["from"] == "s1.bidNo" and s1["outputs"]["bidNo"] == "$.list[1].bidNo"
    assert "pickedIndex" not in s2


def test_후보가_없으면_경로_자리는_여전히_채우지_못한다():
    bf = analyze.analyze(REC, _record("<ul><li><a href='/x.do'>x</a></li></ul>", "http://h:8080/data/15000002/fileData.do"))
    assert not any(p["loc"] == "path" for st in bf["steps"] for p in st["params"])


def test_후보_목록은_화면_표시_판정과_출력_필드에_쓰지_않는다():
    bf = analyze.analyze(REC, _record(_cards(), "http://h:8080/data/15000002/fileData.do"))
    assert not any(f.startswith("$.links") for f in bf["output"]["fields"])


# ── replay: 같은 순번의 새 값으로 경로를 채운다 ────────────────────────────
class _Site:
    def __init__(self, ids):
        self.ids, self.hits = ids, []

    def handler(self):
        site = self

        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                site.hits.append(self.path)
                if self.path.startswith("/list.do"):
                    body = _cards(*site.ids) if len(site.ids) == 3 else \
                        '<div class="result"><div class="item"><a href="/data/%s/fileData.do">하나</a></div></div>' % site.ids[0]
                else:
                    body = DETAIL
                b = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def log_message(self, *a):
                pass
        return H


@pytest.fixture
def site():
    s = _Site(["900", "901", "902"])
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), s.handler())
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    s.base = f"http://127.0.0.1:{srv.server_address[1]}"
    yield s
    srv.shutdown()


async def _no(step):
    return False


def _bf_for(base):
    rec = dict(REC, sourceBase=base)
    return analyze.analyze(rec, _record(_cards(), base + "/data/15000002/fileData.do", base=base))


def _replay(bf, base):
    t = replay.HttpTransport({}, host="127.0.0.1")
    return asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, t, None, _no, 0))


def test_재실행은_새_목록의_같은_순번_값으로_경로를_채운다(site):
    site.ids = ["902", "900", "901"]                                         # 순서가 바뀐 목록. 두 번째 카드는 900
    bf = _bf_for(site.base)
    run = _replay(bf, site.base)
    assert run["ok"], run
    assert site.hits[-1] == "/data/900/fileData.do"


def test_후보가_모자라면_chain_broken_이고_상세는_보내지_않는다(site):
    site.ids = ["900"]
    bf = _bf_for(site.base)
    run = _replay(bf, site.base)
    assert not run["ok"] and run["reason"] == "chain_broken"
    assert not any(h.startswith("/data/") for h in site.hits)


def test_비밀_이름의_data_속성은_후보로_남기지_않는다():
    d = htmltable.to_data('<div data-csrf="c5rf-77" data-auth-token="tk-1" data-password="pw" data-id="A-77">x</div>')
    assert [x["v"] for x in htmltable.links_of(d)] == ["A-77"]


def test_숫자_없는_고정값과_구분_파라미터는_후보로_잇지_않는다():
    """메뉴 onclick 의 'news'·필터 링크의 cmd 값처럼 우연히 겹친 고정값을 앞 단계 출력으로 바꾸지 않는다."""
    html = LIS + '<a href="/board.do?cmd=view&amp;seq=10001">글</a><a href="/board.do?cmd=list">목록</a>'
    bf = analyze.analyze(REC, _record(html, "http://h:8080/board.do?cmd=view&tab=news&seq=10001"))
    ps = {p["a"]: p for p in bf["steps"][1]["params"]}
    assert ps["tab"]["source"] == "CONSTANT" and ps["cmd"]["source"] == "CONSTANT"
    assert ps["seq"]["from"] == "s1.links[/board.do?seq={seq}][0].seq"



# ── 수정 1차 ───────────────────────────────────────────────────────────────
RANKED = """<html><body>
<ol class="rank">{rank}</ol>
<div class="list">{items}</div>
<ul class="menu"><li><a href="javascript:;" onclick="fnMenu('101')">메뉴1</a></li><li><a href="javascript:;" onclick="fnMenu('102')">메뉴2</a></li></ul>
</body></html>"""


def _ranked(rank_ids, item_ids):
    rank = "".join(f'<li><a href="https://n.news.naver.com/mnews/article/001/{i}">많이 본 {i}</a></li>' for i in rank_ids)
    items = "".join(f'<div class="item"><a href="https://n.news.naver.com/mnews/article/052/{i}">결과 {i}</a><span>연합</span></div>' for i in item_ids)
    return RANKED.format(rank=rank, items=items)


def _ranked_record(base, html):
    return _record(html, "https://n.news.naver.com/mnews/article/052/0000000012", base=base)


def test_같은_틀의_랭킹_링크가_앞에_있어도_순번은_누른_결과_목록_안에서_센다():
    bf = analyze.analyze(REC, _ranked_record("http://h:8080", _ranked(["0000000001", "0000000002", "0000000003"], ["0000000011", "0000000012", "0000000013"])))
    s2 = bf["steps"][1]
    p = next(p for p in s2["params"] if p["a"] == "id2")
    assert p["from"] == "s1.links[/mnews/article/{id}/{id2}@div.list>div.item][1.0/1].id2"
    assert s2["pickedIndex"] == 1 and s2["pickedRow"].startswith("결과 0000000012")
    # 랭킹이 둘로 줄어든 새 화면에서도 결과 목록의 두 번째를 고른다
    expr = p["from"].split(".", 1)[1]
    new = htmltable.to_data(_ranked(["0000000005", "0000000006"], ["0000000021", "0000000022", "0000000023"]))
    assert analyze.get_path(new, expr) == "0000000022"


def test_값_모양_틀도_메뉴_인자는_세지_않는다():
    html = LIS.replace('<ul class="menu">', '<ul class="menu"><li><a href="javascript:;" onclick="fnMenu(\'101\')">메뉴</a></li>')
    bf = analyze.analyze(REC, _record(html, "http://h:8080/data/15000002/fileData.do"))
    p = next(p for p in bf["steps"][1]["params"] if p["loc"] == "path")
    assert p["from"] == "s1.links[{id:d}@ul.c-list>li][1.0/1].id"
    fewer = htmltable.to_data(LIS)                                            # 메뉴 숫자 인자가 없는 화면
    assert analyze.get_path(fewer, p["from"].split(".", 1)[1]) == "15000002"


def test_경로_자리는_식별자_모양만_맞추고_메뉴_주소와_점_조각은_거른다():
    html = ('<div><a href="/about">소개</a><a href="/notice">공지</a><a href="/data/../fileData.do">이상</a>'
            '<a href="/data/./fileData.do">이상</a><a href="/15000002">상세</a><a href="/data/15000002/fileData.do">상세</a></div>')
    d = htmltable.to_data(html)
    assert [v["id"] for v, _, _ in analyze.template_matches("/{id}", d)] == ["15000002"]
    assert [v["id"] for v, _, _ in analyze.template_matches("/data/{id}/fileData.do", d)] == ["15000002"]
    assert [v["id"] for v, _, _ in analyze.template_matches("/data/{id:w}/fileData.do", d)] == ["15000002"]


def test_재실행은_점_조각_경로_값을_보내지_않는다(site):
    bf = _bf_for(site.base)
    bf["steps"][1]["params"] = [{"a": "id", "loc": "path", "from": "input.id", "ex": ".."}]
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(bf, {"id": ".."}, {}, replay.HttpTransport({}, host="127.0.0.1"), None, _no, 0))
    assert not run["ok"] and not any(h.startswith("/data/") or h.startswith("/fileData") for h in site.hits)


def test_후보_주소의_비밀은_가려서_저장한다():
    from app.ieum.recorder import trace as trace_mod
    html = ('<div><a href="/a.do?token=abc123&amp;x=1">a</a><a href="/logout?sid=SECRET123">b</a>'
            '<a href="/view.do;jsessionid=JS999?seq=12345">c</a><span data-auth="Bearer zzz9" data-api-key="K9/1" data-sig="s1g/2">d</span></div>')
    d = htmltable.to_data(html)
    vs = [x["v"] for x in htmltable.links_of(d)]
    assert "/view.do?seq=12345" in vs and not any("JS999" in v or "zzz9" in v or "K9" in v or "s1g" in v for v in vs)
    tr = trace_mod.Trace.__new__(trace_mod.Trace)
    from app.ieum.discovery.masking import Masker
    tr.masker = Masker(pii=True)
    saved = [x["v"] for x in htmltable.links_of(tr._mask_copy(d))]
    assert not any("abc123" in v or "SECRET123" in v for v in saved), saved


def test_단계의_기록_사본에는_주소_후보를_두지_않는다():
    bf = analyze.analyze(REC, _record(_cards(), "http://h:8080/data/15000002/fileData.do"))
    rd = bf["steps"][0]["recordedData"]
    assert rd is not None and "links" not in rd and "linkRows" not in rd


def test_행_글자는_한_번만_저장하고_링크는_번호로_가리킨다():
    d = htmltable.to_data(TABLE)
    assert len(d["linkRows"]) == 3 and all(set(x) <= {"v", "r"} for x in d["links"])


def test_글자만_있는_data_속성은_후보가_아니다():
    d = htmltable.to_data('<div data-role="button" data-x="/p/q" data-n="n1">x</div>')
    assert [x["v"] for x in htmltable.links_of(d)] == ["/p/q", "n1"]


# ── 수정 2차: 큰 화면 ──────────────────────────────────────────────────────
def _big_page(ids, menus=250, filler=60_000, tail=0):
    """앞에 큰 스크립트·메뉴 후보 수백 개, 뒤에 결과 카드. tail 은 카드 앞에 더 넣는 글자 수(결과를 200KB 뒤로 미는 용도)."""
    menu = "".join(f'<li class="gnb"><a href="/menu/{i}.do">메뉴 {i}</a></li>' for i in range(menus))
    cards = "".join(f'<div class="item"><a href="/data/{i}/fileData.do"><img src="t.png"></a>'
                    f'<a href="/data/{i}/fileData.do">결과 {i}</a></div>' for i in ids)
    return (f'<html><head><script>var x="{"x" * filler}";</script></head><body><ul class="gnb-list">{menu}</ul>'
            f'<div>{"y" * tail}</div><div class="result-list">{cards}</div></body></html>')


def test_결과가_40KB_뒤에_있어도_후보를_모아_k1_로_잇는다(ieum_state):
    from tests.test_ieum_recorder_trace import _bare_trace
    from app.ieum.discovery import capture
    page = _big_page(["15000001", "15000002", "15000003"])
    assert len(page) > capture.MAX_BODY and page.index('class="result-list"') > capture.MAX_BODY

    class Req:
        resource_type, method, headers, post_data = "document", "GET", {}, None

    class Resp:
        url, status, headers, request = "http://h:8080/list.do?q=bus", 200, {"content-type": "text/html; charset=utf-8"}, Req()

        async def text(self):
            return page

    tr = _bare_trace()
    tr.current = {"network": []}
    asyncio.new_event_loop().run_until_complete(tr.on_response(Resp()))
    n = tr.current["network"][0]
    assert len(n["res"]) <= capture.MAX_BODY                                   # 저장하는 본문은 기존 상한 그대로
    spans = _record(_cards(), "http://h:8080/data/15000002/fileData.do")
    spans[0]["network"] = [dict(spans[0]["network"][0], res=n["res"], data=n["data"])]
    bf = analyze.analyze(REC, spans)
    p = next(p for p in bf["steps"][1]["params"] if p["loc"] == "path")
    assert p["from"] == "s1.links[/data/{id}/fileData.do@div.result-list>div.item][1.0/1].id"


def test_묶음별_상한과_같은_행의_같은_주소는_하나로():
    d = htmltable.to_data(_big_page(["1000000%d" % i for i in range(3)], menus=htmltable.MAX_LINKS_PER_GROUP + 50, filler=10))
    ls = htmltable.links_of(d)
    assert sum(1 for x in ls if x["g"] == "ul.gnb-list>li.gnb") == htmltable.MAX_LINKS_PER_GROUP
    cards = [x["v"] for x in ls if x["g"] == "div.result-list>div.item"]
    assert cards == ["/data/10000000/fileData.do", "/data/10000001/fileData.do", "/data/10000002/fileData.do"]   # 썸네일·제목 중복은 하나


class _BigSite(_Site):
    def handler(self):
        site = self

        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                site.hits.append(self.path)
                body = _big_page(site.ids, tail=250_000) if self.path.startswith("/list.do") else DETAIL
                b = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def log_message(self, *a):
                pass
        return H


def test_재실행도_200KB_뒤의_결과에서_같은_순번을_꺼내_보낸다():
    s = _BigSite(["900", "901", "902"])
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), s.handler())
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        rec = dict(REC, sourceBase=base)
        bf = analyze.analyze(rec, _record(_big_page(["15000001", "15000002", "15000003"]), base + "/data/15000002/fileData.do", base=base))
        assert len(_big_page(s.ids, tail=250_000)) > 200_000
        s.ids = ["902", "900", "901"]
        run = _replay(bf, base)
        assert run["ok"], run
        assert s.hits[-1] == "/data/900/fileData.do"
    finally:
        srv.shutdown()


def test_전체_후보_상한():
    html = "".join(f'<ul class="u{chr(97 + i % 26)}{chr(97 + i // 26 % 26)}"><li><a href="/v/{i}">a</a></li><li><a href="/w/{i}">b</a></li></ul>'
                   for i in range(3000))
    assert len(htmltable.links_of(htmltable.to_data(html))) == htmltable.MAX_LINKS


# ── 수정 3차: 행 찾기 성능 ──
MIXED = ('<ul class="gnb"><li><a href="/m/1">메뉴1</a></li><li><a href="/m/2">메뉴2</a></li><li>빈칸</li></ul>'
         '<div class="list"><div class="item"><p class="t"><a href="/d/101/v.do">가</a></p><p class="d">설명</p></div>'
         '<div class="item"><p class="t"><a href="/d/102/v.do">나</a><a href="/d/102/v.do">나2</a></p></div>'
         '<div class="item other"><a href="javascript:;" onclick="go(\'103\')">다</a></div><div class="item">링크 없음</div></div>'
         '<table><tr><th>A</th><th>B</th></tr><tr><td><a href="/t/1">1</a></td><td>x</td></tr><tr><td><a href="/t/2">2</a></td><td>y</td></tr></table>'
         '<span data-id="Z-9">z</span><a href="/solo/1">혼자</a>')


def test_행_찾기를_줄여도_출력은_그대로다():
    d = htmltable.to_data(MIXED)
    assert {"links": d["links"], "linkRows": d["linkRows"]} == {
        "links": [{"v": "/m/1", "r": 0}, {"v": "/m/2", "r": 1}, {"v": "/d/101/v.do", "r": 2}, {"v": "/d/102/v.do", "r": 3}, {"v": "103"},
                  {"v": "/t/1", "r": 4}, {"v": "/t/2", "r": 5}, {"v": "Z-9"}, {"v": "/solo/1"}],
        "linkRows": [{"t": "메뉴1", "g": "ul.gnb>li"}, {"t": "메뉴2", "g": "ul.gnb>li"}, {"t": "가 설명", "g": "div.list>div.item"},
                     {"t": "나 나2", "g": "div.list>div.item"}, {"t": "1 x", "g": "table>tr"}, {"t": "2 y", "g": "table>tr"}]}


def test_형제_카드_8000개도_빨리_끝난다():
    import time
    page = "".join(f'<div class="item"><a href="/data/{i}/f.do">카드 {i} {"가" * 80}</a></div>' for i in range(8000))
    t = time.monotonic()
    d = htmltable.to_data(page)
    assert time.monotonic() - t < 1.5 and len(d["links"]) == htmltable.MAX_LINKS_PER_GROUP


# ── T12-B: 값 모양 틀은 (행 순번, 행 안 순번) ─────────────────────────────
def _law_rows(rows):
    """rows: [(제목, [인자...])]. 행마다 숫자 인자 개수가 다르다."""
    lis = "".join(f'<li><a href="javascript:;" onclick="lsView(' + ", ".join(f"'{a}'" for a in args) + f')">{title}</a></li>' for title, args in rows)
    return f'<html><body><ul class="menu"><li><a href="/a.do">메뉴</a></li><li><a href="/b.do">메뉴2</a></li></ul><ul class="left_list">{lis}</ul></body></html>'


LAW = [("가 법", ["1001", "20240101", "7"]), ("나 법", ["1002", "20240202", "8", "9", "10"]), ("다 법", ["1003", "20240303", "11"])]


def test_값_모양_틀은_행_순번과_행_안_순번으로_잇는다():
    spans = _record(_law_rows(LAW), "http://h:8080/lsInfoP.do?lsiSeq=1002&efYd=20240202")
    spans[1]["action"]["target"]["text"] = "나 법"
    bf = analyze.analyze(REC, spans)
    s2 = bf["steps"][1]
    ps = {p["a"]: p for p in s2["params"]}
    assert ps["lsiSeq"]["from"] == "s1.links[{lsiSeq:d}@ul.left_list>li][1.0/5].lsiSeq"
    assert ps["efYd"]["from"] == "s1.links[{efYd:d}@ul.left_list>li][1.1/5].efYd"
    assert s2["pickedIndex"] == 1 and s2["pickedRow"] == "나 법"
    # 순서가 바뀌고 두 번째 행의 인자 개수가 다른 새 목록에서도 두 번째 행의 값을 꺼낸다
    new = htmltable.to_data(_law_rows([("라 법", ["2001", "20250101", "1", "2", "3", "4"]), ("마 법", ["2002", "20250202", "1", "2", "3"]), ("가 법", ["1001", "20240101", "7"])]))
    assert analyze.get_path(new, ps["lsiSeq"]["from"].split(".", 1)[1]) == "2002"
    assert analyze.get_path(new, ps["efYd"]["from"].split(".", 1)[1]) == "20250202"
    assert analyze.get_path(new, "links[{efYd:d}@ul.left_list>li][1.5].efYd") is None          # 행 안 순번이 모자라면 없음


def test_예전_k_꼴_출처도_읽는다():
    d = htmltable.to_data(_cards())
    assert analyze.get_path(d, "links[/data/{id}/fileData.do@div.result>div.item][1].id") == "15000002"
    assert analyze.get_path(d, "links[/data/{id}/fileData.do][1].id") == "15000002"          # 묶음 없는 전체 순서


def test_한_요청의_자리들이_다른_행에서_오면_확신도를_낮춘다():
    spans = _record(_law_rows(LAW), "http://h:8080/lsInfoP.do?lsiSeq=1002&efYd=20240303")
    spans[1]["action"]["target"]["text"] = "나 법"
    ps = {p["a"]: p for p in analyze.analyze(REC, spans)["steps"][1]["params"]}
    assert "[1.0/5]" in ps["lsiSeq"]["from"] and "[2.1/3]" in ps["efYd"]["from"]
    assert ps["lsiSeq"]["confidence"] == "low" and ps["efYd"]["confidence"] == "low"


# ── T12 수정 1차: 행 안 순번은 같은 값도 따로 세고, 행의 후보 수가 다르면 꺼내지 않는다 ──
def test_행_안_같은_값을_합치지_않고_세며_후보_수가_다르면_꺼내지_않는다():
    rec_rows = [("가 법", ["11001", "20240101", "20240105", "7"]), ("나 법", ["11002", "20240202", "20240206", "8"])]
    spans = _record(_law_rows(rec_rows), "http://h:8080/lsInfoP.do?lsiSeq=11002&ancYd=20240206")
    spans[1]["action"]["target"]["text"] = "나 법"
    ps = {p["a"]: p for p in analyze.analyze(REC, spans)["steps"][1]["params"]}
    assert ps["ancYd"]["from"] == "s1.links[{ancYd:d}@ul.left_list>li][1.2/4].ancYd"
    expr = ps["ancYd"]["from"].split(".", 1)[1]
    same_day = htmltable.to_data(_law_rows([("다 법", ["13001", "20250101", "20250102", "1"]), ("라 법", ["13002", "20250202", "20250202", "9"])]))
    assert analyze.get_path(same_day, expr) == "20250202"                     # 같은 값이 두 번 있어도 세 번째 자리
    fewer = htmltable.to_data(_law_rows([("다 법", ["13001", "20250101", "20250102", "1"]), ("라 법", ["13002", "20250202", "9"])]))
    assert analyze.get_path(fewer, expr) is None                               # 행의 후보 수가 기록 때와 다르면 짐작하지 않는다


def _law_rows_with_view(rows):
    lis = "".join(f'<li><a href="javascript:;" onclick="lsView(' + ", ".join(f"'{a}'" for a in args) + f')">{title}</a>'
                  + (f'<a href="/view.do?seq={args[0]}">상세</a>' if view else "") + "</li>" for title, args, view in rows)
    return f'<html><body><ul class="left_list">{lis}</ul></body></html>'


def test_한_요청의_자리들은_틀이_달라도_같은_행에서_꺼낸다():
    rows = [("가 법", ["10001", "20240101"], False), ("나 법", ["10002", "20240202"], True), ("다 법", ["10003", "20240303"], True)]
    spans = _record(_law_rows_with_view(rows), "http://h:8080/view.do?seq=10002&lsiSeq=10002")
    spans[1]["action"]["target"]["text"] = "나 법"
    ps = {p["a"]: p for p in analyze.analyze(REC, spans)["steps"][1]["params"]}
    assert ps["seq"]["confidence"] != "low" and ps["lsiSeq"]["confidence"] != "low"     # 같은 행이다(틀마다 k 가 달라도)
    new = htmltable.to_data(_law_rows_with_view([("라 법", ["30001", "20250101"], False), ("마 법", ["30002", "20250202"], True),
                                                 ("바 법", ["30003", "20250303"], True)]))
    got = {a: analyze.get_path(new, ps[a]["from"].split(".", 1)[1]) for a in ("seq", "lsiSeq")}
    assert got == {"seq": "30002", "lsiSeq": "30002"}

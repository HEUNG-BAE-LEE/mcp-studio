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
    vs = [x["v"] for x in d["links"]]
    assert vs == ["/list.do?type=file", "/list.do?type=api", "/data/15000001/fileData.do", "/data/15000002/fileData.do", "/data/15000003/fileData.do"]
    rows = {x["v"]: x["row"] for x in d["links"]}
    assert rows["/data/15000002/fileData.do"] == "부산광역시_버스 노선 노선 정보"          # 누른 링크에서 위로: 반복되는 div.item
    assert rows["/list.do?type=api"] == "오픈API"                                       # 필터 링크는 자기 li 가 행이다(결과 카드와 섞이지 않는다)


def test_li_나열과_onclick_인자를_후보로_모은다():
    d = htmltable.to_data(LIS)
    vs = [x["v"] for x in d["links"]]
    assert vs == ["news", "all", "blog", "all", "15000001", "15000002", "15000003"]                # javascript:; 는 빈 값이라 뺀다
    row = next(x["row"] for x in d["links"] if x["v"] == "15000002")
    assert row == "부산광역시_버스 노선 보기"


def test_표_화면은_기존_동작_그대로이고_후보도_모은다():
    d = htmltable.to_data(TABLE)
    assert d["tables"][0]["columns"] == ["제목", "기관"] and d["tables"][0]["rows"][1]["_links"] == ["/data/15000002/fileData.do"]
    row = next(x["row"] for x in d["links"] if x["v"] == "/data/15000002/fileData.do")
    assert row == "부산광역시_버스 노선 부산"                                            # 칸이 아니라 행(tr)


def test_data_속성과_form_action_도_후보이고_상한을_지킨다():
    html = ('<form action="/search.do"><input name="q"></form><div data-id="A-77" data-x="">x</div>'
            + f'<a href="/{"y" * 400}">긴 주소</a>' + "".join(f'<p><a href="/v/{i}">{i}</a></p>' for i in range(700)))
    d = htmltable.to_data(html)
    vs = [x["v"] for x in d["links"]]
    assert vs[:3] == ["/search.do", "A-77", "/v/0"] and len(vs) == htmltable.MAX_LINKS and all(len(v) <= htmltable.MAX_LINK_LEN for v in vs)


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
    assert p["from"] == "s1.links[/data/{id}/fileData.do][1].id"


def test_다른_출처_절대주소_링크도_잇는다():
    bf = analyze.analyze(REC, _record(NAVER, "https://n.news.naver.com/mnews/article/052/0002416855", base="https://search.naver.com"))
    s1, s2 = bf["steps"]
    assert s2["base"] == "https://n.news.naver.com" and s2["path"] == "/mnews/article/{id}/{id2}"
    ps = {p["a"]: p for p in s2["params"] if p["loc"] == "path"}
    assert ps["id"]["from"] == "s1.links[/mnews/article/{id}/{id2}][1].id" and ps["id2"]["from"] == "s1.links[/mnews/article/{id}/{id2}][1].id2"
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
    assert p["source"] == "PREVIOUS_STEP_OUTPUT" and p["from"] == "s1.links[{lsiSeq:d}][1].lsiSeq"
    assert bf["steps"][1]["pickedIndex"] == 1


def test_쿼리_값은_같은_주소를_가리키는_링크의_쿼리에서_잇는다():
    html = "".join(f'<li><a href="/news/view.do?articleId={i}&amp;from=list">기사 {i}</a></li>' for i in (7001, 7002, 7003))
    bf = analyze.analyze(REC, _record(f"<ul>{html}</ul>", "http://h:8080/news/view.do?articleId=7002"))
    p = next(p for p in bf["steps"][1]["params"] if p["a"] == "articleId")
    assert p["from"] == "s1.links[/news/view.do?articleId={articleId}][1].articleId" and p["confidence"] == "low"   # 짧은 숫자 하나뿐


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
    assert [x["v"] for x in d["links"]] == ["A-77"]


def test_숫자_없는_고정값과_구분_파라미터는_후보로_잇지_않는다():
    """메뉴 onclick 의 'news'·필터 링크의 cmd 값처럼 우연히 겹친 고정값을 앞 단계 출력으로 바꾸지 않는다."""
    html = LIS + '<a href="/board.do?cmd=view&amp;seq=10001">글</a><a href="/board.do?cmd=list">목록</a>'
    bf = analyze.analyze(REC, _record(html, "http://h:8080/board.do?cmd=view&tab=news&seq=10001"))
    ps = {p["a"]: p for p in bf["steps"][1]["params"]}
    assert ps["tab"]["source"] == "CONSTANT" and ps["cmd"]["source"] == "CONSTANT"
    assert ps["seq"]["from"] == "s1.links[/board.do?seq={seq}][0].seq"

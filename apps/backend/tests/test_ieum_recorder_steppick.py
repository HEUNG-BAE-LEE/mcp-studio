# apps/backend/tests/test_ieum_recorder_steppick.py
"""T13: 단계 고르기. 사람이 눌러 연 본문 화면은 핵심 단계이고, 광고·통계 같은 부수 요청은 단계가 아니다.

외부 사이트에 접속하지 않는다. 주소는 분석기에 넘기는 문자열일 뿐이다.
"""
import asyncio
import json

from app.ieum.recorder import analyze, htmltable
from tests.test_ieum_recorder_trace import _bare_trace

SEARCH = "https://search.daum.net"
ARTICLE = "https://v.daum.net"
IDS = ["20261011153000001", "20261011153000002", "20261011153000003"]
LIST = ('<html><body><ul class="c-list">' + "".join(
    f'<li><a href="{ARTICLE}/v/{i}" onclick="smartLog(this, \'dc=NNS&amp;d=26abc\', event)">기사 제목 {n}</a></li>' for n, i in enumerate(IDS, 1))
    + "</ul></body></html>")
# 본문 화면: 앞 4000자가 스크립트뿐이라 글자 조각으로는 화면 표시를 알 수 없다
ARTICLE_HTML = "<html><head><script>" + "var a=1;" * 600 + "</script></head><body><h3>기사 제목 2</h3><p>본문 문단</p></body></html>"


def _net(method, url, res="", data=None, rtype="xhr", main=False, post=None):
    from urllib.parse import urlsplit
    p = urlsplit(url)
    origin = f"{p.scheme}://{p.netloc}"
    return {"method": method, "url": url, "origin": origin, "base": origin, "path": p.path, "status": 200, "ctype": "", "charset": None,
            "rtype": rtype, "headers": {}, "post": post, "res": res[:4000], "data": data, "file": False, "held": False, "decision": "sent" if method != "GET" else "",
            "primary": origin == SEARCH, "t": 0, "main": main}


def _span(seq, text, network, aria, href):
    return {"seq": seq, "action": {"type": "click", "target": {"tag": "A", "text": text}, "isTrusted": True, "t": seq}, "fills": [],
            "pre": {"url": "/", "href": SEARCH + "/search?q=x", "title": "검색", "aria": "", "hidden": {}, "shot": None},
            "network": network, "post": {"url": "/", "href": href, "title": "다음", "aria": aria, "hidden": {}, "shot": None}}


REC = {"id": "rec_00000030", "name": "기사 보기", "sourceBase": SEARCH, "env": "op", "login": {}, "approvals": []}


def _spans(extra_click_net=()):
    return [
        _span(1, "검색", [_net("GET", SEARCH + "/search?w=news&q=x", LIST, htmltable.to_data(LIST), rtype="document", main=True)],
              "- link: 기사 제목 1\n- link: 기사 제목 2", SEARCH + "/search?w=news&q=x"),
        _span(2, "기사 제목 2", [_net("GET", ARTICLE + "/v/" + IDS[1], ARTICLE_HTML, rtype="document", main=True)] + list(extra_click_net),
              "- heading: 기사 제목 2\n- text: 본문 문단\n- link: 광고 상품 할인", ARTICLE + "/v/" + IDS[1]),
    ]


def test_사람이_눌러_연_본문_화면은_화면_표시와_상관없이_핵심_단계다():
    iframe = _net("GET", ARTICLE + "/ad/frame.html", ARTICLE_HTML, rtype="document", main=False)
    bf = analyze.analyze(REC, _spans([iframe]))
    paths = [(s["base"], s["path"], s["role"]) for s in bf["steps"]]
    assert (ARTICLE, "/v/{id}", "core") in paths
    assert not any(p == "/ad/frame.html" for _, p, _ in paths)                          # 안쪽 틀(광고) 문서는 아니다
    art = next(s for s in bf["steps"] if s["path"] == "/v/{id}")
    assert next(p for p in art["params"] if p["loc"] == "path")["from"].startswith("s1.links[")


def test_시작_묶음의_본문_화면은_강제로_핵심이_아니다():
    spans = _spans()
    spans[0]["action"] = {"type": "open", "url": SEARCH + "/search?w=news&q=x", "label": "시작 화면 열기", "target": None, "isTrusted": None, "t": 1}
    bf = analyze.analyze(REC, spans)
    assert bf["steps"][0]["role"] == "prereq"


def test_trace_는_주_화면_문서에_main_을_남긴다():
    class Frame:
        parent_frame = None

    class Req:
        resource_type, method, headers, post_data, frame = "document", "GET", {}, None, Frame()

        def is_navigation_request(self):
            return True

    class Resp:
        url, status, headers, request = "http://rec.test/po/view.do", 200, {"content-type": "text/html"}, Req()

        async def text(self):
            return "<html><body><p>본문</p></body></html>"

    class Child(Frame):
        parent_frame = Frame()

    class IReq(Req):
        frame = Child()

    class IResp(Resp):
        url, request = "http://rec.test/po/ad.html", IReq()

    tr = _bare_trace()
    tr.current = {"network": []}
    loop = asyncio.new_event_loop()
    loop.run_until_complete(tr.on_response(Resp()))
    loop.run_until_complete(tr.on_response(IResp()))
    assert [n["main"] for n in tr.current["network"]] == [True, False]


def test_거쳐_간_메뉴_화면은_다른_화면으로_옮겨_가면_강제로_핵심이_아니다():
    menu = _net("GET", SEARCH + "/menu/news.do", ARTICLE_HTML, rtype="document", main=True)
    page2 = _net("GET", SEARCH + "/board/view.do", "<html><body><h3>게시글 본문 내용</h3></body></html>", rtype="document", main=True)
    spans = [_span(1, "뉴스", [menu], "- text: 뉴스", SEARCH + "/menu/news.do"),
             _span(2, "게시판", [page2], "- heading: 게시글 본문 내용", SEARCH + "/board/view.do")]
    bf = analyze.analyze(REC, spans)
    assert [s["path"] for s in bf["steps"]] == ["/board/view.do"]
    assert any(e["path"] == "/menu/news.do" and e["role"] == "page" for e in bf["excluded"])


def test_도착한_본문에서_같은_화면_안_행동을_해도_본문은_핵심으로_남는다():
    more = _net("GET", ARTICLE + "/api/comments?page=2", json.dumps({"list": [{"text": "두 번째 댓글 내용"}]}, ensure_ascii=False))
    like = _net("POST", ARTICLE + "/api/like", json.dumps({"ok": "공감했습니다"}, ensure_ascii=False), post="id=1")
    for extra, aria in ((more, "- text: 두 번째 댓글 내용"), (like, "- text: 공감했습니다")):
        spans = _spans() + [_span(3, "더보기", [extra], aria, ARTICLE + "/v/" + IDS[1])]
        spans[2]["pre"]["href"] = ARTICLE + "/v/" + IDS[1]
        bf = analyze.analyze(REC, spans)
        art = next((s for s in bf["steps"] if s["path"] == "/v/{id}"), None)
        assert art is not None and art["role"] == "core", [s["path"] for s in bf["steps"]]


# ── T13-3: 광고·통계 같은 부수 요청 ───────────────────────────────────────
def test_다음형_기록은_목록과_본문만_단계다():
    ads_json = json.dumps({"ads": [{"title": "광고 상품 할인", "url": "https://shop.example.com/p/1"}]}, ensure_ascii=False)
    extra = [
        _net("GET", ARTICLE + "/ad/frame.html", ARTICLE_HTML, rtype="document", main=False),                       # 안쪽 틀 광고 문서
        _net("GET", "https://securepubads.g.doubleclick.net/gampad/ads?iu=x", ads_json),                            # 다른 사이트, 화면에 보임
        _net("POST", "https://stat.tiara.daum.net/track", "", post="d=26abc&url=x"),                              # 같은 사이트 다른 출처 통계 쓰기
        _net("POST", "https://ads-api.daum.net/api/v2/ads", ads_json, post='{"slot":"a"}'),
        _net("POST", "https://ads-api.daum.net/api/v1/events", "", post='{"e":"imp"}'),
    ]
    spans = _spans(extra)
    spans[0]["action"] = {"type": "open", "url": SEARCH + "/search?w=news&q=x", "label": "시작 화면 열기", "target": None, "isTrusted": None, "t": 1}
    bf = analyze.analyze(REC, spans)
    assert [(s["base"], s["path"], s["role"]) for s in bf["steps"]] == [(SEARCH, "/search", "prereq"), (ARTICLE, "/v/{id}", "core")]
    why = {e["path"]: e["why"] for e in bf["excluded"]}
    assert why["/gampad/ads"] == "다른 사이트로 간 부수 요청"
    assert why["/track"] == why["/api/v2/ads"] == why["/api/v1/events"] == "사람 입력이 없는 다른 출처 쓰기(통계·광고로 보임)"
    assert bf["policy"]["operation"] == "READ"


def test_사람_입력이_실린_다른_사이트_요청과_같은_출처_쓰기는_그대로다():
    spans = _spans([_net("GET", "https://api.partner.co.kr/find?q=%ED%95%9C%EB%B9%9B", json.dumps({"r": "한빛상사 결과"}, ensure_ascii=False)),
                    _net("POST", ARTICLE + "/v/save.do", json.dumps({"ok": "저장했습니다"}, ensure_ascii=False), post="memo=x")])
    spans[1]["fills"] = [{"target": {"id": "q", "label": "검색어"}, "value": "한빛"}]
    spans[1]["post"]["aria"] += "\n- text: 한빛상사 결과"
    bf = analyze.analyze(REC, spans)
    paths = [s["path"] for s in bf["steps"]]
    assert "/find" in paths and "/v/save.do" in paths


def test_등록_도메인_어림():
    assert analyze._site("stat.tiara.daum.net") == analyze._site("v.daum.net") == "daum.net"
    assert analyze._site("www.data.go.kr") == "data.go.kr" and analyze._site("a.b.co.uk") == "b.co.uk"
    assert analyze._site("securepubads.g.doubleclick.net") == "doubleclick.net" and analyze._site("127.0.0.1") == "127.0.0.1"


def test_화면_이동_없이_버튼이_보낸_다른_출처_쓰기는_단계로_남는다():
    """결재 시스템처럼 다른 출처로 바로 보내는 사람의 쓰기(입력값 없이 앞 화면 값만)는 통계·광고가 아니다."""
    spans = [_span(1, "승인", [_net("POST", "http://appr.corp:9090/appr/approve.do", json.dumps({"ok": "승인했습니다"}, ensure_ascii=False),
                                     post="docNo=D-77")], "- text: 승인했습니다", SEARCH + "/x")]
    bf = analyze.analyze(REC, spans)
    assert [s["path"] for s in bf["steps"]] == ["/appr/approve.do"] and bf["steps"][0]["write"] is True

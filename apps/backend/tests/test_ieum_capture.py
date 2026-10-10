"""크롤러·레코더 공용 판정. Playwright 없이 돈다."""
from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy

P = Policy(base="http://10.0.0.1:8080/po", read_post="/po/searchPost.do")


def test_화면_이동과_조회_GET_은_쓰기가_아니다():
    assert not capture.is_write("http://10.0.0.1:8080/po/poListView.do", "GET", "document", P)
    assert not capture.is_write("http://10.0.0.1:8080/po/poList.do?a=1", "GET", "xhr", P)


def test_POST_와_이름이_쓰기_같은_GET_은_쓰기다():
    assert capture.is_write("http://10.0.0.1:8080/po/poSave.do", "POST", "xhr", P)
    assert capture.is_write("http://10.0.0.1:8080/po/poDelete.do?id=1", "GET", "xhr", P)


def test_정적_자원과_http_가_아닌_요청은_쓰기가_아니다():
    assert not capture.is_write("http://10.0.0.1:8080/po/app.js", "POST", "script", P)
    assert not capture.is_write("data:text/plain,hi", "POST", "xhr", P)


def test_크롤러는_화면_이동_응답을_버린다():
    assert capture.response_kind("xhr", "http://h/po/poList.do", 200, {"content-type": "application/json"}) == (False, "application/json")
    assert capture.response_kind("document", "http://h/po/main.do", 200, {"content-type": "text/html"}) is None
    assert capture.response_kind("xhr", "http://h/po/x.do", 302, {}) is None
    assert capture.response_kind("document", "http://h/po/down.do", 200, {"content-disposition": "attachment; filename=a.xlsx"}) == (True, "")


def test_보존_헤더는_세션_값과_토큰을_뺀다():
    kept = capture.keep_headers({"X-Requested-With": "XMLHttpRequest", "Cookie": "a=1", "X-CSRF-TOKEN": "t", "Accept": "*/*", "User-Agent": "u"})
    assert kept == {"x-requested-with": "XMLHttpRequest", "accept": "*/*"}


def test_표본_상한과_이벤트_중복_억제():
    c = capture.SampleCounter()
    assert all(c.room("GET /a") for _ in range(capture.MAX_SAMPLES))
    assert not c.room("GET /a")
    d = capture.EventDedup()
    assert [d.allow("k") for _ in range(capture.DUP_EVENTS + 1)] == [True] * capture.DUP_EVENTS + [False]


def test_로그인_요청에서_필드_이름을_알아낸다():
    req = {"url": "http://10.0.0.1:8080/po/loginProc.do", "method": "POST", "post": "returnUrl=main.do&userId=svc&userPw=pw1",
           "ctype": "application/x-www-form-urlencoded"}
    path, recipe = capture.build_recipe(req, "http://10.0.0.1:8080/po/login.do", "svc", "pw1")
    assert path == "/po/loginProc.do"
    assert recipe["userField"] == "userId" and recipe["passField"] == "userPw" and recipe["extra"] == {"returnUrl": "main.do"}
    rel = capture.recipe_rel(P, recipe)
    assert rel["loginRel"] == "/login.do" and rel["actionRel"] == "/loginProc.do"

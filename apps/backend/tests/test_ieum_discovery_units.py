"""API 자동 탐색 단위 테스트: 마스킹, 탐색 정책, 설정 검증, 추정, 병합, 검증 호출, 세션 로그인, 작업 수명, 저장소 준비.

브라우저가 필요한 전 구간 시험은 test_ieum_discovery_e2e.py 에 있다.
"""
import json
import time
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import multiprocessing

from app.ieum.discovery import infer, jobs, masking, merge, options, repo, scan_proc, verify
from app.ieum.discovery.crawler import CrawlResult, Observed
from app.ieum.discovery.masking import Masker
from app.ieum.discovery.policy import Policy, risky_call
from app.ieum.gateway import credentials, session_auth
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID


# ---------------------------------------------------------------- 도우미
def obs(url, *, method="GET", status=200, body="", post=None, headers=None, blocked=False, label="발주 현황 > 조회 버튼 클릭", file=False, out=False):
    return Observed(method=method, url=url, status=None if blocked else status, ctype="application/json", headers={"x-requested-with": "XMLHttpRequest"} if headers is None else headers,
                    post=post, body=body, blocked=blocked, label=label, screen="/poListView.do", file=file, out_of_scope=out)


def ep(path, method="GET", mode="read", kind="api", **kw):
    """소스 분석기가 돌려주는 엔드포인트와 같은 모양의 가짜."""
    return SimpleNamespace(method=method, path=path, file=kw.get("file", "PoController.java"), line=kw.get("line", 10), cls="PoController", fn=kw.get("fn", "fn"), kind=kind,
                           mode=mode, sql=kw.get("sql"), mapper=kw.get("mapper"), ret="Map<String, Object>", vo=kw.get("vo"), deprecated=kw.get("dep", False),
                           title=kw.get("title", ""), params=kw.get("params", []), snippet="@RequestMapping\npublic Map fn() {}", lang="java")


def sp(name, type="String", required=False, loc="query", desc=""):
    return SimpleNamespace(name=name, type=type, required=required, loc=loc, desc=desc)


POLICY = Policy(base="http://h:8080/po", delay_ms=0)


# ---------------------------------------------------------------- 마스킹
def test_전화번호_이메일_사업자번호를_가리고_개수를_센다():
    m = Masker()
    out = m.text("연락처 010-4821-5678 / 02-555-0123, 사업자 123-45-67890, 주민 900101-1234567, a.b@hanbit.local")
    assert out == "연락처 ***-****-5678 / **-***-0123, 사업자 ***-**-*7890, 주민 900101-*******, a**@hanbit.local"
    assert m.kinds == {"phone": 2, "biz": 1, "rrn": 1, "email": 1} and m.count == 5


def test_금액과_주문번호는_건드리지_않는다():
    m = Masker()
    assert m.text("PO-2609-0142 4,850,000원 2026-09-26") == "PO-2609-0142 4,850,000원 2026-09-26" and m.count == 0


def test_비밀번호_이름은_값을_통째로_숨기고_개인정보로_세지_않는다():
    m = Masker()
    assert m.value({"userPw": "abc", "list": [{"accessToken": "t", "TEL": "01012345678"}]}) == {"userPw": masking.HIDDEN, "list": [{"accessToken": masking.HIDDEN, "TEL": "*******5678"}]}
    assert m.pairs([("userId", "kim"), ("password", "pw")]) == [("userId", "kim"), ("password", masking.HIDDEN)]
    assert (m.kinds["secret"], m.count) == (3, 1)          # 개인정보는 전화번호 1건뿐


@pytest.mark.parametrize("name,secret", [("userPw", True), ("user_pw", True), ("passwd", True), ("JSESSIONID", True), ("api_key", True), ("Authorization", True),
                                         ("PO_NO", False), ("ITEM_KEY", False), ("upward", False), ("poStts", False)])
def test_비밀_이름_판별(name, secret):
    assert masking.is_secret_key(name) is secret


def test_개인정보_마스킹을_끄면_패턴은_두고_비밀번호만_가린다():
    m = Masker(pii=False)
    assert m.text("010-4821-5678") == "010-4821-5678"
    assert m.value({"userPw": "x", "tel": "010-4821-5678"}) == {"userPw": masking.HIDDEN, "tel": "010-4821-5678"}


# ---------------------------------------------------------------- 탐색 정책
def test_주소_판정은_범위_제외_출처_위험한_이름을_이유와_함께_가린다():
    p = Policy(base="http://localhost:8000/po", exclude="/logout.do, /admin/*", ban=["저장"])
    ok = lambda path: p.url_decision("http://localhost:8000/po" + path, 1)
    assert ok("/poListView.do") == (True, "")
    assert ok("/logout.do") == (False, "로그아웃 링크라 열지 않음")
    assert ok("/admin/x.do") == (False, "제외 경로라 열지 않음")
    assert ok("/deleteUser.do") == (False, "삭제처럼 보이는 주소라 열지 않음")
    assert ok("/a.xlsx") == (False, "API 가 없는 파일이라 열지 않음")
    assert p.url_decision("http://evil.com/po/x.do", 1) == (False, "다른 사이트라 열지 않음")
    assert p.url_decision("http://localhost:8000/other/x.do", 1) == (False, "탐색 범위 밖이라 열지 않음")
    assert p.url_decision("http://localhost:8000/po/x.do", 99)[1].startswith("깊이 상한")


def test_방문한_화면과_화면_상한():
    p = Policy(base="http://h/po", max_pages=2)
    p.visit("http://h/po/a.do?x=1")
    assert p.url_decision("http://h/po/a.do?x=2", 1) == (False, "이미 방문")       # 값만 다른 주소는 같은 화면이다
    p.visit("http://h/po/b.do")
    assert p.url_decision("http://h/po/c.do", 1) == (False, "화면 상한(2)에 도달")


def test_경로는_서버_기준과_운영_주소_기준_모두_쓸_수_있다():
    p = Policy(base="http://h/po", scope="/po/list*", exclude="/skip.do")
    assert p.in_scope("http://h/po/listView.do") and not p.in_scope("http://h/po/main.do")
    assert p.excluded("http://h/po/skip.do")                  # /po/skip.do 를 운영 주소 기준 /skip.do 로 지정
    assert p.rel("/po/poList.do") == "/poList.do" and p.display("http://h/po/poList.do?a=1") == "/poList.do?a=1"
    assert p.display("http://other/x") == "http://other/x"


def test_누르지_않을_단어는_부분_일치이고_대소문자를_가리지_않는다():
    p = Policy(base="http://h", ban=["저장", "Delete"])
    assert p.banned_word("임시저장") == "저장" and p.banned_word("delete all") == "delete" and p.banned_word("조회") is None
    assert p.risky_click("javascript:goDelete(1)", "") and p.risky_click("logout.do", "")
    assert p.risky_click("poListView.do", "") is None


def test_조회용_POST_경로만_운영에_실제로_보낸다():
    p = Policy(base="http://h/po", read_post="/po/*List.do")
    assert p.is_read_post("http://h/po/poList.do") and not p.is_read_post("http://h/po/poSave.do")
    assert not Policy(base="http://h/po").is_read_post("http://h/po/poList.do")


def test_운영_서버에는_사람보다_빠르게_누르지_않는다():
    assert Policy(base="http://10.0.0.1/po", delay_ms=0).delay_ms == 600
    assert Policy(base="http://localhost/po", delay_ms=0).delay_ms == 0          # 로컬 시연은 빨라도 된다


@pytest.mark.parametrize("path,word", [("/poList.do", None), ("/selectPoList.do", None), ("/getAddressList.do", None), ("/vendList.do", None),
                                       ("/poSave.do", "Save"), ("/poApprove.do", "Approve"), ("/loginProc.do", "Proc"), ("/a/cancel/list", "cancel"), ("/삭제목록.do", "삭제")])
def test_읽기_검증을_막는_위험한_이름(path, word):
    assert risky_call(path) == word


# ---------------------------------------------------------------- 설정 검증
GOOD = {"git": True, "crawl": True, "approved": True, "owner": "김현우", "base": "http://localhost:8000/po/", "start": "/login.do", "repo": "/x", "account": "svc",
        "password": "pw", "token": "tk", "stg": True, "stgUrl": "http://localhost:8000/po-stg", "ban": ["저장", " "]}


def test_설정을_정리하고_비밀을_분리한다():
    o, secrets = options.clean(GOOD)
    assert (o["base"], o["start"], o["stgUrl"], o["ban"], o["maxPages"]) == ("http://localhost:8000/po", "http://localhost:8000/po/login.do", "http://localhost:8000/po-stg", ["저장"], 50)
    assert secrets == {"username": "svc", "password": "pw", "token": "tk"} and "password" not in o and "token" not in o


@pytest.mark.parametrize("patch,msg", [({"approved": False}, "승인"), ({"owner": ""}, "담당자"), ({"git": False, "crawl": False}, "하나는 켜야"), ({"base": "ftp://x"}, "운영 주소"),
                                       ({"stgUrl": "http://localhost:8000/po"}, "운영 주소와 같습니다"), ({"stgUrl": "x"}, "스테이징 주소"), ({"when": "at", "startTime": "25:00"}, "HH:MM"),
                                       ({"start": "http://evil.com/x"}, "같은 서버"), ({"repo": ""}, "저장소")])
def test_잘못된_설정은_이유를_알려준다(patch, msg):
    with pytest.raises(ValueError, match=msg):
        options.clean({**GOOD, **patch})


def test_예약_시각은_지났으면_내일이다():
    now = time.mktime((2026, 10, 4, 20, 0, 0, 0, 0, -1))
    assert options.next_start("21:30", now) - now == 90 * 60
    assert options.next_start("19:00", now) - now == 23 * 3600
    assert options.clean({**GOOD, "git": False, "stg": False, "when": "at", "startTime": "03:00"})[0]["startAt"] > time.time()


def test_상한을_넘는_값은_줄인다():
    o, _ = options.clean({**GOOD, "maxPages": 99999, "delayMs": -5})
    assert (o["maxPages"], o["delayMs"]) == (200, 0)


# ---------------------------------------------------------------- 추정
def test_경로의_식별자는_자리표시자로():
    assert infer.templatize("/orders/1023/items/55") == "/orders/{id}/items/{id2}" and infer.templatize("/poDetail.do") == "/poDetail.do"


def test_파라미터_날짜는_문자열로_두고_날짜_규칙을_붙인다():
    samples = [obs("http://h/po/poList.do?fromDt=20260901&toDt=20260930&vendCd=&sttsCd=20"), obs("http://h/po/poList.do?fromDt=20260801&toDt=20260831&vendCd=V1&sttsCd=30")]
    ps = {p["o"]: p for p in infer.build_params([], samples, Masker())}
    assert (ps["fromDt"]["rule"], ps["fromDt"]["ot"], ps["fromDt"]["ax"], ps["fromDt"]["at"]) == ("date", "YYYYMMDD", "2026-09-01", "string (date)")
    assert ps["fromDt"]["req"] == 1 and ps["sttsCd"]["at"] == "integer"
    assert ps["vendCd"]["obs"] == ["V1"] and "req" not in ps["vendCd"]          # 한 번 비어 있었으니 필수가 아니다
    inject = ps["X-Requested-With"]
    assert (inject["rule"], inject["loc"], inject["v"], inject["a"]) == ("inject", "header", "XMLHttpRequest", "")


def test_한_번_본_것으로_필수라고_말하지_않는다():
    ps = {p["o"]: p for p in infer.build_params([], [obs("http://h/po/x.do?a=1")], Masker())}
    assert "req" not in ps["a"]


def test_소스가_말해_준_타입과_필수가_우선한다():
    ps = {p["o"]: p for p in infer.build_params([sp("poNo", "String", True), sp("qty", "int"), sp("memo", "String", desc="비고")], [obs("http://h/po/x.do?poNo=P1&qty=3&extra=z")], Masker())}
    assert ps["poNo"]["req"] == 1 and (ps["qty"]["at"], ps["qty"]["ot"]) == ("integer", "int") and ps["memo"]["d"] == "비고"
    assert ps["memo"]["ex"] == "" and ps["memo"]["obs"] == []                   # 본 값이 없으면 예시를 지어내지 않는다
    assert "extra" in ps                                                        # 소스에 없고 화면만 보낸 파라미터도 남긴다


def test_본문_파라미터는_폼과_JSON_위치를_구분한다():
    form = obs("http://h/po/poSave.do", method="POST", post="vendCd=V1&qty=2", headers={"content-type": "application/x-www-form-urlencoded"}, blocked=True)
    js = obs("http://h/po/a.json", method="POST", post='{"a":1,"nested":{"x":1}}', headers={"content-type": "application/json"}, blocked=True)
    assert {p["o"]: p["loc"] for p in infer.build_params([], [form], Masker()) if p["loc"] != "header"} == {"vendCd": "form", "qty": "form"}
    assert {p["o"]: p["loc"] for p in infer.build_params([], [js], Masker())} == {"a": "body"}      # 중첩 객체는 평탄화하지 않는다


def test_응답_매핑은_마스킹한_값으로_규칙을_추정한다():
    m = Masker()
    rows, text = infer.build_res(json.dumps({"RSLT": "0000", "list": [{"PO_NO": "P1", "TEL": "010-1234-5678", "AMT": "4,850,000", "YMD": "20260926"}]}), m)
    by = {r["o"]: r for r in rows}
    assert (by["list[].TEL"]["rule"], by["list[].AMT"]["rule"], by["list[].YMD"]["rule"], by["list[].PO_NO"]["a"]) == ("mask", "num", "date", "list[].po_no")
    assert "***-****-5678" in text and "010-1234-5678" not in text
    assert infer.build_res("<html>login</html>", m) == ([], "") and infer.build_res("", m) == ([], "")


def test_JSON_판정은_Content_Type_이_아니라_파싱_시도로():
    assert infer.parse_json('﻿ {"a": 1}') == {"a": 1} and infer.parse_json("not json") is None and infer.parse_json("[1,") is None


CODE_BODY = json.dumps({"resultList": [{"CD": "10", "CD_NM": "작성"}, {"CD": "20", "CD_NM": "승인대기"}, {"CD": "90", "CD_NM": "취소"}]})
VEND_BODY = json.dumps({"resultList": [{"VEND_CD": "V1", "VEND_NM": "한빛"}, {"VEND_CD": "V2", "VEND_NM": "대한"}]})


def test_코드표는_코드표_API_로_볼_근거가_있을_때만_만든다():
    tables = infer.detect_code_tables([obs("http://h/po/common/codeList.do?grpCd=PO_STTS", body=CODE_BODY), obs("http://h/po/vendList.do?vendNm=", body=VEND_BODY),
                                       obs("http://h/po/common/codeList.do?grpCd=X", body=CODE_BODY, blocked=True)])
    assert tables == {"PO_STTS": [("10", "작성"), ("20", "승인대기"), ("90", "취소")]}   # 거래처 목록은 마스터 데이터라 코드표가 아니다


def test_코드값_변환은_이름이_가장_가까운_표에_붙인다():
    tables = {"PO_STTS": [("10", "작성"), ("20", "승인대기")], "PR_STTS": [("10", "요청"), ("20", "승인")]}
    params = [{"o": "sttsCd", "obs": ["10"], "loc": "query", "a": "stts_cd", "d": "sttsCd"}]                  # stts 만 겹쳐 두 표와 동점 → 정하지 않는다
    rows = [{"o": "resultList[].PO_STTS_CD", "ov": "20", "a": "x"}, {"o": "resultList[].PO_NO", "ov": "P1", "a": "y"}]
    assert infer.apply_codes(params, rows, tables) == 1
    assert "rule" not in params[0] and rows[0]["rule"] == "code" and rows[0]["av"] == "승인대기" and "rule" not in rows[1]
    assert rows[0]["codes"][0] == ["10", "작성", "작성"]                                                       # AI 가 읽는 값은 한글 이름 그대로


def test_도구_이름_제안():
    taken = set()
    assert infer.tool_name("/poList.do", "selectPoList", "read", taken) == "get_po_list"
    assert infer.tool_name("/x.do", "selectPoList", "read", taken) == "get_po_list_2"            # 겹치면 번호를 붙인다
    assert infer.tool_name("/poSave.do", "poSave", "write", taken) == "po_save"
    assert infer.tool_name("/chart/monthly.do", "", "read", taken) == "get_monthly"
    assert infer.tool_name("/searchVend.do", "searchVend", "read", taken) == "search_vend"       # 이미 읽기 동사로 시작하면 그대로
    assert infer.tool_name("/1.do", "", "write", taken).startswith("api_")


def test_화면_문구를_도구_제목으로():
    assert infer.screen_title("발주 현황 > 조회 버튼 클릭") == "발주 현황 조회" and infer.screen_title("월별 발주 현황 > 화면 열기") == "월별 발주 현황"
    assert infer.screen_title("") == ""


# ---------------------------------------------------------------- 병합
def build(scan_eps, observed, **kw):
    crawl = CrawlResult(observed=observed, login_path=kw.get("login_path", "/po/loginProc.do"))
    return merge.build(SimpleNamespace(endpoints=scan_eps) if scan_eps is not None else None, crawl if observed is not None else None, POLICY, Masker())


def test_소스와_트래픽을_경로로_맞춰_근거를_나눈다():
    res = build([ep("/poList.do", sql="SELECT", fn="selectPoList"), ep("/poDetail/{poNo}", params=[sp("poNo", required=True, loc="path")]), ep("/poSave.do", "POST", "write", sql="INSERT"),
                 ep("/loginProc.do", "POST", "read", sql="SELECT")],
                [obs("http://h:8080/po/poList.do?fromDt=1", body='{"a":1}'), obs("http://h:8080/po/poDetail/PO-1", body='{"a":1}'),
                 obs("http://h:8080/po/common/codeList.do?grpCd=A", body='{"a":1}'), obs("http://h:8080/po/loginProc.do", method="POST", blocked=True)])
    by = {a["path"]: a for a in res["apis"]}
    assert {p: a["ev"] for p, a in by.items()} == {"/poList.do": "both", "/poDetail/{poNo}": "both", "/poSave.do": "src", "/common/codeList.do": "tr"}
    assert res["stats"] == {"both": 2, "src": 1, "tr": 1}
    assert any("로그인·로그아웃 요청 1건" in n for n in res["notes"]) and any("소스의 로그인·로그아웃 매핑 1개" in n for n in res["notes"])
    detail = by["/poDetail/{poNo}"]
    assert [p["o"] for p in detail["params"] if p["loc"] == "path"] == ["poNo"] and detail["params"][0]["req"] == 1


def test_확장자와_메서드가_달라도_같은_API_로_본다():
    res = build([ep("/poList", method=None, mode="read")], [obs("http://h:8080/po/poList.do")])
    assert [(a["ev"], a["m"], a["path"]) for a in res["apis"]] == [("both", "GET", "/poList.do")]      # 실제로 나간 주소를 따른다


def test_소스에만_있는_API_의_메서드는_읽기_쓰기로_정한다():
    res = build([ep("/a.do", method=None, mode="read"), ep("/b.do", method=None, mode="write")], [])
    assert [(a["path"], a["m"], a["ev"]) for a in res["apis"]] == [("/a.do", "GET", "src"), ("/b.do", "POST", "src")]


def test_범위_밖_요청은_근거_분류에서_빠진다():
    res = build(None, [obs("http://other:9/sso/userInfo.do", out=True)])
    a = res["apis"][0]
    assert (a["ev"], a["verify"]["k"], res["stats"]) == ("out", "out", {"both": 0, "src": 0, "tr": 0})


def test_읽기_쓰기_판정은_소스의_매퍼가_먼저다():
    res = build([ep("/a.do", "POST", "read", sql="SELECT")], [obs("http://h:8080/po/a.do", method="POST", blocked=True)])
    assert res["apis"][0]["mode"] == "read"                       # POST 라도 SELECT 만 부르는 조회다
    assert build(None, [obs("http://h:8080/po/b.do", method="POST", blocked=True)])["apis"][0]["mode"] == "write"
    assert build(None, [obs("http://h:8080/po/c.do")])["apis"][0]["mode"] == "read"


def test_캡처한_요청_응답에는_쿠키와_개인정보가_없다():
    res = build(None, [obs("http://h:8080/po/p.do?tel=010-1111-2222&userPw=secret", body=json.dumps({"TEL": "010-1234-5678", "NAME": "홍길동"}))])
    tr = res["apis"][0]["tr"]
    assert "010-1111-2222" not in tr["req"] and "secret" not in tr["req"] and "Cookie: ••••••••" in tr["req"] and "X-Requested-With: XMLHttpRequest" in tr["req"]
    assert "010-1234-5678" not in tr["res"] and "***-****-5678" in tr["res"] and "홍길동" in tr["res"]


def test_마무리는_이름과_추천을_정하고_도구가_될_수_없는_것을_가른다():
    res = build([ep("/poList.do", fn="selectPoList", sql="SELECT", title="발주 목록 조회"), ep("/old.do", dep=True, sql="SELECT"), ep("/down.do", kind="file", sql="SELECT"),
                 ep("/gone.do", sql="SELECT"), ep("/poSave.do", "POST", "write", sql="INSERT", fn="poSave")], [obs("http://h:8080/po/poList.do?a=1", body='{"x":1}')])
    by = {a["path"]: a for a in res["apis"]}
    by["/poList.do"]["verify"] = {"k": "ok", "code": 200, "ms": 3}
    by["/gone.do"]["verify"] = {"k": "404", "code": 404}
    by["/poSave.do"]["verify"] = {"k": "stg", "code": 200, "ms": 9}
    merge.finalize(res["apis"], Masker())
    assert (by["/poList.do"]["tool"], by["/poList.do"]["rec"], by["/poList.do"]["title"]) == ("get_po_list", "yes", "발주 목록 조회")
    assert by["/poSave.do"]["tool"] == "po_save" and by["/poSave.do"]["rec"] == "yes" and by["/poSave.do"]["confirmQ"].endswith("실행할까요?")
    for path, why in (("/old.do", "Deprecated"), ("/down.do", "파일"), ("/gone.do", "없는 주소")):
        assert by[path]["tool"] is None and by[path]["rec"] == "no" and why in by[path]["recNote"], path


def test_자동_저장처럼_반복되는_차단_요청은_추천하지_않는다():
    blocked = [obs("http://h:8080/po/prDraftSave.do", method="POST", blocked=True) for _ in range(3)]
    res = build(None, blocked)
    res["apis"][0]["verify"] = {"k": "block"}
    merge.finalize(res["apis"], Masker())
    assert (res["apis"][0]["rec"], res["apis"][0]["tool"]) == ("no", "pr_draft_save")


# ---------------------------------------------------------------- 응답 봉투, 라우터
def test_개요_API_와_오류_응답(ieum_state):
    app = FastAPI()
    from app.ieum.routers import router
    app.include_router(router)
    c = TestClient(app)
    d = c.get("/api/ieum/discovery/").json()["resultData"]
    assert set(d) >= {"capabilities", "defaults", "jobs", "demo"} and d["defaults"]["ban"][:2] == ["삭제", "저장"] and d["demo"]["account"] == DEMO_USER_ID
    assert d["demo"]["base"].endswith("/demo-legacy/po") and d["demo"]["repo"].endswith("po-web")
    assert c.get("/api/ieum/discovery/jobs/nope/").status_code == 404
    assert c.get("/api/ieum/discovery/jobs/nope/shot").status_code == 404
    bad = c.post("/api/ieum/discovery/jobs/", json={"git": True, "approved": False})
    assert (bad.status_code, bad.json()["resultMsg"]) == (400, "운영 시스템 담당자의 탐색 승인을 받았는지 확인해 주세요.")
    assert c.post("/api/ieum/discovery/jobs/nope/register/", json={"ids": []}).status_code == 404


# ---------------------------------------------------------------- 작업 수명
SCHEDULED = {**GOOD, "git": True, "crawl": False, "stg": False, "when": "at", "startTime": "03:00", "repo": "/anything"}


def test_예약한_작업은_시작하지_않고_비밀은_금고에만_있다(ieum_state):
    job = jobs.start(SCHEDULED)
    d = job.d
    assert (d["status"], d["startAt"] > time.time()) == ("scheduled", True)
    stored = (ieum_state / "discovery.jobs.json").read_text(encoding="utf-8")
    assert "pw" not in json.loads(stored)[0]["opts"] and '"password"' not in stored and '"token"' not in stored
    assert credentials.get("disc:" + d["id"]) == {"username": "svc", "password": "pw", "token": "tk"}
    assert [j["id"] for j in jobs.list_jobs()] == [d["id"]]
    jobs.cancel(d["id"])
    assert jobs.get(d["id"]).d["status"] == "cancelled"
    jobs.delete(d["id"])
    assert jobs.list_jobs() == [] and credentials.get("disc:" + d["id"]) == {}


def test_다른_탐색이_돌고_있으면_새_탐색을_받지_않는다(ieum_state):
    first = jobs.start(SCHEDULED)
    first.d["status"] = "running"
    with pytest.raises(jobs.JobError, match="다른 탐색이 진행 중"):
        jobs.start(SCHEDULED)
    first.d["status"] = "failed"


def test_브라우저가_없으면_화면_탐색을_시작하지_않는다(ieum_state, monkeypatch):
    monkeypatch.setattr(jobs, "capabilities", lambda: {"playwright": True, "browser": None, "git": True})
    with pytest.raises(jobs.JobError, match="브라우저가 없어"):
        jobs.start({**SCHEDULED, "crawl": True})


def test_서버가_다시_뜨면_돌던_작업은_중단으로_표시한다(ieum_state):
    jobs.store.save([{"id": "abc", "name": "x", "status": "running", "createdAt": 1.0, "opts": {"git": True, "crawl": False}, "stage": {"src": "run", "web": "skip", "merge": "wait", "verify": "wait", "review": "wait"},
                      "seq": 0, "events": [], "apis": [], "notes": [], "stats": {}, "error": None, "registered": 0, "act": ""},
                     {"id": "sch", "name": "y", "status": "scheduled", "createdAt": 2.0, "opts": {"git": True, "crawl": False}, "stage": {}, "seq": 0, "events": [], "apis": [], "notes": [], "stats": {}, "error": None,
                      "registered": 0, "act": ""}])
    jobs._REG["dir"] = None                      # 새 프로세스가 처음 읽는 것과 같게
    got = {j["id"]: j for j in jobs.list_jobs()}
    assert (got["abc"]["status"], got["abc"]["stage"]["src"], "다시 시작" in got["abc"]["error"]) == ("interrupted", "fail", True)
    assert got["sch"]["status"] == "scheduled"                                  # 예약은 그대로 둔다


def test_등록은_탐색이_끝난_작업에만_된다(ieum_state):
    job = jobs.start(SCHEDULED)
    with pytest.raises(jobs.JobError, match="끝난 뒤"):
        jobs.register(job.d["id"], ["x"])
    with pytest.raises(KeyError):
        jobs.get("nope")


def test_이벤트는_번호순으로_쌓이고_번호_이후만_돌려준다(ieum_state):
    job = jobs.start(SCHEDULED)
    for i in range(5):
        job.emit("web", "req", m="GET", p=f"/{i}", tag="cap")
    v = job.view(after=3)
    assert [e["p"] for e in v["events"]] == ["/3", "/4"] and v["seq"] == 5 and v["more"] is False
    assert [e["seq"] for e in job.view(after=0, limit=2)["events"]] == [1, 2] and job.view(after=0, limit=2)["more"] is True


# ---------------------------------------------------------------- 세션 로그인, 검증 호출 (시연용 레거시 사이트)
def demo_base(server, env="po"):
    return f"{server}/demo-legacy/{env}"


def test_로그인_화면을_읽어_레시피를_만들고_로그인한다(ieum_server):
    base = demo_base(ieum_server)
    recipe = session_auth.discover_recipe(base + "/login.do", lambda u: u.replace(base, ""))
    assert (recipe["userField"], recipe["passField"], recipe["extra"], recipe["loginRel"], recipe["actionRel"]) == ("userId", "userPw", {"returnUrl": "main.do"}, "/login.do", "/loginProc.do")
    cookies = session_auth.login(base, {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})
    assert "JSESSIONID" in cookies
    with pytest.raises(session_auth.LoginError, match="로그인하지 못했습니다"):
        session_auth.login(base, {"recipe": recipe, "username": DEMO_USER_ID, "password": "wrong"})
    # 운영과 스테이징은 쿠키가 섞이지 않지만, 같은 레시피로 스테이징에도 로그인할 수 있다
    assert "JSESSIONID" in session_auth.login(demo_base(ieum_server, "po-stg"), {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})


def test_세션_만료_판정():
    assert session_auth.expired(401, None, "", "") and session_auth.expired(302, "http://h/po/login.do", "", "") and not session_auth.expired(302, "http://h/po/main.do", "", "")
    assert session_auth.expired(200, None, "text/html", '<input type="password">') and not session_auth.expired(200, None, "application/json", '{"a":1}')


def demo_login(server):
    base = demo_base(server)
    recipe = session_auth.discover_recipe(base + "/login.do", lambda u: u.replace(base, ""))
    return base, recipe


def po_count(server):
    """운영 시연 사이트의 발주 건수. 쓰기가 운영에 닿았는지 알아내려고 직접 로그인해서 센다."""
    base, recipe = demo_login(server)
    cookies = session_auth.login(base, {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})
    r = httpx.get(base + "/poList.do", params={"fromDt": "20200101", "toDt": "20991231"}, headers={"X-Requested-With": "XMLHttpRequest", "Cookie": f"JSESSIONID={cookies['JSESSIONID']}"})
    return r.json()["totalCnt"]


def test_검증은_읽기만_운영에_부르고_쓰기는_스테이징에서만_부른다(ieum_server):
    base, recipe = demo_login(ieum_server)
    before = po_count(ieum_server)
    scan = SimpleNamespace(endpoints=[
        ep("/poList.do", sql="SELECT", fn="selectPoList"), ep("/poExcelDown.do", kind="file", sql="SELECT"), ep("/oldPoList.do", dep=True, sql="SELECT"), ep("/nothing.do", sql="SELECT"),
        ep("/poDetail.do", sql="SELECT", params=[sp("poNo", required=True)]), ep("/deletePo.do", sql="SELECT"),
        ep("/poSave.do", "POST", "write", sql="INSERT", params=[sp("vendCd", "String", loc="form"), sp("itemCd", "String", loc="form"), sp("qty", "int", loc="form"), sp("unitPrice", "int", loc="form")]),
        ep("/poApprove.do", "POST", "write", sql="UPDATE", params=[sp("poNo", required=True, loc="form")])])
    pol = Policy(base=base, delay_ms=0)
    apis = merge.build(scan, None, pol, Masker())["apis"]
    events = []
    opts = {"stg": True, "stgUrl": demo_base(ieum_server, "po-stg")}
    verify.Verifier(pol, [], recipe, {"username": DEMO_USER_ID, "password": DEMO_PASSWORD}, opts, emit=lambda l, k, **f: events.append((l, k, f)), cancelled=lambda: False).run(apis)
    v = {a["path"]: a["verify"] for a in apis}
    assert (v["/poList.do"]["k"], v["/poExcelDown.do"]["k"], v["/nothing.do"]["k"]) == ("ok", "file", "404")
    assert v["/oldPoList.do"]["k"] == "404"                                                # 소스에 @Deprecated 로 남은 옛 API 는 운영에 실제로 없다
    assert v["/poDetail.do"] == {"k": "none", "note": "필수 파라미터의 값을 몰라 호출하지 않았습니다"}
    assert v["/deletePo.do"]["k"] == "none" and "쓰기처럼" in v["/deletePo.do"]["note"]
    assert (v["/poSave.do"]["k"], v["/poApprove.do"]["k"]) == ("stg", "stgerr")           # 스테이징: 저장은 되고, 없는 발주 승인은 실패
    assert any(e[2].get("env") == "stg" for e in events) and all(e[0] == "vfy" for e in events)
    assert po_count(ieum_server) == before                                                # 운영에는 아무것도 쓰이지 않았다
    # 스테이징을 지정하지 않으면 쓰기는 호출하지 않는다
    apis2 = merge.build(scan, None, pol, Masker())["apis"]
    verify.Verifier(pol, [], recipe, {"username": DEMO_USER_ID, "password": DEMO_PASSWORD}, {"stg": False}, emit=lambda *a, **k: None, cancelled=lambda: False).run(apis2)
    assert {a["path"]: a["verify"]["k"] for a in apis2}["/poSave.do"] == "none"


def test_로그인하지_못하면_검증하지_않고_표시한다(ieum_server):
    base, recipe = demo_login(ieum_server)
    pol = Policy(base=base, delay_ms=0)
    apis = merge.build(SimpleNamespace(endpoints=[ep("/poList.do", sql="SELECT")]), None, pol, Masker())["apis"]
    verify.Verifier(pol, [], recipe, {"username": DEMO_USER_ID, "password": "wrong"}, {}, emit=lambda *a, **k: None, cancelled=lambda: False).run(apis)
    assert apis[0]["verify"]["k"] in ("err", "none")                  # 로그인 화면으로 돌려보내는 응답을 성공으로 세지 않는다


def test_검증_호출은_취소하면_멈춘다(ieum_server):
    base, recipe = demo_login(ieum_server)
    pol = Policy(base=base, delay_ms=0)
    apis = merge.build(SimpleNamespace(endpoints=[ep("/poList.do", sql="SELECT"), ep("/vendList.do", sql="SELECT")]), None, pol, Masker())["apis"]
    verify.Verifier(pol, [], recipe, {"username": DEMO_USER_ID, "password": DEMO_PASSWORD}, {}, emit=lambda *a, **k: None, cancelled=lambda: True).run(apis)
    assert [a["verify"]["k"] for a in apis] == ["none", "none"]


# ---------------------------------------------------------------- 소스 저장소 준비
@pytest.mark.parametrize("spec,msg", [("", "입력해 주세요"), ("ext::sh -c 'touch /tmp/x'", "형식"), ("-oProxyCommand=x", "형식"), ("/etc", "허용한 디렉터리가 아닙니다"),
                                      ("/definitely/not/here", "찾을 수 없습니다"), ("file:///etc", "허용한 디렉터리가 아닙니다")])
def test_위험하거나_허용되지_않은_저장소는_거부한다(spec, msg):
    with pytest.raises(repo.SourceError, match=msg):
        repo.prepare(spec)


def test_허용된_로컬_폴더만_그대로_읽는다(tmp_path, monkeypatch):
    (tmp_path / "svc").mkdir()
    with pytest.raises(repo.SourceError):
        repo.prepare(str(tmp_path / "svc"))
    monkeypatch.setenv("IEUM_LOCAL_REPO_ROOTS", str(tmp_path))
    root, cleanup, name = repo.prepare(str(tmp_path / "svc"))
    assert (root, name) == ((tmp_path / "svc").resolve(), "svc")
    cleanup()
    assert (tmp_path / "svc").exists()                                  # 로컬 폴더는 지우지 않는다
    assert repo.count_files(tmp_path) == 0


def test_내려받기_실패는_토큰을_드러내지_않는다():
    with pytest.raises(repo.SourceError) as e:
        repo.prepare("https://127.0.0.1:9/nope.git", token="SUPERSECRETTOKEN")
    assert "SUPERSECRETTOKEN" not in str(e.value) and "저장소를" in str(e.value)


# ---------------------------------------------------------------- 소스 분석 격리
PATHOLOGICAL = "from fastapi import FastAPI\napp = FastAPI()\n" + "@app.get('/a'\n" * 50000          # 열린 데코레이터 5만 개: 분석기가 오래 헤맨다


def test_격리한_소스_분석은_같은_결과를_스트리밍한다():
    from app.ieum.discovery import scan
    from app.ieum.discovery.repo import DEMO_ROOT
    root, files = DEMO_ROOT / "po-web", []
    got = scan_proc.run(root, "auto", on_file=lambda info, eps: files.append((info.file.rsplit("/", 1)[-1], len(eps))))
    want = scan.scan(root, "auto")
    assert [(e.method, e.path, e.mode, e.sql, e.mapper) for e in got.endpoints] == [(e.method, e.path, e.mode, e.sql, e.mapper) for e in want.endpoints]
    assert got.framework == want.framework and len(files) == 6 and ("PoController.java", 9) in files


def test_격리한_분석도_오류와_취소를_그대로_전한다():
    with pytest.raises(ValueError, match="찾을 수 없습니다"):
        scan_proc.run("/definitely/not/here")
    t = time.time()
    with pytest.raises(scan_proc.ScanAborted, match="멈췄습니다"):
        scan_proc.run(repo.DEMO_ROOT / "po-web", should_cancel=lambda: True)
    assert time.time() - t < 3 and multiprocessing.active_children() == []


def test_병적인_소스는_시간_제한에서_강제로_끝내고_서버는_멈추지_않는다(tmp_path):
    (tmp_path / "main.py").write_text(PATHOLOGICAL)
    t = time.time()
    with pytest.raises(scan_proc.ScanAborted, match="3초 안에 끝나지 않아"):
        scan_proc.run(tmp_path, "auto", timeout=3)
    assert time.time() - t < 8 and multiprocessing.active_children() == []              # 자식 프로세스가 남지 않는다


def test_병적인_저장소로_탐색을_시작하면_작업이_실패로_끝난다(ieum_state, tmp_path, monkeypatch):
    (tmp_path / "svc").mkdir()
    (tmp_path / "svc" / "main.py").write_text(PATHOLOGICAL)
    monkeypatch.setenv("IEUM_LOCAL_REPO_ROOTS", str(tmp_path))
    monkeypatch.setattr(scan_proc, "SCAN_TIMEOUT", 3)
    job = jobs.start({**GOOD, "crawl": False, "stg": False, "base": "", "repo": str(tmp_path / "svc")})
    deadline = time.time() + 30
    while job.d["status"] == "running" and time.time() < deadline:
        time.sleep(0.2)
    assert job.d["status"] == "failed" and "3초 안에 끝나지 않아" in job.d["error"] and job.d["stage"]["src"] == "fail"


def test_소스에_박힌_비밀_리터럴은_스니펫에서_가린다():
    code = 'String dbPassword = "P@ssw0rd!";  // 쓰면 안 되는 습관\nprivate static final String API_KEY="abcd-1234";\nString name = "홍길동"; token: \'xyz\''
    out = merge.scrub_snippet(code)
    assert "P@ssw0rd" not in out and "abcd-1234" not in out and "xyz" not in out and "홍길동" in out and masking.HIDDEN in out
    res = build([ep("/a.do", sql="SELECT")], [])
    res_eps = res["apis"][0]["src"]["snippet"]
    assert res_eps == "@RequestMapping\npublic Map fn() {}"                  # 비밀이 없는 스니펫은 그대로다

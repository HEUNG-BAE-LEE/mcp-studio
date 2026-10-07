"""시연용 레거시 구매관리 사이트 테스트: 로그인과 세션, WAF 흉내(X-Requested-With), 화면, JSON 엔드포인트, 운영/스테이징 격리.

라우터만 실은 앱을 TestClient 로 부른다. 사이트 상태는 `make_router` 인스턴스 안에 있어 테스트마다 새로 만든다.
"""
import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ieum.demo_legacy import data, site
from app.ieum.routers import demo_legacy

OP, STG = "/demo-legacy/po", "/demo-legacy/po-stg"
XHR = {"X-Requested-With": "XMLHttpRequest"}
JSON_TYPE = "application/json;charset=UTF-8"
FORM_OK = dict(vendCd="V0012", itemCd="P-10023", qty="3", unitPrice="12,500")

PAGES = ["main.do", "poListView.do", "poRegView.do", "prListView.do", "prRegView.do", "vendListView.do", "statView.do"]
GET_APIS = [
    "poList.do", "poDetail.do?poNo=PO-2609-0142", "poExcelDown.do", "oldPoList.do", "vendList.do", "itemPrice.do?itemCd=P-10023",
    "prList.do", "budgetRemain.do?deptCd=D1030&yyyy=2026", "chart/monthly.do?yyyy=2026", "common/codeList.do?grpCd=PO_STTS",
]
POST_APIS = ["poSave.do", "poApprove.do", "prDraftSave.do", "prSubmit.do"]


def login(client, base=OP, user=site.DEMO_USER_ID, pw=site.DEMO_PASSWORD):
    """폼 로그인. 이 경로는 X-Requested-With 가 필요 없다."""
    return client.post(base + "/loginProc.do", data={"userId": user, "userPw": pw, "returnUrl": "main.do"})


def session_id(response):
    return re.search(r"JSESSIONID=([0-9A-F]+)", response.headers["set-cookie"]).group(1)


class Env:
    """한 환경(운영/스테이징)에 로그인한 채 JSON 엔드포인트와 화면을 부르는 도우미."""

    def __init__(self, client, base):
        self.client, self.base = client, base
        assert login(client, base).status_code == 302

    def get(self, path, **params):
        return self.client.get(self.base + "/" + path, params=params, headers=XHR)

    def post(self, path, **form):
        return self.client.post(self.base + "/" + path, data=form, headers=XHR)

    def page(self, path):
        return self.client.get(self.base + "/" + path)

    def po_nos(self, **params):
        return [r["PO_NO"] for r in self.get("poList.do", **params).json()["resultList"]]


@pytest.fixture
def client():
    """운영과 스테이징을 새로 만들어 실은 앱. follow_redirects=False 라 302 를 그대로 본다."""
    app = FastAPI()
    app.include_router(site.make_router("op", OP), prefix=OP)
    app.include_router(site.make_router("stg", STG), prefix=STG)
    return TestClient(app, follow_redirects=False)


@pytest.fixture
def op(client):
    return Env(client, OP)


@pytest.fixture
def stg(client):
    return Env(client, STG)


# ---------------------------------------------------------------- 로그인과 세션
def test_로그인_성공은_main_do로_302하고_JSESSIONID_쿠키를_준다(client):
    r = login(client)
    assert r.status_code == 302 and r.headers["location"] == OP + "/main.do"
    assert re.fullmatch(r"JSESSIONID=[0-9A-F]{32}; Path=/demo-legacy/po; HttpOnly", r.headers["set-cookie"])
    assert login(client, STG).headers["set-cookie"].endswith("; Path=/demo-legacy/po-stg; HttpOnly")


@pytest.mark.parametrize("user,pw", [(site.DEMO_USER_ID, "틀린비밀번호"), ("someone", site.DEMO_PASSWORD), ("", "")])
def test_로그인_실패는_login_do_err_1로_302하고_쿠키가_없다(client, user, pw):
    r = login(client, OP, user, pw)
    assert r.status_code == 302 and r.headers["location"] == OP + "/login.do?err=1"
    assert "set-cookie" not in r.headers
    assert "아이디 또는 비밀번호가 올바르지 않습니다." in client.get(r.headers["location"]).text


def test_로그인_화면은_폼과_숨김_returnUrl을_가지고_환경을_표시한다(client):
    r = client.get(OP + "/login.do")
    assert r.status_code == 200 and r.headers["content-type"] == "text/html;charset=UTF-8"
    for part in ['<form id="loginForm" method="post" action="loginProc.do">', '<input type="text" name="userId" id="userId">',
                 '<input type="password" name="userPw" id="userPw">', '<input type="hidden" name="returnUrl" value="main.do">',
                 '<button type="submit" id="btnLogin">로그인</button>']:
        assert part in r.text
    assert r.text.count("<h2>") == 1 and "아이디 또는 비밀번호가 올바르지 않습니다." not in r.text  # 실패 문구는 err=1 일 때만
    assert "(스테이징)" not in r.text and "구매관리시스템(스테이징)" in client.get(STG + "/login.do").text


def test_로그인한_세션이_login_do나_루트를_열면_main_do로_302(op):
    for path in ("/login.do", "/"):
        r = op.client.get(OP + path)
        assert r.status_code == 302 and r.headers["location"] == OP + "/main.do"


@pytest.mark.parametrize("base", [OP, STG])
@pytest.mark.parametrize("headers", [{}, XHR], ids=["헤더없음", "XHR"])
def test_세션이_없으면_보호된_경로는_XHR이어도_login_do로_302(client, base, headers):
    for path in PAGES + GET_APIS + ["logout.do"]:
        r = client.get(base + "/" + path, headers=headers)
        assert r.status_code == 302 and r.headers["location"] == base + "/login.do", path
    for path in POST_APIS:
        r = client.post(base + "/" + path, data={"poNo": "PO-2609-0142"}, headers=headers)
        assert r.status_code == 302 and r.headers["location"] == base + "/login.do", path


def test_로그아웃은_세션을_지우고_login_do로_302(op):
    assert op.get("poList.do").status_code == 200
    r = op.client.get(OP + "/logout.do")
    assert r.status_code == 302 and r.headers["location"] == OP + "/login.do"
    assert op.get("poList.do").status_code == 302  # 쿠키는 남아 있어도 서버가 세션을 잊었다
    assert login(op.client).status_code == 302 and op.get("poList.do").status_code == 200


def test_X_Requested_With가_없는_JSON_요청은_400(op):
    for path in GET_APIS:
        r = op.client.get(OP + "/" + path)
        assert r.status_code == 400 and r.json() == {"RSLT": "E400", "MSG": "비정상 요청입니다."}, path
        assert r.headers["content-type"] == JSON_TYPE
    for path in POST_APIS:
        assert op.client.post(OP + "/" + path, data={"poNo": "PO-2609-0142"}).status_code == 400, path
    assert op.client.get(OP + "/poList.do", headers={"X-Requested-With": "curl"}).status_code == 400  # 값이 달라도 막는다
    assert all(op.page(path).status_code == 200 for path in PAGES)  # 화면(HTML)은 이 헤더를 요구하지 않는다


def test_쓰기_엔드포인트는_POST만_받는다(op):
    assert all(op.get(path).status_code == 405 for path in POST_APIS)
    assert op.client.post(OP + "/poList.do", headers=XHR).status_code == 405


# ---------------------------------------------------------------- 발주
def test_poList는_기본_기간의_발주를_최근순으로_준다(op):
    r = op.get("poList.do", fromDt="20260901", toDt="20260930", vendCd="", sttsCd="")
    body = r.json()
    assert r.status_code == 200 and r.headers["content-type"] == JSON_TYPE and body["RSLT"] == "0000"
    assert body["totalCnt"] == len(body["resultList"]) == 6
    assert body["resultList"][0] == {
        "PO_NO": "PO-2609-0142", "VEND_CD": "V0012", "VEND_NM": "한빛상사", "PO_AMT": "4,850,000", "PO_STTS_CD": "20",
        "PO_YMD": "20260926", "CHARGER_NM": "홍길동", "CHARGER_TEL": "010-4821-5678", "CHARGER_EML": "gildong.hong@hanbit.local"}
    dates = [row["PO_YMD"] for row in body["resultList"]]
    assert dates == sorted(dates, reverse=True)


def test_poList는_레거시_형식을_따른다(op):
    rows = op.get("poList.do").json()["resultList"]
    assert len(rows) == 8
    for row in rows:
        assert all(isinstance(v, str) for v in row.values())  # 숫자도 문자열
        assert re.fullmatch(r"[0-9]{1,3}(,[0-9]{3})*", row["PO_AMT"]) and re.fullmatch(r"[0-9]{8}", row["PO_YMD"])
        assert row["PO_STTS_CD"] in {"10", "20", "30", "90"}
        assert re.fullmatch(r"01[0-9]-[0-9]{4}-[0-9]{4}", row["CHARGER_TEL"]) and "@" in row["CHARGER_EML"]  # 마스킹 시험용


def test_poList_필터(op):
    assert len(op.po_nos(fromDt="", toDt="", vendCd="", sttsCd="")) == 8  # 빈 조건은 걸지 않는다
    assert sorted(op.po_nos(fromDt="20260801", toDt="20260831")) == ["PO-2608-0164", "PO-2608-0187"]
    assert sorted(op.po_nos(vendCd="V0012")) == ["PO-2609-0127", "PO-2609-0142"]
    assert sorted(op.po_nos(sttsCd="20")) == ["PO-2609-0136", "PO-2609-0142"]
    assert op.po_nos(vendCd="V0015", sttsCd="10") == ["PO-2609-0131"]
    assert op.po_nos(fromDt="20260926", toDt="20260926") == ["PO-2609-0142"]  # 양 끝 날짜를 포함한다
    assert op.get("poList.do", vendCd="V9999").json() == {"RSLT": "0000", "totalCnt": 0, "resultList": []}
    for params in ({"fromDt": "2026-09-01"}, {"toDt": "9월"}):  # YYYYMMDD 가 아니면 막는다
        r = op.get("poList.do", **params)
        assert r.status_code == 400 and r.json()["RSLT"] == "E400"


def test_poDetail은_상세와_품목을_주고_없는_발주는_404(op):
    r = op.get("poDetail.do", poNo="PO-2609-0142")
    po = r.json()["po"]
    assert r.status_code == 200 and r.json()["RSLT"] == "0000"
    assert po["PAY_TERM"] == "30" and po["PO_AMT"] == "4,850,000"
    assert po["ITEMS"][0] == {"ITEM_CD": "P-10023", "ITEM_NM": "A4 복사용지 80g", "QTY": "20", "UNIT_PRICE": "12,500"}
    row = next(x for x in op.get("poList.do").json()["resultList"] if x["PO_NO"] == "PO-2609-0142")
    assert all(po[k] == v for k, v in row.items())  # 목록 행의 필드를 그대로 포함한다
    missing = op.get("poDetail.do", poNo="PO-0000-0000")
    assert missing.status_code == 404 and missing.json() == {"RSLT": "E404", "MSG": "발주를 찾을 수 없습니다."}
    assert op.get("poDetail.do").status_code == 400


def test_모든_발주의_금액은_품목_합계와_같다(op):
    for po_no in op.po_nos():
        po = op.get("poDetail.do", poNo=po_no).json()["po"]
        total = sum(int(i["QTY"]) * int(i["UNIT_PRICE"].replace(",", "")) for i in po["ITEMS"])
        assert data.won(total) == po["PO_AMT"], po_no


def test_poSave는_필수값이_빠지면_400이고_일련번호를_쓰지_않는다(op):
    for missing in FORM_OK:
        r = op.post("poSave.do", **{k: v for k, v in FORM_OK.items() if k != missing})
        assert r.status_code == 400 and r.json()["RSLT"] == "E400" and missing in r.json()["MSG"]
    for bad in (dict(qty="  "), dict(qty="abc"), dict(unitPrice="0")):
        assert op.post("poSave.do", **dict(FORM_OK, **bad)).status_code == 400
    assert op.post("poSave.do", **FORM_OK).json() == {"RSLT": "0000", "PO_NO": "PO-2610-0001"}


def test_poSave는_작성_상태_발주를_추가하고_일련번호를_올린다(op):
    first = op.post("poSave.do", payTerm="60", **FORM_OK)
    assert first.status_code == 200 and first.json() == {"RSLT": "0000", "PO_NO": "PO-2610-0001"}
    assert op.post("poSave.do", **FORM_OK).json()["PO_NO"] == "PO-2610-0002"
    rows = {r["PO_NO"]: r for r in op.get("poList.do").json()["resultList"]}
    new = rows["PO-2610-0001"]
    assert len(rows) == 10 and (new["PO_STTS_CD"], new["PO_AMT"], new["VEND_NM"]) == ("10", "37,500", "한빛상사")
    assert "PO-2610-0001" in op.po_nos(sttsCd="10")
    po = op.get("poDetail.do", poNo="PO-2610-0001").json()["po"]
    assert po["PAY_TERM"] == "60"
    assert po["ITEMS"] == [{"ITEM_CD": "P-10023", "ITEM_NM": "A4 복사용지 80g", "QTY": "3", "UNIT_PRICE": "12,500"}]
    assert "PO-2610-0001" not in op.po_nos(fromDt="20260901", toDt="20260930")  # 10월 날짜라 기본 조회 기간(9월)에는 안 보인다


def test_poSave는_쿼리와_본문을_합쳐_읽고_JSON_본문은_읽지_않는다(op):
    r = op.client.post(OP + "/poSave.do?vendCd=V0012&itemCd=P-10023", data={"qty": "1", "unitPrice": "100"}, headers=XHR)
    assert r.status_code == 200 and r.json()["RSLT"] == "0000"
    assert op.client.post(OP + "/poSave.do", json=FORM_OK, headers=XHR).status_code == 400  # 스프링 form 바인딩은 JSON 본문을 보지 않는다


def test_poApprove는_승인대기만_승인으로_바꾼다(op):
    r = op.post("poApprove.do", poNo="PO-2609-0142")
    assert r.status_code == 200 and r.json() == {"RSLT": "0000"}
    assert op.get("poDetail.do", poNo="PO-2609-0142").json()["po"]["PO_STTS_CD"] == "30"
    again = op.post("poApprove.do", poNo="PO-2609-0142")
    assert again.status_code == 409 and again.json() == {"RSLT": "E409", "MSG": "승인할 수 없는 상태입니다."}
    for po_no in ("PO-2609-0131", "PO-2609-0138", "PO-2609-0119"):  # 작성, 승인, 취소
        assert op.post("poApprove.do", poNo=po_no).status_code == 409
    missing = op.post("poApprove.do", poNo="PO-0000-0000")
    assert missing.status_code == 404 and missing.json() == {"RSLT": "E404", "MSG": "발주를 찾을 수 없습니다."}
    assert op.post("poApprove.do").status_code == 400


def test_poExcelDown은_xlsx_파일_응답이다(op):
    r = op.get("poExcelDown.do", fromDt="20260901", toDt="20260930")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert r.headers["content-disposition"] == "attachment; filename*=UTF-8''po.xlsx"
    assert r.content.startswith(b"PK\x03\x04")


def test_oldPoList는_내려간_옛_API라_404(op):
    r = op.get("oldPoList.do")
    assert r.status_code == 404 and r.json() == {"RSLT": "E404", "MSG": "더 이상 제공하지 않습니다."}
    assert r.headers["content-type"] == JSON_TYPE  # 오류 응답도 같은 형식


# ---------------------------------------------------------------- 거래처, 품목, 구매요청, 예산, 공통
def test_vendList는_상호_부분_일치로_찾는다(op):
    everyone = op.get("vendList.do", vendNm="").json()["resultList"]
    assert len(everyone) == 5 and len(op.get("vendList.do").json()["resultList"]) == 5
    assert {"VEND_CD": "V0012", "VEND_NM": "한빛상사", "BIZ_NO": "123-45-67890", "TEL": "02-555-0123"} in everyone
    assert [v["VEND_CD"] for v in op.get("vendList.do", vendNm="한빛").json()["resultList"]] == ["V0012", "V0021"]
    assert [v["VEND_NM"] for v in op.get("vendList.do", vendNm="서울").json()["resultList"]] == ["서울오피스"]
    assert op.get("vendList.do", vendNm="없는거래처").json() == {"RSLT": "0000", "resultList": []}
    assert all(re.fullmatch(r"[0-9]{3}-[0-9]{2}-[0-9]{5}", v["BIZ_NO"]) for v in everyone)  # 마스킹 시험용


def test_itemPrice는_단가를_주고_누락_400_없는_품목_404(op):
    r = op.get("itemPrice.do", itemCd="P-10023", vendCd="V0012")
    assert r.status_code == 200 and r.json() == {
        "RSLT": "0000", "ITEM_CD": "P-10023", "ITEM_NM": "A4 복사용지 80g", "UNIT_PRICE": "12,500", "VEND_CD": "V0012"}
    assert op.get("itemPrice.do", vendCd="V0012").status_code == 400
    assert op.get("itemPrice.do", itemCd="P-99999").status_code == 404


def test_prList는_부서와_상태로_거른다(op):
    rows = op.get("prList.do", deptCd="D1030", sttsCd="10").json()["resultList"]
    assert [x["PR_NO"] for x in rows] == ["PR-2609-0088", "PR-2609-0091"]
    assert rows[0] == {"PR_NO": "PR-2609-0088", "PR_TITLE": "10월 사무용품 구매", "REQ_NM": "홍길동", "PR_STTS_CD": "10", "DEPT_CD": "D1030"}
    assert len(op.get("prList.do").json()["resultList"]) == 6
    assert [x["DEPT_CD"] for x in op.get("prList.do", deptCd="D2010").json()["resultList"]] == ["D2010"]
    assert [x["PR_NO"] for x in op.get("prList.do", sttsCd="30").json()["resultList"]] == ["PR-2609-0066"]


def test_prDraftSave는_마지막_초안만_저장하고_저장_시각을_준다(op):
    r = op.post("prDraftSave.do", title="제목1", content="내용1")
    assert r.status_code == 200 and r.json()["RSLT"] == "0000" and re.fullmatch(r"[0-9]{14}", r.json()["SAVED_AT"])
    op.post("prDraftSave.do", title='제목2 "인용"', content="내용2<script>")
    page = op.page("prRegView.do").text
    assert 'value="제목2 &quot;인용&quot;"' in page and "내용2&lt;script&gt;" in page  # 초안으로 채우되 이스케이프한다
    assert "제목1" not in page


def test_prSubmit은_prNo가_없으면_400이고_성공하면_초안을_비운다(op):
    assert op.post("prSubmit.do", title="a", content="b").status_code == 400
    assert op.post("prSubmit.do", prNo=" ", title="a").status_code == 400
    op.post("prDraftSave.do", title="임시제목", content="임시본문")
    assert 'value="PR-2610-0001"' in op.page("prRegView.do").text
    r = op.post("prSubmit.do", prNo="PR-2610-0001", title="임시제목", content="임시본문")
    assert r.status_code == 200 and r.json() == {"RSLT": "0000"}
    page = op.page("prRegView.do").text
    assert "임시제목" not in page and 'value="PR-2610-0002"' in page


def test_budgetRemain은_예산_잔액을_주고_없는_부서는_404(op):
    r = op.get("budgetRemain.do", deptCd="D1030", yyyy="2026")
    assert r.status_code == 200 and r.json() == {
        "RSLT": "0000", "DEPT_CD": "D1030", "YYYY": "2026", "BUDGET_AMT": "20,000,000", "USED_AMT": "11,450,000", "REMAIN_AMT": "8,550,000"}
    assert op.get("budgetRemain.do", deptCd="D9999", yyyy="2026").status_code == 404
    assert op.get("budgetRemain.do", deptCd="D2010", yyyy="1999").status_code == 404  # 그 해 예산이 없다
    assert op.get("budgetRemain.do", yyyy="2026").status_code == 400


def test_chart_monthly는_열두_달_건수를_문자열로_준다(op):
    rows = op.get("chart/monthly.do", yyyy="2026").json()["resultList"]
    assert [x["MM"] for x in rows] == ["%02d" % m for m in range(1, 13)]
    assert rows[0] == {"MM": "01", "CNT": "42"} and all(re.fullmatch(r"[0-9]+", x["CNT"]) for x in rows)
    assert {x["CNT"] for x in op.get("chart/monthly.do", yyyy="1999").json()["resultList"]} == {"0"}


def test_common_codeList는_그룹별_코드를_주고_없는_그룹은_빈_목록(op):
    def pairs(grp):
        r = op.get("common/codeList.do", grpCd=grp)
        assert r.status_code == 200 and r.json()["RSLT"] == "0000"
        return [(x["CD"], x["CD_NM"]) for x in r.json()["resultList"]]
    assert pairs("PO_STTS") == [("10", "작성"), ("20", "승인대기"), ("30", "승인"), ("90", "취소")]
    assert pairs("PR_STTS") == [("10", "요청"), ("20", "승인"), ("30", "발주 완료")]
    assert pairs("PAY_TERM") == [("10", "현금"), ("30", "30일"), ("60", "60일")]
    assert pairs("NOPE") == [] and pairs("") == []


def test_처리_중_예외는_엔드포인트가_달라도_같은_500_본문이다(op, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("DB 연결 실패")
    monkeypatch.setattr(data.LegacyDb, "list_pos", boom)
    monkeypatch.setattr(data.LegacyDb, "add_po", boom)
    for r in (op.get("poList.do"), op.post("poSave.do", **FORM_OK)):
        assert r.status_code == 500 and r.json() == {"RSLT": "E500", "MSG": "처리 중 오류가 발생했습니다."}
        assert r.headers["content-type"] == JSON_TYPE and "DB 연결 실패" not in r.text  # 원인은 감춘다


# ---------------------------------------------------------------- 운영/스테이징 격리
def test_운영에서_바꾼_상태는_스테이징에_없다(op, stg):
    assert op.post("poSave.do", **FORM_OK).json()["PO_NO"] == "PO-2610-0001"
    assert "PO-2610-0001" in op.po_nos() and len(op.po_nos()) == 9
    assert "PO-2610-0001" not in stg.po_nos() and len(stg.po_nos()) == 8
    assert stg.post("poSave.do", **FORM_OK).json()["PO_NO"] == "PO-2610-0001"  # 스테이징의 일련번호는 따로 시작한다
    assert op.post("poApprove.do", poNo="PO-2609-0142").status_code == 200
    assert stg.get("poDetail.do", poNo="PO-2609-0142").json()["po"]["PO_STTS_CD"] == "20"
    assert stg.post("poApprove.do", poNo="PO-2609-0142").status_code == 200  # 스테이징에서는 아직 승인대기였다
    op.post("prDraftSave.do", title="운영초안", content="x")
    assert "운영초안" in op.page("prRegView.do").text and "운영초안" not in stg.page("prRegView.do").text


def test_운영_쿠키로는_스테이징에_들어갈_수_없다(client):
    sid = session_id(login(client, OP))
    # 한 쿠키 항아리 안에서도 Path 가 달라 운영 쿠키는 스테이징 요청에 실리지 않는다
    assert client.get(OP + "/main.do").status_code == 200
    stg_main = client.get(STG + "/main.do")
    assert stg_main.status_code == 302 and stg_main.headers["location"] == STG + "/login.do"
    # 항아리가 아니라 서버도 거른다: 운영 세션 ID 를 스테이징에 직접 실어도 모르는 세션이다
    raw = TestClient(client.app, follow_redirects=False)
    assert raw.get(OP + "/main.do", headers={"Cookie": "JSESSIONID=" + sid}).status_code == 200
    assert raw.get(STG + "/main.do", headers={"Cookie": "JSESSIONID=" + sid}).status_code == 302
    sid_stg = session_id(login(client, STG))
    assert raw.get(OP + "/main.do", headers={"Cookie": "JSESSIONID=" + sid_stg}).status_code == 302


def test_reset은_상태와_세션을_초기값으로_되돌린다():
    router = site.make_router("op", OP)
    app = FastAPI()
    app.include_router(router, prefix=OP)
    client = TestClient(app, follow_redirects=False)
    env = Env(client, OP)
    env.post("poSave.do", **FORM_OK)
    env.post("poApprove.do", poNo="PO-2609-0142")
    router.reset()
    assert client.get(OP + "/main.do").status_code == 302  # 세션이 지워졌다
    env = Env(client, OP)
    assert len(env.po_nos()) == 8
    assert env.get("poDetail.do", poNo="PO-2609-0142").json()["po"]["PO_STTS_CD"] == "20"
    assert env.post("poSave.do", **FORM_OK).json()["PO_NO"] == "PO-2610-0001"


# ---------------------------------------------------------------- 화면
SCREEN_TITLES = {
    "main.do": "월별 발주 현황", "poListView.do": "발주 현황", "poRegView.do": "발주 등록", "prListView.do": "구매요청함",
    "prRegView.do": "구매요청 작성", "vendListView.do": "거래처 관리", "statView.do": "통계",
}
MENU = ('<a href="main.do">메인</a> <a href="poListView.do">발주 현황</a> <a href="poRegView.do">발주 등록</a> '
        '<a href="prListView.do">구매요청</a> <a href="vendListView.do">거래처 관리</a> <a href="statView.do">통계</a>')
# 화면별로 (있어야 하는 요소, 화면 JS 가 부르는 요청 문자열)
SCREEN_PARTS = {
    "main.do": ([], ["chart/monthly.do?yyyy=2026", "common/codeList.do?grpCd=PO_STTS", "fetch(OTHER + '/demo-legacy/sso/userInfo.do')"]),
    "poListView.do": (
        ['<input id="fromDt" value="20260901">', '<input id="toDt" value="20260930">', '<select id="sttsCd">', '<option value="">전체</option>',
         '<option value="10">작성</option>', '<option value="20">승인대기</option>', '<option value="30">승인</option>', '<option value="90">취소</option>',
         '<button type="button" id="btnSearch">조회</button>', '<button type="button" id="btnReset">초기화</button>',
         '<table id="poTable"', "<tbody>", 'onclick="openDetail(', 'style="cursor:pointer"'],
        ["poList.do?fromDt=", "'&vendCd='", "'&sttsCd='", "poDetail.do?poNo=", "common/codeList.do?grpCd=PAY_TERM"]),
    "poRegView.do": (
        ['<input id="vendNm" value="한빛">', '<button type="button" id="btnVend">찾기</button>', '<button type="button" class="pick">품목 선택</button>',
         '<button type="button" id="btnSave">저장</button>', '<a href="poListView.do">취소</a>', 'data-item-cd="P-10023" data-vend-cd="V0012"'],
        ["vendList.do?vendNm=", "itemPrice.do?itemCd=", "'&vendCd='", "poSave.do"]),
    "prListView.do": (['<a class="btn" href="prRegView.do">요청 작성</a>'], ["prList.do?deptCd=D1030&sttsCd=10", "common/codeList.do?grpCd=PR_STTS"]),
    "prRegView.do": (
        ['<input id="title">', '<textarea id="content">', '<button type="button" id="btnBudget">예산 확인</button>', '<button type="button" id="btnSubmit">요청 전송</button>'],
        ["budgetRemain.do?deptCd=D1030&yyyy=2026", "prDraftSave.do", "prSubmit.do",
         "setTimeout(function () { saveDraft(); setInterval(saveDraft, 3000); }, 1500);"]),  # 1.5초 뒤부터 3초마다 자동 임시저장
    "vendListView.do": (['<input id="vendNm">', '<button type="button" id="btnVendSearch">조회</button>'], ["vendList.do?vendNm="]),
    "statView.do": ([], ["chart/monthly.do?yyyy=2026"]),
}


@pytest.mark.parametrize("path,title", SCREEN_TITLES.items())
def test_화면은_공통_틀과_h2_하나를_가진다(op, path, title):
    r = op.page(path)
    html = r.text
    assert r.status_code == 200 and r.headers["content-type"] == "text/html;charset=UTF-8"
    assert html.count("<h2>") == 1 and "<h2>%s</h2>" % title in html
    assert "구매관리시스템" in html and "(스테이징)" not in html
    assert "구매팀 테스트계정" in html and '<a href="logout.do">로그아웃</a>' in html
    assert MENU in html  # 상대 링크 그대로
    assert "<style>" in html and "<script>" in html
    assert not re.search(r'<script[^>]*\ssrc=|<link[^>]*rel="stylesheet"|(?:src|href)="https?:|@import|url\(\s*https?:', html)  # 오프라인에서 뜬다
    assert "X-Requested-With" in html and "XMLHttpRequest" in html  # 화면 JS 가 헤더를 붙인다
    for source_only in ("poExcelDown", "poApprove", "oldPoList"):  # 소스에만 있는 API 는 화면이 가리키지 않는다
        assert source_only not in html
    # 공통 틀의 id 와 화면 요소의 id 가 겹치면 getElementById 가 엉뚱한 요소를 돌려준다(textarea#content 가 그랬다)
    ids = re.findall(r'\bid="([^"]+)"', html)
    assert len(ids) == len(set(ids)), sorted(i for i in set(ids) if ids.count(i) > 1)


@pytest.mark.parametrize("path", SCREEN_PARTS)
def test_화면은_명세한_요소를_갖고_상대_경로로_엔드포인트를_부른다(op, path):
    html = op.page(path).text
    parts, requests = SCREEN_PARTS[path]
    for part in parts + requests:
        assert part in html, part
    assert not re.search(r"""fetch\(\s*['"]/""", html)  # 절대 경로가 아니라 상대 경로


def test_발주_현황은_로드_직후_조회하지_않고_조회_버튼이_부른다(op):
    html = op.page("poListView.do").text
    assert "$id('btnSearch').onclick = search;" in html
    assert not re.search(r"^search\(\);", html, re.M)  # 스크립트 최상위에서 목록을 부르지 않는다


def test_메인_화면은_호스트에_따라_다른_출처를_고른다(op):
    def origin(host):
        html = op.client.get(OP + "/main.do", headers={"Host": host}).text
        return re.search(r'var OTHER = "([^"]*)";', html).group(1)
    assert origin("localhost:8000") == "http://127.0.0.1:8000"
    assert origin("127.0.0.1:8000") == "http://localhost:8000"
    assert origin("LocalHost:9100") == "http://127.0.0.1:9100"
    assert origin("localhost") == "http://127.0.0.1"  # 기본 포트는 붙이지 않는다
    assert origin("[::1]:8000") == "http://localhost:8000"
    assert origin("localhost:abc") == "http://127.0.0.1"  # 숫자가 아닌 포트는 버린다


def test_스테이징_화면은_상단_바에_스테이징을_덧붙인다(stg):
    for path in PAGES:
        assert "구매관리시스템(스테이징)" in stg.page(path).text, path


# ---------------------------------------------------------------- 라우터 연결과 SSO
@pytest.fixture
def wired():
    """routers.demo_legacy 가 내보내는 실제 라우터(모듈 하나가 상태를 갖는다)를 앱에 싣는다. 앞뒤로 상태를 비운다."""
    demo_legacy.reset()
    app = FastAPI()  # CORS 미들웨어 없음
    app.include_router(demo_legacy.router)
    yield TestClient(app, follow_redirects=False)
    demo_legacy.reset()


def test_SSO_엔드포인트는_인증없이_CORS_허용_헤더와_함께_응답한다(wired):
    r = wired.get("/demo-legacy/sso/userInfo.do", headers={"Origin": "http://127.0.0.1:8000"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "*" and r.headers["content-type"] == JSON_TYPE
    assert r.json() == {"userId": "svc_ieum_crawl", "userNm": "테스트계정", "deptNm": "구매팀"}
    assert wired.get("/demo-legacy/sso/userInfo.do").headers["access-control-allow-origin"] == "*"  # Origin 이 없어도


def test_라우터는_운영과_스테이징을_접두사에_붙이고_reset이_둘을_비운다(wired):
    assert (site.DEMO_USER_ID, site.DEMO_PASSWORD) == ("svc_ieum_crawl", "demo-pass")
    assert demo_legacy.router.tags == ["ieum-demo-legacy"]
    op = Env(wired, OP)
    assert wired.get(STG + "/main.do").status_code == 302  # 운영에만 로그인했다
    stg = Env(wired, STG)
    op.post("poSave.do", **FORM_OK)
    stg.post("poApprove.do", poNo="PO-2609-0142")
    demo_legacy.reset()
    assert wired.get(OP + "/main.do").status_code == 302 and wired.get(STG + "/main.do").status_code == 302
    op, stg = Env(wired, OP), Env(wired, STG)
    assert len(op.po_nos()) == 8 and stg.get("poDetail.do", poNo="PO-2609-0142").json()["po"]["PO_STTS_CD"] == "20"


def test_레거시_사이트는_OpenAPI에_드러나지_않는다(wired):
    # 실제 레거시 사이트에는 명세가 없다. 앱의 /openapi.json 이 소스에만 있는 API 를 알려주면 안 된다.
    paths = wired.get("/openapi.json").json()["paths"]
    assert not [p for p in paths if p.startswith("/demo-legacy")]

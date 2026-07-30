from pathlib import Path

import pytest

from app.services.spec_parser import ParsedPage, detect_portal, parse

FIXTURE = Path(__file__).parent / "fixtures" / "datagokr_airkorea.html"
SOURCE_URL = "https://www.data.go.kr/data/15073861/openapi.do"


@pytest.fixture
def page() -> ParsedPage:
    html = FIXTURE.read_text(encoding="utf-8", errors="ignore")
    return parse(html, SOURCE_URL)


def test_지원_포털을_URL로_판정한다():
    assert detect_portal(SOURCE_URL) == "www.data.go.kr"
    assert detect_portal("https://kosis.kr/openapi/index.jsp") is None


def test_미지원_포털은_빈_결과를_준다():
    result = parse("<html><body>아무거나</body></html>", "https://example.com/x")
    assert result.operations == []
    assert result.portal == ""


def test_서비스명과_제공기관을_뽑는다(page):
    assert page.service_name == "한국환경공단_에어코리아_대기오염정보"
    assert page.provider == "한국환경공단"
    assert page.portal == "data.go.kr"


def test_상세기능_전체_목록을_읽는다(page):
    """페이지에는 하나의 명세만 실리지만, 이 서비스에 몇 개가 있는지는 알 수 있어야 한다."""
    labels = [item["label"] for item in page.available]
    assert len(labels) == 5
    assert "측정소별 실시간 측정정보 조회" in labels


def test_현재_표시중인_오퍼레이션만_수집된다(page):
    """같은 요청주소가 마크업에 두 번 실려도 하나로 합쳐져야 한다."""
    assert len(page.operations) == 1
    op = page.operations[0]
    assert op.op_name == "getMinuDustFrcstDspth"
    assert op.method == "GET"
    assert op.base_url == "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc"
    assert op.path == "/getMinuDustFrcstDspth"


def test_요청변수_표를_파라미터로_바꾼다(page):
    params = {p.name: p for p in page.operations[0].params}
    assert set(params) == {"serviceKey", "returnType", "numOfRows", "pageNo", "searchDate", "InformCode"}

    # 항목구분 '필' 만 필수로 잡힌다
    assert params["serviceKey"].required is True
    assert params["numOfRows"].required is False

    # 국문 항목명이 설명 앞에 붙어 LLM 이 한국어 질의에서 고를 근거가 된다
    assert params["InformCode"].description.startswith("통보코드")

    # 샘플데이터가 example 로, 자리표시자('-')는 걸러진다
    assert params["InformCode"].example == "PM10"
    assert params["serviceKey"].example is None


def test_샘플로_타입을_추론한다(page):
    params = {p.name: p for p in page.operations[0].params}
    assert params["numOfRows"].type == "integer"      # 샘플 100
    assert params["pageNo"].type == "integer"         # 샘플 1
    assert params["searchDate"].type == "string"      # 샘플 2020-11-14
    assert params["returnType"].type == "string"      # 샘플 xml


def test_긴_숫자는_코드로_보고_문자열로_둔다():
    """20201114 같은 값은 숫자로 보이지만 날짜다. integer 로 잡으면 호출이 깨진다."""
    from app.services.spec_parser import _infer_type

    assert _infer_type("8", "20201114")[0] == "string"
    assert _infer_type("3", "100")[0] == "integer"
    assert _infer_type("4", "")[0] == "string"


def test_출력결과_표를_응답필드로_남긴다(page):
    fields = {f["name"] for f in page.operations[0].response_fields}
    assert len(fields) >= 10
    assert "informCode" in fields or "informData" in fields


def test_명세_표가_없으면_경고를_남긴다():
    html = """<html><head><meta property="og:title" content="기관_서비스"/></head>
    <body><li><strong>요청주소</strong> http://apis.data.go.kr/X/Svc/getThing</li></body></html>"""
    page = parse(html, SOURCE_URL)
    assert len(page.operations) == 1
    assert page.operations[0].params == []
    assert any("요청변수" in w for w in page.operations[0].warnings)

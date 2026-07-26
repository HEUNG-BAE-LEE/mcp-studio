import pytest
from datetime import datetime, timedelta
from app.models import NetworkRequest
from app.services.scoring import score_request

CLICK_AT = datetime(2026, 7, 26, 5, 0, 0)

def make(url, method="POST", status=200, is_json=True, delay_ms=300):
    return NetworkRequest(
        session_id=1, request_url=url, request_method=method,
        response_status=status, is_json=is_json,
        response_preview={"isJson": is_json, "sample": {"list": [{}]}, "counts": {"list": 3}},
        duration_ms=50, occurred_at=CLICK_AT + timedelta(milliseconds=delay_ms),
    )

def test_주요_조회_api는_9점():
    score, _ = score_request(make("https://rt.molit.go.kr/pt/gis/getMarker.do"), CLICK_AT, [])
    assert score == 9

def test_로그_api는_5점_감점되어_최하위():
    marker, _ = score_request(make("https://rt.molit.go.kr/pt/gis/getMarker.do"), CLICK_AT, [])
    log, reasons = score_request(make("https://rt.molit.go.kr/pt/main/accesLog.do"), CLICK_AT, [])
    assert log < marker
    assert "로그 API" in " ".join(reasons)

def test_동일_url_중복_호출은_폴링으로_본다():
    url = "https://kosis.kr/oneid/cmmn/login/ActiveSessionFind.do"
    score, reasons = score_request(make(url), CLICK_AT, [url, url])
    assert "폴링" in " ".join(reasons)

# 로그 판정이 넓으면 진짜 업무 API가 조용히 파묻힌다.
# 아래 URL들은 모두 log/stat 문자열을 포함하지만 로그 API가 아니다.
@pytest.mark.parametrize("url", [
    "https://kosis.kr/statisticsList/selectTreeData.do",   # KOSIS 주요 API
    "https://kosis.kr/oneid/cmmn/login/ActiveSessionFind.do",
    "https://x.kr/api/catalog",
    "https://x.kr/dialog/open",
    "https://x.kr/blogPosts",
])
def test_로그가_아닌데_로그로_오인하지_않는다(url):
    _, reasons = score_request(make(url), CLICK_AT, [url])
    assert "로그 API" not in " ".join(reasons), url

@pytest.mark.parametrize("url", [
    "https://rt.molit.go.kr/pt/main/accesLog.do",   # s 하나 오타
    "https://x.kr/pt/main/accessLog.do",
    "https://x.kr/api/logs",
    "https://x.kr/analytics/collect",
    "https://x.kr/stats",
])
def test_로그_api는_확실히_잡는다(url):
    _, reasons = score_request(make(url), CLICK_AT, [url])
    assert "로그 API" in " ".join(reasons), url

def test_실거래가_세_요청의_순위():
    """영상 장면 5. getMarker가 1위, accesLog가 꼴찌여야 한다."""
    urls = [
        "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "https://rt.molit.go.kr/cmm/gis/getCenterLedCdPnu.do",
        "https://rt.molit.go.kr/pt/main/accesLog.do",
    ]
    scored = [(u, score_request(make(u), CLICK_AT, urls)[0]) for u in urls]
    scored.sort(key=lambda x: x[1], reverse=True)
    assert "getMarker.do" in scored[0][0]
    assert "accesLog.do" in scored[-1][0]

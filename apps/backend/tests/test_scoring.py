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

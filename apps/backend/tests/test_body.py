from app.services.body import parse_json_body, summarize_response

def test_json_판정은_content_type이_아니라_본문_기준():
    # 실거래가 getMarker.do는 JSON을 text/html로 반환한다
    text = '{"list":[{"a":1},{"a":2}]}'
    assert parse_json_body(text) is not None

def test_html_본문은_none():
    assert parse_json_body("<!DOCTYPE html><html></html>") is None

def test_배열은_첫_요소만_남기고_개수를_기록한다():
    text = '{"list":[{"nm":"세종"},{"nm":"디팰리스"},{"nm":"경희궁자이"}]}'
    result = summarize_response(text)
    assert result["sample"]["list"] == [{"nm": "세종"}]
    assert result["counts"]["list"] == 3

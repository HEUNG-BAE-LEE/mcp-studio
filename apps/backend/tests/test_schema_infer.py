from datetime import datetime
from app.services.schema_infer import infer_request_schema, infer_response_schema

def test_form_urlencoded_body를_스키마로_추론한다():
    body = "minX=126.9654155&minY=37.5606793&maxX=126.9911647&maxY=37.5720409&srhYear=2026&poiType=A"
    schema = infer_request_schema("POST", "https://rt.molit.go.kr/pt/gis/getMarker.do", body)
    assert set(schema["bodySchema"].keys()) == {"minX", "minY", "maxX", "maxY", "srhYear", "poiType"}
    assert schema["bodySchema"]["minX"]["type"] == "number"
    assert schema["bodySchema"]["srhYear"]["type"] == "integer"
    assert schema["bodySchema"]["poiType"]["type"] == "string"
    assert schema["bodySchema"]["minX"]["example"] == "126.9654155"

def test_쿼리스트링을_스키마로_추론한다():
    schema = infer_request_schema("GET", "https://x.kr/api?page=1&keyword=버스", None)
    assert schema["querySchema"]["page"]["type"] == "integer"
    assert schema["querySchema"]["keyword"]["type"] == "string"

def test_배열_응답의_구조를_추론한다():
    sample = {"list": [{"aprpnHsmpNm": "세종", "lo": 126.97}]}
    schema = infer_response_schema(sample)
    assert schema["properties"]["list"]["type"] == "array"
    assert schema["properties"]["list"]["items"]["properties"]["aprpnHsmpNm"]["type"] == "string"
    assert schema["properties"]["list"]["items"]["properties"]["lo"]["type"] == "number"

# 아래 세 가지는 실행 성공/실패를 직접 가르는데 지금까지 테스트가 없었다.

def test_WAF_통과_헤더를_정규_표기로_보존한다():
    from app.models import NetworkRequest
    from app.services.schema_infer import build_action_spec
    req = NetworkRequest(
        session_id=1,
        request_url="https://rt.molit.go.kr/pt/gis/getMarker.do",
        request_method="POST",
        # 실제 캡처처럼 대소문자가 뒤섞인 상태
        request_headers={
            "user-agent": "Mozilla/5.0",
            "Referer": "https://rt.molit.go.kr/pt/gis/gis.do",
            "X-REQUESTED-WITH": "XMLHttpRequest",
            "Cookie": "***",              # 마스킹된 값은 싣지 않는다
            "Authorization": "***",
            "X-Custom": "무관한 헤더",       # 보존 대상이 아니다
        },
        request_body="minX=126.9&poiType=A",
        response_status=200,
        response_preview={"isJson": True, "sample": {"list": [{}]}, "counts": {}},
        duration_ms=10,
        occurred_at=datetime(2026, 7, 26, 5, 0, 0),
    )
    spec = build_action_spec(req, "아파트 조회", "search_apartments", "설명")
    headers = spec["request"]["headers"]
    assert headers["User-Agent"] == "Mozilla/5.0"
    assert headers["Referer"] == "https://rt.molit.go.kr/pt/gis/gis.do"
    assert headers["X-Requested-With"] == "XMLHttpRequest"
    assert "Cookie" not in headers and "Authorization" not in headers
    assert "X-Custom" not in headers

def test_예시값은_기록된_그대로_보존된다():
    schema = infer_request_schema(
        "POST", "https://x.kr/a",
        "minX=126.9654155&srhYear=2026",
    )
    assert schema["bodySchema"]["minX"]["example"] == "126.9654155"
    assert schema["bodySchema"]["srhYear"]["example"] == "2026"

def test_JSON이_아닌_응답도_스펙_생성은_된다():
    from app.models import NetworkRequest
    from app.services.schema_infer import build_action_spec
    req = NetworkRequest(
        session_id=1, request_url="https://x.kr/a", request_method="GET",
        request_headers={}, request_body=None, response_status=200,
        response_preview={"isJson": False, "sample": None, "counts": {}},
        duration_ms=1, occurred_at=datetime(2026, 7, 26, 5, 0, 0),
    )
    spec = build_action_spec(req, "이름", "tool_name", "설명")
    assert spec["response"]["schema"] == {"type": "object"}

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

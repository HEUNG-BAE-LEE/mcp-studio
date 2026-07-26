import httpx
from app.models import Action
from app.services.executor import build_request, MIN_INTERVAL_SEC

SPEC = {
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "headers": {"Referer": "https://rt.molit.go.kr/pt/gis/gis.do", "X-Requested-With": "XMLHttpRequest"},
        "bodySchema": {"minX": {"type": "number"}, "poiType": {"type": "string"}},
    }
}

def test_보존된_헤더를_재현한다():
    action = Action(project_id=1, name="x", tool_name="t", action_spec=SPEC)
    req = build_request(action, {"minX": 126.9, "poiType": "A"})
    assert req["headers"]["Referer"] == "https://rt.molit.go.kr/pt/gis/gis.do"
    assert req["headers"]["X-Requested-With"] == "XMLHttpRequest"
    assert "User-Agent" in req["headers"]   # 없으면 기본값을 채운다

def test_body를_form_urlencoded로_직렬화한다():
    action = Action(project_id=1, name="x", tool_name="t", action_spec=SPEC)
    req = build_request(action, {"minX": 126.9, "poiType": "A"})
    assert "minX=126.9" in req["content"]
    assert "poiType=A" in req["content"]

def test_호출_간격이_1초_이상이다():
    assert MIN_INTERVAL_SEC >= 1.0

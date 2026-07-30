from types import SimpleNamespace

import httpx
import pytest
from app.models import Action
from app.services import executor
from app.services.executor import build_request, MIN_INTERVAL_SEC

SPEC = {
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "headers": {"Referer": "https://rt.molit.go.kr/pt/gis/gis.do", "X-Requested-With": "XMLHttpRequest"},
        "bodySchema": {"minX": {"type": "number"}, "poiType": {"type": "string"}},
    }
}


class FakeTime:
    """실제로 자지 않는 시계. 잔 시간을 기록하고 그만큼 시각을 앞당긴다."""

    def __init__(self, start=0.0):
        self.now = start
        self.sleeps = []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


def fake_httpx(responder):
    """executor가 쓰는 httpx 자리에 끼울 대역. 네트워크를 타지 않는다."""

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def request(self, method, url, headers=None, content=None):
            return responder(method, url, headers, content)

    return SimpleNamespace(Client=lambda timeout: FakeClient())


def make_action(spec=None):
    return Action(project_id=1, name="x", tool_name="t", action_spec=spec or SPEC)

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


def test_호출이_실패해도_다음_호출은_간격을_지킨다(monkeypatch):
    """타임아웃으로 예외가 나도 타임스탬프를 갱신해야 재시도가 폭주하지 않는다."""
    clock = FakeTime(start=100.0)
    monkeypatch.setattr(executor, "time", clock)
    monkeypatch.setattr(executor, "_last_call_at", 0.0)

    def 터진다(method, url, headers, content):
        raise httpx.ConnectTimeout("timeout")

    monkeypatch.setattr(executor, "httpx", fake_httpx(터진다))
    action = make_action()

    with pytest.raises(httpx.ConnectTimeout):
        executor.execute_action(action, {"minX": 126.9})

    # 실패했어도 "방금 호출했다"는 사실은 남아야 한다
    assert executor._last_call_at == 100.0
    assert clock.sleeps == []   # 첫 호출은 기다릴 이유가 없었다

    def 성공한다(method, url, headers, content):
        return SimpleNamespace(status_code=200, text='{"list":[]}')

    monkeypatch.setattr(executor, "httpx", fake_httpx(성공한다))
    result = executor.execute_action(action, {"minX": 126.9})

    assert result["status"] == 200
    assert clock.sleeps == [MIN_INTERVAL_SEC]   # 실패 직후 재시도가 1초를 기다렸다


def test_GET인데_querySchema가_없으면_조용히_버리지_않는다():
    """인자를 실을 곳이 없으면 불완전한 요청을 보내는 대신 즉시 실패한다."""
    spec = {
        "request": {
            "method": "GET",
            "urlTemplate": "https://example.go.kr/list.do",
            "headers": {},
        }
    }
    with pytest.raises(ValueError, match="querySchema"):
        build_request(make_action(spec), {"page": 1})


def test_GET은_querySchema로_쿼리스트링을_만든다():
    spec = {
        "request": {
            "method": "GET",
            "urlTemplate": "https://example.go.kr/list.do",
            "headers": {},
            "querySchema": {"page": {"type": "integer"}},
        }
    }
    req = build_request(make_action(spec), {"page": 2})
    assert req["url"] == "https://example.go.kr/list.do?page=2"
    assert req["content"] is None


# --- 인증키 주입: 기관마다 갈리는 대소문자 -------------------------------------
# 공공데이터포털 명세는 기관이 직접 쓰기 때문에 같은 인증키가 serviceKey /
# ServiceKey 로 갈린다(실측: 한 세션의 오퍼레이션 10개 중 1개가 대문자).
# 파서는 원문 표기를 그대로 옮기므로 맞춰주는 일은 executor 몫이다.

def _hidden(param: str) -> dict:
    """param 하나를 LLM 에게 감춘 querySchema."""
    return {param: {"llmEditable": False}, "numOfRows": {"llmEditable": True}}


@pytest.mark.parametrize("registered", ["serviceKey", "ServiceKey", "servicekey", "SERVICEKEY"])
@pytest.mark.parametrize("declared", ["serviceKey", "ServiceKey"])
def test_인증키는_등록_표기와_명세_표기가_달라도_주입된다(declared, registered):
    """폴백에 기대지 않고 맞는지 본다 — 그래서 무관한 키를 하나 더 둔다.

    등록된 키가 하나뿐이면 이름이 달라도 쓰는 폴백이 있어, 키가 하나인
    상태로는 대소문자 조회가 깨져 있어도 테스트가 통과해 버린다.
    """
    creds = {registered: "TEST-KEY", "다른포털": "무관한값"}
    out = executor._inject_credentials(_hidden(declared), {"numOfRows": "10"}, creds)
    assert out[declared] == "TEST-KEY"


def test_등록된_키가_하나면_이름이_달라도_그것을_쓴다():
    """포털명(data.go.kr)으로 등록하는 경우를 위한 폴백은 남아 있어야 한다."""
    out = executor._inject_credentials(_hidden("ServiceKey"), {}, {"data.go.kr": "XYZ"})
    assert out["ServiceKey"] == "XYZ"


def test_이름이_어긋나고_키가_여러개면_막는다():
    """짐작으로 아무 키나 넣으면 인증 실패를 스펙 문제로 오해하게 된다."""
    creds = {"portal-a": "AAA", "portal-b": "BBB"}
    with pytest.raises(ValueError, match="인증키"):
        executor._inject_credentials(_hidden("ServiceKey"), {}, creds)


def test_대문자_인증키도_쿼리스트링까지_실린다():
    """단위가 아니라 build_request 를 통과한 실제 URL 로 확인한다."""
    spec = {
        "request": {
            "method": "GET",
            "urlTemplate": "https://apis.data.go.kr/metal/list",
            "headers": {},
            "querySchema": _hidden("ServiceKey"),
        }
    }
    req = build_request(make_action(spec), {"numOfRows": "10"},
                        {"serviceKey": "K-1234", "다른포털": "무관한값"})
    assert "ServiceKey=K-1234" in req["url"]

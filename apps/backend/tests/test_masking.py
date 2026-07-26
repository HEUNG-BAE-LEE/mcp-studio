# apps/backend/tests/test_masking.py
from app.services.masking import mask_deep, mask_query


# PRD §7.4: password/token/apiKey/sessionId/ssn/jumin/cardNumber/cvv는
# 값이 패턴에 걸리지 않아도 키 이름만으로 가려야 한다.
def test_mask_deep은_민감_키를_값_패턴과_무관하게_가린다():
    value = {"apiKey": "abcd", "sessionId": "xyz-123", "name": "홍길동"}
    masked = mask_deep(value)
    assert masked["apiKey"] == "***"
    assert masked["sessionId"] == "***"
    assert masked["name"] == "홍길동"


def test_mask_deep은_중첩_구조_안의_민감_키도_가린다():
    value = {"user": {"cardNumber": "1111222233334444", "cvv": "123"}, "list": [{"jumin": "901231-1234567"}]}
    masked = mask_deep(value)
    assert masked["user"]["cardNumber"] == "***"
    assert masked["user"]["cvv"] == "***"
    assert masked["list"][0]["jumin"] == "***"


def test_mask_deep은_민감_키가_아니면_그대로_둔다():
    value = {"list": [{"aprpnHsmpNm": "롯데미도파광화문빌딩"}]}
    assert mask_deep(value) == value


def test_mask_query는_민감_파라미터만_가리고_구조를_보존한다():
    url = "https://rt.molit.go.kr/pt/gis/getMarker.do?minX=126.96&sessionId=abc123&jumin=901231-1234567"
    masked = mask_query(url)

    assert masked.startswith("https://rt.molit.go.kr/pt/gis/getMarker.do?")
    assert "minX=126.96" in masked
    assert "sessionId=%2A%2A%2A" in masked or "sessionId=***" in masked
    assert "901231-1234567" not in masked
    assert "abc123" not in masked


def test_mask_query는_쿼리가_없으면_그대로_반환한다():
    url = "https://rt.molit.go.kr/pt/gis/getMarker.do"
    assert mask_query(url) == url


def test_mask_query는_민감하지_않은_파라미터를_온전히_보존한다():
    url = "https://x.kr/api?a=1&b=hello&apiKey=secret"
    masked = mask_query(url)
    assert "a=1" in masked
    assert "b=hello" in masked
    assert "secret" not in masked

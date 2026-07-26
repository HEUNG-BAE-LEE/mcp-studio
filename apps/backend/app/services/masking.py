import json
import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

MASK = "***"
PATTERNS = [
    re.compile(r"\d{6}-\d{7}"),                                        # 주민등록번호
    re.compile(r"\d{4}-?\d{4}-?\d{4}-?\d{4}"),                         # 카드번호
    re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),  # JWT
]

# PRD §7.4 민감 키 규칙. Body와 Query 양쪽에 동일하게 적용한다.
# extension/lib/masking.ts의 BODY_KEYS와 이름을 맞춘다(소문자 비교).
SENSITIVE_KEYS = {
    "password", "token", "apikey", "sessionid", "ssn", "jumin", "cardnumber", "cvv",
}

def mask_patterns(text):
    """2차 마스킹. Extension의 1차 마스킹을 통과한 값 패턴을 잡는다."""
    if not isinstance(text, str):
        return text
    for pattern in PATTERNS:
        text = pattern.sub(MASK, text)
    return text

def mask_deep(value):
    """중첩 구조 안의 모든 문자열에 2차 마스킹을 적용한다.

    응답 본문에도 개인정보가 들어온다. 요청 헤더·바디만 마스킹하면
    응답 샘플에 남은 주민번호·카드번호가 그대로 저장된다.

    패턴 마스킹(mask_patterns)뿐 아니라 PRD §7.4의 민감 키 규칙도 여기서
    적용한다 — {"apiKey": "abcd"}처럼 값 자체는 패턴에 안 걸리지만 키
    이름으로 민감함을 알 수 있는 경우를 잡기 위해서다.
    """
    if isinstance(value, str):
        return mask_patterns(value)
    if isinstance(value, list):
        return [mask_deep(v) for v in value]
    if isinstance(value, dict):
        return {
            k: (MASK if k.lower() in SENSITIVE_KEYS else mask_deep(v))
            for k, v in value.items()
        }
    return value

def mask_query(url: str) -> str:
    """URL 쿼리 문자열 중 민감 키의 값을 마스킹한다.

    scheme/netloc/path/fragment는 그대로 두고 쿼리 파라미터만 손댄다.
    이 URL은 실행 시점에 urlTemplate으로 그대로 재사용되므로, 구조를
    깨거나 민감하지 않은 파라미터를 지워서는 안 된다.
    """
    parsed = urlparse(url)
    if not parsed.query:
        return url
    pairs = parse_qsl(parsed.query, keep_blank_values=True)
    masked_pairs = [(k, MASK if k.lower() in SENSITIVE_KEYS else v) for k, v in pairs]
    # safe="*": 마스크를 %2A%2A%2A로 인코딩하면 화면에 그대로 노출되어
    # 다른 마스킹 결과(***)와 표기가 어긋난다. 별표는 그대로 남긴다.
    return urlunparse(parsed._replace(query=urlencode(masked_pairs, safe="*")))

def mask_body(text):
    """요청 본문의 민감 키 값을 마스킹한다.

    Extension이 1차로 가리지만 서버도 같은 규칙을 적용한다. URL과 응답은
    서버에서 키 규칙으로 가리면서 본문만 패턴 규칙에 맡기면, 확장을 거치지
    않고 들어온 본문의 password=... 가 평문으로 저장된다.

    JSON 여부는 Content-Type이 아니라 파싱 시도로 판정한다 —
    extension/lib/masking.ts와 같은 판정 방식이다.
    """
    if not isinstance(text, str) or not text:
        return mask_patterns(text)

    trimmed = text.lstrip()
    if trimmed.startswith("{") or trimmed.startswith("["):
        try:
            return json.dumps(mask_deep(json.loads(text)), ensure_ascii=False)
        except (ValueError, TypeError):
            pass

    if "=" in text:
        pairs = parse_qsl(text, keep_blank_values=True)
        if pairs:
            # 민감 키가 아니어도 값 패턴 마스킹은 그대로 적용한다.
            # card=1234-5678-... 처럼 키 이름은 목록에 없지만 값이 카드번호인
            # 경우를 놓치면 기존 mask_patterns 동작에서 후퇴한다.
            masked = [
                (k, MASK if k.lower() in SENSITIVE_KEYS else mask_patterns(v))
                for k, v in pairs
            ]
            return urlencode(masked, safe="*")

    return mask_patterns(text)

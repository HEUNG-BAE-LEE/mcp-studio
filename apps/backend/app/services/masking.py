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
    return urlunparse(parsed._replace(query=urlencode(masked_pairs)))

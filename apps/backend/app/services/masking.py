import re

MASK = "***"
PATTERNS = [
    re.compile(r"\d{6}-\d{7}"),                                        # 주민등록번호
    re.compile(r"\d{4}-?\d{4}-?\d{4}-?\d{4}"),                         # 카드번호
    re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),  # JWT
]

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
    """
    if isinstance(value, str):
        return mask_patterns(value)
    if isinstance(value, list):
        return [mask_deep(v) for v in value]
    if isinstance(value, dict):
        return {k: mask_deep(v) for k, v in value.items()}
    return value

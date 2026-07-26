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

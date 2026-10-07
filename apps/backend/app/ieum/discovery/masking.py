"""캡처한 요청·응답을 저장하기 전에 개인정보를 가린다.

가린 개수를 센다. 결과 화면이 "개인정보 N건을 가렸습니다" 라고 말하려면 실제로 센 값이어야 한다.
이름과 주소는 가리지 않는다 — 정규식으로는 구분할 수 없고, 오탐으로 데이터를 망가뜨리는 쪽이 더 나쁘다.
"""
import re
from collections import Counter

# 순서가 중요하다. 더 긴(구체적인) 형식이 먼저 와야 전화번호 규칙이 그 일부를 먼저 먹지 않는다.
_PATTERNS = (
    ("rrn", re.compile(r"(?<!\d)\d{6}-[1-4]\d{6}(?!\d)")),                      # 주민등록번호
    ("card", re.compile(r"(?<!\d)(?:\d{4}-){3}\d{4}(?!\d)")),                   # 카드번호
    ("biz", re.compile(r"(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)")),                     # 사업자등록번호
    ("phone", re.compile(r"(?<!\d)(?:01[016789]|0\d{1,2})-\d{3,4}-\d{4}(?!\d)")),  # 휴대전화, 유선전화
    ("phone", re.compile(r"(?<!\d)01[016789]\d{7,8}(?!\d)")),                   # 하이픈 없는 휴대전화
    ("email", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
)

# 값을 통째로 가리는 이름. 비밀번호와 세션은 개수 세기와 상관없이 절대 저장하지 않는다.
# userPw, user_pw, passwd, accessToken 처럼 줄임말과 대소문자가 섞여 오므로 낱말로 쪼개 본다.
_SECRET_WORDS = frozenset("pw pwd pass passwd password secret token authorization cookie jsessionid sessionid apikey".split())
_SECRET_PAIRS = ("apikey", "sessionid", "accesskey", "secretkey")
_WORD = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+")
HIDDEN = "••••••••"


def is_secret_key(name: str) -> bool:
    words = [w.lower() for w in _WORD.findall(str(name))]
    if any(w in _SECRET_WORDS for w in words):
        return True
    compact = "".join(words)
    return any(p in compact for p in _SECRET_PAIRS)


def _digits_masked(s: str) -> str:
    """끝 4자리만 남기고 숫자를 *로 바꾼다. 구분 기호는 그대로 둔다."""
    return re.sub(r"\d(?=(?:\D*\d){4})", "*", s)


def _mask_match(kind: str, s: str) -> str:
    if kind == "rrn":
        return s[:6] + "-*******"
    if kind == "email":
        name, host = s.split("@", 1)
        return name[:1] + "*" * max(len(name) - 1, 1) + "@" + host
    return _digits_masked(s)


class Masker:
    """한 작업 안에서 쓰는 마스킹기. 가린 횟수를 종류별로 센다."""

    def __init__(self, pii: bool = True) -> None:
        self.kinds = Counter()
        self.pii = pii                      # False 면 개인정보 패턴은 가리지 않는다. 비밀번호·토큰은 항상 가린다

    @property
    def count(self) -> int:
        """가린 개인정보 건수. 비밀번호·토큰은 개인정보가 아니라 비밀이라 따로 센다."""
        return sum(n for k, n in self.kinds.items() if k != "secret")

    def text(self, s: str) -> str:
        if not s or not self.pii:
            return s
        for kind, pat in _PATTERNS:
            def repl(m, kind=kind):
                self.kinds[kind] += 1
                return _mask_match(kind, m.group(0))
            s = pat.sub(repl, s)
        return s

    def value(self, v):
        """JSON 으로 읽은 값을 재귀로 가린다. 키 이름이 비밀번호 같으면 값을 통째로 숨긴다."""
        if isinstance(v, str):
            return self.text(v)
        if isinstance(v, list):
            return [self.value(x) for x in v]
        if isinstance(v, dict):
            out = {}
            for k, x in v.items():
                if is_secret_key(k) and isinstance(x, (str, int, float)) and x != "":
                    self.kinds["secret"] += 1
                    out[k] = HIDDEN
                else:
                    out[k] = self.value(x)
            return out
        return v

    def pairs(self, pairs):
        """쿼리·폼 파라미터 목록 [(이름, 값)] 을 가린다."""
        out = []
        for k, v in pairs:
            if is_secret_key(k) and v != "":
                self.kinds["secret"] += 1
                out.append((k, HIDDEN))
            else:
                out.append((k, self.text(v)))
        return out

    def headers(self, headers: dict) -> dict:
        """헤더에서 인증 값은 항상 숨긴다. 셈에는 넣지 않는다 — 개인정보가 아니라 비밀이다."""
        return {k: (HIDDEN if is_secret_key(k) else v) for k, v in headers.items()}

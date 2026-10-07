"""탐색 정책: 어디까지 가고, 무엇을 누르지 않는지.

머지된 `services/crawl_policy.py` 의 판정 상수(로그아웃, 정적 파일)를 재사용한다. 다만 거기는
"사람이 로그인한 세션으로 읽기 전용 탐색"을 전제로 파괴적 단어를 고정해 두었고, 이음은
사용자가 누르지 않을 단어를 직접 고르므로 그 부분은 설정에서 받는다.

판정마다 이유를 함께 돌려준다. 화면이 "왜 안 갔는지"를 보여줘야 사용자가 자동 판단을 믿거나 고친다.
"""
import fnmatch
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

from app.services.crawl_policy import SESSION_KILL, is_asset

# GET 이라도 이름에 이 단어가 있으면 열지도, 검증하려고 부르지도 않는다. 사용자 설정과 무관한 바닥선이다.
# 레거시 시스템은 삭제를 `delete.do?id=1` 같은 GET 링크로 구현하기도 한다.
RISKY_NAV = re.compile(r"(delete|remove|destroy|drop|truncate|withdraw|expire|삭제|탈퇴)", re.I)
# 읽기 API 를 검증하려고 다시 부를 때는 더 보수적으로 본다. 경로 이름을 낱말(camelCase, snake_case)로 쪼개
# 쓰기 낱말이 하나라도 있으면 부르지 않는다. 부분 문자열로 보면 address 가 add 에 걸린다.
_RISKY_TOKENS = frozenset((
    "delete remove destroy drop truncate cancel approve reject insert update modify save submit send pay apply confirm "
    "proc set add create reg regist register del upd ins logout signout withdraw expire write post put merge 삭제 탈퇴 취소 승인 저장 등록 수정").split())
_TOKEN = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+|[가-힣]+")

# 들어가도 API 가 없는 곳. upstream 의 DEAD_END 는 `javascript:` 를 막지만, 레거시 메뉴는 대부분 그 형식이라
# 이음은 링크가 아니라 클릭으로 처리한다. 그래서 파일 확장자와 mailto/tel 만 거른다.
_DEAD_END = re.compile(r"(\.(pdf|hwp|xlsx?|docx?|pptx?|zip|7z|jpe?g|png|gif|svg|mp4|exe)(\?|$)|^mailto:|^tel:)", re.I)


def _split(patterns: str) -> List[str]:
    """쉼표·줄바꿈으로 나눈 경로 패턴. 앞에 슬래시가 없으면 붙인다."""
    out = []
    for raw in re.split(r"[,\n]", patterns or ""):
        p = raw.strip()
        if p:
            out.append(p if p.startswith("/") else "/" + p)
    return out


@dataclass
class Policy:
    base: str                               # 운영 주소. 예: http://10.0.0.1:8080/po
    scope: str = ""                         # 경로 패턴(쉼표 구분). 비면 base 경로 아래 전부
    exclude: str = ""
    read_post: str = ""                     # 조회에 쓰는 POST 경로 패턴 — 이것만 운영에 실제로 보낸다
    ban: List[str] = field(default_factory=list)
    max_pages: int = 50
    max_depth: int = 4
    max_seconds: int = 600
    delay_ms: int = 900

    def __post_init__(self) -> None:
        parts = urlsplit(self.base)
        self.origin = f"{parts.scheme}://{parts.netloc}"
        self.host = parts.hostname or ""
        self.base_path = parts.path.rstrip("/")
        self._scope = _split(self.scope) or [self.base_path + "/*" if self.base_path else "/*"]
        self._exclude = _split(self.exclude)
        self._read_post = _split(self.read_post)
        self._ban = [b.strip().lower() for b in self.ban if b.strip()]
        self.visited: set = set()
        self.pages = 0
        # 운영 시스템에 부하를 주지 않는다. 사람이 쓰는 속도 아래로 내려가는 것은 로컬 시연에서만 허용한다.
        if self.host not in ("localhost", "127.0.0.1", "::1"):
            self.delay_ms = max(self.delay_ms, 600)

    # ── 주소 ────────────────────────────────────────────────────────────────

    def rel(self, path: str) -> str:
        """base 경로를 뗀 상대 경로. 소스의 매핑(/poList.do)과 같은 모양이 된다."""
        if self.base_path and (path == self.base_path or path.startswith(self.base_path + "/")):
            return path[len(self.base_path):] or "/"
        return path

    def display(self, url: str) -> str:
        """화면 기록에 보이는 주소: base 를 뗀 경로와 쿼리."""
        p = urlsplit(url)
        shown = self.rel(p.path) + (f"?{p.query}" if p.query else "")
        return shown if self.same_origin(url) else url

    def same_origin(self, url: str) -> bool:
        p = urlsplit(url)
        return f"{p.scheme}://{p.netloc}" == self.origin

    def _match(self, patterns: List[str], path: str) -> bool:
        rel = self.rel(path)
        return any(fnmatch.fnmatch(path, pat) or fnmatch.fnmatch(rel, pat) for pat in patterns)

    def in_scope(self, url: str) -> bool:
        return self.same_origin(url) and self._match(self._scope, urlsplit(url).path)

    def excluded(self, url: str) -> bool:
        return self._match(self._exclude, urlsplit(url).path)

    def is_read_post(self, url: str) -> bool:
        return bool(self._read_post) and self._match(self._read_post, urlsplit(url).path)

    def normalize(self, url: str) -> str:
        """같은 화면을 두 번 가지 않기 위한 열쇠. 쿼리의 값은 지우고 이름만 남긴다."""
        p = urlsplit(url)
        keys = sorted({kv.split("=", 1)[0] for kv in p.query.split("&") if kv})
        return urlunsplit((p.scheme, p.netloc, p.path.rstrip("/") or "/", "&".join(keys), ""))

    # ── 판정 ────────────────────────────────────────────────────────────────

    def url_decision(self, url: str, depth: int) -> Tuple[bool, str]:
        """이 주소로 들어가도 되는가. (허용 여부, 이유)"""
        if not url.startswith(("http://", "https://")):
            return False, "열 수 없는 주소"
        if SESSION_KILL.search(url):
            return False, "로그아웃 링크라 열지 않음"
        if self.excluded(url):
            return False, "제외 경로라 열지 않음"
        if not self.same_origin(url):
            return False, "다른 사이트라 열지 않음"
        if not self.in_scope(url):
            return False, "탐색 범위 밖이라 열지 않음"
        if is_asset(url) or _DEAD_END.search(url):
            return False, "API 가 없는 파일이라 열지 않음"
        if RISKY_NAV.search(urlsplit(url).path):
            return False, "삭제처럼 보이는 주소라 열지 않음"
        if depth > self.max_depth:
            return False, f"깊이 상한({self.max_depth})을 넘어 열지 않음"
        if self.normalize(url) in self.visited:
            return False, "이미 방문"
        if self.pages >= self.max_pages:
            return False, f"화면 상한({self.max_pages})에 도달"
        return True, ""

    def banned_word(self, *texts: str) -> Optional[str]:
        """버튼 글자(와 title, aria-label)에 누르지 않을 단어가 있으면 그 단어."""
        hay = " ".join(t for t in texts if t).lower()
        return next((w for w in self._ban if w in hay), None)

    def risky_click(self, href: str, onclick: str) -> Optional[str]:
        """눌렀을 때 GET 으로 삭제 같은 일이 일어날 수 있는 링크·핸들러인가."""
        if SESSION_KILL.search(href or "") or SESSION_KILL.search(onclick or ""):
            return "로그아웃이라"
        m = RISKY_NAV.search((href or "") + " " + (onclick or ""))
        return f"주소에 \"{m.group(0)}\" 가 있어" if m else None

    def visit(self, url: str) -> None:
        self.visited.add(self.normalize(url))
        self.pages += 1


_RISKY_KO = ("삭제", "탈퇴", "취소", "승인", "저장", "등록", "수정", "전송", "발송")


def risky_call(path: str) -> Optional[str]:
    """경로 이름에 쓰기 낱말이 있으면 그 낱말. 읽기 API 검증 호출을 막는 바닥선이다."""
    for seg in urlsplit(path).path.split("/"):
        for tok in _TOKEN.findall(re.sub(r"\.\w+$", "", seg)):
            if tok.lower() in _RISKY_TOKENS:
                return tok
            ko = next((w for w in _RISKY_KO if w in tok), None)    # 한글은 낱말 경계가 없어 포함 여부로 본다
            if ko:
                return ko
    return None

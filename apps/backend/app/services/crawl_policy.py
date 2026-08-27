"""자동 탐색 안전 정책.

로그인된 세션으로 자동 클릭을 한다는 것은 **고객 계정으로 무언가를 저지를 수
있다**는 뜻이다. 그래서 LLM 을 붙이기 **전에** 이 파일부터 완성했다. 순서를
바꾸면 개발 중에 "LLM 이 삭제 버튼을 눌렀다"가 반드시 한 번은 일어나고,
그게 우리 테스트 환경이면 다행이고 고객 시연 중이면 끝이다.

여기서 막는 것은 LLM 이 판단하기 전이다. 안전을 LLM 판단에 맡기지 않는다 —
프롬프트는 우회되지만 정규식은 우회되지 않는다.
"""
import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit, urlunsplit

# ─────────────────────────────────────────────────────────────────────────────
# 절대 누르지 않는 것
#
# 문구를 보수적으로 잡는다. "발송 내역"처럼 조회인데 걸리는 것이 생기지만,
# 반대 실수(진짜 발송 버튼을 누르는 것)의 대가가 비교할 수 없이 크다.
# ─────────────────────────────────────────────────────────────────────────────
DESTRUCTIVE = re.compile(
    r"(삭제|제거|지우기|탈퇴|해지|취소|반려|거절|승인|확정|전송|발송|발신|결제|"
    r"주문|구매|결재|이체|송금|출금|등록|저장|수정|변경|초기화|리셋|"
    r"delete|remove|destroy|drop|cancel|withdraw|approve|reject|submit|send|"
    r"pay|purchase|order|transfer|reset|update|create)",
    re.I,
)

# 누르면 크롤링이 통째로 끝난다.
SESSION_KILL = re.compile(r"(로그아웃|logout|signout|sign-out|로그\s*아웃|세션\s*종료)", re.I)

# 들어가도 API 가 없는 곳. 시간만 쓴다.
DEAD_END = re.compile(
    r"(/terms|/privacy|/policy|약관|개인정보처리방침|이용안내|고객센터|공지사항|"
    r"\.pdf$|\.hwp$|\.xlsx?$|\.zip$|\.jpe?g$|\.png$|\.gif$|\.svg$|"
    r"^mailto:|^tel:|^javascript:)",
    re.I,
)

# 화면 안에서만 도는 것. 새 화면이 아니다.
IN_PAGE = re.compile(r"^#|^$")


@dataclass
class Limits:
    """상한 셋을 **모두** 건다.

    하나만 걸면 반드시 새어 나간다 — 깊이만 제한하면 한 화면에 링크가 수백
    개인 목록에서 폭발하고, 개수만 제한하면 느린 사이트에서 한없이 기다린다.
    """
    max_pages: int = 40
    max_depth: int = 3
    max_seconds: int = 600
    # 사람이 브라우저를 쓰는 속도를 넘지 않는다. 고객 시스템에 부하를 주면
    # 그 순간 우리는 공격자가 된다.
    delay_ms: int = 900
    read_only: bool = True


@dataclass
class Policy:
    limits: Limits = field(default_factory=Limits)
    origin: str = ""                      # 이 오리진 밖으로 나가지 않는다
    visited: set[str] = field(default_factory=set)
    pages: int = 0
    skipped: list[dict] = field(default_factory=list)

    # ── URL 정규화 ──────────────────────────────────────────────────────────

    def normalize(self, url: str) -> str:
        """같은 화면을 두 번 안 가기 위한 열쇠.

        쿼리 파라미터의 **값**을 지운다. `/orders?page=1` 과 `?page=2` 는
        사람에게는 다른 화면이지만 우리에게는 **같은 API 를 부르는 같은 화면**
        이다. 값까지 남기면 페이지네이션·달력을 따라 끝없이 돈다.
        """
        parts = urlsplit(url)
        keys = sorted({kv.split("=", 1)[0] for kv in parts.query.split("&") if kv})
        return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") or "/",
                           "&".join(keys), ""))

    def same_origin(self, url: str) -> bool:
        if not self.origin:
            return True
        p = urlsplit(url)
        return f"{p.scheme}://{p.netloc}" == self.origin

    # ── 판정 ────────────────────────────────────────────────────────────────

    def check(self, *, url: str, text: str, depth: int) -> tuple[bool, str]:
        """이 후보로 들어가도 되는가. (허용 여부, 이유)를 돌려준다.

        이유를 항상 함께 주는 것이 중요하다. 화면이 "왜 안 갔는지"를
        보여줘야 사용자가 자동 판단을 믿거나 고칠 수 있다.
        """
        label = (text or "").strip()

        if SESSION_KILL.search(label) or SESSION_KILL.search(url):
            return False, "로그아웃 — 세션이 끊긴다"

        if self.limits.read_only and DESTRUCTIVE.search(label):
            return False, f"파괴적 동작으로 보임 — “{label[:20]}”"

        if IN_PAGE.match(url):
            return False, "같은 화면 안 이동"

        if DEAD_END.search(url):
            return False, "API 가 없는 정적 페이지"

        if not self.same_origin(url):
            return False, "다른 사이트"

        if depth > self.limits.max_depth:
            return False, f"깊이 상한({self.limits.max_depth}) 초과"

        if self.normalize(url) in self.visited:
            return False, "이미 방문"

        if self.pages >= self.limits.max_pages:
            return False, f"화면 상한({self.limits.max_pages}) 도달"

        return True, ""

    def record_skip(self, url: str, text: str, why: str) -> None:
        """건너뛴 것을 남긴다. 자동 판단은 반드시 틀리므로,
        무엇을 안 봤는지 사용자가 확인할 수 있어야 한다."""
        self.skipped.append({"url": url, "text": (text or "").strip()[:60], "why": why})

    def visit(self, url: str) -> None:
        self.visited.add(self.normalize(url))
        self.pages += 1


# ─────────────────────────────────────────────────────────────────────────────
# 관측한 호출을 담을지
# ─────────────────────────────────────────────────────────────────────────────

# 화면을 그리는 것들. API 가 아니다.
ASSET = re.compile(
    r"\.(js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map)(\?|$)", re.I,
)


def is_asset(url: str) -> bool:
    return bool(ASSET.search(url))


def should_capture(url: str, method: str, resource_type: str) -> bool:
    """관측한 요청을 후보로 남길지. 규칙만으로 확실한 것을 먼저 거른다.

    LLM 은 애매한 것만 본다 — 정적 파일까지 물어보면 돈만 쓴다.
    """
    if resource_type in ("image", "stylesheet", "font", "media", "script"):
        return False
    if is_asset(url):
        return False
    return True

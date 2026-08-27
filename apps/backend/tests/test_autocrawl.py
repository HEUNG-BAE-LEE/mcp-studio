"""자동 트래픽 수집 — 안전 정책과 병합 규칙.

브라우저를 띄우는 부분은 여기서 돌리지 않는다(느리고 외부 사이트에 의존한다).
대신 **자동 클릭이 사고를 내지 않게 하는 규칙**과 **여러 번 관측한 것을 하나로
묶는 규칙**을 못 박는다 — 이 둘이 깨지면 나머지가 다 맞아도 못 쓴다.
"""
import pytest

from app.services.crawl_brain import rule_only
from app.services.crawl_policy import Limits, Policy, is_asset, should_capture


@pytest.fixture
def policy():
    return Policy(limits=Limits(max_pages=5, max_depth=2),
                  origin="https://portal.example.com")


# ── 안전 ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", ["삭제", "주문 취소", "결제하기", "회원 탈퇴", "전송", "Delete"])
def test_파괴적_동작은_누르지_않는다(policy, text):
    """읽기 전용이 기본값이다. 이 원칙이 무너지면 '고객사 데이터를 지운
    도구'가 되고, 그 뒤는 없다."""
    ok, why = policy.check(url="https://portal.example.com/x", text=text, depth=1)
    assert not ok
    assert "파괴적" in why


def test_로그아웃은_읽기_전용이_아니어도_막는다():
    """누르면 크롤링이 통째로 끝난다. 쓰기를 허용해도 이건 예외 없다."""
    p = Policy(limits=Limits(read_only=False), origin="https://portal.example.com")
    ok, why = p.check(url="https://portal.example.com/logout", text="로그아웃", depth=1)
    assert not ok and "세션" in why


def test_읽기_전용을_끄면_쓰기_동작이_열린다():
    p = Policy(limits=Limits(read_only=False), origin="https://portal.example.com")
    ok, _ = p.check(url="https://portal.example.com/orders/new", text="주문 등록", depth=1)
    assert ok


def test_다른_사이트로_나가지_않는다(policy):
    ok, why = policy.check(url="https://other.com/page", text="외부 링크", depth=1)
    assert not ok and "다른 사이트" in why


def test_상한_셋을_모두_건다(policy):
    """하나만 걸면 반드시 새어 나간다 — 깊이만 막으면 목록 화면에서 폭발하고,
    개수만 막으면 느린 사이트에서 한없이 기다린다."""
    ok, why = policy.check(url="https://portal.example.com/deep", text="더보기", depth=9)
    assert not ok and "깊이" in why

    for i in range(5):
        policy.visit(f"https://portal.example.com/p{i}")
    ok, why = policy.check(url="https://portal.example.com/new", text="목록", depth=1)
    assert not ok and "화면 상한" in why


def test_정적_페이지는_시간_낭비라_건너뛴다(policy):
    for url in ("https://portal.example.com/terms",
                "https://portal.example.com/guide.pdf"):
        ok, why = policy.check(url=url, text="안내", depth=1)
        assert not ok and "정적" in why


# ── URL 정규화 ──────────────────────────────────────────────────────────────

def test_페이지네이션은_같은_화면으로_본다(policy):
    """`?page=1` 과 `?page=2` 는 같은 API 를 부르는 같은 화면이다.
    값까지 남기면 달력·무한스크롤을 따라 끝없이 돈다."""
    a = policy.normalize("https://portal.example.com/orders?page=1&size=20")
    b = policy.normalize("https://portal.example.com/orders?page=2&size=20")
    assert a == b


def test_이미_방문한_곳은_다시_가지_않는다(policy):
    policy.visit("https://portal.example.com/orders?page=1")
    ok, why = policy.check(url="https://portal.example.com/orders?page=7",
                           text="다음", depth=1)
    assert not ok and "이미 방문" in why


def test_건너뛴_이유가_남는다(policy):
    """자동 판단은 반드시 틀린다. 무엇을 안 봤는지 볼 수 없으면
    사용자는 놓친 것을 영원히 모른다."""
    policy.record_skip("https://portal.example.com/x", "삭제", "파괴적 동작으로 보임")
    assert policy.skipped[0]["why"].startswith("파괴적")


# ── 관측 필터 ───────────────────────────────────────────────────────────────

def test_정적_파일은_후보가_아니다():
    assert is_asset("https://x.com/app.js")
    assert is_asset("https://x.com/logo.png?v=3")
    assert not is_asset("https://x.com/api/orders")


def test_리소스_종류로_먼저_거른다():
    """LLM 은 애매한 것만 본다. 이미지까지 물어보면 돈만 쓴다."""
    assert not should_capture("https://x.com/a.png", "GET", "image")
    assert not should_capture("https://x.com/main.css", "GET", "stylesheet")
    assert should_capture("https://x.com/api/orders", "GET", "xhr")


# ── 규칙 폴백 ───────────────────────────────────────────────────────────────

def _brief():
    return {
        "page": {"title": "주문 목록"},
        "candidates": [
            {"i": 0, "text": "주문 상세", "href": "/orders/1", "blocked": None},
            {"i": 1, "text": "이용약관", "href": "/terms", "blocked": None},
            {"i": 2, "text": "삭제", "href": "/del", "blocked": "파괴적 동작으로 보임"},
        ],
        "observedApis": [
            {"method": "GET", "url": "https://x.com/api/orders", "status": 200},
            {"method": "POST", "url": "https://x.com/log/pageview", "status": 200},
            {"method": "GET", "url": "https://x.com/api/broken", "status": 500},
        ],
    }


def test_LLM이_없어도_수집은_돈다():
    """자동 수집이 LLM 가용성에 묶이면 키 하나 만료로 제품이 멈춘다."""
    out = rule_only(_brief(), "주문 조회 API")
    assert out["by"] == "rule"
    assert any(v["i"] == 0 for v in out["visit"]), "의도와 겹치는 곳은 간다"
    assert any(s["i"] == 2 for s in out["skip"]), "규칙이 막은 것은 그대로 막힌다"


def test_규칙이_로그_API를_버린다():
    out = rule_only(_brief(), "주문 조회 API")
    dropped = " ".join(d["url"] for d in out["drop"])
    kept = " ".join(k["url"] for k in out["keep"])
    assert "/log/pageview" in dropped
    assert "/api/broken" in dropped, "실패한 응답은 담지 않는다"
    assert "/api/orders" in kept

"""화면 하나에서 기계가 긁어내는 것 (L1).

여기에 LLM 이 없다는 것이 핵심이다.

화면 하나의 DOM 은 보통 수십만 자다. 그대로 LLM 에 넣으면 화면당 수천 원이
들고 응답도 느리다. 반면 **"이 화면에 있는 클릭 가능한 것 40개의 텍스트와
링크"** 는 2천 자면 충분하다. 추출은 기계가, 판단은 LLM 이 — 그 경계가 이
파일과 crawl_brain.py 사이에 있다.

네트워크 관측도 여기서 한다. 페이지를 여는 것만으로 이미 API 가 잡히므로,
클릭을 한 번도 안 해도 수확이 있다.
"""
from dataclasses import dataclass, field
from urllib.parse import urljoin

from app.services.crawl_policy import should_capture

# 한 화면에서 LLM 에 넘길 후보 상한. 목록 화면은 링크가 수백 개인데,
# 전부 넘기면 토큰이 터지고 판단도 나빠진다.
MAX_CANDIDATES = 40

# 응답 본문은 스키마 추론에만 쓰고 통째로 들고 있지 않는다.
MAX_BODY_CHARS = 20_000

_LINK_JS = """
() => {
  const seen = new Set();
  const out = [];
  const nodes = document.querySelectorAll(
    'a[href], button, [role="button"], [role="link"], [onclick]'
  );
  for (const el of nodes) {
    // 눈에 안 보이는 것은 사람도 못 누른다. 숨은 메뉴까지 따라가면
    // 화면 수가 몇 배로 늘고 대부분 빈 페이지다.
    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;

    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '')
      .replace(/\\s+/g, ' ').trim().slice(0, 80);
    const href = el.getAttribute('href') || '';
    const key = href + '|' + text;
    if (!text && !href) continue;
    if (seen.has(key)) continue;      // 같은 링크가 목록에 반복되는 경우
    seen.add(key);

    out.push({
      text,
      href,
      tag: el.tagName.toLowerCase(),
      // 클릭으로만 움직이는 것(SPA 버튼)은 href 가 없다. 그때 쓸 좌표.
      selector: el.id ? '#' + CSS.escape(el.id) : '',
    });
  }
  return out;
}
"""

_TEXT_JS = """
() => {
  const pick = (sel) => Array.from(document.querySelectorAll(sel))
    .map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim())
    .filter(Boolean).slice(0, 6);
  return {
    title: document.title || '',
    headings: pick('h1, h2'),
    tableHeads: pick('th'),
  };
}
"""


@dataclass
class Observed:
    """관측한 요청 하나. 본문 값은 들고 있지 않는다 — 스키마만 쓴다."""
    url: str
    method: str
    status: int
    resource_type: str
    duration_ms: int
    request_body: str | None
    response_text: str
    from_url: str = ""


@dataclass
class PageSnapshot:
    url: str
    title: str
    headings: list[str] = field(default_factory=list)
    table_heads: list[str] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    observed: list[Observed] = field(default_factory=list)
    error: str = ""


def _abs(base: str, href: str) -> str:
    if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
        return href
    return urljoin(base, href)


def visit(context, url: str, *, wait_ms: int = 1200) -> PageSnapshot:
    """한 화면을 열고, 오간 요청을 받아 적고, 갈 만한 곳을 긁는다.

    응답 본문을 요청 시점이 아니라 **끝난 뒤** 한꺼번에 읽는다. 핸들러
    안에서 body() 를 부르면 Playwright 가 그 응답을 붙잡고 있느라 페이지
    로딩이 느려지고, 이미 닫힌 응답에서 예외가 난다.
    """
    page = context.new_page()
    pending: list[tuple] = []

    def on_response(res):
        try:
            req = res.request
            if not should_capture(res.url, req.method, req.resource_type):
                return
            pending.append((res, req, res.url, req.method, res.status,
                            req.resource_type, req.post_data))
        except Exception:
            pass

    page.on("response", on_response)

    snap = PageSnapshot(url=url, title="")
    try:
        started = page.context  # noqa: F841  (참조만 — 아래 goto 가 실질 시작)
        page.goto(url, wait_until="domcontentloaded", timeout=20_000)
        # networkidle 은 폴링이 있는 화면에서 영영 안 온다. 고정 대기가 낫다.
        page.wait_for_timeout(wait_ms)

        meta = page.evaluate(_TEXT_JS)
        snap.title = meta.get("title", "")
        snap.headings = meta.get("headings", [])
        snap.table_heads = meta.get("tableHeads", [])

        raw = page.evaluate(_LINK_JS)
        snap.links = [
            {**item, "href": _abs(url, item.get("href", ""))}
            for item in raw[:MAX_CANDIDATES]
        ]
    except Exception as exc:
        snap.error = str(exc)[:200]

    # 본문 읽기 — 실패는 무시한다. 리다이렉트·스트리밍 응답은 못 읽는다.
    for res, req, u, method, status, rtype, body in pending:
        text = ""
        try:
            text = res.text()[:MAX_BODY_CHARS]
        except Exception:
            pass
        snap.observed.append(Observed(
            url=u, method=method, status=status, resource_type=rtype,
            duration_ms=0, request_body=body, response_text=text, from_url=url,
        ))

    try:
        page.close()
    except Exception:
        pass
    return snap


def to_brief(snap: PageSnapshot, policy) -> dict:
    """LLM 에 넘길 요약본. 이게 작아야 이 구조가 성립한다.

    DOM 을 넘기지 않는다. 링크의 글자와 주소, 관측한 API 경로만 넘긴다 —
    보통 2천 자 안쪽이다.
    """
    candidates = []
    for i, link in enumerate(snap.links):
        href = link.get("href", "")
        text = link.get("text", "")
        ok, why = policy.check(url=href, text=text, depth=0)
        if not ok and why in ("이미 방문", "화면 상한(40) 도달"):
            continue                      # 규칙이 이미 아는 것은 물어보지 않는다
        candidates.append({"i": i, "text": text[:60], "href": href[:200],
                           "blocked": None if ok else why})

    apis = []
    for o in snap.observed:
        apis.append({"method": o.method, "url": o.url[:200], "status": o.status})

    return {
        "page": {"title": snap.title[:120], "url": snap.url[:200],
                 "headings": snap.headings[:4], "tableHeads": snap.table_heads[:8]},
        "candidates": candidates[:MAX_CANDIDATES],
        "observedApis": apis[:30],
    }

"""자동 탐색 — 화면을 스스로 타고 다니며 API 를 모은다.

한 화면을 이해하고 → 갈 곳을 고르고 → 들어가서 관측하고 → 거기서 또 갈 곳을
고른다. 이 순환이 전부다. **수집 의도가 순환 전체의 나침반**이다 — 어디로
갈지도, 무엇을 담을지도 그 한 문장이 정한다.

순서에 대해: 안전 정책(crawl_policy)이 LLM 판단(crawl_brain) **앞**에 있다.
프롬프트는 우회되지만 정규식은 우회되지 않는다.

같은 API 를 여러 번 부른 기록이 쌓이면 **필수/선택 파라미터가 실측으로**
결정된다. 문서가 틀려도 이건 맞다 — 트래픽 방식만의 강점이 나오는 지점이다.
"""
import time
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlsplit

from app.services import crawl_brain
from app.services.crawl_policy import Limits, Policy
from app.services.page_extract import PageSnapshot, to_brief, visit

# 경로에서 값처럼 보이는 조각. /orders/1023 → /orders/{id}
_ID_LIKE = ("0123456789",)


def _templatize(path: str) -> str:
    """경로의 식별자를 자리표시자로 바꾼다.

    `/orders/1023` 과 `/orders/1024` 는 사람에게는 다른 화면이지만
    **같은 API** 다. 이걸 안 묶으면 도구가 수십 개로 불어난다.
    """
    out = []
    for seg in path.split("/"):
        if not seg:
            out.append(seg)
            continue
        if seg.isdigit():
            out.append("{id}")
        elif len(seg) >= 12 and any(ch.isdigit() for ch in seg) and any(ch.isalpha() for ch in seg):
            out.append("{id}")          # uuid·해시처럼 생긴 것
        else:
            out.append(seg)
    return "/".join(out)


@dataclass
class MergedApi:
    """여러 번 관측한 같은 API 하나."""
    method: str
    base: str
    path: str
    seen: int = 0
    statuses: set[int] = field(default_factory=set)
    # 파라미터 이름 → 몇 번 등장했나. seen 과 같으면 필수다.
    params: dict[str, int] = field(default_factory=dict)
    sample_body: str = ""
    why: str = ""
    from_pages: list[str] = field(default_factory=list)

    @property
    def required(self) -> list[str]:
        return sorted(k for k, n in self.params.items() if n == self.seen)

    @property
    def optional(self) -> list[str]:
        return sorted(k for k, n in self.params.items() if n < self.seen)


@dataclass
class Progress:
    phase: str = "준비"
    visited: int = 0
    queued: int = 0
    found: int = 0
    current: str = ""
    log: list[str] = field(default_factory=list)
    done: bool = False
    error: str = ""

    def say(self, line: str) -> None:
        self.log.append(line)
        # 로그가 무한히 자라면 화면이 무거워진다. 최근 것만 남긴다.
        if len(self.log) > 120:
            del self.log[:-120]


def _merge(store: dict[str, MergedApi], snap: PageSnapshot, keep: set[str],
           why: dict[str, str]) -> None:
    for o in snap.observed:
        line = f"{o.method} {o.url}"
        if line not in keep:
            continue
        parts = urlsplit(o.url)
        base = f"{parts.scheme}://{parts.netloc}"
        path = _templatize(parts.path)
        key = f"{o.method} {base}{path}"

        api = store.get(key)
        if api is None:
            api = MergedApi(method=o.method, base=base, path=path, why=why.get(line, ""))
            store[key] = api

        api.seen += 1
        api.statuses.add(o.status)
        if snap.url not in api.from_pages:
            api.from_pages.append(snap.url)
        for k, _v in parse_qsl(parts.query):
            api.params[k] = api.params.get(k, 0) + 1
        if not api.sample_body and o.response_text:
            api.sample_body = o.response_text[:4000]


def run(*, storage_state: str | None, start_url: str, intent: str,
        limits: Limits, progress: Progress) -> dict:
    """탐색 한 판. 호출자는 progress 를 들고 있다가 화면에 그대로 보여준다."""
    from playwright.sync_api import sync_playwright

    parts = urlsplit(start_url)
    policy = Policy(limits=limits, origin=f"{parts.scheme}://{parts.netloc}")
    store: dict[str, MergedApi] = {}
    started = time.time()

    # (url, depth, 우선순위). 우선순위가 높은 것부터 본다 — 시간이 다 되기
    # 전에 중요한 화면을 먼저 보게 하는 것이 상한을 거는 목적이다.
    queue: list[tuple[str, int, int]] = [(start_url, 0, 10)]

    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True)
    try:
        context = browser.new_context(storage_state=storage_state or None)
        progress.phase = "탐색"

        while queue:
            if time.time() - started > limits.max_seconds:
                progress.say(f"시간 상한({limits.max_seconds}초)에 도달해 멈춥니다")
                break
            if policy.pages >= limits.max_pages:
                progress.say(f"화면 상한({limits.max_pages})에 도달해 멈춥니다")
                break

            queue.sort(key=lambda q: -q[2])
            url, depth, _prio = queue.pop(0)

            ok, why = policy.check(url=url, text="", depth=depth)
            if not ok:
                policy.record_skip(url, "", why)
                continue

            policy.visit(url)
            progress.current = url
            progress.visited = policy.pages
            progress.queued = len(queue)

            snap = visit(context, url)
            if snap.error:
                progress.say(f"{url} — 열지 못함: {snap.error}")
                continue

            brief = to_brief(snap, policy)
            decision = crawl_brain.decide(brief, intent)

            keep = {k["url"] for k in decision.get("keep", [])}
            why_map = {k["url"]: k.get("why", "") for k in decision.get("keep", [])}
            before = len(store)
            _merge(store, snap, keep, why_map)
            gained = len(store) - before
            progress.found = len(store)

            tag = "AI" if decision.get("by") == "llm" else "규칙"
            progress.say(
                f"{snap.title or url} 방문 · API {gained}개 발견"
                + (f" · {tag} 판단" if gained else f" · 새 API 없음 ({tag})"))

            for row in decision.get("skip", []):
                idx = row.get("i")
                if isinstance(idx, int) and 0 <= idx < len(snap.links):
                    link = snap.links[idx]
                    policy.record_skip(link.get("href", ""), link.get("text", ""),
                                       row.get("why", ""))

            for row in decision.get("visit", []):
                idx = row.get("i")
                if not isinstance(idx, int) or not (0 <= idx < len(snap.links)):
                    continue
                href = snap.links[idx].get("href", "")
                text = snap.links[idx].get("text", "")
                allow, block_why = policy.check(url=href, text=text, depth=depth + 1)
                if not allow:
                    policy.record_skip(href, text, block_why)
                    continue
                queue.append((href, depth + 1, int(row.get("priority", 5))))

            # 사람이 브라우저를 쓰는 속도를 넘지 않는다.
            time.sleep(limits.delay_ms / 1000)

        context.close()
    except Exception as exc:
        progress.error = str(exc)[:200]
        progress.say(f"중단: {progress.error}")
    finally:
        try:
            browser.close()
        finally:
            pw.stop()

    progress.phase = "완료"
    progress.done = True
    progress.current = ""

    apis = [
        {
            "method": a.method, "base": a.base, "path": a.path,
            "url": f"{a.base}{a.path}", "seen": a.seen,
            "statuses": sorted(a.statuses),
            "required": a.required, "optional": a.optional,
            "why": a.why, "fromPages": a.from_pages[:4],
            "sample": a.sample_body,
        }
        for a in sorted(store.values(), key=lambda x: -x.seen)
    ]
    return {
        "apis": apis,
        "visited": policy.pages,
        "skipped": policy.skipped[:80],
        "seconds": round(time.time() - started, 1),
    }

"""운영 화면 탐색 — 서비스 계정으로 로그인해 메뉴를 돌며 실제 요청과 응답을 캡처한다.

안전은 두 겹이다.

1) 무엇을 누를지 고를 때: 누르지 않을 단어, 제외 경로, 삭제처럼 보이는 주소는 건너뛴다.
2) 브라우저가 요청을 내보낼 때: POST/PUT/PATCH/DELETE 는 전부 가로채 운영에 보내지 않는다.
   로그인 요청과, 사용자가 "조회용 POST" 로 지정한 경로만 예외다.

1)은 사람이 읽을 이유를 남기려는 장치이고, 안전을 지키는 것은 2)다. 눌러서는 안 되는 버튼을
놓쳐도 쓰기는 운영에 닿지 않는다. 레거시 시스템 중에는 쓰기를 GET 링크로 구현한 곳이 있어서
그 경우만 1)의 주소 검사가 막는다.

Playwright 는 동기 API 를 쓴다. 이 모듈은 전용 스레드에서만 부른다(jobs.py).
"""
import re
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional
from urllib.parse import parse_qsl, urljoin, urlsplit

from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery.masking import is_secret_key
from app.ieum.discovery.policy import Policy, risky_call
from app.services.crawl_policy import SESSION_KILL, is_asset

VIEWPORT = {"width": 1100, "height": 680}
# 화면을 그리는 자원이라 API 후보가 아니다.
STATIC_TYPES = {"image", "stylesheet", "font", "media", "script", "manifest", "texttrack", "websocket", "eventsource"}
FILE_TYPES = ("spreadsheetml", "ms-excel", "octet-stream", "pdf", "zip", "msword", "hwp", "x-download")
MAX_BODY = 40_000          # 응답 본문은 스키마 추론에만 쓴다. 통째로 들고 있지 않는다
MAX_ACTIONS = 12           # 한 화면에서 누르는 버튼 수 상한
MAX_SKIP_EVENTS = 25       # 건너뛴 링크를 화면 기록에 다 쏟아내면 읽을 수 없다
OBSERVE_MS = 1600          # 화면마다 마지막에 잠깐 지켜본다. 자동 저장, 폴링처럼 화면이 스스로 부르는 요청을 보려는 것이다
DUP_EVENTS = 3             # 같은 요청은 기록에 이 횟수까지만 올린다(자동 저장처럼 반복되는 요청)
MAX_SAMPLES = 10           # 같은 (메서드, 경로)의 요청은 이만큼만 본문까지 들고 있는다. 폴링 화면이 메모리를 먹지 않게

# 화면 안의 눌러볼 만한 것을 모은다. 번호를 data 속성으로 붙여 두면 다시 찾을 수 있고, 같은 요소를 두 번 누르지 않는다.
_CANDIDATES_JS = """
() => {
  const SEL = 'a[href], button, input[type=button], input[type=submit], input[type=image], [role=button], [onclick], .btn';
  const out = [];
  let n = window.__ieumN || 0;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none' && !el.disabled;
  };
  const label = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.alt || '')
    .replace(/\\s+/g, ' ').trim().slice(0, 60);
  const push = (el, kind) => {
    if (!visible(el)) return;
    if (!el.dataset.ieumI) el.dataset.ieumI = String(++n);
    out.push({ i: el.dataset.ieumI, tag: el.tagName.toLowerCase(), kind, text: label(el),
               href: el.getAttribute('href') || '', onclick: (el.getAttribute('onclick') || '').slice(0, 200),
               title: el.getAttribute('title') || '' });
  };
  for (const el of document.querySelectorAll(SEL)) {
    if (el.tagName === 'TR') continue;
    push(el, el.tagName === 'A' ? 'link' : 'button');
  }
  // 표 행은 같은 표에서 첫 행만 본다. 목록의 모든 행은 같은 API 를 부른다.
  const seen = new Set();
  for (const tr of document.querySelectorAll('tbody tr')) {
    const t = tr.closest('table');
    if (!t || seen.has(t)) continue;
    if (tr.getAttribute('onclick') || getComputedStyle(tr).cursor === 'pointer') { seen.add(t); push(tr, 'row'); }
  }
  window.__ieumN = n;
  return out;
}
"""

_HEADING_JS = """
() => {
  const h = document.querySelector('h1, h2, .page-title, .title');
  return { title: document.title || '', heading: h ? (h.innerText || '').replace(/\\s+/g, ' ').trim() : '' };
}
"""


class Cancelled(Exception):
    """사용자가 탐색을 멈췄다."""


@dataclass
class Observed:
    """관측한 요청 하나. 값은 원문이다 — 저장하기 전에 merge 가 마스킹한다."""
    method: str
    url: str
    status: Optional[int]                  # 가로채 차단했으면 None
    ctype: str = ""
    ms: Optional[int] = None
    headers: Dict[str, str] = field(default_factory=dict)   # 보존할 요청 헤더만
    post: Optional[str] = None
    body: str = ""
    blocked: bool = False
    out_of_scope: bool = False
    file: bool = False
    label: str = ""                        # "발주 현황 > 조회 버튼"
    screen: str = ""                       # 요청이 나간 화면 (base 를 뗀 경로)


@dataclass
class CrawlResult:
    observed: List[Observed] = field(default_factory=list)
    pages: List[dict] = field(default_factory=list)
    skipped: List[dict] = field(default_factory=list)
    recipe: Optional[dict] = None          # 로그인 방법. 도구를 실행할 때 같은 방식으로 로그인한다
    cookies: List[dict] = field(default_factory=list)
    login_path: str = ""                   # 로그인 요청 경로. API 후보에서 뺀다
    browser: str = ""
    stopped: str = ""                      # "" | "limit" | "time" | "cancel" | "error"
    error: str = ""                        # stopped == "error" 일 때 사용자에게 보일 이유
    blocked: int = 0
    total: int = 0                         # 캡처한 읽기 요청 전체 수(들고 있지 않은 것 포함)
    seconds: float = 0.0


def _parse_form(body: Optional[str], ctype: str) -> Dict[str, str]:
    """로그인 요청 본문에서 {필드: 값}. 폼과 JSON 만 안다."""
    if not body:
        return {}
    if "json" in (ctype or "").lower():
        try:
            import json
            data = json.loads(body)
            return {str(k): str(v) for k, v in data.items()} if isinstance(data, dict) else {}
        except ValueError:
            return {}
    return dict(parse_qsl(body, keep_blank_values=True))


class Crawler:
    def __init__(self, policy: Policy, start_url: str, creds: Optional[dict], *, emit: Callable, on_shot: Callable,
                 cancelled: Callable[[], bool]):
        """emit(l, k, **fields) 로 이벤트를 쌓고, on_shot(jpeg 바이트) 가 화면 캡처 번호를 돌려준다."""
        self.policy = policy
        self.start_url = start_url
        self.creds = creds or {}
        self._emit, self._on_shot, self._cancelled = emit, on_shot, cancelled
        self.res = CrawlResult()
        self.heading = ""
        self.action = "화면 열기"
        self.login_phase = False
        self.login_done = False
        self._login_req: Optional[dict] = None
        self._pending: list = []
        self._inflight = 0
        self._dups: Dict[str, int] = {}
        self._queue: deque = deque()
        self._skip_events = 0
        self._skip_seen: set = set()          # 같은 건너뜀(로그아웃 링크 등)이 화면마다 반복 기록되지 않게
        self._started = 0.0
        self._relogins = 0
        self._samples: Dict[str, int] = {}
        self._blocked_reqs: set = set()      # 우리가 가로챈 요청. 가짜 응답이 response 이벤트로 또 올라오는 것을 거른다
        self._creating_main = False
        self.login_page_path = ""

    # ── 진입 ────────────────────────────────────────────────────────────────

    def run(self) -> CrawlResult:
        from playwright.sync_api import sync_playwright

        self._started = time.time()
        self._say("브라우저를 띄우고 있습니다. 이 PC 에서 처음 띄우는 거라면 1분 가까이 걸릴 수 있습니다")
        with sync_playwright() as pw:
            browser, kind = browser_mod.launch(pw)
            self.res.browser = kind
            try:
                self.ctx = browser.new_context(viewport=VIEWPORT, ignore_https_errors=True, locale="ko-KR", accept_downloads=False)
                self.ctx.route("**/*", self._route)
                self.ctx.on("response", self._on_response)
                self.ctx.on("request", lambda r: self._count(+1, r))
                self.ctx.on("requestfinished", lambda r: self._count(-1, r))
                self.ctx.on("requestfailed", lambda r: self._count(-1, r))
                self.ctx.on("page", self._on_new_page)
                self._creating_main = True            # new_page() 가 page 이벤트를 먼저 일으킨다. 팝업으로 오해해 닫으면 안 된다
                self.page = self.ctx.new_page()
                self._creating_main = False
                self._watch_dialogs(self.page)
                try:
                    self._explore()
                except Cancelled:
                    self.res.stopped = "cancel"
                except Exception as exc:              # 부분 결과는 살린다. 이유는 작업이 사용자에게 알린다
                    self.res.stopped = "error"
                    self.res.error = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
                try:
                    self._flush()
                    self.res.cookies = self.ctx.cookies()
                except Exception:
                    pass
            finally:
                try:
                    browser.close()
                except Exception:
                    pass
        self.res.seconds = round(time.time() - self._started, 1)
        return self.res

    def _say(self, msg: str) -> None:
        self._emit("sys", "note", msg=msg)

    # ── 탐색 ────────────────────────────────────────────────────────────────

    def _explore(self) -> None:
        self._goto(self.start_url)
        self._emit_page(0, "시작 페이지를 열었습니다")
        self.policy.visit(self.page.url)
        logged_in_now = False
        if self._find_password():
            self.login_page_path = urlsplit(self.page.url).path
            self._login()
            logged_in_now = True
        else:
            self.login_done = True
        # 로그인했다면 도착한 화면은 새 화면이라 page 이벤트를 낸다. 안 했다면 시작 화면에 이미 냈다.
        self._after_load(0, first=not logged_in_now)

        while self._queue:
            reason = self._stop_reason()
            if reason:
                self.res.stopped = reason
                return
            url, depth = self._queue.popleft()
            ok, why = self.policy.url_decision(url, depth)
            if not ok:
                self._skip(url, why)
                continue
            self.policy.visit(url)
            try:
                self._goto(url)
            except Cancelled:
                raise
            except Exception as exc:
                self._skip(url, f"열지 못함 ({type(exc).__name__})")
                continue
            self._after_load(depth)

    def _stop_reason(self) -> str:
        if self._cancelled():
            raise Cancelled()
        if time.time() - self._started > self.policy.max_seconds:
            self._say(f"시간 상한({self.policy.max_seconds}초)에 도달해 멈춥니다")
            return "time"
        if self.policy.pages >= self.policy.max_pages:
            self._say(f"화면 상한({self.policy.max_pages})에 도달해 멈춥니다")
            return "limit"
        return ""

    def _goto(self, url: str) -> None:
        self.page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        self._settle()

    def _after_load(self, depth: int, first: bool = False) -> None:
        """화면 하나를 열었을 때: 제목을 읽고, 세션을 확인하고, 눌러볼 것을 누르고, 갈 곳을 모은다."""
        meta = self._heading()
        self.heading = meta.get("heading") or meta.get("title") or self.policy.display(self.page.url)
        self.action = "화면 열기"
        if self.login_done and self._looks_like_login():
            # 세션이 끊겼다. 한 번만 다시 로그인한다.
            if self._relogins >= 1:
                raise RuntimeError("탐색 도중 세션이 끊겼고 다시 로그인해도 마찬가지였습니다.")
            self._relogins += 1
            self._say("세션이 끊겨 다시 로그인합니다")
            self._login()
            return
        if not first:
            self._emit_page(depth, f"{self.heading} 화면을 열었습니다")
        self._flush()
        self._act_on_page(depth)

    def _looks_like_login(self) -> bool:
        """비밀번호 칸이 있고 주소가 로그인 화면이면 세션이 끊긴 것이다. 비밀번호 변경 화면은 해당하지 않는다."""
        if not self._find_password():
            return False
        path = urlsplit(self.page.url).path
        return path == self.login_page_path or "login" in path.lower()

    def _emit_page(self, depth: int, msg: str) -> None:
        meta = self._heading()
        self.res.pages.append({"url": self.policy.display(self.page.url), "title": meta.get("heading") or meta.get("title"), "depth": depth})
        self._emit("web", "page", url=self.policy.display(self.page.url), title=meta.get("title", ""), cnt=len(self.res.pages), msg=msg, shot=self._shot())

    def _heading(self) -> dict:
        try:
            return self.page.evaluate(_HEADING_JS)
        except Exception:
            return {}

    def _act_on_page(self, depth: int) -> None:
        tried: set = set()
        work: deque = deque()
        acted = 0

        def refill(first: bool = False) -> None:
            fresh = []
            for c in self._extract():
                key = f"{c['tag']}|{c['kind']}|{c['text']}|{c['href']}|{c['onclick']}"
                if key in tried or any(w["key"] == key for w in work) or any(f["key"] == key for f in fresh):
                    continue
                c["key"] = key
                if c["kind"] == "link" and self._real_href(c["href"]):
                    tried.add(key)
                    self._enqueue(urljoin(self.page.url, c["href"]), depth + 1, c["text"], c)
                else:
                    fresh.append(c)
            # 처음 모은 것은 화면 순서대로, 방금 누른 것 때문에 나타난 것은 먼저 본다(조회 → 첫 행).
            # 그렇게 하지 않으면 뒤에 있는 "초기화" 가 먼저 눌려 방금 나타난 표가 지워진다.
            work.extend(fresh) if first else work.extendleft(reversed(fresh))

        refill(first=True)
        while work and acted < MAX_ACTIONS:
            if self._stop_reason():
                return
            c = work.popleft()
            tried.add(c["key"])
            if not self._alive(c):                     # 앞선 동작으로 화면이 다시 그려져 사라진 것
                continue
            why = self._click_block_reason(c)
            if why:
                self._skip_click(c, why)
                continue
            if self._click(c, depth):
                acted += 1
            refill()
            self.page.wait_for_timeout(self.policy.delay_ms)
        self.page.wait_for_timeout(OBSERVE_MS)
        self._flush()

    @staticmethod
    def _real_href(href: str) -> bool:
        h = (href or "").strip()
        return bool(h) and not h.startswith(("#", "javascript:", "mailto:", "tel:"))

    def _enqueue(self, url: str, depth: int, text: str, cand: Optional[dict] = None) -> None:
        """갈 곳을 큐에 넣는다. 못 가는 곳은 이유를 남기되, 같은 이유로 기록이 넘치지 않게 한다."""
        ok, why = self.policy.url_decision(url, depth)
        if ok:
            if not any(self.policy.normalize(u) == self.policy.normalize(url) for u, _ in self._queue):
                self._queue.append((url, depth))
            return
        if why in ("이미 방문",) or why.startswith("화면 상한"):
            return
        label = (text or "").strip()[:30] or self.policy.display(url)
        self._skip(url, why, label, cand)

    def _skip(self, url: str, why: str, label: str = "", cand: Optional[dict] = None) -> None:
        if (label or url, why) in self._skip_seen:
            return
        self._skip_seen.add((label or url, why))
        self.res.skipped.append({"text": label or url, "why": why})
        if self._skip_events < MAX_SKIP_EVENTS:
            self._skip_events += 1
            self._emit("web", "skip", msg=f"{label or self.policy.display(url)} — {why}")

    def _click_block_reason(self, c: dict) -> Optional[str]:
        # 표 행의 글자는 버튼 이름이 아니라 데이터다("승인대기" 행을 승인 버튼으로 오해하지 않는다). 행은 주소·핸들러만 본다.
        word = None if c["kind"] == "row" else self.policy.banned_word(c["text"], c["title"])
        if word:
            return f"누르지 않을 단어 \"{word}\" 가 있어"
        if SESSION_KILL.search(c["text"] or ""):
            return "로그아웃이라"
        return self.policy.risky_click(c["href"], c["onclick"])

    def _skip_click(self, c: dict, why: str) -> None:
        text = c["text"] or c["tag"]
        if (text, why) in self._skip_seen:
            return
        self._skip_seen.add((text, why))
        self.res.skipped.append({"text": text, "why": why})
        box = self._box(c)
        self._emit("web", "skip", msg=f"\"{text}\" 은(는) {why} 건너뜀", hl=box, hlKind="skip", shot=self._shot() if box else None)

    # ── 누르기 ──────────────────────────────────────────────────────────────

    def _extract(self) -> List[dict]:
        out = []
        for idx, frame in enumerate(self.page.frames):
            try:
                for c in frame.evaluate(_CANDIDATES_JS):
                    c["frame"] = idx
                    out.append(c)
            except Exception:
                continue                                   # 이동 중인 프레임
        return out

    def _alive(self, c: dict) -> bool:
        try:
            loc = self._locator(c)
            return loc.count() > 0 and loc.is_visible()
        except Exception:
            return False

    def _locator(self, c: dict):
        frames = self.page.frames
        frame = frames[c["frame"]] if c["frame"] < len(frames) else self.page.main_frame
        return frame.locator(f'[data-ieum-i="{c["i"]}"]').first

    def _box(self, c: dict) -> Optional[dict]:
        try:
            b = self._locator(c).bounding_box(timeout=1500)
        except Exception:
            return None
        if not b:
            return None
        return {"x": b["x"], "y": b["y"], "w": b["width"], "h": b["height"], "vw": VIEWPORT["width"], "vh": VIEWPORT["height"]}

    def _click(self, c: dict, depth: int) -> bool:
        loc = self._locator(c)
        text = c["text"] or c["tag"]
        self.action = {"row": "목록 첫 행 클릭", "link": f"{text} 링크 클릭"}.get(c["kind"], f"{text} 버튼 클릭")
        try:
            loc.scroll_into_view_if_needed(timeout=2000)
        except Exception:
            pass
        box = self._box(c)
        self._emit("web", "act", msg=self.action, hl=box, hlKind="act", shot=self._shot())
        before = self.page.url
        try:
            loc.click(timeout=4000)
        except Exception as exc:
            self._emit("web", "skip", msg=f"\"{text}\" 을(를) 누르지 못했습니다 ({type(exc).__name__})")
            return False
        self._settle()
        self._flush()
        after = self.page.url
        if after != before:
            self._enqueue(after, depth + 1, text)
            self._return_to(before)
        self._shot_quiet()
        return True

    def _return_to(self, url: str) -> None:
        """누른 결과 다른 화면으로 넘어갔다면 원래 화면으로 돌아와 나머지를 이어서 누른다."""
        try:
            self.page.go_back(wait_until="domcontentloaded", timeout=15_000)
        except Exception:
            pass
        if self.page.url != url:
            try:
                self.page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            except Exception:
                pass
        self._settle()

    # ── 로그인 ──────────────────────────────────────────────────────────────

    def _find_password(self):
        for frame in self.page.frames:
            try:
                loc = frame.locator("input[type=password]:visible")
                if loc.count() > 0:
                    return loc.first
            except Exception:
                continue
        return None

    def _login(self) -> None:
        user, pw = self.creds.get("username", ""), self.creds.get("password", "")
        if not user or not pw:
            raise RuntimeError("로그인 화면이 나왔는데 테스트 계정 정보가 없습니다.")
        pwd = self._find_password()
        login_page = self.page.url
        form = pwd.locator("xpath=ancestor::form[1]")
        has_form = form.count() > 0
        scope = form if has_form else pwd.page
        uid = scope.locator("input:not([type]), input[type=text], input[type=email], input[type=tel]").locator("visible=true").first
        self.action = "테스트 계정으로 로그인"
        uid.fill(user, timeout=5000)
        pwd.fill(pw, timeout=5000)
        submit = scope.locator("button[type=submit], input[type=submit], input[type=image]").first
        if submit.count() == 0:
            submit = scope.locator("button").first
        box = None
        try:
            b = submit.bounding_box(timeout=1500) if submit.count() else None
            box = {"x": b["x"], "y": b["y"], "w": b["width"], "h": b["height"], "vw": VIEWPORT["width"], "vh": VIEWPORT["height"]} if b else None
        except Exception:
            pass
        self._emit("web", "act", msg=self.action, hl=box, hlKind="act", shot=self._shot())
        self.login_phase = True
        try:
            if submit.count():
                submit.click(timeout=4000)
            else:
                pwd.press("Enter")
            try:
                self.page.wait_for_load_state("domcontentloaded", timeout=15_000)
            except Exception:
                pass
            self._settle(max_ms=4000)
        finally:
            self.login_phase = False
        if self._find_password():
            raise RuntimeError("로그인하지 못했습니다. 계정과 비밀번호를 확인해 주세요.")
        self.login_done = True
        self._build_recipe(login_page, user, pw)
        self.policy.visit(self.page.url)

    def _build_recipe(self, login_page: str, user: str, pw: str) -> None:
        """로그인 요청에서 필드 이름을 알아낸다. 도구를 실행할 때 같은 방식으로 로그인하려는 것이다."""
        req = self._login_req
        if not req:
            return
        fields = _parse_form(req["post"], req["ctype"])
        user_field = next((k for k, v in fields.items() if v == user), "")
        pass_field = next((k for k, v in fields.items() if v == pw), "")
        extra = {k: v for k, v in fields.items() if k not in (user_field, pass_field) and v != ""}
        self.res.login_path = urlsplit(req["url"]).path
        if user_field and pass_field:
            self.res.recipe = {"loginUrl": login_page, "action": req["url"], "method": req["method"], "json": "json" in (req["ctype"] or "").lower(),
                               "userField": user_field, "passField": pass_field, "extra": extra}

    # ── 네트워크 ────────────────────────────────────────────────────────────

    def _count(self, delta: int, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight = max(0, self._inflight + delta)

    def _route(self, route, request) -> None:
        try:
            self._route_inner(route, request)
        except Exception:
            try:
                route.continue_()
            except Exception:
                pass

    def _route_inner(self, route, request) -> None:
        url, method, rtype = request.url, request.method.upper(), request.resource_type
        if not url.startswith(("http://", "https://")) or rtype in STATIC_TYPES or is_asset(url):
            route.continue_()
            return
        # 클릭 없이 화면 스크립트가 부르는 GET 중에도 삭제·승인처럼 보이는 이름이 있다(레거시는 쓰기를 GET 으로 만들기도 한다).
        # 화면 이동(document)은 읽기라 제외하고, 데이터를 부르는 요청(xhr, fetch)만 이름으로 본다.
        risky_get = method in ("GET", "HEAD") and rtype in ("xhr", "fetch") and self.policy.same_origin(url) and risky_call(urlsplit(url).path)
        if method in ("GET", "HEAD") and not risky_get:
            route.continue_()
            return
        post = None
        try:
            post = request.post_data
        except Exception:
            pass
        ctype = (request.headers or {}).get("content-type", "")
        if self.login_phase and self.policy.same_origin(url):
            self._login_req = {"url": url, "method": method, "post": post, "ctype": ctype}
            route.continue_()
            self._record_event("allow", method, url, None)
            return
        if self.policy.is_read_post(url):
            route.continue_()
            return
        # 여기까지 왔으면 쓰기다. 운영에 보내지 않는다.
        self.res.blocked += 1
        self._blocked_reqs.add(request)
        if self._room(f"{method} {urlsplit(url).path}"):
            self.res.observed.append(Observed(method=method, url=url, status=None, ctype=ctype, headers=self._keep_headers(request.headers),
                                              post=post, blocked=True, out_of_scope=not self.policy.in_scope(url),
                                              label=f"{self.heading} > {self.action}", screen=self.policy.display(self.page.url)))
        self._record_event("block", method, url, None)
        if rtype in ("xhr", "fetch"):
            # 화면 스크립트가 응답을 기다리다 멈추지 않게 빈 성공 응답을 준다.
            route.fulfill(status=200, content_type="application/json; charset=utf-8", body="{}")
        else:
            route.abort("blockedbyclient")

    def _room(self, key: str) -> bool:
        """같은 요청의 표본을 더 들고 있을 자리가 있는가."""
        self._samples[key] = self._samples.get(key, 0) + 1
        return self._samples[key] <= MAX_SAMPLES

    def _keep_headers(self, headers: Optional[dict]) -> Dict[str, str]:
        """도구를 만들 때 다시 보내야 하는 요청 헤더만 남긴다. 인증·세션 값과 요청마다 바뀌는 토큰은 뺀다."""
        keep = {}
        for k, v in (headers or {}).items():
            lk = k.lower()
            if is_secret_key(lk) or "csrf" in lk or "xsrf" in lk:
                continue
            if lk in ("x-requested-with", "content-type", "accept") or lk.startswith("x-"):
                keep[lk] = v
        return keep

    def _on_response(self, response) -> None:
        try:
            req = response.request
            if req in self._blocked_reqs:
                return
            rtype, url, status = req.resource_type, response.url, response.status
            if rtype in STATIC_TYPES or is_asset(url) or 300 <= status < 400:
                return
            headers = response.headers or {}
            ctype = headers.get("content-type", "")
            is_file = "attachment" in headers.get("content-disposition", "").lower() or any(t in ctype.lower() for t in FILE_TYPES)
            if rtype == "document" and not is_file:
                return                                       # 화면 이동이다. API 가 아니다
            self._pending.append((response, req, is_file, ctype))
        except Exception:
            pass

    def _flush(self) -> None:
        """끝난 요청들의 응답 본문을 읽어 기록한다. 핸들러 안에서 읽으면 페이지 로딩이 멈춘다."""
        pending, self._pending = self._pending, []
        for response, req, is_file, ctype in pending:
            self.res.total += 1
            if not self._room(f"{req.method.upper()} {urlsplit(response.url).path}"):
                continue
            body = ""
            if not is_file:
                try:
                    body = response.text()[:MAX_BODY]
                except Exception:
                    pass
            ms = None
            try:
                t = req.timing
                if t and t.get("responseEnd", -1) >= 0:
                    ms = int(t["responseEnd"])
            except Exception:
                pass
            url, method = response.url, req.method.upper()
            try:
                post = req.post_data
            except Exception:
                post = None
            obs = Observed(method=method, url=url, status=response.status, ctype=ctype, ms=ms, headers=self._keep_headers(req.headers), post=post,
                           body=body, file=is_file, out_of_scope=not self.policy.in_scope(url),
                           label=f"{self.heading} > {self.action}", screen=self.policy.display(self.page.url))
            self.res.observed.append(obs)
            self._record_event("out" if obs.out_of_scope else "cap", method, url, response.status, ms)

    def _record_event(self, tag: str, method: str, url: str, code: Optional[int], ms: Optional[int] = None) -> None:
        key = f"{tag} {method} {urlsplit(url).path}"
        self._dups[key] = self._dups.get(key, 0) + 1
        if self._dups[key] > DUP_EVENTS:
            return
        self._emit("web", "req", m=method, p=self.policy.display(url), code=code, tag=tag, ms=ms)

    def _on_new_page(self, page) -> None:
        """window.open 으로 뜬 창. 주소만 챙기고 닫는다."""
        if self._creating_main or page == getattr(self, "page", None):
            return
        self._watch_dialogs(page)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=8000)
            url = page.url
            page.close()
            if url and url != "about:blank":
                self._enqueue(url, 1, "새 창")
        except Exception:
            pass

    @staticmethod
    def _watch_dialogs(page) -> None:
        """alert/confirm 은 닫는다. confirm 은 취소로 답한다 — "삭제하시겠습니까?" 에 확인을 누르면 안 된다."""
        def handle(d):
            try:
                d.accept() if d.type == "beforeunload" else d.dismiss()
            except Exception:
                pass
        page.on("dialog", handle)

    # ── 대기, 캡처 ──────────────────────────────────────────────────────────

    def _settle(self, max_ms: int = 3000, quiet_ms: int = 350) -> None:
        """진행 중인 요청이 없는 상태가 잠시 이어질 때까지 기다린다. networkidle 은 폴링 화면에서 영영 안 온다."""
        end, quiet_since = time.time() + max_ms / 1000, None
        while time.time() < end:
            self.page.wait_for_timeout(80)
            if self._inflight <= 0:
                quiet_since = quiet_since or time.time()
                if (time.time() - quiet_since) * 1000 >= quiet_ms:
                    break
            else:
                quiet_since = None

    def _shot(self) -> Optional[int]:
        try:
            return self._on_shot(self.page.screenshot(type="jpeg", quality=55))
        except Exception:
            return None

    def _shot_quiet(self) -> None:
        self._shot()

"""운영 화면 탐색 — 서비스 계정으로 로그인해 메뉴를 돌며 실제 요청과 응답을 캡처한다.

안전은 두 겹이다.

1) 무엇을 누를지 고를 때: 누르지 않을 단어, 제외 경로, 삭제처럼 보이는 주소는 건너뛴다.
2) 브라우저가 요청을 내보낼 때: POST/PUT/PATCH/DELETE 는 전부 가로채 운영에 보내지 않는다.
   로그인 요청과, 사용자가 "조회용 POST" 로 지정한 경로만 예외다.

1)은 사람이 읽을 이유를 남기려는 장치이고, 안전을 지키는 것은 2)다. 눌러서는 안 되는 버튼을
놓쳐도 쓰기는 운영에 닿지 않는다. 레거시 시스템 중에는 쓰기를 GET 링크로 구현한 곳이 있어서
그 경우만 1)의 주소 검사가 막는다.

사람과 함께 탐색하기(hitl 를 받았을 때, 상태와 규칙은 hitl.py):
  - 로그인한 뒤 메뉴를 읽어 탐색 목적에 맞춰 순서를 정하고(planner.py), 관련 높은 메뉴부터 연다.
  - 판단하기 어려운 곳(위험해 보이는 버튼, 입력값이 필요한 화면, 권한이 없는 화면, 관련 낮은 메뉴)에서는 **질문을 남기고 기다리지 않는다.**
    다른 메뉴를 계속 탐색하다가, 답이 나오거나 시간이 지나면(안전한 쪽으로) 그 답대로 그 화면에 다시 돌아와 처리한다.
  - 사람이 눌러도 된다고 한 버튼을 눌러 볼 때도, 직접 조작할 때도 2)는 그대로다. 요청은 운영에 닿지 않는다.
    눌러 보는 동안에는 화면 이동도 막는다(GET 으로 구현된 쓰기가 있어도 닿지 않게). 직접 조작에서 풀어 주는 것은 로그인 요청뿐이다.
  - 사람이 일시정지하거나 직접 조작하면 이 스레드가 쉰다. 쉬는 시간은 시간 상한(max_seconds)에 넣지 않는다.

Playwright 는 동기 API 를 쓴다. 이 모듈은 전용 스레드에서만 부른다(jobs.py).
"""
import re
import time
from collections import deque
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass, field
from itertools import chain
from typing import Callable, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urljoin, urlsplit

from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery import infer, planner
from app.ieum.discovery.hitl import Hitl
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
GOTO_TIMEOUT_MS = 30_000       # 화면 하나를 여는 데 주는 시간(DOMContentLoaded 까지). 시험이 줄여 쓴다
OBSERVE_MS = 1600          # 화면마다 마지막에 잠깐 지켜본다. 자동 저장, 폴링처럼 화면이 스스로 부르는 요청을 보려는 것이다
DUP_EVENTS = 3             # 같은 요청은 기록에 이 횟수까지만 올린다(자동 저장처럼 반복되는 요청)
MAX_SAMPLES = 10           # 같은 (메서드, 경로)의 요청은 이만큼만 본문까지 들고 있는다. 폴링 화면이 메모리를 먹지 않게

# 사람에게 묻는 질문 수 상한. 사이트가 크면 질문이 끝없이 이어져 사람이 지치고, 어차피 답이 없으면 기본값으로 처리된다.
MAX_ASKS = {"low": 3, "perm": 3, "risky": 10, "input": 10, "screen": 30}
MAX_MENUS = 60             # 계획에 올리는 메뉴 수 상한
TAKE_SHOT_SEC = 0.8        # 직접 조작 중 화면 캡처 간격(입력이 없을 때)
IDLE_POLL_MS = 300         # 일시정지, 질문 대기 중 확인 간격

# 누르지 않을 단어(설정)에는 없지만 데이터 상태를 바꾸는 것처럼 보이는 버튼 글자. 기본 금지어(삭제, 저장, 승인, 결재, 결제, 확정, 전송)는 넣지 않는다.
_RISKY_KO = ("마감", "취소", "반려", "폐기", "해지", "종료", "정산", "발행", "이관", "상신", "회수", "반송", "중지", "해제", "폐쇄", "일괄")
_RISKY_EN = re.compile(r"\b(reject|terminate|settle|revoke|void|deactivate|finalize)\b", re.I)
_PLAIN = frozenset(("취소",))                      # 양식을 닫는 흔한 버튼. 이름이 이것뿐이면 위험하지 않다
_NEEDS_INPUT = re.compile(r"(입력|선택|필수|기입|넣어)")       # "거래처명을 입력하세요" 같은 안내
_DENY_TEXT = re.compile(r"(접근 ?권한|권한이 ?없|권한 ?없음|허용되지 ?않|접근이 ?거부|forbidden|access denied|not authorized|unauthori[sz]ed|\b403\b)", re.I)
_LOGIN_PATH = re.compile(r"(?:^|/)(?:login|logon|signin|sign-in|auth|sso)", re.I)
_SHORT_WHY = {"제외 경로라 열지 않음": "제외 경로", "탐색 범위 밖이라 열지 않음": "탐색 범위 밖", "삭제처럼 보이는 주소라 열지 않음": "삭제처럼 보이는 주소"}

# 화면 안의 눌러볼 만한 것을 모은다. 번호를 data 속성으로 붙여 두면 다시 찾을 수 있고, 같은 요소를 두 번 누르지 않는다.
# 버튼에는 가까이 있는 입력칸(`inp`)도 붙인다 — 값이 필요한 화면에서 어느 칸에 넣을지 사람에게 보여 주려는 것이다.
_CANDIDATES_JS = """
() => {
  const SEL = 'a[href], button, input[type=button], input[type=submit], input[type=image], [role=button], [onclick], .btn';
  const out = [];
  let n = window.__ieumN || 0, m = window.__ieumM || 0;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none' && !el.disabled;
  };
  const label = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.alt || '')
    .replace(/\\s+/g, ' ').trim().slice(0, 60);
  const typable = (i) => i.tagName === 'TEXTAREA' || (i.tagName === 'INPUT' && ['', 'text', 'search', 'number', 'tel', 'email'].includes((i.getAttribute('type') || '').toLowerCase()));
  const inputLabel = (i) => {
    let t = '';
    if (i.id) { const l = document.querySelector('label[for="' + CSS.escape(i.id) + '"]'); if (l) t = l.innerText; }
    if (!t && i.closest('label')) t = i.closest('label').innerText;
    if (!t) { let s = i.previousSibling; while (s && !t) { t = (s.nodeType === 3 ? s.textContent : (s.innerText || '')); t = (t || '').trim(); s = s.previousSibling; } }
    if (!t) { const td = i.closest('td'); const th = td && td.previousElementSibling; t = th ? th.innerText : ''; }
    return (t || i.placeholder || i.getAttribute('aria-label') || i.name || i.id || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
  };
  const nearInput = (el) => {
    let box = el.parentElement;
    for (let up = 0; box && up < 4; up++, box = box.parentElement) {
      const all = [...box.querySelectorAll('input, textarea')].filter((i) => typable(i) && visible(i) && !i.readOnly);
      if (!all.length) continue;
      const before = all.filter((i) => !!(i.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      const pool = before.length ? before : all;
      const empty = pool.filter((i) => !i.value);
      const pick = (empty.length ? empty : pool).slice(-1)[0];
      if (!pick.dataset.ieumN) pick.dataset.ieumN = String(++m);
      return { n: pick.dataset.ieumN, label: inputLabel(pick), empty: !pick.value };
    }
    return null;
  };
  const push = (el, kind) => {
    if (!visible(el)) return;
    if (!el.dataset.ieumI) el.dataset.ieumI = String(++n);
    out.push({ i: el.dataset.ieumI, tag: el.tagName.toLowerCase(), kind, text: label(el),
               href: el.getAttribute('href') || '', onclick: (el.getAttribute('onclick') || '').slice(0, 200),
               title: el.getAttribute('title') || '', inp: kind === 'button' ? nearInput(el) : null });
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
  window.__ieumM = m;
  return out;
}
"""

# 메뉴로 보이는 링크. 이름 붙은 내비게이션 영역 안의 링크를 먼저 보고, 그런 영역이 없으면 화면의 링크 전부를 본다.
_MENUS_JS = """
() => {
  const NAV = '#menu, #gnb, #lnb, #snb, #nav, #navi, #sidebar, .menu, .gnb, .lnb, .snb, .nav, .navi, .navbar, .sidebar, .side-menu, nav, [role=navigation], [role=menubar], aside';
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width >= 4 && r.height >= 4 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.title || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const out = [], seen = new Set();
  const take = (root) => {
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href) || !vis(a)) return;
      const name = label(a);
      if (!name || seen.has(a.href)) return;
      seen.add(a.href);
      out.push({ name, url: a.href });
    });
  };
  [...document.querySelectorAll(NAV)].filter(vis).forEach(take);
  if (!out.length && document.body) take(document.body);
  return out;
}
"""

_HEADING_JS = """
() => {
  const h = document.querySelector('h1, h2, .page-title, .title');
  return { title: document.title || '', heading: h ? (h.innerText || '').replace(/\\s+/g, ' ').trim() : '' };
}
"""

_BODY_TEXT_JS = "() => (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 600)"

# 좌표가 가리키는 곳의 이름(버튼, 링크). 사람이 직접 조작할 때 어디를 눌렀는지 기록에 남긴다.
_POINT_JS = """
([x, y]) => {
  const el = document.elementFromPoint(x, y);
  const hit = el && el.closest('a, button, input, [onclick], [role=button], tr');
  if (!hit) return '';
  return (hit.innerText || hit.value || hit.getAttribute('aria-label') || hit.title || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
}
"""

_BOX_JS = """
(url) => {
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.href !== url) continue;
    const r = a.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) return { x: r.x, y: r.y, w: r.width, h: r.height };
  }
  return null;
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
    human: bool = False                    # 사람이 허락했거나 직접 조작해서 나간 요청
    menu: str = ""                         # 요청이 나간 때 탐색하던 메뉴(탐색 계획 항목 id)


@dataclass
class Entry:
    """갈 곳 하나."""
    url: str
    depth: int
    menu: Optional[str] = None             # 탐색 계획 항목 id. 계획 밖의 화면이면 None
    text: str = ""
    again: bool = False                    # 이미 연 화면에 다시 가는 것(질문에 답한 뒤, 직접 조작한 뒤). 방문 판정과 개수 세기를 건너뛴다
    task: Optional[dict] = None            # 화면을 연 뒤 할 일: {op: press|fill, ckey, value}


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


def _clamp(v, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return lo


class Crawler:
    def __init__(self, policy: Policy, start_url: str, creds: Optional[dict], *, emit: Callable, on_shot: Callable,
                 cancelled: Callable[[], bool], hitl: Optional[Hitl] = None, hints: Optional[Callable[[], List[dict]]] = None):
        """emit(l, k, **fields) 로 이벤트를 쌓고, on_shot(jpeg 바이트) 가 화면 캡처 번호를 돌려준다.

        hitl 을 주면 계획, 질문, 일시정지, 직접 조작이 켜진다. 주지 않으면 사람 없이 처음부터 끝까지 도는 탐색이다.
        hints() 는 Git 소스 분석이 지금까지 찾은 API({title, method, path, mode}). 같이 돌 때만 있고, 위험해 보이는 버튼을 물을 때 근거로 쓴다.
        """
        self.policy = policy
        self.start_url = start_url
        self.creds = creds or {}
        self._emit, self._on_shot, self._cancelled = emit, on_shot, cancelled
        self.hitl = hitl
        self._hints = hints
        self.res = CrawlResult()
        self.heading = ""
        self.action = "화면 열기"
        self.login_phase = False
        self.login_done = False
        self._login_req: Optional[dict] = None
        self._pending: list = []
        self._inflight = 0
        self._dups: Dict[str, int] = {}
        self._queue: deque = deque()              # 계획 밖의 화면(사람 없는 탐색은 전부 여기)
        self._front: deque = deque()              # 먼저 갈 곳: 메뉴 안에서 찾은 화면, 질문에 답한 뒤 다시 갈 곳
        self._skip_events = 0
        self._skip_seen: set = set()          # 같은 건너뜀(로그아웃 링크 등)이 화면마다 반복 기록되지 않게
        self._started = 0.0
        self._relogins = 0
        self._samples: Dict[str, int] = {}
        self._blocked_reqs: set = set()      # 우리가 가로챈 요청. 가짜 응답이 response 이벤트로 또 올라오는 것을 거른다
        self._creating_main = False
        self._stop_said = ""
        self.login_page_path = ""
        # 사람과 함께 탐색하기
        self._tried: Dict[str, set] = {}          # 화면별로 이미 본 버튼. 다시 열었을 때 처음부터 또 누르지 않게
        self._menu: Optional[str] = None          # 지금 탐색 중인 계획 항목 id
        self._why: Optional[int] = None           # 지금 하는 일이 답하려는 질문 예시 번호
        self._menu_urls: set = set()
        self._picked: set = set()                 # 이미 연 계획 항목
        self._planned = False
        self._dfs = False                         # 목적이 있는 계획에서만: 메뉴 안에서 찾은 화면을 그 메뉴 안에서 이어서 탐색한다
        self._home = ""                           # 로그인한 뒤 도착한 화면
        self._cur: Optional[Entry] = None
        self._in_page = False
        self._abandon = False                     # 직접 조작으로 화면 상태가 바뀌어 하던 화면을 접는다
        self._abandon_url = ""
        self._by_human = self._pressing = self._accept_confirm = self._taking = False
        self._dialogs: List[Tuple[str, str]] = []
        self._status: Optional[int] = None
        self._idle = 0.0
        self._idle_since: Optional[float] = None
        self._idle_n = 0
        self._asks = {k: 0 for k in MAX_ASKS}
        self._low_auto = 0
        self._wait_said = -1
        self._paused_said = False

    # ── 진입 ────────────────────────────────────────────────────────────────

    def run(self) -> CrawlResult:
        from playwright.sync_api import sync_playwright

        self._started = time.time()
        self._say("브라우저를 띄우고 있습니다. 이 PC 에서 처음 띄우는 거라면 1분 가까이 걸릴 수 있습니다")
        with sync_playwright() as pw:
            browser, kind = browser_mod.launch(pw)
            self.res.browser = kind
            if browser_mod.translated() and "네이티브" not in kind:
                self._say("이 PC 에서는 브라우저가 Rosetta 변환으로 돌아 자바스크립트가 5~10배 느립니다. 무거운 사이트는 열리지 않을 수 있습니다")
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
                self._wrap_up()
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
        self.res.seconds = round(time.time() - self._started - self._idle, 1)
        return self.res

    def _wrap_up(self) -> None:
        """탐색이 어떻게 끝났든: 열린 직접 조작을 닫고, 답을 못 받은 질문과 탐색 중인 메뉴를 정리한다."""
        h = self.hitl
        if h is None:
            return
        if h.take is not None:
            h.end_take("시스템")
        h.finish_plan()
        h.resolve_all(lambda q: q["def"], "end")
        if self._low_auto:
            self._say(f"관련도가 낮은 메뉴 {self._low_auto}개는 사람에게 묻지 않고 건너뛰었습니다")

    def _say(self, msg: str) -> None:
        self._emit("sys", "note", msg=msg)

    # ── 탐색 ────────────────────────────────────────────────────────────────

    def _start_page_timeout(self) -> str:
        msg = f"시작 페이지를 {GOTO_TIMEOUT_MS // 1000}초 안에 열지 못했습니다. 사이트가 느리거나 접속이 막혀 있을 수 있습니다."
        if browser_mod.translated() and "네이티브" not in self.res.browser:
            msg += " 이 PC 의 브라우저가 Rosetta 변환으로 돌아 느린 탓일 수도 있습니다(Chrome 을 설치하거나 arm64 Python 으로 venv 를 다시 만들어 주세요)."
        return msg

    def _explore(self) -> None:
        from playwright.sync_api import TimeoutError as PlaywrightTimeout
        try:
            self._goto(self.start_url)
        except PlaywrightTimeout as exc:
            raise RuntimeError(self._start_page_timeout()) from exc
        self._emit_page(0, "시작 페이지를 열었습니다")
        self.policy.visit(self.page.url)
        logged_in_now = False
        if self._find_password():
            self.login_page_path = urlsplit(self.page.url).path
            self._login()
            logged_in_now = True
        else:
            self.login_done = True
        self._home = self.page.url
        # 로그인했다면 도착한 화면은 새 화면이라 page 이벤트를 낸다. 안 했다면 시작 화면에 이미 냈다.
        self._after_load(0, first=not logged_in_now)
        self._loop()

    def _loop(self) -> None:
        while True:
            reason = self._stop_reason()
            if reason:
                self.res.stopped = reason
                return
            self._apply_answers()
            entry = self._next_entry()
            if entry is None:
                if self._gate():
                    continue
                return
            self._open(entry)
            if self._abandon:                       # 직접 조작으로 화면 상태가 바뀌었다. 하던 화면은 처음부터가 아니라 이어서 다시 한다
                self._abandon = False
                cur = self._cur or entry
                # 사람이 답한 일(누르기, 값 넣기)을 하기 전에 접었다면 그 일도 이어서 한다. 한 일은 _act_on_page 가 task 를 비워 둔다.
                self._front.appendleft(Entry(url=self._abandon_url or cur.url, depth=cur.depth, menu=cur.menu, text=cur.text, again=True, task=cur.task))

    def _open(self, e: Entry) -> None:
        if not e.again:
            self.policy.visit(e.url)
        self._cur = e
        self._set_menu(e.menu)
        try:
            self._goto(e.url)
        except Cancelled:
            raise
        except Exception as exc:
            self._skip(e.url, f"열지 못함 ({type(exc).__name__})")
            return
        self._after_load(e.depth, entry=e)

    def _next_entry(self) -> Optional[Entry]:
        while True:
            if self._front:
                e = self._front.popleft()
            else:
                e = self._pick_menu() if self.hitl else None
                if e is None:
                    if not self._queue:
                        return None
                    e = self._queue.popleft()
            if e.again:
                return e
            ok, why = self.policy.url_decision(e.url, e.depth)
            if not ok:
                self._skip(e.url, why, e.text)
                continue
            return e

    def _stop_reason(self) -> str:
        if self._cancelled():
            raise Cancelled()
        self._hitl_step()
        reason = ""
        if self._active_seconds() > self.policy.max_seconds:
            reason, msg = "time", f"시간 상한({self.policy.max_seconds}초)에 도달해 멈춥니다"
        elif self.policy.pages >= self.policy.max_pages:
            reason, msg = "limit", f"화면 상한({self.policy.max_pages})에 도달해 멈춥니다"
        if reason and reason != self._stop_said:         # 한 화면 안과 화면 사이에서 두 번 물어도 알림은 한 번만
            self._stop_said = reason
            self._say(msg)
        return reason

    def _active_seconds(self) -> float:
        """탐색을 시작한 뒤 일한 시간. 일시정지, 직접 조작, 질문 대기로 쉰 시간은 뺀다 — 사람이 기다리게 한 시간이 상한을 갉아먹으면 안 된다."""
        now = time.time()
        idle = self._idle + ((now - self._idle_since) if self._idle_since else 0.0)
        return now - self._started - idle

    def _idle_begin(self) -> None:
        if self._idle_n == 0:
            self._idle_since = time.time()
        self._idle_n += 1

    def _idle_end(self) -> None:
        """쉬는 구간은 겹칠 수 있다(질문을 기다리다 직접 조작으로 넘어가는 경우). 가장 바깥 구간이 끝날 때 시간을 더한다."""
        self._idle_n = max(0, self._idle_n - 1)
        if self._idle_n == 0 and self._idle_since is not None:
            self._idle += time.time() - self._idle_since
            self._idle_since = None

    def _goto(self, url: str) -> None:
        resp = self.page.goto(url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        self._status = resp.status if resp else None
        self._settle()

    def _after_load(self, depth: int, first: bool = False, entry: Optional[Entry] = None) -> None:
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
        again = bool(entry and entry.again)
        if not first and not again:
            self._emit_page(depth, f"{self.heading} 화면을 열었습니다")
        self._flush()
        if self.hitl and entry is not None and not again:
            if self._denied(entry) or self._screen_gate(entry):
                return
        if self.hitl and not self._planned and depth == 0 and self.login_done:
            self._build_plan()
        self._act_on_page(depth, entry)

    def _looks_like_login(self) -> bool:
        """비밀번호 칸이 있고 주소가 로그인 화면이면 세션이 끊긴 것이다. 비밀번호 변경 화면은 해당하지 않는다."""
        if not self._find_password():
            return False
        path = urlsplit(self.page.url).path
        return path == self.login_page_path or "login" in path.lower()

    def _emit_page(self, depth: int, msg: str, human: bool = False) -> None:
        meta = self._heading()
        self.res.pages.append({"url": self.policy.display(self.page.url), "title": meta.get("heading") or meta.get("title"), "depth": depth})
        self._emit("web", "page", url=self.policy.display(self.page.url), title=meta.get("title", ""), cnt=len(self.res.pages), msg=msg, shot=self._shot(),
                   menu=self._menu, why=self._why, human=1 if human else None)

    def _heading(self) -> dict:
        try:
            return self.page.evaluate(_HEADING_JS)
        except Exception:
            return {}

    @staticmethod
    def _key(c: dict) -> str:
        return f"{c['tag']}|{c['kind']}|{c['text']}|{c['href']}|{c['onclick']}"

    def _act_on_page(self, depth: int, entry: Optional[Entry] = None) -> None:
        tried = self._tried.setdefault(self.policy.normalize(self.page.url), set())
        task = entry.task if entry else None
        work: deque = deque()
        acted = 0
        ignore: set = set()                           # 사람이 답한 버튼만 누르는 동안 다른 버튼은 건드리지 않는다. 이미 본 것(tried)과 달리 나중에 이어서 볼 것이다

        def refill(first: bool = False) -> None:
            fresh = []
            for c in self._extract():
                key = self._key(c)
                if key in tried or key in ignore or any(w["key"] == key for w in work) or any(f["key"] == key for f in fresh):
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

        self._in_page = True
        try:
            if task:
                # 사람이 답한 버튼 하나만 누른다. 나머지는 이 화면을 처음 열었을 때 이미 본 것이다.
                target = None
                for c in self._extract():
                    c["key"] = self._key(c)
                    if c["key"] == task["ckey"]:
                        target = c
                    else:
                        ignore.add(c["key"])
                if target is None:
                    self._emit("web", "skip", msg="사람이 답한 버튼을 화면에서 다시 찾지 못했습니다", menu=self._menu)
                    entry.task = None
                    return
                tried.discard(target["key"])
                work.append(target)
            else:
                refill(first=True)
            while work and acted < MAX_ACTIONS:
                if self._stop_reason() or self._abandon:
                    return
                c = work.popleft()
                tried.add(c["key"])
                if not self._alive(c):                     # 앞선 동작으로 화면이 다시 그려져 사라진 것
                    continue
                why = self._click_block_reason(c)
                if why:
                    self._skip_click(c, why)
                    continue
                forced = bool(task) and c["key"] == task["ckey"]
                press = forced and task["op"] == "press"
                if self.hitl and not forced:
                    word = self._risky_word(c)
                    if word:
                        if self._risky_question(c, word) != "press":
                            continue
                        press = True
                fill = task.get("value") if forced and task["op"] == "fill" else None
                if forced:
                    entry.task = None                                       # 이 일은 지금 한다. 이 뒤에 화면을 접어도 다시 하지 않는다
                if self._click(c, depth, press=press, fill=fill):
                    acted += 1
                refill()
                self.page.wait_for_timeout(self.policy.delay_ms)
            if self._abandon:
                return
            self.page.wait_for_timeout(OBSERVE_MS)
            self._flush()
        finally:
            self._in_page = False

    @staticmethod
    def _real_href(href: str) -> bool:
        h = (href or "").strip()
        return bool(h) and not h.startswith(("#", "javascript:", "mailto:", "tel:"))

    def _enqueue(self, url: str, depth: int, text: str, cand: Optional[dict] = None) -> None:
        """갈 곳을 큐에 넣는다. 못 가는 곳은 이유를 남기되, 같은 이유로 기록이 넘치지 않게 한다."""
        ok, why = self.policy.url_decision(url, depth)
        if ok:
            n = self.policy.normalize(url)
            if n in self._menu_urls:
                return                                      # 메뉴는 계획이 순서대로 연다
            if any(self.policy.normalize(e.url) == n for e in chain(self._queue, self._front)):
                return
            entry = Entry(url, depth, self._menu, (text or "").strip()[:30])
            # 목적이 있으면 메뉴 단위로 끝까지 본다(계획의 진행이 메뉴마다 읽힌다). 목적이 없으면 예전처럼 모든 메뉴를 먼저 훑는다 — 화면 상한에 먼저 닿아도 빠지는 메뉴가 없게.
            (self._front if self._menu and self._dfs else self._queue).append(entry)
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
            self._emit("web", "skip", msg=f"{label or self.policy.display(url)} — {why}", menu=self._menu)

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
        self._emit("web", "skip", msg=f"\"{text}\" 은(는) {why} 건너뜀", hl=box, hlKind="skip", shot=self._shot() if box else None, menu=self._menu, why=self._why)

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

    def _frame(self, c: dict):
        frames = self.page.frames
        return frames[c["frame"]] if c["frame"] < len(frames) else self.page.main_frame

    def _locator(self, c: dict):
        return self._frame(c).locator(f'[data-ieum-i="{c["i"]}"]').first

    def _box(self, c: dict) -> Optional[dict]:
        try:
            b = self._locator(c).bounding_box(timeout=1500)
        except Exception:
            return None
        if not b:
            return None
        return {"x": b["x"], "y": b["y"], "w": b["width"], "h": b["height"], "vw": VIEWPORT["width"], "vh": VIEWPORT["height"]}

    def _click(self, c: dict, depth: int, press: bool = False, fill: Optional[str] = None) -> bool:
        """press: 사람이 눌러도 된다고 한 버튼. fill: 사람이 알려 준 값을 입력칸에 넣고 누른다. 둘 다 요청은 운영에 닿지 않는다."""
        loc = self._locator(c)
        text = c["text"] or c["tag"]
        self.action = {"row": "목록 첫 행 클릭", "link": f"{text} 링크 클릭"}.get(c["kind"], f"{text} 버튼 클릭")
        shown = self.action
        if fill is not None:
            shown = f"{(c.get('inp') or {}).get('label') or '입력칸'}에 \"{fill}\" 넣고 {text} 버튼을 누릅니다 (사람이 알려 줌)"
        elif press:
            shown = f"{self.action} (사람이 허락함)"
        try:
            loc.scroll_into_view_if_needed(timeout=2000)
        except Exception:
            pass
        box = self._box(c)
        human = press or fill is not None
        self._emit("web", "act", msg=shown, hl=box, hlKind="act", shot=self._shot(), menu=self._menu, why=self._why, human=1 if human else None)
        before = self.page.url
        self._dialogs.clear()
        with (self._human_scope(press=press) if human else nullcontext()):
            if fill is not None and not self._fill(c, fill):
                self._emit("web", "skip", msg=f"\"{text}\" 앞의 입력칸을 찾지 못해 값을 넣지 못했습니다", menu=self._menu)
                return False
            try:
                loc.click(timeout=4000)
            except Exception as exc:
                self._emit("web", "skip", msg=f"\"{text}\" 을(를) 누르지 못했습니다 ({type(exc).__name__})", menu=self._menu)
                return False
            self._settle()
        self._flush()
        after = self.page.url
        if after != before:
            self._enqueue(after, depth + 1, text)
            self._return_to(before)
        self._shot_quiet()
        if self.hitl and fill is None:
            self._check_needs_input(c, depth)
        return True

    def _fill(self, c: dict, value: str) -> bool:
        inp = c.get("inp")
        if not inp:
            return False
        try:
            self._frame(c).locator(f'[data-ieum-n="{inp["n"]}"]').first.fill(value, timeout=3000)
            return True
        except Exception:
            return False

    @contextmanager
    def _human_scope(self, press: bool = False):
        """사람의 결정으로 하는 동작. 나간 요청에 '사람'을 달고, 눌러 보는 중이면 확인 창에 확인을 누르고 화면 이동을 막는다."""
        prev = (self._by_human, self._pressing, self._accept_confirm)
        self._by_human = True
        if press:
            self._pressing = self._accept_confirm = True
        try:
            yield
        finally:
            try:
                self._flush()
            except Exception:
                pass
            self._by_human, self._pressing, self._accept_confirm = prev

    def _return_to(self, url: str) -> None:
        """누른 결과 다른 화면으로 넘어갔다면 원래 화면으로 돌아와 나머지를 이어서 누른다."""
        try:
            self.page.go_back(wait_until="domcontentloaded", timeout=15_000)
        except Exception:
            pass
        if self.page.url != url:
            try:
                self.page.goto(url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
            except Exception:
                pass
        self._settle()

    # ── 사람과 함께: 계획 ───────────────────────────────────────────────────

    def _read_menus(self) -> List[dict]:
        out, seen_url, seen_name = [], set(), {}
        for frame in self.page.frames:
            try:
                rows = frame.evaluate(_MENUS_JS)
            except Exception:
                continue
            for m in rows:
                n = self.policy.normalize(m["url"])
                if n in seen_url or SESSION_KILL.search(m["url"]) or SESSION_KILL.search(m["name"]):
                    continue
                seen_url.add(n)
                name, k = m["name"], seen_name.get(m["name"], 0)
                seen_name[m["name"]] = k + 1
                out.append({"name": f"{name} ({k + 1})" if k else name, "url": m["url"]})
        return out[:MAX_MENUS]

    def _build_plan(self) -> None:
        """로그인한 뒤 처음 도착한 화면에서 메뉴를 읽어 탐색 목적에 맞춰 순서를 정한다. 이 화면에서만 한 번 한다."""
        h = self.hitl
        self._planned = True
        self._emit("web", "wait", msg="메뉴를 읽고 탐색 계획을 세우는 중입니다")         # AI 가 정하면 몇 초 걸린다
        usable, excluded = [], []
        for m in self._read_menus():
            ok, why = self.policy.url_decision(m["url"], 1)
            if ok:
                usable.append(m)
            elif why in _SHORT_WHY:
                excluded.append(dict(m, why=_SHORT_WHY[why], reason=why))
        items, by = planner.build_plan(usable, h.purpose, h.ques)
        for ex in excluded:                                  # 제외 경로는 계획에 건너뜀으로 보인다
            items.append({"id": f"m{len(items) + 1}", "name": ex["name"], "rel": "excl", "qa": [], "why": ex["why"], "st": "skip", "hum": False, "url": ex["url"]})
        h.set_plan(items, by)
        self._dfs = by != "none"
        self._menu_urls = {self.policy.normalize(it["url"]) for it in items if it.get("url")}
        if not items:
            return
        n = len(items) - len(excluded)
        if by == "none":
            msg, det = f"메뉴 {n}개를 읽었습니다. 탐색 목적이 없어 화면 순서대로 탐색합니다", ""
        else:
            msg = f"메뉴 {n}개를 읽고 탐색 목적에 맞춰 순서를 정했습니다"
            det = "AI(GPT)가 정했습니다" if by == "ai" else "메뉴 이름과 질문의 낱말이 겹치는 정도로 정했습니다"
        self._emit("web", "plan", msg=msg, det=det, by=by, cnt=n)
        for ex in excluded:
            self._skip(ex["url"], ex["reason"], ex["name"])

    def _set_menu(self, mid: Optional[str]) -> None:
        self._menu, self._why = mid, None
        h = self.hitl
        if not (h and mid):
            return
        it = h.item(mid)
        if it:
            self._why = it["qa"][0] if it.get("qa") else None
        h.set_state(mid, "run")

    def _pick_menu(self) -> Optional[Entry]:
        """계획에서 다음에 열 메뉴. 관련 높은 것부터. 관련 낮은 메뉴는 사람에게 물어 정한다."""
        h = self.hitl
        for it in h.plan:
            if it["rel"] == "excl" or it["st"] != "wait" or it.get("asking") or it["id"] in self._picked:
                continue
            if it["rel"] == "low" and self._low_gate(it) != "go":
                continue
            self._picked.add(it["id"])
            return Entry(url=it["url"], depth=1, menu=it["id"], text=it["name"])
        return None

    def _pickable(self) -> bool:
        h = self.hitl
        return bool(h) and any(it["rel"] != "excl" and it["st"] == "wait" and not it.get("asking") and it["id"] not in self._picked for it in h.plan)

    def _has_work(self) -> bool:
        return bool(self._front or self._queue or self._pickable())

    def _low_gate(self, it: dict) -> str:
        """관련도가 낮은 메뉴. 'go' 탐색한다, 'skip' 건너뛴다, 'wait' 사람의 답을 기다리는 중이라 지금은 열지 않는다."""
        h, mid = self.hitl, it["id"]
        d = h.decided(f"low|{mid}")
        if d == "incl":
            return "go"
        if d == "skip":
            h.set_state(mid, "skip")
            return "skip"
        if self._asks["low"] >= MAX_ASKS["low"]:               # 메뉴가 많은 사이트에서 관련 없는 메뉴마다 묻지 않는다
            h.auto_skip_menu(mid, "관련도 낮음, 묻지 않고 건너뜀")
            self._low_auto += 1
            return "skip"
        self._asks["low"] += 1
        name = it["name"]
        spec = {"key": f"low|{mid}", "kind": "low", "title": f"'{name}' 메뉴도 탐색할까요?",
                "body": "입력한 탐색 목적과 질문 예시에 직접 관련이 없어 보여요. 탐색하면 화면과 요청을 더 보게 되어 시간이 더 걸립니다.",
                "opts": [["incl", "탐색하기", ""], ["skip", "건너뛰기", "pri"]], "def": "skip", "defLabel": "건너뜁니다",
                "labels": {"incl": f"'{name}' 메뉴도 탐색하기", "skip": f"'{name}' 메뉴 건너뛰기"}, "menu": mid, "task": None}
        rec, val = self._ask(spec, box=None if h.level == "never" else self._menu_box(it["url"]))
        if val == "incl":
            return "go"
        if val == "skip":
            h.set_state(mid, "skip")
            return "skip"
        return "wait"

    def _menu_box(self, url: str) -> Optional[dict]:
        """지금 화면에 그 메뉴가 보이면 그 자리(질문 카드가 가리킨다)."""
        for frame in self.page.frames:
            try:
                b = frame.evaluate(_BOX_JS, url)
            except Exception:
                continue
            if b:
                return dict(b, vw=VIEWPORT["width"], vh=VIEWPORT["height"])
        return None

    # ── 사람과 함께: 질문 ───────────────────────────────────────────────────

    def _jpeg(self) -> Optional[bytes]:
        try:
            return self.page.screenshot(type="jpeg", quality=55)
        except Exception:
            return None

    def _ask(self, spec: dict, box: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
        """질문을 남긴다. (질문, 정해진 답). 이미 정해진 일이면 (None, 답), 답을 기다리는 중이면 (질문, None)."""
        h = self.hitl
        done = h.decided(spec["key"])
        if done is not None:
            return None, done
        if box:
            spec["hl"] = box
        rec = h.ask(spec, None if h.level == "never" else self._jpeg())
        if rec is None:
            return None, h.decided(spec["key"])
        return rec, (rec["val"] if rec["st"] == "done" else None)

    def _risky_word(self, c: dict) -> Optional[str]:
        """누르지 않을 단어에는 없지만 상태를 바꾸는 것처럼 보이는 버튼의 낱말. 링크(주소 검사가 맡는다)와 표 행(데이터다)은 보지 않는다."""
        if c["kind"] in ("link", "row"):
            return None
        text = (c["text"] or "").strip()
        hay = f"{text} {c['title']}"
        for w in _RISKY_KO:
            if w in hay and not (w in _PLAIN and text == w):
                return w
        m = _RISKY_EN.search(hay)
        return m.group(1) if m else None

    def _risky_question(self, c: dict, word: str) -> str:
        """'press' 눌러도 된다고 정해졌다, 'skip' 누르지 않는다, 'wait' 사람의 답을 기다리는 중이라 지금은 누르지 않는다."""
        h = self.hitl
        text = c["text"] or c["tag"]
        key = f"risky|{text}"
        d = h.decided(key)
        if d is None and self._asks["risky"] < MAX_ASKS["risky"]:
            self._asks["risky"] += 1
            spec = {"key": key, "kind": "risky", "title": f"'{text}' 버튼을 눌러도 될까요?",
                    "body": f"누르지 않을 단어에는 없지만, '{word}' 처럼 데이터 상태를 바꾸는 버튼으로 보여요. 눌러 봐도 요청은 운영에 보내지 않고 형식만 기록합니다.",
                    "pred": self._predict(c, text), "opts": [["press", "눌러 보기 (요청은 차단)", "pri"], ["skip", "건너뛰기", ""]], "def": "skip", "defLabel": "건너뜁니다",
                    "labels": {"press": f"'{text}' 버튼을 눌러 보기 (요청은 차단)", "skip": f"'{text}' 버튼 건너뛰기"}, "menu": self._menu,
                    "task": {"url": self.page.url, "depth": self._cur.depth if self._cur else 0, "menu": self._menu, "text": text, "again": True,
                             "task": {"op": "press", "ckey": c["key"]}}}
            rec, d = self._ask(spec, box=self._box(c))
            if d is None:
                self._note_skipped(text, "위험해 보이는 버튼이라 사람의 답을 기다림")
                return "wait"
        if d == "press":
            return "press"
        self._note_skipped(text, "위험해 보이는 버튼이라 사람의 결정 없이는 누르지 않음")
        return "skip"

    def _note_skipped(self, text: str, why: str) -> None:
        if (text, why) in self._skip_seen:
            return
        self._skip_seen.add((text, why))
        self.res.skipped.append({"text": text, "why": why})

    def _predict(self, c: dict, text: str) -> str:
        """누르면 나갈 요청을 알 수 있을 때만: 핸들러 속 주소, 아니면 소스에서 찾은 쓰기 API 중 버튼 글자와 낱말이 겹치는 것이 하나뿐일 때. 모르면 비워 둔다 — 지어내지 않는다."""
        m = re.search(r"""['"]([\w./-]+\.(?:do|action|ajax|json))""", c.get("onclick") or "")
        if m:
            return m.group(1)
        try:
            hit = planner.match_write_source(text, self._hints() if self._hints else [])
        except Exception:
            hit = None
        if not hit:
            return ""
        return f"{hit.get('method') or 'POST'} {hit['path']} (소스에서 찾은 \"{hit['title'].split('(')[0].strip()[:30]}\" API)"

    def _check_needs_input(self, c: dict, depth: int) -> None:
        """누른 뒤 화면이 "…을 입력하세요" 라고 알려 왔으면, 어떤 값을 넣을지 사람에게 묻는다."""
        h, inp = self.hitl, c.get("inp")
        msg = next((m for t, m in self._dialogs if t == "alert" and _NEEDS_INPUT.search(m or "")), None)
        if not msg or not inp:
            return
        label = (inp.get("label") or "입력값").strip()
        btn = c["text"] or c["tag"]
        key = f"input|{label}|{btn}"
        if h.decided(key) is not None or self._asks["input"] >= MAX_ASKS["input"]:
            return
        self._asks["input"] += 1
        sugg = planner.suggest_values(h.ques)
        first = sugg[0] if sugg else None
        spec = {"key": key, "kind": "input", "title": f"'{label}' 칸에 어떤 값을 넣을까요?",
                "body": f"'{btn}' 은(는) 값을 넣어야 동작해요. 화면이 \"{msg.strip()[:60]}\" 라고 알려 줬습니다. "
                        + ("질문 예시에 나온 이름을 먼저 제안해요." if sugg else "마땅한 값이 없으면 건너뛰어도 됩니다."),
                "opts": [["skip", "이 단계 건너뛰기", ""]], "input": {"ph": label, "sugg": sugg},
                "def": first or "skip", "defLabel": f"질문에 나온 '{first}'(으)로 넣습니다" if first else "건너뜁니다",
                "labels": {"skip": f"'{btn}' 단계 건너뛰기", "*": f"'{label}'에 \"{{v}}\" 넣고 '{btn}' 누르기"}, "menu": self._menu,
                "task": {"url": self.page.url, "depth": depth, "menu": self._menu, "text": btn, "again": True, "task": {"op": "fill", "ckey": c["key"]}}}
        self._ask(spec, box=self._box(c))

    def _deny_reason(self) -> str:
        if self._status in (401, 403):
            return f"HTTP {self._status} 응답이 왔습니다"
        if self._find_password():
            return ""                                           # 로그인 화면은 세션 문제다(위에서 다시 로그인한다)
        try:
            text = self.page.evaluate(_BODY_TEXT_JS)
        except Exception:
            return ""
        # 상태가 200 이어도 권한 없음을 화면으로만 알리는 레거시 사이트가 있다. 오류 화면은 짧으니 긴 화면은 보지 않는다(본문에 우연히 든 낱말을 거른다).
        return "권한이 없다는 안내가 떴습니다" if len(text) <= 400 and _DENY_TEXT.search(text) else ""

    def _denied(self, entry: Entry) -> bool:
        """권한이 없어 열리지 않은 화면이면 사람에게 묻고 True(이 화면은 더 하지 않는다)."""
        why = self._deny_reason()
        if not why:
            return False
        h = self.hitl
        item = h.item(entry.menu)
        name = (item["name"] if item else "") or entry.text or self.heading or self.policy.display(self.page.url)
        key = f"perm|{self.policy.normalize(self.page.url)}"
        if h.decided(key) is not None or self._asks["perm"] >= MAX_ASKS["perm"]:
            self._skip(self.page.url, "권한이 없어 열리지 않음", name)
            if entry.menu:
                h.set_state(entry.menu, "skip")
            return True
        self._asks["perm"] += 1
        spec = {"key": key, "kind": "perm", "title": f"'{name}' 화면이 열리지 않아요",
                "body": f"테스트 계정으로는 이 화면을 열 수 없어요({why}). 권한이 있는 분이 직접 보여 주시면 그 경로와 요청 형식을 기록할게요.",
                "opts": [["take", "직접 보여 줄게요", "pri"], ["skip", "건너뛰기", ""]], "def": "skip", "defLabel": "건너뜁니다",
                "labels": {"take": f"'{name}' 화면을 직접 보여 주기", "skip": f"'{name}' 화면 건너뛰기"}, "menu": entry.menu, "task": None}
        rec, val = self._ask(spec)
        if val == "skip" and entry.menu:
            h.set_state(entry.menu, "skip")
        return True

    def _screen_gate(self, entry: Entry) -> bool:
        """'새 화면마다 묻기'일 때 처음 여는 화면을 계속 탐색할지 묻는다. True 면 이 화면은 지금 탐색하지 않는다."""
        h = self.hitl
        if h.level != "every":
            return False
        key = f"screen|{self.policy.normalize(self.page.url)}"
        d = h.decided(key)
        if d is not None:
            return d != "go"
        if self._asks["screen"] >= MAX_ASKS["screen"]:
            return False
        self._asks["screen"] += 1
        item = h.item(entry.menu)
        name = (item["name"] if item else "") or self.heading or entry.text or self.policy.display(self.page.url)
        spec = {"key": key, "kind": "screen", "title": f"'{name}' 화면을 탐색할까요?",
                "body": "처음 여는 화면이에요. 탐색하면 이 화면의 버튼을 눌러 보며 API 를 찾습니다.",
                "opts": [["go", "이 화면 탐색하기", "pri"], ["skip", "건너뛰기", ""]], "def": "go", "defLabel": "탐색합니다",
                "labels": {"go": f"'{name}' 화면 탐색하기", "skip": f"'{name}' 화면 건너뛰기"}, "menu": entry.menu,
                "task": {"url": entry.url, "depth": entry.depth, "menu": entry.menu, "text": entry.text, "again": True}}
        rec, val = self._ask(spec)
        return val != "go"

    def _apply_answers(self) -> None:
        """답이 나온 질문의 일을 한다. 눌러 보기, 값을 넣고 누르기, 화면 다시 열기를 앞쪽 큐에 올리고, 건너뛴 메뉴는 계획에 건너뜀으로 둔다."""
        h = self.hitl
        if h is None:
            return
        for q in h.pop_answered():
            kind, val, task, mid = q["kind"], q["val"], q.get("task"), q.get("menu")
            if kind == "risky" and val == "press" and task:
                self._front.appendleft(Entry(**task))
            elif kind == "input" and val != "skip" and task:
                self._front.appendleft(Entry(**dict(task, task=dict(task["task"], value=val))))
            elif kind == "screen" and val == "go" and task:
                self._front.appendleft(Entry(**task))
            elif kind in ("perm", "low") and val == "skip" and mid:
                h.set_state(mid, "skip")

    def _gate(self) -> bool:
        """남은 갈 곳이 없어도 답을 기다리는 질문이 있으면 기다린다. 이어서 할 일이 생기면 True, 더 기다릴 것이 없으면 False."""
        h = self.hitl
        if h is None or not h.pending():
            return False
        self._idle_begin()
        try:
            while h.pending():
                reason = self._stop_reason()
                if reason:
                    self.res.stopped = reason
                    return False
                self._apply_answers()
                if self._has_work():
                    return True
                n = len(h.pending())
                if n != self._wait_said:
                    self._wait_said = n
                    self._emit("web", "wait", msg=f"질문 {n}개에 대한 답을 기다리고 있습니다")
                self.page.wait_for_timeout(IDLE_POLL_MS)
                h.tick()
            return True
        finally:
            self._idle_end()

    # ── 사람과 함께: 일시정지, 직접 조작 ────────────────────────────────────

    def _hitl_step(self) -> None:
        h = self.hitl
        if h is None:
            return
        h.tick()
        while h.idle():
            if self._cancelled():
                raise Cancelled()
            if h.take is not None:
                self._take_over()
            else:
                self._pause()

    def _pause(self) -> None:
        h = self.hitl
        self._idle_begin()
        if not self._paused_said:
            self._paused_said = True
            self._emit("web", "wait", msg="일시정지했습니다. 다시 시작하면 이어서 탐색합니다")
        try:
            while h.paused and h.take is None:
                if self._cancelled():
                    raise Cancelled()
                self.page.wait_for_timeout(IDLE_POLL_MS)
        finally:
            self._paused_said = False
            self._idle_end()

    def _take_over(self) -> None:
        """사람이 헤드리스 브라우저를 직접 조종한다. 그동안 크롤러는 입력을 받아 그대로 옮기기만 한다.

        fresh 면 테스트 계정의 세션을 잠시 치우고 로그인 화면에서 시작한다(권한 있는 사람이 자기 계정으로 보여 줄 때).
        끝나면 세션을 되돌리고 로그인한 직후의 화면으로 돌아간다. 사람이 입력한 글자는 어디에도 남기지 않는다.
        """
        h = self.hitl
        t = h.take
        if t is None:
            return
        if self._in_page:                                    # 화면 상태가 바뀌니 하던 화면은 접고, 끝난 뒤 이어서 다시 한다
            self._abandon, self._abandon_url = True, self.page.url
        self._idle_begin()
        saved: List[dict] = []
        try:
            self._flush()
            try:
                saved = self.ctx.cookies()
            except Exception:
                saved = []
            if t.get("fresh"):
                self.ctx.clear_cookies()
                try:
                    self.page.goto(self.start_url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
                except Exception:
                    pass
            self._taking = self._by_human = self._accept_confirm = True
            self.action = "화면 열기"
            self._emit("web", "wait", msg="직접 조작 중입니다. 크롤러는 멈춰 있습니다")
            self._settle(max_ms=2000)
            self.heading = self._heading().get("heading") or self.heading
            last_url, last_shot = self.page.url, 0.0
            self._shot()
            last_shot = time.time()
            while h.take is not None:
                if self._cancelled():
                    raise Cancelled()
                cmd = h.next_input()
                if cmd is not None:
                    self._apply_input(cmd)
                    last_url = self._after_input(last_url)
                    self._shot()
                    last_shot = time.time()
                    continue
                self.page.wait_for_timeout(120)
                if time.time() - last_shot >= TAKE_SHOT_SEC:
                    self._shot()
                    last_shot = time.time()
        finally:
            self._taking = self._by_human = self._accept_confirm = False
            try:
                self._flush()
                self.ctx.clear_cookies()
                if saved:
                    self.ctx.add_cookies(saved)
                self.page.goto(self._home or self.start_url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
                self._settle()
                self.heading = self._heading().get("heading") or self.heading
            except Exception:
                pass
            self.action = "화면 열기"
            self._relogins = 0
            self._idle_end()

    def _apply_input(self, cmd: dict) -> None:
        op = cmd.get("op")
        try:
            if op == "click":
                x, y = _clamp(cmd.get("x"), 0, VIEWPORT["width"] - 1), _clamp(cmd.get("y"), 0, VIEWPORT["height"] - 1)
                try:
                    name = self.page.evaluate(_POINT_JS, [x, y])
                except Exception:
                    name = ""
                self.action = f"{name} 클릭" if name else "화면 클릭"
                self.page.mouse.click(x, y)
            elif op == "type":
                self.page.keyboard.type(str(cmd.get("text") or "")[:200], delay=15)
            elif op == "key":
                self.page.keyboard.press(str(cmd.get("key")))
            elif op == "scroll":
                self.page.mouse.wheel(0, _clamp(cmd.get("dy"), -2000, 2000))
        except Exception:
            pass
        self._settle(max_ms=1800, quiet_ms=250)
        self._flush()

    def _after_input(self, last_url: str) -> str:
        """사람이 다른 화면으로 넘어갔으면 기록에 올린다. 그 화면은 크롤러가 다시 열지 않는다."""
        url = self.page.url
        if url == last_url or not self.policy.same_origin(url):
            return last_url
        self.policy.visit(url)
        meta = self._heading()
        self.heading = meta.get("heading") or meta.get("title") or self.policy.display(url)
        self._emit_page(self._cur.depth if self._cur else 1, f"{self.heading} 화면이 열렸습니다 (사람 조작)", human=True)
        return url

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
        same, path, read = self.policy.same_origin(url), urlsplit(url).path, method in ("GET", "HEAD")
        # 사람이 눌러도 된다고 한 위험 버튼을 누르는 동안에는 화면 이동(GET)도 보내지 않는다. 쓰기를 GET 으로 구현한 화면이 있어도 운영에 닿지 않게 하려는 것이다.
        nav_block = self._pressing and rtype == "document" and same
        # 클릭 없이 화면 스크립트가 부르는 GET 중에도 삭제·승인처럼 보이는 이름이 있다(레거시는 쓰기를 GET 으로 만들기도 한다).
        # 데이터를 부르는 요청(xhr, fetch)만 이름으로 본다. 사람이 직접 조작하는 중에는 화면 이동도 본다 — 사람이 누른 링크가 쓰기 GET 일 수 있다.
        risky_get = read and same and risky_call(path) and (rtype in ("xhr", "fetch") or (self._taking and rtype == "document"))
        if read and not risky_get and not nav_block:
            route.continue_()
            return
        post = None
        try:
            post = request.post_data
        except Exception:
            pass
        ctype = (request.headers or {}).get("content-type", "")
        if self.login_phase and same:
            self._login_req = {"url": url, "method": method, "post": post, "ctype": ctype}
            route.continue_()
            self._record_event("allow", method, url, None)
            return
        if self._taking and same and not read and _LOGIN_PATH.search(path):
            route.continue_()                                  # 사람이 자기 계정으로 로그인하는 요청. 이것만 풀어 준다
            self._record_event("allow", method, url, None)
            return
        if self.policy.is_read_post(url):
            route.continue_()
            return
        # 여기까지 왔으면 쓰기(또는 막아야 할 이동)다. 운영에 보내지 않는다.
        silent = nav_block and read                            # 눌러 본 버튼이 일으킨 화면 이동: 보내지 않을 뿐 API 후보도, 차단한 쓰기 요청 수도 아니다
        self._blocked_reqs.add(request)
        if not silent:
            self.res.blocked += 1
            if self._room(f"{method} {path}"):
                self.res.observed.append(Observed(method=method, url=url, status=None, ctype=ctype, headers=self._keep_headers(request.headers),
                                                  post=post, blocked=True, out_of_scope=not self.policy.in_scope(url),
                                                  label=f"{self.heading} > {self.action}", screen=self.policy.display(self.page.url),
                                                  human=self._by_human, menu=self._menu or ""))
            self._record_event("block", method, url, None)
        if rtype in ("xhr", "fetch"):
            # 화면 스크립트가 응답을 기다리다 멈추지 않게 빈 성공 응답을 준다.
            route.fulfill(status=200, content_type="application/json; charset=utf-8", body="{}")
        elif rtype == "document":
            route.fulfill(status=204)                          # 내용 없음: 브라우저가 그 화면에 그대로 머문다(abort 하면 오류 화면으로 넘어가 버린다)
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
                           label=f"{self.heading} > {self.action}", screen=self.policy.display(self.page.url), human=self._by_human, menu=self._menu or "")
            self.res.observed.append(obs)
            self._record_event("out" if obs.out_of_scope else "cap", method, url, response.status, ms)

    def _record_event(self, tag: str, method: str, url: str, code: Optional[int], ms: Optional[int] = None) -> None:
        key = f"{tag} {method} {urlsplit(url).path}"
        self._dups[key] = self._dups.get(key, 0) + 1
        if self._dups[key] > DUP_EVENTS:
            return
        ev = {"m": method, "p": self.policy.display(url), "code": code, "tag": tag, "ms": ms, "human": 1 if self._by_human else None}
        if self.hitl and tag in ("cap", "block"):
            # 요청 줄마다 "무엇에 쓰는 API 인가"를 붙인다. 화면 제목에 읽기/쓰기 동사를 붙인 추정이고, 사람이 고치면 그 값이 쓰인다.
            ev["api"] = planner.api_key(method, infer.templatize(self.policy.rel(urlsplit(url).path)))
            item = self.hitl.item(self._menu)
            use, qa = planner.live_use(method, f"{self.heading} > {self.action}", self.hitl.ques, item["qa"] if item else ())
            ev["use"], ev["qa"] = use or None, qa or None
            ev["menu"] = self._menu
        self._emit("web", "req", **ev)

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

    def _watch_dialogs(self, page) -> None:
        """alert/confirm 은 닫는다. confirm 은 취소로 답한다 — "삭제하시겠습니까?" 에 확인을 누르면 안 된다.

        사람이 눌러도 된다고 한 버튼을 누르는 동안과 직접 조작 중에만 확인을 누른다. 쓰기 요청은 어차피 운영에 나가지 않는다.
        알림창의 글은 기억해 둔다 — "거래처명을 입력하세요" 는 값이 필요하다는 신호다.
        """
        def handle(d):
            try:
                if d.type == "beforeunload":
                    d.accept()
                    return
                if len(self._dialogs) < 20:
                    self._dialogs.append((d.type, d.message or ""))
                d.accept() if (d.type == "confirm" and self._accept_confirm) else d.dismiss()
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
        data = self._jpeg()
        return self._on_shot(data) if data else None

    def _shot_quiet(self) -> None:
        self._shot()

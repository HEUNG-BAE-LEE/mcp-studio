# apps/backend/app/ieum/recorder/trace.py
"""행동 묶음(ActionSpan) 기록.

중계가 입력을 넣기 직전에 begin() 을 부른다. 그 순간의 화면(직전 스냅샷)을 뜨고 새 묶음을 연다. 그 뒤에 나간 요청은
모두 이 묶음에 붙는다. 다음 begin() 이나 finish() 가 이 묶음을 닫는데, 네트워크가 잠잠해질 때까지 기다린 뒤
직후 스냅샷을 뜨고 기록별 파일에 한 줄 덧붙인다.

- 무엇을 눌렀는지는 페이지 안 기록 스크립트(INIT_JS)가 알려 준다. 영상 좌표로 추측하지 않는다.
- 화면 이동(document) 응답도 기록한다. 서버가 결과 표를 그려 주는 레거시 화면에서는 그것이 API 다.
  HTML 이면 표를 데이터로 바꾼 사본(data)을 함께 둔다.
- ARIA 스냅샷은 모든 프레임을 떠서 잇는다(레거시는 iframe·frameset 이 많다). 저장 전에 마스킹한다.
- 응답·요청·ARIA 는 마스킹한 값만 저장한다. 입력 원값은 raw 지도(마스킹 값 → 원값)에만 두고 Replay 가 쓴다.
- 파일 쓰기와 HTML 변환은 이벤트 루프를 막지 않게 스레드로 넘긴다.
"""
import asyncio
import json
import logging
import re
import time
from typing import Awaitable, Callable, Dict, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.masking import HIDDEN, Masker, is_secret_key
from app.ieum.discovery.policy import Policy, is_asset
from app.ieum.recorder import htmltable, store
from app.ieum.recorder.guard import Guard, mask_url

log = logging.getLogger(__name__)
MAX_SPANS = 300
ARIA_MAX = 20_000
RES_MAX = 4_000
SETTLE_MAX_MS = 3000
SETTLE_QUIET_MS = 400
TITLE_SEC = 5.0              # 스냅샷의 Playwright 호출별 상한. 대상 페이지에 확인 창이 열려 있으면 호출이 돌아오지 않는다
EVAL_SEC = 5.0
SHOT_SEC = 8.0
ARIA_MAIN_SEC = 5.0          # 최상위 프레임 ARIA 의 상한
ARIA_TOTAL_SEC = 6.0         # 나머지 iframe 이 함께 쓰는 시간
_PAIRS_BODY = re.compile(r"^(?:[^=&\s]+=[^&]*)?(?:&(?:[^=&\s]+=[^&]*)?)*$")
# 내용은 CDATA 조각과 글자의 섞임이다. CDATA 는 처음 만나는 ]]> 에서 끝난다(.*? 로 두면 뒤 요소까지 삼켜 그 안의 비밀 태그를 놓친다).
_XML_ELEM = re.compile(r"<((?:[\w.-]+:)?([\w.-]+))((?:\s[^>]*)?)>((?:<!\[CDATA\[(?:(?!\]\]>).)*\]\]>|[^<])*)</\1>", re.S)
_XML_TAG = re.compile(r"<[\w.:-]+\s[^<>]*>")
_XML_ATTR = re.compile(r"([\w.:-]+)(\s*=\s*)(\"[^\"]*\"|'[^']*')")
_CHARSET = re.compile(r"charset=([\w-]+)", re.I)

INIT_JS = """
(() => {
  if (window.__ieumRecInstalled) return; window.__ieumRecInstalled = true;
  // 입력칸의 값은 대상 설명에 쓰지 않는다. 편집 가능한 요소와 입력 역할(textbox 등)도 입력칸으로 본다(innerText 가 입력 값이다)
  const isForm = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '') || !!el.isContentEditable
      || /^(textbox|searchbox|combobox)$/i.test((el.getAttribute && el.getAttribute('role')) || '');
  const attr = (el, n) => (el.getAttribute && el.getAttribute(n)) || '';
  const textOf = (el) => isForm(el) ? (attr(el, 'aria-label') || attr(el, 'placeholder') || attr(el, 'name'))
      : (el.tagName === 'TR' ? ((el.cells && el.cells[0] && el.cells[0].innerText) || attr(el, 'aria-label'))   // 행은 첫 칸만(행 전체는 개인정보가 섞인다)
      : (el.innerText || attr(el, 'aria-label')));
  const desc = (el) => el ? ({ tag: el.tagName || '', id: el.id || '', name: attr(el, 'name'),
      role: attr(el, 'role'), text: ((textOf(el) || '') + '').trim().slice(0, 60) }) : null;
  const pick = (el) => (el && el.closest) ? (el.closest('button,a,input,select,textarea,tr,[onclick],[role]') || el) : el;
  const label = (el) => { try { if (el.labels && el.labels[0]) return el.labels[0].innerText.trim().slice(0, 40);
      const th = el.closest('td') && el.closest('td').previousElementSibling; if (th && th.tagName === 'TH') return th.innerText.trim().slice(0, 40); } catch (e) {}
      return (el.getAttribute && el.getAttribute('aria-label')) || ''; };
  const send = (o) => { try { window.__ieumRec(o); } catch (e) {} };
  document.addEventListener('click', (e) => send({ type: 'click', isTrusted: e.isTrusted, el: desc(pick(e.target)), page: location.pathname }), true);
  // Enter 로 제출하면 blur 가 없어 change 가 나지 않는다. 키를 누른 순간의 포커스 요소를 대상으로, 입력란이면 그 값을 함께 보낸다.
  // 비밀번호 칸의 값은 보내지 않는다(대상 설명만). contenteditable 은 값을 보내지 않는다(값 노출 방지)
  document.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return;
      const t = document.activeElement; if (!t || t === document.body || t === document.documentElement) return;
      const o = { type: 'key', key: 'Enter', isTrusted: e.isTrusted, el: Object.assign(desc(t), { label: label(t) }), page: location.pathname };
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') && t.type !== 'password') o.value = (t.value + '').slice(0, 200);
      send(o); }, true);
  document.addEventListener('change', (e) => { const t = e.target; if (!t || t.type === 'password') return;
      send({ type: 'change', isTrusted: e.isTrusted, el: Object.assign(desc(t), { label: label(t) }), value: (t.value + '').slice(0, 200), page: location.pathname }); }, true);
})();
"""

# ARIA 스냅샷은 입력칸의 현재 값을 그대로 싣는다. 비밀번호 칸은 값이 있는 것만 모아 스냅샷에서 지운다
_PW_JS = "() => [...document.querySelectorAll('input[type=password]')].map(i => i.value || '').filter(v => v).slice(0, 10)"

_HIDDEN_JS = "() => Object.fromEntries([...document.querySelectorAll('input[type=hidden][name]')].slice(0, 50).map(i => [i.name, (i.value || '').slice(0, 300)]))"


class Trace:
    def __init__(self, rid: str, policy: Policy, guard: Guard, notify: Callable[[dict], Awaitable[None]],
                 on_closed: Optional[Callable[[object, dict], Awaitable[None]]] = None):
        self.rid, self.policy, self.guard, self.notify, self.on_closed = rid, policy, guard, notify, on_closed
        self.masker = Masker(pii=True)
        self.raw: Dict[str, Optional[str]] = {}
        self.paused = False
        self.seq = 0
        self.current: Optional[dict] = None
        self._inflight = 0
        self._limit_sent = False
        self._close_lock = asyncio.Lock()
        self.ended = False
        self.dialog_open: Callable[[object], bool] = lambda page: False     # 대상 페이지에 확인 창이 열려 있는지(세션이 알려 준다)

    # ── 마스킹 (원값은 입력칸 값만 지도에 남긴다) ───────────────────────────
    def _m(self, v: str) -> str:
        return self.masker.text(v)

    def _fill_value(self, el: dict, v: str) -> str:
        """입력칸 값을 가린다. 이름이 비밀 같으면 통째로 숨기고 지도에 두지 않는다.
        같은 가린 값에 원값이 둘 이상이면 None 으로 모호함을 표시한다(나중 작업이 값을 되묻는다)."""
        if is_secret_key(el.get("name") or "") or is_secret_key(el.get("id") or ""):
            return HIDDEN
        m = self.masker.text(v)
        if m != v and v:
            if m in self.raw and self.raw[m] != v:
                self.raw[m] = None
            else:
                self.raw[m] = v
        return m

    def _pairs_text(self, pairs) -> str:
        return urlencode(self.masker.pairs(list(pairs)), safe="*•")

    def _url(self, url: str) -> str:
        """쿼리와 경로 조각을 같은 마스킹기로 가린다(/member/01012345678 처럼 경로에 든 값도). 경로 모양은 그대로다."""
        return mask_url(self.masker, url)                  # 토큰 값은 남긴다: 앞 응답에서 받은 토큰을 값으로 이어야 한다

    def _post(self, post: Optional[str], ctype: str) -> Optional[str]:
        if not post:
            return None
        low = (ctype or "").lower()
        if "json" in low:
            try:
                return json.dumps(self.masker.value(json.loads(post)), ensure_ascii=False)[:RES_MAX]
            except ValueError:
                return self._m(post)[:RES_MAX]
        if "x-www-form-urlencoded" in low:
            return self._pairs_text(parse_qsl(post, keep_blank_values=True))[:RES_MAX]
        if "=" in post and _PAIRS_BODY.match(post) and not post.lstrip().startswith("<"):
            return self._pairs_text(parse_qsl(post, keep_blank_values=True))[:RES_MAX]
        return self._hide_xml_secrets(post, self._m)[:RES_MAX]

    @staticmethod
    def _hide_xml_secrets(text: str, mask) -> str:
        """XML·SOAP 본문에서 비밀 이름의 태그 내용을 숨긴 뒤 나머지를 가린다."""
        def repl(m):
            if m.group(4) and is_secret_key(m.group(2)):
                return f"<{m.group(1)}{m.group(3)}>{HIDDEN}</{m.group(1)}>"
            return m.group(0)
        def attrs(m):
            return _XML_ATTR.sub(lambda a: f'{a.group(1)}{a.group(2)}"{HIDDEN}"' if is_secret_key(a.group(1)) else a.group(0), m.group(0))
        return mask(_XML_TAG.sub(attrs, _XML_ELEM.sub(repl, text)))

    # ── 진행 중 요청 ───────────────────────────────────────────────────────
    def on_request(self, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight += 1

    def on_request_done(self, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight = max(0, self._inflight - 1)

    async def _settle(self) -> None:
        end, quiet = time.time() + SETTLE_MAX_MS / 1000, None
        while time.time() < end:
            await asyncio.sleep(0.08)
            if self._inflight <= 0:
                quiet = quiet or time.time()
                if (time.time() - quiet) * 1000 >= SETTLE_QUIET_MS:
                    return
            else:
                quiet = None

    # ── 스냅샷 ─────────────────────────────────────────────────────────────
    async def _aria(self, page, timeouts: Optional[list] = None) -> str:
        parts = []
        timeouts = timeouts if timeouts is not None else []
        main = page.main_frame

        async def one(frame, sec):
            if self.dialog_open(page):
                return
            try:
                text = await frame.locator("body").aria_snapshot(timeout=int(sec * 1000))
            except Exception:
                return
            if text:
                text = await self._strip_passwords(frame, text)
                parts.append(text if frame == main else f"- frame {self.policy.display(frame.url)}:\n{text}")

        async def rest():
            for frame in list(page.frames):
                if frame != main:
                    await one(frame, 1.5)
        try:
            await asyncio.wait_for(one(main, ARIA_MAIN_SEC), ARIA_MAIN_SEC + 1)
        except Exception:
            timeouts.append("aria")
        try:
            await asyncio.wait_for(rest(), ARIA_TOTAL_SEC)
        except Exception:
            timeouts.append("aria-frames")
        return self.masker.text("\n".join(parts))[:ARIA_MAX]

    async def _strip_passwords(self, frame, text: str) -> str:
        """비밀번호 칸의 값이 ARIA 에 실려 있으면 지운다. 값을 읽지 못하면 그대로 둔다."""
        try:
            pws = await asyncio.wait_for(frame.evaluate(_PW_JS), 1.5)
        except Exception:
            return text
        for v in sorted({str(p) for p in pws or []}, key=len, reverse=True):
            text = re.sub(r"(:\s*)" + re.escape(v) + r"$", lambda m: m.group(1) + HIDDEN, text, flags=re.M)
            if len(v) >= 6:
                text = text.replace(v, HIDDEN)
        return text

    async def _snapshot(self, page, seq: int, when: str) -> dict:
        out = {"url": "", "href": "", "title": "", "aria": "", "hidden": {}, "shot": None}
        if page is None:
            return out
        try:
            out["href"] = self._url(page.url)
            out["url"] = self.policy.display(out["href"])
        except Exception:
            pass
        timeouts: list = []

        async def bounded(name, coro_fn, sec):
            """확인 창이 열려 있으면 부르지 않고, 시간이 넘으면 그 항목만 비운다."""
            if self.dialog_open(page):
                out["dialogOpen"] = True
                return None
            try:
                return await asyncio.wait_for(coro_fn(), sec)
            except asyncio.TimeoutError:
                timeouts.append(name)
            except Exception:
                pass
            return None

        if self.dialog_open(page):
            out["dialogOpen"] = True                     # 확인 창이 열린 페이지는 Playwright 호출이 멈춘다. 부르지 않고 표시만 남긴다
            return out
        out["title"] = await bounded("title", page.title, TITLE_SEC) or ""
        if not self.dialog_open(page):
            out["aria"] = await self._aria(page, timeouts)
        hidden = await bounded("hidden", lambda: page.evaluate(_HIDDEN_JS), EVAL_SEC)
        if hidden:
            out["hidden"] = dict(self.masker.pairs([(k, str(v)) for k, v in hidden.items()]))
        data = await bounded("shot", lambda: page.screenshot(type="jpeg", quality=50), SHOT_SEC)
        if data:
            try:
                name = f"{seq}-{when}.jpg"
                await asyncio.to_thread(self._write_shot, name, data)
                out["shot"] = name
            except Exception:
                pass
        if timeouts:
            out["timeouts"] = timeouts
            log.warning("스냅샷 시간 초과 rid=%s seq=%s %s: %s", self.rid, seq, when, ",".join(timeouts))
        return out

    def _write_shot(self, name: str, data: bytes) -> None:
        d = store.rec_dir(self.rid)
        d.mkdir(parents=True, exist_ok=True)
        (d / name).write_bytes(data)

    # ── 묶음 ───────────────────────────────────────────────────────────────
    async def begin(self, page, kind: str) -> Optional[int]:
        async with self._close_lock:                     # 닫기와 열기를 한 잠금으로 묶어 묶음이 겹치거나 사라지지 않게 한다
            if self.paused or self.ended:
                return None
            await self._close_locked(page)
            if self.seq >= MAX_SPANS:
                if not self._limit_sent:
                    self._limit_sent = True
                    await self.notify({"t": "limit"})
                return None
            self.seq += 1
            pre = await self._snapshot(page, self.seq, "pre")
            self.current = {"seq": self.seq, "action": {"type": kind, "target": None, "isTrusted": None, "t": time.time()},
                            "fills": [], "pre": pre, "network": [], "post": None}
            return self.seq

    async def set_paused(self, on: bool, page) -> None:
        """일시정지를 켜면 열린 묶음을 닫는다. 그대로 두면 일시정지 중의 입력·응답이 그 묶음에 쌓인다."""
        async with self._close_lock:
            if on and not self.paused:
                await self._close_locked(page)             # 진정 대기 중에 도착하는 직전 행동의 응답은 그 묶음에 담는다
            self.paused = bool(on)

    async def finish(self, page) -> None:
        async with self._close_lock:
            self.ended = True
            await self._close_locked(page)

    async def _close_locked(self, page) -> None:
        span = self.current
        if span is None:
            return
        try:
            await self._settle()
            span["post"] = await self._snapshot(page, span["seq"], "post")
        finally:
            self.current = None
        await asyncio.to_thread(store.append_span, self.rid, span)
        await self.notify({"t": "span", "seq": span["seq"], "action": span["action"],
                           "network": [{"method": n["method"], "path": n["path"], "status": n["status"], "held": n["held"],
                                        "decision": n["decision"], "kind": "html" if n.get("data") else "data"} for n in span["network"]]})
        if self.on_closed is not None:
            try:
                await self.on_closed(page, span)
            except Exception:
                pass

    # ── 브라우저 안 이벤트 ─────────────────────────────────────────────────
    def on_dom_event(self, source, ev: dict) -> None:
        span = self.current
        if span is None or self.paused or not isinstance(ev, dict):
            return                                       # 일시정지 중의 입력은 어느 묶음에도 담지 않는다
        el = ev.get("el") or {}
        if ev.get("type") == "click" and span["action"]["target"] is None:
            if isinstance(el, dict) and isinstance(el.get("text"), str):
                el = dict(el, text=self.masker.text(el["text"]))      # 대상 글자에 값이 섞여도 가려서 저장한다
            span["action"]["target"] = el
            span["action"]["isTrusted"] = ev.get("isTrusted")
            self.guard.label = el.get("text") or el.get("id") or ""
        elif ev.get("type") == "change":
            self._add_fill(span, el, str(ev.get("value") or ""))
        elif ev.get("type") == "key":
            # Enter 로 제출한 동작: 대상이 비었으면 포커스 요소로 채우고(클릭과 같은 마스킹), 입력란 값은 fills 에 넣는다
            if span["action"]["target"] is None and isinstance(el, dict) and el:
                tgt = dict(el, text=self.masker.text(el["text"])) if isinstance(el.get("text"), str) else el
                span["action"]["target"] = tgt
                span["action"]["isTrusted"] = ev.get("isTrusted")
                self.guard.label = tgt.get("text") or tgt.get("id") or ""
            if isinstance(el, dict) and el and isinstance(ev.get("value"), str):
                self._add_fill(span, el, ev["value"])

    def _add_fill(self, span: dict, el: dict, value: str) -> None:
        """입력값을 fills 에 넣는다. 같은 묶음에서 같은 요소의 같은 값은 한 번만 넣는다(Enter 와 change 가 둘 다 올 수 있다)."""
        v = self._fill_value(el, value)
        ident = (el.get("id") or "", el.get("name") or "")
        for f in span["fills"]:
            t = f.get("target") or {}
            if (t.get("id") or "", t.get("name") or "") == ident and f.get("value") == v:
                return
        span["fills"].append({"target": el, "value": v})

    # ── 응답 ───────────────────────────────────────────────────────────────
    async def on_response(self, response) -> None:
        span = self.current
        if span is None or self.paused:
            return
        try:
            req = response.request
            url, rtype, status = response.url, req.resource_type, response.status
            if not url.startswith(("http://", "https://")) or rtype in capture.STATIC_TYPES or is_asset(url) or 300 <= status < 400:
                return
            is_file, ctype = capture.is_file_response(response.headers)
            body = ""
            if not is_file:
                try:
                    body = (await response.text())[:capture.MAX_BODY]
                except Exception:
                    body = ""
            data = None
            if body and htmltable.looks_html(ctype, body):
                src = body
                if len(body) >= capture.MAX_BODY:          # 잘린 본문: 마지막 <tr 앞에서 잘라 조각난 값을 버린다
                    cut = body.lower().rfind("<tr")
                    src = body[:cut] if cut > 0 else ""
                data = await asyncio.to_thread(htmltable.to_data, src) if src else None
                data = self.masker.value(data) if data else None
            masked = self._mask_body(body)
            if masked is None:
                return                                   # 마스킹하지 못하면 저장하지 않는다
            parts = urlsplit(self._url(url))              # 경로 조각의 개인정보도 가린 주소로 저장한다
            primary = self.policy.same_origin(url)
            req_ctype = (req.headers or {}).get("content-type", "")
            m = _CHARSET.search(req_ctype) or _CHARSET.search(ctype)
            decision = self.guard.decided_requests.get(id(req), "")
            span["network"].append({
                "method": req.method.upper(), "url": self._url(url), "origin": f"{parts.scheme}://{parts.netloc}",
                "base": self.policy.base if primary else f"{parts.scheme}://{parts.netloc}",
                "path": self.policy.rel(parts.path) if primary else parts.path,
                "status": status, "ctype": ctype, "charset": m.group(1).upper() if m else None, "rtype": rtype,
                "headers": capture.keep_headers(req.headers), "post": self._post(req.post_data, req_ctype),
                "res": masked, "data": data, "file": is_file, "held": decision in ("approve", "deny", "timeout", "error"),   # 붙잡아 물었던 요청만(기록 중 보낸 쓰기는 sent)
                "decision": decision, "primary": primary, "t": time.time()})
        except Exception:
            pass

    def _mask_body(self, body: str) -> Optional[str]:
        try:
            t = body.lstrip()
            if t[:1] in ("{", "["):
                try:
                    return json.dumps(self.masker.value(json.loads(t)), ensure_ascii=False)[:RES_MAX]
                except ValueError:
                    pass
            return self.masker.text(body)[:RES_MAX]
        except Exception:
            return None

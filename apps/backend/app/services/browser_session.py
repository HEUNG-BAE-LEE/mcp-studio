"""브라우저 세션 — 사람이 로그인하고, 그 뒤는 기계가 쓴다.

자동화하지 않는 것이 명확히 있다. **로그인·본인인증·캡차**는 사람이 넘긴다.
기술이 안 되는 것이 아니라 약관과 법적 리스크 때문이고, 이건 제품 설명에
당당히 적을 수 있는 원칙이다. 우리가 없애는 것은 **반복**이지 신원 확인이 아니다.

그래서 흐름이 이렇다.

    창을 띄운다 → 사람이 로그인한다 → "준비됐습니다" → 세션만 저장 → 창을 닫는다
                                                        ↓
                                          이후 크롤링은 헤드리스에서 이 세션으로

아이디·비밀번호는 **받지 않는다.** 우리가 갖는 것은 로그인이 끝난 뒤의
쿠키·스토리지(storageState)뿐이다.
"""
import json
import time
from dataclasses import dataclass, field
from pathlib import Path

# 세션은 디스크에 남는다. 고객 계정으로 들어갈 수 있는 열쇠라, 오래 두지 않는다.
SESSION_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "sessions"
SESSION_TTL_SECONDS = 60 * 60 * 6      # 6시간


@dataclass
class LoginHandle:
    """로그인 창 하나. 사람이 끝냈다고 말할 때까지 살아 있는다."""
    key: str
    url: str
    started_at: float
    saved: bool = False
    error: str = ""
    # playwright 객체는 직렬화되지 않는다. 프로세스 안에서만 들고 있는다.
    _pw: object | None = field(default=None, repr=False)
    _browser: object | None = field(default=None, repr=False)
    _context: object | None = field(default=None, repr=False)


_HANDLES: dict[str, LoginHandle] = {}


def state_path(key: str) -> Path:
    return SESSION_DIR / f"{key}.json"


def has_session(key: str) -> bool:
    """저장된 세션이 아직 쓸 만한가. 만료된 것은 없는 것으로 친다."""
    p = state_path(key)
    if not p.exists():
        return False
    if time.time() - p.stat().st_mtime > SESSION_TTL_SECONDS:
        p.unlink(missing_ok=True)
        return False
    return True


def forget(key: str) -> None:
    state_path(key).unlink(missing_ok=True)


def open_login(key: str, url: str) -> LoginHandle:
    """로그인용 창을 띄운다. headless 가 아니다 — 사람이 봐야 하니까.

    서버에서 이걸 돌리면 창이 서버에 뜬다. 로컬 실행이 전제이며, 원격
    배포에서는 이 기능을 끄고 사용자에게 HAR 업로드를 안내해야 한다.
    """
    from playwright.sync_api import sync_playwright

    close(key)                                     # 이전 창이 남아 있으면 정리

    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded")

    handle = LoginHandle(key=key, url=url, started_at=time.time(),
                         _pw=pw, _browser=browser, _context=context)
    _HANDLES[key] = handle
    return handle


def confirm_login(key: str) -> LoginHandle:
    """사람이 "준비됐습니다"를 눌렀다. 세션만 저장하고 창을 닫는다."""
    handle = _HANDLES.get(key)
    if handle is None:
        raise RuntimeError("열린 로그인 창이 없습니다. 다시 시작해 주세요.")

    context = handle._context
    if context is None:
        raise RuntimeError("브라우저가 이미 닫혔습니다. 다시 시작해 주세요.")

    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    state = context.storage_state()

    # 저장 전에 한 번 본다. 쿠키가 하나도 없으면 로그인을 안 한 것이다 —
    # 그대로 저장하면 나중에 "왜 로그인 화면만 나오지"로 헤맨다.
    if not state.get("cookies") and not state.get("origins"):
        close(key)
        raise RuntimeError("로그인 흔적이 없습니다. 로그인을 마친 뒤 다시 눌러 주세요.")

    state_path(key).write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    handle.saved = True
    close(key)
    return handle


def close(key: str) -> None:
    """창을 닫는다. 실패해도 조용히 넘어간다 — 정리는 최선 노력이다."""
    handle = _HANDLES.pop(key, None)
    if handle is None:
        return
    for obj, method in ((handle._context, "close"), (handle._browser, "close"),
                        (handle._pw, "stop")):
        try:
            if obj is not None:
                getattr(obj, method)()
        except Exception:
            pass


def is_open(key: str) -> bool:
    return key in _HANDLES

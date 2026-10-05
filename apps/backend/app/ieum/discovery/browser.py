"""헤드리스 브라우저를 띄운다. 번들 Chromium 이 없으면 PC 에 설치된 Chrome, Edge 를 쓴다.

`playwright install chromium` 은 170MB 를 내려받는다. 이미 Chrome 이 깔린 PC 에서 그걸 요구하는
것은 낭비라서, 번들이 없으면 시스템 브라우저로 넘어간다. 둘 다 없을 때만 설치 방법을 알려준다.
"""
import os
import shutil
import sys
import threading
import time
from pathlib import Path
from typing import Optional, Tuple

# 첫 기동이 느릴 수 있다. x86_64 Python 이 Apple 실리콘에서 Rosetta 로 돌면 처음 한 번은 1분 가까이 걸린다.
LAUNCH_TIMEOUT_MS = 120_000

_SYSTEM_BROWSERS = (
    ("chrome", (
        "/Applications/Google Chrome.app",
        "/opt/google/chrome/chrome",
        "/usr/bin/google-chrome",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    )),
    ("msedge", (
        "/Applications/Microsoft Edge.app",
        "/usr/bin/microsoft-edge",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    )),
)

INSTALL_HINT = "서버에서 `.venv/bin/python -m playwright install chromium` 을 실행하거나 Chrome 을 설치해 주세요."


class BrowserUnavailable(RuntimeError):
    """브라우저를 띄울 수 없다. 메시지는 그대로 화면에 보인다."""


def _system_channels() -> list:
    return [ch for ch, paths in _SYSTEM_BROWSERS if any(Path(p).exists() for p in paths)]


def launch(pw) -> Tuple[object, str]:
    """(브라우저, 이름). 번들 Chromium → Chrome → Edge 순서로 시도한다."""
    attempts = [("chromium", {})] + [(ch, {"channel": ch}) for ch in _system_channels()]
    errors = []
    for name, kw in attempts:
        try:
            return pw.chromium.launch(headless=True, timeout=LAUNCH_TIMEOUT_MS, **kw), name
        except Exception as exc:  # 설치 안 됨, 실행 실패 모두
            errors.append(f"{name}: {str(exc).splitlines()[0][:120]}")
    raise BrowserUnavailable("브라우저를 띄우지 못했습니다. " + INSTALL_HINT + " (" + "; ".join(errors) + ")")


# 상태 확인은 Playwright 드라이버를 띄우므로 비싸다. 잠깐 기억한다.
_CACHE: dict = {"at": 0.0, "value": None}
_LOCK = threading.Lock()


def capabilities() -> dict:
    """{playwright, browser, git}. browser 는 쓸 수 있는 브라우저 이름이거나 None."""
    with _LOCK:
        if _CACHE["value"] is not None and time.time() - _CACHE["at"] < 30:
            return _CACHE["value"]
        value = {"playwright": False, "browser": None, "git": bool(shutil.which("git"))}
        try:
            from playwright.sync_api import sync_playwright
            value["playwright"] = True
            with sync_playwright() as pw:
                if os.path.exists(pw.chromium.executable_path):
                    value["browser"] = "chromium"
        except Exception:
            pass
        if value["playwright"] and value["browser"] is None:
            channels = _system_channels()
            value["browser"] = channels[0] if channels else None
        _CACHE.update(at=time.time(), value=value)
        return value


def reset_cache() -> None:
    with _LOCK:
        _CACHE.update(at=0.0, value=None)

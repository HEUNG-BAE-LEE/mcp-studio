"""헤드리스 브라우저를 띄운다. 번들 Chromium 이 없으면 PC 에 설치된 Chrome, Edge 를 쓴다.

`playwright install chromium` 은 170MB 를 내려받는다. 이미 Chrome 이 깔린 PC 에서 그걸 요구하는
것은 낭비라서, 번들이 없으면 시스템 브라우저로 넘어간다. 둘 다 없을 때만 설치 방법을 알려준다.

**Apple 실리콘에서 x86_64 Python 이 Rosetta 로 돌면 Chrome 도 Intel 용으로 변환되어 뜬다**(자식이 부모의 CPU 를 이어받는다).
변환된 Chrome 은 자바스크립트가 5~10배 느려서, 스크립트가 무거운 사이트는 `DOMContentLoaded` 가 30초를 넘겨 탐색이 시간 초과로
끝난다(wehago.com: 네이티브 4초, 변환 30초 초과). 그래서 이런 PC 에서는 설치된 Chrome·Edge 를 `arch -arm64` 로 감싸 네이티브로 먼저 띄운다.
"""
import atexit
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Optional, Tuple

# 첫 기동이 느릴 수 있다. 변환(Rosetta)된 Chrome 은 처음 한 번 1분 가까이 걸리기도 한다(네이티브는 2초 안팎).
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

ARCH = "/usr/bin/arch"          # macOS 의 아키텍처 선택 도구. `arch -arm64 <명령>` 은 그 명령을 arm64 로 실행한다

INSTALL_HINT = "서버에서 `.venv/bin/python -m playwright install chromium` 을 실행하거나 Chrome 을 설치해 주세요."


class BrowserUnavailable(RuntimeError):
    """브라우저를 띄울 수 없다. 메시지는 그대로 화면에 보인다."""


def _system_channels() -> list:
    return [ch for ch, paths in _SYSTEM_BROWSERS if any(Path(p).exists() for p in paths)]


# 앱 번들 안의 실행 파일. 위 경로가 .app 이면 Playwright 가 부르는 바이너리는 여기다.
_MAC_BINARIES = {
    "chrome": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "msedge": "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
}


def translated() -> bool:
    """Apple 실리콘 위에서 이 프로세스가 Rosetta 로 변환되어 돌고 있는가. 이때 자식 프로세스도 변환된다."""
    if sys.platform != "darwin":
        return False

    def sysctl(name: str) -> str:
        try:
            return subprocess.run(["sysctl", "-n", name], capture_output=True, text=True, timeout=5).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return ""
    return sysctl("sysctl.proc_translated") == "1"


_NATIVE_DIR: dict = {"path": None}


def _native_wrapper(binary: str) -> Optional[str]:
    """binary 를 arm64 로 실행하는 셸 스크립트 경로. 실행 파일에 arm64 조각이 없으면 None.

    Playwright 는 실행 파일 뒤에 자기 인자를 붙여 부른다. `arch -arm64` 는 그 앞에 와야 해서 스크립트로 한 번 감싼다
    (`exec` 라 파이프 파일 디스크립터와 종료 신호는 그대로 Chrome 에 닿는다).
    """
    try:
        archs = subprocess.run(["lipo", "-archs", binary], capture_output=True, text=True, timeout=10).stdout.split()
    except (OSError, subprocess.SubprocessError):
        return None
    if "arm64" not in archs or not os.path.exists(ARCH):
        return None
    if _NATIVE_DIR["path"] is None:                      # 예측할 수 있는 이름으로 /tmp 에 두지 않는다. 프로세스마다 비공개 폴더 하나
        _NATIVE_DIR["path"] = tempfile.mkdtemp(prefix="ieum-native-")
        atexit.register(shutil.rmtree, _NATIVE_DIR["path"], ignore_errors=True)
    path = os.path.join(_NATIVE_DIR["path"], os.path.basename(binary).replace(" ", "-") + ".sh")
    with open(path, "w") as f:
        f.write("#!/bin/bash\nexec %s -arm64 %s \"$@\"\n" % (shlex.quote(ARCH), shlex.quote(binary)))
    os.chmod(path, 0o700)
    return path


def _attempts() -> list:
    """[(이름, 표시 이름, launch 인자)] 시도 순서. 변환 중인 Mac 이면 네이티브 Chrome/Edge 를 맨 앞에 둔다."""
    out = []
    if translated():
        for ch in _system_channels():
            wrapper = _native_wrapper(_MAC_BINARIES[ch]) if ch in _MAC_BINARIES and Path(_MAC_BINARIES[ch]).exists() else None
            if wrapper:
                out.append((ch, f"{ch} (네이티브)", {"executable_path": wrapper}))
    return out + [("chromium", "chromium", {})] + [(ch, ch, {"channel": ch}) for ch in _system_channels()]


def launch(pw) -> Tuple[object, str]:
    """(브라우저, 이름). 네이티브 Chrome·Edge(변환 중인 Mac 만) → 번들 Chromium → Chrome → Edge 순서로 시도한다."""
    errors = []
    for name, shown, kw in _attempts():
        try:
            return pw.chromium.launch(headless=True, timeout=LAUNCH_TIMEOUT_MS, **kw), shown
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

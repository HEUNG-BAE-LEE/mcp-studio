"""헤드리스 브라우저 띄우기. Apple 실리콘에서 Rosetta 로 도는 Python 은 Chrome 도 변환된 채로 띄운다.

변환된 Chrome 은 자바스크립트가 5~10배 느려서 wehago.com 같은 무거운 사이트가 30초 안에 열리지 않았다(네이티브는 4초).
그래서 변환 중인 Mac 에서는 설치된 Chrome·Edge 를 `arch -arm64` 로 감싸 네이티브로 먼저 띄운다. 브라우저를 실제로 띄우지는 않는다.
"""
import os
import stat
import subprocess
import sys
import types

import pytest

from app.ieum.discovery import browser
from app.ieum.discovery.crawler import Crawler
from app.ieum.discovery.policy import Policy

REAL_RUN = subprocess.run            # browser.subprocess 는 같은 모듈이라, 아래에서 run 을 바꿔도 스크립트 실행은 진짜여야 한다


def fake_run(stdout="", error=None):
    def run(cmd, **kwargs):
        if error:
            raise error
        return types.SimpleNamespace(stdout=stdout)
    return run


@pytest.mark.parametrize("platform, out, expected", [("darwin", "1\n", True), ("darwin", "0\n", False), ("darwin", "", False), ("linux", "1\n", False)])
def test_translated_reads_rosetta_state_from_sysctl(monkeypatch, platform, out, expected):
    monkeypatch.setattr(browser.sys, "platform", platform)
    monkeypatch.setattr(browser.subprocess, "run", fake_run(out))
    assert browser.translated() is expected


def test_translated_is_false_when_sysctl_is_missing(monkeypatch):
    monkeypatch.setattr(browser.sys, "platform", "darwin")
    monkeypatch.setattr(browser.subprocess, "run", fake_run(error=FileNotFoundError()))
    assert browser.translated() is False


@pytest.fixture
def fake_arch(tmp_path, monkeypatch):
    """`arch` 대역: 받은 인자를 그대로 출력한다. 감싸는 스크립트가 인자를 제대로 넘기는지 본다."""
    arch = tmp_path / "arch"
    arch.write_text('#!/bin/bash\nfor a in "$@"; do echo "[$a]"; done\n')
    arch.chmod(0o755)
    monkeypatch.setattr(browser, "ARCH", str(arch))
    monkeypatch.setattr(browser, "_NATIVE_DIR", {"path": None})
    return arch


def test_wrapper_runs_the_browser_as_arm64_and_passes_every_argument(fake_arch, monkeypatch, tmp_path):
    binary = str(tmp_path / "Google Chrome's dir" / "Chrome")           # 공백과 작은따옴표가 있어도 깨지지 않는다
    monkeypatch.setattr(browser.subprocess, "run", fake_run("x86_64 arm64\n"))
    path = browser._native_wrapper(binary)
    assert path and stat.S_IMODE(os.stat(path).st_mode) == 0o700
    assert stat.S_IMODE(os.stat(os.path.dirname(path)).st_mode) == 0o700     # 다른 사용자가 끼어들 수 없는 비공개 폴더
    out = REAL_RUN([path, "--remote-debugging-pipe", "--user-data-dir=/tmp/a b"], capture_output=True, text=True).stdout.split("\n")
    assert out[:5] == ["[-arm64]", "[%s]" % binary, "[--remote-debugging-pipe]", "[--user-data-dir=/tmp/a b]", ""]


def test_wrapper_is_skipped_when_the_browser_has_no_arm64_slice(fake_arch, monkeypatch):
    monkeypatch.setattr(browser.subprocess, "run", fake_run("x86_64\n"))
    assert browser._native_wrapper("/Applications/Old.app/Contents/MacOS/Old") is None


def test_wrapper_is_skipped_without_arch_or_lipo(fake_arch, monkeypatch):
    monkeypatch.setattr(browser.subprocess, "run", fake_run("x86_64 arm64\n"))
    monkeypatch.setattr(browser, "ARCH", "/no/such/arch")
    assert browser._native_wrapper("/x") is None
    monkeypatch.setattr(browser.subprocess, "run", fake_run(error=FileNotFoundError()))
    assert browser._native_wrapper("/x") is None


@pytest.fixture
def macs(tmp_path, monkeypatch):
    """Chrome 과 Edge 가 둘 다 깔린 Mac. 실행 파일 경로는 임시 파일로 바꿔 둔다."""
    binaries = {}
    for ch in ("chrome", "msedge"):
        f = tmp_path / ch
        f.write_text("")
        binaries[ch] = str(f)
    monkeypatch.setattr(browser, "_MAC_BINARIES", binaries)
    monkeypatch.setattr(browser, "_system_channels", lambda: ["chrome", "msedge"])
    monkeypatch.setattr(browser, "_native_wrapper", lambda b: "/wrap/" + os.path.basename(b))
    return binaries


def test_native_system_browsers_come_first_only_when_translated(macs, monkeypatch):
    monkeypatch.setattr(browser, "translated", lambda: True)
    assert browser._attempts() == [
        ("chrome", "chrome (네이티브)", {"executable_path": "/wrap/chrome"}), ("msedge", "msedge (네이티브)", {"executable_path": "/wrap/msedge"}),
        ("chromium", "chromium", {}), ("chrome", "chrome", {"channel": "chrome"}), ("msedge", "msedge", {"channel": "msedge"})]
    monkeypatch.setattr(browser, "translated", lambda: False)                     # 네이티브 PC 는 지금까지와 같다
    assert [a[1] for a in browser._attempts()] == ["chromium", "chrome", "msedge"]


def test_a_browser_that_cannot_run_natively_is_left_to_the_old_path(macs, monkeypatch):
    monkeypatch.setattr(browser, "translated", lambda: True)
    monkeypatch.setattr(browser, "_native_wrapper", lambda b: None if b.endswith("chrome") else "/wrap/edge")
    assert [a[1] for a in browser._attempts()] == ["msedge (네이티브)", "chromium", "chrome", "msedge"]


def test_launch_falls_back_when_the_native_browser_does_not_start(macs, monkeypatch):
    monkeypatch.setattr(browser, "translated", lambda: True)
    tried = []

    def launch(**kw):
        tried.append(kw.get("executable_path") or kw.get("channel") or "bundled")
        if len(tried) < 4:
            raise RuntimeError("Executable doesn't exist\nlong detail")
        return "BROWSER"
    pw = types.SimpleNamespace(chromium=types.SimpleNamespace(launch=lambda **kw: launch(**kw)))
    assert browser.launch(pw) == ("BROWSER", "chrome")                              # 네이티브 둘, 번들이 실패하고 시스템 Chrome(변환)이 뜬다
    assert tried == ["/wrap/chrome", "/wrap/msedge", "bundled", "chrome"]


def test_launch_names_the_native_browser_and_reports_every_failure(macs, monkeypatch):
    monkeypatch.setattr(browser, "translated", lambda: True)
    pw = types.SimpleNamespace(chromium=types.SimpleNamespace(launch=lambda **kw: "BROWSER"))
    assert browser.launch(pw) == ("BROWSER", "chrome (네이티브)")

    def boom(**kw):
        raise RuntimeError("실패 %s" % (kw.get("executable_path") or kw.get("channel") or "bundled"))
    with pytest.raises(browser.BrowserUnavailable) as e:
        browser.launch(types.SimpleNamespace(chromium=types.SimpleNamespace(launch=boom)))
    assert all(x in str(e.value) for x in ("chrome: 실패 /wrap/chrome", "chromium: 실패 bundled", "msedge: 실패 msedge"))


# ------------------------------------------------------------------ 시작 화면이 안 열릴 때의 안내
def _crawler(kind):
    c = Crawler(Policy(base="https://example.com"), "https://example.com/", None, emit=lambda *a, **k: None, on_shot=lambda b: 0, cancelled=lambda: False)
    c.res.browser = kind
    return c


def test_start_page_timeout_message_names_rosetta_only_when_it_applies(monkeypatch):
    monkeypatch.setattr(browser, "translated", lambda: True)
    assert "Rosetta" in _crawler("chrome")._start_page_timeout()                     # 변환된 브라우저면 느린 이유로 짚는다
    assert "Rosetta" not in _crawler("chrome (네이티브)")._start_page_timeout()       # 네이티브로 떴으면 탓하지 않는다
    monkeypatch.setattr(browser, "translated", lambda: False)
    msg = _crawler("chrome")._start_page_timeout()
    assert "Rosetta" not in msg and "30초 안에 열지 못했습니다" in msg

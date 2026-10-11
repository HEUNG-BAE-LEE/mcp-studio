"""flow.core: 레코더 재실행에서 옮긴 단계 실행 핵심. replay 와 같은 결과를 내야 하고, Playwright 를 불러오지 않아야 한다."""
import asyncio
import subprocess
import sys

from app.ieum.flow import core
from app.ieum.recorder import replay


def test_replay_는_core_의_같은_함수를_쓴다():
    assert replay.judge is core.judge
    assert replay.encode is core.encode
    assert replay.HttpTransport is core.HttpTransport


def test_core_는_playwright_와_레코더_세션을_불러오지_않는다():
    code = ("import sys, app.ieum.flow.core, app.ieum.flow.runner; "
            "bad=[m for m in sys.modules if m.startswith(('playwright','app.ieum.recorder.session','app.ieum.recorder.manager'))]; "
            "print(bad); sys.exit(1 if bad else 0)")
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=".")
    assert r.returncode == 0, r.stdout + r.stderr


def test_recordedShape_로도_모양을_판정한다():
    page = "<table><tr><th>이름</th><th>주소</th></tr><tr><td>가</td><td>나</td></tr></table>"
    from app.ieum.recorder import htmltable
    shape = sorted(htmltable.shape(htmltable.to_data(page)))
    ok, why, _ = core.judge(200, None, "text/html", page, {"kind": "html", "recordedShape": shape}, {})
    assert ok and why == ""
    ok, why, _ = core.judge(200, None, "text/html", "<p>전혀 다른 화면</p>", {"kind": "html", "recordedShape": shape}, {})
    assert (ok, why) == (False, "shape_mismatch")


def test_JSON_도_recordedShape_로_모양을_판정한다():
    # 업무 도구 단계 사본은 recordedRes 없이 recordedShape(JSON 키 경로)만 든다
    shape = sorted(core._keys({"id": "1", "items": [{"title": "가"}]}))
    step = {"kind": "json", "recordedShape": shape}
    ok, why, _ = core.judge(200, None, "application/json", '{"id": "2", "items": [{"title": "나"}]}', step, {})
    assert ok and why == ""
    ok, why, _ = core.judge(200, None, "application/json", '{"other": 1, "x": {"y": 2}}', step, {})
    assert (ok, why) == (False, "shape_mismatch")
    ok, why, _ = core.judge(200, None, "text/html", "<p>JSON 아님</p>", step, {})
    assert (ok, why) == (False, "shape_mismatch")


class _T:
    mode = "session"

    def __init__(self, pages):
        self.pages, self.sent = pages, []

    async def send(self, step, url, headers, params, form, body):
        self.sent.append(url)
        return 200, None, "text/html", self.pages[step["id"]]


def test_stop_after_는_그_단계까지만_보내고_data_를_돌려준다():
    steps = [{"id": "s1", "method": "GET", "path": "/a", "params": [], "kind": "html", "outputs": {}},
             {"id": "s2", "method": "GET", "path": "/b", "params": [], "kind": "html", "outputs": {}}]
    t = _T({"s1": "<ul><li><a href='/x/1'>가</a></li><li><a href='/x/2'>나</a></li></ul>", "s2": "<p>상세</p>"})
    out = asyncio.new_event_loop().run_until_complete(core.run_steps(
        steps, "http://127.0.0.1:9", {}, {}, t, None, None, 0, needs={}, stop_after="s1"))
    assert out["ok"] and [s["id"] for s in out["steps"]] == ["s1"]
    assert t.sent == ["http://127.0.0.1:9/a"]
    assert "s1" in out["data"]

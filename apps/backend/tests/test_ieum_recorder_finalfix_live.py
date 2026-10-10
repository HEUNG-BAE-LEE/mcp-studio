# apps/backend/tests/test_ieum_recorder_finalfix_live.py
"""전체 검토 지적 수정 중 진짜 브라우저가 필요한 것: 멈춘 뒤 Replay 쓰기 승인, 유휴·끊김 때 승인 기록 보존,
대상 글자(편집 가능 요소·표 행)."""
import asyncio
import time

import pytest

from tests.test_ieum_recorder_session import WS, _noop, call, live, pytestmark, start  # noqa: F401  (픽스처·건너뛰기 표시를 함께 쓴다)

SAVE_BODY = "vendCd=V001&itemCd=I001&qty=1&unitPrice=100&payTerm=30"


def _save_bf(base):
    params = [{"a": k, "loc": "form", "from": f"const:{v}", "ex": v} for k, v in (x.split("=") for x in SAVE_BODY.split("&"))]
    return {"id": "bf_x", "source": {"base": base, "env": "op", "recordingId": "rec_x"}, "inputs": [],
            "steps": [{"id": "s1", "base": base, "method": "POST", "path": "/poSave.do", "kind": "json", "exec": "browser",
                       "charset": None, "write": True, "headers": {"x-requested-with": "XMLHttpRequest"}, "outputs": {},
                       "recordedData": None, "recordedRes": "", "formPage": None, "params": params}],
            "auth": {"mode": "session"}}


def test_멈춘_뒤에도_Replay_쓰기_승인은_받고_브라우저_단계는_한_번만_묻는다(live):
    from app.ieum.recorder import manager, replay, store
    out = start(live)
    rid = out["id"]
    s = manager.MANAGER.get(rid)
    call(s.page.goto(s.policy.base + "/poListView.do"))
    manager.MANAGER.on_stopped = _noop                 # 멈춘 뒤에도 세션을 열어 둔다(service.finish 대신 시험이 검증을 부른다)
    ws = WS()
    s.subscribe(ws)
    posts = []
    s.ctx.on("requestfinished", lambda r: posts.append(r.url) if r.method == "POST" and "poSave.do" in r.url else None)
    try:
        call(manager.MANAGER.stop(rid))
        assert s.stopping and s.accept_replay
        seq = s.trace.seq
        call(s.handle({"t": "click", "x": 10, "y": 10, "w": 100, "h": 100}))     # 멈춘 뒤의 기록 입력은 무시한다
        assert s.trace.seq == seq

        async def approver():
            for _ in range(200):
                holds = [m for m in ws.msgs if m.get("t") == "hold"]
                if holds:
                    await s.handle({"t": "approve", "id": holds[0]["id"], "ok": True})
                    return holds[0]["id"]
                await asyncio.sleep(0.05)
            return None

        async def go():
            rec = await asyncio.to_thread(store.get_recording, rid)
            return await asyncio.gather(approver(), replay.verify(_save_bf(s.policy.base), rec, [], s))
        t0 = time.time()
        hid, result = call(go(), timeout=90)
        assert hid and time.time() - t0 < 30                  # 2분 시간 초과까지 멈추지 않는다
        run = result["verification"]["runs"][0]
        assert run["reason"] != "write_denied", run
        time.sleep(0.5)
        assert [m.get("t") for m in ws.msgs].count("hold") == 1        # 브라우저 가드가 같은 요청을 다시 묻지 않았다
        assert len(posts) == 1                                         # 쓰기는 정확히 한 번 나갔다
        assert any(d["decision"] == "approve" and d["label"].startswith("Replay") for d in s.guard.decisions)

        # 멈춘 뒤 기록 쪽 쓰기는 승인 창 없이 바로 거절한다(예전에는 붙잡아 두고 2분을 기다렸다)
        holds_before = [m.get("t") for m in ws.msgs].count("hold")
        call(s.page.evaluate(
            "fetch('/demo-legacy/po/poSave.do',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},"
            f"body:'{SAVE_BODY}'}}).catch(()=>0)"))
        time.sleep(0.3)
        assert not s.guard.holding and len(posts) == 1
        assert [m.get("t") for m in ws.msgs].count("hold") == holds_before
    finally:
        manager.MANAGER.on_stopped = None
        call(manager.MANAGER.close(rid))


def test_유휴로_멈춘_기록도_승인_기록을_남긴다(live, monkeypatch):
    from app.ieum.recorder import manager, store
    out = start(live)
    monkeypatch.setenv("IEUM_RECORDER_IDLE_SEC", "0")
    call(manager.MANAGER._reap_once())
    rec = store.get_recording(out["id"])
    assert rec["status"] == "interrupted" and any(a["decision"] == "login" for a in rec["approvals"])


def test_브라우저가_끊긴_기록도_승인_기록을_남긴다(live):
    from app.ieum.recorder import manager, store
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    call(s.browser.close())
    time.sleep(1.0)
    rec = store.get_recording(out["id"])
    assert rec["status"] == "interrupted" and any(a["decision"] == "login" for a in rec["approvals"])


def test_편집_가능한_요소와_입력_역할은_글자_대신_이름표를_쓰고_행은_첫_칸만_쓴다(live):
    from app.ieum.recorder import manager
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    html = ("<div id='ed' contenteditable='true' aria-label='메모'>010-1234-5678 비밀메모</div>"
            "<div id='tb' role='textbox' aria-label='검색어'>김철수 주소</div>"
            "<table><tr id='row'><td>PO-2609-0142</td><td>홍길동 010-9876-5432</td></tr></table>")

    async def go():
        await s.page.evaluate("h => { const d = document.createElement('div'); d.innerHTML = h; document.body.prepend(d); }", html)
        got = []
        for sel in ("#ed", "#tb", "#row td:nth-child(2)"):
            s.trace.current = {"seq": 0, "action": {"type": "click", "target": None, "isTrusted": None, "t": 0}, "fills": [], "network": []}
            await s.page.click(sel)
            await asyncio.sleep(0.3)
            got.append((s.trace.current["action"]["target"] or {}).get("text"))
        s.trace.current = None
        return got
    try:
        texts = call(go())
    finally:
        call(manager.MANAGER.close(out["id"]))
    assert texts == ["메모", "검색어", "PO-2609-0142"], texts


def test_멈추기_시작한_뒤_페이지가_보낸_쓰기는_120초_기다리지_않고_바로_거절한다(live):
    from app.ieum.recorder import manager
    out = start(live)
    rid = out["id"]
    s = manager.MANAGER.get(rid)
    call(s.page.goto(s.policy.base + "/poListView.do"))
    manager.MANAGER.on_stopped = _noop
    ws = WS()
    s.subscribe(ws)
    try:
        call(s.page.evaluate(
            "setTimeout(()=>fetch('/demo-legacy/po/poSave.do',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},"
            f"body:'{SAVE_BODY}'}}).catch(()=>0),1500)"))
        t0 = time.time()
        call(manager.MANAGER.stop(rid))
        time.sleep(2.5)                                    # 쓰기가 나간 뒤까지 기다린다(멈춤은 그 전에 시작했다)
        assert time.time() - t0 < 15
        assert not [m for m in ws.msgs if m.get("t") == "hold"]
        assert not s.guard.holding
        assert any(d["decision"] == "deny" and d["label"] == "기록 종료 중" for d in s.guard.decisions)
    finally:
        manager.MANAGER.on_stopped = None
        call(manager.MANAGER.close(rid))

"""레코더 저장소: 기록 요약은 스토어에, 행동 묶음은 기록별 파일에 덧붙인다."""
import time

import pytest

from app.ieum.recorder import config, retention, store


@pytest.fixture
def rec(ieum_state):
    r = store.new_recording("9월 발주 상세 조회", "홍길동", "http://h/po", "/login.do", "op", "auto")
    store.save_recording(r)
    return r


def test_기록을_만들고_읽는다(rec):
    got = store.get_recording(rec["id"])
    assert got["name"] == "9월 발주 상세 조회" and got["status"] == "recording" and got["spanCount"] == 0
    assert rec["id"].startswith("rec_") and got["env"] == "op" and got["login"]["mode"] == "auto"


def test_행동_묶음은_파일에_덧붙이고_요약에는_개수만(rec):
    assert store.append_span(rec["id"], {"seq": 1, "action": {"type": "click"}}) == 1
    assert store.append_span(rec["id"], {"seq": 2, "action": {"type": "click"}}) == 2
    assert [s["seq"] for s in store.read_spans(rec["id"])] == [1, 2]
    assert store.get_recording(rec["id"])["spanCount"] == 2
    assert "spans" not in store.get_recording(rec["id"])


def test_없는_기록은_KeyError(ieum_state):
    with pytest.raises(KeyError):
        store.get_recording("rec_none")


def test_재시작하면_진행_중이던_기록은_중단됨이_된다(rec):
    store.append_span(rec["id"], {"seq": 1})
    assert store.mark_interrupted() == 1
    got = store.get_recording(rec["id"])
    assert got["status"] == "interrupted" and len(store.read_spans(rec["id"])) == 1


def test_기록을_지우면_업무_기능과_폴더도_지운다(rec):
    store.save_function({"id": "bf_x", "source": {"recordingId": rec["id"]}, "name": "x", "status": "draft"})
    store.update_recording(rec["id"], lambda r: r.update(functionId="bf_x"))
    store.append_span(rec["id"], {"seq": 1})
    (store.rec_dir(rec["id"]) / "1-pre.jpg").write_bytes(b"x")
    store.delete_recording(rec["id"])
    with pytest.raises(KeyError):
        store.get_function("bf_x")
    assert not store.rec_dir(rec["id"]).exists()


def test_보관_정리는_확정한_것과_오래된_미확정_스크린샷만_지운다(ieum_state, monkeypatch):
    monkeypatch.setenv("IEUM_RECORDER_SHOT_DAYS", "7")
    now = time.time()
    done, old, fresh = (store.new_recording(n, "", "http://h/po", "", "op", "auto") for n in ("a", "b", "c"))
    for r, ended in ((done, now), (old, now - 8 * 86400), (fresh, now - 1 * 86400)):
        r.update(status="review", endedAt=ended)
        store.save_recording(r)
        store.append_span(r["id"], {"seq": 1})
        (store.rec_dir(r["id"]) / "1-pre.jpg").write_bytes(b"x")
    store.save_function({"id": "bf_a", "status": "confirmed", "source": {"recordingId": done["id"]}})
    store.update_recording(done["id"], lambda r: r.update(functionId="bf_a"))
    assert retention.sweep(now) == 2
    assert not (store.rec_dir(done["id"]) / "1-pre.jpg").exists() and not (store.rec_dir(old["id"]) / "1-pre.jpg").exists()
    assert (store.rec_dir(fresh["id"]) / "1-pre.jpg").exists() and store.read_spans(old["id"])   # 행동 묶음은 남는다


def test_설정은_환경변수를_읽는다(monkeypatch):
    monkeypatch.setenv("IEUM_RECORDER_MAX_SESSIONS", "9")
    monkeypatch.setenv("IEUM_RECORDER_MAX_PER_OWNER", "x")
    monkeypatch.setenv("IEUM_RECORDER_DENY", "10.9.0.0/16, admin.corp")
    assert config.max_sessions() == 9 and config.max_per_owner() == 1 and config.deny_entries() == ["10.9.0.0/16", "admin.corp"]

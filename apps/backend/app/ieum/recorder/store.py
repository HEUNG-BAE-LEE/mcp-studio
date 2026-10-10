"""기록과 업무 기능 저장.

기록 요약은 JSON 스토어 하나에, 행동 묶음은 기록마다 파일 하나(spans.jsonl)에 한 줄씩 덧붙인다. 모든 기록의 행동
묶음을 파일 하나에 넣고 묶음마다 통째로 다시 쓰면, 기록이 쌓일수록 느려지고 그 쓰기가 이벤트 루프를 막아 다른
사용자의 화면 중계까지 끊는다. 이 모듈의 함수는 동기다. 이벤트 루프에서는 asyncio.to_thread 로 부른다.
"""
import json
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, List

from app.ieum.config import state_dir
from app.ieum.store import LOCK, JsonStore

RECORDINGS = JsonStore("recorder", "recordings")
FUNCTIONS = JsonStore("recorder", "functions")
ACTIVE = ("recording", "analyzing", "verifying")
_FILE_LOCKS: Dict[str, threading.Lock] = {}
_FILE_LOCKS_GUARD = threading.Lock()


def _file_lock(rid: str) -> threading.Lock:
    with _FILE_LOCKS_GUARD:
        return _FILE_LOCKS.setdefault(rid, threading.Lock())


def rec_dir(rid: str) -> Path:
    return state_dir() / "recorder" / rid


def new_recording(name: str, owner: str, base: str, start: str, env: str, login_mode: str, read_post: str) -> dict:
    return {"id": "rec_" + uuid.uuid4().hex[:8], "name": name, "owner": owner, "sourceBase": base.rstrip("/"), "start": start or "",
            "env": env, "readPost": read_post or "", "login": {"mode": login_mode, "recipe": None, "path": ""},
            "status": "recording", "startedAt": time.time(), "endedAt": None, "spanCount": 0, "approvals": [],
            "functionId": None, "error": None}


def save_recording(rec: dict) -> None:
    with LOCK:
        data = RECORDINGS.load()
        data[rec["id"]] = rec
        RECORDINGS.save(data)


def get_recording(rid: str) -> dict:
    return RECORDINGS.load()[rid]


def update_recording(rid: str, fn: Callable[[dict], None]) -> dict:
    with LOCK:
        data = RECORDINGS.load()
        rec = data[rid]
        fn(rec)
        RECORDINGS.save(data)
        return rec


def list_recordings() -> List[dict]:
    return sorted(RECORDINGS.load().values(), key=lambda r: r["startedAt"], reverse=True)


def append_span(rid: str, span: dict) -> int:
    d = rec_dir(rid)
    d.mkdir(parents=True, exist_ok=True)
    line = json.dumps(span, ensure_ascii=False)
    with _file_lock(rid):
        with open(d / "spans.jsonl", "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return update_recording(rid, lambda r: r.update(spanCount=r.get("spanCount", 0) + 1))["spanCount"]


def read_spans(rid: str) -> List[dict]:
    path = rec_dir(rid) / "spans.jsonl"
    if not path.exists():
        return []
    with _file_lock(rid):
        with open(path, encoding="utf-8") as f:
            return [json.loads(x) for x in f if x.strip()]


def save_function(bf: dict) -> None:
    with LOCK:
        data = FUNCTIONS.load()
        data[bf["id"]] = bf
        FUNCTIONS.save(data)


def update_function(fid: str, fn: Callable[[dict], None]) -> dict:
    """최신 업무 기능을 잠금 안에서 다시 읽어 fn 으로 고치고 저장한다. fn 이 예외를 내면 저장하지 않는다. 잠금을 쥔 채 기다리지 않는다."""
    with LOCK:
        data = FUNCTIONS.load()
        bf = data[fid]
        fn(bf)
        FUNCTIONS.save(data)
        return bf


def get_function(fid: str) -> dict:
    return FUNCTIONS.load()[fid]


def list_functions() -> List[dict]:
    return sorted(FUNCTIONS.load().values(), key=lambda f: (f.get("verification") or {}).get("at") or 0, reverse=True)


def delete_recording(rid: str) -> None:
    with LOCK:
        recs = RECORDINGS.load()
        rec = recs.pop(rid)
        RECORDINGS.save(recs)
        if rec.get("functionId"):
            fns = FUNCTIONS.load()
            fns.pop(rec["functionId"], None)
            FUNCTIONS.save(fns)
    shutil.rmtree(rec_dir(rid), ignore_errors=True)


def delete_shots(rid: str) -> int:
    d = rec_dir(rid)
    n = 0
    for p in d.glob("*.jpg") if d.exists() else []:
        p.unlink(missing_ok=True)
        n += 1
    return n


def mark_interrupted() -> int:
    """서버가 다시 뜰 때: 돌던 기록은 브라우저와 함께 사라졌다. 저장된 행동 묶음은 남긴다."""
    with LOCK:
        data = RECORDINGS.load()
        n = 0
        for rec in data.values():
            if rec["status"] in ACTIVE:
                rec["status"], rec["error"] = "interrupted", "서버가 다시 시작되어 기록이 중단되었습니다."
                rec["endedAt"] = rec.get("endedAt") or time.time()
                n += 1
        if n:
            RECORDINGS.save(data)
        return n

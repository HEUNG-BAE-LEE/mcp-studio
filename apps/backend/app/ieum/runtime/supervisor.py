"""배포한 MCP 서버를 이 컴퓨터의 프로세스로 띄우고, 내리고, 살핀다 (콘솔 쪽).

묶음 하나가 프로세스 하나다. 서버는 콘솔이 사라지면 스스로 끝나고(`--parent`), 콘솔이 다시 뜰 때 `restore()` 가
배포돼 있던 것들을 같은 스냅샷으로 다시 띄운다. 포트는 묶음마다 처음 받은 것을 계속 쓴다 — AI 앱 설정에 주소를
적어 둔 사람이 있기 때문이다. 콘솔 프로세스는 하나라고 가정한다(`uvicorn --workers N` 이면 같은 묶음을 N 번 띄운다).

여기 있는 함수는 배포 기록(toolsets.json)을 모른다. 그 연결은 deployer 가 한다.
"""
import atexit
import logging
import os
import re
import signal
import socket
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Dict, Iterable, Optional

import httpx

from app.ieum import config
from app.ieum.runtime import manifest

log = logging.getLogger("ieum.runtime")

DEFAULT_PORTS = "8100-8199"
START_TIMEOUT = 40       # 초. 처음 띄울 때는 import 가 느린 컴퓨터(Rosetta 등)에서 20초를 넘기기도 한다
SWAP_TIMEOUT = 10        # 초. 떠 있는 서버가 새 스냅샷으로 바꾸는 걸 기다리는 시간
STOP_TIMEOUT = 8
LOG_CAP = 1024 * 1024    # 바이트. 이보다 크면 서버를 띄울 때 로그를 비운다
_ID = re.compile(r"ts-[a-z0-9][a-z0-9-]{0,39}")
_IN_USE = ("address already in use", "errno 48", "errno 98")


class DeployError(Exception):
    """배포·시작에 실패했다. 메시지는 화면에 그대로 보인다."""

    def __init__(self, message: str, status: int = 500) -> None:
        super().__init__(message)
        self.status = status


@dataclass
class _Proc:
    popen: Optional[subprocess.Popen]
    port: int
    started: float
    state: str = "starting"          # starting | running | crashed
    exit_code: Optional[int] = None
    message: str = ""


_PROCS: Dict[str, _Proc] = {}
_REG = threading.RLock()             # _PROCS 와 _OPS 를 지킨다
_OPS: Dict[str, threading.RLock] = {}


# ------------------------------------------------------------------ 위치, 설정
def _check(ts_id: str) -> str:
    """묶음 id 로 폴더 경로를 만든다. 경로를 벗어나는 값은 받지 않는다."""
    if not _ID.fullmatch(ts_id or ""):
        raise DeployError("묶음 id 가 올바르지 않습니다.", 400)
    return ts_id


def deploy_dir(ts_id: str):
    return config.state_dir() / "deployments" / _check(ts_id)


def manifest_path(ts_id: str):
    return deploy_dir(ts_id) / "manifest.json"


def log_path(ts_id: str):
    return deploy_dir(ts_id) / "server.log"


def has_manifest(ts_id: str) -> bool:
    return manifest_path(ts_id).is_file()


def host() -> str:
    return os.environ.get("IEUM_MCP_HOST") or "127.0.0.1"


def _connect_host() -> str:
    """서버에 붙을 때 쓰는 주소. 0.0.0.0 으로 열어 두었더라도 이 컴퓨터에서는 127.0.0.1 로 붙는다."""
    return "127.0.0.1" if host() in ("0.0.0.0", "::", "") else host()


def url_of(port: int) -> str:
    return "http://%s:%d/mcp" % (_connect_host(), port)


def port_range():
    raw = os.environ.get("IEUM_MCP_PORTS") or DEFAULT_PORTS
    try:
        lo, hi = (int(x) for x in raw.split("-"))
        if 1024 <= lo <= hi <= 65535:
            return lo, hi
    except ValueError:
        pass
    raise DeployError("IEUM_MCP_PORTS 형식이 올바르지 않습니다: %s (예: 8100-8199)" % raw)


def autorestore() -> bool:
    return (os.environ.get("IEUM_MCP_AUTORESTORE") or "1").lower() not in ("0", "false", "no", "off")


@contextmanager
def op_lock(ts_id: str):
    """묶음 하나에 대한 배포·시작·중지는 한 번에 하나만 돈다. 같은 스레드에서는 겹쳐 잡을 수 있다."""
    with _REG:
        lock = _OPS.setdefault(_check(ts_id), threading.RLock())
    with lock:
        yield


# ------------------------------------------------------------------ 포트
def _free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)     # uvicorn 과 같은 조건으로 시험한다
        try:
            s.bind((host(), port))
            return True
        except OSError:
            return False


def _pick_port(hint: Optional[int], taken: set) -> int:
    lo, hi = port_range()
    if hint and hint not in taken and _free(hint):
        return hint
    for port in range(lo, hi + 1):
        if port not in taken and _free(port):
            return port
    raise DeployError("쓸 수 있는 포트가 없습니다. (%d-%d) IEUM_MCP_PORTS 로 범위를 넓혀 주세요." % (lo, hi))


# ------------------------------------------------------------------ 프로세스
def _tail(ts_id: str, lines: int = 8, size: int = 4096) -> str:
    try:
        with open(log_path(ts_id), "rb") as f:
            f.seek(0, os.SEEK_END)
            f.seek(max(f.tell() - size, 0))
            text = f.read().decode("utf-8", "replace")
    except OSError:
        return ""
    return "\n".join([ln for ln in text.splitlines() if ln.strip()][-lines:])


def log_lines(ts_id: str, lines: int = 200):
    """서버 로그의 마지막 줄들. 서버를 띄운 적이 없으면 빈 목록이다."""
    return _tail(ts_id, lines=max(1, min(int(lines), 1000)), size=256 * 1024).splitlines()


def _launch(ts_id: str, port: int) -> subprocess.Popen:
    d = deploy_dir(ts_id)
    d.mkdir(parents=True, exist_ok=True)
    path = log_path(ts_id)
    if path.exists() and path.stat().st_size > LOG_CAP:
        path.write_bytes(b"")
    cmd = [sys.executable, "-m", "app.ieum.runtime.server", "--manifest", str(manifest_path(ts_id)), "--port", str(port),
           "--host", host(), "--parent", str(os.getpid())]
    # 상태 폴더를 그대로 넘긴다. 서버가 키 저장소, 호출 로그, 인증 금고를 같은 곳에서 읽는다.
    env = dict(os.environ, IEUM_STATE_DIR=str(config.state_dir()), PYTHONUNBUFFERED="1")
    with open(path, "ab") as logf:
        logf.write(("── %s 시작 (포트 %d) ──\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), port)).encode("utf-8"))
        logf.flush()
        # 새 세션으로 띄운다. 터미널의 Ctrl+C 가 콘솔보다 먼저 서버를 죽이지 않고, 종료는 우리가 순서를 정한다.
        # 부모의 CPU 아키텍처를 그대로 이어받으므로(Rosetta 로 뜬 콘솔이면 서버도) 따로 지정하지 않는다.
        return subprocess.Popen(cmd, cwd=str(config.BACKEND_DIR), env=env, stdin=subprocess.DEVNULL, stdout=logf, stderr=subprocess.STDOUT,
                                start_new_session=True)


def _health(port: int) -> Optional[dict]:
    try:
        # 사내 프록시 환경변수가 있어도 이 컴퓨터의 서버를 프록시로 부르지 않는다(trust_env=False)
        r = httpx.get("http://%s:%d/health" % (_connect_host(), port), timeout=1.0, trust_env=False)
        return r.json() if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        return None


def _wait_ready(ts_id: str, popen: subprocess.Popen, port: int) -> Optional[str]:
    """우리가 띄운 프로세스가 /health 에 답할 때까지 기다린다. 성공이면 None, 실패면 이유를 돌려준다."""
    deadline = time.monotonic() + START_TIMEOUT
    while time.monotonic() < deadline:
        code = popen.poll()
        if code is not None:
            return "서버 프로세스가 시작하자마자 끝났습니다 (종료 코드 %s).\n%s" % (code, _tail(ts_id))
        h = _health(port)
        if h and h.get("service") == "ieum-mcp" and h.get("toolset") == ts_id and h.get("pid") == popen.pid:
            return None
        time.sleep(0.15)
    return "서버가 %d초 안에 응답하지 않았습니다.\n%s" % (START_TIMEOUT, _tail(ts_id))


def _terminate(popen: Optional[subprocess.Popen]) -> None:
    if popen is None or popen.poll() is not None:
        return
    try:
        os.killpg(popen.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        pass
    try:
        popen.wait(timeout=STOP_TIMEOUT)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(popen.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        popen.wait()


def _spawn(ts_id: str, port_hint: Optional[int], reserved: Iterable[int]) -> _Proc:
    taken, last = set(reserved), ""
    for _ in range(4):                      # 포트를 확인한 뒤 남이 가져가는 경우가 드물게 있다
        port = _pick_port(port_hint, taken)
        rec = _Proc(None, port, time.time())
        with _REG:
            _PROCS[ts_id] = rec
        try:
            rec.popen = _launch(ts_id, port)
        except OSError as e:
            rec.state, rec.message = "crashed", "서버 프로세스를 시작하지 못했습니다. (%s)" % e
            raise DeployError(rec.message)
        err = _wait_ready(ts_id, rec.popen, port)
        if err is None:
            rec.state, rec.started = "running", time.time()
            log.info("MCP 서버를 띄웠습니다: %s %s (pid %d)", ts_id, url_of(port), rec.popen.pid)
            return rec
        _terminate(rec.popen)
        rec.state, rec.message, last = "crashed", err, err
        if not any(m in err.lower() for m in _IN_USE):
            break
        taken.add(port)
    raise DeployError("MCP 서버를 띄우지 못했습니다. %s" % last)


# ------------------------------------------------------------------ 바깥에서 쓰는 것
def apply(ts_id: str, data: dict, port_hint: Optional[int] = None, reserved: Iterable[int] = ()) -> dict:
    """새 스냅샷을 배포한다. 떠 있는 서버는 다음 요청부터 새 정의로 답하고(프로세스는 그대로), 없으면 새로 띄운다.

    실패하면 스냅샷을 이전 것으로 되돌린다. 그래야 콘솔이 다시 떴을 때 실패한 버전이 올라오지 않는다.
    """
    with op_lock(ts_id):
        path = manifest_path(ts_id)
        before = path.read_bytes() if path.is_file() else None
        manifest.write(path, data)
        try:
            rec = _alive(ts_id)
            if rec is not None:
                err = _wait_version(ts_id, rec, data["toolset"]["version"])
                if err:
                    raise DeployError(err)
            else:
                _spawn(ts_id, port_hint, reserved)
        except BaseException:
            if before is None:
                path.unlink(missing_ok=True)
            else:
                manifest.restore(path, before)
            raise
        return status(ts_id)


def _wait_version(ts_id: str, rec: _Proc, version: str) -> Optional[str]:
    deadline = time.monotonic() + SWAP_TIMEOUT
    h = None
    while time.monotonic() < deadline:
        if rec.popen.poll() is not None:
            return "서버 프로세스가 배포 중에 끝났습니다 (종료 코드 %s).\n%s" % (rec.popen.returncode, _tail(ts_id))
        h = _health(rec.port)
        if h and h.get("pid") == rec.popen.pid and h.get("version") == version:
            return None
        if h and h.get("loadError"):
            return "서버가 새 버전을 읽지 못했습니다. %s" % h["loadError"]
        time.sleep(0.1)
    return "서버가 새 버전(%s)으로 바뀌지 않았습니다." % version


def ensure_running(ts_id: str, port_hint: Optional[int] = None, reserved: Iterable[int] = ()) -> dict:
    """이미 있는 스냅샷 그대로 서버를 띄운다. 떠 있으면 그대로 둔다."""
    with op_lock(ts_id):
        if not has_manifest(ts_id):
            raise DeployError("배포한 스냅샷이 없어 서버를 시작할 수 없습니다. 먼저 배포해 주세요.", 400)
        if _alive(ts_id) is None:
            _spawn(ts_id, port_hint, reserved)
        return status(ts_id)


def _alive(ts_id: str) -> Optional[_Proc]:
    with _REG:
        rec = _PROCS.get(ts_id)
    return rec if rec and rec.popen is not None and rec.popen.poll() is None else None


def stop(ts_id: str) -> None:
    with op_lock(ts_id):
        with _REG:
            rec = _PROCS.pop(ts_id, None)
        if rec:
            _terminate(rec.popen)
            log.info("MCP 서버를 내렸습니다: %s", ts_id)


def remove(ts_id: str) -> None:
    """서버를 내리고 스냅샷과 로그를 지운다."""
    with op_lock(ts_id):
        stop(ts_id)
        d = deploy_dir(ts_id)
        for name in ("manifest.json", "manifest.json.tmp", "server.log"):
            (d / name).unlink(missing_ok=True)
        try:
            d.rmdir()
        except OSError:
            pass


def status(ts_id: str) -> dict:
    """지금 서버가 어떤지. state: stopped | starting | running | crashed"""
    with _REG:
        rec = _PROCS.get(ts_id)
    if rec is None:
        return {"state": "stopped"}
    running = False
    if rec.popen is not None:
        code = rec.popen.poll()
        running = code is None
        if code is not None:
            if rec.exit_code is None:
                rec.exit_code = code
            if rec.state != "crashed":
                rec.state = "crashed"
                rec.message = rec.message or ("서버 프로세스가 끝났습니다 (종료 코드 %s)." % code if code >= 0 else "서버 프로세스가 신호 %d 로 끝났습니다." % -code)
    out = {"state": rec.state, "startedAt": rec.started}
    if rec.port:                            # 복구를 기다리는 동안은 포트를 아직 모른다
        out.update(port=rec.port, url=url_of(rec.port))
    if running:
        out["pid"] = rec.popen.pid
    if rec.state == "crashed":
        out.update(exitCode=rec.exit_code, message=rec.message)
    return out


def restore(items: Iterable[tuple], on_port=None) -> None:
    """콘솔이 뜰 때 배포돼 있던 서버들을 같은 스냅샷으로 다시 띄운다. [(묶음 id, 포트)] 를 받고 바로 돌아온다.

    쓰던 포트를 남이 쥐고 있으면 다른 포트로 뜬다. on_port(묶음 id, 포트) 가 그 새 포트를 기록할 기회를 준다.
    """
    items = [(i, p) for i, p in items if has_manifest(i)]
    ports = {p for _, p in items if p}
    for ts_id, port in items:
        with _REG:
            _PROCS.setdefault(ts_id, _Proc(None, port or 0, time.time()))      # 목록이 바로 "시작하는 중"으로 보이게

    def one(ts_id, port):
        try:
            with op_lock(ts_id):
                with _REG:
                    _PROCS.pop(ts_id, None)
                rec = _spawn(ts_id, port, ports - {port})
            if on_port and rec.port != port:
                on_port(ts_id, rec.port)
        except Exception as e:             # 어떤 이유로든 "시작하는 중"에 갇혀 있으면 안 된다
            log.exception("MCP 서버를 다시 띄우지 못했습니다: %s", ts_id)
            with _REG:
                _PROCS[ts_id] = _Proc(None, port or 0, time.time(), state="crashed", message=str(e))

    for ts_id, port in items:
        threading.Thread(target=one, args=(ts_id, port), name="ieum-restore-" + ts_id, daemon=True).start()


def shutdown() -> None:
    """모든 서버를 내린다. 콘솔이 끝날 때 부른다. 먼저 모두에게 종료를 알린 뒤 기다려 시간을 아낀다."""
    with _REG:
        recs = list(_PROCS.values())
        _PROCS.clear()
    for rec in recs:
        if rec.popen is not None and rec.popen.poll() is None:
            try:
                os.killpg(rec.popen.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
    for rec in recs:
        _terminate(rec.popen)


atexit.register(shutdown)

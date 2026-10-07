"""이음 배포 시험: 도구 묶음을 로컬 프로세스 MCP 서버로 띄우고, 바꾸고, 내리고, 되살리는 전 과정.

서버는 시험 프로세스와 다른 진짜 프로세스다(`python -m app.ieum.runtime.server`). 상태 폴더는 시험마다 임시로 돌려
쓰고(`ieum_state`), 끝나면 띄운 서버를 모두 내린다.
"""
import json
import os
import signal
import socket
import subprocess
import sys
import textwrap
import time
from pathlib import Path

import httpx
import pytest

from app.ieum.repositories import deploy as deploy_repo
from app.ieum.runtime import deployer, manifest, protocol, supervisor

BACKEND = Path(__file__).resolve().parents[1]


def wait_for(cond, timeout=20, step=0.1):
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = cond()
        if value:
            return value
        time.sleep(step)
    raise AssertionError("제한 시간 안에 조건이 맞지 않았습니다.")


def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


def health(rt):
    return httpx.get(rt["url"].replace("/mcp", "/health"), timeout=5).json()


def toolset(console, ts_id):
    return next(t for t in console.api("GET", "/deploy/toolsets/")[1] if t["id"] == ts_id)


@pytest.fixture
def hr(console):
    """데모 원본을 연결하고 도구를 공개해 HR 묶음을 배포한 상태. (콘솔, 묶음, 키)"""
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    ts, key = console.publish(ids)
    return console, ts, key["secret"]


# ------------------------------------------------------------------ 스냅샷
def test_manifest_freezes_definitions_and_leaves_secrets_out():
    tools = [{"id": "a", "src": "s1", "status": "done", "mode": "read", "params": [], "res": [], "_dirty": True, "disc": {"src": {"file": "X.java"}}, "calls": 7}]
    src = {"s1": {"id": "s1", "name": "S1", "proto": "gov", "base": "http://x", "authType": "key", "specUrl": "http://x/spec?serviceKey=SECRET-VALUE", "err": False},
           "s2": {"id": "s2", "name": "쓰지 않는 시스템", "proto": "rest", "base": "http://y"}}
    m = manifest.build({"id": "ts-x", "slug": "x", "name": "X"}, "v1.0", tools, src)
    assert m["toolset"] == {"id": "ts-x", "slug": "x", "name": "X", "version": "v1.0"}
    assert list(m["sources"]) == ["s1"]                                  # 쓰지 않는 시스템은 들어가지 않는다
    assert "specUrl" not in m["sources"]["s1"] and "SECRET-VALUE" not in json.dumps(m)
    assert set(m["tools"][0]) == {"id", "src", "status", "mode", "params", "res"}   # 임시·근거·횟수 필드는 빠진다

    # 도구를 빼도 버전과 나머지는 그대로다
    assert manifest.without_tools(m, ["a"])["tools"] == [] and manifest.without_tools(m, ["a"])["sources"] == {}
    assert manifest.without_tools(m, ["a"])["toolset"] == m["toolset"]


def test_manifest_rejects_bad_files(tmp_path):
    for bad in ({}, {"schema": 2}, {"schema": 1, "toolset": {"id": "ts-x"}, "tools": [], "sources": {}},
                {"schema": 1, "toolset": {"id": "ts-x", "slug": "x", "version": "v1"}, "tools": [{"id": "t", "src": "없음"}], "sources": {}}):
        with pytest.raises(manifest.ManifestError):
            manifest.validate(bad)
    path = tmp_path / "m.json"
    with pytest.raises(manifest.ManifestError):
        manifest.load(path)                                              # 없는 파일
    path.write_text("{깨진")
    with pytest.raises(manifest.ManifestError):
        manifest.load(path)


# ------------------------------------------------------------------ 배포 전체 흐름
def test_deploy_starts_a_separate_process_that_serves_mcp(hr):
    console, ts, secret = hr
    rt = ts["runtime"]
    assert (ts["status"], ts["ver"], rt["state"], rt["kind"]) == ("live", "v1.0", "running", "local-process")
    assert rt["url"] == "http://127.0.0.1:%d/mcp" % rt["port"] and 8100 <= rt["port"] <= 8199
    assert rt["pid"] != os.getpid() and alive(rt["pid"])
    assert health(rt) == dict(health(rt), service="ieum-mcp", toolset=ts["id"], version="v1.0", tools=3, pid=rt["pid"])

    # MCP 핸드셰이크와 도구 호출이 그 프로세스에서 끝난다
    init = console.mcp(secret, "initialize", {"protocolVersion": "2025-06-18"})[1]["result"]
    assert (init["protocolVersion"], init["serverInfo"]) == ("2025-06-18", {"name": "ieum-hr", "version": "1.0"})
    assert [t["name"] for t in console.mcp(secret, "tools/list")[1]["result"]["tools"]] == ["search_employee", "get_vacation_balance", "request_vacation"]
    res = console.mcp(secret, "tools/call", {"name": "get_vacation_balance", "arguments": {"emp_no": "20190412", "base_ymd": "2026-10-01"}})[1]["result"]
    assert res["structuredContent"]["annual_rem_cnt"] == 5.5

    # 서버 프로세스가 남긴 호출 기록이 콘솔의 호출 로그에 보인다(프로세스 사이에서 파일을 같이 쓴다)
    st, logs = console.api("GET", "/logs/")
    assert logs["rows"][0]["tool"] == "get_vacation_balance" and logs["rows"][0]["user"] == "t"

    # 서버 로그에는 시작과 요청이 남는다. /health 확인은 남기지 않는다
    lines = console.api("GET", "/deploy/toolsets/%s/logs/" % ts["id"])[1]["lines"]
    text = "\n".join(lines)
    assert "MCP 서버를 시작합니다" in text and '"POST /mcp HTTP/1.1" 200' in text and "/health" not in text
    assert "http://127.0.0.1:%d" % rt["port"] in text                      # 이 컴퓨터에서만 연다


def test_new_version_swaps_definitions_without_restarting(hr):
    console, ts, secret = hr
    pid, port = ts["runtime"]["pid"], ts["runtime"]["port"]
    desc = lambda: next(t for t in console.mcp(secret, "tools/list")[1]["result"]["tools"] if t["name"] == "search_employee")["description"]

    before = desc()
    assert console.api("PUT", "/studio/search_employee/", {"desc": "바뀐 설명입니다."})[0] == 200
    # 스튜디오에서 저장만 했다면 서버는 그대로다 — "다음 배포 때 반영됩니다"가 사실이어야 한다
    assert desc() == before

    st, out = console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])
    assert st == 200 and out["toolset"]["ver"] == "v1.1"
    assert (out["toolset"]["runtime"]["pid"], out["toolset"]["runtime"]["port"]) == (pid, port)   # 같은 프로세스, 같은 주소
    assert desc() == "바뀐 설명입니다." and health(out["toolset"]["runtime"])["version"] == "v1.1"

    # 새 버전은 한 단계씩 오른다
    assert console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])[1]["toolset"]["ver"] == "v1.2"


def test_stop_and_start_keep_the_address_and_version(hr):
    console, ts, secret = hr
    port, pid = ts["runtime"]["port"], ts["runtime"]["pid"]

    st, stopped = console.api("POST", "/deploy/toolsets/%s/stop/" % ts["id"])
    assert (stopped["status"], stopped["runtime"]["state"]) == ("stopped", "stopped")
    assert (stopped["runtime"]["port"], stopped["runtime"]["url"]) == (port, ts["runtime"]["url"])   # 내려가 있어도 주소는 보인다
    assert "pid" not in stopped["runtime"]
    wait_for(lambda: not alive(pid) and not port_open(port))
    with pytest.raises(httpx.TransportError):
        console.mcp(secret, "ping")                                       # 내려간 서버에는 닿지 않는다

    st, back = console.api("POST", "/deploy/toolsets/%s/start/" % ts["id"])
    assert (back["status"], back["ver"], back["runtime"]["state"], back["runtime"]["port"]) == ("live", "v1.0", "running", port)
    assert back["runtime"]["pid"] != pid
    assert console.mcp(secret, "ping")[1]["result"] == {}

    # 이미 떠 있으면 다시 띄우지 않는다
    assert console.api("POST", "/deploy/toolsets/%s/start/" % ts["id"])[1]["runtime"]["pid"] == back["runtime"]["pid"]


def test_crashed_server_is_reported_and_can_be_started_again(hr):
    console, ts, secret = hr
    pid = ts["runtime"]["pid"]
    os.kill(pid, signal.SIGKILL)
    rt = wait_for(lambda: (lambda r: r if r["state"] == "crashed" else None)(toolset(console, ts["id"])["runtime"]))
    assert rt["exitCode"] == -9 and "신호 9" in rt["message"] and "pid" not in rt
    assert toolset(console, ts["id"])["status"] == "live"                  # 띄워 두는 게 맞는 상태이므로 중지와 구분된다

    back = console.api("POST", "/deploy/toolsets/%s/start/" % ts["id"])[1]
    assert back["runtime"]["state"] == "running" and console.mcp(secret, "ping")[1]["result"] == {}


def test_revoked_key_stops_working_at_once(hr):
    console, ts, secret = hr
    st, other = console.api("POST", "/deploy/keys/", {"name": "다른 키"})
    assert console.mcp(other["secret"], "ping")[0] == 200
    console.api("POST", "/deploy/keys/%s/revoke/" % other["id"])
    assert console.mcp(other["secret"], "ping")[0] == 401                  # 서버를 다시 띄우지 않아도 바로 막힌다
    assert console.mcp(secret, "ping")[0] == 200


def test_server_only_trusts_local_origins(hr):
    console, ts, secret = hr
    url = ts["runtime"]["url"]
    post = lambda origin: httpx.post(url, headers={"Authorization": "Bearer " + secret, "Origin": origin}, json={"jsonrpc": "2.0", "id": 1, "method": "ping"}).status_code
    assert post("http://localhost:5173") == 200
    assert post("http://evil.example") == 403                              # DNS 리바인딩을 막는다
    assert httpx.post(url, headers={"Authorization": "Bearer " + secret, "MCP-Protocol-Version": "1999-01-01"}, json={"jsonrpc": "2.0", "id": 1, "method": "ping"}).status_code == 400


# ------------------------------------------------------------------ 배포 규칙
def test_health_check_ignores_proxy_environment(monkeypatch):
    """사내 프록시 환경변수가 있어도 이 컴퓨터의 서버를 프록시로 부르면 안 된다(배포가 40초 뒤 시간 초과로 끝난다)."""
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps({"service": "ieum-mcp"}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        for name in ("HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"):
            monkeypatch.setenv(name, "http://127.0.0.1:9")                     # 아무도 듣지 않는 프록시
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.delenv("no_proxy", raising=False)
        assert supervisor._health(server.server_address[1]) == {"service": "ieum-mcp"}
    finally:
        server.shutdown()


def test_saving_several_tools_at_once_loses_none(console):
    """배포 화면은 저장하지 않은 도구를 한꺼번에 저장한다. 겹친 요청이 서로의 변경을 지우면 공개한 도구가 조용히 빠진다."""
    from concurrent.futures import ThreadPoolExecutor
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    with ThreadPoolExecutor(max_workers=len(ids)) as pool:
        codes = list(pool.map(lambda tid: console.api("PUT", "/studio/%s/" % tid, {"status": "done", "desc": "설명 " + tid})[0], ids))
    assert codes == [200] * len(ids)
    tools = {t["id"]: t for t in console.api("GET", "/studio/")[1]["demo"]}
    assert {i: tools[i]["status"] for i in ids} == {i: "done" for i in ids}
    assert {i: tools[i]["desc"] for i in ids} == {i: "설명 " + i for i in ids}


def test_deploy_without_saved_publication_explains_what_to_do(console):
    """스튜디오에서 공개를 켜기만 하고 저장하지 않으면 서버는 모른다. 왜 안 되는지, 무엇을 할지 알려 준다."""
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    st, ts = console.api("POST", "/deploy/toolsets/", {"name": "HR", "slug": "hr", "tools": ids})
    st, msg = console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])
    assert st == 400 and "변경사항 저장" in msg
    assert toolset(console, ts["id"])["status"] == "draft" and not supervisor.has_manifest(ts["id"])


def test_failed_first_deploy_leaves_nothing_behind(console, monkeypatch):
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    for tid in ids:
        console.api("PUT", "/studio/%s/" % tid, {"status": "done"})
    st, ts = console.api("POST", "/deploy/toolsets/", {"name": "HR", "slug": "hr", "tools": ids})

    def crash(ts_id, port):
        logf = open(supervisor.log_path(ts_id), "ab")
        return subprocess.Popen([sys.executable, "-c", "import sys; print('boom: 의존성이 없습니다'); sys.exit(3)"], stdout=logf, stderr=subprocess.STDOUT)
    monkeypatch.setattr(supervisor, "_launch", crash)

    st, msg = console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])
    assert st == 500 and "종료 코드 3" in msg and "boom: 의존성이 없습니다" in msg     # 로그 끝부분을 그대로 보여 준다
    after = toolset(console, ts["id"])
    assert (after["status"], after["ver"], after["runtime"]["state"]) == ("draft", "v0.1", "none")
    assert not supervisor.has_manifest(ts["id"])                           # 실패한 스냅샷을 남기지 않는다


def test_failed_new_version_keeps_serving_the_old_one(hr, monkeypatch):
    console, ts, secret = hr
    original = manifest.write

    def write_broken(path, data):
        original(path, data)
        Path(path).write_text("{깨진 스냅샷")                               # 서버가 새 버전을 읽지 못하는 상황
    monkeypatch.setattr(manifest, "write", write_broken)
    monkeypatch.setattr(supervisor, "SWAP_TIMEOUT", 5)

    st, msg = console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])
    assert st == 500 and "새 버전을 읽지 못했습니다" in msg
    after = toolset(console, ts["id"])
    assert (after["ver"], after["runtime"]["state"]) == ("v1.0", "running")   # 기록은 이전 버전 그대로
    assert console.mcp(secret, "ping")[1]["result"] == {}                      # 서버도 이전 버전으로 계속 답한다
    manifest.validate(json.loads(supervisor.manifest_path(ts["id"]).read_text()))   # 스냅샷 파일도 되돌려져 있다


def test_slug_is_frozen_once_deployed(hr):
    console, ts, _ = hr
    body = {"name": "HR", "slug": "hr2", "tools": ts["tools"]}
    assert console.api("PUT", "/deploy/toolsets/%s/" % ts["id"], body)[0] == 400
    assert console.api("PUT", "/deploy/toolsets/%s/" % ts["id"], dict(body, slug="hr", name="인사"))[0] == 200


def test_draft_has_no_server_to_start_or_stop(console):
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    st, ts = console.api("POST", "/deploy/toolsets/", {"name": "HR", "slug": "hr", "tools": ids})
    assert ts["runtime"] == {"state": "none", "kind": "local-process"}
    assert console.api("POST", "/deploy/toolsets/%s/start/" % ts["id"])[0] == 400
    assert console.api("POST", "/deploy/toolsets/%s/stop/" % ts["id"])[0] == 400
    for path in ("deploy/", "start/", "stop/"):
        assert console.api("POST", "/deploy/toolsets/ts-nope/" + path)[0] == 404
    assert console.api("GET", "/deploy/toolsets/ts-nope/logs/")[0] == 404


def test_runtime_paths_never_leave_the_deployments_folder(ieum_state):
    for bad in ("../x", "ts-../x", "ts-a/b", "", "TS-A", "ts-" + "a" * 41):
        with pytest.raises(supervisor.DeployError):
            supervisor.deploy_dir(bad)
    assert supervisor.deploy_dir("ts-ok-1").parent == ieum_state / "deployments"


def test_deleting_a_toolset_takes_its_server_down(hr):
    console, ts, secret = hr
    port, pid = ts["runtime"]["port"], ts["runtime"]["pid"]
    deployment_dir = supervisor.deploy_dir(ts["id"])
    assert deployment_dir.is_dir()
    assert console.api("DELETE", "/deploy/toolsets/%s/" % ts["id"])[0] == 200
    wait_for(lambda: not alive(pid) and not port_open(port))
    assert not deployment_dir.exists()


def test_ports_are_sticky_and_never_shared(hr):
    console, ts, _ = hr
    first = ts["runtime"]["port"]
    ids = ts["tools"]
    st, second = console.api("POST", "/deploy/toolsets/", {"name": "둘째", "slug": "hr-two", "tools": ids})
    st, deployed = console.api("POST", "/deploy/toolsets/%s/deploy/" % second["id"])
    assert st == 200 and deployed["toolset"]["runtime"]["port"] not in (first, None)

    # 내려 둔 묶음의 포트도 다른 묶음이 가져가지 않는다
    console.api("POST", "/deploy/toolsets/%s/stop/" % ts["id"])
    st, third = console.api("POST", "/deploy/toolsets/", {"name": "셋째", "slug": "hr-three", "tools": ids})
    taken = console.api("POST", "/deploy/toolsets/%s/deploy/" % third["id"])[1]["toolset"]["runtime"]["port"]
    assert taken not in (first, deployed["toolset"]["runtime"]["port"])
    assert console.api("POST", "/deploy/toolsets/%s/start/" % ts["id"])[1]["runtime"]["port"] == first


def test_busy_port_is_skipped(console, monkeypatch):
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    with socket.socket() as busy:
        busy.bind(("127.0.0.1", 0))
        busy.listen()
        taken = busy.getsockname()[1]
        monkeypatch.setenv("IEUM_MCP_PORTS", "%d-%d" % (taken, taken + 20))
        ts, _ = console.publish(ids)
        assert ts["runtime"]["port"] != taken and taken < ts["runtime"]["port"] <= taken + 20


def test_deploy_fails_clearly_when_no_port_is_free(console, monkeypatch):
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    for tid in ids:
        console.api("PUT", "/studio/%s/" % tid, {"status": "done"})
    st, ts = console.api("POST", "/deploy/toolsets/", {"name": "HR", "slug": "hr", "tools": ids})
    with socket.socket() as busy:
        busy.bind(("127.0.0.1", 0))
        busy.listen()
        port = busy.getsockname()[1]
        monkeypatch.setenv("IEUM_MCP_PORTS", "%d-%d" % (port, port))
        st, msg = console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])
    assert st == 500 and "쓸 수 있는 포트가 없습니다" in msg


# ------------------------------------------------------------------ 콘솔이 다시 뜰 때, 사라질 때
def test_console_restart_brings_deployed_servers_back(hr, monkeypatch):
    console, ts, secret = hr
    ids = ts["tools"]
    st, stopped = console.api("POST", "/deploy/toolsets/", {"name": "내려둠", "slug": "off", "tools": ids})
    console.api("POST", "/deploy/toolsets/%s/deploy/" % stopped["id"])
    console.api("POST", "/deploy/toolsets/%s/stop/" % stopped["id"])
    port, old_pid = ts["runtime"]["port"], ts["runtime"]["pid"]

    supervisor.shutdown()                                                  # 콘솔이 내려간다 — 서버도 함께 내려간다
    wait_for(lambda: not alive(old_pid) and not port_open(port))
    assert toolset(console, ts["id"])["runtime"]["state"] == "stopped"

    monkeypatch.setenv("IEUM_MCP_AUTORESTORE", "1")
    deployer.restore_all()                                                 # 콘솔이 다시 뜬다 — 기다리지 않고 돌아온다
    assert toolset(console, ts["id"])["runtime"]["state"] in ("starting", "running")
    rt = wait_for(lambda: (lambda r: r if r["state"] == "running" else None)(toolset(console, ts["id"])["runtime"]), timeout=40)
    assert rt["port"] == port and rt["pid"] != old_pid                    # 같은 주소로 돌아온다
    assert toolset(console, ts["id"])["ver"] == "v1.0"
    assert console.mcp(secret, "ping")[1]["result"] == {}
    assert toolset(console, stopped["id"])["runtime"]["state"] == "stopped"   # 사람이 내린 것은 올리지 않는다


def test_restore_moves_to_another_port_when_the_old_one_is_taken(hr, monkeypatch):
    console, ts, secret = hr
    port = ts["runtime"]["port"]
    supervisor.shutdown()
    wait_for(lambda: not port_open(port))
    with socket.socket() as busy:                                            # 그 사이 남이 포트를 가져갔다
        busy.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        busy.bind(("127.0.0.1", port))
        busy.listen()
        monkeypatch.setenv("IEUM_MCP_AUTORESTORE", "1")
        deployer.restore_all()
        rt = wait_for(lambda: (lambda r: r if r["state"] == "running" else None)(toolset(console, ts["id"])["runtime"]), timeout=40)
    assert rt["port"] != port
    assert toolset(console, ts["id"])["port"] == rt["port"]                  # 기록도 새 주소를 따라간다
    console.urls["hr"] = rt["url"]
    assert console.mcp(secret, "ping")[1]["result"] == {}


def test_restore_failure_is_reported_not_left_starting(hr, monkeypatch):
    console, ts, _ = hr
    supervisor.shutdown()
    monkeypatch.setenv("IEUM_MCP_AUTORESTORE", "1")
    monkeypatch.setattr(supervisor, "_launch", lambda ts_id, port: (_ for _ in ()).throw(RuntimeError("예기치 못한 오류")))
    deployer.restore_all()
    rt = wait_for(lambda: (lambda r: r if r["state"] != "starting" else None)(toolset(console, ts["id"])["runtime"]))
    assert rt["state"] == "crashed" and "예기치 못한 오류" in rt["message"]


def test_restore_is_off_when_disabled(hr, monkeypatch):
    console, ts, _ = hr
    supervisor.shutdown()
    monkeypatch.setenv("IEUM_MCP_AUTORESTORE", "0")
    deployer.restore_all()
    time.sleep(0.5)
    assert toolset(console, ts["id"])["runtime"]["state"] == "stopped"


def test_server_exits_by_itself_when_its_console_disappears(ieum_state):
    """콘솔이 강제 종료돼도 서버가 고아로 남아 포트를 쥐고 있지 않게 한다."""
    data = manifest.build({"id": "ts-orphan", "slug": "orphan", "name": "고아"}, "v1.0", [], {})
    path = ieum_state / "orphan.json"
    manifest.write(path, data)
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    # 중간 프로세스가 서버를 띄우고 먼저 끝난다. 서버의 부모가 사라지는 상황이다.
    launcher = textwrap.dedent("""
        import os, subprocess, sys
        p = subprocess.Popen([sys.executable, "-m", "app.ieum.runtime.server", "--manifest", sys.argv[1], "--port", sys.argv[2], "--parent", str(os.getpid())],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        print(p.pid, flush=True)
        import time; time.sleep(60)
    """)
    proc = subprocess.Popen([sys.executable, "-c", launcher, str(path), str(port)], cwd=BACKEND, stdout=subprocess.PIPE, text=True,
                            env=dict(os.environ, IEUM_STATE_DIR=str(ieum_state)))
    child = int(proc.stdout.readline())
    try:
        wait_for(lambda: port_open(port), timeout=30)                      # 서버가 뜬다
        proc.kill()                                                         # 부모가 사라진다
        proc.wait()
        wait_for(lambda: not alive(child) and not port_open(port), timeout=10)
    finally:
        if alive(child):
            os.kill(child, signal.SIGKILL)


# ------------------------------------------------------------------ MCP 프로토콜 (프로세스 없이)
def _dep(tools=()):
    data = manifest.build({"id": "ts-p", "slug": "p", "name": "P"}, "v2.3", list(tools), {"s": {"id": "s", "name": "S", "proto": "rest", "base": "http://x"}})
    return protocol.Deployment(manifest.validate(data))


@pytest.fixture
def key(ieum_state):
    import hashlib
    secret = "ieum_sk_unit"
    deploy_repo.keys.save([{"id": "k1", "name": "단위", "key": "x", "hash": hashlib.sha256(secret.encode()).hexdigest(), "created": "-", "last": "사용 전", "on": True, "toolsets": []}])
    return {"Authorization": "Bearer " + secret}


def rpc(dep, headers, body):
    raw = body if isinstance(body, bytes) else json.dumps(body).encode()
    status, out, extra = protocol.handle(dep, headers, raw)
    return status, out, extra


def test_protocol_negotiates_versions(key):
    dep = _dep()
    for asked, answered in (("2025-06-18", "2025-06-18"), ("2025-03-26", "2025-03-26"), ("2099-01-01", "2025-06-18"), (None, "2025-06-18")):
        out = rpc(dep, key, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": asked}})[1]
        assert out["result"]["protocolVersion"] == answered and out["result"]["serverInfo"] == {"name": "ieum-p", "version": "2.3"}


def test_protocol_rejects_what_it_cannot_serve(key):
    dep = _dep()
    assert rpc(dep, {}, {"jsonrpc": "2.0", "id": 1, "method": "ping"})[:1] == (401,)
    assert rpc(dep, {"Authorization": "Bearer nope"}, {"jsonrpc": "2.0", "id": 1, "method": "ping"})[2]["WWW-Authenticate"].startswith("Bearer")
    assert rpc(dep, dict(key, **{"MCP-Protocol-Version": "1999-01-01"}), {"jsonrpc": "2.0", "id": 1, "method": "ping"})[0] == 400
    assert rpc(dep, key, [{"jsonrpc": "2.0", "id": 1, "method": "ping"}])[0] == 400                # 배치는 받지 않는다
    assert rpc(dep, key, "{깨진".encode())[1]["error"]["code"] == -32700
    assert rpc(dep, key, {"jsonrpc": "2.0", "id": 1, "method": "ping", "params": [1]})[1]["error"]["code"] == -32602
    assert rpc(dep, key, {"jsonrpc": "2.0", "id": 1})[0] == 400                                      # method 가 없다
    assert rpc(dep, key, {"jsonrpc": "2.0", "id": 1, "method": "resources/list"})[1]["error"]["code"] == -32601


def test_protocol_notifications_and_ids(key):
    dep = _dep()
    assert rpc(dep, key, {"jsonrpc": "2.0", "method": "notifications/initialized"}) == (202, None, {})
    assert rpc(dep, key, {"jsonrpc": "2.0", "id": 4, "result": {}}) == (202, None, {})                # 클라이언트가 보내는 응답
    assert rpc(dep, key, {"jsonrpc": "2.0", "id": 0, "method": "ping"})[1] == {"jsonrpc": "2.0", "id": 0, "result": {}}   # id 0 도 요청이다
    assert rpc(dep, {"authorization": "bearer ieum_sk_unit"}, {"jsonrpc": "2.0", "id": "a", "method": "ping"})[0] == 200   # 헤더 이름과 스킴은 대소문자를 가리지 않는다


def test_protocol_key_scoped_to_other_toolset_is_forbidden(ieum_state):
    import hashlib
    deploy_repo.keys.save([{"id": "k2", "name": "남의 키", "key": "x", "hash": hashlib.sha256(b"s2").hexdigest(), "created": "-", "last": "-", "on": True, "toolsets": ["ts-other"]}])
    status, out, _ = rpc(_dep(), {"Authorization": "Bearer s2"}, {"jsonrpc": "2.0", "id": 1, "method": "ping"})
    assert status == 403 and out["error"]["code"] == -32003


# ------------------------------------------------------------------ 상태 파일을 프로세스 여럿이 함께 쓴다
@pytest.mark.skipif(os.geteuid() == 0, reason="root 는 쓰기 권한 검사를 받지 않는다")
def test_reads_still_work_where_the_state_folder_cannot_be_created(tmp_path, monkeypatch):
    """읽기 전용 배포에서 프로세스 간 락 파일을 못 만든다고 읽기까지 실패하면 안 된다."""
    ro = tmp_path / "ro"
    ro.mkdir()
    ro.chmod(0o500)
    monkeypatch.setenv("IEUM_STATE_DIR", str(ro / "ieum"))
    try:
        assert deploy_repo.toolsets.load() == []                               # 시드를 읽는다
    finally:
        ro.chmod(0o700)



def test_state_files_survive_concurrent_writers_in_other_processes(ieum_state):
    """서버 프로세스와 콘솔은 같은 호출 로그를 쓴다. 읽고-고쳐-쓰는 사이에 남의 기록을 덮어쓰면 안 된다."""
    code = textwrap.dedent("""
        import sys
        from app.ieum.repositories import logs
        for i in range(25):
            logs.append("mcp", "p%s_%d" % (sys.argv[1], i), "ok", 1, 1, "t")
    """)
    env = dict(os.environ, IEUM_STATE_DIR=str(ieum_state))
    procs = [subprocess.Popen([sys.executable, "-c", code, str(n)], cwd=BACKEND, env=env) for n in range(4)]
    assert [p.wait(timeout=120) for p in procs] == [0, 0, 0, 0]
    from app.ieum.repositories import logs
    assert len(logs.list_logs()) == 100                                    # 하나도 잃지 않았다

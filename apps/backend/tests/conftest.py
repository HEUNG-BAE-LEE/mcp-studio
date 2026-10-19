"""이음 테스트 공용 픽스처. 이음 테스트가 요청할 때만 동작한다."""
import atexit
import os
import shutil
import tempfile
import threading
import time

import httpx
import pytest
import uvicorn
from fastapi import FastAPI

# `app.main` 을 띄우는 다른 테스트가 개발자 PC 의 배포 기록(apps/backend/data/ieum)을 보고 MCP 서버를 띄우지 않게 한다.
# 복구를 시험하는 테스트는 deployer.restore_all() 을 직접 부른다.
os.environ.setdefault("IEUM_MCP_AUTORESTORE", "0")

# 상태 폴더를 쓰는 시험은 대개 ieum_state 로 임시 폴더를 받지만, 레거시 사이트 시험처럼 안 쓰는 쪽은 기본값(apps/backend/data/ieum)을 읽는다.
# 온톨로지 시연 DB(onto/demo/po.db)가 거기 있으면 레거시 사이트의 승인·마감이 그 DB 의 상태를 따라 판정돼, 시연을 써 본 PC 에서만 시험이 깨졌다.
# 그래서 시험 프로세스 전체의 기본 상태 폴더를 임시 폴더로 돌린다(끝나면 지운다). 환경변수가 이미 있어도 덮는다 — 시험은 개발자의 상태를 보지 않는다.
_TEST_STATE = tempfile.mkdtemp(prefix="ieum-test-state-")
atexit.register(shutil.rmtree, _TEST_STATE, ignore_errors=True)
os.environ["IEUM_STATE_DIR"] = _TEST_STATE


@pytest.fixture
def ieum_state(tmp_path, monkeypatch):
    """이음의 상태 파일(저장소, 인증 정보, 암호 키)을 임시 폴더로 돌린다.

    시드는 그대로 읽는다. 호출 한도 카운터도 비워, 앞선 테스트가 한도를 먹지 않게 한다.
    """
    from app.ieum.discovery import jobs
    from app.ieum.gateway import engine, runner, session_auth
    from app.ieum.routers import demo_legacy
    from app.ieum.runtime import supervisor

    path = tmp_path / "ieum-state"
    monkeypatch.setenv("IEUM_STATE_DIR", str(path))
    monkeypatch.delenv("IEUM_SECRET_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    # 개발자 PC 의 .env 에 진짜 키가 있어도(config 가 읽어 들인다) 시험이 진짜 모델을 부르지 않게 한다. 쓰는 시험이 직접 넣는다.
    for name in ("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_DEPLOYMENT"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(runner, "_RATE", {})
    monkeypatch.setattr(engine, "_TOKEN_CACHE", {})
    monkeypatch.setattr(session_auth, "_CACHE", {})
    demo_legacy.reset()                      # 시연용 레거시 사이트는 모듈 단위로 상태를 든다. 앞 테스트의 승인·저장이 남지 않게
    yield path
    jobs.stop(timeout=30)                    # 실패한 테스트가 돌려 둔 탐색이 다음 테스트의 상태 폴더에 쓰지 않게
    supervisor.shutdown()                    # 배포 테스트가 띄운 MCP 서버 프로세스를 남기지 않는다


@pytest.fixture
def ieum_server(ieum_state):
    """이음 라우터만 실은 앱을 진짜 포트에 띄워 주소를 돌려준다.

    변환 엔진이 HTTP 로 시연용 원본(/demo-origin)을 부르므로 TestClient 로는 모자란다.
    `app.main` 은 쓰지 않는다. 기동할 때 dev.db 를 시드하기 때문이다.
    """
    from app.ieum.routers import router

    live = FastAPI()
    live.include_router(router)
    server = uvicorn.Server(uvicorn.Config(live, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started:
        if time.time() > deadline:
            raise RuntimeError("테스트 서버가 10초 안에 뜨지 않았습니다.")
        time.sleep(0.02)
    port = server.servers[0].sockets[0].getsockname()[1]
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)


class Console:
    """콘솔 API({resultCode, resultMsg, resultData})와 배포한 MCP 서버를 부르는 도우미."""

    def __init__(self, base):
        self.base = base
        self.urls = {}                 # 묶음 주소 이름 -> 배포한 MCP 서버 주소 (http://127.0.0.1:<포트>/mcp)

    def api(self, method, path, body=None):
        r = httpx.request(method, self.base + "/api/ieum" + path, json=body, timeout=60)
        j = r.json()
        assert r.status_code == j["resultCode"], "HTTP 상태와 resultCode 가 같아야 한다"
        return j["resultCode"], j["resultData"] if j["resultCode"] < 400 else j["resultMsg"]

    def mcp(self, key, method, params=None, slug="hr", raw=None, content=None):
        """raw 는 JSON-RPC 본문을 통째로, content 는 JSON 이 아닌 바이트를 보낼 때 쓴다."""
        url, headers = self.urls[slug], {"Authorization": "Bearer " + key}
        if content is not None:
            r = httpx.post(url, headers=dict(headers, **{"Content-Type": "application/json"}), content=content, timeout=30)
        else:
            r = httpx.post(url, headers=headers, json=raw or {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}, timeout=30)
        return r.status_code, (r.json() if r.content else None)

    def connect_demo(self):
        st, d = self.api("POST", "/sources/connect/", {
            "mode": "rest", "name": "demo", "specUrl": self.base + "/demo-origin/openapi.json",
            "auth": {"type": "key", "key": "demo-key", "in": "header", "name": "X-API-KEY"}})
        assert st == 201
        return d

    def publish(self, ids, slug="hr", name="HR"):
        """도구를 공개하고 묶음을 만들어 배포한다. (배포한 묶음, 키 발급 응답)을 돌려준다."""
        for tid in ids:
            assert self.api("PUT", "/studio/%s/" % tid, {"status": "done"})[0] == 200
        st, ts = self.api("POST", "/deploy/toolsets/", {"name": name, "slug": slug, "tools": ids})
        assert st == 201
        st, deployed = self.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])
        assert st == 200, deployed
        self.urls[slug] = deployed["toolset"]["runtime"]["url"]
        st, key = self.api("POST", "/deploy/keys/", {"name": "t"})
        assert st == 201
        return deployed["toolset"], key


@pytest.fixture
def console(ieum_server):
    return Console(ieum_server)


# ── 온톨로지(2차) ──────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def onto_template(tmp_path_factory):
    """시연 환경(구매관리·인사 온톨로지, 마트, 공개 버전, 권한 규칙, 액션)을 세션에서 한 번 만들어 두고, 시험마다 복사해 쓴다. 만드는 데 1~2초 걸린다."""
    path = tmp_path_factory.mktemp("onto-template") / "state"
    mp = pytest.MonkeyPatch()
    mp.setenv("IEUM_STATE_DIR", str(path))
    mp.setenv("IEUM_ONTO_AUTOSERVE", "0")
    mp.delenv("IEUM_SECRET_KEY", raising=False)
    for name in ("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_DEPLOYMENT"):
        mp.delenv(name, raising=False)
    try:
        from app.ieum.onto import demo_setup
        demo_setup.load(legacy_base="http://127.0.0.1:1/demo-legacy/po")
        from app.ieum.onto import conn as dbconn
        dbconn.dispose_all()
    finally:
        mp.undo()
    return path


@pytest.fixture
def onto(ieum_state, onto_template, monkeypatch):
    """시연 환경이 들어 있는 상태 폴더. MCP 서버는 띄우지 않는다(띄우는 시험은 IEUM_ONTO_AUTOSERVE 를 직접 켠다)."""
    import shutil

    from app.ieum.onto import conn as dbconn, marts, reader
    monkeypatch.setenv("IEUM_ONTO_AUTOSERVE", "0")
    dbconn.dispose_all()
    reader.forget_cache()
    shutil.copytree(onto_template, ieum_state, dirs_exist_ok=True)
    yield ieum_state
    dbconn.dispose_all()
    marts.stop_scheduler()
    from app.ieum.onto import mcp
    for cid in list(mcp.deploys.load()):
        mcp.remove(cid)

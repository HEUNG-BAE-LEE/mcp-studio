"""이음 테스트 공용 픽스처. 이음 테스트가 요청할 때만 동작한다."""
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI


@pytest.fixture
def ieum_state(tmp_path, monkeypatch):
    """이음의 상태 파일(저장소, 인증 정보, 암호 키)을 임시 폴더로 돌린다.

    시드는 그대로 읽는다. 호출 한도 카운터도 비워, 앞선 테스트가 한도를 먹지 않게 한다.
    """
    from app.ieum.discovery import jobs
    from app.ieum.gateway import engine, runner, session_auth
    from app.ieum.routers import demo_legacy

    path = tmp_path / "ieum-state"
    monkeypatch.setenv("IEUM_STATE_DIR", str(path))
    monkeypatch.delenv("IEUM_SECRET_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(runner, "_RATE", {})
    monkeypatch.setattr(engine, "_TOKEN_CACHE", {})
    monkeypatch.setattr(session_auth, "_CACHE", {})
    demo_legacy.reset()                      # 시연용 레거시 사이트는 모듈 단위로 상태를 든다. 앞 테스트의 승인·저장이 남지 않게
    yield path
    jobs.stop(timeout=30)                    # 실패한 테스트가 돌려 둔 탐색이 다음 테스트의 상태 폴더에 쓰지 않게


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

"""배포한 도구 묶음을 서빙하는 MCP 서버 프로세스.

    python -m app.ieum.runtime.server --manifest <manifest.json> --port 8101 [--host 127.0.0.1] [--parent <pid>]

콘솔의 supervisor 가 띄운다. 스냅샷 파일이 바뀌면 다음 요청부터 새 정의로 답한다 — 새 버전을 배포할 때
서버를 내렸다 올리지 않으며, 그 사이 AI 앱의 요청이 끊기지 않는다. `--parent` 를 주면 그 프로세스가 사라질 때
스스로 끝난다(콘솔이 강제 종료돼도 서버가 고아로 남지 않게).

접속은 이 컴퓨터(127.0.0.1)에서만 받고, 액세스 키(Bearer)가 있어야 쓸 수 있다. `/health` 만 키 없이 열려 있다.
"""
import argparse
import copy
import logging
import os
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

import uvicorn
from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response

from app.ieum.runtime import manifest, protocol

log = logging.getLogger("ieum.mcp")

LOCAL_HOSTS = ("localhost", "127.0.0.1", "::1")


class LiveManifest:
    """스냅샷 파일을 들고 있다가, 파일이 바뀌었으면 요청이 올 때 다시 읽는다.

    새 파일이 깨져 있으면 이전 정의로 계속 답하고 오류를 /health 에 남긴다. 배포하는 쪽이 그걸 보고 실패로 처리한다.
    """

    def __init__(self, path) -> None:
        self.path = Path(path)
        self.error = None
        self._lock = threading.Lock()
        self._sig = None
        self._dep = None
        self._read(self._signature())       # 처음 읽기에 실패하면 서버가 뜨지 않는다

    def _signature(self):
        st = self.path.stat()
        return (st.st_mtime_ns, st.st_size, st.st_ino)      # 바꿔치기(os.replace)하면 inode 가 바뀐다

    def _read(self, sig) -> None:
        self._dep = protocol.Deployment(manifest.load(self.path))
        self._sig, self.error = sig, None

    def current(self) -> protocol.Deployment:
        try:
            sig = self._signature()
        except OSError:
            return self._dep                # 파일이 잠깐 안 보이면 지금 정의를 그대로 쓴다
        if sig != self._sig:
            with self._lock:
                if sig != self._sig:
                    try:
                        self._read(sig)
                        log.info("새 버전을 불러왔습니다: %s (도구 %d개)", self._dep.version, len(self._dep.tools))
                    except (OSError, ValueError) as e:
                        self._sig, self.error = sig, str(e)     # 같은 깨진 파일을 요청마다 다시 읽지 않는다
                        log.error("새 스냅샷을 불러오지 못해 이전 버전으로 계속 답합니다: %s", e)
        return self._dep


def _origin_ok(origin: str) -> bool:
    """브라우저가 보낸 Origin 이 이 컴퓨터가 아니면 막는다(DNS 리바인딩). Origin 이 없는 AI 앱 요청은 그대로 받는다."""
    if not origin:
        return True
    allowed = [o.strip() for o in os.environ.get("IEUM_MCP_ALLOWED_ORIGINS", "").split(",") if o.strip()]
    return origin in allowed or (urlsplit(origin).hostname or "") in LOCAL_HOSTS


def build_app(manifest_path) -> FastAPI:
    live = LiveManifest(manifest_path)
    started = time.time()
    app = FastAPI(title="이음 MCP 서버", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.live = live

    @app.get("/health")
    def health() -> dict:
        dep = live.current()
        out = {"service": "ieum-mcp", "toolset": dep.toolset["id"], "version": dep.version, "tools": len(dep.tools),
               "pid": os.getpid(), "startedAt": started}
        if live.error:
            out["loadError"] = live.error
        return out

    # 끝 슬래시가 있어도 없어도 받는다. 리다이렉트를 따라가지 않는 POST 클라이언트가 있다.
    @app.api_route("/mcp", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
    @app.api_route("/mcp/", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
    async def mcp_endpoint(request: Request):
        if not _origin_ok(request.headers.get("origin", "")):
            return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "허용하지 않는 Origin 입니다."}}, status_code=403)
        if request.method == "OPTIONS":
            return Response(status_code=204)
        if request.method == "GET":         # 서버가 먼저 보내는 스트림은 쓰지 않는다
            return Response(status_code=405, headers={"Allow": "POST, OPTIONS"})
        status, body, headers = await run_in_threadpool(protocol.handle, live.current(), request.headers, await request.body())
        return JSONResponse(body, status_code=status, headers=headers) if body is not None else Response(status_code=status, headers=headers)

    return app


class _SkipHealth(logging.Filter):
    """띄우는 쪽이 0.15초마다 두드리는 /health 는 접근 로그에 남기지 않는다. 진짜 요청이 묻힌다."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        return not (isinstance(args, tuple) and len(args) >= 3 and str(args[2]).split("?")[0] == "/health")


def _log_config() -> dict:
    """uvicorn 기본 로그에 시각을 붙이고 색을 뺀다. 파일로 남겨 콘솔에서 보여 주는 로그라 둘 다 필요하다."""
    cfg = copy.deepcopy(uvicorn.config.LOGGING_CONFIG)
    cfg["filters"] = {"skip_health": {"()": _SkipHealth}}
    cfg["handlers"]["access"]["filters"] = ["skip_health"]
    cfg["formatters"]["default"].update(fmt="%(asctime)s %(levelprefix)s %(message)s", datefmt="%H:%M:%S", use_colors=False)
    cfg["formatters"]["access"].update(fmt='%(asctime)s %(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s', datefmt="%H:%M:%S", use_colors=False)
    cfg["loggers"]["ieum.mcp"] = {"handlers": ["default"], "level": "INFO", "propagate": False}
    return cfg


def _watch_parent(parent: int, server: uvicorn.Server) -> None:
    """부모(콘솔)가 사라지면 -- 부모가 바뀌면 init 에 입양된다 -- 서버를 내린다."""
    while not server.should_exit:
        time.sleep(1.0)
        if os.getppid() != parent:
            log.warning("콘솔 프로세스가 사라져 서버를 종료합니다.")
            server.should_exit = True


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="이음 MCP 서버")
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--parent", type=int, default=0, help="이 프로세스가 사라지면 서버도 끝낸다")
    args = ap.parse_args(argv)

    try:
        app = build_app(args.manifest)
    except (OSError, ValueError) as e:
        print("서버를 시작하지 못했습니다: %s" % e, file=sys.stderr)
        return 2

    config = uvicorn.Config(app, host=args.host, port=args.port, log_config=_log_config(), timeout_graceful_shutdown=5)
    server = uvicorn.Server(config)
    if args.parent:
        threading.Thread(target=_watch_parent, args=(args.parent, server), daemon=True).start()
    dep = app.state.live.current()
    log.info("MCP 서버를 시작합니다: %s %s, 도구 %d개, http://%s:%d/mcp (pid %d)", dep.toolset["id"], dep.version, len(dep.tools), args.host, args.port, os.getpid())
    server.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""관리 콘솔(apps/web/ieum, 빌드 없는 바닐라 JS)을 `/ieum/` 에 정적으로 올린다."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.ieum import config


def mount_console(app: FastAPI) -> None:
    """관리자 화면을 `/` 에 올리는 마운트(main.py 맨 아래)보다 먼저 불러야 한다.

    `/` 마운트가 앞서면 `/ieum/` 요청을 그쪽이 삼킨다. 콘솔 디렉터리가 없는 배포
    (컨테이너)에서는 조용히 건너뛴다. 로컬 개발에서만 쓰는 화면이기 때문이다.
    """
    root = config.web_root()
    if root.is_dir():
        app.mount("/ieum", StaticFiles(directory=root, html=True), name="ieum-console")

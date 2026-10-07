"""이음 콘솔 데이터 저장소.

메뉴별 `data/<메뉴>/<이름>.json` 을 시드로 읽고, 변경분은 `<state_dir>/<메뉴>.<이름>.json` 에
덮어써서 보관한다. (DB 연동 전까지 쓰는 파일 기반 저장소)
"""
import copy
import json
import os
import threading
from pathlib import Path

from app.ieum.config import DATA_DIR, state_dir

try:
    import fcntl
except ImportError:                 # 윈도우: 프로세스 간 락 없이 스레드 락만 쓴다. 로컬 프로세스 배포는 POSIX 만 지원한다
    fcntl = None


class _StoreLock:
    """스레드 락과 프로세스 간 파일 락을 겹쳐 쓴다. 같은 스레드에서는 여러 번 잡아도 된다.

    배포한 MCP 서버는 콘솔과 다른 프로세스인데, 호출 로그와 키 사용 시각을 같은 파일에 쓴다.
    스레드 락만으로는 두 프로세스가 같은 파일을 읽고-고쳐-쓰는 사이에 서로의 변경을 덮어쓴다.
    (폐기한 키가 마지막 사용 시각을 쓰는 프로세스 때문에 되살아나는 식이다.)
    읽고-고쳐-쓰는 구간은 `with LOCK:` 으로 감싸야 한다. load/save 하나씩은 알아서 잡는다.
    """

    def __init__(self) -> None:
        self._thread = threading.RLock()
        self._depth = 0
        self._fd = None

    def __enter__(self) -> "_StoreLock":
        self._thread.acquire()
        try:
            if self._depth == 0 and fcntl is not None:
                self._fd = self._lock_file()
            self._depth += 1
        except BaseException:
            self._thread.release()
            raise
        return self

    @staticmethod
    def _lock_file():
        """상태 폴더의 락 파일을 열어 잠근다. 상태 폴더는 테스트가 바꿔 끼우므로 가장 바깥에서 잡을 때마다 지금 폴더를 쓴다.

        폴더를 만들 수 없는 곳(읽기 전용 배포)에서는 프로세스 간 락 없이 스레드 락만 쓴다. 읽기까지 실패시키지 않는다.
        """
        try:
            state_dir().mkdir(parents=True, exist_ok=True)
            fd = os.open(state_dir() / ".store.lock", os.O_RDWR | os.O_CREAT, 0o600)
        except OSError:
            return None
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
        except BaseException:
            os.close(fd)
            raise
        return fd

    def __exit__(self, *exc) -> None:
        try:
            self._depth -= 1
            if self._depth == 0 and self._fd is not None:
                fd, self._fd = self._fd, None
                try:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                finally:
                    os.close(fd)
        finally:
            self._thread.release()


# 핸들러는 스레드풀에서 돈다. 파일을 읽고 쓰는 구간은 한 번에 하나만 들어간다.
LOCK = _StoreLock()


class JsonStore:
    def __init__(self, menu: str, name: str):
        self.menu, self.name = menu, name
        self.seed_path = DATA_DIR / menu / f"{name}.json"

    @property
    def state_path(self) -> Path:
        return state_dir() / f"{self.menu}.{self.name}.json"

    def load(self):
        """저장된 값이 있으면 그것을, 없으면 시드를 복사해서 돌려준다."""
        with LOCK:
            path = self.state_path if self.state_path.exists() else self.seed_path
            with open(path, encoding="utf-8") as f:
                return copy.deepcopy(json.load(f))

    def save(self, data) -> None:
        with LOCK:
            state_dir().mkdir(parents=True, exist_ok=True)
            tmp = self.state_path.with_name(self.state_path.name + ".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            os.replace(tmp, self.state_path)

    def reset(self) -> None:
        with LOCK:
            if self.state_path.exists():
                self.state_path.unlink()

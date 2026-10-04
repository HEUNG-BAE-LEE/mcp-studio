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

# 핸들러는 스레드풀에서 돈다. 파일을 읽고 쓰는 구간은 한 번에 하나만 들어간다.
LOCK = threading.RLock()


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

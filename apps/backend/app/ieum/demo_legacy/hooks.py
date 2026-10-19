"""시연 레거시 사이트가 상태를 바꿀 때 바깥에 알리는 자리.

이음 온톨로지 시연(onto/legacy_sync.py)이 같은 값을 자기 시연 DB(SQLite)에도 쓰려고 쓴다. 등록하지 않으면 아무 일도 없다 —
자동 탐색 시험처럼 온톨로지를 쓰지 않는 쪽은 이 파일이 있는 줄도 모른다. 운영(op) 환경에서만 부른다.
"""
from typing import Callable, Dict, Optional

_HOOKS = {}  # type: Dict[str, Callable]


def register(name: str, fn: Optional[Callable]) -> None:
    if fn is None:
        _HOOKS.pop(name, None)
    else:
        _HOOKS[name] = fn


def call(name: str, env: str, *args, default=None):
    """등록된 후크가 있으면 부르고 그 값을, 없으면 default 를 돌려준다. 후크의 오류는 사이트를 깨지 않도록 삼킨다."""
    fn = _HOOKS.get(name)
    if fn is None or env != "op":
        return default
    try:
        return fn(*args)
    except Exception:  # noqa: BLE001 — 시연 보조 장치라서 본 기능을 막지 않는다
        return default

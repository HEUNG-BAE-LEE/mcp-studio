"""업무 기록의 운영 기본값. 부를 때마다 환경변수를 읽는다(시험이 값을 바꿔 끼운다)."""
import os
from typing import List


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def max_sessions() -> int:
    """서버 전체 동시 기록. 기록 하나가 Chromium 하나를 띄운다(수백 MB)."""
    return _int("IEUM_RECORDER_MAX_SESSIONS", 4)


def max_per_owner() -> int:
    return _int("IEUM_RECORDER_MAX_PER_OWNER", 1)


def idle_sec() -> int:
    return _int("IEUM_RECORDER_IDLE_SEC", 600)


def max_sec() -> int:
    return _int("IEUM_RECORDER_MAX_SEC", 1800)


def shot_days() -> int:
    return _int("IEUM_RECORDER_SHOT_DAYS", 7)


def deny_entries() -> List[str]:
    """항상 차단에 더할 호스트·CIDR. 회사마다 막아야 할 관리 대역이 다르다."""
    return [x.strip() for x in os.environ.get("IEUM_RECORDER_DENY", "").split(",") if x.strip()]

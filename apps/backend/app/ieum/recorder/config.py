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


def is_staging(env) -> bool:
    """스테이징 환경인가. 기록은 "stg" 로 저장하지만 예전 표기 "staging" 도 받는다(두 표기가 갈려 쓰기를 막은 적이 있다)."""
    return env in ("stg", "staging")


def deny_entries() -> List[str]:
    """항상 차단에 더할 호스트·CIDR. 회사마다 막아야 할 관리 대역이 다르다."""
    return [x.strip() for x in os.environ.get("IEUM_RECORDER_DENY", "").split(",") if x.strip()]


# 승인을 묻지 않고 막는 외부 통계(beacon) 호스트. 앞의 "*." 는 있어도 없어도 같다(끝 점 경계 접미 일치).
BEACON_HOSTS = ("google-analytics.com", "analytics.google.com", "doubleclick.net", "www.googletagmanager.com",
                "wcs.naver.net", "wcs.naver.com", "stats.wp.com", "bat.bing.com", "clarity.ms")
# *.google.com 은 아래 경로일 때만 통계로 본다(검색·로그인 같은 일반 요청을 막지 않는다)
BEACON_GOOGLE_PATHS = ("/g/collect", "/j/collect", "/collect", "/r/collect")


def beacon_hosts() -> List[str]:
    """기본 목록에 환경변수 IEUM_RECORDER_BEACON_HOSTS(쉼표 목록)를 덧붙인다."""
    extra = [x.strip().lower().lstrip("*.").rstrip(".") for x in os.environ.get("IEUM_RECORDER_BEACON_HOSTS", "").split(",") if x.strip()]
    return list(BEACON_HOSTS) + [x for x in extra if x]


# 기록 종료 때 이미 나간 쓰기를 기다리는 상한과 마지막 쓰기 뒤 조용해야 하는 시간(설계 3판 8절). 시험이 값을 바꿔 끼운다
STOP_WRITE_WAIT_SEC = 60.0
STOP_QUIET_SEC = 1.5

"""탐색 설정 검증. 화면이 보낸 값을 믿지 않고 여기서 정리한다.

비밀번호와 토큰은 설정에 남기지 않는다. 호출 측이 암호화 금고(gateway/credentials)에 따로 넣는다.
"""
import json
import re
import time
from pathlib import Path
from typing import Tuple
from urllib.parse import urljoin, urlsplit

from app.ieum.config import DATA_DIR

FRAMEWORKS = ("auto", "spring", "express", "fastapi")
MAX_PAGES_LIMIT = 200


def default_ban() -> list:
    return json.loads((DATA_DIR / "sources" / "ban_words.json").read_text(encoding="utf-8"))


def _bool(v) -> bool:
    return v is True or v == "true" or v == 1


def _int(v, default: int, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return default


def next_start(hhmm: str, now: float = None) -> float:
    """오늘의 HH:MM. 이미 지났으면 내일의 HH:MM. 서버의 로컬 시각 기준이다."""
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", (hhmm or "").strip())
    if not m or int(m.group(1)) > 23 or int(m.group(2)) > 59:
        raise ValueError("예약 시각은 HH:MM 형식으로 입력해 주세요.")
    now = now or time.time()
    lt = time.localtime(now)
    at = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, int(m.group(1)), int(m.group(2)), 0, 0, 0, -1))
    return at if at > now else at + 24 * 3600


def clean(raw: dict) -> Tuple[dict, dict]:
    """(설정, 비밀). 잘못된 입력은 ValueError 로 알린다. 메시지는 화면에 그대로 보인다."""
    raw = raw or {}
    git, crawl = _bool(raw.get("git")), _bool(raw.get("crawl"))
    if not git and not crawl:
        raise ValueError("Git 소스 분석과 운영 화면 탐색 중 하나는 켜야 합니다.")
    if not _bool(raw.get("approved")):
        raise ValueError("운영 시스템 담당자의 탐색 승인을 받았는지 확인해 주세요.")
    owner = (raw.get("owner") or "").strip()
    if not owner:
        raise ValueError("승인해 준 담당자를 입력해 주세요.")

    opts = {"git": git, "crawl": crawl, "owner": owner, "approved": True, "mask": raw.get("mask") is not False,
            "name": (raw.get("name") or "").strip()[:60], "ban": [str(w).strip() for w in (raw.get("ban") or []) if str(w).strip()][:40],
            "maxPages": _int(raw.get("maxPages"), 50, 1, MAX_PAGES_LIMIT), "maxDepth": _int(raw.get("maxDepth"), 4, 1, 8),
            "delayMs": _int(raw.get("delayMs"), 900, 0, 10_000), "maxSeconds": _int(raw.get("maxSeconds"), 600, 30, 1800),
            "account": (raw.get("account") or "").strip(), "scope": (raw.get("scope") or "").strip(), "exclude": (raw.get("exclude") or "").strip(),
            "readPost": (raw.get("readPost") or "").strip()}

    base = (raw.get("base") or "").strip().rstrip("/")
    if crawl or raw.get("stg"):
        if not re.match(r"^https?://[^\s/]+", base):
            raise ValueError("운영 주소는 http:// 또는 https:// 로 시작해야 합니다.")
    opts["base"] = base
    if base:
        start = (raw.get("start") or "/").strip() or "/"
        opts["start"] = start if re.match(r"^https?://", start) else urljoin(base + "/", start.lstrip("/"))
        if urlsplit(opts["start"]).netloc != urlsplit(base).netloc:
            raise ValueError("시작 페이지는 운영 주소와 같은 서버여야 합니다.")
    if git:
        opts["repo"] = (raw.get("repo") or "").strip()
        if not opts["repo"]:
            raise ValueError("Git 저장소 주소(또는 허용된 로컬 경로)를 입력해 주세요.")
        opts["branch"] = (raw.get("branch") or "").strip()
        fw = (raw.get("framework") or "auto").strip().lower()
        opts["framework"] = fw if fw in FRAMEWORKS else "auto"
    stg = git and _bool(raw.get("stg"))
    opts["stg"] = stg
    if stg:
        opts["stgUrl"] = (raw.get("stgUrl") or "").strip().rstrip("/")
        if not re.match(r"^https?://[^\s/]+", opts["stgUrl"]):
            raise ValueError("스테이징 주소는 http:// 또는 https:// 로 시작해야 합니다. 검증하지 않으려면 스테이징 검증을 꺼 주세요.")
        if opts["stgUrl"] == base:
            raise ValueError("스테이징 주소가 운영 주소와 같습니다. 쓰기 API 는 운영에서 검증하지 않습니다.")
    opts["when"] = "at" if raw.get("when") == "at" else "now"
    if opts["when"] == "at":
        opts["startTime"] = (raw.get("startTime") or "").strip()
        opts["startAt"] = next_start(opts["startTime"])
    secrets = {"username": opts["account"], "password": raw.get("password") or "", "token": raw.get("token") or ""}
    return opts, secrets

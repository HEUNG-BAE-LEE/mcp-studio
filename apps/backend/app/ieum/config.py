"""이음 설정: 경로와 환경변수.

Django 시절 settings 에서 이음이 실제로 쓰는 값만 옮겼다. 환경변수는 쓰는 순간에
읽는다. 테스트가 값을 바꿔 끼우고, `.env` 를 늦게 읽는 경우에도 맞기 때문이다.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]   # apps/backend
DATA_DIR = Path(__file__).resolve().parent / "data"  # 메뉴별 시드 JSON

# routers/llm.py 와 같은 .env. 이미 읽혔으면 아무 일도 하지 않는다.
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_CHAT_MODEL = "claude-sonnet-5-5"


def state_dir() -> Path:
    """시드에서 바뀐 값을 쌓는 곳. `apps/backend/data/` 아래라 git 에서 빠진다."""
    return Path(os.environ.get("IEUM_STATE_DIR") or BACKEND_DIR / "data" / "ieum").resolve()


def web_root() -> Path:
    """관리 콘솔 정적 파일. 컨테이너처럼 `apps/web` 이 없는 곳에서는 존재하지 않는다."""
    return Path(os.environ.get("IEUM_WEB_ROOT") or BACKEND_DIR.parent / "web" / "ieum").resolve()


def anthropic_key() -> str:
    """자연어 테스트와 도구 설명 다시 쓰기에 쓴다. 없으면 그 기능만 꺼진다."""
    return os.environ.get("ANTHROPIC_API_KEY", "")


def chat_model() -> str:
    return os.environ.get("IEUM_CHAT_MODEL") or DEFAULT_CHAT_MODEL

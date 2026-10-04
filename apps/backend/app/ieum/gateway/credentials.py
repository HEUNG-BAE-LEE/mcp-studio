"""원본 시스템 인증 정보 보관. Fernet 으로 암호화해 파일에 저장한다.

암호 키는 `IEUM_SECRET_KEY` 환경변수에서 얻는다. 없으면 처음 쓸 때 무작위로 만들어
상태 디렉터리(`.secret_key`, 0600)에 둔다. Django 시절에는 settings 의 SECRET_KEY 에서
뽑았는데, 그 값이 소스에 박혀 있어 저장소를 본 사람이면 누구나 풀 수 있었다.
"""
import base64
import hashlib
import json
import os
import secrets

from cryptography.fernet import Fernet

from app.ieum.config import state_dir
from app.ieum.store import LOCK


def _secret_key() -> bytes:
    env = os.environ.get("IEUM_SECRET_KEY")
    if env:
        return env.encode("utf-8")
    path = state_dir() / ".secret_key"
    with LOCK:
        if not path.exists():
            state_dir().mkdir(parents=True, exist_ok=True)
            # 0600 으로 만든 뒤 쓴다. 쓰고 나서 권한을 줄이면 그 사이에 읽힌다.
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write(secrets.token_urlsafe(48))
        return path.read_text().strip().encode("utf-8")


def _fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(_secret_key()).digest()))


def _path():
    return state_dir() / "source_secrets.enc"


def _load_all() -> dict:
    if not _path().exists():
        return {}
    return json.loads(_fernet().decrypt(_path().read_bytes()).decode("utf-8"))


def _save_all(data: dict) -> None:
    state_dir().mkdir(parents=True, exist_ok=True)
    fd = os.open(_path(), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(_fernet().encrypt(json.dumps(data).encode("utf-8")))


def get(source_id):
    with LOCK:
        return _load_all().get(source_id, {})


def put(source_id, cred):
    with LOCK:
        data = _load_all()
        data[source_id] = cred
        _save_all(data)


def delete(source_id):
    with LOCK:
        data = _load_all()
        if data.pop(source_id, None) is not None:
            _save_all(data)

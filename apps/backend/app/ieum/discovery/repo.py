"""분석할 소스 저장소를 준비한다: git 으로 내려받거나, 허용된 로컬 디렉터리를 그대로 쓴다.

소스는 분석이 끝나면 지운다("읽기 전용 토큰만 쓰고 소스는 남기지 않는다"). 토큰은 명령줄 인자나
URL 에 넣지 않고 git 설정 환경변수로 넘긴다 — 인자는 `ps` 에 보인다.
"""
import base64
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, List, Optional, Tuple

CLONE_TIMEOUT = 180
# git 이 지원하는 전송 방식 중 임의 명령을 실행할 수 있는 `ext::` 같은 것은 받지 않는다.
_URL_OK = re.compile(r"^(https?://[^\s]+|ssh://[^\s]+|git@[\w.\-]+:[^\s]+)$")
_SKIP_DIRS = {".git", "node_modules", "target", "build", "dist", "out", ".gradle", ".idea", "__pycache__", ".venv", "venv"}

DEMO_ROOT = Path(__file__).resolve().parent.parent / "demo_legacy"


class SourceError(RuntimeError):
    """소스를 준비하지 못했다. 메시지는 화면에 그대로 보인다."""


def allowed_local_roots() -> List[Path]:
    """로컬 경로로 분석할 수 있는 곳. 번들된 시연용 소스와 IEUM_LOCAL_REPO_ROOTS 로 지정한 곳뿐이다.

    서버가 아무 디렉터리나 읽게 두면 콘솔에 접속한 누구나 서버의 파일에서 코드 조각을 꺼내 갈 수 있다.
    """
    roots = [DEMO_ROOT.resolve()]
    for raw in os.environ.get("IEUM_LOCAL_REPO_ROOTS", "").split(os.pathsep):
        if raw.strip():
            roots.append(Path(raw.strip()).expanduser().resolve())
    return roots


def _is_local(spec: str) -> bool:
    return spec.startswith(("/", "~", "./", "../", "file://")) or bool(re.match(r"^[A-Za-z]:[\\/]", spec))


def count_files(root: Path) -> int:
    n = 0
    for _dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        n += len(files)
    return n


def _scrub(text: str, secret: str) -> str:
    return text.replace(secret, "••••••••") if secret else text


def prepare(repo: str, branch: str = "", token: str = "", cancelled: Optional[Callable[[], bool]] = None) -> Tuple[Path, Callable[[], None], str]:
    """(소스 루트, 정리 함수, 사람이 읽는 이름)."""
    repo = (repo or "").strip()
    if not repo:
        raise SourceError("저장소 주소를 입력해 주세요.")
    if _is_local(repo):
        path = Path(repo[7:] if repo.startswith("file://") else repo).expanduser().resolve()
        if not path.is_dir():
            raise SourceError(f"디렉터리를 찾을 수 없습니다: {path}")
        if not any(path == r or r in path.parents for r in allowed_local_roots()):
            raise SourceError("이 서버에서 읽도록 허용한 디렉터리가 아닙니다. 서버 환경변수 IEUM_LOCAL_REPO_ROOTS 에 상위 폴더를 추가해 주세요.")
        return path, (lambda: None), path.name
    if repo.startswith("-") or not _URL_OK.match(repo):
        raise SourceError("저장소 주소는 https://, ssh://, git@ 형식이어야 합니다.")
    if not shutil.which("git"):
        raise SourceError("서버에 git 이 설치되어 있지 않아 저장소를 내려받을 수 없습니다.")

    dest = Path(tempfile.mkdtemp(prefix="ieum-src-"))
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GIT_ASKPASS="true", GCM_INTERACTIVE="never")
    if token and repo.startswith("http"):
        cred = base64.b64encode(f"x-access-token:{token}".encode()).decode()
        env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="http.extraheader", GIT_CONFIG_VALUE_0=f"AUTHORIZATION: basic {cred}")
    cmd = ["git", "clone", "--depth", "1", "--single-branch"]
    if branch.strip():
        cmd += ["--branch", branch.strip()]
    cmd += ["--", repo, str(dest / "src")]

    def cleanup() -> None:
        shutil.rmtree(dest, ignore_errors=True)

    try:
        done = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=CLONE_TIMEOUT)
    except subprocess.TimeoutExpired:
        cleanup()
        raise SourceError(f"저장소를 {CLONE_TIMEOUT}초 안에 내려받지 못했습니다.")
    if done.returncode != 0:
        cleanup()
        err = _scrub(done.stderr, token).strip().splitlines()
        hint = next((l for l in reversed(err) if l.strip()), "알 수 없는 오류")
        low = done.stderr.lower()
        if "authentication" in low or "could not read" in low or "403" in low or "401" in low:
            raise SourceError("저장소에 접근하지 못했습니다. 주소와 읽기 전용 토큰을 확인해 주세요.")
        if "remote branch" in low and "not found" in low:
            raise SourceError(f"브랜치 \"{branch}\" 를 찾을 수 없습니다.")
        if "not found" in low or "does not exist" in low:
            raise SourceError("저장소를 찾을 수 없습니다. 주소를 확인해 주세요.")
        raise SourceError(f"저장소를 내려받지 못했습니다. ({hint[:160]})")
    return dest / "src", cleanup, Path(repo.rstrip("/").removesuffix(".git")).name or repo

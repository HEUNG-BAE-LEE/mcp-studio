"""소스 저장소 읽기: 디렉터리 순회, 인코딩 판별, 크기 제한.

분석 대상이 아닌 곳(빌드 산출물, 의존성, 테스트)을 여기서 걸러 낸다. 걸러 내지 않으면 테스트에 있는
가짜 매핑이나 `target/` 에 복사된 매퍼 XML 이 실제 API 처럼 섞여 들어온다.
"""
import os
from pathlib import Path
from typing import Callable, Dict, List, Optional

# 1MB 를 넘는 파일은 번들·덤프일 가능성이 높고 분석 시간만 잡아먹는다.
MAX_BYTES = 1024 * 1024

# 소스가 아닌 디렉터리. 점으로 시작하는 폴더(.git .idea .gradle .venv ...)는 아래에서 한꺼번에 뺀다.
SKIP_DIRS = frozenset({"node_modules", "__pycache__", "venv", "site-packages", "dist-packages"})
# 빌드 산출물 폴더. 자바 패키지 이름(com.x.build, com.x.out)과 겹칠 수 있어 `src` 아래에서는 건너뛰지 않는다.
BUILD_DIRS = frozenset({"target", "build", "out", "dist"})
# JS/Py 테스트 폴더. 자바 패키지 이름과 겹치므로 디렉터리째 건너뛰지 않고 파일 단위로 거른다.
TEST_DIRS = frozenset({"test", "tests", "__tests__"})

SCRIPT_EXT = frozenset({".js", ".ts", ".mjs", ".cjs"})
SOURCE_EXT = frozenset({".java", ".xml", ".py"}) | SCRIPT_EXT


class SourceFile:
    """읽을 소스 파일 하나. 내용은 처음 쓸 때 읽고 디코딩한다."""

    __slots__ = ("rel", "path", "ext", "name", "size", "_text")

    def __init__(self, rel: str, path: Path, size: int):
        self.rel = rel                      # 저장소 루트 기준, POSIX 구분자
        self.path = path
        self.size = size
        self.name = rel.rsplit("/", 1)[-1]
        self.ext = _ext_of(self.name)
        self._text: Optional[str] = None

    @property
    def text(self) -> str:
        if self._text is None:
            try:
                self._text = decode(self.path.read_bytes())
            except OSError:
                self._text = ""
        return self._text

    def release(self) -> None:
        """분석이 끝난 파일의 본문을 놓는다. 큰 저장소에서 메모리를 오래 쥐지 않으려는 것."""
        self._text = None


def _ext_of(name: str) -> str:
    if name.endswith((".gradle", ".gradle.kts")):
        return ".gradle"
    return os.path.splitext(name)[1].lower()


def decode(raw: bytes) -> str:
    """UTF-8 을 먼저 보고, 안 되면 cp949(EUC-KR 상위). 한국 레거시 소스는 EUC-KR 이 흔하다.

    줄바꿈은 \\n 으로 통일한다. 스니펫에 \\r 이 남으면 JSON 으로 내보낼 때 거슬리고, 줄 번호 계산도 한 가지로 끝난다.
    """
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = raw.decode("cp949")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="replace")
    if "\r" in text:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text


class Repo:
    """분석 대상 파일 목록. 순회는 한 번만 하고, 프레임워크별 분석기가 확장자로 골라 쓴다."""

    def __init__(self, root: Path, should_cancel: Optional[Callable[[], bool]] = None):
        self.root = root
        self.files: List[SourceFile] = []
        self.big: List[str] = []            # 1MB 초과로 건너뛴 파일
        self.unreadable: List[str] = []     # 목록을 못 읽은 디렉터리
        self.cancelled = False
        self._walk(should_cancel)
        self.files.sort(key=lambda f: f.rel)
        self._by_name: Dict[str, List[SourceFile]] = {}
        for f in self.files:
            self._by_name.setdefault(f.name, []).append(f)

    def of(self, *exts: str) -> List[SourceFile]:
        return [f for f in self.files if f.ext in exts]

    def named(self, name: str) -> List[SourceFile]:
        return self._by_name.get(name, [])

    def _walk(self, should_cancel) -> None:
        stack = [(self.root, ())]
        while stack:
            if should_cancel and should_cancel():
                self.cancelled = True
                return
            folder, parts = stack.pop()
            try:
                with os.scandir(folder) as it:
                    entries = sorted(it, key=lambda e: e.name)
            except OSError:
                self.unreadable.append("/".join(parts) or ".")
                continue
            for e in entries:
                try:
                    if e.is_symlink():
                        continue            # 저장소 밖 파일을 끌어들이지 않는다
                    if e.is_dir(follow_symlinks=False):
                        if not _skip_dir(e.name, parts):
                            stack.append((Path(e.path), parts + (e.name,)))
                    elif e.is_file(follow_symlinks=False):
                        self._add(e, parts)
                except OSError:
                    continue

    def _add(self, e: "os.DirEntry", parts: tuple) -> None:
        name = e.name
        ext = _ext_of(name)
        if ext not in SOURCE_EXT and ext != ".gradle":
            return
        if _is_test_file(name, ext, parts):
            return
        size = e.stat(follow_symlinks=False).st_size
        rel = "/".join(parts + (name,))
        if size > MAX_BYTES:
            self.big.append(rel)
            return
        self.files.append(SourceFile(rel, Path(e.path), size))


def _skip_dir(name: str, parts: tuple) -> bool:
    if name.startswith(".") or name in SKIP_DIRS or name.endswith(".egg-info"):
        return True
    if name in BUILD_DIRS and "src" not in parts:
        return True
    # 자바 테스트 소스. 컨트롤러처럼 보이는 가짜 매핑이 들어 있다.
    return name == "test" and bool(parts) and parts[-1] == "src"


def _is_test_file(name: str, ext: str, parts: tuple) -> bool:
    if ext == ".py":
        return (any(p in TEST_DIRS for p in parts) or name.startswith("test_") or name.endswith("_test.py")
                or name == "conftest.py")
    if ext in SCRIPT_EXT:
        return (any(p in TEST_DIRS for p in parts) or ".test." in name or ".spec." in name
                or name.endswith(".d.ts") or ".min." in name or ".bundle." in name)
    return False


def open_root(root) -> Path:
    """분석할 디렉터리를 확인한다. 없거나 디렉터리가 아니면 사용자에게 보일 메시지로 ValueError."""
    try:
        path = Path(root).expanduser()
    except (TypeError, ValueError, RuntimeError):
        raise ValueError("소스 디렉터리 경로가 올바르지 않습니다.")
    if not path.exists():
        raise ValueError("소스 디렉터리를 찾을 수 없습니다: %s" % path)
    if not path.is_dir():
        raise ValueError("소스 경로가 디렉터리가 아닙니다: %s" % path)
    if not os.access(str(path), os.R_OK | os.X_OK):
        raise ValueError("소스 디렉터리를 읽을 수 없습니다: %s" % path)
    return path

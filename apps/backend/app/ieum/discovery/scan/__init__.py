"""Git 소스 분석 엔진. 소스 저장소 디렉터리를 읽어 URL, 파라미터, 읽기/쓰기를 찾는다.

결과는 화면 탐색(헤드리스 브라우저)이 찾은 트래픽과 대조된다. 그래서 모르는 것은 모른다고 표시하고
(mode="unknown", mapper=None) 지어내지 않는다.

    java.py        스프링 MVC · 전자정부 · 스프링 부트: 컨트롤러 → 서비스 → DAO/매퍼 → SQL 호출 사슬
    jparse.py      자바 선언 파서(클래스·필드·메서드·어노테이션). AST 가 아니라 가벼운 스캐너
    mybatis.py     MyBatis / iBatis 구문 색인
    script_web.py  Express, FastAPI, Flask
    detect.py      프레임워크 감지(근거 파일 수)
    source.py      디렉터리 순회, 인코딩 판별(UTF-8 → cp949), 크기 제한
    lexer.py       주석·문자열을 가린 사본 만들기. 줄 번호와 스니펫이 원문 기준이 되게 한다
    paths.py       경로 잇기와 경로 변수 표기 통일({id})
"""
from typing import Callable, List, Optional

from .detect import FRAMEWORKS, detect as _detect
from .model import ControllerInfo, ScanResult, SrcEndpoint, SrcParam
from .source import Repo, open_root

__all__ = ["ControllerInfo", "ScanResult", "SrcEndpoint", "SrcParam", "scan", "detect_framework"]

# 선택한 프레임워크가 읽는 확장자. 건너뛴 큰 파일을 알릴 때 관계없는 파일은 빼려는 것.
_EXTS = {
    "spring": (".java", ".xml", ".gradle"),
    "express": (".js", ".ts", ".mjs", ".cjs"),
    "fastapi": (".py",),
}


def detect_framework(root) -> str:
    """감지한 프레임워크: "spring" | "express" | "fastapi" | "" (둘 이상이면 근거 파일이 가장 많은 것). FastAPI 는 Flask 도 포함한다."""
    return _detect(Repo(open_root(root)))


def scan(root, framework: str = "auto", *,
         on_file: Optional[Callable[[ControllerInfo, list], None]] = None,
         should_cancel: Optional[Callable[[], bool]] = None) -> ScanResult:
    """root(str|Path) 아래 소스를 분석한다. framework: "auto" | "spring" | "express" | "fastapi"
    ("fastapi" 는 FastAPI 와 Flask 를 모두 본다). on_file 은 컨트롤러 파일 하나를 해석할 때마다
    (ControllerInfo, 그 파일의 SrcEndpoint 목록)로 불린다. should_cancel() 이 True 면 가능한 빨리 멈추고
    그때까지의 결과를 돌려준다."""
    fw = (framework or "auto").strip().lower()
    if fw != "auto" and fw not in FRAMEWORKS:
        raise ValueError("지원하지 않는 프레임워크입니다: %s (auto, spring, express, fastapi 중에서 고르세요)" % framework)
    path = open_root(root)
    if should_cancel and should_cancel():
        return ScanResult(framework="", notes=["분석이 취소되었습니다."])
    repo = Repo(path, should_cancel)
    if repo.cancelled:
        return ScanResult(framework="", notes=["분석이 취소되었습니다."])
    if fw == "auto":
        fw = _detect(repo, should_cancel)
    if not fw:
        notes = _repo_notes(repo, tuple(e for exts in _EXTS.values() for e in exts))
        notes.append("지원하는 프레임워크를 찾지 못했습니다")
        return ScanResult(framework="", files=0, notes=notes)
    notes = _repo_notes(repo, _EXTS[fw])
    if fw == "spring":
        from .java import scan_spring
        res = scan_spring(repo, notes, on_file, should_cancel)
    elif fw == "express":
        from .script_web import scan_express
        res = scan_express(repo, notes, on_file, should_cancel)
    else:
        from .script_web import scan_pyweb
        res = scan_pyweb(repo, notes, on_file, should_cancel)
    if should_cancel and should_cancel():
        res.notes.append("분석이 중간에 취소되어 그때까지의 결과만 담았습니다.")
    elif not res.endpoints:
        res.notes.append("URL 매핑을 찾지 못했습니다. (컨트롤러나 라우트가 이 디렉터리 밖에 있거나 지원하지 않는 방식일 수 있습니다)")
    return res


def _repo_notes(repo: Repo, exts: tuple) -> List[str]:
    notes: List[str] = []
    big = [r for r in repo.big if r.endswith(exts)]
    if big:
        shown = ", ".join(big[:3]) + (" 외 %d개" % (len(big) - 3) if len(big) > 3 else "")
        notes.append("1MB 를 넘는 파일 %d개는 건너뛰었습니다: %s" % (len(big), shown))
    if repo.unreadable:
        notes.append("읽을 수 없어 건너뛴 디렉터리 %d개" % len(repo.unreadable))
    return notes

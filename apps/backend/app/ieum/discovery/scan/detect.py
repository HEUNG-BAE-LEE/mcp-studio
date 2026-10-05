"""프레임워크 감지. 근거가 되는 파일이 가장 많은 쪽을 고른다.

한 저장소에 여러 프레임워크가 섞여 있어도(스프링 서버 + 개발용 노드 프록시) 분석할 주인공 하나를 고른다.
파일 수는 "그 프레임워크의 라우팅을 실제로 쓰는 파일"만 센다. 화면용 JS 수백 개가 서버 코드 몇십 개를 이기면 안 된다.
"""
import re
from typing import Callable, Dict, Optional

from .source import Repo

FRAMEWORKS = ("spring", "express", "fastapi")        # 동률이면 앞의 것

_SPRING_JAVA = re.compile(r"@(?:Rest)?Controller\b|@RequestMapping\b|@(?:Get|Post|Put|Patch|Delete)Mapping\b")
_ROUTE_JS = re.compile(r"""\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|route)\s*\(\s*['"`]/""")
_ROUTE_PY = re.compile(r"""^[ \t]*@\w+\.(?:get|post|put|patch|delete|route|api_route)\(\s*['"]/""", re.M)
_SPRING_BUILD = re.compile(r"spring-boot-starter|spring-webmvc|org\.springframework\.web|egovframework")
_EXPRESS = re.compile(r"""require\s*\(\s*['"]express['"]\s*\)|from\s+['"]express['"]""")
_PYWEB = re.compile(r"^[ \t]*(?:from\s+(?:fastapi|flask)\b|import\s+(?:fastapi|flask)\b)", re.M)


def evidence(repo: Repo, should_cancel: Optional[Callable[[], bool]] = None) -> Dict[str, int]:
    """프레임워크별로 근거가 되는 파일 수."""
    counts = {k: 0 for k in FRAMEWORKS}
    for f in repo.of(".java"):
        if should_cancel and should_cancel():
            return counts
        if _SPRING_JAVA.search(f.text):                  # 임포트가 잘린 조각이어도 매핑 어노테이션이면 근거다
            counts["spring"] += 1
        f.release()
    if not counts["spring"]:
        # 컨트롤러 소스는 안 보이지만 빌드 파일이 스프링 웹을 쓴다고 하면 스프링으로 본다
        for f in repo.named("pom.xml") + repo.of(".gradle"):
            if _SPRING_BUILD.search(f.text):
                counts["spring"] = 1
                break
            f.release()
    for f in repo.of(".js", ".ts", ".mjs", ".cjs"):
        if should_cancel and should_cancel():
            return counts
        text = f.text
        if _EXPRESS.search(text) or _ROUTE_JS.search(text):
            counts["express"] += 1
        f.release()
    for f in repo.of(".py"):
        if should_cancel and should_cancel():
            return counts
        text = f.text
        if _PYWEB.search(text) or _ROUTE_PY.search(text):
            counts["fastapi"] += 1
        f.release()
    return counts


def detect(repo: Repo, should_cancel: Optional[Callable[[], bool]] = None) -> str:
    """감지한 프레임워크: "spring" | "express" | "fastapi" | "". 둘 이상이면 근거 파일이 가장 많은 것."""
    counts = evidence(repo, should_cancel)
    best = max(FRAMEWORKS, key=lambda k: (counts[k], -FRAMEWORKS.index(k)))
    return best if counts[best] else ""

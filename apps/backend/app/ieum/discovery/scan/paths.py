"""URL 경로 다루기: 접두사 잇기, 경로 변수 표기 통일.

소스마다 경로 변수를 다르게 쓴다(스프링·FastAPI `{id}`, Express `:id`, Flask `<int:id>`). 화면 탐색이 본 트래픽과
경로로 맞추는 쪽이 한 가지 표기만 다루도록 `{id}` 로 통일한다.
"""
import re

_BRACE_RE = re.compile(r"\{(\w+)(?::(?:[^{}]|\{[^{}]*\})*)?\}")   # {id:\d+} {path:path} {y:\d{4}}
_COLON = re.compile(r":([A-Za-z_]\w*)(?:\([^)]*\))?\??")    # :id  :id(\d+)  :id?
_ANGLE = re.compile(r"<(?:\w+:)?(\w+)>")                    # <id>  <int:id>


def join_path(prefix: str, path: str) -> str:
    """접두사와 경로를 잇는다. 항상 슬래시로 시작하고 겹친 슬래시는 하나로 줄인다."""
    prefix = prefix or ""
    if path in ("", "/"):
        out = prefix or "/"                  # 접두사 아래의 루트 라우트(`router.get('/')`)는 접두사 그대로 부른다
    else:
        out = prefix.rstrip("/") + "/" + path.lstrip("/")
    out = re.sub(r"/{2,}", "/", out)
    out = _BRACE_RE.sub(r"{\1}", out)
    return out if out.startswith("/") else "/" + out


def express_template(path: str) -> str:
    return _COLON.sub(r"{\1}", path)


def flask_template(path: str) -> str:
    return _ANGLE.sub(r"{\1}", path)


def path_vars(path: str) -> list:
    """`/a/{id}/b/{no}` → ["id", "no"]."""
    return re.findall(r"\{(\w+)\}", path)

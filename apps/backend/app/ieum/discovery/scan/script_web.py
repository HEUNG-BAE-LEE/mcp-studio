"""Express · FastAPI · Flask 소스 분석: 라우트 선언에서 URL, 파라미터, HTTP 메서드를 읽는다.

스프링과 달리 읽기/쓰기를 가리킬 SQL 단서가 없다. HTTP 메서드로만 정한다(GET=읽기, 그 외=쓰기).
`app.use('/api', userRouter)`, `app.include_router(r, prefix="/q")` 처럼 라우터를 다른 라우터에 붙이는 접두사는
같은 저장소 안에서 가능한 만큼 따라가고, 풀 수 없으면 접두사 없이 둔다(지어내지 않는다).
"""
import posixpath
import re
from typing import Callable, Dict, List, Optional, Set, Tuple

from .lexer import Code, comment_summary, doc_lines, mask_js, mask_py, match_brace, match_paren, split_top, summary, tag_text
from .model import ControllerInfo, ScanResult, SrcEndpoint, SrcParam
from .paths import express_template, flask_template, join_path, path_vars
from .source import Repo, SourceFile

SNIPPET_LINES = 40
JS_EXTS = (".js", ".ts", ".mjs", ".cjs")
MAX_PREFIXES = 8                  # 같은 라우터가 여러 곳에 붙어 있어도 이 이상은 펼치지 않는다


# ---------------------------------------------------------------- 공통
def _cat(a: str, b: str) -> str:
    """접두사 두 개를 잇는다. 빈 것은 건너뛴다."""
    if not a:
        return b
    if not b:
        return a
    out = a.rstrip("/") + "/" + b.lstrip("/")
    return out if out.startswith("/") else "/" + out


class Graph:
    """라우터가 어느 라우터에 어떤 접두사로 붙었는지. 노드는 (파일, 변수 이름)이고 변수 이름이 None 이면 그 파일의 모든 라우터다."""

    def __init__(self):
        self.parents: Dict[tuple, List[tuple]] = {}      # 노드 → [(붙인 접두사, 부모 노드, 자체 접두사를 덮어쓰는가)]
        self.own: Dict[tuple, str] = {}                  # 노드 → 라우터가 스스로 가진 접두사 (APIRouter(prefix=...))

    def mount(self, parent: tuple, child: tuple, prefix: str, replace: bool = False) -> None:
        self.parents.setdefault(child, []).append((prefix, parent, replace))

    def prefixes(self, node: tuple, seen: tuple = ()) -> List[str]:
        if node in seen:
            return [""]
        own = self.own.get(node, "")
        edges = list(self.parents.get(node, []))
        if node[1] is not None:
            edges += self.parents.get((node[0], None), [])
        if not edges:
            return [own]
        out: List[str] = []
        for prefix, parent, replace in edges:
            for pp in self.prefixes(parent, seen + (node,)):
                joined = _cat(_cat(pp, prefix), "" if replace else own)
                if joined not in out:
                    out.append(joined)
        return out[:MAX_PREFIXES] or [own]


def module_name(rel: str) -> str:
    """`routes/users.js` → users, `routes/index.js` → routes, `app/api/__init__.py` → api."""
    stem = posixpath.splitext(rel.rsplit("/", 1)[-1])[0]
    if stem in ("index", "__init__") and "/" in rel:
        return rel.rsplit("/", 2)[-2]
    return stem


def _snippet(code: Code, start: int, end: int) -> str:
    ls = code.line_start(start)
    s0 = ls if not code.raw[ls:start].strip() else start
    lines = code.raw[s0:end].rstrip().split("\n")
    if len(lines) > SNIPPET_LINES:
        lines = lines[:SNIPPET_LINES] + ["    // ..."]
    return "\n".join(lines)


def _unique(params: List[SrcParam]) -> List[SrcParam]:
    seen: Set[tuple] = set()
    out = []
    for p in params:
        if (p.name, p.loc) not in seen:
            seen.add((p.name, p.loc))
            out.append(p)
    return out


def _copy(params: List[SrcParam]) -> List[SrcParam]:
    return [SrcParam(p.name, p.type, p.required, p.loc, p.desc) for p in params]


def _info(infos: List[ControllerInfo], rel: str, module: str, got: List[SrcEndpoint]) -> ControllerInfo:
    info = ControllerInfo(rel, module, api=sum(1 for e in got if e.kind in ("api", "file")),
                          page=sum(1 for e in got if e.kind == "page"), deprecated=sum(1 for e in got if e.deprecated))
    infos.append(info)
    return info


# ================================================================ Express
_EXPRESS_IMPORT = re.compile(r"""require\s*\(\s*['"]express['"]\s*\)|from\s+['"]express['"]""")
_ROUTER_DECL = re.compile(
    r"""(?:const|let|var)\s+([\w$]+)\s*=\s*(?:express\s*\(\s*\)|(?:new\s+)?(?:express\s*\.\s*)?Router\s*\(|"""
    r"""require\s*\(\s*['"]express['"]\s*\)\s*\.\s*Router\s*\()""")
_JS_REQ = re.compile(r"""(?:const|let|var)\s+([\w$]+)\s*=\s*require\s*\(\s*(['"])(\.[^'"]*)\2\s*\)""")
_JS_REQ_DESTR = re.compile(r"""(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\s*\(\s*(['"])(\.[^'"]*)\2\s*\)""")
_JS_IMP_DEFAULT = re.compile(r"""\bimport\s+([\w$]+)\s*(?:,\s*\{[^}]*\})?\s*from\s*(['"])(\.[^'"]*)\2""")
_JS_IMP_NAMED = re.compile(r"""\bimport\s*(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*(['"])(\.[^'"]*)\2""")
_JS_IMP_NS = re.compile(r"""\bimport\s*\*\s*as\s+([\w$]+)\s+from\s*(['"])(\.[^'"]*)\2""")
_ROUTE_CALL = re.compile(r"""\b([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])(/[^'"`\n]*)\3""")
_ROUTE_CHAIN = re.compile(r"""\b([A-Za-z_$][\w$]*)\s*\.\s*route\s*\(\s*(['"`])(/[^'"`\n]*)\2\s*\)""")
_CHAIN_VERB = re.compile(r"\s*\.\s*(get|post|put|patch|delete|all)\s*\(")
_USE_CALL = re.compile(r"""\b([A-Za-z_$][\w$]*)\s*\.\s*use\s*\(\s*(['"`])(/[^'"`\n]*)\2\s*,""")
_JS_QUICK = re.compile(r"\.\s*(?:get|post|put|patch|delete|route|use)\s*\(")
_REF = re.compile(r"[\w$]+(?:\s*\.\s*[\w$]+)*")
_INLINE_REQ = re.compile(r"\(\s*([\w$]+)\s*[:,)]")
_JS_FILE = re.compile(r"\.\s*(?:download|attachment)\s*\(")
_JS_PAGE = re.compile(r"\.\s*(?:render|sendFile|redirect)\s*\(")
_JS_DATA = re.compile(r"\.\s*(?:json|jsonp|send|end|sendStatus)\s*\(")
_OBJ_METHODS = frozenset({"hasOwnProperty", "toString", "valueOf", "constructor", "isPrototypeOf", "length"})
# axios.get('/api/x') 처럼 라우트가 아니라 HTTP 호출인 것
_CLIENT_NAMES = frozenset({
    "axios", "http", "https", "request", "superagent", "fetch", "got", "ky", "$", "jQuery", "cy", "supertest", "agent",
    "client", "session", "cache", "redis", "map", "params", "headers", "config", "localStorage", "sessionStorage",
    "cookies", "store", "db", "fs", "path", "process", "JSON", "Reflect", "Math", "Object", "Array", "URLSearchParams",
})
_ROUTER_NAMES = frozenset({"app", "router", "routes", "route", "server", "application"})


class _JsRoute:
    __slots__ = ("obj", "verb", "path", "start", "close", "handler", "line_pos")

    def __init__(self, obj, verb, path, start, close, handler, line_pos):
        self.obj, self.verb, self.path, self.start = obj, verb, path, start
        self.close, self.handler, self.line_pos = close, handler, line_pos


class _JsFile:
    def __init__(self, rel: str, code: Code):
        self.rel = rel
        self.code = code
        self.module = module_name(rel)
        self.express = bool(_EXPRESS_IMPORT.search(code.clean))
        self.routers: Set[str] = set(m.group(1) for m in _ROUTER_DECL.finditer(code.clean))
        self.imports: Dict[str, tuple] = {}              # 지역 이름 → (파일, 가져온 이름 또는 None)
        self.routes: List[_JsRoute] = []
        self.mounts: List[tuple] = []                    # (부모 변수, 접두사, 자식 식 텍스트)


def _js_resolve(from_rel: str, spec: str, files: Set[str]) -> Optional[str]:
    base = posixpath.normpath(posixpath.join(posixpath.dirname(from_rel), spec))
    cands = [base] + [base + e for e in JS_EXTS] + [base + "/index" + e for e in JS_EXTS]
    if base.endswith(".js"):
        cands.append(base[:-3] + ".ts")                  # TypeScript 는 .js 확장자로 가져오기도 한다
    return next((c for c in cands if c in files), None)


def _named_imports(body: str) -> List[Tuple[str, str]]:
    """`a, b as c` / `a, b: c` → [(지역 이름, 원래 이름)]."""
    out = []
    for part in body.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"([\w$]+)\s*(?:as|:)\s*([\w$]+)$", part)
        name = part.split("=")[0].strip()
        out.append((m.group(2), m.group(1)) if m else (name, name))
    return out


def _router_like(jf: _JsFile, obj: str) -> bool:
    """`obj.get('/x')` 가 라우트 선언인가. axios.get('/api/x') 같은 HTTP 호출과 가른다."""
    if obj in jf.routers:
        return True
    low = obj.lower()
    if low in _ROUTER_NAMES or low.endswith(("router", "routes", "app")):
        return True
    return jf.express and obj not in _CLIENT_NAMES and not obj.startswith("$")


def _parse_js(rel: str, text: str, files: Set[str]) -> _JsFile:
    jf = _JsFile(rel, mask_js(text))
    clean, skel = jf.code.clean, jf.code.skel
    for pat, named in ((_JS_REQ, False), (_JS_REQ_DESTR, True), (_JS_IMP_DEFAULT, False), (_JS_IMP_NS, False), (_JS_IMP_NAMED, True)):
        for m in pat.finditer(clean):
            tgt = _js_resolve(rel, m.group(3), files)
            if not tgt:
                continue
            if named:
                for local, orig in _named_imports(m.group(1)):
                    jf.imports[local] = (tgt, orig)
            else:
                jf.imports[m.group(1)] = (tgt, None)
    for m in _ROUTE_CALL.finditer(clean):
        obj, verb, path = m.group(1), m.group(2), m.group(4)
        if "${" in path or not _router_like(jf, obj):
            continue
        open_idx = m.start() + m.group(0).index("(")
        close = match_paren(skel, open_idx)
        if close < 0:
            continue
        args = split_top(skel, open_idx + 1, close, ",")
        jf.routes.append(_JsRoute(obj, verb, path, m.start(), close, args[-1] if len(args) > 1 else None, m.start()))
    for m in _ROUTE_CHAIN.finditer(clean):
        if "${" in m.group(3) or not _router_like(jf, m.group(1)):
            continue
        pos = m.end()
        while True:
            cm = _CHAIN_VERB.match(skel, pos)
            if not cm:
                break
            close = match_paren(skel, cm.end() - 1)
            if close < 0:
                break
            if cm.group(1) != "all":
                args = split_top(skel, cm.end(), close, ",")
                jf.routes.append(_JsRoute(m.group(1), cm.group(1), m.group(3), m.start(), close, args[-1] if args else None,
                                          pos + cm.group().index(cm.group(1))))
            pos = close + 1
    for m in _USE_CALL.finditer(clean):
        close = match_paren(skel, m.start() + m.group(0).index("("))
        if close < 0 or "${" in m.group(3):
            continue
        args = split_top(skel, m.end(), close, ",")
        if args:
            jf.mounts.append((m.group(1), m.group(3), clean[args[-1][0]:args[-1][1]].strip()))
    jf.routes.sort(key=lambda r: r.line_pos)
    return jf


class ExpressScan:
    def __init__(self, repo: Repo, notes: List[str], on_file: Optional[Callable], should_cancel: Optional[Callable[[], bool]]):
        self.repo, self.notes, self.on_file = repo, notes, on_file
        self.should_cancel = should_cancel or (lambda: False)
        self.files: Dict[str, _JsFile] = {}              # 라우트나 마운트가 있는 파일
        self.sources: Dict[str, SourceFile] = {}
        self._codes: Dict[str, Code] = {}                # 핸들러 본문을 찾으려 따로 읽은 파일
        self.graph = Graph()
        self.read = 0

    def load(self) -> None:
        sources = self.repo.of(*JS_EXTS)
        self.sources = {f.rel: f for f in sources}
        names = set(self.sources)
        for f in sources:
            if self.should_cancel():
                return
            self.read += 1
            text = f.text
            f.release()
            if not _JS_QUICK.search(text):
                continue
            try:
                jf = _parse_js(f.rel, text, names)
            except Exception:                                   # 한 파일이 이상해도 나머지는 읽는다
                self.notes.append("읽지 못해 건너뛴 파일: %s" % f.rel)
                continue
            if jf.routes or jf.mounts:
                self.files[f.rel] = jf
        for jf in self.files.values():
            for parent, prefix, child_text in jf.mounts:
                child = self._child(jf, child_text)
                if child is not None:
                    self.graph.mount((jf.rel, parent), child, prefix)

    def _child(self, jf: _JsFile, text: str) -> Optional[tuple]:
        """`app.use('/api', X)` 의 X 가 가리키는 라우터 노드."""
        if re.fullmatch(r"[\w$]+", text):
            if text in jf.routers:
                return (jf.rel, text)
            imp = jf.imports.get(text)
            return (imp[0], None) if imp else None
        m = re.fullmatch(r"require\s*\(\s*['\"](\.[^'\"]*)['\"]\s*\)(?:\s*\.\s*[\w$]+)?", text)
        if m:
            tgt = _js_resolve(jf.rel, m.group(1), set(self.sources))
            return (tgt, None) if tgt else None
        m = re.fullmatch(r"([\w$]+)\s*\.\s*[\w$]+", text)
        if m and m.group(1) in jf.imports:
            return (jf.imports[m.group(1)][0], None)
        return None

    def run(self) -> Tuple[List[SrcEndpoint], List[ControllerInfo]]:
        eps: List[SrcEndpoint] = []
        infos: List[ControllerInfo] = []
        for rel in sorted(self.files):
            if self.should_cancel():
                break
            jf = self.files[rel]
            try:
                got = self._file_endpoints(jf)
            except Exception:                                   # 한 파일이 이상해도 나머지는 읽는다
                self.notes.append("해석하지 못해 건너뛴 파일: %s" % rel)
                continue
            if not got:
                continue
            info = _info(infos, rel, jf.module, got)
            eps.extend(got)
            if self.on_file:
                self.on_file(info, list(got))
        eps.sort(key=lambda e: (e.file, e.line))
        return eps, infos

    def _file_endpoints(self, jf: _JsFile) -> List[SrcEndpoint]:
        code = jf.code
        out: List[SrcEndpoint] = []
        for r in jf.routes:
            text, req, fn = self._handler(jf, r)
            path_tpl = express_template(r.path)
            above = code.above(r.start)
            doc = next((c for c in above if c.kind == "doc"), None)
            doc_ls = doc_lines(doc.text) if doc else []
            title = (tag_text(doc_ls, "desc") or tag_text(doc_ls, "description") or tag_text(doc_ls, "summary")
                     or comment_summary(above))
            kind = _js_kind(text)
            params = _unique([SrcParam(v, "", True, "path", "") for v in path_vars(path_tpl)] + _req_params(text, req))
            end = r.close + 1 + (1 if code.raw[r.close + 1:r.close + 2] == ";" else 0)
            method = r.verb.upper()
            for prefix in self.graph.prefixes((jf.rel, r.obj)):
                out.append(SrcEndpoint(
                    method=method, path=join_path(prefix, path_tpl), file=jf.rel, line=code.line_of(r.line_pos), cls=jf.module,
                    fn=fn, kind=kind, mode="unknown" if kind == "page" else ("read" if method == "GET" else "write"),
                    sql=None, mapper=None, ret="", vo=None, deprecated=any(ln.startswith("@deprecated") for ln in doc_ls),
                    title=title, params=_copy(params), snippet=_snippet(code, r.start, end), lang="js"))
        return out

    # -- 핸들러 본문 찾기
    def _handler(self, jf: _JsFile, r: _JsRoute) -> Tuple[str, str, str]:
        """(핸들러 본문 텍스트, 요청 객체 이름, 함수 이름). 못 찾으면 본문은 빈 문자열."""
        anonymous = "%s %s" % (r.verb.upper(), r.path)         # 이름 없는 핸들러는 라우트 자체로 부른다
        if r.handler is None:
            return "", "req", anonymous
        text = jf.code.clean[r.handler[0]:r.handler[1]].strip()
        if _REF.fullmatch(text):
            parts = [p.strip() for p in text.split(".")]
            name = parts[-1]
            body, req = self._find_function(jf, parts[0] if len(parts) > 1 else None, name)
            return body, req, name
        m = _INLINE_REQ.search(text)
        return text, (m.group(1) if m else "req"), anonymous

    def _find_function(self, jf: _JsFile, ns: Optional[str], name: str) -> Tuple[str, str]:
        """같은 파일이나, 가져온 모듈(`ctrl.list`, `{ list }`)에서 이름으로 함수 정의를 찾는다."""
        if ns and ns in jf.imports:
            target = jf.imports[ns][0]
        elif not ns and name in jf.imports:
            target, name = jf.imports[name][0], (jf.imports[name][1] or name)
        else:
            target = jf.rel
        code = jf.code if target == jf.rel else self._code_of(target)
        found = _function_text(code, name) if code else None
        return found if found else ("", "req")

    def _code_of(self, rel: str) -> Optional[Code]:
        if rel in self.files:
            return self.files[rel].code
        if rel not in self._codes and rel in self.sources:
            text = self.sources[rel].text
            self.sources[rel].release()
            self._codes[rel] = mask_js(text)
        return self._codes.get(rel)


def _function_text(code: Code, name: str) -> Optional[Tuple[str, str]]:
    """이름으로 함수 정의를 찾아 (본문 포함 텍스트, 요청 객체 이름). 못 찾으면 None."""
    n = re.escape(name)
    pats = [
        r"\bfunction\s*\*?\s*%s\s*\(" % n,
        r"\b(?:const|let|var)\s+%s\s*=\s*(?:async\s+)?(?:function\b[^(]*)?\(" % n,
        r"\b(?:const|let|var)\s+%s\s*=\s*(?:async\s+)?[\w$]+\s*=>" % n,
        r"\bexports\s*\.\s*%s\s*=\s*(?:async\s+)?(?:function\b[^(]*)?\(" % n,
        r"(?<![\w$.])%s\s*:\s*(?:async\s+)?(?:function\b[^(]*)?\(" % n,
        r"(?<![\w$.])(?:static\s+)?(?:async\s+)?%s\s*\([^)]*\)\s*(?::[^{;]*)?\{" % n,
    ]
    skel = code.skel
    for p in pats:
        m = re.search(p, skel)
        if not m:
            continue
        end = _function_end(skel, m)
        if end < 0:
            continue
        text = code.clean[m.start():end]
        req = _INLINE_REQ.search(text)
        single = re.search(r"=\s*(?:async\s+)?([\w$]+)\s*=>", text[:120])
        return text, (req.group(1) if req else single.group(1) if single else "req")
    return None


def _function_end(skel: str, m: "re.Match") -> int:
    """함수 정의 매치 이후 본문 끝(`}` 바로 뒤). 화살표 식 본문은 문장 끝까지."""
    pos = m.end() - 1
    if skel[pos] == "(":
        close = match_paren(skel, pos)
        if close < 0:
            return -1
        pos = close + 1
    elif skel[pos] == ">":
        pos += 1
    arrow = re.compile(r"\s*(?::[^={;]*)?\s*(?:=>)?\s*").match(skel, pos)
    pos = arrow.end() if arrow else pos
    if pos < len(skel) and skel[pos] == "{":
        close = match_brace(skel, pos)
        return close + 1 if close >= 0 else -1
    stop = re.compile(r"[;\n]").search(skel, pos)
    return stop.start() if stop else len(skel)


def _req_params(text: str, req: str) -> List[SrcParam]:
    """핸들러 본문에서 `req.query.x`, `req.body.x`, `req.params.x` 와 구조분해로 꺼낸 이름들."""
    if not text:
        return []
    r = re.escape(req or "req")
    loc_of = {"query": "query", "body": "body", "params": "path"}
    found: List[Tuple[int, str, str]] = []
    for m in re.finditer(r"\b%s\s*\.\s*(query|body|params)\s*\.\s*([A-Za-z_$][\w$]*)" % r, text):
        found.append((m.start(), loc_of[m.group(1)], m.group(2)))
    for m in re.finditer(r"""\b%s\s*\.\s*(query|body|params)\s*\[\s*(['"])([^'"\n]+)\2\s*\]""" % r, text):
        found.append((m.start(), loc_of[m.group(1)], m.group(3)))
    for m in re.finditer(r"(?:const|let|var)\s*\{([^}]*)\}\s*=\s*%s\s*\.\s*(query|body|params)\b" % r, text):
        for part in m.group(1).split(","):
            name = re.split(r"[:=]", part.strip())[0].strip()
            if re.fullmatch(r"[A-Za-z_$][\w$]*", name):
                found.append((m.start(), loc_of[m.group(2)], name))
    found.sort(key=lambda x: x[0])
    return [SrcParam(name, "", loc == "path", loc, "") for _p, loc, name in found if name not in _OBJ_METHODS]


def _js_kind(text: str) -> str:
    if not text:
        return "api"
    if _JS_FILE.search(text):
        return "file"
    if _JS_PAGE.search(text) and not _JS_DATA.search(text):
        return "page"
    return "api"


def scan_express(repo: Repo, notes: List[str], on_file: Optional[Callable] = None,
                 should_cancel: Optional[Callable[[], bool]] = None) -> ScanResult:
    sc = ExpressScan(repo, notes, on_file, should_cancel)
    sc.load()
    eps, infos = sc.run()
    return ScanResult(framework="Express", endpoints=eps, files=sc.read, controllers=infos, sql_counts={}, notes=notes)


# ================================================================ FastAPI / Flask
_PY_QUICK = re.compile(r"\b(?:fastapi|flask|APIRouter|Blueprint)\b", re.I)
_PY_DECO = re.compile(r"^[ \t]*@([\w.]+)\.(get|post|put|patch|delete|route|api_route)[ \t]*\(", re.M)
_PY_DEF = re.compile(r"(async[ \t]+)?def[ \t]+([A-Za-z_]\w*)[ \t]*\(")
_PY_CLASS = re.compile(r"^class[ \t]+([A-Za-z_]\w*)[ \t]*(?:\(([^)]*)\))?[ \t]*:", re.M)
_PY_OBJ = re.compile(r"^[ \t]*([A-Za-z_]\w*)[ \t]*(?::[^=\n]+)?=[ \t]*(?:[\w.]+\.)?(FastAPI|APIRouter|Flask|Blueprint)[ \t]*\(", re.M)
_PY_INCLUDE = re.compile(r"\b([A-Za-z_]\w*)[ \t]*\.[ \t]*(include_router|register_blueprint)[ \t]*\(")
_PY_FROM = re.compile(r"^[ \t]*from[ \t]+(\.*)([\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n]+)", re.M)
_PY_IMPORT = re.compile(r"^[ \t]*import[ \t]+([\w.]+)(?:[ \t]+as[ \t]+(\w+))?", re.M)
_PY_STR = re.compile(r"""^[rRuUbB]{0,2}(['"])\x00*\1$""")
_PY_KWARG = re.compile(r"^\s*([A-Za-z_]\w*)\s*=(?!=)")
_PY_META = re.compile(r"^\s*(?:\w+\.)*(Query|Path|Body|Form|File|Header|Cookie)\s*\(")
# FastAPI 가 본문으로 읽는 타입(Query() 같은 지정이 없을 때)
_PY_BODY_TYPES = frozenset({"dict", "Dict", "Any", "object", "list", "set", "tuple", "Mapping", "MutableMapping"})
_PY_SKIP_TYPES = frozenset({"Request", "Response", "WebSocket", "HTTPConnection", "BackgroundTasks", "Session", "AsyncSession",
                            "SecurityScopes", "HTTPAuthorizationCredentials", "OAuth2PasswordRequestForm"})
_PY_FILE_SIG = re.compile(r"\b(?:send_file|send_from_directory|FileResponse)\s*\(|Content-Disposition", re.I)
_PY_PAGE_SIG = re.compile(r"\b(?:render_template|render_template_string|HTMLResponse|TemplateResponse|RedirectResponse|redirect)\b")
_PY_DATA_SIG = re.compile(r"\bjsonify\s*\(|\bJSONResponse\b|\bORJSONResponse\b|\bjson\.dumps\b|return\s*\{|return\s+dict\s*\(")
_FLASK_KINDS = ("Flask", "Blueprint")


class _PyFunc:
    __slots__ = ("name", "params", "ret", "body", "def_pos")

    def __init__(self, name, params, ret, body, def_pos):
        self.name, self.params, self.ret, self.body, self.def_pos = name, params, ret, body, def_pos


class _PyRoute:
    __slots__ = ("obj", "verb", "path", "start", "func", "kwargs")

    def __init__(self, obj, verb, path, start, func, kwargs):
        self.obj, self.verb, self.path, self.start, self.func, self.kwargs = obj, verb, path, start, func, kwargs


class _PyModel:
    def __init__(self, name: str, pf: "_PyFile", bases: List[str], start: int, header_end: int):
        self.name, self.pf, self.bases = name, pf, bases
        self.start, self.header_end = start, header_end
        self.fields: Optional[List[SrcParam]] = None


class _PyFile:
    def __init__(self, rel: str, code: Code):
        self.rel = rel
        self.code = code
        self.module = module_name(rel)
        self.imports: Dict[str, tuple] = {}              # 지역 이름 → ("module", 파일) | ("symbol", 파일, 이름)
        self.objs: Dict[str, str] = {}                   # 변수 → FastAPI | APIRouter | Flask | Blueprint
        self.prefixes: Dict[str, str] = {}               # 변수 → APIRouter(prefix=)/Blueprint(url_prefix=)
        self.routes: List[_PyRoute] = []
        self.includes: List[tuple] = []                  # (부모 변수, 호출 이름, 첫 인자 span, kwargs)
        self.models: Dict[str, _PyModel] = {}
        self.uses_flask = bool(re.search(r"^[ \t]*(?:from|import)[ \t]+flask\b", code.clean, re.M))
        self.uses_fastapi = bool(re.search(r"^[ \t]*(?:from|import)[ \t]+fastapi\b", code.clean, re.M))


class _PyModules:
    """점으로 쓴 모듈 경로를 저장소 파일로 바꾼다. 저장소 루트가 패키지 루트보다 위일 수 있어 접미사로도 찾는다."""

    def __init__(self, rels: List[str]):
        self.rels = set(rels)
        self.keys: Dict[str, List[str]] = {}
        for rel in rels:
            parts = rel[:-3].split("/")
            if parts[-1] == "__init__":
                parts = parts[:-1]
            for i in range(len(parts)):
                self.keys.setdefault(".".join(parts[i:]), []).append(rel)

    def absolute(self, dotted: str) -> Optional[str]:
        cands = self.keys.get(dotted, [])
        return min(cands, key=len) if cands else None

    def relative(self, from_rel: str, level: int, dotted: str) -> Optional[str]:
        base = from_rel.split("/")[:-1]
        if level > 1:
            base = base[:max(0, len(base) - (level - 1))]
        path = "/".join(base + [p for p in dotted.split(".") if p])
        for cand in (path + ".py", path + "/__init__.py"):
            if cand in self.rels:
                return cand
        return None

    def resolve(self, from_rel: str, level: int, dotted: str) -> Optional[str]:
        if level:
            return self.relative(from_rel, level, dotted)
        return self.absolute(dotted) if dotted else None


def _py_args(code: Code, open_idx: int, close: int) -> Tuple[List[Tuple[int, int]], Dict[str, Tuple[int, int]]]:
    """호출의 (위치 인자 span 들, {키워드 이름: 값 span})."""
    pos, kw = [], {}
    for a, b in split_top(code.skel, open_idx + 1, close, ","):
        m = _PY_KWARG.match(code.skel[a:b])
        if m:
            kw[m.group(1)] = (a + m.end(), b)
        else:
            pos.append((a, b))
    return pos, kw


def _py_str(code: Code, span: Optional[Tuple[int, int]]) -> Optional[str]:
    """문자열 리터럴 하나의 값. f-string 이나 식이면 None."""
    if not span:
        return None
    if not _PY_STR.match(code.skel[span[0]:span[1]].strip()):
        return None
    t = code.clean[span[0]:span[1]].strip()
    i = min(x for x in (t.find('"'), t.find("'")) if x >= 0)
    return t[i + 1:-1]


def _py_str_list(code: Code, span: Optional[Tuple[int, int]]) -> List[str]:
    if not span:
        return []
    a, b = span
    seg = code.skel[a:b]
    sk = seg.strip()
    if not sk or sk[0] not in "[(":
        v = _py_str(code, span)
        return [v] if v else []
    lo, hi = a + seg.index(sk[0]) + 1, a + seg.rindex(sk[-1])
    return [v for v in (_py_str(code, s) for s in split_top(code.skel, lo, hi, ",")) if v]


def _py_bool(code: Code, span: Optional[Tuple[int, int]]) -> bool:
    return bool(span) and code.clean[span[0]:span[1]].strip() == "True"


def _split_param(code: Code, a: int, b: int) -> Tuple[str, str, Optional[str]]:
    """`name: ann = default` → (이름, 주석 텍스트, 기본값 텍스트 또는 None)."""
    text = code.skel[a:b]
    depth, colon, eq = 0, -1, -1
    for i, ch in enumerate(text):
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif depth == 0:
            if ch == ":" and colon < 0 and eq < 0:
                colon = i
            elif ch == "=" and eq < 0:
                eq = i
    cut = min(x for x in (colon, eq, len(text)) if x >= 0)
    name = text[:cut].strip()
    ann = code.clean[a + colon + 1:a + (eq if eq >= 0 else len(text))].strip() if colon >= 0 else ""
    default = code.clean[a + eq + 1:b].strip() if eq >= 0 else None
    return name, ann, default


def _block_end(code: Code, header_end: int, indent: int) -> int:
    """`:` 로 끝난 헤더 다음 블록의 끝. indent 보다 깊게 들여쓴 줄이 이어지는 동안(빈 줄·주석·문자열 안쪽 줄은 건너뛴다)."""
    raw, skel = code.raw, code.skel
    nl = raw.find("\n", header_end)
    if nl < 0:
        return len(raw)
    end = nl
    pos = nl + 1
    while pos < len(raw):
        nxt = raw.find("\n", pos)
        line_end = nxt if nxt >= 0 else len(raw)
        if skel[pos:line_end].strip("\x00 \t\r"):
            line = raw[pos:line_end]
            if len(line) - len(line.lstrip()) <= indent:
                break
        end = line_end if skel[pos:line_end].strip() else end
        pos = line_end + 1
    return end


def _parse_py(rel: str, text: str, modules: _PyModules) -> _PyFile:
    pf = _PyFile(rel, mask_py(text))
    code, skel = pf.code, pf.code.skel
    for m in _PY_FROM.finditer(skel):
        level, dotted = len(m.group(1)), m.group(2)
        mod_rel = modules.resolve(rel, level, dotted)
        for part in m.group(3).strip().strip("()").replace("\n", " ").split(","):
            am = re.match(r"(\w+)(?:\s+as\s+(\w+))?$", part.strip())
            if not am:
                continue
            orig, local = am.group(1), am.group(2) or am.group(1)
            sub = modules.resolve(rel, level, (dotted + "." if dotted else "") + orig)
            if sub:
                pf.imports[local] = ("module", sub)
            elif mod_rel:
                pf.imports[local] = ("symbol", mod_rel, orig)
    for m in _PY_IMPORT.finditer(skel):
        tgt = modules.absolute(m.group(1))
        if tgt:
            pf.imports[m.group(2) or m.group(1).split(".")[0]] = ("module", tgt)
    for m in _PY_CLASS.finditer(skel):
        bases = [b.strip().rsplit(".", 1)[-1] for b in (m.group(2) or "").split(",") if b.strip() and "=" not in b]
        pf.models[m.group(1)] = _PyModel(m.group(1), pf, bases, m.start(), m.end() - 1)
    if not _PY_QUICK.search(text) and not _PY_DECO.search(skel):
        return pf
    for m in _PY_OBJ.finditer(skel):
        pf.objs[m.group(1)] = m.group(2)
        close = match_paren(skel, m.end() - 1)
        if close > 0 and m.group(2) in ("APIRouter", "Blueprint"):
            _pos, kw = _py_args(code, m.end() - 1, close)
            prefix = _py_str(code, kw.get("prefix") or kw.get("url_prefix"))
            if prefix:
                pf.prefixes[m.group(1)] = prefix
    for m in _PY_INCLUDE.finditer(skel):
        close = match_paren(skel, m.end() - 1)
        if close > 0:
            pos, kw = _py_args(code, m.end() - 1, close)
            if pos:
                pf.includes.append((m.group(1), m.group(2), pos[0], kw))
    for m in _PY_DECO.finditer(skel):
        route = _parse_route(pf, m)
        if route is not None:
            pf.routes.append(route)
    return pf


def _parse_route(pf: _PyFile, m: "re.Match") -> Optional[_PyRoute]:
    code = pf.code
    close = match_paren(code.skel, m.end() - 1)
    if close < 0:
        return None
    pos, kw = _py_args(code, m.end() - 1, close)
    path = _py_str(code, pos[0] if pos else kw.get("path"))
    if path is None:
        return None                                       # f-string 이거나 식: 풀 수 없다
    func = _py_def_after(pf, close + 1)
    if func is None:
        return None
    return _PyRoute(m.group(1).split(".")[-1], m.group(2), path, m.start(), func, kw)


def _py_def_after(pf: _PyFile, pos: int) -> Optional[_PyFunc]:
    """데코레이터 다음에 오는 `def` 를 읽는다. 다른 데코레이터가 더 붙어 있으면 건너뛴다."""
    code, skel = pf.code, pf.code.skel
    n = len(skel)
    while pos < n:
        while pos < n and skel[pos] in " \t\r\n":
            pos += 1
        if pos < n and skel[pos] == "@":
            dm = re.compile(r"@[\w.]+").match(skel, pos)
            if not dm:
                return None
            pos = dm.end()
            if pos < n and skel[pos] == "(":
                close = match_paren(skel, pos)
                if close < 0:
                    return None
                pos = close + 1
            continue
        break
    m = _PY_DEF.match(skel, pos)
    if not m:
        return None
    close = match_paren(skel, m.end() - 1)
    if close < 0:
        return None
    params = [_split_param(code, a, b) for a, b in split_top(skel, m.end(), close, ",")]
    depth, colon = 0, -1
    for i in range(close + 1, n):
        ch = skel[i]
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == ":" and depth == 0:
            colon = i
            break
    if colon < 0:
        return None
    ret = code.clean[close + 1:colon].strip()
    ret = ret[2:].strip() if ret.startswith("->") else ""
    indent = pos - code.line_start(pos)
    return _PyFunc(m.group(2), params, ret, (colon + 1, _block_end(code, colon, indent)), pos)


def _py_base3(ann: str) -> Tuple[str, bool, bool]:
    """주석에서 (알맹이 타입 이름, Optional 여부, 목록으로 감쌌는가). `Optional[Item]` → (Item, True, False), `List[Item]` → (Item, False, True)."""
    t = re.sub(r"\s+", "", ann or "")
    optional = listed = False
    while True:
        m = re.match(r"^(?:typing\.)?(Optional|List|list|Sequence|Set|set|Tuple|tuple|Union)\[(.*)\]$", t)
        if not m:
            break
        optional = optional or m.group(1) in ("Optional", "Union")
        listed = listed or m.group(1) not in ("Optional", "Union")
        inner = m.group(2)
        if m.group(1) == "Union":
            inner = next((x for x in inner.split(",") if x != "None"), inner)
        t = inner.split(",")[0]
    if t.endswith("|None"):
        optional, t = True, t[:-5]
    return t.split("[", 1)[0].rsplit(".", 1)[-1], optional, listed         # Dict[str, int] → Dict


def _py_base(ann: str) -> Tuple[str, bool]:
    base, optional, _listed = _py_base3(ann)
    return base, optional


def _py_required(default: Optional[str], optional: bool) -> bool:
    """기본값이 없거나 `...` 이면 필수. Optional 이면서 기본값이 없으면 필수로 단정하지 않는다."""
    if default is None:
        return not optional
    d = default.strip()
    if d == "...":
        return True
    m = re.match(r"^\s*(?:\w+\.)*(?:Query|Path|Body|Form|File|Header|Cookie|Field)\s*\(\s*(\.\.\.|default\s*=\s*\.\.\.)?", d)
    return bool(m and m.group(1))


class PyWebScan:
    def __init__(self, repo: Repo, notes: List[str], on_file: Optional[Callable], should_cancel: Optional[Callable[[], bool]]):
        self.repo, self.notes, self.on_file = repo, notes, on_file
        self.should_cancel = should_cancel or (lambda: False)
        self.files: Dict[str, _PyFile] = {}
        self.models: Dict[str, List[_PyModel]] = {}
        self.kinds: Dict[tuple, str] = {}                # (파일, 변수) → FastAPI | APIRouter | Flask | Blueprint
        self.graph = Graph()
        self.read = 0
        self.flask = False
        self.fastapi = False

    def load(self) -> None:
        sources = self.repo.of(".py")
        modules = _PyModules([f.rel for f in sources])
        for f in sources:
            if self.should_cancel():
                return
            self.read += 1
            text = f.text
            f.release()
            try:
                pf = _parse_py(f.rel, text, modules)
            except Exception:                                   # 한 파일이 이상해도 나머지는 읽는다
                self.notes.append("읽지 못해 건너뛴 파일: %s" % f.rel)
                continue
            self.files[f.rel] = pf
            self.flask = self.flask or pf.uses_flask
            self.fastapi = self.fastapi or pf.uses_fastapi
            for mdl in pf.models.values():
                self.models.setdefault(mdl.name, []).append(mdl)
            for var, kind in pf.objs.items():
                self.kinds[(pf.rel, var)] = kind
        for pf in self.files.values():
            self._link(pf)

    # -- 라우터 그래프
    def _node(self, pf: _PyFile, name: str) -> tuple:
        """파일 안의 변수 이름 → 그래프 노드. 다른 파일에서 가져온 것이면 그 파일의 변수로 따라간다."""
        if name not in pf.objs and name in pf.imports and pf.imports[name][0] == "symbol":
            return (pf.imports[name][1], pf.imports[name][2])
        return (pf.rel, name)

    def _link(self, pf: _PyFile) -> None:
        for var, prefix in pf.prefixes.items():
            self.graph.own[(pf.rel, var)] = prefix
        for parent, call, span, kw in pf.includes:
            expr = pf.code.clean[span[0]:span[1]].strip()
            child = None
            if re.fullmatch(r"\w+", expr):
                child = self._node(pf, expr)
            else:
                m = re.fullmatch(r"(\w+)\s*\.\s*(\w+)", expr)
                if m and m.group(1) in pf.imports and pf.imports[m.group(1)][0] == "module":
                    child = (pf.imports[m.group(1)][1], m.group(2))
            if child is None:
                continue
            blueprint = call == "register_blueprint"
            given = _py_str(pf.code, kw.get("url_prefix" if blueprint else "prefix"))
            # Flask 는 등록할 때 준 url_prefix 가 블루프린트 자신의 것을 덮어쓴다. FastAPI 는 둘을 잇는다.
            self.graph.mount(self._node(pf, parent), child, given or "", replace=bool(given) and blueprint)

    # -- 엔드포인트
    def run(self) -> Tuple[List[SrcEndpoint], List[ControllerInfo]]:
        eps: List[SrcEndpoint] = []
        infos: List[ControllerInfo] = []
        for rel in sorted(self.files):
            if self.should_cancel():
                break
            pf = self.files[rel]
            if not pf.routes:
                continue
            try:
                got = self._file_endpoints(pf)
            except Exception:                                   # 한 파일이 이상해도 나머지는 읽는다
                self.notes.append("해석하지 못해 건너뛴 파일: %s" % rel)
                continue
            if not got:
                continue
            info = _info(infos, rel, pf.module, got)
            eps.extend(got)
            if self.on_file:
                self.on_file(info, list(got))
        eps.sort(key=lambda e: (e.file, e.line))
        return eps, infos

    def _is_flask(self, pf: _PyFile, r: _PyRoute) -> bool:
        return r.verb == "route" or self.kinds.get(self._node(pf, r.obj)) in _FLASK_KINDS

    def _file_endpoints(self, pf: _PyFile) -> List[SrcEndpoint]:
        code = pf.code
        out: List[SrcEndpoint] = []
        for r in pf.routes:
            fn = r.func
            body = code.clean[fn.body[0]:fn.body[1]]
            flask = self._is_flask(pf, r)
            path_tpl = flask_template(r.path) if flask else r.path
            methods = self._methods(pf, r)
            kind = self._kind(pf, r, body)
            params, vo = self._flask_params(r, path_tpl, body) if flask else self._fastapi_params(pf, r, path_tpl)
            title = self._title(pf, r)
            mode = "unknown" if kind == "page" else ("read" if all(x in ("GET", "HEAD", "OPTIONS") for x in methods) else "write")
            snippet = _snippet(code, r.start, fn.body[1])
            for prefix in self.graph.prefixes(self._node(pf, r.obj)):
                out.append(SrcEndpoint(
                    method=methods[0], path=join_path(prefix, path_tpl), file=pf.rel, line=code.line_of(fn.def_pos), cls=pf.module,
                    fn=fn.name, kind=kind, mode=mode, sql=None, mapper=None, ret=fn.ret, vo=vo,
                    deprecated=_py_bool(code, r.kwargs.get("deprecated")), title=title, params=_copy(params), snippet=snippet,
                    lang="py"))
        return out

    @staticmethod
    def _methods(pf: _PyFile, r: _PyRoute) -> List[str]:
        if r.verb in ("route", "api_route"):
            return [m.upper() for m in _py_str_list(pf.code, r.kwargs.get("methods"))] or ["GET"]
        return [r.verb.upper()]

    @staticmethod
    def _kind(pf: _PyFile, r: _PyRoute, body: str) -> str:
        rc = pf.code.clean[r.kwargs["response_class"][0]:r.kwargs["response_class"][1]] if "response_class" in r.kwargs else ""
        if _PY_FILE_SIG.search(body) or re.search(r"FileResponse|StreamingResponse", rc):
            return "file"
        if re.search(r"HTMLResponse|RedirectResponse", rc):
            return "page"
        if "response_model" in r.kwargs:
            return "api"
        if _PY_PAGE_SIG.search(body) and not _PY_DATA_SIG.search(body):
            return "page"
        return "api"

    @staticmethod
    def _title(pf: _PyFile, r: _PyRoute) -> str:
        """독스트링 첫 줄, 없으면 데코레이터의 summary=, 없으면 데코레이터 위 주석."""
        code, fn = pf.code, r.func
        body_skel = code.skel[fn.body[0]:fn.body[1]]
        lead = body_skel.lstrip()
        if lead[:3] in ('"""', "'''"):
            start = fn.body[0] + body_skel.index(lead[:3])
            close = code.skel.find(lead[:3], start + 3)
            if close > 0:
                t = summary([ln.strip() for ln in code.clean[start + 3:close].split("\n")])
                if t:
                    return t
        s = _py_str(code, r.kwargs.get("summary"))
        return s.strip() if s else comment_summary(code.above(r.start))

    # -- 파라미터
    @staticmethod
    def _flask_params(r: _PyRoute, path_tpl: str, body: str) -> Tuple[List[SrcParam], Optional[str]]:
        conv = {name: t for t, name in re.findall(r"<(\w+):(\w+)>", r.path)}
        out = [SrcParam(v, conv.get(v, ""), True, "path", "") for v in path_vars(path_tpl)]
        found: List[Tuple[int, str, str]] = []
        for m in re.finditer(r"""\brequest\s*\.\s*(args|form|values)\s*(?:\.\s*(?:get|getlist)\s*\(\s*|\[\s*)(['"])([^'"\n]+)\2""", body):
            found.append((m.start(), "query" if m.group(1) in ("args", "values") else "form", m.group(3)))
        for m in re.finditer(r"""\brequest\s*\.\s*(?:json|get_json\s*\([^)]*\))\s*(?:\.\s*get\s*\(\s*|\[\s*)(['"])([^'"\n]+)\1""", body):
            found.append((m.start(), "body", m.group(2)))
        for var in set(re.findall(r"(\w+)\s*=\s*request\s*\.\s*(?:get_json\s*\([^)]*\)|json\b)", body)):
            for m in re.finditer(r"""\b%s\s*(?:\.\s*get\s*\(\s*|\[\s*)(['"])([^'"\n]+)\1""" % re.escape(var), body):
                found.append((m.start(), "body", m.group(2)))
        found.sort(key=lambda x: x[0])
        return _unique(out + [SrcParam(name, "", False, loc, "") for _p, loc, name in found]), None

    def _fastapi_params(self, pf: _PyFile, r: _PyRoute, path_tpl: str) -> Tuple[List[SrcParam], Optional[str]]:
        pvars = path_vars(path_tpl)
        out: List[SrcParam] = []
        vo: Optional[str] = None
        for name, ann, default in r.func.params:
            if not name or name in ("self", "cls", "/", "*") or name.startswith("*"):
                continue
            meta, core = default or "", ann
            am = re.match(r"^(?:typing\.|typing_extensions\.)?Annotated\s*\[\s*(.*)\]\s*$", ann, re.S)
            if am:
                inner = am.group(1)
                parts = [inner[a:b].strip() for a, b in split_top(inner, 0, len(inner), ",")]
                core = parts[0] if parts else ""
                meta = " ".join(parts[1:]) + " " + meta
            if "Depends(" in meta or "Depends(" in ann or "Security(" in meta:
                continue
            tname, optional, listed = _py_base3(core)
            if tname in _PY_SKIP_TYPES:
                continue
            mm = _PY_META.match(meta)
            kind = mm.group(1) if mm else ""
            if kind in ("Header", "Cookie"):
                continue
            required = _py_required(default, optional)
            if name in pvars:
                out.append(SrcParam(name, core, True, "path", ""))
                continue
            model = self._model_of(tname) if tname[:1].isupper() else None
            if model is not None and kind in ("", "Body", "Query", "Form"):
                if listed:                                   # 모델의 목록이 본문이면 필드로 펼 수 없다
                    out.append(SrcParam(name, core, required, "body", ""))
                    continue
                loc = {"Query": "query", "Form": "form"}.get(kind, "body")
                out.extend(SrcParam(f.name, f.type, f.required, loc, f.desc) for f in self._model_fields(model))
                vo = vo or model.name
                continue
            if tname == "UploadFile" or kind in ("File", "Form"):
                out.append(SrcParam(name, core, required, "form", ""))
                continue
            if kind:
                loc = {"Body": "body", "Path": "path"}.get(kind, "query")
            elif listed or tname in _PY_BODY_TYPES or (tname in self.models and not self._is_enum(tname)):
                # 목록·사전, 저장소의 모델이 아닌 클래스(데이터클래스 등)는 본문이다. List[str] 도 Query() 를 붙이지 않으면 FastAPI 는 본문으로 읽는다.
                loc = "body"
            else:
                loc = "query"                                # 나머지(단순 타입, 열거형, 소스에 없는 타입)는 쿼리
            out.append(SrcParam(name, core, required or loc == "path", loc, ""))
        for v in pvars:
            if not any(p.name == v and p.loc == "path" for p in out):
                out.insert(0, SrcParam(v, "", True, "path", ""))
        return _unique(out), vo

    # -- pydantic
    def _is_enum(self, name: str, seen: tuple = ()) -> bool:
        if name in seen:
            return False
        for mdl in self.models.get(name, []):
            if any(b in ("Enum", "IntEnum", "StrEnum") or self._is_enum(b, seen + (name,)) for b in mdl.bases):
                return True
        return False

    def _model_of(self, name: str) -> Optional[_PyModel]:
        return next((m for m in self.models.get(name, []) if self._is_pydantic(m, ())), None)

    def _is_pydantic(self, mdl: _PyModel, seen: tuple) -> bool:
        if mdl.name in seen:
            return False
        for b in mdl.bases:
            if b in ("BaseModel", "SQLModel", "BaseSettings"):
                return True
            if any(self._is_pydantic(p, seen + (mdl.name,)) for p in self.models.get(b, [])):
                return True
        return False

    def _model_fields(self, mdl: _PyModel, depth: int = 0) -> List[SrcParam]:
        """모델과 저장소 안 부모 모델의 필드. 자식 것이 먼저."""
        if mdl.fields is not None:
            return mdl.fields
        mdl.fields = []
        out = _own_fields(mdl)
        if depth < 6:
            for b in mdl.bases:
                for parent in self.models.get(b, [])[:1]:
                    if parent is not mdl:
                        out += [f for f in self._model_fields(parent, depth + 1) if all(f.name != o.name for o in out)]
        mdl.fields = out
        return out


def _own_fields(mdl: _PyModel) -> List[SrcParam]:
    """클래스 본문에서 `이름: 타입 = 기본값` 줄을 읽는다. 괄호가 열린 채 끝난 줄(Field(...))은 닫힐 때까지 한 줄로 본다."""
    code = mdl.pf.code
    skel, raw = code.skel, code.raw
    indent = mdl.start - code.line_start(mdl.start)
    end = _block_end(code, mdl.header_end, indent)
    out: List[SrcParam] = []
    base_indent: Optional[int] = None
    pos = raw.find("\n", mdl.header_end) + 1
    while 0 < pos < end:
        nxt = raw.find("\n", pos)
        line_end = nxt if nxt >= 0 else len(raw)
        text = skel[pos:line_end]
        if not text.strip():
            pos = line_end + 1
            continue
        cur = len(text) - len(text.lstrip())
        base_indent = cur if base_indent is None else base_indent
        stmt_end = line_end
        depth = sum(text.count(c) for c in "([{") - sum(text.count(c) for c in ")]}")
        while depth > 0 and stmt_end < end:
            nxt2 = raw.find("\n", stmt_end + 1)
            nxt2 = nxt2 if nxt2 >= 0 else len(raw)
            seg = skel[stmt_end + 1:nxt2]
            depth += sum(seg.count(c) for c in "([{") - sum(seg.count(c) for c in ")]}")
            stmt_end = nxt2
        stripped = text.lstrip()
        if cur == base_indent and re.match(r"[A-Za-z]\w*\s*:", stripped) and not stripped.startswith(("def ", "class ", "async ")):
            name, ann, default = _split_param(code, pos + cur, stmt_end)
            _base, optional = _py_base(ann)
            if not ann.startswith("ClassVar") and not name.startswith("_"):
                alias, desc = None, ""
                if default and default.lstrip().startswith(("Field(", "pydantic.Field(")):
                    am = re.search(r"""alias\s*=\s*(['"])(.*?)\1""", default)
                    dm = re.search(r"""description\s*=\s*(['"])(.*?)\1""", default)
                    alias, desc = (am.group(2) if am else None), (dm.group(2) if dm else "")
                if not desc:
                    code_end = stmt_end
                    while code_end > pos and skel[code_end - 1] in " \t":      # 꼬리 주석은 공백으로 가려져 있다
                        code_end -= 1
                    c = code.trailing(code_end)
                    desc = comment_summary([c]) if c else ""
                out.append(SrcParam(alias or name, ann, _py_required(default, optional), "body", desc))
        pos = stmt_end + 1
    return out


def scan_pyweb(repo: Repo, notes: List[str], on_file: Optional[Callable] = None,
               should_cancel: Optional[Callable[[], bool]] = None) -> ScanResult:
    sc = PyWebScan(repo, notes, on_file, should_cancel)
    sc.load()
    eps, infos = sc.run()
    label = "FastAPI, Flask" if sc.fastapi and sc.flask else "Flask" if sc.flask else "FastAPI"
    return ScanResult(framework=label, endpoints=eps, files=sc.read, controllers=infos, sql_counts={}, notes=notes)

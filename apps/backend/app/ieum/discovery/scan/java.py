"""스프링 MVC · 전자정부(eGovFrame) · 스프링 부트 소스 분석.

컨트롤러의 URL 매핑·파라미터를 읽고, 컨트롤러 → 서비스 → DAO/매퍼 → SQL 구문까지 호출 사슬을 따라가
읽기 API 인지 쓰기 API 인지 정한다. 메서드 이름만으로 정하지 않는 것이 핵심이다 — `approvePo` 처럼 읽기
같은 이름이 UPDATE 를 하거나 그 반대일 수 있다. 사슬로 못 찾았을 때만 이름으로 보수적으로 추정한다.
"""
import re
from typing import Callable, Dict, List, Optional, Set, Tuple

from .jparse import (
    JavaIndex, JClass, JField, JMethod, JParam, anno_args, base_type, eval_str, parse_java, simple_name, str_list, unescape,
)
from .lexer import Code, comment_summary, doc_lines, match_paren, param_docs, split_top
from .model import ControllerInfo, ScanResult, SrcEndpoint, SrcParam
from .mybatis import ANNOTATION_KINDS, STRENGTH, StatementIndex, Stmt
from .paths import join_path
from .source import Repo

MAX_DEPTH = 5                  # 호출 사슬을 따라가는 최대 깊이(컨트롤러 본문 = 0)
SNIPPET_LINES = 40

MAPPING_VERBS = {
    "RequestMapping": None, "GetMapping": "GET", "PostMapping": "POST",
    "PutMapping": "PUT", "PatchMapping": "PATCH", "DeleteMapping": "DELETE",
}

# 어노테이션이 없는 인자 중 요청 데이터가 아닌 것(서블릿 객체, 모델, 세션 ...)
INFRA_TYPES = frozenset({
    "HttpServletRequest", "HttpServletResponse", "ServletRequest", "ServletResponse", "HttpSession",
    "Model", "ModelMap", "ModelAndView", "ExtendedModelMap", "BindingResult", "Errors", "Principal",
    "Locale", "RedirectAttributes", "SessionStatus", "WebRequest", "NativeWebRequest",
    "MultipartHttpServletRequest", "MultipartRequest", "HttpEntity", "RequestEntity", "Authentication",
    "UriComponentsBuilder", "Pageable", "Writer", "Reader", "InputStream", "OutputStream", "HttpMethod",
    "TimeZone", "ZoneId", "ServletContext", "Map", "Object",
})
FILE_TYPES = frozenset({"MultipartFile", "Part"})
SIMPLE_TYPES = frozenset({
    "String", "int", "long", "short", "byte", "char", "float", "double", "boolean", "Integer", "Long", "Short",
    "Byte", "Character", "Float", "Double", "Boolean", "BigDecimal", "BigInteger", "Date", "LocalDate",
    "LocalDateTime", "LocalTime", "ZonedDateTime", "OffsetDateTime", "Instant", "Timestamp", "UUID", "Number",
})
COLLECTION_TYPES = frozenset({"List", "Set", "Collection", "Iterable", "ArrayList"})
# 값 검증용이라 바인딩 방식을 바꾸지 않는 어노테이션. 이 밖의 어노테이션이 붙은 인자는 커스텀 리졸버가 채우는 것일 수 있어 요청 파라미터로 보지 않는다.
BENIGN_PARAM_ANNOS = frozenset({"Valid", "Validated", "NotNull", "NotBlank", "NotEmpty", "Nullable", "NonNull", "Size", "Min", "Max",
                                "Pattern", "Email", "Positive", "PositiveOrZero", "Digits", "Past", "Future"})
# 요청 데이터가 아닌 것을 가져오는 어노테이션
NON_PARAM_ANNOS = ("RequestHeader", "CookieValue", "SessionAttribute", "RequestAttribute", "AuthenticationPrincipal",
                   "Value", "MatrixVariable", "SessionAttributes")

_FILE_BODY = re.compile(r"(?i)content[-_]disposition|\bgetOutputStream\s*\(")
# excelView, downloadView, poExcelView, excelDownView 처럼 내려받기용 뷰. downloadPopupView 같은 화면은 아니다.
_FILE_VIEW_NAME = re.compile(r"(?i)^[\w./-]*(?:excel|xlsx?|download|pdf)(?:down(?:load)?|export)?view$")
_FILE_VIEW_CLASS = re.compile(r"\b\w*(?:Excel|Xlsx?|Download|Pdf)(?:Down(?:load)?|Export)?View\b")
_JSON_VIEW_CLASS = re.compile(r"\bMappingJackson2?JsonView\b")
_GET_WRITER = re.compile(r"\bgetWriter\s*\(")
# 내려받기용 반환 타입. UserResource 같은 DTO 이름과 헷갈리지 않게 스프링의 리소스 클래스만 센다.
_FILE_RET = re.compile(r"\b(?:Resource|ByteArrayResource|FileSystemResource|InputStreamResource|UrlResource|ClassPathResource|PathResource"
                       r"|StreamingResponseBody)\b|byte\[\]")
_GETPARAM = re.compile(r'\b\w+\s*\.\s*getParameter(?:Values)?\s*\(\s*"([^"\n]*)"\s*\)')
_STR_LIT = re.compile(r'"\x00*"')
_STMT_KEY = re.compile(r"^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$")
_DOTLESS_CTX = re.compile(r"(?i)\b(?:select|insert|update|delete|list|query|call|batch|execute)\w*\s*\(\s*$")
_CALL = re.compile(r"(?<![\w$.])(?:this\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(")
_SELF = re.compile(r"(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(")
_GETMAPPER = re.compile(r"\bgetMapper\s*\(\s*([A-Za-z_$][\w$.]*)\s*\.\s*class\s*\)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(")
_LOCAL = re.compile(r"(?<![\w$.])([A-Z][\w$]*)(?:<[^;(){}=]*>)?(?:\[\])*\s+([a-z_$][\w$]*)\s*[=;,)]")
_NEW_BEFORE = re.compile(r"\bnew\s+$")
_GENERIC_ARGS = re.compile(r"(?<=[\w$])<[\w$.,?\s\[\]]*>")
# 코드 안에 SQL 을 문자열로 적은 DAO(JdbcTemplate 등). 로그 문구(`"Update failed"`)와 헷갈리지 않게 문장 꼴까지 본다.
_RAW_SQL = re.compile(
    r"^\s*(?:(?P<select>select)\s[\s\S]*?\bfrom\b|(?P<insert>insert)\s+into\b|(?P<update>update)\s+[\w.`\"\[\]]+\s+set\b|"
    r"(?P<delete>delete)\s+from\b|(?P<merge>merge)\s+into\b)", re.I)
_RAW_KIND = {"select": "SELECT", "insert": "INSERT", "update": "UPDATE", "delete": "DELETE", "merge": "UPDATE"}
_SERVICE_LIKE = re.compile(r"(?:Service|ServiceImpl|Svc|DAO|Dao|Mapper|Repository|Repo|Manager|Biz|Facade|Logic|Handler)$")
_KEYWORDS = frozenset({"if", "for", "while", "switch", "catch", "return", "new", "super", "this", "synchronized", "try",
                      "else", "do", "throw", "assert", "case"})
# 호출 사슬로 SQL 을 못 찾았을 때 메서드 이름으로 보수적으로 추정한다. 접두어 뒤에 소문자가 이어지면
# 다른 단어다(address ≠ add, setting ≠ set). register 는 reg 의 풀어 쓴 것이라 따로 둔다.
_READ_NAME = re.compile(r"^(?i:select|get|list|search|find|query|count|view|detail|inq|inquiry|check|chk)(?![a-z])")
_WRITE_NAME = re.compile(
    r"^(?i:insert|save|update|delete|remove|create|modify|cancel|approve|reg|regist|register|add|apply|proc|process|set|merge|send|submit)(?![a-z])")


# ---------------------------------------------------------------- 작은 도우미
def string_literals(code: Code, a: int, b: int) -> List[str]:
    return [unescape(code.clean[m.start() + 1:m.end() - 1]) for m in _STR_LIT.finditer(code.skel, a, b)]


def raw_sql_kind(lit: str) -> Optional[str]:
    """문자열 리터럴이 SQL 문장이면 그 종류."""
    m = _RAW_SQL.match(lit)
    return _RAW_KIND[m.lastgroup] if m else None


def _argc(skel: str, open_idx: int, hi: int) -> int:
    """호출 인자 수. 세지 못하면 -1(그 경우 이름이 같은 오버로드를 전부 따라간다)."""
    close = match_paren(skel, open_idx, hi)
    if close < 0:
        return -1
    text = skel[open_idx + 1:close]
    while True:                                              # new HashMap<String, Object>() 의 쉼표는 인자 구분이 아니다
        nxt = _GENERIC_ARGS.sub("", text)
        if nxt == text:
            break
        text = nxt
    return len(split_top(text, 0, len(text), ","))


def _by_argc(methods: List[JMethod], argc: int) -> List[JMethod]:
    """오버로드 중 인자 수가 맞는 것. 맞는 게 없으면(가변 인자, 세기 실패) 전부 — 놓치는 것보다 넓게 보는 쪽이 안전하다."""
    exact = [m for m in methods if len(m.params) == argc]
    return exact or methods


def name_mode(name: str) -> str:
    """메서드 이름만으로 한 추정. 모르면 unknown."""
    if _WRITE_NAME.match(name):
        return "write"
    if _READ_NAME.match(name):
        return "read"
    return "unknown"


def _loc_simple(http_method: Optional[str], has_body: bool) -> str:
    return "form" if http_method == "POST" and not has_body else "query"


def _loc_vo(http_method: Optional[str]) -> str:
    # 메서드 지정이 없으면 GET 도 받으니 어느 쪽에서나 되는 쿼리로 둔다.
    return "query" if http_method in (None, "GET", "HEAD", "OPTIONS") else "form"


class _Hit:
    __slots__ = ("kind", "label")

    def __init__(self, kind: str, label: str):
        self.kind, self.label = kind, label


class _Info:
    """컨트롤러 메서드 하나에서 읽어 낸 것. 경로가 여러 개면 엔드포인트가 여럿이 되지만 이 정보는 하나다."""
    __slots__ = ("kind", "params", "vo", "ret", "title", "snippet", "deprecated", "mode", "sql", "mapper", "guessed")


# ---------------------------------------------------------------- 호출 사슬 추적
class Tracer:
    """컨트롤러 본문에서 시작해 서비스 → 구현체 → DAO/매퍼 → SQL 구문을 따라간다."""

    def __init__(self, index: JavaIndex, stmts: StatementIndex):
        self.index = index
        self.stmts = stmts
        self._field_map: Dict[int, Dict[str, JField]] = {}

    def fields(self, cls: JClass) -> Dict[str, JField]:
        got = self._field_map.get(id(cls))
        if got is None:
            got = {f.name: f for f in self.index.fields_of(cls)}
            self._field_map[id(cls)] = got
        return got

    def events(self, m: JMethod) -> List[tuple]:
        """본문에서 뽑은 (위치, 종류, ...) 목록. 한 번만 계산해 메서드에 붙여 둔다."""
        if m._info is not None:
            return m._info
        ev: List[tuple] = []
        if m.body:
            code = m.cls.file.code
            skel = code.skel
            a, b = m.body[0] + 1, m.body[1]
            for sm in _STR_LIT.finditer(skel, a, b):
                lit = unescape(code.clean[sm.start() + 1:sm.end() - 1])
                raw = raw_sql_kind(lit)
                if raw:
                    ev.append((sm.start(), "sql", raw))
                    continue
                if not _STMT_KEY.match(lit) or len(lit) < 3:
                    continue
                if "." not in lit and not _DOTLESS_CTX.search(skel, max(a, sm.start() - 40), sm.start()):
                    continue
                ev.append((sm.start(), "str", lit))
            for cm in _CALL.finditer(skel, a, b):
                argc = _argc(skel, cm.end() - 1, b)
                if cm.group(1) in ("this", "super"):                    # this.helper() 는 같은 클래스 호출이다
                    ev.append((cm.start(), "self", cm.group(2), argc))
                else:
                    ev.append((cm.start(), "call", cm.group(1), cm.group(2), argc))
            for cm in _GETMAPPER.finditer(skel, a, b):
                ev.append((cm.start(), "mapper", cm.group(1), cm.group(2)))
            for cm in _SELF.finditer(skel, a, b):
                if cm.group(1) not in _KEYWORDS and not _NEW_BEFORE.search(skel, max(a, cm.start() - 8), cm.start()):
                    ev.append((cm.start(), "self", cm.group(1), _argc(skel, cm.end() - 1, b)))
            ev.sort(key=lambda e: e[0])
        m._info = ev
        return ev

    def locals_of(self, m: JMethod) -> Dict[str, str]:
        out = {p.name: p.type for p in m.params}
        if m.body:
            skel = m.cls.file.code.skel
            for lm in _LOCAL.finditer(skel, m.body[0] + 1, m.body[1]):
                out.setdefault(lm.group(2), lm.group(1))
        return out

    # -- 진입점
    def trace(self, m: JMethod) -> Tuple[List[_Hit], List[str]]:
        """(사슬에서 찾은 구문들, 서비스 계층 첫 호출들의 메서드 이름)."""
        hits: List[_Hit] = []
        self._walk(m.cls, m, 0, set(), hits)
        return hits, self._first_hop_names(m.cls, m)

    def _first_hop_names(self, cls: JClass, m: JMethod) -> List[str]:
        fields = self.fields(cls)
        names = []
        for ev in self.events(m):
            if ev[1] == "call":
                f = fields.get(ev[2])
                if f is not None and _SERVICE_LIKE.search(simple_name(f.type)):
                    names.append(ev[3])
        return names

    # -- 사슬 걷기
    def _walk(self, ctx: JClass, m: JMethod, depth: int, seen: Set[int], hits: List[_Hit]) -> None:
        if id(m) in seen:
            return
        seen.add(id(m))
        types = None
        for ev in self.events(m):
            kind = ev[1]
            if kind == "str":
                st = self.stmts.find(ev[2])
                if st:
                    hits.append(_Hit(st.kind, self._literal_label(ev[2], st)))
            elif kind == "call":
                if types is None:
                    types = self.locals_of(m)
                self._typed_call(ctx, types, ev[2], ev[3], ev[4], depth, seen, hits)
            elif kind == "sql":
                hits.append(_Hit(ev[2], "%s.%s" % (m.cls.name, m.name)))      # 코드에 적힌 SQL: 그 SQL 이 든 메서드가 근거 위치다
            elif kind == "mapper":
                for k in self.index.resolve(ev[2], ctx.file)[:1]:
                    self._interface_stmt(k, ev[3], hits)
            elif depth < MAX_DEPTH:
                for tm in _by_argc(self.index.methods_named(ctx, ev[2]), ev[3]):
                    self._walk(tm.cls, tm, depth + 1, seen, hits)

    def _typed_call(self, ctx: JClass, types: Dict[str, str], var: str, name: str, argc: int, depth: int, seen: Set[int], hits: List[_Hit]) -> None:
        tname = types.get(var)
        if tname is None:
            f = self.fields(ctx).get(var)
            tname = f.type if f is not None else None
        if tname is None and var[:1].isupper():
            tname = var                                         # 정적 호출 PoUtil.calc(..)
        if tname is None:
            return
        for k in self.index.resolve(tname, ctx.file)[:4]:
            self._enter(k, name, argc, depth, seen, hits)

    def _enter(self, k: JClass, name: str, argc: int, depth: int, seen: Set[int], hits: List[_Hit]) -> None:
        if k.kind == "interface" or k.abstract:
            if k.kind == "interface" and self._interface_stmt(k, name, hits):
                return                                          # 매퍼 인터페이스: 구현체 없이 구문으로 이어진다
            targets = [(k, k.methods.get(name, []))] + [(s, self.index.methods_named(s, name)) for s in self.index.subs_of(k)]
        else:
            targets = [(k, self.index.methods_named(k, name))]
        if depth >= MAX_DEPTH:
            return
        for _c, methods in targets:
            for tm in _by_argc(methods, argc):
                if tm.body:
                    self._walk(tm.cls, tm, depth + 1, seen, hits)

    def _interface_stmt(self, k: JClass, method: str, hits: List[_Hit]) -> bool:
        st = self.stmts.find("%s.%s" % (k.fqcn, method)) or self.stmts.find("%s.%s" % (k.name, method))
        if st is None:
            return False
        hits.append(_Hit(st.kind, "%s.%s" % (k.name, method)))
        return True

    def _literal_label(self, lit: str, st: Stmt) -> str:
        """`budgetDAO.selectBudgetRemain` → `BudgetDAO.selectBudgetRemain`(빈 이름을 소스의 클래스 이름으로 맞춘다)."""
        if "." in lit:
            head, _, ident = lit.rpartition(".")
            owner = self.index.canonical_name(head.rsplit(".", 1)[-1])
        else:
            ident = lit
            owner = self.index.canonical_name(st.ns.rsplit(".", 1)[-1]) if st.ns else ""
        return "%s.%s" % (owner, ident) if owner else ident


# ---------------------------------------------------------------- 분석기
class SpringScan:
    def __init__(self, repo: Repo, notes: List[str], on_file: Optional[Callable], should_cancel: Optional[Callable[[], bool]]):
        self.repo = repo
        self.notes = notes
        self.on_file = on_file
        self.should_cancel = should_cancel or (lambda: False)
        self.index = JavaIndex()
        self.stmts = StatementIndex()
        self.build_texts: List[str] = []
        self.files = 0
        self.tracer: Optional[Tracer] = None
        self.n_path_fail = 0
        self.n_guessed = 0
        self.n_unknown = 0
        self.missing_vo: Set[str] = set()
        self.has_ibatis_import = False
        self.egov_pkg = False

    # -- 읽기
    def load(self) -> bool:
        """소스를 읽어 색인한다. 중간에 취소되면 False."""
        for f in self.repo.of(".java"):
            if self.should_cancel():
                return False
            self.files += 1
            try:
                jf = parse_java(f.rel, f.text)
            except Exception:                                   # 한 파일이 이상해도 나머지는 읽는다
                self.notes.append("읽지 못해 건너뛴 자바 파일: %s" % f.rel)
                f.release()
                continue
            f.release()
            self.index.add(jf)
            if jf.package.startswith("egovframework."):
                self.egov_pkg = True
            if not self.has_ibatis_import and any(fq.startswith(("org.apache.ibatis.", "org.mybatis.")) for fq in jf.imports.values()):
                self.has_ibatis_import = True
        for f in self.repo.of(".xml"):
            if self.should_cancel():
                return False
            self.files += 1
            text = f.text
            if f.name == "pom.xml":
                self.build_texts.append(text)
            else:
                try:
                    self.stmts.add_xml(f.rel, text)
                except Exception:                               # 매퍼 하나가 이상해도 나머지는 읽는다
                    self.notes.append("읽지 못해 건너뛴 XML 파일: %s" % f.rel)
            f.release()
        for f in self.repo.of(".gradle"):
            self.files += 1
            self.build_texts.append(f.text)
            f.release()
        self.index.finish()
        for jf in self.index.files:
            for c in jf.classes:
                if c.kind != "interface":
                    continue
                for m in c.method_list():
                    for a in m.annos:
                        if a.name in ANNOTATION_KINDS:
                            self.stmts.add_annotation(c.fqcn, c.name, m.name, ANNOTATION_KINDS[a.name], jf.rel)
                        elif a.name == "Query":                          # 스프링 데이터 @Query: MyBatis 가 아니라 라벨에는 안 센다
                            kind = self._query_kind(c, m, a)
                            if kind:
                                self.stmts.add_annotation(c.fqcn, c.name, m.name, kind, jf.rel, flavor="jpa")
        self.tracer = Tracer(self.index, self.stmts)
        return True

    def _query_kind(self, c: JClass, m: JMethod, a) -> Optional[str]:
        span = anno_args(c.code, a).get("value")
        text = eval_str(c.code, span[0], span[1], self.index.const) if span else None
        word = re.match(r"\s*(\w+)", text or "")
        kind = {"select": "SELECT", "from": "SELECT", "insert": "INSERT", "update": "UPDATE", "delete": "DELETE"}.get(word.group(1).lower()) if word else None
        return kind

    # -- 컨트롤러
    def controllers(self) -> List[JClass]:
        return [c for jf in self.index.files for c in jf.classes
                if c.kind == "class" and (c.has("Controller", "RestController") or c.has("RequestMapping"))]

    def run(self) -> Tuple[List[SrcEndpoint], List[ControllerInfo]]:
        eps: List[SrcEndpoint] = []
        infos: List[ControllerInfo] = []
        for cls in self.controllers():
            if self.should_cancel():
                break
            try:
                got = self._class_endpoints(cls)
            except Exception:                                   # 한 컨트롤러가 이상해도 나머지는 읽는다
                self.notes.append("해석하지 못해 건너뛴 컨트롤러: %s" % cls.file.rel)
                continue
            if not got:
                continue
            info = ControllerInfo(cls.file.rel, cls.name,
                                  api=sum(1 for e in got if e.kind in ("api", "file")),
                                  page=sum(1 for e in got if e.kind == "page"),
                                  deprecated=sum(1 for e in got if e.deprecated))
            infos.append(info)
            eps.extend(got)
            if self.on_file:
                self.on_file(info, list(got))
        eps.sort(key=lambda e: (e.file, e.line))
        return eps, infos

    def _class_endpoints(self, cls: JClass) -> List[SrcEndpoint]:
        code = cls.code
        prefixes, cls_methods = self._class_mapping(cls)
        out: List[SrcEndpoint] = []
        for m in cls.method_list():
            mp = self._method_mapping(cls, m)
            if mp is None:
                continue
            paths, methods = mp
            if paths is None or prefixes is None:
                self.n_path_fail += 1
                continue
            methods = methods or cls_methods
            http_method = methods[0] if methods else None
            info = self._info(cls, m, http_method)
            line = code.line_of(m.name_pos)
            for pre in prefixes:
                for p in paths:
                    out.append(SrcEndpoint(
                        method=http_method, path=join_path(pre, p), file=cls.file.rel, line=line, cls=cls.name, fn=m.name,
                        kind=info.kind, mode=info.mode, sql=info.sql, mapper=info.mapper, ret=info.ret, vo=info.vo,
                        deprecated=info.deprecated, title=info.title,
                        params=[SrcParam(q.name, q.type, q.required, q.loc, q.desc) for q in info.params],
                        snippet=info.snippet, lang="java"))
        return out

    # -- 매핑
    def _class_mapping(self, cls: JClass) -> Tuple[Optional[List[str]], List[str]]:
        """(클래스 접두사 목록 또는 해석 불가 None, 클래스에 지정된 HTTP 메서드)."""
        a = cls.anno("RequestMapping")
        if a is None:
            return [""], []
        args = anno_args(cls.code, a)
        return self._paths(cls.code, args), _methods_of(cls.code, args.get("method"))

    def _method_mapping(self, cls: JClass, m: JMethod) -> Optional[Tuple[Optional[List[str]], List[str]]]:
        for a in m.annos:
            if a.name not in MAPPING_VERBS:
                continue
            args = anno_args(cls.code, a)
            verb = MAPPING_VERBS[a.name]
            return self._paths(cls.code, args), ([verb] if verb else _methods_of(cls.code, args.get("method")))
        return None

    def _paths(self, code: Code, args: Dict[str, Tuple[int, int]]) -> Optional[List[str]]:
        """value/path 의 경로 목록. 지정이 없으면 [""] (접두사만 쓴다). 상수·식을 못 풀면 None."""
        span = args.get("value") or args.get("path")
        if not span:
            return [""]
        paths = str_list(code, span, self.index.const)
        if paths is None:
            return None
        return paths or [""]

    # -- 메서드 하나
    def _info(self, cls: JClass, m: JMethod, http_method: Optional[str]) -> _Info:
        code = cls.code
        info = _Info()
        info.ret = m.ret
        if m.body:
            ba, bb = m.body[0] + 1, m.body[1]
            bclean, bskel = code.clean[ba:bb], code.skel[ba:bb]
            literals = string_literals(code, ba, bb)
        else:
            bclean = bskel = ""
            literals = []
        info.kind = self._kind(cls, m, bclean, bskel, literals)
        above = code.above(m.start)
        doc = next((c for c in above if c.kind == "doc"), None)
        doc_ls = doc_lines(doc.text) if doc else []
        info.title = comment_summary(above) or self._swagger_title(code, m)
        info.deprecated = m.has("Deprecated") or cls.has("Deprecated") or any(ln.startswith("@deprecated") for ln in doc_ls)
        info.params, info.vo = self._params(cls, m, http_method, bclean, param_docs(doc_ls))
        info.snippet = _snippet(code, m.start, m.end)
        info.mode, info.sql, info.mapper, info.guessed = "unknown", None, None, False
        if info.kind != "page":
            self._judge(cls, m, info)
        return info

    def _swagger_title(self, code: Code, m: JMethod) -> str:
        for a in m.annos:
            key = "summary" if a.name == "Operation" else "value" if a.name == "ApiOperation" else None
            if key:
                span = anno_args(code, a).get(key)
                v = eval_str(code, span[0], span[1], self.index.const) if span else None
                if v:
                    return v.strip()
        return ""

    def _kind(self, cls: JClass, m: JMethod, bclean: str, bskel: str, literals: List[str]) -> str:
        if (_FILE_BODY.search(bclean) or _FILE_VIEW_CLASS.search(bskel) or _FILE_RET.search(m.ret)
                or any(_FILE_VIEW_NAME.match(s) for s in literals)):
            return "file"
        base = base_type(m.ret)
        if (m.has("ResponseBody") or cls.has("RestController", "ResponseBody") or base == "ResponseEntity"
                or _JSON_VIEW_CLASS.search(bskel) or any(s.lower() == "jsonview" for s in literals)
                or (base == "void" and _GET_WRITER.search(bskel))):
            return "api"
        return "page"

    def _judge(self, cls: JClass, m: JMethod, info: _Info) -> None:
        """읽기/쓰기 판정. 사슬에서 찾은 가장 강한 구문이 정한다. 못 찾으면 이름으로 추정."""
        hits, hop_names = self.tracer.trace(m)
        if hits:
            best = hits[0]
            for h in hits[1:]:
                if STRENGTH[h.kind] > STRENGTH[best.kind]:
                    best = h
            info.sql, info.mapper = best.kind, best.label
            info.mode = "read" if best.kind == "SELECT" else "write"
            return
        modes = [name_mode(n) for n in hop_names + [m.name]]
        info.mode = "write" if "write" in modes else "read" if "read" in modes else "unknown"
        info.guessed = info.mode != "unknown"
        if info.guessed:
            self.n_guessed += 1
        else:
            self.n_unknown += 1

    # -- 파라미터
    def _params(self, cls: JClass, m: JMethod, http_method: Optional[str], bclean: str, docs: Dict[str, str]) -> Tuple[List[SrcParam], Optional[str]]:
        has_body = any(p.has("RequestBody") for p in m.params)
        out: List[SrcParam] = []
        vo: Optional[str] = None
        for p in m.params:
            if p.has(*NON_PARAM_ANNOS):
                continue
            got, vo_name = self._one_param(cls, p, http_method, has_body, bclean, docs)
            out.extend(got)
            vo = vo or vo_name
        uniq: List[SrcParam] = []
        keys: Set[Tuple[str, str]] = set()
        for q in out:                                            # VO 를 둘 받는데 하나가 다른 하나를 상속하면 필드가 겹친다
            if (q.name, q.loc) not in keys:
                keys.add((q.name, q.loc))
                uniq.append(q)
        seen = {q.name for q in uniq}
        for name in _GETPARAM.findall(bclean):
            if name and name not in seen:
                seen.add(name)
                uniq.append(SrcParam(name, "String", False, _loc_simple(http_method, has_body), ""))
        return uniq, vo

    def _one_param(self, cls: JClass, p: JParam, http_method: Optional[str], has_body: bool, bclean: str, docs: Dict[str, str]) -> Tuple[List[SrcParam], Optional[str]]:
        code = cls.code
        base = base_type(p.type)
        inner = _unwrap(p.type)
        if p.has("PathVariable"):
            a = p.anno("PathVariable")
            args = anno_args(code, a)
            name = _name_arg(code, args) or p.name
            req = _bool_arg(code, args.get("required"), True)
            return [SrcParam(name, p.type, req, "path", self._param_desc(cls, p, docs))], None
        if p.has("RequestBody"):
            return self._expand_or_keys(cls, p, inner, "body", bclean)
        if p.has("RequestParam", "RequestPart"):
            a = p.anno("RequestParam") or p.anno("RequestPart")
            args = anno_args(code, a)
            if base in ("Map", "MultiValueMap", "HashMap", "LinkedHashMap"):
                return self._map_keys(p, _loc_simple(http_method, has_body), bclean), None
            name = _name_arg(code, args) or p.name
            required = _bool_arg(code, args.get("required"), True) and "defaultValue" not in args and base != "Optional"
            loc = "form" if p.has("RequestPart") else _loc_simple(http_method, has_body)
            return [SrcParam(name, p.type, required, loc, self._param_desc(cls, p, docs))], None
        if p.has("ModelAttribute"):
            return self._expand(cls, p, inner, _loc_vo(http_method))
        # 어노테이션이 없는 인자: 스프링은 단순 타입을 @RequestParam(required=false)처럼, VO 는 @ModelAttribute 처럼 묶는다.
        if base in INFRA_TYPES or inner in INFRA_TYPES or any(a.name not in BENIGN_PARAM_ANNOS for a in p.annos):
            return [], None
        if inner in FILE_TYPES:
            return [SrcParam(p.name, p.type, False, "form", self._param_desc(cls, p, docs))], None
        if inner in SIMPLE_TYPES:
            return [SrcParam(p.name, p.type, False, _loc_simple(http_method, has_body), self._param_desc(cls, p, docs))], None
        found = self.index.resolve(inner, cls.file)
        if found and found[0].kind == "enum":
            return [SrcParam(p.name, p.type, False, _loc_simple(http_method, has_body), self._param_desc(cls, p, docs))], None
        if base in COLLECTION_TYPES or p.type.endswith("]"):
            return [], None                                      # 어노테이션 없는 VO 목록은 스프링도 묶지 못한다
        return self._expand(cls, p, inner, _loc_vo(http_method))

    def _param_desc(self, cls: JClass, p: JParam, docs: Dict[str, str]) -> str:
        """메서드 Javadoc 의 `@param name 설명`, 없으면 파라미터에 붙은 스웨거 설명."""
        if docs.get(p.name):
            return docs[p.name]
        for a in p.annos:
            key = {"ApiParam": "value", "Parameter": "description", "Schema": "description"}.get(a.name)
            span = anno_args(cls.code, a).get(key) if key else None
            v = eval_str(cls.code, span[0], span[1], None) if span else None
            if v:
                return v.strip()
        return ""

    def _expand_or_keys(self, cls: JClass, p: JParam, inner: str, loc: str, bclean: str) -> Tuple[List[SrcParam], Optional[str]]:
        if base_type(p.type) in ("Map", "HashMap", "LinkedHashMap"):
            return self._map_keys(p, loc, bclean), None
        if base_type(p.type) in COLLECTION_TYPES:
            return [], None                                      # 본문이 배열이면 필드로 펼 수 없다
        return self._expand(cls, p, inner, loc)

    def _map_keys(self, p: JParam, loc: str, bclean: str) -> List[SrcParam]:
        """`Map<String, Object> paramMap` 을 받는 컨트롤러가 `paramMap.get("poNo")` 로 꺼내 쓴 키들."""
        vt = re.findall(r"<[^<>]*,\s*([^<>]+)>\s*$", p.type)
        vtype = vt[0].strip() if vt else "Object"
        pat = re.compile(r'\b%s\s*\.\s*(?:get|containsKey|getOrDefault)\s*\(\s*"([^"\n]*)"' % re.escape(p.name))
        seen, out = set(), []
        for key in pat.findall(bclean):
            if key and key not in seen:
                seen.add(key)
                out.append(SrcParam(key, vtype, False, loc, ""))
        return out

    def _expand(self, cls: JClass, p: JParam, inner: str, loc: str) -> Tuple[List[SrcParam], Optional[str]]:
        found = [c for c in self.index.resolve(inner, cls.file) if c.kind in ("class", "record")]
        if not found:
            if re.search(r"(?:VO|Vo|DTO|Dto|Form|Param|Params|Req)$", simple_name(inner)):
                self.missing_vo.add(simple_name(inner))
            return [], None
        vo_cls = found[0]
        out: List[SrcParam] = []
        for f in self.index.fields_of(vo_cls):
            if "static" in f.mods or "transient" in f.mods or f.name == "serialVersionUID":
                continue
            name = f.name
            if loc == "body":
                if f.has("JsonIgnore"):
                    continue
                name = _json_name(f) or name
            out.append(SrcParam(name, f.type, f.has("NotNull", "NotBlank", "NotEmpty"), loc, self._field_desc(f)))
        return out, vo_cls.name

    def _field_desc(self, f: JField) -> str:
        code = f.cls.code
        text = comment_summary(code.above(f.start))
        if not text:
            c = code.trailing(f.end)
            text = comment_summary([c]) if c else ""
        if not text:
            for a in f.annos:
                key = {"ApiModelProperty": "value", "Schema": "description", "Parameter": "description", "ApiParam": "value"}.get(a.name)
                span = anno_args(code, a).get(key) if key else None
                v = eval_str(code, span[0], span[1], None) if span else None
                if v:
                    return v.strip()
        return text


# ---------------------------------------------------------------- 도우미(어노테이션 인자)
def _methods_of(code: Code, span: Optional[Tuple[int, int]]) -> List[str]:
    if not span:
        return []
    return re.findall(r"\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\b", code.clean[span[0]:span[1]])


def _name_arg(code: Code, args: Dict[str, Tuple[int, int]]) -> str:
    for key in ("value", "name"):
        span = args.get(key)
        if span:
            v = eval_str(code, span[0], span[1], None)
            if v:
                return v
    return ""


def _bool_arg(code: Code, span: Optional[Tuple[int, int]], default: bool) -> bool:
    if not span:
        return default
    t = code.clean[span[0]:span[1]].strip()
    return default if t not in ("true", "false") else t == "true"


def _json_name(f: JField) -> str:
    a = f.anno("JsonProperty")
    if a is None:
        return ""
    span = anno_args(f.cls.code, a).get("value")
    return (eval_str(f.cls.code, span[0], span[1], None) or "") if span else ""


def _unwrap(t: str) -> str:
    """`Optional<PoVO>`, `List<PoVO>`, `PoVO[]` 에서 알맹이 타입 이름."""
    base = base_type(t)
    if base == "Optional" or base in COLLECTION_TYPES:
        m = re.search(r"<\s*([^<>,]+?)\s*(?:<.*)?>\s*$", t)
        if m:
            return base_type(m.group(1))
    return base


def _snippet(code: Code, start: int, end: int) -> str:
    """어노테이션부터 메서드 끝까지 원문. 길면 앞 40줄과 생략 표시."""
    ls = code.line_start(start)
    s0 = ls if not code.raw[ls:start].strip() else start
    lines = code.raw[s0:end].rstrip().split("\n")
    if len(lines) > SNIPPET_LINES:
        lines = lines[:SNIPPET_LINES] + ["    // ..."]
    return "\n".join(lines)


# ---------------------------------------------------------------- 라벨
def _version2(v: str) -> str:
    m = re.match(r"(\d+)(?:\.(\d+))?", v or "")
    if not m:
        return ""
    return "%s.%s" % (m.group(1), m.group(2)) if m.group(2) is not None else m.group(1)


def _prop(pom: str, name: str) -> str:
    m = re.search(r"<%s>\s*([^<\s]+)\s*</%s>" % (re.escape(name), re.escape(name)), pom)
    return m.group(1) if m else ""


def egov_version(texts: List[str]) -> str:
    for t in texts:
        v = _prop(t, "egovframework.rte.version")
        if not v:
            m = re.search(r"<groupId>\s*egovframework\.rte\s*</groupId>\s*<artifactId>[^<]*</artifactId>\s*<version>\s*([^<\s]+)\s*</version>", t)
            v = m.group(1) if m else ""
            ref = re.match(r"\$\{([^}]+)\}$", v)
            if ref:
                v = _prop(t, ref.group(1))
        if not v:
            m = re.search(r"egovframework\.rte[\w.]*:[\w.\-]+:(\d[\w.\-]*)", t) or re.search(r"egovframework\.rte\.version\s*=\s*['\"]?(\d[\w.]*)", t)
            v = m.group(1) if m else ""
        if re.match(r"\d", v or ""):
            return v
    return ""


def boot_version(texts: List[str]) -> str:
    for t in texts:
        m = (re.search(r"<artifactId>\s*spring-boot-starter-parent\s*</artifactId>\s*<version>\s*(\d[^<\s]*)\s*</version>", t)
             or re.search(r"<spring[.-]boot\.version>\s*(\d[^<\s]*)\s*</spring[.-]boot\.version>", t)
             or re.search(r"org\.springframework\.boot['\"]\s*\)?\s*version\s*['\"](\d[\w.\-]*)['\"]", t)
             or re.search(r"springBootVersion\s*=\s*['\"](\d[\w.\-]*)['\"]", t)
             or re.search(r"spring-boot-gradle-plugin:(\d[\w.\-]*)", t))
        if m:
            return m.group(1)
    return ""


def spring_label(scan: SpringScan) -> str:
    texts = scan.build_texts
    joined = "\n".join(texts)
    db = ["MyBatis"] if (scan.stmts.xml_mybatis or scan.stmts.annotation or scan.has_ibatis_import) else []
    if scan.stmts.xml_ibatis:
        db.append("iBatis")
    if "egovframework" in joined or scan.egov_pkg:
        v = _version2(egov_version(texts))
        return "전자정부 표준프레임워크%s (%s)" % (" " + v if v else "", ", ".join(["Spring MVC"] + db))
    if "spring-boot-starter" in joined or "org.springframework.boot" in joined:
        v = _version2(boot_version(texts))
        return "Spring Boot%s%s" % (" " + v if v else "", " (%s)" % ", ".join(db) if db else "")
    return "Spring MVC%s" % (" (%s)" % ", ".join(db) if db else "")


# ---------------------------------------------------------------- 진입점
def scan_spring(repo: Repo, notes: List[str], on_file: Optional[Callable] = None,
                should_cancel: Optional[Callable[[], bool]] = None) -> ScanResult:
    sc = SpringScan(repo, notes, on_file, should_cancel)
    if not sc.load():                                           # 색인이 끝나기 전에 취소되면 호출 사슬을 따를 수 없다
        return ScanResult(framework=spring_label(sc), files=sc.files, notes=notes)
    eps, infos = sc.run()
    counts: Dict[str, int] = {}
    for e in eps:
        if e.kind in ("api", "file") and e.sql:
            counts[e.sql] = counts.get(e.sql, 0) + 1
    if sc.n_path_fail:
        notes.append("경로를 해석하지 못한 매핑 %d개를 건너뛰었습니다(상수나 표현식으로 쓴 경로)." % sc.n_path_fail)
    if sc.n_guessed:
        notes.append("SQL 구문을 찾지 못해 메서드 이름으로 읽기/쓰기를 추정한 API 가 %d개 있습니다." % sc.n_guessed)
    if sc.n_unknown:
        notes.append("읽기/쓰기를 알 수 없는 API 가 %d개 있습니다." % sc.n_unknown)
    if sc.missing_vo:
        notes.append("소스에서 클래스를 찾지 못해 펼치지 못한 파라미터 타입: %s" % ", ".join(sorted(sc.missing_vo)[:8]))
    return ScanResult(framework=spring_label(sc), endpoints=eps, files=sc.files, controllers=infos, sql_counts=counts, notes=notes)

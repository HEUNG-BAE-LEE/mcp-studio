"""자바 선언 파서: 클래스·필드·메서드·어노테이션을 읽어 색인한다.

AST 가 아니라 주석·문자열·괄호를 아는 가벼운 스캐너다. 정규식 한 방으로 메서드를 찾으면
어노테이션 인자의 `{}` 와 `()`, 문자열 안의 `//` 에서 깨진다. 여기서는 먼저 주석과 문자열 내용을
가린 사본(lexer.Code.skel)에서 멤버 경계를 찾고, 값은 가리지 않은 사본(clean)에서 읽는다.
둘은 길이가 같아 오프셋이 그대로 맞는다.
"""
import re
from typing import Callable, Dict, List, Optional, Tuple

from .lexer import Code, mask_java, match_brace, match_paren, split_top

MODIFIERS = frozenset({
    "public", "protected", "private", "static", "final", "abstract", "synchronized", "native",
    "transient", "volatile", "strictfp", "default", "sealed", "non-sealed",
})

_NONWS = re.compile(r"\S")
_STOP = re.compile(r"[;{}()=\[\]]")
_INIT_STOP = re.compile(r"[;()\[\]{}]")
_TOKEN = re.compile(r"@\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)|[()]")
_IDENT_END = re.compile(r"([A-Za-z_$][\w$]*)\s*$")
_ANNO_TYPE = re.compile(r"@\s*interface\b")
_TYPE_DECL = re.compile(
    r"^\s*(?:(?:public|protected|private|static|final|abstract|strictfp|sealed|non-sealed)\s+)*"
    r"(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)")
_LEAD_MODS = re.compile(r"^\s*(?:(?:%s)\s+)+" % "|".join(sorted(MODIFIERS - {"non-sealed"})))
_KEYVAL = re.compile(r"^\s*([A-Za-z_$][\w$]*)\s*=(?!=)")
_GENERIC = re.compile(r"<[^<>]*>")
_PACKAGE = re.compile(r"^\s*package\s+([\w.]+)\s*;", re.M)
_IMPORT = re.compile(r"^\s*import\s+(static\s+)?([\w.]+?)(\.\*)?\s*;", re.M)


# ---------------------------------------------------------------- 모델
class Anno:
    """어노테이션 하나. a, b 는 인자 괄호 안쪽의 오프셋(인자가 없으면 -1)."""

    __slots__ = ("name", "pos", "a", "b")

    def __init__(self, name: str, pos: int, a: int, b: int):
        self.name, self.pos, self.a, self.b = name, pos, a, b


class JParam:
    __slots__ = ("name", "type", "annos")

    def __init__(self, name: str, type_: str, annos: List[Anno]):
        self.name, self.type, self.annos = name, type_, annos

    def has(self, *names: str) -> bool:
        return any(a.name in names for a in self.annos)

    def anno(self, name: str) -> Optional[Anno]:
        return next((a for a in self.annos if a.name == name), None)


class JMethod:
    __slots__ = ("name", "ret", "annos", "params", "start", "name_pos", "end", "body", "cls", "_info")

    def __init__(self, name, ret, annos, params, start, name_pos, end, body, cls):
        self.name, self.ret, self.annos, self.params = name, ret, annos, params
        self.start, self.name_pos, self.end, self.body, self.cls = start, name_pos, end, body, cls
        self._info = None                 # 호출 사슬 추적이 본문을 한 번만 읽도록 붙여 두는 캐시

    def has(self, *names: str) -> bool:
        return any(a.name in names for a in self.annos)

    def anno(self, name: str) -> Optional[Anno]:
        return next((a for a in self.annos if a.name == name), None)


class JField:
    __slots__ = ("name", "type", "annos", "mods", "start", "end", "init", "cls")

    def __init__(self, name, type_, annos, mods, start, end, init, cls):
        self.name, self.type, self.annos, self.mods = name, type_, annos, mods
        self.start, self.end, self.init, self.cls = start, end, init, cls

    def has(self, *names: str) -> bool:
        return any(a.name in names for a in self.annos)

    def anno(self, name: str) -> Optional[Anno]:
        return next((a for a in self.annos if a.name == name), None)


class JClass:
    def __init__(self, name: str, kind: str, fqcn: str, pkg: str, annos: List[Anno], file: "JavaFile"):
        self.name, self.kind, self.fqcn, self.pkg = name, kind, fqcn, pkg
        self.annos = annos
        self.file = file
        self.abstract = False
        self.ext: Optional[str] = None            # extends 한 클래스(단순 이름)
        self.supers: List[str] = []               # extends + implements 의 단순 이름
        self.members: List[object] = []           # JMethod / JField, 소스 순서
        self.fields: Dict[str, JField] = {}
        self.methods: Dict[str, List[JMethod]] = {}
        self.start = 0                            # 선언 시작 오프셋
        self.name_pos = 0
        self.outer: Optional["JClass"] = None

    def has(self, *names: str) -> bool:
        return any(a.name in names for a in self.annos)

    def anno(self, name: str) -> Optional[Anno]:
        return next((a for a in self.annos if a.name == name), None)

    @property
    def code(self) -> Code:
        return self.file.code

    def method_list(self) -> List[JMethod]:
        return [m for m in self.members if isinstance(m, JMethod)]

    def field_list(self) -> List[JField]:
        return [m for m in self.members if isinstance(m, JField)]


class JavaFile:
    def __init__(self, rel: str, code: Code):
        self.rel = rel
        self.code = code
        self.package = ""
        self.imports: Dict[str, str] = {}         # 단순 이름 → FQCN
        self.static_imports: Dict[str, str] = {}
        self.classes: List[JClass] = []           # 중첩 클래스까지 선언 순서로


# ---------------------------------------------------------------- 문자열 도우미
def norm_type(s: str) -> str:
    """공백을 정리한 타입 문자열. `Map<String,Object>` → `Map<String, Object>`."""
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*([<>\[\].])\s*", r"\1", s)
    s = re.sub(r"\s*,\s*", ", ", s)
    return s


def base_type(t: str) -> str:
    """제네릭·배열을 뗀 타입 이름. `List<PoVO>` → `List`, `a.b.C[]` → `a.b.C`."""
    t = t.strip()
    while True:
        n = _GENERIC.sub("", t)
        if n == t:
            break
        t = n
    t = t.replace("[]", "").replace("...", "")
    return re.sub(r"\s+", "", t)


def simple_name(t: str) -> str:
    return base_type(t).rsplit(".", 1)[-1]


def unescape(s: str) -> str:
    return re.sub(r"\\(.)", r"\1", s)


def split_type_name(s: str) -> Optional[Tuple[str, str]]:
    """`Map<String, Object> m` → ("Map<String, Object>", "m"). 이름이 없으면 None."""
    s = s.strip()
    arr = ""
    m = re.search(r"((?:\s*\[\s*\])+)\s*$", s)
    if m:
        arr = re.sub(r"\s+", "", m.group(1))
        s = s[:m.start()]
    m = _IDENT_END.search(s)
    if not m:
        return None
    return norm_type(s[:m.start()] + arr), m.group(1)


def _ret_of(before: str) -> str:
    """메서드 이름 앞부분(수정자, 제네릭 선언, 반환 타입)에서 반환 타입만."""
    s = _LEAD_MODS.sub("", before).strip()
    if s.startswith("<"):
        depth = 0
        for i, ch in enumerate(s):
            depth += 1 if ch == "<" else -1 if ch == ">" else 0
            if depth == 0:
                s = s[i + 1:].strip()
                break
    s = _LEAD_MODS.sub("", s).strip()
    return norm_type(s)


# ---------------------------------------------------------------- 어노테이션
def strip_annotations(code: Code, lo: int, hi: int) -> Tuple[List[Anno], str]:
    """skel[lo:hi] 안의 괄호 밖(깊이 0) 어노테이션을 모아 (목록, 어노테이션을 공백으로 지운 같은 길이 문자열).

    메서드 헤더에서는 파라미터의 어노테이션이 괄호 안(깊이 1)에 있어 메서드 어노테이션과 섞이지 않는다.
    """
    skel = code.skel
    annos: List[Anno] = []
    parts: List[str] = []
    last = pos = lo
    depth = 0
    while True:
        m = _TOKEN.search(skel, pos, hi)
        if not m:
            break
        g = m.group(1)
        if g is None:
            depth += 1 if m.group() == "(" else -1
            pos = m.end()
            continue
        if depth > 0:
            pos = m.end()
            continue
        end = m.end()
        k = end
        while k < hi and skel[k] in " \t\r\n":
            k += 1
        a = b = -1
        if k < hi and skel[k] == "(":
            close = match_paren(skel, k, hi)
            if close < 0:
                close = hi - 1
            a, b = k + 1, close
            end = close + 1
        name = re.sub(r"\s+", "", g).rsplit(".", 1)[-1]
        annos.append(Anno(name, m.start(), a, b))
        parts.append(skel[last:m.start()])
        parts.append(" " * (end - m.start()))
        last = pos = end
    parts.append(skel[last:hi])
    return annos, "".join(parts)


def anno_args(code: Code, anno: Anno) -> Dict[str, Tuple[int, int]]:
    """어노테이션 인자를 {이름: (값 시작, 값 끝)} 으로. 이름 없는 첫 인자는 "value"."""
    out: Dict[str, Tuple[int, int]] = {}
    if anno.a < 0:
        return out
    for a, b in split_top(code.skel, anno.a, anno.b):
        m = _KEYVAL.match(code.skel[a:b])
        if m:
            out[m.group(1)] = (a + m.end(), b)
        else:
            out.setdefault("value", (a, b))
    return out


_LITERAL = re.compile(r'^"\x00*"$')
_IDENT_PATH = re.compile(r"^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$")
Consts = Callable[[str], Optional[str]]


def _trim(skel: str, a: int, b: int) -> Tuple[int, int]:
    """공백과 바깥 괄호를 걷어낸 구간. `("/a")` → `"/a"`."""
    while True:
        s = skel[a:b]
        a, b = a + len(s) - len(s.lstrip()), b - (len(s) - len(s.rstrip()))
        if b - a >= 2 and skel[a] == "(" and skel[b - 1] == ")" and match_paren(skel, a, b) == b - 1:
            a, b = a + 1, b - 1
            continue
        return a, b


def eval_str(code: Code, a: int, b: int, consts: Optional[Consts] = None) -> Optional[str]:
    """`"/a" + "/b"`, `Const.PATH + "/x"` 같은 문자열 식의 값. 풀 수 없으면 None(지어내지 않는다)."""
    out = []
    a, b = _trim(code.skel, a, b)
    for pa, pb in split_top(code.skel, a, b, sep="+"):
        pa, pb = _trim(code.skel, pa, pb)
        if _LITERAL.match(code.skel[pa:pb]):
            out.append(unescape(code.clean[pa + 1:pb - 1]))
            continue
        ident = code.clean[pa:pb]
        if consts is None or not _IDENT_PATH.match(ident):
            return None
        val = consts(ident)
        if val is None:
            return None
        out.append(val)
    return "".join(out) if out else None


def str_list(code: Code, span: Optional[Tuple[int, int]], consts: Optional[Consts] = None) -> Optional[List[str]]:
    """어노테이션 값이 문자열 하나 또는 `{"a", "b"}` 배열일 때의 값 목록. 하나라도 못 풀면 None."""
    if not span:
        return []
    a, b = span
    sk = code.skel[a:b]
    if sk.strip().startswith("{") and sk.strip().endswith("}"):
        lo, hi = a + sk.index("{") + 1, a + sk.rindex("}")
        out = []
        for pa, pb in split_top(code.skel, lo, hi):
            v = eval_str(code, pa, pb, consts)
            if v is None:
                return None
            out.append(v)
        return out
    v = eval_str(code, a, b, consts)
    return None if v is None else [v]


# ---------------------------------------------------------------- 멤버 분할
def _skip_init(skel: str, pos: int, hi: int) -> int:
    """필드 초기화식의 끝(`;` 바로 뒤). 람다·익명 클래스의 중괄호 안 `;` 는 건너뛴다."""
    depth = 0
    for m in _INIT_STOP.finditer(skel, pos, hi):
        ch = m.group()
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif depth <= 0:
            return m.end()
    return hi


def split_members(skel: str, lo: int, hi: int) -> List[tuple]:
    """lo..hi(클래스 본문 안쪽)를 멤버 단위로 쪼갠다: (시작, 헤더 끝, 멤버 끝, 종결, 본문).

    종결은 `;`(선언만) / `{`(본문 있음) / `=`(초기화식 있음). 본문은 (여는 중괄호, 닫는 중괄호).
    헤더를 훑을 때 괄호 안의 `{ } ; =` 는 구조가 아니다 — `value={"/a","/b"}` 와 `method=...` 가 그렇다.
    """
    out: List[tuple] = []
    i = lo
    while i < hi:
        m = _NONWS.search(skel, i, hi)
        if not m:
            break
        start = m.start()
        if skel[start] in ";}":
            i = start + 1
            continue
        pos, depth = start, 0
        while True:
            m = _STOP.search(skel, pos, hi)
            if not m:
                out.append((start, hi, hi, "", None))
                i = hi
                break
            c, p = m.group(), m.start()
            if c in "([":
                depth += 1
            elif c in ")]":
                depth = max(0, depth - 1)
            elif depth > 0:
                pass
            elif c == ";":
                out.append((start, p, p + 1, ";", None))
                i = p + 1
                break
            elif c == "{":
                close = match_brace(skel, p, hi)
                if close < 0:
                    close = hi - 1
                out.append((start, p, close + 1, "{", (p, close)))
                i = close + 1
                break
            elif c == "=":
                end = _skip_init(skel, p + 1, hi)
                out.append((start, p, end, "=", None))
                i = end
                break
            else:                                   # 짝 없는 `}`: 멤버가 아니다
                out.append((start, p, p, "", None))
                i = p + 1
                break
            pos = p + 1
    return out


# ---------------------------------------------------------------- 파일 파싱
def parse_java(rel: str, raw: str) -> JavaFile:
    code = mask_java(raw)
    jf = JavaFile(rel, code)
    skel = code.skel
    m = _PACKAGE.search(skel)
    jf.package = m.group(1) if m else ""
    for m in _IMPORT.finditer(skel):
        if m.group(3):                                      # import a.b.*;
            continue
        fq = m.group(2)
        (jf.static_imports if m.group(1) else jf.imports)[fq.rsplit(".", 1)[-1]] = fq
    for start, hdr_end, end, term, body in split_members(skel, 0, len(skel)):
        _member(jf, None, start, hdr_end, end, term, body)
    return jf


def _member(jf: JavaFile, cls: Optional[JClass], start: int, hdr_end: int, end: int, term: str, body) -> None:
    code = jf.code
    if _ANNO_TYPE.search(code.skel, start, hdr_end):        # @interface 선언은 분석 대상이 아니다
        return
    annos, rem = strip_annotations(code, start, hdr_end)
    td = _TYPE_DECL.match(rem)
    if td:
        if term == "{":
            _type(jf, cls, start, annos, rem, td, body)
        return
    if cls is None:
        return                                              # 최상위에는 타입 선언만 의미가 있다(package, import 는 따로 읽었다)
    p = rem.find("(")
    if p >= 0:
        _method(jf, cls, start, hdr_end, end, annos, rem, p, body)
    elif term in (";", "="):
        _field(jf, cls, start, hdr_end, end, annos, rem, term)


def _type(jf: JavaFile, outer: Optional[JClass], start: int, annos: List[Anno], rem: str, td, body) -> None:
    kind, name = td.group(1), td.group(2)
    pkg = jf.package
    fqcn = ".".join(x for x in (pkg, outer.name if outer else "", name) if x)
    cls = JClass(name, kind, fqcn, pkg, annos, jf)
    cls.outer = outer
    cls.start = start
    cls.name_pos = start + td.start(2)
    cls.abstract = bool(re.search(r"\babstract\b", rem[:td.start(1)]))
    after = rem[td.end():]
    plain = after
    while True:                                             # 제네릭 인자를 지운 헤더에서 extends / implements 를 읽는다
        n = _GENERIC.sub("", plain)
        if n == plain:
            break
        plain = n
    ext_m = re.search(r"\bextends\s+([\w.$\s,]+?)\s*(?:\bimplements\b|\bpermits\b|$)", plain)
    imp_m = re.search(r"\bimplements\s+([\w.$\s,]+?)\s*(?:\bpermits\b|$)", plain)
    exts = [x.strip().rsplit(".", 1)[-1] for x in ext_m.group(1).split(",") if x.strip()] if ext_m else []
    imps = [x.strip().rsplit(".", 1)[-1] for x in imp_m.group(1).split(",") if x.strip()] if imp_m else []
    if kind == "class":
        cls.ext = exts[0] if exts else None
    cls.supers = exts + imps
    jf.classes.append(cls)
    if kind == "enum" or body is None:
        return                                              # 열거형 본문의 상수는 요청 이름이 아니다
    if kind == "record":
        _record_components(jf, cls, start, rem, td)
    for s, he, e, t, b in split_members(jf.code.skel, body[0] + 1, body[1]):
        _member(jf, cls, s, he, e, t, b)


def _record_components(jf: JavaFile, cls: JClass, start: int, rem: str, td) -> None:
    """record Foo(String a, int b) 의 구성요소를 필드로 본다."""
    ps = rem.find("(", td.end())
    if ps < 0:
        return
    pe = match_paren(rem, ps)
    if pe < 0:
        return
    code = jf.code
    for a, b in split_top(code.skel, start + ps + 1, start + pe, ",", angle=True):
        annos, prem = strip_annotations(code, a, b)
        tn = split_type_name(prem)
        if tn:
            fld = JField(tn[1], tn[0], annos, frozenset(), a, b, None, cls)
            cls.members.append(fld)
            cls.fields[fld.name] = fld


def _method(jf: JavaFile, cls: JClass, start: int, hdr_end: int, end: int, annos: List[Anno], rem: str, p: int, body) -> None:
    code = jf.code
    pre = rem[:p]
    m = _IDENT_END.search(pre)
    if not m:
        return
    name = m.group(1)
    ret = _ret_of(pre[:m.start(1)])
    if not ret:
        return                                              # 생성자
    close = match_paren(code.skel, start + p, hdr_end)
    if close < 0:
        return
    params: List[JParam] = []
    for a, b in split_top(code.skel, start + p + 1, close, ",", angle=True):
        pannos, prem = strip_annotations(code, a, b)
        prem = re.sub(r"\bfinal\b", " ", prem)
        tn = split_type_name(prem)
        if tn and tn[0]:
            params.append(JParam(tn[1], tn[0], pannos))
    meth = JMethod(name, ret, annos, params, start, start + m.start(1), end, body, cls)
    cls.members.append(meth)
    cls.methods.setdefault(name, []).append(meth)


def _field(jf: JavaFile, cls: JClass, start: int, hdr_end: int, end: int, annos: List[Anno], rem: str, term: str) -> None:
    code = jf.code
    decls = split_top(rem, 0, len(rem), ",", angle=True)
    if not decls:
        return
    first = rem[decls[0][0]:decls[0][1]]
    lead = _LEAD_MODS.match(first)
    mods = set(re.findall(r"\b(static|final|transient|volatile)\b", lead.group(0))) if lead else set()
    tn = split_type_name(first[lead.end():] if lead else first)
    if not tn or not tn[0]:
        return
    init = code.clean[hdr_end + 1:end].strip().rstrip(";").strip() if term == "=" else None
    names = [tn[1]]
    for a, b in decls[1:]:
        m = _IDENT_END.search(rem[a:b])
        if m:
            names.append(m.group(1))
    for i, nm in enumerate(names):
        fld = JField(nm, tn[0], annos, frozenset(mods), start, end, init if i == 0 else None, cls)
        cls.members.append(fld)
        cls.fields[nm] = fld


# ---------------------------------------------------------------- 저장소 전체 색인
class JavaIndex:
    """저장소의 모든 자바 클래스를 이름으로 찾게 한다. 호출 사슬 추적과 VO 펼치기가 쓴다."""

    def __init__(self):
        self.files: List[JavaFile] = []
        self.by_name: Dict[str, List[JClass]] = {}
        self.by_fqcn: Dict[str, JClass] = {}
        self._subs: Dict[str, List[JClass]] = {}
        self._lower: Dict[str, List[str]] = {}
        self._const_cls: Dict[Tuple[str, str], str] = {}
        self._const_name: Dict[str, List[str]] = {}
        self._pending: List[tuple] = []

    def add(self, jf: JavaFile) -> None:
        self.files.append(jf)
        for c in jf.classes:
            self.by_name.setdefault(c.name, []).append(c)
            self.by_fqcn.setdefault(c.fqcn, c)
            for f in c.field_list():
                self._add_const(c, f, jf)

    def _add_const(self, cls: JClass, fld: JField, jf: JavaFile) -> None:
        """`static final String X = "..."` 를 모아 둔다. 다른 상수를 이어 붙인 것은 finish 에서 푼다."""
        const = ("static" in fld.mods and "final" in fld.mods) or cls.kind == "interface"     # 인터페이스 필드는 상수다
        if not const or fld.init is None or base_type(fld.type) != "String":
            return
        pos = jf.code.clean.find(fld.init, fld.start)
        if pos >= 0:
            self._pending.append((cls.name, fld.name, jf.code, pos, pos + len(fld.init)))

    def _resolve_consts(self) -> None:
        for _round in range(4):                              # BASE + "/x" 처럼 다른 상수를 쓰는 상수는 몇 번 돌려 푼다
            left = []
            for name, field, code, a, b in self._pending:
                val = eval_str(code, a, b, self.const)
                if val is None:
                    left.append((name, field, code, a, b))
                else:
                    self._const_cls[(name, field)] = val
                    self._const_name.setdefault(field, []).append(val)
            done = len(left) == len(self._pending)
            self._pending = left
            if done or not left:
                break

    def finish(self) -> None:
        for cs in self.by_name.values():
            for c in cs:
                for s in c.supers:
                    self._subs.setdefault(s, []).append(c)
        for name in self.by_name:
            self._lower.setdefault(name.lower(), []).append(name)
        self._resolve_consts()

    def const(self, ident: str) -> Optional[str]:
        """`Const.PATH` / `PATH` 가 가리키는 문자열 상수. 이름이 겹쳐 값이 갈리면 모른다."""
        parts = ident.split(".")
        if len(parts) >= 2 and (parts[-2], parts[-1]) in self._const_cls:
            return self._const_cls[(parts[-2], parts[-1])]
        vals = set(self._const_name.get(parts[-1], []))
        return next(iter(vals)) if len(vals) == 1 else None

    def resolve(self, type_str: str, jf: JavaFile) -> List[JClass]:
        """타입 문자열 → 저장소 안의 클래스 후보. 외부 라이브러리 타입은 빈 목록."""
        base = base_type(type_str)
        if "." in base:
            hit = self.by_fqcn.get(base)
            if hit:
                return [hit]
            base = base.rsplit(".", 1)[-1]
        cands = self.by_name.get(base, [])
        if len(cands) <= 1:
            return list(cands)
        fq = jf.imports.get(base)
        if fq:
            hit_l = [c for c in cands if c.fqcn == fq]
            if hit_l:
                return hit_l
        same = [c for c in cands if c.pkg == jf.package]
        return same or list(cands)

    def canonical_name(self, name: str) -> str:
        """대소문자만 다른 클래스 이름을 소스의 이름으로 맞춘다. 빈 이름 budgetDAO → BudgetDAO."""
        if name in self.by_name:
            return name
        hits = self._lower.get(name.lower(), [])
        return hits[0] if len(hits) == 1 else name

    def subs_of(self, cls: JClass) -> List[JClass]:
        """cls 를 구현하거나 상속한 클래스. 이름 규칙(PoService → PoServiceImpl)으로 이어지는 것도 포함."""
        out = [c for c in self._subs.get(cls.name, []) if c is not cls]
        for c in self.by_name.get(cls.name + "Impl", []):
            if c not in out and c is not cls:
                out.append(c)
        return out

    def chain(self, cls: JClass, limit: int = 8) -> List[JClass]:
        """cls 와 extends 로 이어지는 조상들(가까운 순)."""
        out = [cls]
        cur = cls
        while cur.ext and len(out) < limit:
            nxt = self.resolve(cur.ext, cur.file)
            nxt = [c for c in nxt if c not in out]
            if not nxt:
                break
            cur = nxt[0]
            out.append(cur)
        return out

    def fields_of(self, cls: JClass) -> List[JField]:
        """cls 와 조상의 필드. 자식 것이 먼저, 같은 이름은 자식이 가린다."""
        seen: Dict[str, JField] = {}
        for c in self.chain(cls):
            for f in c.field_list():
                seen.setdefault(f.name, f)
        return list(seen.values())

    def methods_named(self, cls: JClass, name: str) -> List[JMethod]:
        for c in self.chain(cls):
            found = c.methods.get(name)
            if found:
                return found
        return []

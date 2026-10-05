"""주석·문자열을 가린 사본을 만든다.

구조 분석(중괄호·괄호 짝 맞추기)은 문자열 안의 `{` 나 `//` 때문에 쉽게 틀어진다. 그래서 원문과
**길이가 같은** 사본을 만들어 오프셋이 그대로 맞게 한다. 주석을 지워도 줄 번호와 스니펫이 틀어지지 않는다.

    raw     원문
    clean   주석만 공백으로 바꾼 것. 경로·파라미터 이름 같은 문자열 값은 여기서 읽는다.
    skel    주석과 문자열 내용까지 가린 것. 괄호 짝 맞추기·호출 찾기는 여기서 한다.

주석은 따로 모아 둔다. 메서드 위 Javadoc 이 API 이름(title)과 파라미터 설명의 출처다.
"""
import re
from bisect import bisect_left, bisect_right
from typing import List, NamedTuple, Optional

NEUTRAL = "\x00"          # skel 에서 문자열 내용을 대신하는 글자. 공백도 식별자도 아니라 정규식에 안 걸린다.


class Comment(NamedTuple):
    start: int
    end: int
    kind: str             # "doc" (/** */) | "block" (/* */) | "line" (// 또는 #)
    text: str


_NOT_NL = re.compile(r"[^\n]")


def _blank(text: str) -> str:
    return _NOT_NL.sub(" ", text)


def _neutral(text: str, keep: int = 1) -> str:
    """여닫는 따옴표만 남기고 내용을 가린다. 줄바꿈은 줄 번호 때문에 남긴다."""
    inner = text[keep:len(text) - keep]
    return text[:keep] + _NOT_NL.sub(NEUTRAL, inner) + text[len(text) - keep:]


class Code:
    """파일 하나의 원문과 가려진 사본들, 주석 목록."""

    def __init__(self, raw: str, clean: str, skel: str, comments: List[Comment]):
        self.raw = raw
        self.clean = clean
        self.skel = skel
        self.comments = comments
        self._starts = [c.start for c in comments]
        self._ends = [c.end for c in comments]

    def line_of(self, pos: int) -> int:
        """오프셋이 놓인 줄 번호(1부터)."""
        return self.raw.count("\n", 0, pos) + 1

    def line_start(self, pos: int) -> int:
        return self.raw.rfind("\n", 0, pos) + 1

    def own_line(self, pos: int) -> bool:
        """pos 앞에 같은 줄에서 코드가 없다. `int a; // 설명` 의 꼬리 주석과 구분하려는 것."""
        return not self.skel[self.line_start(pos):pos].strip()

    def above(self, pos: int) -> List[Comment]:
        """pos 바로 위에 붙은 주석들(가까운 것부터). 사이에 코드가 있거나 빈 줄이 끼면 끊는다.

        Javadoc 은 빈 줄 하나까지 봐 준다(컴파일러도 붙여서 본다). `//` 는 빈 줄이 끼면 구획용 제목일 가능성이 커 뗀다.
        """
        out: List[Comment] = []
        limit = pos
        i = bisect_right(self._ends, limit) - 1
        while i >= 0:
            c = self.comments[i]
            gap = self.skel[c.end:limit]
            if gap.strip() or not self.own_line(c.start):
                break
            if gap.count("\n") > (2 if c.kind == "doc" else 1):
                break
            out.append(c)
            limit = c.start
            i -= 1
        return out

    def trailing(self, pos: int) -> Optional[Comment]:
        """pos(보통 `;` 바로 뒤)와 같은 줄에서 이어지는 주석 하나."""
        i = bisect_left(self._starts, pos)
        if i >= len(self.comments):
            return None
        c = self.comments[i]
        if "\n" in self.raw[pos:c.start] or self.skel[pos:c.start].strip():
            return None
        return c


# ---------------------------------------------------------------- 언어별 토큰
# 자바: 텍스트 블록 → 줄 주석 → 블록 주석 → 문자열 → 문자. 먼저 시작하는 것이 이긴다.
_JAVA = re.compile(
    r'(?P<tb>"""(?:\\.|[^\\])*?""")'
    r"|(?P<lc>//[^\n]*)"
    r"|(?P<bc>/\*.*?\*/)"
    r'|(?P<st>"(?:\\.|[^"\\\n])*")'
    r"|(?P<ch>'(?:\\.|[^'\\\n])*')",
    re.S,
)

# 자바스크립트: 정규식 리터럴(/.../)은 나눗셈과 겹쳐 앞 글자를 보고 따로 가린다.
_JS = re.compile(
    r"(?P<lc>//[^\n]*)"
    r"|(?P<bc>/\*.*?\*/)"
    r'|(?P<st>"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\')'
    r"|(?P<tp>`(?:\\.|[^`\\])*`)"
    r"|(?P<re>/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n\[])+/[a-z]*)",
    re.S,
)

# 파이썬: 삼중따옴표(독스트링) → 줄 주석 → 문자열. 접두어(r, f, b)는 문자열 앞의 식별자 글자일 뿐이다.
_PY = re.compile(
    r'(?P<tq>"""(?:\\.|[^\\])*?"""|\'\'\'(?:\\.|[^\\])*?\'\'\')'
    r"|(?P<lc>#[^\n]*)"
    r'|(?P<st>"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\')',
    re.S,
)

# 정규식 리터럴이 올 수 있는 자리: 이 글자들 뒤, 또는 이 단어들 뒤
_RE_PREV_CHARS = set("(,=:[!&|?{};+-*%<>~^")
_RE_PREV_WORDS = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"}
_WORD_BEFORE = re.compile(r"([A-Za-z_$][\w$]*)\s*$")


def _regex_ok(raw: str, pos: int) -> bool:
    i = pos - 1
    while i >= 0 and raw[i] in " \t\r\n":
        i -= 1
    if i < 0:
        return True
    ch = raw[i]
    if ch in "+-" and i > 0 and raw[i - 1] == ch:
        return False                                  # a++ / 2 : 증감 연산자 뒤의 / 는 나눗셈이다
    if ch in _RE_PREV_CHARS or ch == "}":
        return True
    if ch.isalnum() or ch in "_$":
        m = _WORD_BEFORE.search(raw, max(0, i - 12), i + 1)
        return bool(m) and m.group(1) in _RE_PREV_WORDS
    return False


def _mask(raw: str, token: "re.Pattern") -> Code:
    clean: List[str] = []
    skel: List[str] = []
    comments: List[Comment] = []
    pos = last = 0
    while True:
        m = token.search(raw, pos)
        if not m:
            break
        kind = m.lastgroup
        s, e = m.span()
        if kind == "re" and not _regex_ok(raw, s):
            pos = s + 1
            continue
        text = m.group()
        clean.append(raw[last:s])
        skel.append(raw[last:s])
        if kind in ("lc", "bc"):
            blank = _blank(text)
            clean.append(blank)
            skel.append(blank)
            if kind == "lc":
                ck = "line"
            else:
                ck = "doc" if text.startswith("/**") and not text.startswith("/**/") else "block"
            comments.append(Comment(s, e, ck, text))
        else:
            clean.append(text)
            if kind in ("tb", "tq"):
                skel.append(_neutral(text, 3))
            elif kind == "re":
                skel.append("/" + NEUTRAL * (len(text) - 1))
            else:
                skel.append(_neutral(text, 1))
        last = pos = e
    clean.append(raw[last:])
    skel.append(raw[last:])
    return Code(raw, "".join(clean), "".join(skel), comments)


def mask_java(raw: str) -> Code:
    return _mask(raw, _JAVA)


def mask_js(raw: str) -> Code:
    return _mask(raw, _JS)


def mask_py(raw: str) -> Code:
    return _mask(raw, _PY)


# ---------------------------------------------------------------- 괄호 짝 맞추기 (skel 위에서)
_BRACES = re.compile(r"[{}]")
_PARENS = re.compile(r"[()]")


def match_brace(skel: str, open_idx: int, hi: Optional[int] = None) -> int:
    """skel[open_idx] 가 `{` 일 때 짝이 되는 `}` 의 위치. 짝이 없으면 -1."""
    hi = len(skel) if hi is None else hi
    depth = 0
    for m in _BRACES.finditer(skel, open_idx, hi):
        depth += 1 if m.group() == "{" else -1
        if depth == 0:
            return m.start()
    return -1


def match_paren(skel: str, open_idx: int, hi: Optional[int] = None) -> int:
    """skel[open_idx] 가 `(` 일 때 짝이 되는 `)` 의 위치. 짝이 없으면 -1."""
    hi = len(skel) if hi is None else hi
    depth = 0
    for m in _PARENS.finditer(skel, open_idx, hi):
        depth += 1 if m.group() == "(" else -1
        if depth == 0:
            return m.start()
    return -1


def split_top(skel: str, lo: int, hi: int, sep: str = ",", angle: bool = False) -> List[tuple]:
    """skel[lo:hi] 를 깊이 0 의 sep 에서 잘라 (시작, 끝) 목록으로. 괄호 안의 sep 는 자르지 않는다.

    angle=True 면 제네릭(<>)도 깊이로 센다. 선언의 파라미터 목록(`Map<String, Object> m`)이 그렇다.
    호출 인자(`a < b, c`)에서는 비교 연산자와 겹치므로 끈다.
    """
    pat = _SPLIT_ANGLE if angle else _SPLIT_PLAIN
    spans = []
    depth = 0
    start = lo
    for m in pat.finditer(skel, lo, hi):
        ch = m.group()
        if ch in "([{<":
            depth += 1
        elif ch in ")]}>":
            depth -= 1
        elif ch == sep and depth == 0:
            spans.append((start, m.start()))
            start = m.end()
    spans.append((start, hi))
    return [(a, b) for a, b in spans if skel[a:b].strip()]


_SPLIT_PLAIN = re.compile(r"[()\[\]{},+;]")
_SPLIT_ANGLE = re.compile(r"[()\[\]{}<>,+;]")


# ---------------------------------------------------------------- 주석 본문 다듬기
_TAG_LINE = re.compile(r"^@\w+")
_HTML = re.compile(r"<[^>]+>")
_INLINE_TAG = re.compile(r"\{@\w+\s+([^}]*)\}")
_DECOR = re.compile(r"^[\W_]*$")


def doc_lines(text: str) -> List[str]:
    """주석 원문(`/** */`, `/* */`, `//`, `#`)을 장식 없는 줄 목록으로 푼다."""
    if text.startswith("/*"):
        body = text[2:-2] if text.endswith("*/") else text[2:]
        lines = [re.sub(r"^\s*\*+\s?", "", ln) for ln in body.lstrip("*").split("\n")]
    elif text.startswith("//"):
        lines = [text.lstrip("/")]
    elif text.startswith("#"):
        lines = [text.lstrip("#")]
    else:
        lines = text.split("\n")
    return [ln.strip() for ln in lines]


def _plain(s: str) -> str:
    s = _INLINE_TAG.sub(r"\1", s)
    s = _HTML.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def summary(lines: List[str]) -> str:
    """주석의 첫 문장. 태그(@param 등)와 빈 줄에서 멈춘다. 장식 줄(----, ====)은 건너뛴다.

    첫 줄만 이름으로 쓴다. 한국어 Javadoc 은 첫 줄이 제목이고 다음 줄이 설명인 경우가 많다. 다만 영문이
    줄바꿈으로 이어진 문장(다음 줄이 소문자로 시작)은 한 문장으로 잇는다.
    """
    got: List[str] = []
    for ln in lines:
        if _TAG_LINE.match(ln):
            break
        if not ln or _DECOR.match(ln):
            if got:
                break
            continue
        if got and not (ln[0].isascii() and ln[0].islower() and not got[-1].endswith((".", "。", "!", "?"))):
            break
        got.append(ln)
    if not got:
        return ""
    text = _plain(" ".join(got))
    m = re.search(r"(?<=[.。!?])\s", text)
    if m:
        text = text[:m.start()]
    return text.rstrip(".。").strip()


def tag_text(lines: List[str], tag: str) -> str:
    """`@desc 설명` 같은 태그 한 줄의 내용."""
    for ln in lines:
        m = re.match(r"^@%s\s+(.+)$" % tag, ln)
        if m:
            return _plain(m.group(1))
    return ""


def param_docs(lines: List[str]) -> dict:
    """`@param name 설명` → {name: 설명 첫 줄}."""
    out = {}
    for ln in lines:
        m = re.match(r"^@param\s+(?:<\w+>\s+)?(\w+)\s*-?\s*(.*)$", ln)
        if m and m.group(2):
            out[m.group(1)] = _plain(m.group(2))
    return out


def comment_summary(comments: List[Comment]) -> str:
    """바로 위에 붙은 주석들(가까운 것부터)에서 이름으로 쓸 한 줄을 뽑는다. Javadoc 이 먼저, 없으면 `//` 묶음의 첫 줄."""
    for c in comments:
        if c.kind == "doc":
            return summary(doc_lines(c.text))
    for c in reversed(comments):                      # 위에서 아래 순서로. 줄 주석은 줄마다 따로 읽는다(이어 붙이면 문장이 뒤섞인다)
        for ln in (doc_lines(c.text) if c.kind != "doc" else []):
            got = summary([ln])
            if got:
                return got
    return ""

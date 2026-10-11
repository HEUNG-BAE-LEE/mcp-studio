# apps/backend/app/ieum/recorder/analyze.py
"""기록 → 업무 기능. 규칙만으로 동작한다(LLM 에 의존하지 않는다 — LLM 이 죽어도 분석은 된다).

핵심 판단 두 가지:
1) 이 요청이 업무의 본체인가: 행동 직후 나갔고, 응답(HTML 이면 표 변환 사본) 값이 직후 화면(ARIA)에 나타났는가.
2) 이 파라미터 값은 어디서 왔나: 사용자 입력, 앞 단계 응답, 직전 화면의 숨은 입력(매번 바뀌는 토큰), 설정, 상수.

같은 값이 여러 곳에 있으면 하나를 골라 조용히 확정하지 않는다. 확신도를 낮춰 검토 화면에서 사람에게 묻는다.
ARIA 와 응답은 같은 마스킹기로 가려 저장했으므로, 가린 값끼리 비교해도 판정이 맞다.
"""
import copy
import logging
import re
import time
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, unquote, urlsplit

from app.ieum.discovery import capture, infer
from app.ieum.discovery.masking import HIDDEN, MASKED_RE, is_secret_key
from app.ieum.discovery import policy as policy_mod
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import htmltable

USER_INPUT, PREVIOUS_STEP_OUTPUT, SESSION_CONTEXT = "USER_INPUT", "PREVIOUS_STEP_OUTPUT", "SESSION_CONTEXT"
SYSTEM_CONFIG, DERIVED, CONSTANT = "SYSTEM_CONFIG", "DERIVED", "CONSTANT"
DISCRIMINATORS = ("cmd", "action", "method", "mode", "op", "service", "operationName", "actionType", "flag")
_DATE = re.compile(r"^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$")
_TOKEN_NAME = re.compile(r"csrf|xsrf|token|viewstate|eventvalidation|nonce", re.I)
_MASKED = MASKED_RE
_OPS = (("APPROVE", re.compile(r"approv|confirm|결재|승인|결제|이체|pay|transfer", re.I)),
        ("DELETE", re.compile(r"delet|remove|del\b|삭제|제거", re.I)),
        ("UPDATE", re.compile(r"upd|modify|edit|change|수정|변경", re.I)))
_RISK = {"READ": ("LOW", "NONE"), "CREATE": ("MEDIUM", "CONFIRM"), "UPDATE": ("MEDIUM", "CONFIRM"),
         "DELETE": ("HIGH", "HITL"), "APPROVE": ("CRITICAL", "HITL")}
_ORDER = ["READ", "CREATE", "UPDATE", "DELETE", "APPROVE"]
MIN_VALUE_LEN = 3                                      # "1", "Y" 같은 짧은 값은 우연히 겹치므로 연결 근거로 쓰지 않는다


# ── JSON 잎 ────────────────────────────────────────────────────────────────
def leaves(data, limit: int = 400) -> List[Tuple[str, Any]]:
    out: List[Tuple[str, Any]] = []

    def walk(node, path):
        if len(out) >= limit:
            return
        if isinstance(node, dict):
            for k, v in node.items():
                k = str(k)
                if re.search(r"[.\[\]?']", k):          # 점·대괄호·물음표가 든 키는 경로를 깨므로 ['키'] 로 쓴다
                    walk(v, path + "['" + k.replace("\\", "\\\\").replace("'", "\\'") + "']")
                else:
                    walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node[:50]):
                walk(v, f"{path}[{i}]")
        elif node is not None:
            out.append((path, node))
    walk(data, "$")
    return out


def get_path(data, path: str):
    m = LINK_EXPR.match(path or "")
    if m:                                                      # 설계 4판 주소 후보 출처: links[틀][k].자리
        tpl, group = _split_tpl(m.group(1))
        rows = template_matches(tpl, data, group)
        k = int(m.group(2))
        return rows[k][0].get(m.group(3)) if k < len(rows) else None
    query = None
    blanked = re.sub(r"\['(?:[^'\\]|\\.)*'\]", lambda m: "_" * len(m.group(0)), path)     # ['a?b'] 안의 ? 는 가린다
    cut = blanked.rfind("?")
    if cut >= 0:
        path, query = path[:cut], path[cut + 1:]
    node = data
    for name, idx, quoted in re.findall(r"\.([^.\[]+)|\[(\d+)\]|\['((?:[^'\\]|\\.)*)'\]", path[1:] if path.startswith("$") else path):
        try:
            if quoted or name:
                if not isinstance(node, dict):
                    return None
                node = node[re.sub(r"\\(.)", r"\1", quoted) if quoted else name]
            else:
                if not isinstance(node, list):          # 문자열 인덱싱("abc"[0])으로 엉뚱한 값을 꺼내지 않는다
                    return None
                node = node[int(idx)]
        except (KeyError, IndexError):
            return None
    if query:
        if not isinstance(node, str):
            return None
        return dict(parse_qsl(urlsplit(node).query)).get(query)
    return node


# ── 주소 후보와 틀 맞추기 (설계 4판) ─────────────────────────────────────────
# 출처 문법: links[<틀>@<묶음>][<k>].<자리 이름>   (k 는 0부터. 단계 출처는 앞에 "s2." 를 붙인다)
#   묶음 = 누른 후보의 행이 속한 반복 묶음 이름 "부모 태그.클래스>행 태그.클래스"(예: div.list>div.item, 클래스의 숫자는 뺌).
#          k 는 그 묶음 안에서만 센다 — 같은 틀의 랭킹·메뉴 링크가 앞에 있어도, 그 개수가 바뀌어도 순번이 엇나가지 않는다.
#          행이 없는 후보(JSON 값, 반복 조상이 없는 링크)는 "@묶음" 없이 전체 순서로 센다. 틀에 @ 가 있으면 끝에 "@" 를 붙인다.
#   틀 = 주소 모양. 경로의 {이름} 은 infer 가 {id} 로 바꾸는 식별자 모양(숫자·UUID·숫자 섞인 20자 이상)만, 쿼리의 {이름} 은
#        & # 따옴표 공백이 없는 글자, {이름:d} 는 숫자만, {이름:w} 는 낱말 글자(영숫자·_·-·.)만, {*} 는 이름 없는 식별자 자리.
#        "/" 로 시작하면 후보 문자열 안 어디서든(절대주소·다른 출처 포함) 경로 끝까지 맞추고, 그 밖(onclick 인자 하나 같은 것)은
#        후보 전체가 틀과 같아야 한다. "?이름={자리}" 는 쿼리 어디에 있든 맞춘다.
#   후보 = HTML 사본이면 links 의 v(문서 순서), JSON 이면 문자열 값 전부(leaves 순서).
#   자리 값이 "."·".." 이거나 "/" 를 품으면 그 후보는 맞지 않는 것으로 본다. 자리 값이 같은 후보는 하나로 친다.
LINK_EXPR = re.compile(r"^links\[(.*)\]\[(\d+)\]\.(.+)$", re.S)
_SLOT = re.compile(r"\{([^{}:]+)(?::([dw]))?\}")
_ID_CLASS = infer._ID_SEG.pattern[1:-1]                     # infer 의 식별자 조각 정규식(^…$ 를 뗀 것)을 그대로 쓴다
_SLOT_CLASS = {"d": r"\d+", "w": r"[\w\-.]+", "": "(?:" + _ID_CLASS + ")", "q": r"[^&#'\"\s]+"}
MAX_CANDIDATES = 500                                      # JSON 문자열 값 후보 상한(HTML 사본은 htmltable 상한을 따른다)
_TPL_CACHE: Dict[str, tuple] = {}


def _is_link_path(data, p: str) -> bool:
    """HTML 사본의 주소 후보(links·linkRows) 잎인가. 화면 표시 판정·출력·직접 값 연결에는 쓰지 않는다(JSON 의 links 키는 해당 없음)."""
    return p.startswith("$.link") and htmltable.is_copy(data)


def link_candidates(data) -> List[dict]:
    """주소 후보 [{v, row, g}]. HTML 사본이면 links, JSON 이면 문자열 값 전부(행·묶음 없음)."""
    if data is None:
        return []
    if htmltable.is_copy(data):
        return htmltable.links_of(data)
    return [{"v": v, "row": "", "g": ""} for _, v in leaves(data, MAX_CANDIDATES) if isinstance(v, str) and 0 < len(v) <= htmltable.MAX_LINK_LEN]


def _compile(tpl: str) -> tuple:
    got = _TPL_CACHE.get(tpl)
    if got:
        return got
    names: List[str] = []

    def piece(text: str, query: bool) -> str:
        out, pos = "", 0
        for m in _SLOT.finditer(text):
            out += re.escape(text[pos:m.start()])
            names.append(m.group(1))
            out += f"(?P<g{len(names) - 1}>{_SLOT_CLASS[m.group(2) or ('q' if query else '')]})"
            pos = m.end()
        return out + re.escape(text[pos:])

    path, sep, query = tpl.partition("?")
    rx = piece(path, not tpl.startswith("/"))           # 값 하나짜리 틀({x})은 식별자 모양으로 좁히지 않는다
    if sep:
        looks = "".join(r"(?=(?:[^#'\"\s]*&)?" + piece(pair.partition("=")[0], True) + "=" + piece(pair.partition("=")[2], True)
                        + r"(?:[&#'\"\s]|$))" for pair in query.split("&") if pair)
        rx += r"\?" + looks + r"[^#'\"\s]*"
    else:
        rx += r"(?:[?#][^'\"\s]*)?"
    got = (re.compile(rx + "$" if tpl.startswith("/") else rx), names, tpl.startswith("/"))
    if len(_TPL_CACHE) < 256:
        _TPL_CACHE[tpl] = got
    return got


def _bad_slot(v: str) -> bool:
    return v in (".", "..") or "/" in v


def _split_tpl(spec: str) -> Tuple[str, Optional[str]]:
    """'틀@묶음' → (틀, 묶음). 묶음이 없으면 None(전체 순서)."""
    if "@" not in spec:
        return spec, None
    tpl, _, group = spec.rpartition("@")
    return tpl, (group or None)


def _matches(tpl: str, data):
    """틀에 맞는 후보를 문서 순서로(합치지 않고). (자리 값들, 행 글자, 묶음)"""
    rx, names, anywhere = _compile(tpl)
    for c in link_candidates(data):
        m = rx.search(c["v"]) if anywhere else rx.fullmatch(c["v"])
        if not m:
            continue
        vals = {nm: unquote(m.group(f"g{i}")) for i, nm in enumerate(names) if m.group(f"g{i}") is not None}
        if any(_bad_slot(v) for v in vals.values()):
            continue
        yield {nm: v for nm, v in vals.items() if nm != "*"}, c["row"], c["g"]


def template_matches(tpl: str, data, group: Optional[str] = None) -> List[Tuple[Dict[str, str], str, str]]:
    """틀에 맞는 후보 줄. group 이 있으면 그 묶음 안에서만. 자리 값이 같은 것은 하나로. [(자리 값들, 행 글자, 묶음)]"""
    out, seen = [], set()
    for vals, row, g in _matches(tpl, data):
        if group is not None and g != group:
            continue
        key = tuple(sorted(vals.items()))
        if key in seen:
            continue
        seen.add(key)
        out.append((vals, row, g))
    return out


def _derive(c: str, name: str, v: str) -> Optional[str]:
    """값 v 를 품은 후보 c 에서 틀을 만든다. 후보 자체가 값이면 값 모양 자리, 주소면 그 주소 모양(값 자리만 이름을 붙인다)."""
    if c == v:
        if re.fullmatch(r"\d+", v):
            return "{%s:d}" % name
        return "{%s:w}" % name if re.fullmatch(r"[\w\-.]+", v) else "{%s}" % name
    parts = urlsplit(c)
    if not parts.path or re.search(r"[\s'\"(){}@]", parts.path):
        return None
    segs = ["{*}" if seg and infer._ID_SEG.match(seg) else seg for seg in parts.path.split("/")]
    for k, x in parse_qsl(parts.query, keep_blank_values=True):
        if x == v and re.fullmatch(r"[^&=#{}@]+", k):
            return "/".join(segs) + "?" + k + "={" + name + "}"
    raw = parts.path.split("/")
    hit = [i for i, seg in enumerate(raw) if unquote(seg) == v]
    if len(hit) == 1 and not _bad_slot(v):
        segs[hit[0]] = "{" + name + "}" if infer._ID_SEG.match(v) else "{" + name + ":w}"
        return "/".join(segs)
    return None


def _template_link(tpls: List[Optional[str]], want: Dict[str, str], prev_steps: List[dict], label: str = "") -> Optional[tuple]:
    """앞 단계들(최근 것부터)의 후보 중 틀에 맞고 기록 때 쓰인 값(want)을 모두 가진 후보를 찾아, 그 후보의 묶음 안 순번 k 를 구한다.
    같은 값이 여러 묶음에 있으면(랭킹과 결과에 같은 기사) 누른 요소의 글자(label)가 행 글자에 든 쪽을 고른다.
    돌려주는 것: (앞 단계, '틀@묶음' 또는 틀, k, 행 글자, 묶음 안 후보 수)"""
    for prev in reversed(prev_steps):
        data = prev["_sample"][2]
        if data is None:
            continue
        cands = None
        for tpl in tpls:
            if tpl is None:                                  # 값 모양 틀: 값을 품은 첫 후보에서 만든다
                (name, v), = want.items()
                cands = cands if cands is not None else link_candidates(data)
                tpl = next((t for t in (_derive(c["v"], name, v) for c in cands if v in c["v"]) if t), None)
                if tpl is None:
                    continue
            hits = [(row, g) for vals, row, g in _matches(tpl, data) if all(vals.get(nm) == v for nm, v in want.items())]
            if not hits:
                continue
            row, g = next((h for h in hits if label and label in h[0]), hits[0])
            rows = template_matches(tpl, data, g or None)
            k = next(i for i, (vals, _, _) in enumerate(rows) if all(vals.get(nm) == v for nm, v in want.items()))
            spec = f"{tpl}@{g}" if g else (tpl + "@" if "@" in tpl else tpl)
            return prev, spec, k, row, len(rows)
    return None


def _path_slots(raw: str, tpl: str) -> List[Tuple[str, str]]:
    """경로 틀의 {자리}와 기록 때 실제 값의 짝."""
    a, b = raw.split("/"), tpl.split("/")
    if len(a) != len(b):
        return []
    out = []
    for x, y in zip(a, b):
        m = re.fullmatch(r"\{([^{}]+)\}", y)
        if m:
            out.append((m.group(1), unquote(x.split(";")[0])))
    return out


# ── 요청 해석 ──────────────────────────────────────────────────────────────
def _pairs(n: dict) -> List[Tuple[str, str, str]]:
    post = n.get("post") or ""
    obs = SimpleNamespace(url=n["url"], post=post, headers={"content-type": "application/json" if post.startswith("{") else ""})
    return infer.request_pairs(obs)


def _data(n: dict):
    if n.get("data"):
        return n["data"]
    return infer.parse_json(n.get("res") or "")


def _kind(n: dict) -> str:
    if n.get("data"):
        return "html"
    return "json" if infer.parse_json(n.get("res") or "") is not None else "other"


def _type(v: str) -> str:
    if _DATE.match(v or ""):
        return "date"
    if re.fullmatch(r"-?\d+", v or ""):
        return "number"
    return "string"


def _discriminator(n: dict) -> str:
    pairs = {k: v for k, v, _ in _pairs(n)}
    for name in DISCRIMINATORS:
        if pairs.get(name):
            return f"{name}={pairs[name]}"
    return ""


# 설계 3판 6절: 조회·쓰기 낱말. 경로를 camelCase/_/-/./ 기준으로 나눠 낱말 단위로 비교한다.
READ_WORDS = ("select", "search", "list", "get", "find", "query", "inquiry", "retrieve", "view", "detail", "info", "count", "autocomplete")
WRITE_WORDS = ("save", "insert", "update", "delete", "del", "regist", "create", "modify", "mod", "edit", "apply", "approve", "confirm",
               "cancel", "pay", "payment", "order", "send", "upload", "reset", "change", "remove", "add", "submit", "register")
READ_KO = ("조회", "검색", "목록")
WRITE_KO = ("저장", "등록", "수정", "삭제", "승인", "결재", "결제", "취소", "변경", "이체", "전송", "발송", "탈퇴")
_SPLIT = re.compile(r"[/_.\-;]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


def path_words(path: str) -> List[str]:
    return [w.lower() for w in _SPLIT.split(path or "") if w]


def _hit(words: List[str], vocab: Tuple[str, ...], prefix: bool) -> Optional[str]:
    """낱말이 어휘와 같으면 그 어휘를 돌려준다. prefix 면 4글자 이상 어휘로 시작해도 같다(변경 낱말 전용), 아니면 단순 복수(-s)만 같게 본다."""
    for w in words:
        for v in vocab:
            if w == v or (prefix and len(v) >= 4 and w.startswith(v)) or (not prefix and w == v + "s"):
                return v
    return None


def classify_write(n: dict, policy: Policy) -> Tuple[bool, str]:
    """(쓰기 여부, 근거). 붙잡힘(held)·결정(decision) 은 보지 않는다 — 기록 중 쓰기는 붙잡지 않고 보내므로 이름만 근거다.

    이름으로 조회로 볼 수 있는 것은 POST(와 표준이 아닌 메서드)뿐이다. PUT/PATCH/DELETE 는 이름과 상관없이 쓰기다."""
    method = (n["method"] or "").upper()
    full = unquote(urlsplit(n["url"]).path.split(";")[0])       # 실제 URL 은 한글이 %EC.. 로 인코딩돼 있다
    if method in ("GET", "HEAD"):
        try:
            risky = capture.is_write(n["url"], method, n.get("rtype") or "", policy)
        except Exception:
            logging.warning("GET 이름 판정 실패 — 쓰기로 본다: %s", n.get("url"), exc_info=True)
            return True, f"{method} — 판정 실패로 쓰기"
        if risky:
            return True, f"이름이 쓰기 같은 {method}({full.rsplit('/', 1)[-1].rsplit('.', 1)[0]})"
        return False, method
    if method in ("PUT", "PATCH", "DELETE"):
        return True, f"{method} — 항상 쓰기"
    words = path_words(full)
    disc = _discriminator(n)                                   # cmd=delete 같은 구분 값은 변경 낱말 검사에만 쓴다
    dwords = path_words(disc.split("=", 1)[1]) if "=" in disc else []
    w = (_hit(words + dwords, WRITE_WORDS, True) or next((k for k in WRITE_KO if k in full or k in disc), None)
         or policy_mod.risky_call(full) or None)
    if w:
        return True, f"{method} — 변경 낱말({w})"
    r = _hit(words, READ_WORDS, False) or next((k for k in READ_KO if k in full), None)
    if r:
        return False, f"{method} — 조회 낱말({r})"
    return True, f"{method} — 기본 쓰기"


def _op_of(n: dict, label: str, write: bool = True) -> str:
    if not write:
        return "READ"
    text = f"{n['path']} {label}"
    for op, pat in _OPS:
        if pat.search(text):
            return op
    return "CREATE"


def policy_for(ops: List[str]) -> dict:
    """단계별 작업 유형 중 가장 위험한 것으로 정책을 만든다(설계 3판 6절 표). 단계가 없으면 READ."""
    op = max(ops or ["READ"], key=_ORDER.index)
    risk, approval = _RISK[op]
    return {"operation": op, "risk": risk, "approval": approval, "envPolicy": "op-auto" if op == "READ" else "op-confirm",
            "sensitivity": None, "scope": None}


def step_op(st: dict) -> str:
    """저장된 단계(write·path·label)에서 작업 유형을 다시 구한다 — 검토 화면에서 write 를 바꾼 뒤 정책을 다시 계산할 때 쓴다."""
    return _op_of({"path": st.get("path") or ""}, st.get("label") or "", bool(st.get("write")))


def _shown(data, raw: str, aria: str) -> bool:
    """응답 값이 화면에 나타났는가. JSON·HTML 사본이면 잎 값으로, 아니면 응답 글자 조각으로 본다."""
    if not aria:
        return False
    if data is not None:
        if any(len(str(v)) >= MIN_VALUE_LEN and str(v) != HIDDEN and str(v) in aria
               for p, v in leaves(data)[:300]
               if "_links" not in p and ".hidden." not in p and not _is_link_path(data, p) and not (p.startswith("$.tables[") and ".columns[" in p)):   # 표 머리글은 화면 틀이다
            return True
        if not (htmltable.is_copy(data) and not data.get("tables") and not data.get("fields")):
            return False                                  # 표도 이름값도 없는 HTML 사본(주소 후보만)은 아래 글자 조각으로 본다
    texts = re.findall(r">([^<>]{3,})<", raw or "")
    return any(t.strip() and t.strip() in aria for t in texts[:50])


def analyze(rec: dict, spans: List[dict]) -> dict:
    login_path = ((rec.get("login") or {}).get("path") or "").split(";")[0]
    policy = Policy(base=rec["sourceBase"], read_post="")        # 3판: 예전 기록의 readPost 는 쓰지 않는다
    items, excluded = [], []
    for sp in spans:
        for n in sp["network"]:
            row = {"method": n["method"], "path": infer.templatize(n["path"]), "base": n["base"], "origin": n["origin"]}
            full = urlsplit(n["url"]).path.split(";")[0]        # ;jsessionid= 같은 경로 파라미터는 뗀다
            if full == login_path:
                excluded.append(dict(row, role="auth", why="로그인 요청 (인증 방법으로 따로 보관)"))
            elif sp["action"]["target"] is None and sp["action"].get("type") != "key":   # 키(Enter) 묶음은 DOM 이 대상을 못 채워도 사람 입력이 낳은 요청이다
                excluded.append(dict(row, role="noise", why="행동 없이 화면이 스스로 부른 요청"))
            elif n.get("decision") in ("deny", "timeout"):
                excluded.append(dict(row, role="denied", why="승인하지 않아 보내지 않은 쓰기"))
            else:
                items.append((sp, n, row["path"], _data(n)))

    tables = infer.detect_code_tables([SimpleNamespace(url=n["url"], body=n.get("res") or "", status=n["status"], blocked=False, file=n.get("file"),
                                                       out_of_scope=False, method=n["method"], post=n.get("post"), headers={})
                                       for _, n, _, _ in items])
    code_paths = {p for _, n, p, _ in items if tables and n["method"] == "GET" and re.search(r"code|cmmn", p, re.I)}

    # 1) 핵심 후보
    steps: List[dict] = []
    dropped_headers: set = set()
    seen: Dict[tuple, Optional[dict]] = {}
    for sp, n, path, data in items:
        disc = _discriminator(n)
        key = (n["base"], n["method"], path, disc)
        if path in code_paths:
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": path, "base": n["base"], "origin": n["origin"], "role": "code", "why": "코드표 응답 (상태코드 풀이용 참조)"})
            continue
        write, write_why = classify_write(n, policy)
        aria = (sp.get("post") or {}).get("aria") or ""
        shown = _shown(data, n.get("res") or "", aria)
        cand = not (shown or write)                       # 화면에 안 나타난 요청: 뒤 단계가 쓰면 prereq, 아니면 빠진다
        if cand and data is None:
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": path, "base": n["base"], "origin": n["origin"], "role": "page" if n["rtype"] == "document" else "noise",
                                 "why": "응답 값이 화면에 나타나지 않음"})
            continue
        if seen.get(key) is not None:
            seen[key]["_spans"].append(sp["seq"])
            if not cand and seen[key]["role"] == "prereq":
                seen[key]["role"] = "core"
            continue
        st = {"id": f"t{len(steps) + 1}", "role": "prereq" if cand else "core", "base": n["base"], "origin": n["origin"], "method": n["method"], "path": path,
              "discriminator": disc, "kind": _kind(n), "charset": n.get("charset"), "exec": "http", "formPage": None, "write": write, "writeWhy": write_why,
              "headers": {}, "outputs": {}, "params": [],
              "recordedRes": n.get("res") or "", "recordedErrSeen": n.get("errSeen"), "recordedData": copy.deepcopy(htmltable.without_links(n.get("data"))), "recordedStatus": n["status"],
              "_sample": (sp, n, data), "_write": write, "_dropped": set(), "_spans": [sp["seq"]], "_label": (sp["action"]["target"] or {}).get("text", ""), "label": ((sp["action"]["target"] or {}).get("text", "") or "")[:60],
              "_title": (sp.get("pre") or {}).get("title", "")}
        for hk, hv in (n.get("headers") or {}).items():
            if hk.lower().startswith("x-"):
                if HIDDEN in str(hv) or _MASKED.search(str(hv)):
                    st["_dropped"].add(hk.lower())        # 가린 값은 그대로 재생하면 안 된다
                else:
                    st["headers"][hk.lower()] = hv
        seen[key] = st
        steps.append(st)

    # 2) 파라미터와 값 연결
    user_vals = _user_values(spans)
    fill_labels = _fill_labels(spans)
    common = _common_values(steps)
    inputs: Dict[str, dict] = {}
    contrib: list = []
    for i, st in enumerate(steps):
        sp, n, _ = st["_sample"]
        hidden = _hidden_before(spans, sp["seq"])
        for name, value, loc in _pairs(n):
            masked = HIDDEN in value or bool(_MASKED.search(value))
            p = {"a": name, "loc": loc, "ex": "" if HIDDEN in value else value, "type": _type(value), "required": value != ""}
            links = _find_link(value, steps[:i]) if len(value) >= MIN_VALUE_LEN and HIDDEN not in value else []
            if value in user_vals:                                    # 1) 사용자가 넣은 값
                # 같은 값이 앞 단계 응답·숨은 입력란에도 있으면 어느 쪽인지 단정하지 않는다 — 검토 화면에서 묻는다
                conf = "low" if (links or (name in hidden and hidden[name] == value)) else "high"
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": conf})
                inputs.setdefault(name, _input(name, p["type"], USER_INPUT, value, user_vals[value], conf, True))
                st["params"].append(p)
                continue
            tl = None
            # 숫자가 없는 값(메뉴의 'news', cmd=view 같은 고정값)과 구분 파라미터는 우연히 겹친 것으로 보고 후보로 잇지 않는다
            if (not links and len(value) >= MIN_VALUE_LEN and HIDDEN not in value and not _MASKED.search(value)
                    and re.search(r"\d", value) and name not in DISCRIMINATORS):
                q_tpl = st["path"] + "?" + name + "={" + name + "}" if loc == "query" and re.fullmatch(r"[^&=#{}?]+", name) else None
                tl = _template_link([t for t in (q_tpl,) if t] + [None], {name: value}, steps[:i], st["_label"] or "")   # 4판: 주소 후보의 틀 맞추기
            if links:
                _use_link(p, name, links, st, contrib)
            elif tl:
                _use_template(p, tl, name, st, contrib, short=bool(re.fullmatch(r"\d{1,4}", value)))
            elif _TOKEN_NAME.search(name) or (name in hidden and hidden[name] == value and (masked or is_secret_key(name))):
                # 3) 매번 바뀌는 숨은 토큰. 이름이 토큰 같거나 가린 숨은 값만 그렇다. pageIndex=1, cmd="" 같은 평범한 숨은 필드는
                #    아래 상수·입력 규칙으로 기록 값을 그대로 쓴다(전부 토큰으로 보면 Replay 가 needs_value 로 멈춘다).
                p.update({"from": f"session.hidden.{name}", "source": SESSION_CONTEXT, "confidence": "high" if name in hidden else "mid"})
                st["exec"] = "browser"
                st["formPage"] = (sp.get("pre") or {}).get("href") or None
            elif value == "":
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "low", "required": False})
                inputs.setdefault(name, _input(name, "string", USER_INPUT, "", "", "low", False))
            elif masked:
                # 가린 값(전체든 일부든)은 고정값이 될 수 없다. 실행 때 사람이(또는 금고에서) 채우는 입력이다.
                label = fill_labels.get(name)
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "mid" if label else "low"})
                inputs.setdefault(name, _input(name, "string", USER_INPUT, value, label or "", "mid" if label else "low", True))
            elif name in common and common[name] == value:
                p.update({"from": f"config.{name}", "source": SYSTEM_CONFIG, "confidence": "mid"})
            elif p["type"] == "date" and value == time.strftime("%Y%m%d", time.localtime(sp["action"]["t"] or time.time())):
                p.update({"from": f"input.{name}", "source": DERIVED, "confidence": "low"})
                inputs.setdefault(name, _input(name, "date", DERIVED, value, "", "low", True))
            else:
                p.update({"from": f"const:{value}", "source": CONSTANT, "confidence": "low" if p["type"] in ("date", "number") else "mid"})
            st["params"].append(p)
        _link_path(st, n, steps[:i], user_vals, inputs, contrib)

    # 2-1) 뒤 단계가 쓰지 않은 후보(화면에 안 나타난 요청)는 뺀다. 쓰인 것은 prereq 로 남는다
    used = set()
    for st in reversed(steps):
        if st["role"] == "core" or st["id"] in used:
            for p in st["params"]:
                if p.get("source") == PREVIOUS_STEP_OUTPUT:
                    used.add(p["from"].split(".", 1)[0])
    kept = []
    for st in steps:
        if st["role"] == "prereq" and st["id"] not in used:
            excluded.append({"method": st["method"], "path": st["path"], "base": st["base"], "origin": st["origin"], "role": _page_or_noise(st),
                             "why": "응답 값이 화면에 나타나지 않음"})
        else:
            kept.append(st)
    kept_ids = {st["id"] for st in kept}
    live = {(id(pv), nm) for pv, nm, cid in contrib if cid in kept_ids}
    for pv, nm, cid in contrib:                       # 빠진 후보가 남긴 출력 항목은 지운다
        if cid not in kept_ids and (id(pv), nm) not in live:
            pv["outputs"].pop(nm, None)
    dropped_headers = set().union(*[st["_dropped"] for st in kept]) if kept else set()
    remap = {st["id"]: f"s{k}" for k, st in enumerate(kept, 1)}
    steps = kept
    for st in steps:
        for p in st["params"]:
            if p.get("source") == PREVIOUS_STEP_OUTPUT:
                head, tail = p["from"].split(".", 1)
                p["from"] = f"{remap[head]}.{tail}"
    for st in steps:
        st["id"] = remap[st["id"]]

    # 3) 출력
    output = {"from": None, "fields": []}
    cores = [s for s in steps if s["role"] == "core"]
    if cores:
        last = cores[-1]
        sp, n, data = last["_sample"]
        aria = (sp.get("post") or {}).get("aria") or ""
        if data is not None:
            output = {"from": last["id"], "fields": [p for p, v in leaves(data)[:300]
                                                     if len(str(v)) >= 2 and str(v) != HIDDEN and str(v) in aria and "_links" not in p and ".hidden." not in p
                                                     and not _is_link_path(data, p)][:20]}

    # 4) 정책
    ops = [_op_of(s["_sample"][1], s["_label"], s["write"]) for s in steps] or ["READ"]
    policy_meta = policy_for(ops)
    op = policy_meta["operation"]

    notes = []
    if not steps:
        notes.append("핵심 요청을 찾지 못했습니다. 아래 전체 요청 목록에서 업무에 해당하는 것을 골라 주세요.")
    if any(s["kind"] == "other" for s in steps):
        notes.append("JSON 도 표도 아닌 응답이 있어 그 단계에서는 값을 꺼낼 수 없습니다.")
    if dropped_headers:
        notes.append("가려진 값이 든 헤더는 단계에서 뺐습니다(재생하면 가림 문자가 그대로 나갑니다): " + ", ".join(sorted(dropped_headers)))
    desc = _describe(rec, steps, list(inputs.values()), output, op)
    evidence = {s["id"]: s["_spans"] for s in steps}
    for s in steps:
        for k in ("_sample", "_spans", "_label", "_title", "_write", "_dropped"):
            s.pop(k, None)
    login = rec.get("login") or {}
    return {"id": "bf_" + rec["id"][4:], "name": rec["name"], "desc": desc, "status": "draft",
            "source": {"base": rec["sourceBase"], "recordingId": rec["id"], "made": "manual-record", "env": rec["env"]},
            "inputs": list(inputs.values()), "steps": steps, "references": [x for x in excluded if x["role"] == "code"],
            "excluded": excluded, "output": output,
            "auth": {"mode": "session" if login.get("recipe") else "none", "recipe": login.get("recipe"),
                     "droppedHeaders": sorted(dropped_headers)},
            "executionMode": None, "policy": policy_meta, "policyIncomplete": True,
            "verification": {"status": "pending", "at": None, "runs": []}, "evidence": evidence, "notes": notes}


def _page_or_noise(st: dict) -> str:
    """빠진 후보의 역할. 표·이름값·숨은 값이 있는 HTML 사본이면 page, 주소 후보만 있는 사본은 4판 전처럼 요청 종류로 가른다."""
    d = st.get("recordedData")
    if st["kind"] == "html" and d and (d.get("tables") or d.get("fields") or d.get("hidden")):
        return "page"
    return "page" if st["_sample"][1].get("rtype") == "document" else "noise"


def _use_link(p: dict, name: str, links: list, st: dict, contrib: list) -> None:
    """기존 연결 규칙(JSON 잎 경로, 표 _links 의 '?이름')으로 앞 단계 출력에 잇는다."""
    prev, path, many = links[0][0], links[0][1], len(links) > 1
    out_name = name if "?" in path else (path.rsplit(".", 1)[-1].split("[")[0] or name)
    prev["outputs"][out_name] = path
    contrib.append((prev, out_name, st["id"]))
    weak = many or (p["type"] == "number" and not _similar(name, out_name))
    p.update({"from": f"{prev['id']}.{out_name}", "source": PREVIOUS_STEP_OUTPUT, "confidence": "low" if weak else "high"})


def _use_template(p: dict, tl: tuple, slot: str, st: dict, contrib: list, short: bool = False) -> None:
    """4판: 주소 후보 틀의 k 번째 후보에서 자리 값을 꺼낸다. 후보가 하나면 high, 여럿이면 순번에 기대므로 mid,
    쿼리·본문 값이 짧은 숫자 하나뿐이면 우연히 겹칠 수 있어 low."""
    prev, tpl, k, row, count = tl
    expr = f"links[{tpl}][{k}].{slot}"
    prev["outputs"][expr] = expr
    contrib.append((prev, expr, st["id"]))
    p.update({"from": f"{prev['id']}.{expr}", "source": PREVIOUS_STEP_OUTPUT,
              "confidence": "low" if short else ("high" if count == 1 else "mid")})
    st["pickedIndex"], st["pickedRow"] = k, row                # 검토 화면 표시용: 기록 때 고른 결과의 순번과 행 글자


def _link_path(st: dict, n: dict, prev_steps: List[dict], user_vals: Dict[str, str], inputs: Dict[str, dict], contrib: list) -> None:
    """경로 틀의 {자리} 값을 잇는다. 사용자 입력 → 기존 연결 규칙 → 주소 후보 틀 맞추기 순서. 잇지 못한 자리는 그대로 두어
    재실행이 unresolved_path 로 멈추게 한다(값을 지어내지 않는다)."""
    slots = [(a, v) for a, v in _path_slots(n["path"], st["path"]) if v and HIDDEN not in v and not _MASKED.search(v)]
    rest: Dict[str, str] = {}
    params: Dict[str, dict] = {}
    for a, v in slots:
        p = {"a": a, "loc": "path", "ex": v, "type": _type(v), "required": True}
        params[a] = p
        links = _find_link(v, prev_steps) if len(v) >= MIN_VALUE_LEN else []
        if v in user_vals:
            p.update({"from": f"input.{a}", "source": USER_INPUT, "confidence": "low" if links else "high"})
            inputs.setdefault(a, _input(a, p["type"], USER_INPUT, v, user_vals[v], p["confidence"], True))
        elif links:
            _use_link(p, a, links, st, contrib)
        else:
            rest[a] = v
    if rest:
        full = [ln for ln in (st["path"],) if all(nm in dict(slots) for nm in re.findall(r"\{([^{}]+)\}", ln))]
        tl = _template_link(full + ([None] if len(rest) == 1 else []), rest, prev_steps, st.get("_label") or "")
        if tl:
            for a in rest:
                _use_template(params[a], tl, a, st, contrib)
    st["params"] += [p for p in params.values() if p.get("source")]


def _input(name, typ, source, ex, label, confidence, required) -> dict:
    return {"name": name, "type": typ, "source": source, "ex": "" if HIDDEN in (ex or "") else ex, "screenLabel": label, "confidence": confidence,
            "required": required, "needsValue": bool(_MASKED.search(ex or ""))}


def _describe(rec: dict, steps: List[dict], inputs: List[dict], output: dict, op: str) -> str:
    title = next((s["_title"] for s in steps if s.get("_title")), "") or rec["name"]
    labels = [i["screenLabel"] or i["name"] for i in inputs if i["source"] == USER_INPUT and (i["screenLabel"] or i["required"])][:4]
    outs = list(dict.fromkeys(re.sub(r"\[\d+\]", "", f).rsplit(".", 1)[-1] for f in output.get("fields", [])))[:5]
    by = f"{', '.join(labels)}(으)로 " if labels else ""
    what = f"{', '.join(outs)}을(를) " if outs else ""
    verb = "조회합니다" if op == "READ" else "처리합니다"
    return f"{title} 화면에서 {by}{what}{verb}."


def _user_values(spans: List[dict]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for sp in spans:
        for f in sp.get("fills", []):
            v = str(f.get("value") or "")
            if v and v != HIDDEN:                      # 가린 비밀 값은 서로 같아 보이므로 값 열쇠로 쓰지 않는다
                t = f.get("target") or {}
                out.setdefault(v, t.get("label") or t.get("text") or t.get("name") or t.get("id") or "")
    return out


def _fill_labels(spans: List[dict]) -> Dict[str, str]:
    """입력란 이름·id → 화면 라벨. 가린 값은 값으로 짝지을 수 없어 이름으로 짝짓는다."""
    out: Dict[str, str] = {}
    for sp in spans:
        for f in sp.get("fills", []):
            t = f.get("target") or {}
            label = t.get("label") or t.get("text") or t.get("name") or t.get("id") or ""
            for key in (t.get("name"), t.get("id")):
                if key:
                    out.setdefault(str(key), label)
    return out


def _similar(a: str, b: str) -> bool:
    x, y = re.sub(r"[^0-9a-z]", "", a.lower()), re.sub(r"[^0-9a-z]", "", b.lower())
    return bool(x and y) and (x in y or y in x)


def _hidden_before(spans: List[dict], seq: int) -> Dict[str, str]:
    """이 행동 직전 화면과, 그 앞 화면 이동 응답(HTML)의 숨은 입력."""
    out: Dict[str, str] = {}
    for sp in spans:
        if sp["seq"] > seq:
            break
        if sp["seq"] == seq:
            out.update((sp.get("pre") or {}).get("hidden") or {})
        for n in sp["network"]:
            if sp["seq"] < seq and n.get("data"):
                out.update(n["data"].get("hidden") or {})
    return out


def _common_values(steps: List[dict]) -> Dict[str, str]:
    """두 단계 이상에 같은 값으로 붙는 파라미터 — 회사 코드 같은 설정값으로 본다."""
    seen: Dict[str, set] = {}
    vals: Dict[str, str] = {}
    for st in steps:
        for name, value, _ in _pairs(st["_sample"][1]):
            if not value or name in DISCRIMINATORS:
                continue
            seen.setdefault(name, set()).add(st["id"])
            vals.setdefault(name, value)
            if vals[name] != value:
                seen[name] = set()
    return {k: vals[k] for k, ids in seen.items() if len(ids) >= 2}


def _find_link(value: str, prev_steps: List[dict]) -> List[Tuple[dict, str]]:
    """앞 단계 응답 어디에 이 값이 있나. 잎 값이 같으면 그 경로, 링크 문자열의 쿼리 값이 같으면 '경로?이름'."""
    hits = []
    for st in reversed(prev_steps):
        data = st["_sample"][2]
        if data is None:
            continue
        direct = [(st, p) for p, v in leaves(data) if str(v) == value and ".hidden." not in p and "_links" not in p and not _is_link_path(data, p)]
        if direct:
            hits += direct
            continue
        for p, v in leaves(data):
            if "_links" in p and isinstance(v, str) and "?" in v:
                q = dict(parse_qsl(urlsplit(v).query))
                name = next((k for k, x in q.items() if x == value), None)
                if name:
                    hits.append((st, f"{p}?{name}"))
    return hits

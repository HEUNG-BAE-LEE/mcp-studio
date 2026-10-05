"""관측한 요청·응답과 소스 정보로 파라미터, 응답 매핑, 코드값 변환표, 도구 이름을 추정한다.

원칙: 근거가 있는 것만 말한다. 날짜 형식은 실제로 YYYYMMDD 값을 봤을 때만, 코드값은 코드표 응답을 봤을 때만
규칙을 붙인다. 모르는 것은 비워 두고 화면이 "추정"으로 표시하게 한다.
"""
import json
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlsplit

from app.ieum.gateway import spec

_ID_SEG = re.compile(r"^(\d+|[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}|(?=[A-Za-z_-]*\d)[0-9A-Za-z_-]{20,})$")
_JAVA_TYPES = {
    "int": "integer", "integer": "integer", "long": "integer", "short": "integer", "bigint": "integer",
    "double": "number", "float": "number", "bigdecimal": "number", "number": "number",
    "boolean": "boolean", "bool": "boolean",
}
_GENERIC = {"cd", "code", "nm", "name", "no", "id", "type", "val", "value", "yn", "dt", "ymd"}
_VERB_FIRST = {"get", "list", "search", "find", "query", "count", "check", "view", "detail", "select", "sel", "inq", "inqr", "load"}


# ── 경로 ────────────────────────────────────────────────────────────────────

def templatize(path: str) -> str:
    """경로의 식별자를 자리표시자로 바꾼다. /orders/1023 과 /orders/1024 는 같은 API 다."""
    out, n = [], 0
    for seg in path.split("/"):
        if seg and _ID_SEG.match(seg):
            n += 1
            out.append("{id}" if n == 1 else f"{{id{n}}}")
        else:
            out.append(seg)
    return "/".join(out)


# ── 요청 ────────────────────────────────────────────────────────────────────

def request_pairs(obs) -> List[Tuple[str, str, str]]:
    """관측한 요청의 (이름, 값, 위치). 위치는 query / form / body."""
    pairs = [(k, v, "query") for k, v in parse_qsl(urlsplit(obs.url).query, keep_blank_values=True)]
    if obs.post:
        ctype = (obs.headers or {}).get("content-type", "").lower()
        if "json" in ctype:
            try:
                data = json.loads(obs.post)
                if isinstance(data, dict):
                    pairs += [(str(k), "" if v is None else str(v), "body") for k, v in data.items() if not isinstance(v, (dict, list))]
            except ValueError:
                pass
        else:
            pairs += [(k, v, "form") for k, v in parse_qsl(obs.post, keep_blank_values=True)]
    return pairs


def _java_type(t: str) -> str:
    base = re.sub(r"<.*>|\[\]", "", t or "").strip().lower()
    return _JAVA_TYPES.get(base, "string")


_DATE8 = re.compile(r"^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$")


def _guess_type(values: List[str]) -> str:
    if values and all(_DATE8.match(v) for v in values):
        return "string"                      # YYYYMMDD 는 숫자가 아니라 날짜 문자열이다. 날짜 규칙이 붙을 수 있게 둔다
    if values and all(re.fullmatch(r"-?\d+", v) and not (len(v) > 1 and v.startswith("0")) and len(v) < 10 for v in values):
        return "integer"
    if values and all(re.fullmatch(r"-?\d+\.\d+", v) for v in values):
        return "number"
    return "string"


def _coerce(v: str, t: str):
    try:
        return int(v) if t == "integer" else float(v) if t == "number" else v
    except ValueError:
        return v


def build_params(src_params: list, samples: list, masker, *, default_loc: str = "query") -> List[dict]:
    """소스의 파라미터와 관측한 값을 합쳐 도구 파라미터 목록을 만든다.

    필수 여부: 소스가 말해 주면 그것을, 아니면 관측한 요청 2건 이상에 모두 있을 때만 필수로 본다.
    한 번 본 것으로 필수라고 말하지 않는다.
    """
    src = {p.name: p for p in src_params}
    seen: Dict[str, List[str]] = {}
    where: Dict[str, str] = {}
    count: Dict[str, int] = {}
    for s in samples:
        names_in_sample = set()
        for k, v, loc in request_pairs(s):
            seen.setdefault(k, [])
            if v != "" and v not in seen[k]:
                seen[k].append(v)
            where.setdefault(k, loc)
            if v != "":                          # 빈 값으로 보낸 것(vendCd=)은 "안 채운 선택 조건"이다. 필수 판단에 세지 않는다
                names_in_sample.add(k)
        for k in names_in_sample:
            count[k] = count.get(k, 0) + 1
    n = len(samples)

    out = []
    for name in list(src) + [k for k in seen if k not in src]:
        sp = src.get(name)
        vals = [masker.text(v) for v in seen.get(name, [])[:5]]
        t = _java_type(sp.type) if sp else _guess_type(seen.get(name, []))
        sch = {"type": t}
        if vals:
            sch["example"] = _coerce(vals[0], t)
        loc = sp.loc if sp else where.get(name, default_loc)
        required = bool(sp.required) if sp else (n >= 2 and count.get(name, 0) == n)
        p = spec._param(name, loc, sch, required, (sp.desc if sp and sp.desc else None))
        if sp and p.get("rule") != "date":
            p["ot"] = sp.type or p["ot"]
        p["obs"] = vals
        if not vals:
            p["ex"] = ""                     # 본 값이 없으면 예시를 지어내지 않는다
        out.append(p)

    # 화면이 늘 같은 값으로 보내는 헤더(X-Requested-With 같은)는 AI 에게 보이지 않게 이음이 넣는다.
    if n:
        names = set.intersection(*[set((s.headers or {}).keys()) for s in samples])
        for lk in sorted(names):
            if lk.startswith("x-") and len({(s.headers or {}).get(lk) for s in samples}) == 1:
                v = samples[0].headers[lk]
                out.append({"o": "-".join(w.capitalize() for w in lk.split("-")), "ot": "string", "a": "", "at": "string", "loc": "header",
                            "rule": "inject", "d": "화면이 항상 같은 값으로 보내는 헤더", "ex": v, "v": v})
    return out


# ── 응답 ────────────────────────────────────────────────────────────────────

def parse_json(text: str):
    """JSON 판정은 Content-Type 이 아니라 파싱 시도로 한다. 레거시 시스템이 text/html 로 JSON 을 보낸다."""
    t = (text or "").lstrip("﻿ \n\r\t")
    if not t or t[0] not in "{[":
        return None
    try:
        return json.loads(t)
    except ValueError:
        return None


def build_res(sample_text: str, masker) -> Tuple[List[dict], str]:
    """(응답 매핑 행, 마스킹한 샘플 본문). JSON 이 아니면 ([], "")."""
    data = parse_json(sample_text)
    if data is None:
        return [], ""
    masked = masker.value(data)
    rows = spec._res_rows(spec._schema_of(masked))
    return rows, json.dumps(masked, ensure_ascii=False, indent=2)[:4000]


# ── 공통코드 변환표 ─────────────────────────────────────────────────────────

_GROUP_PARAM = re.compile(r"(grp|group|type|cat|kind|cmmn|code)", re.I)
_CODE_KEY = re.compile(r"^(cd|code|value|val|.*_cd|.*cd|.*code)$", re.I)
_NAME_KEY = re.compile(r"(nm|name|label|text|desc)$", re.I)


def _lists(node):
    if isinstance(node, list):
        if node and all(isinstance(x, dict) for x in node):
            yield node
        for x in node[:3]:
            yield from _lists(x)
    elif isinstance(node, dict):
        for v in node.values():
            yield from _lists(v)


def detect_code_tables(observed: list) -> Dict[str, List[Tuple[str, str]]]:
    """공통코드를 돌려주는 응답에서 {그룹: [(코드, 이름)]} 을 만든다.

    코드표 API 로 볼 근거가 있을 때만 쓴다: 요청에 그룹을 가리키는 파라미터(grpCd=PO_STTS)가 있거나 경로에 code 가 있다.
    그냥 `XXX_CD`, `XXX_NM` 필드가 있다고 코드표로 보면 거래처 목록 같은 마스터 데이터가 코드값으로 둔갑한다.
    """
    tables: Dict[str, List[Tuple[str, str]]] = {}
    for o in observed:
        if o.blocked or o.file or o.out_of_scope or o.status != 200:
            continue
        data = parse_json(o.body)
        if data is None:
            continue
        query = parse_qsl(urlsplit(o.url).query)
        group = next((v for k, v in query if _GROUP_PARAM.search(k) and re.fullmatch(r"[\w.\-]{1,40}", v)), "")
        if not group and not re.search(r"code|cmmn", urlsplit(o.url).path, re.I):
            continue
        group = group or urlsplit(o.url).path.rsplit("/", 1)[-1]
        for rows in _lists(data):
            keys = list(rows[0].keys())
            code_k = next((k for k in keys if _CODE_KEY.match(k)), None)
            name_k = next((k for k in keys if k != code_k and _NAME_KEY.search(k)), None)
            if not code_k or not name_k or not 2 <= len(rows) <= 60:
                continue
            pairs = [(str(r.get(code_k, "")), str(r.get(name_k, ""))) for r in rows]
            if all(c and len(c) <= 12 for c, _ in pairs) and len({c for c, _ in pairs}) == len(pairs):
                tables.setdefault(group, pairs)
    return tables


def _tokens(name: str) -> set:
    toks = {t.lower() for t in re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])", str(name))}
    return {t for t in toks if t not in _GENERIC}


def _table_for(name: str, values: List[str], tables: dict) -> Optional[str]:
    """이름이 같은 낱말을 공유하고 관측한 값이 모두 그 표 안에 있는 그룹. 하나로 정해질 때만 돌려준다."""
    mine = _tokens(name)
    if not mine or not values:
        return None
    scored = [(len(mine & _tokens(g)), g) for g, rows in tables.items() if mine & _tokens(g) and set(values) <= {c for c, _ in rows}]
    if not scored:
        return None
    best = max(s for s, _ in scored)
    top = [g for s, g in scored if s == best]
    return top[0] if len(top) == 1 else None      # PO_STTS_CD 는 PO_STTS(2) 가 PR_STTS(1) 보다 가깝다. 동점이면 정하지 않는다


def apply_codes(params: List[dict], res_rows: List[dict], tables: dict) -> int:
    """코드표와 맞는 파라미터·응답 필드에 코드값 변환 규칙을 붙인다. 붙인 개수를 돌려준다.

    AI 가 읽는 값은 코드표의 한글 이름 그대로다. 영문 별칭을 지어내지 않는다.
    """
    used = 0
    for p in params:
        if p.get("loc") == "header" or not p.get("obs"):
            continue
        g = _table_for(p["o"], p["obs"], tables)
        if g:
            codes = [[c, nm, nm] for c, nm in tables[g]]
            label = {c: nm for c, nm in tables[g]}
            p.update(rule="code", codes=codes, at="string", ot="string", ax=label.get(p["obs"][0], p["obs"][0]))
            p["d"] = f"{p.get('d') or p['o']} (공통코드 {g})" if p.get("d") == p["o"] or not p.get("d") else f"{p['d']} (공통코드 {g})"
            used += 1
    for r in res_rows:
        leaf = r["o"].split(".")[-1].replace("[]", "")
        g = _table_for(leaf, [str(r.get("ov", ""))], tables)
        if g:
            label = {c: nm for c, nm in tables[g]}
            r.update(rule="code", codes=[[c, nm, nm] for c, nm in tables[g]], av=label.get(str(r["ov"]), r["ov"]), at="string")
            used += 1
    return used


# ── 이름과 설명 ─────────────────────────────────────────────────────────────

def tool_name(path: str, fn: str, mode: str, taken: set) -> str:
    """도구 이름 제안. 소스의 메서드 이름이 있으면 그것을, 없으면 경로의 마지막 조각을 쓴다. 읽기는 get_ 으로 맞춘다."""
    raw = fn or re.sub(r"\.\w+$", "", path.rstrip("/").rsplit("/", 1)[-1]) or "api"
    name = spec.snake(raw)
    head = name.split("_", 1)[0]
    if mode == "read":
        if head in ("select", "sel", "inq", "inqr"):
            name = "get_" + name.split("_", 1)[1] if "_" in name else "get_" + name
        elif head not in _VERB_FIRST:
            name = "get_" + name
    name = re.sub(r"[^a-z0-9_]", "_", name)[:48].strip("_") or "api"
    if not name[0].isalpha():
        name = "api_" + name
    base, n = name, 2
    while name in taken:
        name, n = f"{base}_{n}", n + 1
    taken.add(name)
    return name


def screen_title(label: str) -> str:
    """"발주 현황 > 조회 버튼 클릭" → "발주 현황 조회"."""
    if not label or " > " not in label:
        return label or ""
    heading, action = label.split(" > ", 1)
    action = re.sub(r"( 버튼| 링크)? 클릭$", "", action).strip()
    return heading if action == "화면 열기" else f"{heading} {action}".strip()

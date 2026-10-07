"""소스와 트래픽을 대조해 API 후보를 만든다.

두 근거를 경로로 맞춘다. 소스의 매핑(`/poDetail/{poNo}`)과 화면이 부른 주소(`/po/poDetail/PO-1`)는
운영 주소의 경로(`/po`)를 떼고, 확장자(.do)와 경로 변수를 무시해 비교한다.

    둘 다 있음 → 실제로 쓰이고 소스로 형식까지 확인한 API
    소스에만   → 화면에서 호출되지 않은 API (쓰기 기능이거나 안 쓰는 API 일 수 있다)
    트래픽에만 → 저장소에 소스가 없는 API (공통 모듈이거나 다른 저장소에 있을 수 있다)

레코드의 모양은 화면(discovery.js)이 그대로 읽는다.
"""
import http
import json
import re
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import infer, masking
from app.ieum.discovery.policy import Policy
from app.ieum.gateway import spec

# 로그인·로그아웃은 도구가 아니다. 서비스 계정 로그인은 이음이 알아서 한다.
_AUTH_PATH = re.compile(r"(?:^|/)(?:login|logout|logon|logoff|signin|signout)", re.I)
_EXT = re.compile(r"\.(do|action|ajax|json|jsp|html?|nhn|cgi|php)$", re.I)


def _norm(path: str) -> str:
    p = re.sub(r"/{2,}", "/", urlsplit(path).path)
    return p.rstrip("/") or "/"


def _stem(path: str) -> str:
    return _EXT.sub("", _norm(path))


def _src_regex(path: str):
    pat = re.sub(r"\\\{.*?\\\}", "[^/]+", re.escape(_stem(path)))
    return re.compile("^" + pat + "$")


def _slug(method: str, path: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", f"{method.lower()} {path}").strip("_")


def _status_line(code: int) -> str:
    try:
        return f"HTTP/1.1 {code} {http.HTTPStatus(code).phrase}"
    except ValueError:
        return f"HTTP/1.1 {code}"


def _req_text(o, masker) -> str:
    """캡처한 요청 하나를 HTTP 원문처럼 보여 준다. 값은 마스킹하고 쿠키는 가린다."""
    u = urlsplit(o.url)
    query = "&".join(f"{k}={v}" for k, v in masker.pairs(parse_qsl(u.query, keep_blank_values=True)))
    lines = [f"{o.method} {u.path}{'?' + query if query else ''} HTTP/1.1", f"Host: {u.netloc}", "Cookie: ••••••••"]
    for k, v in (o.headers or {}).items():
        lines.append(f"{'-'.join(w.capitalize() for w in k.split('-'))}: {v}")
    if o.post:
        ctype = (o.headers or {}).get("content-type", "").lower()
        body = o.post
        if "json" in ctype:
            data = infer.parse_json(body)
            body = json.dumps(masker.value(data), ensure_ascii=False) if data is not None else masker.text(body)
        else:
            body = "&".join(f"{k}={v}" for k, v in masker.pairs(parse_qsl(body, keep_blank_values=True)))
        lines += ["", body]
    return "\n".join(lines)


def _res_text(o, masked_json: str, masker) -> str:
    head = [_status_line(o.status), f"Content-Type: {o.ctype}"] if o.ctype else [_status_line(o.status)]
    body = masked_json or masker.text((o.body or "")[:1500])
    return "\n".join(head + ["", body])


class _Group:
    """같은 (메서드, 경로)로 관측한 요청들."""

    def __init__(self, method: str, key: str):
        self.method, self.key, self.items = method, key, []

    @property
    def sample(self):
        ok = [o for o in self.items if not o.blocked and o.status and o.status < 400]
        jsonish = [o for o in ok if infer.parse_json(o.body) is not None]
        return (jsonish or ok or self.items)[0]


def _group_traffic(crawl, policy: Policy, notes: List[str]) -> List[_Group]:
    groups: Dict[tuple, _Group] = {}
    dropped = 0
    for o in crawl.observed:
        path = urlsplit(o.url).path
        if (crawl.login_path and path == crawl.login_path) or _AUTH_PATH.search(path):
            dropped += 1
            continue
        if o.out_of_scope:
            key = f"{urlsplit(o.url).scheme}://{urlsplit(o.url).netloc}{path}"
        else:
            key = infer.templatize(policy.rel(path))
        groups.setdefault((o.method, key), _Group(o.method, key)).items.append(o)
    if dropped:
        notes.append(f"로그인·로그아웃 요청 {dropped}건은 도구 후보에서 뺐습니다")
    return list(groups.values())


# 소스에 박힌 비밀(password = "...", apiKey: '...')은 화면에도, 저장하는 작업 기록에도 남기지 않는다.
_SECRET_LITERAL = re.compile(r"""(?i)((?:pass(?:word)?|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\w*\s*[=:]\s*)(["'])[^"'\n]{1,200}\2""")


def scrub_snippet(text: str) -> str:
    return _SECRET_LITERAL.sub(lambda m: f"{m.group(1)}{m.group(2)}{masking.HIDDEN}{m.group(2)}", text or "")


def _src_text(ep) -> dict:
    return {"file": ep.file, "line": ep.line, "cls": ep.cls, "fn": ep.fn, "vo": ep.vo, "mapper": ep.mapper, "sql": ep.sql, "ret": ep.ret,
            "dep": ep.deprecated, "snippet": scrub_snippet(ep.snippet), "lang": ep.lang, "mode": ep.mode, "kind": ep.kind}


def build(scan, crawl, policy: Policy, masker, *, read_post: bool = False) -> dict:
    """{apis, notes, codeTables, stats}. scan, crawl 은 None 일 수 있다(그 근거를 쓰지 않은 탐색)."""
    notes: List[str] = []
    src_eps = [e for e in (scan.endpoints if scan else []) if e.kind in ("api", "file")]
    excluded = [e for e in src_eps if _AUTH_PATH.search(e.path)]
    src_eps = [e for e in src_eps if e not in excluded]
    if excluded:
        notes.append(f"소스의 로그인·로그아웃 매핑 {len(excluded)}개는 도구 후보에서 뺐습니다")
    groups = _group_traffic(crawl, policy, notes) if crawl else []
    tables = infer.detect_code_tables(crawl.observed) if crawl else {}

    matchers = [(e, _src_regex(e.path)) for e in src_eps]
    used_src: set = set()
    apis: List[dict] = []
    code_uses = 0

    def add(method: str, path: str, src, group: Optional[_Group], *, out: bool = False) -> None:
        nonlocal code_uses
        a = _record(method, path, src, group, policy, masker, out=out)
        code_uses += infer.apply_codes(a["params"], a["res"], tables)
        apis.append(a)

    for g in groups:
        first = g.items[0]
        if first.out_of_scope:
            add(g.method, g.key, None, g, out=True)
            continue
        raw = _stem(policy.rel(urlsplit(first.url).path))
        hit = next((e for e, rx in matchers if rx.match(raw) and e.method == g.method), None) \
            or next((e for e, rx in matchers if rx.match(raw) and e.method is None), None)
        if hit:
            used_src.add(id(hit))
        # 소스 매핑에 경로 변수가 있으면 그 경로를 쓴다. 화면이 부른 주소에는 특정 값(PO-1)이 들어 있다.
        add(g.method, hit.path if hit and "{" in hit.path else g.key, hit, g)
    for e, _ in matchers:
        if id(e) not in used_src:
            add(e.method or ("POST" if e.mode == "write" else "GET"), e.path, e, None)

    seen_ids: Dict[str, int] = {}
    for a in apis:                                              # /a-b 와 /a_b 처럼 슬러그가 같아지는 경로의 id 가 겹치지 않게
        n = seen_ids.get(a["id"], 0)
        seen_ids[a["id"]] = n + 1
        if n:
            a["id"] = f"{a['id']}_{n + 1}"
    if any(len(g.items) > 1 for g in groups):
        notes.append("값만 다른 요청은 경로 하나로 묶었습니다")
    if code_uses:
        notes.append(f"공통코드 응답으로 코드값 변환표 {len(tables)}개를 만들었습니다")
    inscope = [a for a in apis if a["verify"]["k"] != "out"]
    stats = {k: sum(1 for a in inscope if a["ev"] == k) for k in ("both", "src", "tr")}
    return {"apis": apis, "notes": notes, "codeTables": len(tables), "stats": stats}


def _record(method: str, path: str, src, group: Optional[_Group], policy: Policy, masker, *, out: bool) -> dict:
    samples = group.items if group else []
    sample = group.sample if group else None
    mode = _mode(src, group, method, policy)
    tr = None
    res_rows: List[dict] = []
    if group:
        res_rows, masked_json = infer.build_res(sample.body, masker) if not sample.blocked and not sample.file else ([], "")
        first = group.items[0]
        labels = []
        for o in group.items:
            t = infer.screen_title(o.label)
            if t and t not in labels:
                labels.append(t)
        u = urlsplit(sample.url)
        tr = {"screen": re.sub(r" 클릭$", "", first.label) if first.label else first.screen, "screens": labels[:3],
              "samples": len(group.items), "q": ("?" + "&".join(f"{k}={v}" for k, v in masker.pairs(parse_qsl(u.query)))) if u.query else "",
              "blocked": all(o.blocked for o in group.items), "file": any(o.file for o in group.items), "req": _req_text(sample, masker),
              "res": "" if sample.blocked else ("" if sample.file else _res_text(sample, masked_json, masker)), "code": sample.status}
        if out:
            tr["host"] = f"{urlsplit(sample.url).scheme}://{urlsplit(sample.url).netloc}"

    p_loc = "query" if method == "GET" else "form"
    params = [] if out else infer.build_params(src.params if src else [], samples, masker, default_loc=p_loc)
    for var in re.findall(r"\{(\w+)\}", path):                      # 경로 변수는 소스가 모르는 이름이어도 파라미터로 둔다
        if not any(p["o"] == var for p in params):
            params.insert(0, spec._param(var, "path", {"type": "string"}, True, None))
    for p in params:
        if p.get("loc") == "path":
            p["req"] = 1

    ev = "out" if out else "both" if src and group else "src" if src else "tr"
    title = (src.title if src and src.title else "") or (infer.screen_title(group.items[0].label) if group else "") or (src.fn if src else path)
    return {
        "id": _slug(method, path), "m": method, "path": path, "mode": mode, "ev": ev, "title": title, "tool": None, "desc": "", "rec": "check", "recNote": "",
        "src": _src_text(src) if src else None, "tr": tr, "verify": {"k": "out" if out else "none"}, "params": params, "res": res_rows,
        "dep": bool(src and src.deprecated), "_group": group,
    }


def _mode(src, group: Optional[_Group], method: str, policy: Policy) -> str:
    """읽기/쓰기. 소스가 매퍼까지 따라가 정한 것이 가장 믿을 만하다. 그다음이 HTTP 메서드다."""
    if src and src.mode in ("read", "write"):
        return src.mode
    if group and all(o.blocked for o in group.items):
        return "write"
    if method == "GET":
        return "read"
    if group and policy.is_read_post(group.items[0].url):
        return "read"
    return "write"


def finalize(apis: List[dict], masker) -> None:
    """검증이 끝난 뒤: 도구 이름, 설명, 추천을 정한다. 검증 결과가 도구가 될 수 있는지도 가른다."""
    taken: set = set()
    for a in apis:
        a["tool"] = None if _not_a_tool(a) else infer.tool_name(a["path"], a["src"]["fn"] if a["src"] else "", a["mode"], taken)
        if not a["res"] and a.get("_body"):                        # 트래픽이 없는 읽기 API 는 검증 호출의 응답으로 형식을 안다
            a["res"], _ = infer.build_res(a["_body"], masker)
        a["desc"] = _desc(a)
        if a["mode"] == "write":
            a["confirmQ"] = f"{a['title']} 작업을 실행할까요?"
        a["rec"], a["recNote"] = _recommend(a)


def _not_a_tool(a: dict) -> bool:
    k, tr, src = a["verify"]["k"], a["tr"], a["src"]
    return bool(k in ("out", "file", "404") or a["dep"] or (src and src["kind"] == "file") or (tr and tr["file"]))


def _desc(a: dict) -> str:
    names = [p["o"] for p in a["params"] if p.get("loc") != "header"][:5]
    kind = "조회" if a["mode"] == "read" else "데이터를 만들거나 바꾸는"
    where = ""
    if a["tr"] and a["tr"]["screens"]:
        where = f" 운영 화면의 \"{a['tr']['screens'][0]}\"에서 쓰입니다."
    elif a["src"]:
        where = f" 소스 {a['src']['file']} 의 {a['src']['fn']} 로 찾았습니다."
    inp = f" 입력: {', '.join(names)}." if names else ""
    return f"{a['title']}. {kind} API 입니다.{inp}{where}".strip()


def _recommend(a: dict):
    """(추천, 이유). 이유는 추천이 "등록 추천"이 아닐 때 사람이 판단할 근거다."""
    v, mode, ev = a["verify"], a["mode"], a["ev"]
    k = v["k"]
    if k == "out":
        return "no", "다른 사이트로 가는 요청이라 이 시스템의 API 가 아닙니다."
    if a["dep"]:
        return "no", "소스에서 @Deprecated 로 표시된 API 입니다. 더 이상 쓰지 않을 가능성이 큽니다."
    if k == "file" or (a["src"] and a["src"]["kind"] == "file") or (a["tr"] and a["tr"]["file"]):
        return "no", "파일(엑셀 등)을 내려받는 API 라 AI 도구로 쓰기 어렵습니다."
    if k == "404":
        return "no", "운영에서 호출했더니 없는 주소였습니다. 소스에만 남은 옛 API 일 수 있습니다."
    if mode == "write":
        if k == "stg":
            return "yes", "스테이징에서 호출해 동작을 확인했습니다. 쓰기 도구라 실행 전에 사용자 확인을 받습니다."
        if k == "stgerr":
            return "check", f"스테이징 호출이 실패했습니다(HTTP {v.get('code')}). 파라미터와 권한을 확인해 주세요."
        if k == "block" and a["tr"] and a["tr"]["samples"] >= 3 and not a["src"]:
            return "no", "화면이 주기적으로 자동 전송하는 요청으로 보입니다. AI 가 직접 부를 일은 드뭅니다."
        if k == "block":
            return "check", "화면이 보낸 쓰기 요청을 운영에 보내지 않고 형식만 기록했습니다. 동작은 검증하지 못했습니다."
        return "check", "쓰기 API 를 검증하지 않았으니 형식을 직접 확인해 주세요."
    if k == "ok":
        if ev == "tr":
            return "yes", "저장소에 소스가 없어 타입은 관찰한 값으로 추정했습니다."
        if ev == "src":
            return "check", "화면에서 호출되는 것을 확인하지 못했습니다. 실제로 쓰이는지 확인해 주세요."
        return "yes", ""
    if k == "err":
        return "check", f"운영에서 호출했더니 HTTP {v.get('code')} 오류가 났습니다. 필수 파라미터를 몰라서일 수 있습니다."
    return "check", "운영에서 호출해 확인하지 않았습니다."

# apps/backend/app/ieum/recorder/analyze.py
"""기록 → 업무 기능. 규칙만으로 동작한다(LLM 에 의존하지 않는다 — LLM 이 죽어도 분석은 된다).

핵심 판단 두 가지:
1) 이 요청이 업무의 본체인가: 행동 직후 나갔고, 응답(HTML 이면 표 변환 사본) 값이 직후 화면(ARIA)에 나타났는가.
2) 이 파라미터 값은 어디서 왔나: 사용자 입력, 앞 단계 응답, 직전 화면의 숨은 입력(매번 바뀌는 토큰), 설정, 상수.

같은 값이 여러 곳에 있으면 하나를 골라 조용히 확정하지 않는다. 확신도를 낮춰 검토 화면에서 사람에게 묻는다.
ARIA 와 응답은 같은 마스킹기로 가려 저장했으므로, 가린 값끼리 비교해도 판정이 맞다.
"""
import re
import time
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import infer
from app.ieum.discovery.masking import HIDDEN

USER_INPUT, PREVIOUS_STEP_OUTPUT, SESSION_CONTEXT = "USER_INPUT", "PREVIOUS_STEP_OUTPUT", "SESSION_CONTEXT"
SYSTEM_CONFIG, DERIVED, CONSTANT = "SYSTEM_CONFIG", "DERIVED", "CONSTANT"
DISCRIMINATORS = ("cmd", "action", "method", "mode", "op", "service", "operationName", "actionType", "flag")
_DATE = re.compile(r"^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$")
_TOKEN_NAME = re.compile(r"csrf|xsrf|token|viewstate|eventvalidation|nonce", re.I)
_MASKED = re.compile(r"\*{2,}|•{2,}")
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
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node[:50]):
                walk(v, f"{path}[{i}]")
        elif node is not None:
            out.append((path, node))
    walk(data, "$")
    return out


def get_path(data, path: str):
    query = None
    if "?" in path:
        path, query = path.split("?", 1)
    node = data
    for name, idx in re.findall(r"\.([^.\[]+)|\[(\d+)\]", path[1:]):
        try:
            node = node[name] if name else node[int(idx)]
        except (KeyError, IndexError, TypeError):
            return None
    if query and isinstance(node, str):
        return dict(parse_qsl(urlsplit(node).query)).get(query)
    return node


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


def _op_of(n: dict, label: str) -> str:
    if n["method"] in ("GET", "HEAD") and not n.get("held"):
        return "READ"
    text = f"{n['path']} {label}"
    for op, pat in _OPS:
        if pat.search(text):
            return op
    return "CREATE"


def _shown(data, raw: str, aria: str) -> bool:
    """응답 값이 화면에 나타났는가. JSON·HTML 사본이면 잎 값으로, 아니면 응답 글자 조각으로 본다."""
    if not aria:
        return False
    if data is not None:
        return any(len(str(v)) >= MIN_VALUE_LEN and str(v) in aria for p, v in leaves(data)[:300] if "_links" not in p and ".hidden." not in p)
    texts = re.findall(r">([^<>]{3,})<", raw or "")
    return any(t.strip() and t.strip() in aria for t in texts[:50])


def analyze(rec: dict, spans: List[dict]) -> dict:
    login_path = (rec.get("login") or {}).get("path") or ""
    items, excluded = [], []
    for sp in spans:
        for n in sp["network"]:
            row = {"method": n["method"], "path": infer.templatize(n["path"])}
            full = urlsplit(n["url"]).path
            if full == login_path:
                excluded.append(dict(row, role="auth", why="로그인 요청 (인증 방법으로 따로 보관)"))
            elif sp["action"]["target"] is None:
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
    seen: Dict[tuple, Optional[dict]] = {}
    for sp, n, path, data in items:
        disc = _discriminator(n)
        key = (n["base"], n["method"], path, disc)
        if path in code_paths:
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": path, "role": "code", "why": "코드표 응답 (상태코드 풀이용 참조)"})
            continue
        write = n["method"] not in ("GET", "HEAD") or bool(n.get("held"))
        aria = (sp.get("post") or {}).get("aria") or ""
        if not (_shown(data, n.get("res") or "", aria) or write):
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": path, "role": "page" if n["rtype"] == "document" else "noise",
                                 "why": "응답 값이 화면에 나타나지 않음"})
            continue
        if seen.get(key) is not None:
            seen[key]["_spans"].append(sp["seq"])
            continue
        st = {"id": f"s{len(steps) + 1}", "role": "core", "base": n["base"], "origin": n["origin"], "method": n["method"], "path": path,
              "discriminator": disc, "kind": _kind(n), "charset": n.get("charset"), "exec": "http", "formPage": None, "write": write,
              "headers": {k: v for k, v in (n.get("headers") or {}).items() if k.startswith("x-")}, "outputs": {}, "params": [],
              "recordedRes": n.get("res") or "", "recordedData": n.get("data"), "recordedStatus": n["status"],
              "_sample": (sp, n, data), "_spans": [sp["seq"]], "_label": (sp["action"]["target"] or {}).get("text", ""),
              "_title": (sp.get("pre") or {}).get("title", "")}
        seen[key] = st
        steps.append(st)

    # 2) 파라미터와 값 연결
    user_vals = _user_values(spans)
    common = _common_values(steps)
    inputs: Dict[str, dict] = {}
    for i, st in enumerate(steps):
        sp, n, _ = st["_sample"]
        hidden = _hidden_before(spans, sp["seq"])
        for name, value, loc in _pairs(n):
            p = {"a": name, "loc": loc, "ex": "" if HIDDEN in value else value, "type": _type(value), "required": value != ""}
            links = _find_link(value, steps[:i]) if len(value) >= MIN_VALUE_LEN else []
            if links:
                prev, path, many = links[0][0], links[0][1], len(links) > 1
                out_name = name if "?" in path else (path.rsplit(".", 1)[-1].split("[")[0] or name)
                prev["outputs"][out_name] = path
                p.update({"from": f"{prev['id']}.{out_name}", "source": PREVIOUS_STEP_OUTPUT, "confidence": "low" if many else "high"})
                if prev["role"] != "core":
                    prev["role"] = "prereq"
            elif (name in hidden and hidden[name] == value) or (_TOKEN_NAME.search(name) and value not in user_vals):
                p.update({"from": f"session.hidden.{name}", "source": SESSION_CONTEXT, "confidence": "high" if name in hidden else "mid"})
                st["exec"] = "browser"
                st["formPage"] = (sp.get("pre") or {}).get("href") or None
            elif value in user_vals:
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "high"})
                inputs.setdefault(name, _input(name, p["type"], USER_INPUT, value, user_vals[value], "high", True))
            elif value == "":
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "low", "required": False})
                inputs.setdefault(name, _input(name, "string", USER_INPUT, "", "", "low", False))
            elif name in common and common[name] == value:
                p.update({"from": f"config.{name}", "source": SYSTEM_CONFIG, "confidence": "mid"})
            elif p["type"] == "date" and value == time.strftime("%Y%m%d", time.localtime(sp["action"]["t"] or time.time())):
                p.update({"from": f"input.{name}", "source": DERIVED, "confidence": "low"})
                inputs.setdefault(name, _input(name, "date", DERIVED, value, "", "low", True))
            elif HIDDEN in value:
                # 가린 비밀 값은 고정값이 될 수 없다. 실행 때 사용자(또는 금고)가 채우는 입력이다.
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "low"})
                inputs.setdefault(name, _input(name, "string", USER_INPUT, value, "", "low", True))
            else:
                looks_variable = p["type"] in ("date", "number") or bool(_MASKED.search(value))
                p.update({"from": f"const:{value}", "source": CONSTANT, "confidence": "low" if looks_variable else "mid"})
            st["params"].append(p)

    # 3) 출력
    output = {"from": None, "fields": []}
    cores = [s for s in steps if s["role"] == "core"]
    if cores:
        last = cores[-1]
        sp, n, data = last["_sample"]
        aria = (sp.get("post") or {}).get("aria") or ""
        if data is not None:
            output = {"from": last["id"], "fields": [p for p, v in leaves(data)[:300]
                                                     if len(str(v)) >= 2 and str(v) in aria and "_links" not in p and ".hidden." not in p][:20]}

    # 4) 정책
    ops = [_op_of(s["_sample"][1], s["_label"]) for s in steps] or ["READ"]
    op = max(ops, key=_ORDER.index)
    risk, approval = _RISK[op]
    policy_meta = {"operation": op, "risk": risk, "approval": approval, "envPolicy": "op-auto" if op == "READ" else "op-confirm",
                   "sensitivity": None, "scope": None}

    notes = []
    if not steps:
        notes.append("핵심 요청을 찾지 못했습니다. 아래 전체 요청 목록에서 업무에 해당하는 것을 골라 주세요.")
    if any(s["kind"] == "other" for s in steps):
        notes.append("JSON 도 표도 아닌 응답이 있어 그 단계에서는 값을 꺼낼 수 없습니다.")
    desc = _describe(rec, steps, list(inputs.values()), output, op)
    evidence = {s["id"]: s["_spans"] for s in steps}
    for s in steps:
        for k in ("_sample", "_spans", "_label", "_title"):
            s.pop(k, None)
    login = rec.get("login") or {}
    return {"id": "bf_" + rec["id"][4:], "name": rec["name"], "desc": desc, "status": "draft",
            "source": {"base": rec["sourceBase"], "recordingId": rec["id"], "made": "manual-record", "env": rec["env"]},
            "inputs": list(inputs.values()), "steps": steps, "references": [x for x in excluded if x["role"] == "code"],
            "excluded": excluded, "output": output,
            "auth": {"mode": "session" if login.get("recipe") else "none", "recipe": login.get("recipe")},
            "executionMode": None, "policy": policy_meta, "policyIncomplete": True,
            "verification": {"status": "pending", "at": None, "runs": []}, "evidence": evidence, "notes": notes}


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
            if v:
                t = f.get("target") or {}
                out.setdefault(v, t.get("label") or t.get("text") or t.get("name") or t.get("id") or "")
    return out


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
        direct = [(st, p) for p, v in leaves(data) if str(v) == value and ".hidden." not in p and "_links" not in p]
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

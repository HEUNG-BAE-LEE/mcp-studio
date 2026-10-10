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
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import capture, infer
from app.ieum.discovery.masking import HIDDEN, MASKED_RE, is_secret_key
from app.ieum.discovery.policy import Policy

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


def _is_write(n: dict, policy: Policy) -> bool:
    """조회용으로 지정한 POST(readPost)는 쓰기가 아니다.

    GET/HEAD 는 가드가 붙잡았거나(held), 스테이징에서 쓰기로 보고 보냈거나(decision=staging), 이름이 쓰기 같은 화면 스크립트
    GET 이면 쓰기다. 스테이징은 붙잡지 않아 held 가 거짓이므로 held 만 보면 deleteItem.do 가 읽기 도구가 된다."""
    if n["method"] in ("GET", "HEAD") and not (n.get("held") or n.get("decision") == "staging"
                                               or capture.is_write(n["url"], n["method"], n.get("rtype") or "", policy)):
        return False
    try:
        if policy.same_origin(n["url"]) and policy.is_read_post(n["url"]):
            return False
    except Exception:
        logging.warning("readPost 판정 실패 — 쓰기로 본다: %s", n.get("url"), exc_info=True)
    return True


def _op_of(n: dict, label: str, write: bool = True) -> str:
    if not write:
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
        return any(len(str(v)) >= MIN_VALUE_LEN and str(v) != HIDDEN and str(v) in aria
                   for p, v in leaves(data)[:300]
                   if "_links" not in p and ".hidden." not in p and not (p.startswith("$.tables[") and ".columns[" in p))   # 표 머리글은 화면 틀이다
    texts = re.findall(r">([^<>]{3,})<", raw or "")
    return any(t.strip() and t.strip() in aria for t in texts[:50])


def analyze(rec: dict, spans: List[dict]) -> dict:
    login_path = ((rec.get("login") or {}).get("path") or "").split(";")[0]
    policy = Policy(base=rec["sourceBase"], read_post=rec.get("readPost") or "")
    items, excluded = [], []
    for sp in spans:
        for n in sp["network"]:
            row = {"method": n["method"], "path": infer.templatize(n["path"]), "base": n["base"], "origin": n["origin"]}
            full = urlsplit(n["url"]).path.split(";")[0]        # ;jsessionid= 같은 경로 파라미터는 뗀다
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
        write = _is_write(n, policy)
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
              "discriminator": disc, "kind": _kind(n), "charset": n.get("charset"), "exec": "http", "formPage": None, "write": write,
              "headers": {}, "outputs": {}, "params": [],
              "recordedRes": n.get("res") or "", "recordedData": copy.deepcopy(n.get("data")), "recordedStatus": n["status"],
              "_sample": (sp, n, data), "_write": write, "_dropped": set(), "_spans": [sp["seq"]], "_label": (sp["action"]["target"] or {}).get("text", ""),
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
            if links:
                prev, path, many = links[0][0], links[0][1], len(links) > 1
                out_name = name if "?" in path else (path.rsplit(".", 1)[-1].split("[")[0] or name)
                prev["outputs"][out_name] = path
                contrib.append((prev, out_name, st["id"]))
                weak = many or (p["type"] == "number" and not _similar(name, out_name))
                p.update({"from": f"{prev['id']}.{out_name}", "source": PREVIOUS_STEP_OUTPUT, "confidence": "low" if weak else "high"})
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
            excluded.append({"method": st["method"], "path": st["path"], "base": st["base"], "origin": st["origin"], "role": "page" if st["recordedData"] and st["kind"] == "html" else "noise",
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
                                                     if len(str(v)) >= 2 and str(v) != HIDDEN and str(v) in aria and "_links" not in p and ".hidden." not in p][:20]}

    # 4) 정책
    ops = [_op_of(s["_sample"][1], s["_label"], s["write"]) for s in steps] or ["READ"]
    op = max(ops, key=_ORDER.index)
    risk, approval = _RISK[op]
    policy_meta = {"operation": op, "risk": risk, "approval": approval, "envPolicy": "op-auto" if op == "READ" else "op-confirm",
                   "sensitivity": None, "scope": None}

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

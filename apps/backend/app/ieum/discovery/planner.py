"""탐색 목적에 맞춘 계획과 용도 추정, 사람이 한 지시의 해석.

목적과 질문 예시를 보고 (1) 어떤 메뉴를 먼저 탐색할지 순서와 관련도를 정하고, (2) 찾은 API 가 어떤 질문에 답할 수 있는지(용도)
잇는다. AI(GPT)가 설정돼 있으면 AI 가 정하고, 없거나 실패하면 낱말이 겹치는 정도로 정한다. 어느 쪽으로 정했는지 화면에 밝힌다.

AI 에 보내는 것은 메뉴 이름, API 의 메서드·경로·제목·파라미터와 응답 필드 **이름**, 사용자가 적은 목적과 질문이다.
응답의 값(개인정보가 있을 수 있는 것)과 인증 정보는 보내지 않는다.
"""
import json
import re
from typing import Iterable, List, Optional, Tuple

from app.ieum.discovery import infer
from app.ieum.gateway import llm

REL = ("high", "mid", "low")
MAX_AI_APIS = 40            # 한 번에 AI 에 물어보는 API 수. 넘으면 나눠서 묻는다

_WORD = re.compile(r"[A-Za-z]+\d*|\d+|[가-힣]+")
# 질문 끝말과 조사는 어떤 메뉴 이름과도 겹치면 안 된다("얼마야"의 "얼마"가 "얼마 남았어" 메뉴를 끌어오지 않게).
_STOP = frozenset((
    "우리 이번 올해 지난 오늘 내일 어제 얼마 얼마야 알려줘 알려 줘 있어 없어 됐어 남았어 어때 뭐야 뭐 해줘 보여줘 좀 건 거 것 수 및 또는 "
    "은 는 이 가 을 를 의 에 에서 으로 로 와 과 도 만 야 요 해 줘요 주세요 인가 인지 몇 어디 언제 누가 무엇").split())
# 이름 끝에 붙는 회사·기관 표지. 질문에서 거래처 같은 고유명을 찾는 데 쓴다.
_ORG_TAIL = ("상사", "전자", "오피스", "물산", "산업", "건설", "은행", "상회", "무역", "테크", "시스템", "솔루션", "컴퍼니", "그룹", "제약", "식품", "유통")
_NEG = re.compile(r"(보지 ?마|건너뛰|빼 ?(줘|라|고)|제외|말아|하지 ?마|스킵|무시|필요 ?없)")
_TAKE = re.compile(r"(내가 (직접 )?(보여|조작|할게)|직접 (보여|조작)|보여 ?줄게|보여 ?드릴게)")


def _words(text: str) -> List[str]:
    return [w for w in _WORD.findall(text or "") if w not in _STOP]


def grams(text: str) -> frozenset:
    """한글은 두 글자씩 겹쳐 자른 조각(구매요청 → 구매, 매요, 요청), 영문·숫자는 낱말 그대로(소문자). 한 글자 낱말은 버린다."""
    out = set()
    for w in _words(text):
        if re.fullmatch(r"[가-힣]+", w):
            out.update(w[i:i + 2] for i in range(len(w) - 1))
        elif len(w) >= 2:
            out.add(w.lower())
    return frozenset(out)


def _frac(small: frozenset, big: frozenset) -> float:
    """small 의 조각 중 big 에도 있는 비율. 메뉴 이름(짧다)이 질문(길다) 안에 얼마나 들어 있는가."""
    return len(small & big) / len(small) if small else 0.0


def _plan_id(i: int) -> str:
    return f"m{i + 1}"


# ── 메뉴 계획 ───────────────────────────────────────────────────────────────

def heuristic_plan(menus: List[dict], purpose: str, ques: List[str]) -> List[dict]:
    """메뉴 이름이 질문·목적에 들어 있는 정도로 관련도를 정한다. 관련 높은 것부터, 같으면 화면 순서대로."""
    qg, pg = [grams(q) for q in ques], grams(purpose)
    items = []
    for i, m in enumerate(menus):
        g = grams(m["name"])
        per_q = [_frac(g, x) for x in qg]
        best, for_purpose = max(per_q, default=0.0), _frac(g, pg)
        rel = "high" if best >= 0.5 else "mid" if best > 0 or for_purpose >= 0.34 else "low"
        why = "" if rel == "high" else "목적과 관련 있어 보임" if rel == "mid" else "질문과 직접 관련 없음"
        items.append({"name": m["name"], "rel": rel, "qa": [j for j, f in enumerate(per_q) if f >= 0.34], "why": why, "_i": i})
    order = {"high": 0, "mid": 1, "low": 2}
    items.sort(key=lambda x: (order[x["rel"]], x["_i"]))
    return items


_PLAN_SYSTEM = ("너는 레거시 업무 시스템에서 AI 비서가 사용자 질문에 답할 API 를 찾으려면 어떤 메뉴를 먼저 열어 봐야 하는지 정하는 도우미다. "
                "주어진 메뉴 이름과 질문만 근거로 하고, 지어내지 않는다. JSON 배열만 출력한다.")


def _plan_prompt(menus: List[dict], purpose: str, ques: List[str]) -> str:
    lines = ["탐색 목적: %s" % (purpose or "(없음)"), "질문 예시:"] + ["Q%d. %s" % (i + 1, q) for i, q in enumerate(ques)] + ["메뉴:"]
    lines += ["- %s" % m["name"] for m in menus]
    lines += ["", "각 메뉴를 질문에 답하는 데 필요한 정도로 나눠라. high=질문과 직접 관련, mid=거쳐 가야 하거나 간접 관련, low=관련 없음.",
              "qa 는 그 메뉴에서 답을 찾을 수 있는 질문 번호의 배열(Q1 은 0), why 는 이유 한 줄(20자 안팎, high 는 빈 문자열도 된다).",
              "탐색할 순서(필요한 것부터)대로 모든 메뉴를 한 번씩 담아 다음 형식으로만 답해라:",
              '[{"name": "메뉴 이름 그대로", "rel": "high", "qa": [0], "why": ""}]']
    return "\n".join(lines)


def _clean_plan(raw, menus: List[dict], ques: List[str]) -> Optional[List[dict]]:
    """AI 답을 믿기 전에 거른다: 모르는 메뉴 이름은 버리고, 빠진 메뉴는 이름 겹침으로 채운다."""
    if isinstance(raw, dict):
        raw = raw.get("plan") or raw.get("menus") or raw.get("items")
    if not isinstance(raw, list):
        return None
    names = {m["name"]: m for m in menus}
    out, seen = [], set()
    for r in raw:
        if not isinstance(r, dict) or r.get("name") not in names or r["name"] in seen:
            continue
        seen.add(r["name"])
        qa = [int(i) for i in (r.get("qa") or []) if isinstance(i, int) and 0 <= i < len(ques)]
        out.append({"name": r["name"], "rel": r.get("rel") if r.get("rel") in REL else "mid", "qa": sorted(set(qa)),
                    "why": re.sub(r"\s+", " ", str(r.get("why") or "")).strip()[:40], "_i": names[r["name"]].get("_i", 0)})
    if not out:
        return None
    missing = [m for m in menus if m["name"] not in seen]
    return out + (heuristic_plan(missing, "", ques) if missing else [])


def build_plan(menus: List[dict], purpose: str, ques: List[str], *, use_ai: bool = True) -> Tuple[List[dict], str]:
    """(계획, 누가 정했나 "ai"|"rule"|"none"). 계획 항목: {id, name, rel, qa, why, st, hum} + 메뉴가 가진 나머지 키(url 등). none 은 목적이 없어 순서만 둔 것."""
    extra = {m["name"]: {k: v for k, v in m.items() if k not in ("name",)} for m in menus}
    menus = [dict(m, _i=i) for i, m in enumerate(menus)]
    if not (purpose or ques):
        # 목적이 없으면 관련도를 가릴 근거가 없다. 전부 '낮음'으로 두면 메뉴마다 질문이 쏟아지니, 화면 순서대로 모두 탐색한다.
        items = [dict({k: v for k, v in extra.get(m["name"], {}).items() if not k.startswith("_")}, id=_plan_id(i), name=m["name"], rel="mid", qa=[],
                      why="목적이 없어 화면 순서대로 탐색", st="wait", hum=False) for i, m in enumerate(menus)]
        return items, "none"
    plan, by = None, "rule"
    if use_ai and (purpose or ques) and llm.provider():
        try:
            plan, by = _clean_plan(llm.complete_json(_PLAN_SYSTEM, _plan_prompt(menus, purpose, ques)), menus, ques), "ai"
        except llm.LlmError:
            plan = None
    if plan is None:
        plan, by = heuristic_plan(menus, purpose, ques), "rule"
    items = []
    for i, it in enumerate(plan):
        keep = {k: v for k, v in extra.get(it["name"], {}).items() if not k.startswith("_")}
        items.append(dict(keep, id=_plan_id(i), name=it["name"], rel=it["rel"], qa=it["qa"], why=it["why"], st="wait", hum=False))
    return items, by


# ── 사람의 지시 ─────────────────────────────────────────────────────────────

def parse_command(text: str, plan: List[dict]) -> dict:
    """"거래처 관리는 보지 마" 같은 지시를 해석한다. {"op": skip|incl|take|memo, "menu": 계획 항목 또는 None}.

    메뉴 이름이 문장에 들어 있고 건너뛰라는 말이 있으면 skip, 그냥 언급이면 incl(관련 낮아 빠진 메뉴를 넣는다),
    "내가 보여줄게" 류면 take. 그 밖의 말은 memo — 기록만 남기고 계획에는 반영하지 않는다(반영한 척하지 않는다).
    """
    flat = lambda s: re.sub(r"\s+", "", s or "")
    t = flat(text)
    hit, best = None, 0
    for it in plan:
        # 눌러서 여는 메뉴의 이름은 "입찰 > 입찰공고 > 입찰공고목록" 처럼 길이 이어져 있다. 사람은 끝 이름만 말한다("입찰공고목록은 보지 마").
        for nm in (it["name"], it.get("leaf") or ""):
            n = flat(nm)
            if n and n in t and len(n) > best:
                hit, best = it, len(n)
    if hit is None:
        for it in plan:                                   # "발주 승인은" ↔ 메뉴 "승인" 처럼 이름의 한 낱말만 나온 경우
            words = [w for w in _WORD.findall(it["name"]) if len(w) >= 2 and w not in _STOP]
            if words and all(w in t for w in words):
                hit = it
                break
    if _TAKE.search(text or ""):
        return {"op": "take", "menu": hit}
    if hit and _NEG.search(text or ""):
        return {"op": "skip", "menu": hit}
    if hit:
        return {"op": "incl", "menu": hit}
    return {"op": "memo", "menu": None}


def _hangul_words(text: str) -> frozenset:
    return frozenset(w for w in _words(text) if re.fullmatch(r"[가-힣]{2,}", w))


def match_write_source(text: str, hints: List[dict]) -> Optional[dict]:
    """버튼 글자("마감 처리")와 낱말이 겹치는 쓰기 API 가 소스에 **하나뿐이면** 그것(눌렀을 때 나갈 요청의 근거). 여럿이면 지어내지 않는다."""
    words = _hangul_words(text)
    hit = [h for h in hints if h.get("mode") == "write" and words & _hangul_words(h.get("title") or "")]
    return hit[0] if len(hit) == 1 else None


def suggest_values(ques: List[str], limit: int = 3) -> List[str]:
    """입력값이 필요할 때 제안할 값. 질문 예시에 나온 거래처 같은 고유명(와 그 앞 토막)을 먼저 제안한다."""
    out: List[str] = []
    for q in ques:
        for w in re.findall(r"[가-힣A-Za-z0-9]+", q or ""):
            tail = next((t for t in _ORG_TAIL if w.endswith(t) and len(w) > len(t)), None)
            if tail:
                for cand in (w, w[:-len(tail)]):
                    if len(cand) >= 2 and cand not in out:
                        out.append(cand)
    return out[:limit]


# ── API 용도 ────────────────────────────────────────────────────────────────

def api_key(method: str, rel_path: str) -> str:
    """같은 API 를 탐색 중(요청 한 건)에도, 끝난 뒤(합쳐진 API)에도 가리키는 열쇠. 확장자와 쿼리를 뗀 경로."""
    path = re.sub(r"[?#].*$", "", rel_path or "")
    path = re.sub(r"\.(do|action|ajax|json|jsp|html?|nhn|cgi|php)$", "", path.rstrip("/") or "/", flags=re.I)
    path = re.sub(r"\{[^}]*\}", "{}", path)                  # /po/{id} 와 /po/{poNo} 는 같은 API 다
    return f"{(method or 'GET').upper()} {path}"


def _verb(a: dict) -> str:
    return "조회" if a.get("mode") == "read" else "처리"


def heuristic_use(a: dict, ques: List[str], menu_qa: Iterable[int] = ()) -> Tuple[str, List[int]]:
    """용도 문장과 이어지는 질문. 제목이 한글이면 "제목 + 조회/처리", 아니면 비워 둔다(영문 함수 이름은 용도가 아니다)."""
    title = (a.get("title") or "").strip()
    use = ""
    if re.search(r"[가-힣]", title):
        use = title if re.search(r"(조회|처리|등록|검색|확인|승인|저장|삭제|수정|다운로드)$", title) else f"{title} {_verb(a)}"
    # 화면 이름표("발주 현황 > 조회 버튼")는 앞의 화면 제목만 본다. 버튼 이름까지 넣으면 질문과 겹치는 비율이 묽어진다.
    heading = ((a.get("tr") or {}).get("screen") or "").split(">")[0]
    if a.get("mode") != "read":
        # 질문은 대개 조회다. 쓰기 API 는 이름이 겹친다고 질문에 잇지 않고, 질문이 가리키는 메뉴에서 찾았을 때만 잇는다(AI 나 사람이 더 정확히 정한다)
        return use, sorted(i for i in menu_qa if 0 <= i < len(ques))
    g = grams(f"{title} {heading}")
    qa = {i for i, q in enumerate(ques) if _frac(g, grams(q)) >= 0.5} | {i for i in menu_qa if 0 <= i < len(ques)}
    return use, sorted(qa)


def live_use(method: str, label: str, ques: List[str], menu_qa: Iterable[int] = ()) -> Tuple[str, List[int]]:
    """탐색 중에 요청 한 건의 용도를 가늠한다. 화면 이름표("발주 현황 > 조회 버튼 클릭")에서 만든 제목에 읽기/쓰기 동사를 붙인 추정이고,
    탐색이 끝나면 annotate 가 같은 방식으로(AI 가 있으면 AI 로) 다시 정한다."""
    a = {"title": infer.screen_title(label), "mode": "read" if (method or "GET").upper() in ("GET", "HEAD") else "write", "tr": {"screen": label}}
    return heuristic_use(a, ques, menu_qa)


_USE_SYSTEM = ("너는 레거시 시스템에서 찾은 API 를 AI 비서의 도구로 바꾸는 일을 돕는다. API 정보(메서드, 경로, 화면 제목, 파라미터 이름, 응답 필드 이름)와 "
               "AI 비서가 받을 질문 예시만 근거로 한다. 지어내지 않는다. JSON 배열만 출력한다.")


def _use_prompt(chunk: List[dict], purpose: str, ques: List[str]) -> str:
    lines = ["탐색 목적: %s" % (purpose or "(없음)"), "질문 예시:"] + ["Q%d. %s" % (i + 1, q) for i, q in enumerate(ques)] + ["", "API 목록:"]
    for a in chunk:
        res = [r.get("a") or r.get("o") for r in a.get("res", [])][:8]
        params = [p.get("a") or p.get("o") for p in a.get("params", []) if p.get("loc") != "header"][:6]
        lines.append(json_line(a["id"], a["m"], a["path"], a.get("title"), a.get("mode"), (a.get("tr") or {}).get("screen"), params, res))
    lines += ["", "각 API 마다: use=용도 한 줄(한국어, 20자 안팎, 예: 발주 목록 조회), qa=그 API 로 답할 수 있는 질문 번호 배열(Q1 은 0, 없으면 []),",
              "desc=AI 가 읽을 도구 설명 두 문장(무엇을 돌려주는지, 언제 쓰는지. 파일 경로·URL 은 쓰지 않는다). 쓰기 API 면 desc 에 데이터를 바꾼다고 밝힌다.",
              '형식: [{"id": "...", "use": "...", "qa": [0], "desc": "..."}]']
    return "\n".join(lines)


def json_line(*vals) -> str:
    keys = ("id", "method", "path", "screenTitle", "mode", "screen", "params", "responseFields")
    return "- " + json.dumps(dict(zip(keys, vals)), ensure_ascii=False)


def annotate(apis: List[dict], purpose: str, ques: List[str], plan: Optional[List[dict]] = None, *, use_ai: bool = True) -> str:
    """찾은 API 마다 용도(use), 이어지는 질문(qa), 누가 정했는지(useBy)를 붙인다. 돌려주는 값은 AI 를 썼는지("ai"|"rule").

    AI 가 쓴 도구 설명(desc)은 길이와 내용을 확인하고 쓴다 — 소스 경로나 주소가 들어 있으면 버리고 규칙으로 쓴 설명을 둔다.
    """
    by_menu = {p["id"]: p for p in (plan or [])}
    cands = [a for a in apis if a.get("ev") != "out"]
    for a in cands:
        # 한 메뉴에서만 불린 API 는 그 메뉴가 답하는 질문을 이어받는다. 여러 메뉴에서 불린 API(공통코드 같은 것)는 어느 질문의 답도 아니다.
        menus = (a.get("tr") or {}).get("menus") or []
        menu_qa = (by_menu.get(menus[0]) or {}).get("qa", []) if len(menus) == 1 else []
        a["use"], a["qa"] = heuristic_use(a, ques, menu_qa)
        a["useBy"] = "rule"
    used_ai = False
    if use_ai and (purpose or ques) and cands and llm.provider():
        for i in range(0, len(cands), MAX_AI_APIS):
            chunk = cands[i:i + MAX_AI_APIS]
            try:
                raw = llm.complete_json(_USE_SYSTEM, _use_prompt(chunk, purpose, ques))
            except llm.LlmError:
                continue
            if isinstance(raw, dict):
                raw = raw.get("apis") or raw.get("items")
            by_id = {r.get("id"): r for r in raw if isinstance(r, dict)} if isinstance(raw, list) else {}
            for a in chunk:
                r = by_id.get(a["id"])
                if not r:
                    continue
                use = re.sub(r"\s+", " ", str(r.get("use") or "")).strip()[:60]
                if use:
                    a["use"], a["useBy"] = use, "ai"
                    used_ai = True
                qa = [x for x in (r.get("qa") or []) if isinstance(x, int) and 0 <= x < len(ques)]
                if qa or use:
                    a["qa"] = sorted(set(qa))
                desc = llm.clean(str(r.get("desc") or ""), 300)
                if 20 <= len(desc) and not re.search(r"(https?://|\.(java|py|js|ts|jsp)\b|/[A-Za-z0-9_]+\.do)", desc) and a.get("tool"):
                    a["desc"] = desc
                    a["descBy"] = "ai"
    return "ai" if used_ai else "rule"

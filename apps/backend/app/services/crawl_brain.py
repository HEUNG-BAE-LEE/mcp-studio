"""탐색 판단 (L2) — 어디로 갈지, 무엇을 담을지.

받는 것은 화면 요약본(2K 토큰 안팎)이지 DOM 이 아니다. 그 경계가 이 기능의
비용을 40배 가른다 — page_extract.to_brief() 주석에 적어 두었다.

**LLM 이 죽어도 수집은 계속된다.** 응답이 깨지거나 키가 없으면 규칙 기반
폴백으로 넘어간다. 자동 수집이 LLM 가용성에 묶이면, 키 하나 만료로 제품
전체가 멈춘다.

안전은 여기서 판단하지 않는다. 파괴적 동작·로그아웃은 crawl_policy 가
이미 걸러낸 뒤에 온다 — 프롬프트는 우회되지만 정규식은 우회되지 않는다.
"""
import json
import os
import re

SYSTEM = (
    "너는 웹 화면을 보고 API 수집 경로를 정하는 조수다. "
    "사용자가 적은 수집 의도에 맞는 화면만 고르고, 의도와 무관한 것은 버린다. "
    "반드시 지정된 JSON 형식으로만 답한다."
)

_PROMPT = """수집 의도:
{intent}

지금 화면:
{page}

들어갈 수 있는 곳 (i = 번호):
{candidates}

이 화면에서 관측된 API:
{apis}

아래 JSON 형식으로만 답하라. 설명을 붙이지 마라.
{{
  "visit": [{{"i": 0, "why": "이유", "priority": 9}}],
  "skip":  [{{"i": 2, "why": "이유"}}],
  "keep":  [{{"url": "GET /api/orders", "why": "이유"}}],
  "drop":  [{{"url": "POST /log/view", "why": "이유"}}]
}}

규칙:
- visit 은 수집 의도와 관련 있는 곳만. priority 는 1~10.
- 목록에서 상세로 들어가는 링크는 우선순위를 높게 (같은 API 의 파라미터를 알 수 있다).
- keep 은 업무 데이터를 돌려주는 API 만. 로그·통계·세션 확인·배너는 drop.
- 판단 근거(why)는 한국어 한 문장으로 짧게."""


def _client():
    from openai import AzureOpenAI

    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ["AZURE_OPENAI_API_VERSION"],
    )


def available() -> bool:
    """LLM 을 쓸 수 있는가. 없으면 규칙만으로 돈다."""
    return all(os.getenv(k) for k in (
        "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_DEPLOYMENT",
    ))


def _parse(text: str) -> dict | None:
    """모델이 앞뒤에 말을 붙여도 JSON 만 건져낸다."""
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 규칙 폴백
#
# LLM 이 없을 때 쓰는 것이지만, 있을 때도 이게 먼저 돈다 — 확실한 것은
# 물어볼 이유가 없다.
# ─────────────────────────────────────────────────────────────────────────────

_NOISE = re.compile(
    r"(/log|/logs|/logging|accesslog|/analytics|/collect|/track|/stat|/stats|"
    r"/ping|/health|/heartbeat|/session|/banner|/popup|/notice/count)", re.I,
)


def rule_only(brief: dict, intent: str) -> dict:
    """어휘 겹침만으로 고른다. 의도의 단어가 링크 글자에 들어 있으면 간다."""
    words = [w for w in re.split(r"[\s,·]+", intent or "") if len(w) >= 2][:8]

    visit, skip = [], []
    for c in brief.get("candidates", []):
        if c.get("blocked"):
            skip.append({"i": c["i"], "why": c["blocked"]})
            continue
        hay = f"{c.get('text','')} {c.get('href','')}".lower()
        hit = next((w for w in words if w.lower() in hay), None)
        if hit or not words:
            visit.append({"i": c["i"], "why": f"“{hit}” 와 관련" if hit else "탐색",
                          "priority": 8 if hit else 4})
        else:
            skip.append({"i": c["i"], "why": "의도와 무관"})

    keep, drop = [], []
    for a in brief.get("observedApis", []):
        line = f"{a['method']} {a['url']}"
        if _NOISE.search(a["url"]):
            drop.append({"url": line, "why": "로그·상태 확인 API"})
        elif a["status"] >= 400:
            drop.append({"url": line, "why": f"응답 실패 {a['status']}"})
        else:
            keep.append({"url": line, "why": "업무 데이터로 보임"})

    return {"visit": visit, "skip": skip, "keep": keep, "drop": drop, "by": "rule"}


def decide(brief: dict, intent: str) -> dict:
    """이 화면에서 갈 곳과 담을 것을 정한다.

    LLM 이 없거나 실패하면 규칙 결과를 그대로 쓴다. 화면에는 어느 쪽이
    판단했는지(`by`)를 남긴다 — 결과가 이상할 때 원인을 가릴 수 있어야 한다.
    """
    fallback = rule_only(brief, intent)
    if not available():
        return fallback

    page = json.dumps(brief.get("page", {}), ensure_ascii=False)
    cands = "\n".join(
        f"  {c['i']}. {c.get('text') or '(글자 없음)'} → {c.get('href') or '(클릭)'}"
        for c in brief.get("candidates", []) if not c.get("blocked")
    ) or "  (없음)"
    apis = "\n".join(
        f"  {a['method']} {a['url']} → {a['status']}"
        for a in brief.get("observedApis", [])
    ) or "  (없음)"

    try:
        res = _client().chat.completions.create(
            model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": _PROMPT.format(
                    intent=intent or "(적지 않음 — 업무 데이터 API 를 모은다)",
                    page=page, candidates=cands, apis=apis)},
            ],
            response_format={"type": "json_object"},
            timeout=40,
        )
        parsed = _parse(res.choices[0].message.content or "")
        if not parsed:
            return {**fallback, "by": "rule", "note": "LLM 응답을 읽지 못해 규칙으로 처리"}

        # 형식을 믿지 않는다. 모델이 i 를 문자열로 주거나 빼먹는 경우가 있다.
        out = {"visit": [], "skip": [], "keep": [], "drop": [], "by": "llm"}
        for row in parsed.get("visit", []) or []:
            try:
                out["visit"].append({"i": int(row["i"]), "why": str(row.get("why", ""))[:80],
                                     "priority": int(row.get("priority", 5))})
            except Exception:
                continue
        for row in parsed.get("skip", []) or []:
            try:
                out["skip"].append({"i": int(row["i"]), "why": str(row.get("why", ""))[:80]})
            except Exception:
                continue
        for key in ("keep", "drop"):
            for row in parsed.get(key, []) or []:
                if isinstance(row, dict) and row.get("url"):
                    out[key].append({"url": str(row["url"])[:200],
                                     "why": str(row.get("why", ""))[:80]})

        # 규칙이 막은 것은 LLM 이 가자고 해도 가지 않는다.
        blocked = {c["i"] for c in brief.get("candidates", []) if c.get("blocked")}
        out["visit"] = [v for v in out["visit"] if v["i"] not in blocked]
        return out
    except Exception as exc:
        return {**fallback, "by": "rule", "note": f"LLM 호출 실패 — 규칙으로 처리 ({exc.__class__.__name__})"}

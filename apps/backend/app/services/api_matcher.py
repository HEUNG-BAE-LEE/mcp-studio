"""자연어로 적은 용도에 맞는 API 후보를 골라준다.

포털 검색은 낱말이 겹치는 것을 다 준다. '미세먼지'로 검색하면 대기질 API 옆에
'아이돌봄 대기가점기준'이 같이 나온다 — 사람이 보면 무관하다는 걸 아는데,
글자만 보는 검색은 구분하지 못한다.

그래서 수집을 시작하기 전에 후보를 한 번 보여주고, 무엇에 쓸 것인지 적으면
LLM 이 그 용도에 맞는 것만 추린다. 사용자는 체크박스로 마지막 판단을 한다 —
LLM 판단을 그대로 믿고 수집하면, 왜 빠졌는지 알 수 없는 API 가 생긴다.

LLM 을 쓸 수 없는 환경(Azure 미설정, 네트워크 차단)에서도 후보 목록 자체는
보여준다. 그 경우 전부 '판단 보류'로 두고 사용자가 고르게 한다.
"""

import json
import os
import re
from typing import Optional

from openai import AzureOpenAI

SYSTEM = """너는 공공데이터 API 목록에서 사용자의 목적에 맞는 것만 골라내는 도구다.

판단 기준:
- 사용자가 적은 용도로 **실제 답을 얻을 수 있는가**를 본다. 이름에 낱말이 겹치는 것만으로 고르지 않는다.
- 예: 용도가 "지역별 대기질 조회"일 때 '대기오염정보'는 적합하고, '아이돌봄 대기가점기준'은 낱말만 같으므로 부적합하다.
- 애매하면 include=true 로 두고 reason 에 애매한 이유를 적는다. 빠뜨리는 쪽이 더 나쁘다.

출력은 JSON 만. 설명문을 붙이지 마라.
{"items":[{"index":0,"include":true,"reason":"한 문장"}]}"""


def _client() -> Optional[AzureOpenAI]:
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    key = os.environ.get("AZURE_OPENAI_API_KEY")
    version = os.environ.get("AZURE_OPENAI_API_VERSION")
    if not (endpoint and key and version):
        return None
    return AzureOpenAI(azure_endpoint=endpoint, api_key=key, api_version=version)


def _parse(raw: str) -> list:
    """모델이 코드펜스를 붙여도 읽어낸다. 형식이 어긋나면 빈 목록으로 둔다."""
    text = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.M).strip()
    try:
        return json.loads(text).get("items", [])
    except (json.JSONDecodeError, AttributeError):
        return []


def match(candidates: list, purpose: str) -> dict:
    """후보 목록에 판단을 붙여 돌려준다.

    candidates: [{"title": "...", "provider": "...", "url": "..."}]
    반환: {"judged": bool, "reason": str|None, "items": [{..., "include": bool, "reason": str}]}
    """
    purpose = (purpose or "").strip()
    if not candidates:
        return {"judged": False, "reason": "후보가 없습니다", "items": []}

    if not purpose:
        # 용도를 안 적었으면 판단할 근거가 없다. 전부 켠 채로 사용자에게 넘긴다.
        return {
            "judged": False,
            "reason": "용도를 입력하면 목적에 맞는 API 만 추려 드립니다",
            "items": [{**c, "include": True, "reason": ""} for c in candidates],
        }

    client = _client()
    if client is None:
        return {
            "judged": False,
            "reason": "LLM 이 설정되지 않아 전체를 선택했습니다. 목록을 직접 확인해 주세요",
            "items": [{**c, "include": True, "reason": ""} for c in candidates],
        }

    listing = "\n".join(
        f"{i}. {c['title']} (제공: {c.get('provider') or '미상'})"
        for i, c in enumerate(candidates)
    )
    try:
        response = client.chat.completions.create(
            model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
            max_completion_tokens=2048,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"용도: {purpose}\n\nAPI 목록:\n{listing}"},
            ],
        )
        judgements = {
            item.get("index"): item
            for item in _parse(response.choices[0].message.content or "")
            if isinstance(item.get("index"), int)
        }
    except Exception as exc:  # noqa: BLE001 — 판단 실패가 수집 자체를 막아선 안 된다
        return {
            "judged": False,
            "reason": f"판단에 실패해 전체를 선택했습니다 ({exc.__class__.__name__})",
            "items": [{**c, "include": True, "reason": ""} for c in candidates],
        }

    if not judgements:
        return {
            "judged": False,
            "reason": "판단 결과를 읽지 못해 전체를 선택했습니다",
            "items": [{**c, "include": True, "reason": ""} for c in candidates],
        }

    items = []
    for i, candidate in enumerate(candidates):
        judged = judgements.get(i)
        items.append({
            **candidate,
            # 판단이 누락된 항목은 켜 둔다. 빠뜨리는 쪽이 더 나쁘다.
            "include": bool(judged.get("include", True)) if judged else True,
            "reason": (judged or {}).get("reason", "") or "",
        })
    return {"judged": True, "reason": None, "items": items}


# ── 용도 문장에서 검색어 뽑기 ────────────────────────────────
#
# 사용자는 이 입력란을 검색창으로 쓴다. "지역별 날씨를 알 수 있는 에이전트"라고
# 적었으면 날씨 API 가 나와야지, 바깥 URL 의 검색어(미세먼지) 결과를 좁히기만
# 해서는 아무것도 안 나온다. 그래서 적어 준 문장으로 포털을 다시 검색한다.

# 용도 문장에 늘 끼는 말들. 검색어로 쓰면 결과가 엉뚱해진다.
_STOPWORDS = {
    "알", "수", "있는", "없는", "위한", "관련", "대한", "만들", "만들거야", "만들래",
    "에이전트", "챗봇", "서비스", "시스템", "애플리케이션", "앱", "화면",
    "정보", "데이터", "자료", "목록", "조회", "검색", "분석", "확인", "제공",
    "지역별", "전국", "실시간", "최신", "상세", "기본", "일별", "월별", "연도별",
    "필요해", "싶어", "싶다", "해줘", "보여줘", "주세요", "합니다", "등", "및", "좀",
}
_JOSA = re.compile(r"(을|를|이|가|은|는|의|에|에서|로|으로|와|과|도|만|까지|부터|보다)$")


def _keyword_by_rule(purpose: str) -> str:
    """조사와 흔한 군더더기를 떼고 남은 첫 낱말을 검색어로 쓴다.

    형태소 분석기 없이 하는 거친 방법이다. LLM 이 있으면 그쪽이 훨씬 낫고,
    이건 LLM 을 못 쓰는 환경에서 최소한 검색이 되게 하려는 것이다.
    """
    for word in re.split(r"[\s,·/]+", purpose.strip()):
        word = _JOSA.sub("", re.sub(r"[^\w가-힣]", "", word))
        if len(word) >= 2 and word not in _STOPWORDS:
            return word
    return ""


_KEYWORD_SYSTEM = """공공데이터포털에서 검색할 낱말 하나를 고른다.

- 사용자가 적은 용도에서 **찾으려는 대상**을 뽑는다. 용도·목적어(챗봇, 분석, 에이전트)가 아니다.
- 예: "지역별 날씨를 알 수 있는 에이전트" → 날씨
- 예: "버스 도착 시간 알림" → 버스도착정보
- 포털 검색창에 넣을 말이므로 짧아야 한다. 2~8글자.

낱말만 출력한다. 따옴표·설명을 붙이지 마라."""


def extract_keyword(purpose: str) -> str:
    """용도 문장에서 포털 검색어를 뽑는다. 실패하면 규칙으로 떨어진다."""
    purpose = (purpose or "").strip()
    if not purpose:
        return ""

    client = _client()
    if client is not None:
        try:
            reply = client.chat.completions.create(
                model=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini"),
                messages=[{"role": "system", "content": _KEYWORD_SYSTEM},
                          {"role": "user", "content": purpose}],
                temperature=0,
                max_tokens=20,
            )
            word = re.sub(r"[^\w가-힣 ]", "", (reply.choices[0].message.content or "")).strip()
            if 2 <= len(word) <= 20:
                return word
        except Exception:  # noqa: BLE001 — 규칙으로 떨어진다
            pass
    return _keyword_by_rule(purpose)

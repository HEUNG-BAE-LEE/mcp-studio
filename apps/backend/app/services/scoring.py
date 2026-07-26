import re
from datetime import datetime
from typing import List, Tuple
from app.models import NetworkRequest

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

# 로그·수집성 API 판별. 넓게 잡으면 진짜 업무 API를 조용히 파묻는다.
#
# 걸러야 할 오탐 사례가 실제로 있다.
#   /statisticsList/selectTreeData.do  ← KOSIS의 주요 조회 API. 'stat' 부분일치 금지
#   /oneid/cmmn/login/ActiveSessionFind.do ← 'login'에 'log'가 들어간다
#   /api/catalog, /dialog/open, /blogPosts ← 모두 'log'를 포함한다
#
# 그래서 부분일치 대신 경로 경계를 요구한다.
LOG_URL = re.compile(
    r"("
    r"acces{1,2}log"          # accesLog.do (국내 사이트에 흔한 s 하나 오타), accessLog.do
    r"|/logs?(?:[/?.]|$)"     # /log /logs /log/ /logs.do — 단 /login, /catalog 은 제외
    r"|/logging"
    r"|analytics"
    r"|/collect(?:[/?.]|$)"
    r"|tracker|tracking"
    r"|/stats?(?:[/?.]|$)"    # /stat /stats — statistics 는 제외
    r")",
    re.I,
)

def score_request(req: NetworkRequest, click_at: datetime, sibling_urls: List[str]) -> Tuple[int, List[str]]:
    """PRD §7.6 점수 정책. 점수와 추천 사유를 함께 반환한다."""
    score = 0
    reasons: List[str] = []

    if req.request_method.upper() in MUTATING:
        score += 3
        reasons.append(f"변경성 메서드 {req.request_method} +3")

    score += 2
    reasons.append("Fetch/XHR 요청 +2")

    delta = (req.occurred_at - click_at).total_seconds()
    if 0 <= delta <= 1:
        score += 2
        reasons.append("클릭 후 1초 이내 +2")

    if 200 <= req.response_status < 300:
        score += 1
        reasons.append("응답 성공 +1")
    else:
        score -= 2
        reasons.append("응답 실패 -2")

    if req.is_json and req.response_preview.get("sample"):
        score += 1
        reasons.append("응답 데이터 있음 +1")

    if LOG_URL.search(req.request_url):
        score -= 5
        reasons.append("로그 API -5")

    if sibling_urls.count(req.request_url) >= 2:
        score -= 3
        reasons.append("동일 URL 반복 호출(폴링) -3")

    return score, reasons

import re
from datetime import datetime
from typing import List, Tuple
from app.models import NetworkRequest

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
LOG_URL = re.compile(r"(acceslog|accesslog|/log/|/logging|analytics|collect|tracker|stat)", re.I)

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

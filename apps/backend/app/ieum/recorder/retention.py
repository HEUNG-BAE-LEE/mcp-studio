"""스크린샷 보관 정리. 그림 속 개인정보는 가리기 어려워, 사람이 검토하는 동안만 둔다.

등록한(예전 기록은 확정한) 업무 기능의 기록은 바로, 확정하지 않은 기록은 끝난 지 shot_days 일이 지나면 스크린샷을 지운다.
행동 묶음(마스킹한 ARIA 텍스트 포함)은 남긴다. 확정 뒤 검토 화면의 근거는 그 텍스트로 보여 준다.
"""
import time
from typing import Optional

from app.ieum.recorder import config, store


def sweep(now: Optional[float] = None) -> int:
    now = now or time.time()
    limit = config.shot_days() * 86400
    fns = store.FUNCTIONS.load()
    n = 0
    for rec in store.list_recordings():
        if rec["status"] in store.ACTIVE:
            continue
        fn = fns.get(rec.get("functionId") or "")
        confirmed = bool(fn and fn.get("status") in ("confirmed", "registered"))
        old = (now - (rec.get("endedAt") or rec["startedAt"])) > limit
        if confirmed or old:
            n += store.delete_shots(rec["id"])
    return n

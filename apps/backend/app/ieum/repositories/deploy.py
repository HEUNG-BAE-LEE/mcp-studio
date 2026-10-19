import hashlib
import hmac
import time

from app.ieum.store import LOCK, JsonStore

toolsets = JsonStore("deploy", "toolsets")
keys = JsonStore("deploy", "keys")


def hash_key(secret):
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def find_key(secret):
    """평문 키로 사용 중인 키를 찾는다. 해시만 저장하므로 상수 시간으로 비교한다."""
    h = hash_key(secret)
    return next((k for k in keys.load() if k.get("on") and hmac.compare_digest(k.get("hash", ""), h)), None)


def touch_key(key_id):
    """마지막 사용 시각을 남긴다. 키 목록 전체를 다시 쓰므로 폐기와 겹치지 않게 락 안에서 읽고 쓴다."""
    now = time.strftime("%m-%d %H:%M")
    with LOCK:
        rows = keys.load()
        changed = False
        for k in rows:
            if k["id"] == key_id and k.get("last") != now:
                k["last"] = now
                changed = True
        if changed:
            keys.save(rows)


def create_key(name, toolsets=None, run_as=""):
    """액세스 키를 발급한다. 키 저장소에는 해시만 남기고 평문은 돌려주는 값에만 있다(다시 볼 수 없다).
    run_as 는 온톨로지 도구가 이 키로 부를 때 실행 사용자로 삼는 직원 사번이다(행·속성 권한이 이 사람 기준으로 적용된다)."""
    import secrets
    secret = "ieum_sk_" + secrets.token_hex(24)
    row = {"id": "k" + str(int(time.time() * 1000)), "name": name, "key": "ieum_sk_••••••••" + secret[-4:], "hash": hash_key(secret),
           "created": time.strftime("%Y-%m-%d"), "last": "사용 전", "on": True, "toolsets": list(toolsets or []), "runAs": run_as or ""}
    with LOCK:      # 배포한 서버가 키 사용 시각을 같은 파일에 쓴다. 겹치지 않게 한 덩어리로 읽고 쓴다
        rows = keys.load()
        rows.insert(0, row)
        keys.save(rows)
    return row, secret


def get_toolset(toolset_id=None, slug=None):
    return next((t for t in toolsets.load() if t["id"] == toolset_id or (slug and t["slug"] == slug)), None)

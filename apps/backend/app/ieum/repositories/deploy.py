import hashlib
import hmac
import time

from app.ieum.store import JsonStore

toolsets = JsonStore("deploy", "toolsets")
keys = JsonStore("deploy", "keys")


def hash_key(secret):
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def find_key(secret):
    """평문 키로 사용 중인 키를 찾는다. 해시만 저장하므로 상수 시간으로 비교한다."""
    h = hash_key(secret)
    return next((k for k in keys.load() if k.get("on") and hmac.compare_digest(k.get("hash", ""), h)), None)


def touch_key(key_id):
    rows = keys.load()
    for k in rows:
        if k["id"] == key_id:
            k["last"] = time.strftime("%m-%d %H:%M")
    keys.save(rows)


def get_toolset(toolset_id=None, slug=None):
    return next((t for t in toolsets.load() if t["id"] == toolset_id or (slug and t["slug"] == slug)), None)

"""온톨로지 저장소: 연결, 객체 유형, 링크, 마트, 설정, 공개 버전의 JSON 파일.

`<상태 폴더>/onto.<이름>.json`. 시드는 `data/onto/`(모두 비어 있다)다. 읽고-고쳐-쓰는 구간은 `with LOCK:` 으로 감싼다 —
배포한 MCP 서버(다른 프로세스)와 마트 갱신 스레드가 같은 파일을 읽기 때문이다.

객체 유형의 모양(화면과 같은 모양으로 둔다):
  id           "<연결 id>.<API 이름>"  예) po.PurchaseOrder. 연결을 넘나드는 링크가 이 id 로 가리킨다
  conn         속한 연결(온톨로지) id
  name, api    표시 이름, 영문 API 이름
  table        "PO.TB_PO_MST" (스키마 별칭.테이블). 마트가 원본이면 "MART.<마트 id>"
  kind         table | view | mart
  mart         원본 마트 id 또는 None
  rows         객체 필터를 적용한 행 수
  status       review(검토 필요) | draft(초안) | pub(공개)
  aiOff        공개 객체인데 AI 에게는 보이지 않게 끈 것
  pos          그래프 위치 [x, y]
  filter       {col, op, value, text} 객체 필터(삭제된 행 제외 같은 것) 또는 None
  props        속성 목록. 각 속성: col, ctype, name, api, type, flags[], note, ex[], mask, codes, fmt
  perm         행·속성 권한 규칙(perm.py) 또는 None
  actions      액션 목록(actions.py)
링크: id, from, to, api, rapi, name, rev, card, keys[[from 컬럼, to 컬럼]], keyText, basis, kind(fk|infer|view|cross|mart), cross, status, rate
마트: id, home, name, desc, sql, refresh, inc, status, rows, cols, pv, od, obj, builds ... (marts.py)
"""
import copy
import time
from typing import Dict, List, Optional

from app.ieum.store import LOCK, JsonStore

conns = JsonStore("onto", "connections")
objects = JsonStore("onto", "objects")
links = JsonStore("onto", "links")
marts = JsonStore("onto", "marts")
versions = JsonStore("onto", "versions")
settings_store = JsonStore("onto", "settings")

DEFAULT_SETTINGS = {
    "asOf": "",                       # AI 질의가 "이번 달"의 기준으로 삼는 날짜(YYYY-MM-DD). 비어 있으면 오늘
    "identity": {},                   # 실행 사용자를 직원 객체로 잇는 설정(perm.py)
    "ranks": ["사원", "선임", "책임", "팀장", "본부장"],
    "askUsers": [],                   # AI 질의 테스트에서 고를 사용자 사번
    "demo": False,                    # 시연 환경을 불러왔는가
}


# ── 객체 ───────────────────────────────────────────────────────────────────

def all_objects() -> Dict[str, dict]:
    return objects.load()


def get_object(oid: str) -> Optional[dict]:
    return all_objects().get(oid)


def conn_objects(conn_id: str) -> List[dict]:
    return [o for o in all_objects().values() if o["conn"] == conn_id]


def put_object(obj: dict) -> dict:
    with LOCK:
        data = all_objects()
        data[obj["id"]] = obj
        objects.save(data)
    return obj


def put_objects(objs: List[dict]) -> None:
    with LOCK:
        data = all_objects()
        for o in objs:
            data[o["id"]] = o
        objects.save(data)


def update_object(oid: str, fn) -> dict:
    """객체 하나를 읽고-고쳐-쓴다. fn(obj) 는 obj 를 제자리에서 바꾼다."""
    with LOCK:
        data = all_objects()
        obj = data.get(oid)
        if obj is None:
            raise KeyError(oid)
        fn(obj)
        objects.save(data)
        return copy.deepcopy(obj)


def delete_object(oid: str) -> None:
    with LOCK:
        data = all_objects()
        data.pop(oid, None)
        objects.save(data)
        links.save([l for l in all_links() if l["from"] != oid and l["to"] != oid])


# ── 링크 ───────────────────────────────────────────────────────────────────

def all_links() -> List[dict]:
    return links.load()


def object_links(oid: str) -> List[dict]:
    return [l for l in all_links() if l["from"] == oid or l["to"] == oid]


def put_links(new: List[dict]) -> None:
    with LOCK:
        rows = all_links()
        by_id = {l["id"]: i for i, l in enumerate(rows)}
        for l in new:
            if l["id"] in by_id:
                rows[by_id[l["id"]]] = l
            else:
                rows.append(l)
        links.save(rows)


def next_link_id(prefix: str = "l") -> str:
    ids = {l["id"] for l in all_links()}
    n = len(ids) + 1
    while "%s%d" % (prefix, n) in ids:
        n += 1
    return "%s%d" % (prefix, n)


# ── 마트 ───────────────────────────────────────────────────────────────────

def all_marts() -> Dict[str, dict]:
    return marts.load()


def get_mart(mid: str) -> Optional[dict]:
    return all_marts().get(mid)


def update_mart(mid: str, fn) -> dict:
    with LOCK:
        data = all_marts()
        m = data.get(mid)
        if m is None:
            raise KeyError(mid)
        fn(m)
        marts.save(data)
        return copy.deepcopy(m)


def put_mart(m: dict) -> dict:
    with LOCK:
        data = all_marts()
        data[m["id"]] = m
        marts.save(data)
    return m


def delete_mart(mid: str) -> None:
    with LOCK:
        data = all_marts()
        data.pop(mid, None)
        marts.save(data)


# ── 설정, 버전 ─────────────────────────────────────────────────────────────

def settings() -> dict:
    s = copy.deepcopy(DEFAULT_SETTINGS)
    s.update(settings_store.load() or {})
    return s


def save_settings(patch: dict) -> dict:
    with LOCK:
        cur = settings_store.load() or {}
        cur.update(patch)
        settings_store.save(cur)
    return settings()


def as_of() -> str:
    """질의의 기준 날짜. 설정에 없으면 오늘."""
    return settings().get("asOf") or time.strftime("%Y-%m-%d")


def purge_conn(conn_id: str) -> None:
    """연결을 지울 때 그 온톨로지(객체, 링크, 마트, 버전)를 함께 지운다."""
    with LOCK:
        objs = all_objects()
        gone = {k for k, o in objs.items() if o["conn"] == conn_id}
        objects.save({k: o for k, o in objs.items() if k not in gone})
        links.save([l for l in all_links() if l["from"] not in gone and l["to"] not in gone])
        marts.save({k: m for k, m in all_marts().items() if m.get("home") != conn_id})
        v = versions.load()
        v.pop(conn_id, None)
        versions.save(v)

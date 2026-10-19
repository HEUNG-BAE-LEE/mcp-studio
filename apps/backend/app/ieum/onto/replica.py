"""주기 동기화: 대용량 ERP 처럼 질문마다 원본 DB 를 때리기 부담스러운 연결은 객체가 쓰는 테이블을 이음 저장소(SQLite 파일)로 복사해 두고 질문을 거기에 보낸다.

복사는 객체 원본 테이블(행·속성 권한 규칙이 조인하는 테이블 포함)을 통째로 한다. 시간마다 다시 복사하며(바뀐 행만 알아내려면 원본에 변경 시각 컬럼이 있어야 하는데 일반적으로 없다),
새 파일을 만들어 한 번에 바꿔 끼워서 읽는 쪽이 반쯤 복사된 파일을 보지 않는다. 스키마 읽기, 스캔, 마트 빌드는 복제본이 아니라 원본을 읽는다.
"""
import sqlite3
import time
from typing import List, Optional

from app.ieum.onto import conn as dbconn
from app.ieum.onto import marts, reader, store

SYNC_EVERY = 3600.0
COPY_LIMIT = marts.COPY_LIMIT


def tables_for(conn_id: str) -> List[str]:
    """복제할 테이블: 객체 원본 테이블과, 행 권한 규칙이 조인하는 테이블"""
    names: List[str] = []
    for o in store.conn_objects(conn_id):
        if o["kind"] == "mart":
            continue
        names.append(o["tname"])
        for r in ((o.get("perm") or {}).get("rows") or []):
            via = (r.get("scope") or {}).get("via") if isinstance(r.get("scope"), dict) else None
            if via and via.get("table"):
                names.append(via["table"])
    return list(dict.fromkeys(names))


def sync(conn_id: str) -> dict:
    """연결의 복제본을 새로 만든다. 돌려주는 값: {tables, rows, ms}"""
    c = dbconn.need(conn_id)
    t0 = time.monotonic()
    path = dbconn.replica_file(conn_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + ".part")
    if part.exists():
        part.unlink()
    sch = reader.read(c, counts=False)
    by = {t["name"].upper(): t for t in sch["tables"]}
    db = sqlite3.connect(part)
    total = 0
    done = []
    try:
        for name in tables_for(conn_id):
            t = by.get(name.upper())
            if t is None:
                continue
            cols = [x["name"] for x in t["cols"]]
            db.execute("CREATE TABLE %s (%s)" % (marts._q(t["name"]), ", ".join("%s %s" % (marts._q(x["name"]), marts._affinity(x["type"])) for x in t["cols"])))
            sql = "SELECT %s FROM %s" % (", ".join(reader.q(c, x) for x in cols), reader.qualified(c, t["name"]))
            n = 0
            with dbconn.timeout(marts.BUILD_TIMEOUT):
                for _cols, rows in dbconn.stream(c, sql, chunk=marts.CHUNK):
                    n += len(rows)
                    if n > COPY_LIMIT:
                        raise marts.MartError("%s 가 %s행을 넘어 복제할 수 없습니다." % (t["name"], "{:,}".format(COPY_LIMIT)))
                    db.executemany("INSERT INTO %s VALUES (%s)" % (marts._q(t["name"]), ",".join("?" * len(cols))), [tuple(marts._to_sqlite(v) for v in r) for r in rows])
            total += n
            done.append(t["name"])
        db.commit()
    except BaseException:
        db.close()
        part.unlink(missing_ok=True)
        raise
    db.close()
    part.replace(path)
    dbconn.update(conn_id, {"synced": time.time(), "syncTables": len(done), "syncRows": total})
    return {"tables": len(done), "rows": total, "ms": int((time.monotonic() - t0) * 1000)}


def tick(now: Optional[float] = None) -> List[str]:
    """주기 동기화 연결 중 마지막 동기화가 한 시간 넘은 연결을 다시 복제한다. 복제한 연결 id"""
    now = now or time.time()
    out = []
    for c in store.conns.load():
        if c.get("mode") != "sync" or c["dbms"] == "mart":
            continue
        if not store.conn_objects(c["id"]):
            continue
        if not c.get("synced") or now - c["synced"] >= SYNC_EVERY:
            try:
                sync(c["id"])
                out.append(c["id"])
            except (dbconn.ConnError, marts.MartError):
                pass
    return out

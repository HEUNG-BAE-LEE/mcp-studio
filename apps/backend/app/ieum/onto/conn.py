"""DB 연결: 등록, 읽기 전용 엔진, 쿼리 보호.

모든 접속은 읽기 전용이다. SQLite 는 파일을 읽기 전용(mode=ro)으로 열고 query_only 를 켜며, 다른 DB 는 읽기 전용 계정을 쓰라고 안내한다.
이음은 연결할 때 스키마를 읽지 않는다 — 접속만 한다. 스키마는 객체 구축(스캔, 마트, 객체 생성)이 읽는다.

쿼리 보호: 한 번에 가져오는 행 수(MAX_ROWS), 쿼리 시간(QUERY_TIMEOUT 초), 연결당 동시 쿼리 수(MAX_CONCURRENT). 넘기면 오류를 낸다.
계정 비밀번호는 암호화 금고(gateway/credentials)에 둔다. 연결 기록(JSON)에는 없다.
"""
import importlib.util
import os
import re
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.pool import NullPool

from app.ieum.config import state_dir
from app.ieum.gateway import credentials
from app.ieum.onto import demo, store

MAX_ROWS = 1000             # 한 번에 가져오는 행 수 상한
QUERY_TIMEOUT = 5.0         # 초
MAX_CONCURRENT = 4          # 연결당 동시 쿼리
PALETTE = ("mcp", "ont", "rag", "pri")       # 연결마다 화면에서 쓰는 색(CSS 변수 이름)
MART_ALIAS = "MART"                          # 마트를 SQL 에서 부르는 스키마 이름(MART.<마트 id>)
MART_CONN = {"id": "mart", "dbms": "sqlite", "name": "이음 마트", "host": "", "port": None, "db": "mart:store", "user": "", "schema": MART_ALIAS, "alias": MART_ALIAS, "mode": "live",
             "connector": "builtin", "clr": "pri", "status": "ok"}      # 이음 저장소의 마트 파일을 읽는 내부 연결. 연결 목록에는 없다

# 이음이 아는 DB 종류. driver 는 파이썬 패키지 이름이고, 없으면 그 DB 는 이 서버에서 쓸 수 없다고 화면이 알린다.
DBMS: Dict[str, dict] = {
    "oracle": {"label": "Oracle", "ver": "11g 이상", "driver": "oracledb", "dialect": "oracle+oracledb", "port": 1521},
    "tibero": {"label": "Tibero", "ver": "6, 7", "driver": None, "port": 8629, "why": "Tibero 는 파이썬 드라이버가 없어(JDBC 전용) 이 서버에서 직접 접속할 수 없습니다. 별도 이음 커넥터가 필요합니다."},
    "mssql": {"label": "MS SQL Server", "ver": "2016 이상", "driver": "pymssql", "dialect": "mssql+pymssql", "port": 1433},
    "mysql": {"label": "MySQL, MariaDB", "ver": "5.7, 10.4 이상", "driver": "pymysql", "dialect": "mysql+pymysql", "port": 3306},
    "pg": {"label": "PostgreSQL", "ver": "11 이상", "driver": "pg8000", "dialect": "postgresql+pg8000", "port": 5432},
    "altibase": {"label": "Altibase", "ver": "7 이상", "driver": None, "port": 20300, "why": "Altibase 는 파이썬 드라이버가 없어 이 서버에서 직접 접속할 수 없습니다. 별도 이음 커넥터가 필요합니다."},
    "sqlite": {"label": "SQLite (시연용, 파일)", "ver": "3 이상", "driver": "sqlite3", "dialect": "sqlite+pysqlite", "port": None},
}


class ConnError(ValueError):
    """사용자에게 그대로 보일 오류."""


class QueryError(ConnError):
    """쿼리가 실패했거나 보호 한도를 넘었다."""


def driver_status() -> List[dict]:
    """종류별로 이 서버에서 쓸 수 있는지. 화면이 DB 종류 카드에 표시한다."""
    out = []
    for key, d in DBMS.items():
        ok = bool(d["driver"]) and importlib.util.find_spec(d["driver"]) is not None
        hint = "" if ok else d.get("why") or ("이 서버에 %s 드라이버가 없습니다. `pip install %s` 로 설치하면 쓸 수 있습니다." % (d["driver"], _PIP.get(d["driver"], d["driver"])))
        out.append({"id": key, "label": d["label"], "ver": d["ver"], "available": ok, "hint": hint, "port": d.get("port")})
    return out


_PIP = {"oracledb": "oracledb", "pymssql": "pymssql", "pymysql": "PyMySQL", "pg8000": "pg8000"}


# ── 연결 기록 ──────────────────────────────────────────────────────────────

def list_conns() -> List[dict]:
    return store.conns.load()


def get(conn_id: str) -> Optional[dict]:
    return next((c for c in list_conns() if c["id"] == conn_id), None)


def need(conn_id: str) -> dict:
    c = get(conn_id)
    if c is None:
        raise ConnError("연결을 찾을 수 없습니다.")
    return c


def _slug(name: str, taken: set) -> str:
    base = (re.sub(r"[^0-9a-z]+", "-", name.lower()).strip("-") or "db")[:30].strip("-") or "db"
    cid, n = base, 2
    while cid in taken:
        cid, n = "%s-%d" % (base, n), n + 1
    return cid


def _roots() -> List[Path]:
    raw = os.environ.get("IEUM_ONTO_SQLITE_ROOTS", "")
    return [Path(x).expanduser().resolve() for x in raw.split(",") if x.strip()] + [(state_dir() / "onto" / "files").resolve()]


def mart_file() -> Path:
    """마트 저장소 파일. 없으면 빈 파일을 만든다(읽기 전용으로 열려면 파일이 있어야 한다)."""
    p = state_dir() / "onto" / "marts.db"
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        sqlite3.connect(p).close()
    return p


def replica_file(conn_id: str) -> Path:
    """주기 동기화 연결의 복제본 파일"""
    return state_dir() / "onto" / "replica" / ("%s.db" % conn_id)


def sqlite_file(db: str) -> Path:
    """연결의 db 값에서 SQLite 파일. demo:<이름> 이거나 허용한 폴더 아래의 파일이다."""
    if db == "mart:store":
        return mart_file()
    if db.startswith("demo:"):
        name = db[5:]
        if name not in demo.NAMES:
            raise ConnError("알 수 없는 시연 DB 입니다: %s" % name)
        return demo.ensure(name)
    p = Path(db).expanduser()
    if not p.is_absolute():
        raise ConnError("SQLite 파일은 절대 경로로 적어 주세요.")
    p = p.resolve()
    if not any(p == r or r in p.parents for r in _roots()):
        raise ConnError("허용된 폴더가 아닙니다. 서버 환경변수 IEUM_ONTO_SQLITE_ROOTS 에 상위 폴더를 적어야 읽을 수 있습니다.")
    if not p.is_file():
        raise ConnError("SQLite 파일을 찾을 수 없습니다.")
    return p


def secret(conn_id: str) -> dict:
    return credentials.get("onto:" + conn_id)


# ── 엔진 ───────────────────────────────────────────────────────────────────

_ENGINES: Dict[str, Engine] = {}
_ENGINE_LOCK = threading.RLock()
_SEMS: Dict[str, threading.BoundedSemaphore] = {}


def _sig(c: dict, rep: bool) -> str:
    """연결 설정이 바뀌면 엔진을 다시 만든다. 상태 폴더가 바뀌어도(시험) 마찬가지다. 복제본은 다시 만들 때마다 파일 시각이 바뀐다."""
    rmt = str(replica_file(c["id"]).stat().st_mtime) if rep else ""
    return "|".join(str(c.get(k)) for k in ("id", "dbms", "host", "port", "db", "user")) + "|" + str(state_dir()) + "|" + ("R" + rmt if rep else "") + "|" + str(sorted(secret(c["id"]).items()) if c.get("user") else "")


def _sqlite_engine(path: Path, extra_attach: Optional[Dict[str, Path]] = None, alias: str = "") -> Engine:
    uri = "file:%s?mode=ro" % path
    eng = create_engine("sqlite+pysqlite://", poolclass=NullPool, creator=lambda: sqlite3.connect(uri, uri=True, check_same_thread=False, timeout=5))
    _guard_sqlite(eng, path, alias, extra_attach or {})
    return eng


_DEADLINES: Dict[int, float] = {}       # DB-API 연결(id) -> 쿼리를 멈출 시각. sqlite3.Connection 에는 속성을 달 수 없어 밖에 둔다
_TLS = threading.local()                # 이 스레드의 쿼리 시간 한도(초). 마트 빌드는 AI 질의보다 오래 걸려도 된다


class timeout:                          # noqa: N801 — 컨텍스트 매니저
    """`with conn.timeout(300): conn.run(...)` 이 안의 쿼리 시간 한도를 바꾼다(SQLite 시연 DB 에서 강제한다. 다른 DB 는 계정의 문장 제한을 따른다)."""

    def __init__(self, seconds: float) -> None:
        self.seconds = seconds

    def __enter__(self) -> "timeout":
        self.prev = getattr(_TLS, "seconds", None)
        _TLS.seconds = self.seconds
        return self

    def __exit__(self, *exc) -> None:
        _TLS.seconds = self.prev


def _limit_seconds() -> float:
    return getattr(_TLS, "seconds", None) or QUERY_TIMEOUT


def _guard_sqlite(eng: Engine, path: Path, alias: str, attach: Dict[str, Path]) -> None:
    """SQLite 엔진에 쿼리 시간 한도와 읽기 전용 설정을 건다. alias 가 있으면 같은 파일을 그 이름으로도 붙여 `PO.TB_PO_MST` 처럼 부를 수 있게 한다."""
    from sqlalchemy import event

    @event.listens_for(eng, "connect")
    def on_connect(dbapi, _rec):                                # noqa: ANN001
        key = id(dbapi)

        def progress():
            d = _DEADLINES.get(key)
            return 1 if d is not None and time.monotonic() > d else 0
        dbapi.set_progress_handler(progress, 20000)
        dbapi.execute("PRAGMA query_only = ON")
        if alias:
            _attach(dbapi, alias, path)
        for a, p in attach.items():
            _attach(dbapi, a, p)

    @event.listens_for(eng, "before_cursor_execute")
    def before(conn, cursor, statement, parameters, context, executemany):      # noqa: ANN001
        _DEADLINES[id(conn.connection.dbapi_connection)] = time.monotonic() + _limit_seconds()

    @event.listens_for(eng, "close")
    def on_close(dbapi, _rec):                                  # noqa: ANN001
        _DEADLINES.pop(id(dbapi), None)


def _attach(dbapi, alias: str, path: Path) -> None:
    dbapi.execute("ATTACH DATABASE ? AS \"%s\"" % alias.replace('"', ""), ("file:%s?mode=ro" % path,))


def _url(c: dict, password: str) -> URL:
    d = DBMS.get(c["dbms"])
    if not d or not d.get("dialect") or c["dbms"] == "sqlite":
        raise ConnError("이 DB 종류는 이 서버에서 접속할 수 없습니다: %s" % (d or {}).get("label", c["dbms"]))
    return URL.create(d["dialect"], username=c.get("user") or None, password=password or None, host=c.get("host") or None, port=c.get("port") or d.get("port"),
                      database=c.get("db") or None)


def use_replica(c: dict) -> bool:
    """주기 동기화 연결이고 복제본이 있으면 질문은 복제본으로 간다."""
    return c.get("mode") == "sync" and c["dbms"] != "mart" and replica_file(c["id"]).exists()


def engine(c: dict, *, replica: bool = False) -> Engine:
    """연결의 읽기 전용 엔진(연결마다 하나를 재사용한다). replica 면 주기 동기화 연결은 복제본을 읽는다(객체 질의용). 스키마 읽기, 스캔, 마트 빌드는 늘 원본을 읽는다."""
    rep = replica and use_replica(c)
    key = _sig(c, rep)
    with _ENGINE_LOCK:
        eng = _ENGINES.get(c["id"] + ("#r" if rep else "") + "@" + key)
        if eng is not None:
            return eng
        for k in [k for k in _ENGINES if k.startswith(c["id"] + ("#r" if rep else "") + "@")]:
            _ENGINES.pop(k).dispose()
        if rep:
            eng = _sqlite_engine(replica_file(c["id"]), alias=c.get("alias") or "")        # 주기 동기화: 복제본에 질문한다
        elif c["dbms"] == "sqlite":
            eng = _sqlite_engine(sqlite_file(c["db"]), alias=c.get("alias") or "")
        else:
            d = DBMS[c["dbms"]]
            if not d.get("driver") or importlib.util.find_spec(d["driver"]) is None:
                raise ConnError(driver_status_one(c["dbms"])["hint"] or "이 서버에서 접속할 수 없는 DB 종류입니다.")
            eng = create_engine(_url(c, secret(c["id"]).get("password", "")), pool_size=MAX_CONCURRENT, max_overflow=0, pool_pre_ping=True, pool_recycle=300)
        _ENGINES[c["id"] + ("#r" if rep else "") + "@" + key] = eng
        return eng


def driver_status_one(dbms: str) -> dict:
    return next(x for x in driver_status() if x["id"] == dbms)


def forget(conn_id: str) -> None:
    with _ENGINE_LOCK:
        for k in [k for k in _ENGINES if k.startswith(conn_id + "@") or k.startswith(conn_id + "#r@")]:
            _ENGINES.pop(k).dispose()


def dispose_all() -> None:
    with _ENGINE_LOCK:
        for eng in _ENGINES.values():
            eng.dispose()
        _ENGINES.clear()


def _sem(conn_id: str) -> threading.BoundedSemaphore:
    with _ENGINE_LOCK:
        return _SEMS.setdefault(conn_id, threading.BoundedSemaphore(MAX_CONCURRENT))


class Result:
    """쿼리 결과. rows 는 튜플 리스트, truncated 면 한도(limit)에서 잘렸다."""

    def __init__(self, columns: List[str], rows: List[tuple], truncated: bool, ms: int) -> None:
        self.columns, self.rows, self.truncated, self.ms = columns, rows, truncated, ms

    def dicts(self) -> List[dict]:
        return [dict(zip(self.columns, r)) for r in self.rows]


def run(c: dict, stmt: Any, params: Optional[dict] = None, *, limit: int = MAX_ROWS, eng: Optional[Engine] = None, replica: bool = False) -> Result:
    """읽기 쿼리를 보호 한도 안에서 실행한다. stmt 는 SQL 문자열이거나 SQLAlchemy 문."""
    eng = eng or engine(c, replica=replica)
    sem = _sem(c["id"])
    if not sem.acquire(timeout=QUERY_TIMEOUT):
        raise QueryError("동시에 실행할 수 있는 쿼리(%d개)를 넘었습니다. 잠시 뒤 다시 시도해 주세요." % MAX_CONCURRENT)
    t0 = time.monotonic()
    try:
        with eng.connect() as cx:
            res = cx.execute(text(stmt) if isinstance(stmt, str) else stmt, params or {})
            cols = list(res.keys())
            rows = res.fetchmany(limit + 1)
    except QueryError:
        raise
    except Exception as e:                      # noqa: BLE001 — DB 드라이버 오류는 종류가 많다
        msg = str(getattr(e, "orig", e))
        if "interrupt" in msg.lower() or "timeout" in msg.lower() or "timed out" in msg.lower():
            raise QueryError("쿼리가 %d초 안에 끝나지 않아 멈췄습니다." % _limit_seconds())
        raise QueryError("쿼리를 실행하지 못했습니다. %s" % msg.splitlines()[0][:300])
    finally:
        sem.release()
    truncated = len(rows) > limit
    return Result(cols, [tuple(r) for r in rows[:limit]], truncated, int((time.monotonic() - t0) * 1000))


def stream(c: dict, stmt: Any, params: Optional[dict] = None, *, chunk: int = 5000, eng: Optional[Engine] = None, replica: bool = False):
    """읽기 쿼리의 결과를 chunk 행씩 흘려 준다(마트 빌드, 복제). `(컬럼 이름, 행들)` 을 낸다. 행이 없어도 한 번은 컬럼과 빈 목록을 낸다."""
    eng = eng or engine(c, replica=replica)
    sem = _sem(c["id"])
    if not sem.acquire(timeout=QUERY_TIMEOUT):
        raise QueryError("동시에 실행할 수 있는 쿼리(%d개)를 넘었습니다. 잠시 뒤 다시 시도해 주세요." % MAX_CONCURRENT)
    try:
        with eng.connect() as cx:
            res = cx.execution_options(stream_results=True).execute(text(stmt) if isinstance(stmt, str) else stmt, params or {})
            cols = list(res.keys())
            first = True
            while True:
                rows = res.fetchmany(chunk)
                if not rows and not first:
                    break
                first = False
                yield cols, [tuple(r) for r in rows]
                if not rows:
                    break
    except QueryError:
        raise
    except Exception as e:                      # noqa: BLE001
        msg = str(getattr(e, "orig", e))
        if "interrupt" in msg.lower() or "timeout" in msg.lower() or "timed out" in msg.lower():
            raise QueryError("쿼리가 %d초 안에 끝나지 않아 멈췄습니다." % _limit_seconds())
        raise QueryError("쿼리를 실행하지 못했습니다. %s" % msg.splitlines()[0][:300])
    finally:
        sem.release()


# ── 접속 테스트, 등록 ──────────────────────────────────────────────────────

def _clean(p: dict) -> dict:
    dbms = (p.get("dbms") or "").strip()
    if dbms not in DBMS:
        raise ConnError("DB 종류를 골라 주세요.")
    name = (p.get("name") or "").strip()
    if not name:
        raise ConnError("연결 이름을 입력해 주세요.")
    c = {"dbms": dbms, "name": name[:60], "host": (p.get("host") or "").strip(), "port": p.get("port") or None, "db": (p.get("db") or "").strip(),
         "user": (p.get("user") or "").strip(), "schema": (p.get("schema") or "").strip(), "mode": "sync" if p.get("mode") == "sync" else "live",
         "connector": "builtin"}
    if dbms == "sqlite":
        if not c["db"]:
            raise ConnError("SQLite 파일(또는 시연 DB)을 골라 주세요.")
    else:
        if not c["host"]:
            raise ConnError("호스트를 입력해 주세요.")
        if not c["db"]:
            raise ConnError("데이터베이스 이름을 입력해 주세요.")
        if not c["user"]:
            raise ConnError("계정을 입력해 주세요.")
        try:
            c["port"] = int(c["port"]) if c["port"] else DBMS[dbms].get("port")
        except (TypeError, ValueError):
            raise ConnError("포트는 숫자로 입력해 주세요.")
    return c


def test(p: dict, existing: Optional[str] = None) -> dict:
    """접속만 확인한다(스키마는 읽지 않는다). 결과: ok, ms, message, readOnly(확인한 경우), schemas, tables, views, error"""
    c = _clean(p)
    c["id"] = existing or "_test"
    password = p.get("password") or (secret(existing).get("password", "") if existing else "")
    t0 = time.monotonic()
    try:
        if c["dbms"] == "sqlite":
            path = sqlite_file(c["db"])
            eng = _sqlite_engine(path)
            read_only = True
        else:
            d = DBMS[c["dbms"]]
            if not d.get("driver") or importlib.util.find_spec(d["driver"]) is None:
                return {"ok": False, "error": driver_status_one(c["dbms"])["hint"], "driver": False}
            eng = create_engine(_url(c, password), poolclass=NullPool)
            read_only = None
        with eng.connect() as cx:
            cx.execute(text("SELECT 1"))
            ins = _inspect_counts(cx, c)
        ms = int((time.monotonic() - t0) * 1000)
        eng.dispose()
    except ConnError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:                      # noqa: BLE001
        return {"ok": False, "error": "접속하지 못했습니다. %s" % str(getattr(e, "orig", e)).splitlines()[0][:300]}
    return {"ok": True, "ms": ms, "readOnly": read_only, "tables": ins["tables"], "views": ins["views"], "schemas": ins["schemas"],
            "message": ("읽기 전용으로 접속했습니다." if read_only else "접속했습니다. 이 계정에 쓰기 권한이 없는지 DB 에서 확인해 주세요. 이음은 쓰지 않지만 읽기 전용 계정을 권장합니다.")}


def _inspect_counts(cx, c: dict) -> dict:
    from sqlalchemy import inspect
    ins = inspect(cx)
    schema = c["schema"] or None
    if c["dbms"] == "sqlite":
        schema = None
    schemas = [] if c["dbms"] == "sqlite" else [s for s in ins.get_schema_names() if not s.lower().startswith(("information_schema", "pg_", "sys", "mysql", "performance_schema"))]
    return {"tables": len(ins.get_table_names(schema=schema)), "views": len(ins.get_view_names(schema=schema)), "schemas": schemas[:50]}


def create(p: dict, demo_flag: bool = False) -> dict:
    """연결을 만든다. 접속을 확인한 뒤 기록하고, 스키마는 읽지 않는다. 비밀번호는 금고에 둔다."""
    c = _clean(p)
    res = test(p)
    if not res["ok"]:
        raise ConnError(res["error"])
    with store.LOCK:
        rows = list_conns()
        taken = {x["id"] for x in rows}
        schema = c["schema"] or (demo.INFO[c["db"][5:]]["schema"] if c["db"].startswith("demo:") else c["name"][:6])
        alias = re.sub(r"[^A-Za-z0-9_]", "", (p.get("alias") or schema).upper()) or "DB"
        if alias in {x.get("alias") for x in rows} or alias == "MART":
            raise ConnError("SQL 별칭 %s 는 이미 쓰고 있습니다. 다른 이름으로 바꿔 주세요." % alias)
        cid = p.get("id") if p.get("id") and p["id"] not in taken else _slug(p.get("id") or (c["db"][5:] if c["db"].startswith("demo:") else c["name"]), taken)
        c.update(id=cid, schema=schema, alias=alias, clr=PALETTE[len(rows) % len(PALETTE)], status="ok", scanned=time.time(), tables=res["tables"], views=res["views"], ver=1,
                 demo=demo_flag, created=time.time(), lastTest={"ms": res["ms"], "at": time.time()})
        if demo_flag and c["db"].startswith("demo:"):
            c["clr"] = demo.INFO[c["db"][5:]]["clr"]
        rows.append(c)
        store.conns.save(rows)
    if p.get("password"):
        credentials.put("onto:" + c["id"], {"password": p["password"]})
    return c


def update(conn_id: str, patch: dict) -> dict:
    with store.LOCK:
        rows = list_conns()
        c = next((x for x in rows if x["id"] == conn_id), None)
        if c is None:
            raise ConnError("연결을 찾을 수 없습니다.")
        c.update(patch)
        store.conns.save(rows)
        return c


def delete(conn_id: str) -> None:
    forget(conn_id)
    with store.LOCK:
        store.conns.save([x for x in list_conns() if x["id"] != conn_id])
    credentials.delete("onto:" + conn_id)

"""데이터 마트: SQL 로 테이블을 조인하거나 집계한 결과를 이음 저장소(SQLite 파일 하나)에 테이블로 저장해 둔다.

흐름: SQL 작성 -> 미리 보기(실행해서 확인) -> 저장하고 빌드 -> 마트를 객체로 지정(build.py) -> AI 가 객체로 질문.
  - 한 연결의 테이블만 읽는 마트는 그 DB 에서 바로 실행한다(그 DB 의 SQL 문법).
  - 여러 연결을 조인하는 마트는 읽는 테이블을 임시 작업 파일(SQLite)로 복사한 뒤 거기서 조인한다(SQLite 문법). 복사는 테이블마다 COPY_LIMIT 행까지다.
  - 마트가 다른 마트를 읽을 수도 있다(MART.<마트 id>).
빌드는 새 테이블을 따로 만든 뒤 한 번에 바꿔 끼워서, 빌드 중에 읽는 쪽(객체 질의)이 반쯤 쓴 데이터를 보지 않는다.
증분 갱신: 기준 컬럼을 정하면 `SELECT * FROM (<마트 SQL>) WHERE <기준> >= <저장된 최댓값>` 으로 그 구간만 다시 읽어 바꿔 넣는다.
  (기준 컬럼이 GROUP BY 키이면 DB 가 조건을 안쪽으로 밀어 넣어 실제로 빨라진다. 아니면 SQL 은 전부 돌고 결과만 걸러진다.)
갱신 주기(매시간·매일 02:00·매주 월요일 02:00)는 서버 안의 스케줄러가 지킨다. 서버가 꺼져 있던 동안의 갱신은 켜질 때 한 번 한다.
"""
import datetime
import decimal
import re
import shutil
import sqlite3
import tempfile
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.ieum.onto import conn as dbconn
from app.ieum.onto import dictionary as dic
from app.ieum.onto import profile, reader, sqlguard, store

REFRESH = {"hourly": "매시간", "daily": "매일 02:00", "weekly": "매주 월요일 02:00", "manual": "수동"}
BUILD_STEPS = ["원본 DB에서 읽기 (읽기 전용 계정)", "이음 저장소에 결과 저장", "스키마와 통계 등록"]
BUILD_TIMEOUT = 300.0                  # 초. 시연 DB(SQLite)에서 강제한다
PREVIEW_ROWS = 100
PV_ROWS = 5                            # 마트 상세에 보이는 미리 보기 행 수
COPY_LIMIT = 1_000_000                 # DB 간 조인 때 테이블 하나를 복사하는 행 수 상한
MAX_MART_ROWS = 2_000_000
CHUNK = 5000
ID_RX = re.compile(r"^mart_[a-z0-9_]{1,50}$")
TICK_SEC = 20.0

_LOCKS: Dict[str, threading.Lock] = {}
_SLOTS = threading.BoundedSemaphore(2)             # 동시에 빌드하는 마트 수
_SCHED: Dict[str, object] = {"thread": None, "stop": threading.Event()}


class MartError(ValueError):
    """사용자에게 그대로 보일 오류."""


def _lock(mid: str) -> threading.Lock:
    return _LOCKS.setdefault(mid, threading.Lock())


def table_name(mart_id: str) -> str:
    return mart_id


def _q(name: str) -> str:
    return '"%s"' % name.replace('"', '""')


# ── 스키마(편집기 왼쪽 트리, 읽을 수 있는 테이블) ───────────────────────────

def schema_tree() -> List[dict]:
    """마트 SQL 에서 읽을 수 있는 것: 연결마다 테이블·뷰와 컬럼, 그리고 빌드에 성공한 마트"""
    out = []
    for c in store.conns.load():
        try:
            sch = reader.read_cached(c)
        except dbconn.ConnError:
            continue
        out.append({"name": c["name"], "alias": c["alias"], "clr": c["clr"], "conn": c["id"],
                    "tables": [{"name": t["name"], "kind": t["kind"], "cols": [x["name"] for x in t["cols"]]} for t in sch["tables"]]})
    ms = [m for m in store.all_marts().values() if m["status"] == "ok"]
    out.append({"name": "이음 마트", "alias": dbconn.MART_ALIAS, "clr": "pri", "conn": "mart",
                "tables": [{"name": m["id"], "kind": "mart", "cols": [c[0] for c in m["cols"]]} for m in ms]})
    return out


def known_tables() -> set:
    return {("%s.%s" % (g["alias"], t["name"])).upper() for g in schema_tree() for t in g["tables"]}


def _alias_conn(alias: str) -> Optional[dict]:
    return next((c for c in store.conns.load() if c["alias"].upper() == alias.upper()), None)


def sources_of(tables: List[str]) -> List[str]:
    """읽는 테이블들의 별칭(MART 포함), 처음 나온 순서"""
    out: List[str] = []
    for t in tables:
        a = t.split(".")[0].upper()
        if a not in out:
            out.append(a)
    return out


# ── 실행 ───────────────────────────────────────────────────────────────────

def _to_sqlite(v):
    if isinstance(v, decimal.Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return v.isoformat(sep=" ") if isinstance(v, datetime.datetime) else v.isoformat()
    if isinstance(v, (bytes, bytearray, memoryview)):
        return bytes(v).hex()
    if isinstance(v, bool):
        return int(v)
    return v


def _affinity(ctype: str) -> str:
    n, _, _ = dic.parse_ctype(ctype)
    return "NUMERIC" if n in (profile._INT | profile._DEC) else "TEXT"


class Workspace:
    """DB 간 조인용 작업 파일들: 연결(별칭)마다 SQLite 파일 하나에 읽을 테이블을 복사해 둔다. with 로 쓰고 나오면 지운다."""

    def __init__(self, tables: List[str]) -> None:
        self.tables = tables
        self.dir = Path(tempfile.mkdtemp(prefix="ieum-mart-"))
        self.files: Dict[str, Path] = {}
        self.copied: Dict[str, int] = {}

    def __enter__(self) -> "Workspace":
        try:
            by_alias: Dict[str, List[str]] = {}
            for t in self.tables:
                a, name = t.split(".", 1)
                by_alias.setdefault(a, []).append(name)
            for alias, names in by_alias.items():
                if alias == dbconn.MART_ALIAS:
                    continue
                c = _alias_conn(alias)
                if c is None:
                    raise MartError("%s 연결을 찾을 수 없습니다." % alias)
                path = self.dir / ("%s.db" % alias)
                db = sqlite3.connect(path)
                try:
                    sch = reader.read_cached(c)
                    for name in names:
                        t = next((x for x in sch["tables"] if x["name"].upper() == name.upper()), None)
                        if t is None:
                            raise MartError("%s.%s 를 찾을 수 없습니다." % (alias, name))
                        self._copy(c, t, db)
                    db.commit()
                finally:
                    db.close()
                self.files[alias] = path
            return self
        except BaseException:
            self.__exit__()
            raise

    def _copy(self, c: dict, t: dict, db: sqlite3.Connection) -> None:
        cols = [x["name"] for x in t["cols"]]
        db.execute("CREATE TABLE %s (%s)" % (_q(t["name"]), ", ".join("%s %s" % (_q(x["name"]), _affinity(x["type"])) for x in t["cols"])))
        n = 0
        sql = "SELECT %s FROM %s" % (", ".join(reader.q(c, x) for x in cols), reader.qualified(c, t["name"]))
        with dbconn.timeout(BUILD_TIMEOUT):
            for _cols, rows in dbconn.stream(c, sql, chunk=CHUNK):
                n += len(rows)
                if n > COPY_LIMIT:
                    raise MartError("DB 간 조인은 읽는 테이블을 이음 저장소로 복사해 계산해요. %s.%s 가 %s행을 넘어 복사할 수 없습니다. 한 DB 안에서 먼저 줄인 마트를 만들어 쓰세요." %
                                    (c["alias"], t["name"], "{:,}".format(COPY_LIMIT)))
                db.executemany("INSERT INTO %s VALUES (%s)" % (_q(t["name"]), ",".join("?" * len(cols))), [tuple(_to_sqlite(v) for v in r) for r in rows])
        self.copied["%s.%s" % (c["alias"], t["name"])] = n

    def engine(self):
        main = self.dir / "main.db"
        sqlite3.connect(main).close()
        attach = dict(self.files)
        if any(t.startswith(dbconn.MART_ALIAS + ".") for t in self.tables):
            attach[dbconn.MART_ALIAS] = dbconn.mart_file()
        return dbconn._sqlite_engine(main, extra_attach=attach)

    def __exit__(self, *exc) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)


def _route(parsed: dict) -> Tuple[str, Optional[dict]]:
    """('direct', 연결) 한 연결만 읽음 / ('mart', None) 마트만 읽음 / ('work', None) 여러 연결을 섞음"""
    aliases = sources_of(parsed["tables"])
    real = [a for a in aliases if a != dbconn.MART_ALIAS]
    if not aliases:
        raise MartError("읽을 테이블이 없어요. 스키마 이름을 붙여 PO.TB_PO_MST처럼 적어 주세요.")
    if not real:
        return "mart", None
    if len(real) == 1 and len(aliases) == 1:
        return "direct", _alias_conn(real[0])
    return "work", None


def _real_schema_map(c: dict) -> Dict[str, str]:
    """SQL 의 별칭을 실제 스키마 이름으로 바꿔야 하는가(SQLite 는 별칭을 attach 해 둬서 필요 없다)."""
    if c["dbms"] == "sqlite" or not c.get("schema") or c["schema"].upper() == c["alias"].upper():
        return {}
    return {c["alias"].upper(): reader.q(c, c["schema"])}


class _Runner:
    """마트 SQL 한 개를 실행하는 방법(바로, 마트 저장소에서, 작업 파일에서)을 한곳에 둔다."""

    def __init__(self, parsed: dict) -> None:
        self.parsed = parsed
        self.kind, self.conn = _route(parsed)
        self.ws: Optional[Workspace] = None
        self.sql = parsed["sql"]

    def __enter__(self) -> "_Runner":
        if self.kind == "direct":
            if self.conn is None:
                raise MartError("연결을 찾을 수 없습니다.")
            self.sql = sqlguard.rewrite_schema(self.sql, _real_schema_map(self.conn))
        elif self.kind == "work":
            self.ws = Workspace(self.parsed["tables"]).__enter__()
        return self

    def __exit__(self, *exc) -> None:
        if self.ws:
            self.ws.__exit__()

    def _target(self):
        if self.kind == "direct":
            return self.conn, None
        if self.kind == "mart":
            return dict(dbconn.MART_CONN), None
        return {"id": "_mart_work", "dbms": "sqlite", "alias": ""}, self.ws.engine()

    def stream(self, sql: str, params: Optional[dict] = None):
        c, eng = self._target()
        with dbconn.timeout(BUILD_TIMEOUT):
            yield from dbconn.stream(c, sql, params, chunk=CHUNK, eng=eng)

    def run(self, sql: str, params: Optional[dict] = None, limit: int = PREVIEW_ROWS) -> dbconn.Result:
        c, eng = self._target()
        with dbconn.timeout(BUILD_TIMEOUT):
            return dbconn.run(c, sql, params, limit=limit, eng=eng)

    def wrap(self, inc: str) -> str:
        """증분 갱신: 마트 SQL 의 결과에서 기준 컬럼이 저장된 최댓값 이상인 행만"""
        return "SELECT * FROM (%s) m__ WHERE m__.%s >= :wm" % (self.sql, inc)


# ── 미리 보기 ──────────────────────────────────────────────────────────────

def _fmt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, (int, float, decimal.Decimal)) and not isinstance(v, bool):
        return dic.fmt_num(v)
    return str(_to_sqlite(v))


def _col_types(cols: List[str], rows: List[tuple]) -> List[Tuple[str, str]]:
    """값으로 컬럼 타입을 정한다: 숫자는 NUMBER, 문자열은 길이가 모두 같으면 CHAR(n), 아니면 VARCHAR2(최대 길이)"""
    out = []
    for i, name in enumerate(cols):
        vals = [r[i] for r in rows if r[i] is not None]
        if not vals:
            out.append((name, "VARCHAR2(1)"))
        elif all(isinstance(v, (int, float, decimal.Decimal)) and not isinstance(v, bool) for v in vals):
            out.append((name, "NUMBER"))
        else:
            ls = [len(str(_to_sqlite(v))) for v in vals]
            out.append((name, ("CHAR(%d)" % ls[0]) if len(set(ls)) == 1 and ls[0] > 0 else "VARCHAR2(%d)" % max(max(ls), 1)))
    return out


def validate(conn_id: str, sql: str, inc: str = "", edit: str = "") -> dict:
    """SQL 을 실제로 실행해 본다. 결과: {err} 또는 {cols, tables, rows(미리 보기), checks, stat, work}"""
    try:
        parsed = sqlguard.parse(sql, known_tables())
    except sqlguard.SqlError as e:
        return {"err": str(e)}
    try:
        with _Runner(parsed) as rn:
            t0 = time.monotonic()
            res = rn.run(rn.sql, limit=PREVIEW_ROWS)
            ms_prev = int((time.monotonic() - t0) * 1000)
            t1 = time.monotonic()
            total = int(rn.run("SELECT COUNT(*) FROM (%s) m__" % rn.sql, limit=1).rows[0][0])
            ms = int((time.monotonic() - t1) * 1000)
            copied = dict(rn.ws.copied) if rn.ws else {}
    except (dbconn.ConnError, MartError) as e:
        return {"err": str(e)}
    names = [c["c"] for c in parsed["cols"]]
    if [x.upper() for x in res.columns] != [x.upper() for x in names]:
        names = [x.upper() for x in res.columns]            # 실제 컬럼 이름을 따른다
    types = _col_types(names, res.rows)
    aliases = sources_of(parsed["tables"])
    real = [a for a in aliases if a != dbconn.MART_ALIAS]
    checks = [["ok", "읽기 전용 SELECT 문입니다"], ["ok", "원본 %d개를 읽을 수 있어요 (%s)" % (len(parsed["tables"]), ", ".join(parsed["tables"]))]]
    if len(real) > 1:
        checks.append(["info", "DB 간 조인이에요. %s의 테이블을 이음 저장소로 복사한 뒤 조인합니다 (복사한 행 %s)." % (
            "와 ".join(_alias_name(a) for a in real), ", ".join("%s %s행" % (k, "{:,}".format(v)) for k, v in copied.items()))])
    checks.append(["ok", "결과 %s행, 전체를 실행해 센 값이에요 (%s)" % ("{:,}".format(total), _dur(ms))])
    if total > MAX_MART_ROWS:
        checks.append(["warn", "결과가 %s행을 넘어요. 마트에는 %s행까지 저장돼요." % ("{:,}".format(MAX_MART_ROWS), "{:,}".format(MAX_MART_ROWS))])
    if parsed["group_by"] and not inc and (ms > 3000 or ms_prev > 3000):
        checks.append(["warn", "전체를 매번 집계하면 오래 걸려요. 증분 갱신 기준을 정하면 바뀐 구간만 다시 계산해요."])
    return {"cols": [{"c": n, "t": dict(types)[n]} for n in names], "tables": parsed["tables"], "rows": [[_fmt(v) for v in r] for r in res.rows[:PV_ROWS]], "checks": checks,
            "stat": {"rows": total, "ms": ms}, "work": len(real) > 1, "group": bool(parsed["group_by"])}


def _alias_name(alias: str) -> str:
    c = _alias_conn(alias)
    return c["name"] if c else ("이음 마트" if alias == dbconn.MART_ALIAS else alias)


def _dur(ms: int) -> str:
    return "%.1f초" % (ms / 1000) if ms >= 1000 else "%d밀리초" % ms


# ── 저장, 수정, 삭제 ───────────────────────────────────────────────────────

def _next_run(refresh: str, now: Optional[float] = None) -> Optional[float]:
    """다음 빌드 시각(epoch). 수동이면 None"""
    d = datetime.datetime.fromtimestamp(now or time.time())
    if refresh == "hourly":
        n = d.replace(minute=0, second=0, microsecond=0) + datetime.timedelta(hours=1)
    elif refresh == "daily":
        n = d.replace(hour=2, minute=0, second=0, microsecond=0)
        if n <= d:
            n += datetime.timedelta(days=1)
    elif refresh == "weekly":
        n = d.replace(hour=2, minute=0, second=0, microsecond=0) + datetime.timedelta(days=(0 - d.weekday()) % 7)
        if n <= d:
            n += datetime.timedelta(days=7)
    else:
        return None
    return n.timestamp()


def sample(mart_id: str, n: int = 1000) -> List[dict]:
    """마트 저장소의 행(앞 n 행). 아직 빌드한 적이 없으면 빈 목록"""
    try:
        return dbconn.run(dbconn.MART_CONN, "SELECT * FROM %s" % _q(table_name(mart_id)), limit=n).dicts()
    except dbconn.ConnError:
        return []


def suggest_od(m: dict, rows: List[dict]) -> dict:
    """마트를 객체로 지정할 때의 제안(이름, API 이름, 기본키, 제목). 기본키는 GROUP BY 키, 없으면 행이 구별될 때까지 앞 컬럼을 더한다."""
    names = [c[0] for c in m["cols"]]
    pk: List[str] = []
    try:
        parsed = sqlguard.parse(m["sql"])
        norm = lambda x: re.sub(r"\s+", "", x).upper()
        gb = [norm(x) for x in parsed["group_by"]]
        for col in parsed["cols"]:
            if norm(col["expr"].rsplit(" AS ", 1)[0] if re.search(r"\bas\b", col["expr"], re.I) else col["expr"]) in gb or any(g.split(".")[-1] == col["c"] for g in gb):
                pk.append(col["c"])
    except sqlguard.SqlError:
        pass
    pk = [x for x in pk if x in names]

    def unique(cols: List[str]) -> bool:
        keys = [tuple(r.get(x) for x in cols) for r in rows]
        return len(set(keys)) == len(keys)
    if not pk or (rows and not unique(pk)):
        pk = []
        for x in names:
            pk.append(x)
            if not rows or unique(pk):
                break
    if rows:                                    # 없어도 행이 구별되는 컬럼(이름처럼 키에 딸린 컬럼)은 뺀다
        for x in list(reversed(pk)):
            rest = [y for y in pk if y != x]
            if rest and unique(rest):
                pk = rest
    title = next((x for x in names if x.upper().endswith("_NM")), pk[0] if pk else "")
    return {"name": m["name"], "api": dic.pascal(re.sub(r"^mart_", "", m["id"])), "pk": pk, "title": title}


def save(conn_id: str, p: dict, owner: str = "") -> dict:
    """마트를 만들거나(edit 가 없을 때) 고친다. SQL 은 저장 전에 실제로 실행해 본다. 저장한 뒤 빌드는 build() 가 한다."""
    dbconn.need(conn_id)
    edit = p.get("edit") or ""
    mid = edit or (p.get("id") or "").strip()
    name = (p.get("name") or "").strip()
    if not name:
        raise MartError("마트 이름을 입력해 주세요.")
    if not edit:
        if not ID_RX.match(mid):
            raise MartError("마트 ID는 mart_로 시작하는 영문 소문자, 숫자, 밑줄이어야 해요.")
        if store.get_mart(mid):
            raise MartError("이미 있는 마트 ID예요: %s" % mid)
    refresh = p.get("refresh") or "daily"
    if refresh not in REFRESH:
        raise MartError("갱신 주기를 알 수 없습니다.")
    v = validate(conn_id, p.get("sql") or "", p.get("inc") or "", edit)
    if v.get("err"):
        raise MartError(v["err"])
    names = [c["c"] for c in v["cols"]]
    inc = (p.get("inc") or "").strip()
    if inc:
        hit = next((n for n in names if n.upper() == inc.upper()), None)
        if hit is None or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", hit):
            raise MartError("증분 갱신 기준 %s 는 결과 컬럼에 없어요." % inc)
        inc = hit
    old = store.get_mart(mid) if edit else None
    if old and old.get("obj"):
        obj = store.get_object(old["obj"])
        gone = [pr["col"] for pr in (obj or {}).get("props", []) if pr["col"] not in names and not ({"hidden", "filter"} & set(pr["flags"]))]
        if gone:
            raise MartError("이 마트를 원본으로 쓰는 객체 %s 의 속성 %s 가 결과에서 빠져요. 컬럼을 유지하거나 객체를 먼저 고치세요." % (obj["name"], ", ".join(gone)))
    sql_changed = (old is None) or sqlguard.norm(old["sql"]) != sqlguard.norm(p["sql"])
    rec = {"id": mid, "home": conn_id, "name": name, "desc": (p.get("desc") or "").strip(), "sql": p["sql"].strip(), "refresh": refresh, "inc": inc,
           "status": old["status"] if old else "idle", "rows": old.get("rows", 0) if old else 0, "size": old.get("size") if old else None, "last": old.get("last") if old else None,
           "next": _next_run(refresh), "owner": old.get("owner") if old else (owner or ""), "cols": old["cols"] if old else [], "pv": old["pv"] if old else [],
           "od": old.get("od") if old else None, "obj": old.get("obj") if old else None, "builds": old.get("builds", []) if old else [], "failMsg": "", "tip": "", "bstep": 0,
           "tables": v["tables"], "fullNext": sql_changed}
    store.put_mart(rec)
    return rec


def delete(mart_id: str) -> None:
    m = store.get_mart(mart_id)
    if m is None:
        raise MartError("마트를 찾을 수 없습니다.")
    if m.get("obj"):
        raise MartError("객체 %s 의 원본이라 지울 수 없어요. 객체를 먼저 정리하세요." % (store.get_object(m["obj"]) or {}).get("name", m["obj"]))
    if any(mart_id.upper() in x.get("tables", []) or ("MART.%s" % mart_id).upper() in x.get("tables", []) for x in store.all_marts().values() if x["id"] != mart_id):
        raise MartError("다른 마트가 이 마트를 읽고 있어요.")
    store.delete_mart(mart_id)
    with _lock(mart_id):
        db = sqlite3.connect(dbconn.mart_file(), timeout=30)
        try:
            db.execute("DROP TABLE IF EXISTS %s" % _q(table_name(mart_id)))
            db.commit()
        finally:
            db.close()


# ── 빌드 ───────────────────────────────────────────────────────────────────

def _set(mid: str, **kw) -> None:
    store.update_mart(mid, lambda m: m.update(kw))


def build(mart_id: str, force_full: bool = False, wait: bool = False) -> dict:
    """마트를 다시 빌드한다. 기본은 뒤에서 돌리고 바로 돌려준다(화면이 상태를 폴링). wait 면 끝날 때까지 기다린다."""
    m = store.get_mart(mart_id)
    if m is None:
        raise MartError("마트를 찾을 수 없습니다.")
    lk_ = _lock(mart_id)
    if m["status"] == "building" and lk_.locked():
        raise MartError("이미 빌드하고 있어요.")
    _set(mart_id, status="building", bstep=0, failMsg="", tip="")
    if wait:
        _build(mart_id, force_full)
    else:
        threading.Thread(target=_build, args=(mart_id, force_full), daemon=True, name="onto-mart-" + mart_id).start()
    return store.get_mart(mart_id)


def _build(mart_id: str, force_full: bool) -> None:
    with _SLOTS:
        with _lock(mart_id):
            t0 = time.monotonic()
            m = store.get_mart(mart_id)
            if m is None:
                return
            mode = "full"
            try:
                parsed = sqlguard.parse(m["sql"], known_tables())
                with _Runner(parsed) as rn:
                    inc, wm = m.get("inc") or "", None
                    existing = _existing_cols(mart_id)
                    names = [c["c"] for c in parsed["cols"]]
                    if inc and existing and not force_full and not m.get("fullNext") and [x.upper() for x in existing] == [x.upper() for x in names] and inc.upper() in [x.upper() for x in existing]:
                        wm = _watermark(mart_id, inc)
                    if wm is not None:
                        mode = "inc"
                        sql, params = rn.wrap(inc), {"wm": wm}
                    else:
                        sql, params = rn.sql, None
                    rows_n, cols, types, pv = _write(mart_id, rn, sql, params, mode, inc, wm)
                _set(mart_id, bstep=2)
                total = _count(mart_id)
                od = m.get("od") or suggest_od(dict(m, cols=[list(t) for t in types]), sample(mart_id, 1000))
                ms = int((time.monotonic() - t0) * 1000)
                now = time.time()
                rec = {"at": now, "status": "ok", "ms": ms, "rows": total, "mode": mode, "added": rows_n}

                def mut(x: dict) -> None:
                    size, approx = _size(mart_id)
                    x.update(status="ok", rows=total, size=size, sizeApprox=approx, last=now, next=_next_run(x["refresh"], now), cols=[list(t) for t in types], pv=pv, od=od, failMsg="", tip="", bstep=3,
                             fullNext=False)
                    x["builds"] = ([rec] + x.get("builds", []))[:30]
                store.update_mart(mart_id, mut)
            except Exception as e:                  # noqa: BLE001 — 실패 이유를 화면에 보인다
                msg = str(e) if isinstance(e, ValueError) else "빌드하지 못했습니다. %s" % str(e)[:300]
                ms = int((time.monotonic() - t0) * 1000)
                now = time.time()

                def mutf(x: dict, msg=msg, ms=ms, now=now) -> None:
                    x.update(status="fail", failMsg=msg, last=now, next=_next_run(x["refresh"], now), bstep=0,
                             tip=("증분 갱신 기준을 정하면 바뀐 구간만 다시 계산해 빌드 시간을 줄일 수 있어요." if ("초 안에" in msg and not x.get("inc")) else ""))
                    x["builds"] = ([{"at": now, "status": "fail", "ms": ms, "rows": None, "mode": "full", "error": msg}] + x.get("builds", []))[:30]
                try:
                    store.update_mart(mart_id, mutf)
                except KeyError:
                    pass


def _existing_cols(mart_id: str) -> List[str]:
    try:
        db = sqlite3.connect("file:%s?mode=ro" % dbconn.mart_file(), uri=True)
        try:
            return [r[1] for r in db.execute("PRAGMA table_info(%s)" % _q(table_name(mart_id)))]
        finally:
            db.close()
    except sqlite3.Error:
        return []


def _watermark(mart_id: str, inc: str):
    try:
        r = dbconn.run(dbconn.MART_CONN, "SELECT MAX(%s) FROM %s" % (_q(inc), _q(table_name(mart_id))), limit=1).rows
        return r[0][0] if r else None
    except dbconn.ConnError:
        return None


def _count(mart_id: str) -> int:
    return int(dbconn.run(dbconn.MART_CONN, "SELECT COUNT(*) FROM %s" % _q(table_name(mart_id)), limit=1).rows[0][0])


def _size(mart_id: str) -> Tuple[Optional[int], bool]:
    """저장 크기 (바이트, 어림 여부). SQLite 의 dbstat 가 있으면 그 값(정확), 없으면 앞 1,000행의 평균 글자 수로 어림한다."""
    try:
        db = sqlite3.connect("file:%s?mode=ro" % dbconn.mart_file(), uri=True)
        try:
            r = db.execute("SELECT SUM(pgsize) FROM dbstat WHERE name = ?", (table_name(mart_id),)).fetchone()
            if r and r[0]:
                return int(r[0]), False
        except sqlite3.Error:
            pass
        finally:
            db.close()
    except sqlite3.Error:
        return None, False
    rows = sample(mart_id, 1000)
    if not rows:
        return 0, True
    per = sum(len(str(v)) + 1 for r in rows for v in r.values()) / len(rows)
    try:
        return int(per * _count(mart_id)), True
    except dbconn.ConnError:
        return None, False


def _write(mart_id: str, rn: _Runner, sql: str, params: Optional[dict], mode: str, inc: str, wm) -> Tuple[int, List[Tuple[str, str]], List[Tuple[str, str]], List[List[str]]]:
    """쿼리 결과를 새 테이블에 쓰고 한 번에 바꿔 끼운다. 돌려주는 값: (쓴 행 수, 컬럼, 컬럼 타입, 미리 보기 행)"""
    tmp = "%s__new" % table_name(mart_id)
    live = table_name(mart_id)
    db = sqlite3.connect(dbconn.mart_file(), timeout=30)
    db.isolation_level = None
    n = 0
    seen: List[tuple] = []
    cols: List[str] = []
    lens: Dict[int, set] = {}
    pv: List[List[str]] = []
    try:
        db.execute("DROP TABLE IF EXISTS %s" % _q(tmp))
        created = False
        for cols, rows in rn.stream(sql, params):
            if not created:
                db.execute("CREATE TABLE %s (%s)" % (_q(tmp), ", ".join(_q(c) for c in cols)))
                created = True
                _set(mart_id, bstep=1)
            if n + len(rows) > MAX_MART_ROWS:
                rows = rows[: MAX_MART_ROWS - n]
            db.execute("BEGIN")
            db.executemany("INSERT INTO %s VALUES (%s)" % (_q(tmp), ",".join("?" * len(cols))), [tuple(_to_sqlite(v) for v in r) for r in rows])
            db.execute("COMMIT")
            n += len(rows)
            if len(seen) < 2000:
                seen.extend(rows[: 2000 - len(seen)])
            if len(pv) < PV_ROWS:
                pv.extend([[_fmt(v) for v in r] for r in rows[: PV_ROWS - len(pv)]])
            if n >= MAX_MART_ROWS:
                break
        types = _col_types(cols, seen)
        db.execute("BEGIN IMMEDIATE")
        try:
            if mode == "inc":
                db.execute("DELETE FROM %s WHERE %s >= ?" % (_q(live), _q(inc)), (_to_sqlite(wm),))
                db.execute("INSERT INTO %s SELECT * FROM %s" % (_q(live), _q(tmp)))
                db.execute("DROP TABLE %s" % _q(tmp))
            else:
                db.execute("DROP TABLE IF EXISTS %s" % _q(live))
                db.execute("ALTER TABLE %s RENAME TO %s" % (_q(tmp), _q(live)))
            db.execute("COMMIT")
        except BaseException:
            db.execute("ROLLBACK")
            raise
    finally:
        try:
            db.execute("DROP TABLE IF EXISTS %s" % _q(tmp))
        except sqlite3.Error:
            pass
        db.close()
    if mode == "inc":                                  # 증분이면 미리 보기를 저장된 앞부분으로 다시 만든다
        pv = [[_fmt(v) for v in r] for r in dbconn.run(dbconn.MART_CONN, "SELECT * FROM %s" % _q(live), limit=PV_ROWS).rows]
        types = _col_types(cols, dbconn.run(dbconn.MART_CONN, "SELECT * FROM %s" % _q(live), limit=2000).rows)
    return n, cols, types, pv


# ── 스케줄러 ───────────────────────────────────────────────────────────────

def tick(now: Optional[float] = None) -> List[str]:
    """갱신할 때가 된 마트를 빌드한다(뒤에서 돌린다). 빌드를 시작한 마트 id 를 돌려준다."""
    now = now or time.time()
    started = []
    for mid, m in store.all_marts().items():
        if m["refresh"] == "manual" or not m.get("next") or m["status"] == "building" or m["next"] > now:
            continue
        try:
            build(mid)
            started.append(mid)
        except MartError:
            pass
    from app.ieum.onto import replica
    replica.tick(now)
    return started


def recover() -> None:
    """서버가 꺼질 때 빌드하던 마트는 끝나지 않은 채 남는다. 시작할 때 실패로 바꿔 다시 빌드할 수 있게 한다."""
    for mid, m in store.all_marts().items():
        if m["status"] == "building":
            now = time.time()
            _set(mid, status="fail", failMsg="서버가 다시 시작되어 빌드가 중단됐어요. 다시 빌드해 주세요.", next=_next_run(m["refresh"], now), bstep=0)


def start_scheduler() -> None:
    if _SCHED["thread"] is not None and _SCHED["thread"].is_alive():
        return
    recover()
    stop: threading.Event = _SCHED["stop"]        # type: ignore[assignment]
    stop.clear()

    def loop() -> None:
        while not stop.wait(TICK_SEC):
            try:
                tick()
            except Exception:                      # noqa: BLE001 — 스케줄러는 죽지 않는다
                pass
    t = threading.Thread(target=loop, daemon=True, name="onto-mart-scheduler")
    _SCHED["thread"] = t
    t.start()


def stop_scheduler() -> None:
    _SCHED["stop"].set()                           # type: ignore[attr-defined]
    _SCHED["thread"] = None

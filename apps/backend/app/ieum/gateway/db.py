"""DB 원본 연결: 스키마를 읽어 테이블마다 조회 도구를 만들고, 읽기 전용으로 실행한다.

원칙 (엠버링크 DB 어댑터와 같다)
- 사용자가 쓴 SQL 을 실행하지 않는다. 도구는 "테이블 + 바인딩 파라미터"로만 쿼리를 만든다.
- 모든 실행은 읽기 전용 트랜잭션, 한 번에 최대 MAX_ROWS 행.
- 접속 정보는 금고(credentials)에만 둔다. 도구 정의에는 없다.
- 허용 대역(IEUM_PROBE_CIDRS) 밖의 DB 호스트에는 붙지 않는다.

FK 가 선언되지 않은 레거시 DB 가 흔하다. 관계는 추측하지 않고 "선언된 것만" 적는다.
"""
import ipaddress
import os
import re
import socket
import time
from decimal import Decimal

from sqlalchemy import MetaData, Table, and_, create_engine, inspect, select, text
from sqlalchemy.engine import URL

from app.ieum.gateway import credentials
from app.ieum.gateway.engine import ToolError, _mask
from app.ieum.gateway.spec import SpecError, snake

MAX_ROWS = 200
TIMEOUT = 5
DRIVERS = {"postgresql": "postgresql+psycopg"}
PII = re.compile(r"(TELNO|TEL_NO|PHONE|MBL|EMAIL|EML|RPRSV_NM|CEO_NM|RRNO|JUMIN|ADDR)", re.I)
_ENGINES = {}


def allowed_cidrs():
    raw = os.environ.get("IEUM_PROBE_CIDRS", "127.0.0.0/8,10.70.0.0/16")
    return [ipaddress.ip_network(x.strip()) for x in raw.split(",") if x.strip()]


def check_host(host):
    """서버가 아무 곳에나 붙지 않게, 이름을 풀어 허용 대역 안인지 본다."""
    try:
        ips = {ai[4][0] for ai in socket.getaddrinfo(host, None)}
    except socket.gaierror:
        raise SpecError("호스트 이름을 찾을 수 없습니다: %s" % host)
    nets = allowed_cidrs()
    for ip in ips:
        if not any(ipaddress.ip_address(ip) in n for n in nets):
            raise SpecError("허용되지 않은 주소입니다: %s (IEUM_PROBE_CIDRS 에 대역을 추가해야 합니다)" % host)


def make_url(cred):
    driver = DRIVERS.get(cred.get("driver") or "postgresql")
    if not driver:
        raise SpecError("지원하지 않는 DB 종류입니다. 지금은 PostgreSQL 만 지원합니다.")
    return URL.create(driver, username=cred.get("username"), password=cred.get("password"), host=cred.get("host"),
                      port=int(cred.get("port") or 5432), database=cred.get("database"))


def _engine(key, cred):
    e = _ENGINES.get(key)
    if e is None:
        e = create_engine(make_url(cred), pool_pre_ping=True, pool_size=2, max_overflow=0,
                          connect_args={"connect_timeout": TIMEOUT, "options": "-c default_transaction_read_only=on"})
        _ENGINES[key] = e
    return e


def forget(source_id):
    e = _ENGINES.pop(source_id, None)
    if e is not None:
        e.dispose()


# ------------------------------------------------------------------ 스키마 → 도구 후보
def analyze(cred, name=""):
    check_host(cred.get("host") or "")
    schema = cred.get("schema") or "public"
    eng = create_engine(make_url(cred), connect_args={"connect_timeout": TIMEOUT})
    try:
        insp = inspect(eng)
        tables = insp.get_table_names(schema=schema)
        if not tables:
            raise SpecError("'%s' 스키마에서 테이블을 찾지 못했습니다." % schema)
        tools, fk_total = [], 0
        for t in sorted(tables):
            cols = insp.get_columns(t, schema=schema)
            pk = insp.get_pk_constraint(t, schema=schema).get("constrained_columns") or []
            idx = {c for i in insp.get_indexes(t, schema=schema) for c in i["column_names"]}
            fks = insp.get_foreign_keys(t, schema=schema)
            fk_total += len(fks)
            comment = (insp.get_table_comment(t, schema=schema) or {}).get("text") or ""
            tools.extend(_tools_for(schema, t, cols, pk, idx, fks, comment))
        with eng.connect() as c:
            ver = c.execute(text("select version()")).scalar() or ""
    except SpecError:
        raise
    except Exception as e:
        raise SpecError("DB에 연결하지 못했습니다. 주소, 계정, 데이터베이스 이름을 확인해 주세요. (%s)" % type(e).__name__)
    finally:
        eng.dispose()
    meta = {"name": name or cred.get("database") or "DB", "desc": "%s · 테이블 %d개 · 선언된 FK %d개" % (ver.split(",")[0][:40], len(tables), fk_total),
            "base": "%s:%s/%s" % (cred.get("host"), cred.get("port") or 5432, cred.get("database")), "spec": "DB 스키마 (읽기 전용)"}
    return meta, tools


def _at(col_type):
    t = str(col_type).upper()
    if any(x in t for x in ("INT", "NUMERIC", "DECIMAL", "FLOAT", "DOUBLE", "REAL")):
        return "number"
    return "string"


def _tools_for(schema, table, cols, pk, idx, fks, comment):
    label = comment or table
    filt = [c for c in cols if c["name"] in idx or c["name"] in pk]
    res = [{"o": "rows[].%s" % c["name"], "a": "rows[].%s" % snake(c["name"]), "at": _at(c["type"]),
            "ov": "", "rule": "mask" if PII.search(c["name"]) else ("num" if _at(c["type"]) == "number" else "name"),
            **({"d": c["comment"]} if c.get("comment") else {})} for c in cols]
    rel = "; ".join("%s → %s" % (",".join(f["constrained_columns"]), f["referred_table"]) for f in fks) or "선언된 관계 없음"
    base = {"method": "SQL", "status": "review", "mode": "read", "table": table, "schema": schema, "res": res, "mask": True}
    lst = dict(base, id="list_%s" % snake(table), op="SELECT %s" % table, path="%s.%s" % (schema, table),
               title="%s 목록 조회" % label, desc="%s 테이블에서 조건에 맞는 행을 최대 %d건 조회합니다. 관계: %s" % (label, MAX_ROWS, rel),
               params=[{"o": c["name"], "ot": str(c["type"]), "a": snake(c["name"]), "at": _at(c["type"]), "loc": "where",
                        "rule": "name", "d": c.get("comment") or c["name"], "ex": ""} for c in filt]
               + [{"o": "LIMIT", "ot": "int", "a": "limit", "at": "integer", "loc": "limit", "rule": "keep", "d": "최대 행 수 (기본 20, 최대 200)", "ex": 20}])
    out = [lst]
    if pk:
        out.append(dict(base, id="get_%s" % snake(table), op="SELECT %s BY PK" % table, path="%s.%s" % (schema, table),
                        title="%s 한 건 조회" % label, desc="%s 를 기본키(%s)로 한 건 조회합니다." % (label, ", ".join(pk)),
                        params=[{"o": c, "ot": "PK", "a": snake(c), "at": "string", "loc": "where", "rule": "name", "d": "기본키 %s" % c, "ex": "", "req": 1}
                                for c in pk]))
    return out


# ------------------------------------------------------------------ 실행
def invoke(source, tool, args):
    trace = {"args": args}
    t0 = time.time()
    if not isinstance(args, dict):
        raise ToolError("arguments 는 객체여야 합니다.", trace)
    missing = [p["a"] for p in tool["params"] if p.get("req") and args.get(p["a"]) in (None, "")]
    if missing:
        raise ToolError("필수 값이 없습니다: %s" % ", ".join(missing), trace)
    cred = credentials.get(source["id"])
    try:
        check_host(cred.get("host") or "")
    except SpecError as e:
        raise ToolError(str(e), trace)
    eng = _engine(source["id"], cred)
    where, binds = [], {}
    try:
        limit = max(1, min(int(args.get("limit") or 20), MAX_ROWS))
    except (TypeError, ValueError):
        raise ToolError("limit 은 숫자여야 합니다.", trace)
    tbl = Table(tool["table"], MetaData(), schema=tool["schema"], autoload_with=eng)
    for p in tool["params"]:
        if p.get("loc") != "where" or args.get(p["a"]) in (None, ""):
            continue
        where.append(tbl.c[p["o"]] == str(args[p["a"]]))
        binds[p["o"]] = args[p["a"]]
    q = select(tbl).where(and_(*where)).limit(limit) if where else select(tbl).limit(limit)
    sql = str(q.compile(eng, compile_kwargs={"literal_binds": False}))
    trace["originRequest"] = {"method": "SQL", "url": "%s (읽기 전용)" % source.get("base"), "headers": {}, "body": "%s\n-- params %s" % (sql, binds)}
    trace["convertMs"] = int((time.time() - t0) * 1000)
    t1 = time.time()
    try:
        with eng.connect() as c:
            with c.begin():
                c.execute(text("SET TRANSACTION READ ONLY"))
                rows = [dict(r._mapping) for r in c.execute(q)]
    except Exception as e:
        trace["sourceMs"] = int((time.time() - t1) * 1000)
        raise ToolError("DB 조회에 실패했습니다. (%s)" % type(e).__name__, trace)
    trace["sourceMs"] = int((time.time() - t1) * 1000)
    trace["originResponse"] = {"status": 200, "headers": {}, "body": "%d rows" % len(rows)}
    names = {r["o"].split(".", 1)[1]: r for r in tool.get("res", [])}
    out = []
    for row in rows:
        item = {}
        for k, v in row.items():
            r = names.get(k, {})
            key = r.get("a", "rows[].%s" % snake(k)).split(".", 1)[1]
            if isinstance(v, Decimal):
                v = int(v) if v == v.to_integral_value() else float(v)
            elif not (v is None or isinstance(v, (int, float, str))):
                v = str(v)
            if isinstance(v, str):
                v = v.rstrip()                      # CHAR 공백 채움 제거
            if r.get("rule") == "mask" and tool.get("mask", True) and v:
                v = _mask(str(v))
            item[key] = v
        out.append(item)
    result = {"rows": out, "count": len(out), "limit": limit}
    trace["aiResult"] = result
    trace["rulesReq"], trace["rulesRes"] = [], sorted({r["rule"] for r in tool.get("res", []) if r.get("rule") in ("mask", "num")})
    return result, trace

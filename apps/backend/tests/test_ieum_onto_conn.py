"""온톨로지 1: 시연 DB, DB 연결, 읽기 전용 보호, 스키마 읽기. 브라우저와 서버 없이 돈다."""
import sqlite3

import pytest

from app.ieum.onto import conn as dbconn
from app.ieum.onto import demo, reader


@pytest.fixture
def po(ieum_state):
    return dbconn.create({"id": "po", "dbms": "sqlite", "name": "구매관리 DB", "db": "demo:po"}, demo_flag=True)


def test_demo_databases_have_the_tables_the_mockup_shows(ieum_state):
    for name, tables in (("po", 11), ("hr", 5), ("acc", 6)):
        db = sqlite3.connect(demo.ensure(name))
        names = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        assert len(names) == tables, (name, names)
        db.close()
    db = sqlite3.connect(demo.ensure("po"))
    assert db.execute("SELECT PO_STTS_CD, PO_AMT FROM TB_PO_MST WHERE PO_NO='PO-2609-0142'").fetchone() == ("20", 4850000)
    assert db.execute("SELECT COUNT(*) FROM TB_PO_MST WHERE VEND_CD='V0012'").fetchone()[0] == 42                  # 목업이 말하는 한빛상사 발주 42건
    db.close()


def test_connect_checks_access_and_does_not_read_the_schema(po):
    assert po["id"] == "po" and po["alias"] == "PO" and po["schema"] == "PO" and po["mode"] == "live"
    assert po["tables"] == 11 and po["views"] == 0
    assert "password" not in po and dbconn.get("po")["name"] == "구매관리 DB"


def test_writes_are_blocked_on_a_read_only_connection(po):
    with pytest.raises(dbconn.QueryError) as e:
        dbconn.run(po, "DELETE FROM TB_PO_MST")
    assert "readonly" in str(e.value) or "읽기" in str(e.value) or "쿼리를 실행하지 못했습니다" in str(e.value)
    assert dbconn.run(po, "SELECT COUNT(*) FROM TB_PO_MST").rows[0][0] == 242            # 지워지지 않았다


def test_schema_qualified_query_works_through_the_alias(po):
    assert len(dbconn.run(po, "SELECT * FROM PO.TB_PO_MST", limit=2).rows) == 2


def test_a_runaway_query_is_stopped_at_the_time_limit(po, monkeypatch):
    monkeypatch.setattr(dbconn, "QUERY_TIMEOUT", 0.6)
    with pytest.raises(dbconn.QueryError) as e:
        dbconn.run(po, "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT count(*) FROM r")
    assert "초 안에" in str(e.value)
    with dbconn.timeout(0.6):                       # 호출 단위로 바꾸면 그 안의 쿼리에 적용된다
        with pytest.raises(dbconn.QueryError):
            dbconn.run(po, "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT count(*) FROM r")


def test_row_limit_truncates_the_result(po):
    r = dbconn.run(po, "SELECT PO_NO FROM TB_PO_MST", limit=10)
    assert len(r.rows) == 10 and r.truncated
    assert not dbconn.run(po, "SELECT PO_NO FROM TB_PO_MST", limit=1000).truncated          # 242행은 한도 안이다


def test_concurrent_query_limit(po, monkeypatch):
    monkeypatch.setattr(dbconn, "QUERY_TIMEOUT", 0.3)
    sem = dbconn._sem("po")
    taken = [sem.acquire() for _ in range(dbconn.MAX_CONCURRENT)]
    try:
        with pytest.raises(dbconn.QueryError) as e:
            dbconn.run(po, "SELECT 1")
        assert "동시에" in str(e.value)
    finally:
        for _ in taken:
            sem.release()
    assert dbconn.run(po, "SELECT 1").rows[0][0] == 1


def test_sqlite_files_outside_the_allowed_roots_are_refused(ieum_state, tmp_path, monkeypatch):
    other = tmp_path / "elsewhere.db"
    sqlite3.connect(other).close()
    with pytest.raises(dbconn.ConnError) as e:
        dbconn.sqlite_file(str(other))
    assert "허용된 폴더" in str(e.value)
    with pytest.raises(dbconn.ConnError):
        dbconn.sqlite_file("relative/path.db")
    monkeypatch.setenv("IEUM_ONTO_SQLITE_ROOTS", str(tmp_path))
    assert dbconn.sqlite_file(str(other)) == other.resolve()
    with pytest.raises(dbconn.ConnError):
        dbconn.sqlite_file(str(tmp_path / "missing.db"))
    with pytest.raises(dbconn.ConnError):
        dbconn.sqlite_file("demo:nope")


def test_connection_validation_messages(ieum_state, po):
    for payload, text in (({"dbms": "", "name": "x"}, "DB 종류"), ({"dbms": "sqlite", "name": ""}, "이름"), ({"dbms": "sqlite", "name": "x", "db": ""}, "SQLite"),
                          ({"dbms": "pg", "name": "x"}, "호스트"), ({"dbms": "pg", "name": "x", "host": "h"}, "데이터베이스"), ({"dbms": "pg", "name": "x", "host": "h", "db": "d"}, "계정")):
        with pytest.raises(dbconn.ConnError) as e:
            dbconn.create(payload)
        assert text in str(e.value), payload
    with pytest.raises(dbconn.ConnError) as e:                                   # 같은 SQL 별칭은 둘이 될 수 없다
        dbconn.create({"id": "po2", "dbms": "sqlite", "name": "다시", "db": "demo:po"})
    assert "별칭" in str(e.value)
    again = dbconn.create({"dbms": "sqlite", "name": "회계 ERP DB", "db": "demo:acc"})
    assert again["id"] == "acc" and again["alias"] == "ACC"                       # 시연 DB 는 이름으로 id 를 짓는다


def test_drivers_that_are_not_installed_are_reported_with_a_hint(ieum_state):
    st = {x["id"]: x for x in dbconn.driver_status()}
    assert st["sqlite"]["available"] and not st["tibero"]["available"] and "JDBC" in st["tibero"]["hint"]
    if not st["pg"]["available"]:
        assert "pip install" in st["pg"]["hint"]
        res = dbconn.test({"dbms": "pg", "name": "x", "host": "h", "db": "d", "user": "u"})
        assert res["ok"] is False and "pip install" in res["error"]


def test_schema_reading_finds_keys_views_and_view_keys(ieum_state):
    hr = dbconn.create({"id": "hr", "dbms": "sqlite", "name": "인사 DB", "db": "demo:hr"})
    sch = reader.read(hr)
    by = {t["name"]: t for t in sch["tables"]}
    assert sch["tableCount"] == 5 and sch["viewCount"] == 1
    assert by["TB_EMP_MST"]["pk"] == ["EMP_NO"] and {f["ref"] for f in by["TB_EMP_MST"]["fks"]} == {"TB_DEPT", "TB_JBGD_CD"}
    v = by["V_EMP_INFO"]
    assert v["kind"] == "view" and v["pk"] == ["EMP_NO"]                           # 뷰의 키는 기본 테이블의 키에서 얻는다
    assert v["view"]["base"] == "TB_EMP_MST" and {(j["a"], j["b"]) for j in v["view"]["joins"]} == {("TB_DEPT", "TB_EMP_MST"), ("TB_JBGD_CD", "TB_EMP_MST")}
    assert any(c["name"] == "JBGD_NM" for c in v["cols"])
    po = dbconn.create({"id": "po", "dbms": "sqlite", "name": "구매관리 DB", "db": "demo:po"})
    pt = {t["name"]: t for t in reader.read(po)["tables"]}
    assert pt["TB_PO_DTL"]["pk"] == ["PO_NO", "SEQ"] and pt["TB_PO_MST"]["rows"] == 242
    assert {c["name"]: c["type"] for c in pt["TB_PO_MST"]["cols"]}["PO_AMT"] == "NUMBER(15)"      # 선언한 타입이 그대로 나온다


def test_view_definition_parser_handles_joins_and_aliases():
    sql = "CREATE VIEW v AS SELECT e.A, d.B AS BB FROM TB_E e JOIN TB_D d ON d.K = e.K LEFT JOIN TB_X x ON x.Z = e.Z"
    p = reader.parse_view(sql)
    assert p["base"] == "TB_E" and p["tables"] == ["TB_E", "TB_D", "TB_X"]
    assert {(j["a"], j["ac"], j["b"], j["bc"], j["left"]) for j in p["joins"]} == {("TB_D", "K", "TB_E", "K", False), ("TB_X", "Z", "TB_E", "Z", True)}
    assert [(s["table"], s["col"], s["out"]) for s in p["select"]] == [("TB_E", "A", "A"), ("TB_D", "B", "BB")]
    assert reader.parse_view("CREATE VIEW v AS SELECT a FROM (SELECT 1 a FROM t) x") is None       # 서브쿼리 뷰는 모른다고 답한다


def test_value_helpers_for_link_inference(po):
    assert set(reader.matched_values(po, "TB_VEND_MST", "VEND_CD", ["V0012", "V0007", "ZZZ"])) == {"V0012", "V0007"}
    assert reader.is_unique(po, "TB_VEND_MST", "VEND_CD") and not reader.is_unique(po, "TB_PO_MST", "VEND_CD")
    assert reader.row_count(po, "TB_PO_MST", "DEL_YN = 'N'") == 240

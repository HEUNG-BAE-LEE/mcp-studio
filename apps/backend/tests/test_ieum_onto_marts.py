"""온톨로지 4: 마트 SQL 검사, 미리 보기, 빌드(DB 간 조인, 증분), 갱신 주기, 마트를 객체로, 주기 동기화 복제본."""
import time

import pytest

from app.ieum.onto import build, marts, perm, query, replica, sqlguard, store
from app.ieum.onto import conn as dbconn

SQL = """SELECT po.VEND_CD,
       SUBSTR(po.PO_YMD, 1, 6)   AS YM,
       COUNT(*)                  AS PO_CNT
  FROM PO.TB_PO_MST po
 WHERE po.DEL_YN = 'N'
 GROUP BY po.VEND_CD, SUBSTR(po.PO_YMD, 1, 6)"""
CROSS = """SELECT b.DEPT_CD, d.DEPT_NM, b.YYYY, b.USE_AMT
  FROM PO.TB_BDGT b JOIN HR.TB_DEPT d ON d.DEPT_CD = b.DEPT_CD"""


# ── SQL 검사 ───────────────────────────────────────────────────────────────

def test_sql_guard_accepts_selects_and_names_the_columns():
    r = sqlguard.parse(SQL)
    assert [c["c"] for c in r["cols"]] == ["VEND_CD", "YM", "PO_CNT"] and r["tables"] == ["PO.TB_PO_MST"] and len(r["group_by"]) == 2
    w = sqlguard.parse("WITH x AS (SELECT 1 AS a FROM PO.T) SELECT a FROM x")
    assert w["ctes"] == ["X"] and w["tables"] == ["PO.T"]
    assert [c["c"] for c in sqlguard.parse("select a name, b as c from po.t where x = 'delete me' -- drop it")["cols"]] == ["NAME", "C"]    # 문자열과 주석 안의 말은 무시한다


@pytest.mark.parametrize("sql, text", [
    ("DELETE FROM PO.T", "읽기 전용"), ("UPDATE PO.T SET a = 1", "읽기 전용"), ("SELECT a FROM PO.T; DROP TABLE PO.T", "하나만"), ("SELECT * FROM PO.T", "SELECT *"),
    ("SELECT a FROM T", "찾지 못했어요"), ("SELECT a, a FROM PO.T", "두 번"), ("SELECT COUNT(*) FROM PO.T", "이름을 붙여"), ("", "입력"), ("PRAGMA table_info(x)", "읽기 전용"), ("SELECT a INTO x FROM PO.T", "읽기 전용"),
    ("EXPLAIN SELECT a FROM PO.T", "SELECT로"),
])
def test_sql_guard_refuses(sql, text):
    with pytest.raises(sqlguard.SqlError) as e:
        sqlguard.parse(sql)
    assert text in str(e.value)


def test_schema_rewrite_does_not_touch_literals():
    assert sqlguard.rewrite_schema("SELECT * FROM PO.TB_X WHERE a = 'PO.y' AND po.z=1", {"PO": '"REAL"'}) == "SELECT * FROM \"REAL\".TB_X WHERE a = 'PO.y' AND \"REAL\".z=1"


# ── 미리 보기, 저장, 빌드 ──────────────────────────────────────────────────

def test_validate_runs_the_sql_and_reports_real_counts(onto):
    v = marts.validate("po", SQL)
    assert not v.get("err") and [c["c"] for c in v["cols"]] == ["VEND_CD", "YM", "PO_CNT"] and v["stat"]["rows"] > 100 and len(v["rows"]) == 5 and not v["work"]
    assert [c["t"] for c in v["cols"]] == ["CHAR(5)", "CHAR(6)", "NUMBER"] and v["rows"][0][0].startswith("V")
    assert marts.validate("po", "SELECT x.PO_NO AS A FROM PO.TB_PO_MST x WHERE x.NOPE = 1")["err"].startswith("쿼리를 실행하지 못했습니다")
    assert "찾지 못했어요" in marts.validate("po", "SELECT PO_NO AS A FROM PO.NOPE")["err"]
    x = marts.validate("po", CROSS)
    assert x["work"] and any(k == "info" and "DB 간 조인" in t for k, t in x["checks"])          # 여러 연결을 섞으면 작업 파일로 복사해 조인한다


def test_cross_database_mart_builds_through_a_workspace_and_cleans_up(onto):
    before = {p.name for p in __import__("tempfile").gettempdir() and __import__("pathlib").Path(__import__("tempfile").gettempdir()).glob("ieum-mart-*")}
    m = marts.save("po", {"id": "mart_x", "name": "교차", "sql": CROSS, "refresh": "manual"}, owner="김현우")
    built = marts.build("mart_x", wait=True)
    assert built["status"] == "ok" and built["rows"] == 20 and built["builds"][0]["mode"] == "full" and built["next"] is None
    assert built["pv"][0][:2] == ["D1000", "경영지원본부"] and built["od"]["pk"] == ["DEPT_CD", "YYYY"]
    after = {p.name for p in __import__("pathlib").Path(__import__("tempfile").gettempdir()).glob("ieum-mart-*")}
    assert after == before                                                         # 임시 작업 파일은 지운다


def test_incremental_build_rereads_only_the_range_from_the_stored_maximum(onto):
    marts.save("po", {"id": "mart_v", "name": "월별", "sql": SQL, "refresh": "hourly", "inc": "YM"})
    first = marts.build("mart_v", wait=True)
    assert first["builds"][0]["mode"] == "full" and first["rows"] > 100
    second = marts.build("mart_v", wait=True)
    assert second["builds"][0]["mode"] == "inc" and second["rows"] == first["rows"] and 0 < second["builds"][0]["added"] < first["rows"]      # 마지막 달 구간만 다시 읽었다
    assert marts.build("mart_v", force_full=True, wait=True)["builds"][0]["mode"] == "full"
    again = marts.save("po", {"edit": "mart_v", "name": "월별", "sql": SQL.replace("COUNT(*)", "COUNT(1)"), "refresh": "hourly", "inc": "YM"})
    assert again["fullNext"] and marts.build("mart_v", wait=True)["builds"][0]["mode"] == "full"                # SQL 이 바뀌면 전체를 다시 계산한다


def test_failed_build_keeps_the_previous_data_and_says_why(onto, monkeypatch):
    marts.save("po", {"id": "mart_f", "name": "실패", "sql": SQL, "refresh": "manual"})
    ok = marts.build("mart_f", wait=True)
    assert ok["status"] == "ok"
    monkeypatch.setattr(marts, "BUILD_TIMEOUT", 0.0001)
    big = "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n < 3000000) SELECT n AS N FROM r"
    store.update_mart("mart_f", lambda m: m.update(sql="SELECT COUNT(*) AS C FROM PO.TB_PO_MST po, PO.TB_PO_DTL d, PO.TB_RCV_DTL r, PO.TB_PO_HIST h"))
    failed = marts.build("mart_f", wait=True)
    assert failed["status"] == "fail" and "초 안에" in failed["failMsg"] and failed["builds"][0]["status"] == "fail" and failed["tip"]
    assert marts.sample("mart_f", 1)                                                # 이전에 성공한 데이터는 그대로 있다


def test_save_validates_id_name_refresh_and_object_columns(onto):
    base = {"id": "mart_ok", "name": "마트", "sql": SQL, "refresh": "daily"}
    for patch, text in (({"id": "bad"}, "mart_로 시작"), ({"name": " "}, "이름"), ({"refresh": "yearly"}, "갱신 주기"), ({"inc": "NOPE"}, "결과 컬럼에 없어요"), ({"sql": "DELETE FROM PO.T"}, "읽기 전용"),
                        ({"id": "mart_vendor_monthly"}, "이미 있는")):
        with pytest.raises(marts.MartError) as e:
            marts.save("po", dict(base, **patch))
        assert text in str(e.value), patch
    m = marts.save("po", base)
    assert m["status"] == "idle" and m["next"] and m["tables"] == ["PO.TB_PO_MST"]
    with pytest.raises(marts.MartError):
        marts.delete("mart_nope")


def test_mart_to_object_and_object_columns_are_protected(onto):
    d = build.draft("po", "mart", "mart_dept_budget")
    assert d["name"] == "부서 예산 현황" and d["api"] == "DepartmentBudgetStatus" and d["pk"] == ["DEPT_CD", "YYYY"] and d["title"] == "DEPT_NM"
    names = {c["c"]: c for c in d["cols"]}
    assert names["USE_RATE"]["name"] == "집행률 (%)" and names["USE_RATE"]["t"] == "decimal" and names["DEPT_NM"]["api"] == "departmentName"
    o = build.create("po", {"src": "mart", "pick": "mart_dept_budget", "name": "부서 예산 현황", "api": "DepartmentBudgetStatus", "pk": d["pk"], "title": "DEPT_NM", "links": [c["key"] for c in d["links"] if c["rec"]]})
    assert o["kind"] == "mart" and o["table"] == "MART.mart_dept_budget" and o["mart"] == "mart_dept_budget" and store.get_mart("mart_dept_budget")["obj"] == o["id"]
    assert any(l["to"] == "hr.Department" and l["cross"] for l in store.object_links(o["id"]))               # 마트 컬럼 DEPT_CD 로 인사 DB 부서와 이어진다
    ctx = query.Ctx.live(admin=True)
    r = query.search(ctx, o["id"], {"fiscalYear": 2026}, 3)
    assert r["total"] == 10 and r["rows"][0]["departmentName"] == "경영지원본부" and r["rows"][0]["usageRate"] > 0 and "MART.mart_dept_budget" in r["sql"]
    with pytest.raises(build.BuildError):
        build.draft("po", "mart", "mart_dept_budget")                              # 이미 객체로 지정한 마트
    with pytest.raises(marts.MartError) as e:                                      # 객체가 쓰는 컬럼을 빼는 수정은 막는다
        marts.save("po", {"edit": "mart_dept_budget", "name": "x", "sql": "SELECT b.DEPT_CD AS DEPT_CD FROM PO.TB_BDGT b", "refresh": "daily"})
    assert "빠져요" in str(e.value)
    with pytest.raises(marts.MartError) as e:
        marts.delete("mart_dept_budget")
    assert "객체" in str(e.value)


def test_a_mart_can_read_another_mart_and_cannot_be_deleted_while_read(onto):
    v = marts.validate("po", "SELECT VEND_CD AS V, PO_CNT AS C FROM MART.mart_vendor_monthly")
    assert not v.get("err") and v["stat"]["rows"] == 165
    marts.save("po", {"id": "mart_top", "name": "상위", "sql": "SELECT VEND_CD AS V, PO_CNT AS C FROM MART.mart_vendor_monthly", "refresh": "manual"})
    assert marts.build("mart_top", wait=True)["rows"] == 165
    with pytest.raises(marts.MartError) as e:
        marts.delete("mart_vendor_monthly")
    assert "읽고 있어요" in str(e.value)
    marts.delete("mart_top")
    assert not marts.sample("mart_top") and store.get_mart("mart_top") is None


def test_scheduler_builds_marts_that_are_due_and_survives_a_crash_marker(onto):
    now = time.time()
    store.update_mart("mart_dept_budget", lambda m: m.update(next=now - 5))
    store.update_mart("mart_vendor_monthly", lambda m: m.update(next=now + 3600))
    started = marts.tick(now)
    assert started == ["mart_dept_budget"]
    for _ in range(100):
        if store.get_mart("mart_dept_budget")["status"] != "building":
            break
        time.sleep(0.05)
    m = store.get_mart("mart_dept_budget")
    assert m["status"] == "ok" and m["next"] > now and m["builds"][0]["at"] >= now
    store.update_mart("mart_item_price_trend", lambda x: x.update(status="building"))
    marts.recover()                                                                # 서버가 꺼질 때 빌드 중이던 마트는 실패로 바꾼다
    assert store.get_mart("mart_item_price_trend")["status"] == "fail" and "중단" in store.get_mart("mart_item_price_trend")["failMsg"]


def test_refresh_times():
    base = time.mktime((2026, 9, 30, 10, 30, 0, 0, 0, -1))
    nxt = lambda r: time.localtime(marts._next_run(r, base))
    assert nxt("hourly")[3:5] == (11, 0) and nxt("daily")[2:5] == (1, 2, 0) and nxt("weekly")[6] == 0 and marts._next_run("manual", base) is None       # 월요일 02:00


# ── 주기 동기화 ────────────────────────────────────────────────────────────

def test_sync_mode_asks_the_replica_and_refreshes_hourly(onto):
    dbconn.update("po", {"mode": "sync"})
    dbconn.forget("po")
    assert not dbconn.use_replica(dbconn.get("po"))                               # 복제본이 생기기 전에는 원본으로 간다
    r = replica.sync("po")
    assert r["tables"] >= 6 and r["rows"] > 1000 and dbconn.use_replica(dbconn.get("po")) and dbconn.get("po")["synced"]
    ctx = query.Ctx.live(admin=True)
    assert query.Q(ctx, ctx.obj("po.PurchaseOrder")).count() == 240
    import sqlite3
    db = sqlite3.connect(demo_path("po"))
    db.execute("UPDATE TB_PO_MST SET PO_STTS_CD = '90' WHERE PO_NO = 'PO-2609-0142'")
    db.commit()
    db.close()
    assert query.get(ctx, "po.PurchaseOrder", "PO-2609-0142")["row"]["status"] == "승인대기"      # 질문은 복제본에 간다. 원본이 바뀌어도 다음 동기화까지는 그대로다
    assert dbconn.run(dbconn.get("po"), "SELECT PO_STTS_CD FROM TB_PO_MST WHERE PO_NO='PO-2609-0142'").rows[0][0] == "90"      # 스캔·마트는 원본을 읽는다
    assert replica.tick(time.time()) == []                                         # 방금 동기화했으니 아직 아니다
    assert replica.tick(time.time() + replica.SYNC_EVERY + 1) == ["po"]
    assert query.get(ctx, "po.PurchaseOrder", "PO-2609-0142")["row"]["status"] == "취소"


def demo_path(name):
    from app.ieum.onto import demo
    return demo.path_of(name)

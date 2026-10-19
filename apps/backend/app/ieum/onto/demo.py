"""시연용 SQLite DB 3개(구매관리 po, 인사 hr, 회계 ERP acc)를 만든다.

목업의 DB 는 Tibero, Oracle, MS SQL Server 인데 이 PC 에는 DB 서버가 없다. 같은 테이블·컬럼 이름과 선언 타입(VARCHAR2(20), NUMBER(15), decimal(15,0)…)으로
SQLite 파일을 만들어, 스캔·마트·객체 탐색·AI 질의가 전부 진짜 SQL 로 도는 시연 환경을 준다. 연결 화면에는 SQLite(시연용)라고 그대로 밝힌다.

파일은 상태 폴더(onto/demo/)에 둔다. 데이터셋을 만드는 데 1초쯤 걸려서, 한 번 만든 템플릿을 임시 폴더에 두고 복사해 쓴다(시험이 상태 폴더를 바꿀 때마다 새로 만들지 않게).
"""
import shutil
import sqlite3
import tempfile
from pathlib import Path
from typing import Dict

from app.ieum.config import state_dir
from app.ieum.onto import demo_data as dd

NAMES = ("po", "hr", "acc")
INFO = {
    "po": {"name": "구매관리 DB", "schema": "PO", "clr": "mcp", "label": "구매관리 (시연용)"},
    "hr": {"name": "인사 DB", "schema": "HR", "clr": "ont", "label": "인사 (시연용)"},
    "acc": {"name": "회계 ERP DB", "schema": "ACC", "clr": "rag", "label": "회계 ERP (시연용)"},
}

PO_DDL = """
CREATE TABLE TB_VEND_MST (VEND_CD VARCHAR2(10) PRIMARY KEY, VEND_NM VARCHAR2(100) NOT NULL, BIZ_NO VARCHAR2(12), CEO_NM VARCHAR2(50), TRD_STTS_CD CHAR(1),
  CHRG_TELNO VARCHAR2(20), ADDR VARCHAR2(200));
CREATE TABLE TB_ITEM_MST (ITEM_CD VARCHAR2(10) PRIMARY KEY, ITEM_NM VARCHAR2(100) NOT NULL, UNIT VARCHAR2(10), ITEM_GRP_CD CHAR(3), STD_PRC NUMBER(12));
CREATE TABLE TB_PR_MST (PR_NO VARCHAR2(20) PRIMARY KEY, PR_TITLE VARCHAR2(200), REQ_EMP_NO VARCHAR2(8), DEPT_CD VARCHAR2(5), PR_STTS_CD CHAR(2), REQ_YMD CHAR(8));
CREATE TABLE TB_PO_MST (PO_NO VARCHAR2(20) PRIMARY KEY, PO_YMD CHAR(8), VEND_CD VARCHAR2(10) REFERENCES TB_VEND_MST(VEND_CD), PO_AMT NUMBER(15), PO_STTS_CD CHAR(2),
  DLV_YMD CHAR(8), CHRG_EMP_NO VARCHAR2(8), PR_NO VARCHAR2(20), RMK VARCHAR2(4000), REG_DT DATE, REG_ID VARCHAR2(20), APPR_LINE_XML CLOB, DEL_YN CHAR(1));
CREATE TABLE TB_PO_DTL (PO_NO VARCHAR2(20) NOT NULL REFERENCES TB_PO_MST(PO_NO), SEQ NUMBER(4) NOT NULL, ITEM_CD VARCHAR2(10) REFERENCES TB_ITEM_MST(ITEM_CD),
  QTY NUMBER(9), UNIT_PRC NUMBER(12), PRIMARY KEY (PO_NO, SEQ));
CREATE TABLE TB_BDGT (DEPT_CD VARCHAR2(5) NOT NULL, YYYY CHAR(4) NOT NULL, BDGT_AMT NUMBER(15), USE_AMT NUMBER(15), PRIMARY KEY (DEPT_CD, YYYY));
CREATE TABLE TB_WH_MST (WH_CD VARCHAR2(5) PRIMARY KEY, WH_NM VARCHAR2(50), WH_ADDR VARCHAR2(200), USE_YN CHAR(1));
CREATE TABLE TB_RCV_MST (RCV_NO VARCHAR2(20) PRIMARY KEY, RCV_YMD CHAR(8), PO_NO VARCHAR2(20) REFERENCES TB_PO_MST(PO_NO), WH_CD VARCHAR2(5) REFERENCES TB_WH_MST(WH_CD),
  VEND_CD VARCHAR2(10) REFERENCES TB_VEND_MST(VEND_CD), RCV_STTS_CD CHAR(2), INSP_EMP_NO VARCHAR2(8), RCV_QTY_SUM NUMBER(9), DEL_YN CHAR(1));
CREATE TABLE TB_RCV_DTL (RCV_NO VARCHAR2(20) NOT NULL REFERENCES TB_RCV_MST(RCV_NO), SEQ NUMBER(4) NOT NULL, ITEM_CD VARCHAR2(10) REFERENCES TB_ITEM_MST(ITEM_CD),
  QTY NUMBER(9), PRIMARY KEY (RCV_NO, SEQ));
CREATE TABLE TB_PO_HIST (HIST_SEQ NUMBER(10) PRIMARY KEY, PO_NO VARCHAR2(20), CHG_DT DATE, CHG_ID VARCHAR2(20), BEF_STTS_CD CHAR(2), AFT_STTS_CD CHAR(2));
CREATE TABLE TB_CODE_DTL (GRP_CD VARCHAR2(20) NOT NULL, CD VARCHAR2(10) NOT NULL, CD_NM VARCHAR2(50), SORT_NO NUMBER(3), PRIMARY KEY (GRP_CD, CD));
"""
HR_DDL = """
CREATE TABLE TB_DEPT (DEPT_CD VARCHAR2(5) PRIMARY KEY, DEPT_NM VARCHAR2(50), UPPER_DEPT_CD VARCHAR2(5));
CREATE TABLE TB_JBGD_CD (JBGD_CD VARCHAR2(2) PRIMARY KEY, JBGD_NM VARCHAR2(20), RANK_NO NUMBER(2));
CREATE TABLE TB_EMP_MST (EMP_NO VARCHAR2(8) PRIMARY KEY, EMP_NM VARCHAR2(50), DEPT_CD VARCHAR2(5) REFERENCES TB_DEPT(DEPT_CD),
  JBGD_CD VARCHAR2(2) REFERENCES TB_JBGD_CD(JBGD_CD), EML_ADDR VARCHAR2(100), RSGNTN_YN CHAR(1), JOIN_YMD CHAR(8));
CREATE VIEW V_EMP_INFO AS
  SELECT e.EMP_NO, e.EMP_NM, e.DEPT_CD, j.JBGD_NM, e.EML_ADDR, e.RSGNTN_YN
    FROM TB_EMP_MST e
    JOIN TB_DEPT d ON d.DEPT_CD = e.DEPT_CD
    LEFT JOIN TB_JBGD_CD j ON j.JBGD_CD = e.JBGD_CD;
CREATE TABLE TB_ATND_DAY (EMP_NO VARCHAR2(8) NOT NULL, ATND_YMD CHAR(8) NOT NULL, IN_TM CHAR(4), OUT_TM CHAR(4), ATND_STTS_CD CHAR(2), PRIMARY KEY (EMP_NO, ATND_YMD));
CREATE TABLE TB_EMP_HIST (HIST_SEQ NUMBER(10) PRIMARY KEY, EMP_NO VARCHAR2(8), CHG_YMD CHAR(8), CHG_ITEM VARCHAR2(30), BEF_VAL VARCHAR2(100), AFT_VAL VARCHAR2(100));
"""
ACC_DDL = """
CREATE TABLE TB_ACCT_CD (ACCT_CD varchar(10) PRIMARY KEY, ACCT_NM nvarchar(50), ACCT_TP char(1));
CREATE TABLE TB_CUST (CUST_NO varchar(10) PRIMARY KEY, CUST_BIZ_NO varchar(12), CUST_NM nvarchar(100), CEO_NM nvarchar(50));
CREATE TABLE TB_SLIP_MST (SLIP_NO varchar(20) PRIMARY KEY, SLIP_YMD char(8), ACCT_CD varchar(10) REFERENCES TB_ACCT_CD(ACCT_CD), CUST_BIZ_NO varchar(12),
  REF_PO_NO varchar(20), DR_AMT decimal(15,0), SUMRY nvarchar(200));
CREATE TABLE TB_SLIP_DTL (SLIP_NO varchar(20) NOT NULL REFERENCES TB_SLIP_MST(SLIP_NO), SEQ int NOT NULL, ACCT_CD varchar(10), DR_AMT decimal(15,0), CR_AMT decimal(15,0),
  PRIMARY KEY (SLIP_NO, SEQ));
CREATE TABLE TB_SLIP_HIST (HIST_SEQ int PRIMARY KEY, SLIP_NO varchar(20), CHG_YMD char(8), CHG_ID varchar(20), CHG_TP nvarchar(20));
CREATE TABLE TB_CMN_CD (GRP_CD varchar(20) NOT NULL, CD varchar(10) NOT NULL, CD_NM nvarchar(50), PRIMARY KEY (GRP_CD, CD));
"""


def _ins(db: sqlite3.Connection, table: str, rows) -> None:
    if rows:
        db.executemany("INSERT INTO %s VALUES (%s)" % (table, ",".join("?" * len(rows[0]))), rows)


def _write(path: Path, ddl: str, fill) -> None:
    if path.exists():
        path.unlink()
    db = sqlite3.connect(path)
    try:
        db.executescript(ddl)
        fill(db)
        db.commit()
    finally:
        db.close()


def _fill_po(ds: dd.Dataset):
    def fill(db):
        _ins(db, "TB_VEND_MST", ds.vendors)
        _ins(db, "TB_ITEM_MST", ds.items)
        _ins(db, "TB_PR_MST", ds.prs)
        _ins(db, "TB_PO_MST", ds.pos)
        _ins(db, "TB_PO_DTL", ds.po_lines)
        _ins(db, "TB_BDGT", ds.budgets)
        _ins(db, "TB_WH_MST", dd.WAREHOUSES)
        _ins(db, "TB_RCV_MST", ds.rcvs)
        _ins(db, "TB_RCV_DTL", ds.rcv_lines)
        _ins(db, "TB_PO_HIST", ds.po_hist)
        _ins(db, "TB_CODE_DTL", [(g, c, n, i + 1) for g, rows in dd.CODES.items() for i, (c, n) in enumerate(rows)])
    return fill


def _fill_hr(ds: dd.Dataset):
    def fill(db):
        _ins(db, "TB_DEPT", ds.depts)
        _ins(db, "TB_JBGD_CD", dd.RANKS)
        _ins(db, "TB_EMP_MST", ds.emps)
        _ins(db, "TB_ATND_DAY", ds.atnd)
        _ins(db, "TB_EMP_HIST", ds.emp_hist)
    return fill


def _fill_acc(ds: dd.Dataset):
    def fill(db):
        _ins(db, "TB_ACCT_CD", dd.ACCOUNTS)
        _ins(db, "TB_CUST", ds.customers)
        _ins(db, "TB_SLIP_MST", ds.slips)
        _ins(db, "TB_SLIP_DTL", ds.slip_lines)
        _ins(db, "TB_SLIP_HIST", ds.slip_hist)
        _ins(db, "TB_CMN_CD", [("ACCT_TP", c, n) for c, n in dd.ACCT_TYPES])
    return fill


def build_all(folder: Path) -> None:
    """세 DB 파일을 folder 에 새로 만든다."""
    folder.mkdir(parents=True, exist_ok=True)
    ds = dd.Dataset()
    _write(folder / "po.db", PO_DDL, _fill_po(ds))
    _write(folder / "hr.db", HR_DDL, _fill_hr(ds))
    _write(folder / "acc.db", ACC_DDL, _fill_acc(ds))


def _template() -> Path:
    """한 번 만든 데이터셋을 임시 폴더에 둔다. 같은 버전이면 다시 만들지 않는다."""
    root = Path(tempfile.gettempdir()) / ("ieum-onto-demo-v%d" % dd.VERSION)
    if all((root / ("%s.db" % n)).exists() for n in NAMES):
        return root
    tmp = Path(tempfile.mkdtemp(prefix="ieum-onto-build-"))
    build_all(tmp)
    root.mkdir(parents=True, exist_ok=True)
    for n in NAMES:
        shutil.copyfile(tmp / ("%s.db" % n), root / ("%s.db.part" % n))
        (root / ("%s.db.part" % n)).replace(root / ("%s.db" % n))
    shutil.rmtree(tmp, ignore_errors=True)
    return root


def folder() -> Path:
    return state_dir() / "onto" / "demo"


def path_of(name: str) -> Path:
    if name not in NAMES:
        raise KeyError(name)
    return folder() / ("%s.db" % name)


def ensure(name: str) -> Path:
    """시연 DB 파일 하나가 없으면 만든다. 이미 있으면 그대로 둔다(시연 중 바뀐 값을 지우지 않는다)."""
    path = path_of(name)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        part = path.with_name(path.name + ".part")
        shutil.copyfile(_template() / ("%s.db" % name), part)
        part.replace(path)
    return path


def reset(name: str = "") -> None:
    """시연 DB 를 처음 상태로 되돌린다(액션으로 바뀐 값도 되돌아간다)."""
    for n in ([name] if name else NAMES):
        p = path_of(n)
        p.parent.mkdir(parents=True, exist_ok=True)
        part = p.with_name(p.name + ".part")
        shutil.copyfile(_template() / ("%s.db" % n), part)
        part.replace(p)


def as_uri(name: str) -> str:
    return "file:%s?mode=ro" % ensure(name)


def describe() -> Dict[str, dict]:
    return {n: dict(INFO[n], file=str(path_of(n))) for n in NAMES}

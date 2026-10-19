"""시연 레거시 구매관리 사이트와 온톨로지 시연 DB(po.db)를 같은 값으로 맞춘다.

액션은 DB 에 직접 쓰지 않고 원본 시스템 API(레거시 사이트)를 부른다. 그런데 이 시연의 레거시 사이트는 메모리에 자기 데이터(발주 8건)를 따로 들고 있어서,
승인해도 온톨로지가 읽는 po.db 의 상태가 바뀌지 않는다. 그러면 "승인한 뒤 객체를 다시 읽으면 승인으로 바뀐다"를 보일 수 없다.
그래서 레거시 사이트가 상태를 바꿀 때(발주 승인, 구매요청 마감, 발주 등록) 같은 변경을 po.db 에도 쓴다. po.db 에만 있는 발주는 레거시 메모리에 없어
`none` 이 오는데, 이때는 po.db 의 상태로 판정한다(승인대기면 승인). po.db 가 없으면(시연 환경을 불러오지 않았으면) 아무 일도 하지 않는다.
이 모듈이 레거시 사이트에 직접 쓰는 것이 아니라, 레거시 사이트가 부르는 후크를 등록하는 쪽이다(demo_legacy/hooks.py).
"""
import sqlite3
import time
from typing import Optional

from app.ieum.demo_legacy import hooks
from app.ieum.onto import demo

APPROVER = "po_manager"


def _open() -> Optional[sqlite3.Connection]:
    p = demo.path_of("po")
    if not p.exists():
        return None
    db = sqlite3.connect(p, timeout=5)
    db.isolation_level = None
    return db


def _hist(db: sqlite3.Connection, po_no: str, before: str, after: str) -> None:
    seq = (db.execute("SELECT COALESCE(MAX(HIST_SEQ), 0) FROM TB_PO_HIST").fetchone()[0] or 0) + 1
    db.execute("INSERT INTO TB_PO_HIST (HIST_SEQ, PO_NO, CHG_DT, CHG_ID, BEF_STTS_CD, AFT_STTS_CD) VALUES (?, ?, ?, ?, ?, ?)", (seq, po_no, time.strftime("%Y-%m-%d %H:%M:%S"), APPROVER, before, after))


def approve(po_no: str, result: str) -> str:
    """발주 승인. po.db 에 그 발주가 있으면 po.db 의 상태로 판정한다(승인대기(20)면 승인(30)). 없으면 레거시의 판정(result)을 그대로 쓴다.
    시연 DB 의 값이 온톨로지가 읽는 값이라, 둘이 어긋나는 발주(레거시 메모리와 po.db 의 상태가 다른 것)는 po.db 를 기준으로 삼는다."""
    db = _open()
    if db is None:
        return result
    try:
        row = db.execute("SELECT PO_STTS_CD FROM TB_PO_MST WHERE PO_NO = ? AND DEL_YN = 'N'", (po_no,)).fetchone()
        if row is None:
            return result
        if row[0] != "20":
            return "state"
        db.execute("BEGIN IMMEDIATE")
        db.execute("UPDATE TB_PO_MST SET PO_STTS_CD = '30' WHERE PO_NO = ?", (po_no,))
        _hist(db, po_no, "20", "30")
        db.execute("COMMIT")
        return "ok"
    finally:
        db.close()


def close_pr(pr_no: str, result: str) -> str:
    """구매요청 마감(40). po.db 에 그 요청이 있으면 po.db 의 상태로 판정한다: 요청(10)이나 승인(20) 상태만 마감할 수 있다."""
    db = _open()
    if db is None:
        return result
    try:
        row = db.execute("SELECT PR_STTS_CD FROM TB_PR_MST WHERE PR_NO = ?", (pr_no,)).fetchone()
        if row is None:
            return result
        if row[0] not in ("10", "20"):
            return "state"
        db.execute("UPDATE TB_PR_MST SET PR_STTS_CD = '40' WHERE PR_NO = ?", (pr_no,))
        return "ok"
    finally:
        db.close()


def add_po(po) -> None:
    """레거시가 새 발주를 작성 상태로 넣었다. po.db 에도 같은 발주를 넣는다."""
    db = _open()
    if db is None:
        return
    try:
        if db.execute("SELECT 1 FROM TB_PO_MST WHERE PO_NO = ?", (po.po_no,)).fetchone():
            return
        db.execute("BEGIN IMMEDIATE")
        db.execute("INSERT INTO TB_PO_MST (PO_NO, PO_YMD, VEND_CD, PO_AMT, PO_STTS_CD, DLV_YMD, CHRG_EMP_NO, PR_NO, RMK, REG_DT, REG_ID, APPR_LINE_XML, DEL_YN) "
                   "VALUES (?, ?, ?, ?, '10', NULL, NULL, NULL, ?, ?, ?, NULL, 'N')",
                   (po.po_no, po.ymd, po.vend_cd, po.amount, "이음 액션으로 등록", time.strftime("%Y-%m-%d %H:%M:%S"), APPROVER))
        for i, (cd, _nm, qty, price) in enumerate(po.items, 1):
            db.execute("INSERT INTO TB_PO_DTL (PO_NO, SEQ, ITEM_CD, QTY, UNIT_PRC) VALUES (?, ?, ?, ?, ?)", (po.po_no, i, cd, qty, price))
        db.execute("COMMIT")
    finally:
        db.close()


def install() -> None:
    hooks.register("approve", approve)
    hooks.register("close_pr", close_pr)
    hooks.register("add_po", add_po)

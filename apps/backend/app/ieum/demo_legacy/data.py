"""시연용 레거시 구매관리 사이트의 초기 데이터와 환경별 메모리 DB.

2000년대 후반 전자정부 프레임워크 앱이 흔히 내는 모양을 일부러 따른다. 필드명은 대문자
스네이크, 금액은 천 단위 쉼표가 있는 문자열, 날짜는 YYYYMMDD 문자열, 상태는 코드 문자열이다.
담당자 연락처와 사업자번호는 이음의 개인정보 마스킹을 시험하려고 넣었다. 전부 가짜 값이다.
"""
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# 새 발주의 발주일. 시계를 쓰면 시연한 날짜에 따라 조회 결과가 달라져, 날짜는 고정한다.
NEW_PO_YMD = "20261004"
NEW_PO_PREFIX = "PO-2610-"
NEW_PR_PREFIX = "PR-2610-"

# (거래처코드, 상호, 사업자번호, 전화, 담당자, 담당자 휴대폰, 담당자 이메일)
VENDORS = [
    ("V0007", "대한문구", "234-56-78901", "031-345-6789", "이서연", "010-7312-9984", "seoyeon.lee@daehan.local"),
    ("V0012", "한빛상사", "123-45-67890", "02-555-0123", "홍길동", "010-4821-5678", "gildong.hong@hanbit.local"),
    ("V0015", "서울오피스", "345-67-89012", "02-2233-4455", "박지훈", "010-2208-3141", "jihun.park@seoul-office.local"),
    ("V0021", "한빛정보통신", "456-78-90123", "02-6677-8899", "최민수", "010-3345-7788", "minsu.choi@hanbit-ict.local"),
    ("V0033", "동양사무기기", "567-89-01234", "042-482-1234", "정하윤", "010-9087-6543", "hayun.jung@dongyang.local"),
]

# (품목코드, 품목명, 단가, 주거래처)
ITEMS = [
    ("P-10023", "A4 복사용지 80g", 12500, "V0012"),
    ("P-10031", "중성펜 0.5mm 12입", 6800, "V0007"),
    ("P-10107", "라벨지 A4 100매", 9900, "V0007"),
    ("P-20015", "토너 카트리지(흑백)", 80000, "V0012"),
    ("P-20042", "27인치 모니터", 250000, "V0012"),
    ("P-30008", "사무용 의자", 160000, "V0015"),
]

# (발주번호, 거래처코드, 발주일, 상태, 결제조건, [(품목코드, 수량)]). 단가는 품목 마스터를 따른다.
PURCHASE_ORDERS = [
    ("PO-2609-0142", "V0012", "20260926", "20", "30", [("P-10023", 20), ("P-20042", 12), ("P-20015", 20)]),
    ("PO-2609-0138", "V0007", "20260922", "30", "30", [("P-10031", 50), ("P-10107", 30)]),
    ("PO-2609-0136", "V0015", "20260921", "20", "60", [("P-30008", 15)]),
    ("PO-2609-0131", "V0015", "20260918", "10", "30", [("P-30008", 5)]),
    ("PO-2609-0127", "V0012", "20260915", "30", "10", [("P-10023", 100)]),
    ("PO-2609-0119", "V0021", "20260910", "90", "30", [("P-20015", 10)]),
    ("PO-2608-0187", "V0007", "20260828", "30", "30", [("P-10031", 100)]),
    ("PO-2608-0164", "V0033", "20260811", "30", "60", [("P-10107", 50)]),
]

# (요청번호, 제목, 요청자, 상태, 부서코드)
PURCHASE_REQUESTS = [
    ("PR-2609-0088", "10월 사무용품 구매", "홍길동", "10", "D1030"),
    ("PR-2609-0091", "회의실 모니터 교체", "김하늘", "10", "D1030"),
    ("PR-2609-0079", "노트북 거치대 구매", "박지훈", "20", "D1030"),
    ("PR-2609-0066", "탕비실 비품 보충", "최유진", "30", "D1030"),
    ("PR-2609-0095", "영업 판촉물 제작", "이서연", "10", "D2010"),
    ("PR-2609-0097", "복합기 토너 구매", "정민호", "10", "D4010"),
]

# (부서코드, 연도) -> (예산, 사용액)
BUDGETS = {
    ("D1030", "2026"): (20000000, 11450000),
    ("D1030", "2025"): (18000000, 17620000),
    ("D2010", "2026"): (35000000, 21300000),
    ("D4010", "2026"): (50000000, 38900000),
}

CODES = {
    "PO_STTS": [("10", "작성"), ("20", "승인대기"), ("30", "승인"), ("90", "취소")],
    "PR_STTS": [("10", "요청"), ("20", "승인"), ("30", "발주 완료")],
    "PAY_TERM": [("10", "현금"), ("30", "30일"), ("60", "60일")],
}

# 월별 발주 건수. 공통 모듈이 내는 통계라 발주 목록과 따로 고정해 둔다.
MONTHLY = {
    "2025": [35, 33, 44, 41, 48, 52, 50, 46, 57, 60, 54, 63],
    "2026": [42, 38, 51, 47, 55, 61, 58, 49, 66, 9, 0, 0],
}

VENDOR_BY_CD = {v[0]: v for v in VENDORS}
ITEM_BY_CD = {i[0]: i for i in ITEMS}
_DIGITS = re.compile(r"[0-9]+")


def won(n: int) -> str:
    """천 단위 쉼표가 있는 문자열. 레거시 시스템은 금액과 수량을 이렇게 문자열로 내보낸다."""
    return "{:,}".format(n)


def to_int(text: str) -> Optional[int]:
    """'12,500' 같은 입력을 정수로. 숫자가 아니면 None."""
    s = (text or "").replace(",", "").strip()
    return int(s) if _DIGITS.fullmatch(s) else None


@dataclass
class Po:
    po_no: str
    vend_cd: str
    vend_nm: str
    stts: str
    ymd: str
    charger: Tuple[str, str, str]  # 이름, 휴대폰, 이메일
    pay_term: str
    items: List[Tuple[str, str, int, int]]  # 품목코드, 품목명, 수량, 단가

    @property
    def amount(self) -> int:
        return sum(qty * price for _, _, qty, price in self.items)


def _build_po(po_no, vend_cd, ymd, stts, pay_term, lines) -> Po:
    vend = VENDOR_BY_CD[vend_cd]
    items = [(cd, ITEM_BY_CD[cd][1], qty, ITEM_BY_CD[cd][2]) for cd, qty in lines]
    return Po(po_no, vend_cd, vend[1], stts, ymd, (vend[4], vend[5], vend[6]), pay_term, items)


def po_row(po: Po) -> Dict[str, str]:
    """발주 목록의 한 행. 금액은 쉼표 문자열, 날짜는 YYYYMMDD, 상태는 코드다."""
    return {
        "PO_NO": po.po_no, "VEND_CD": po.vend_cd, "VEND_NM": po.vend_nm, "PO_AMT": won(po.amount),
        "PO_STTS_CD": po.stts, "PO_YMD": po.ymd,
        "CHARGER_NM": po.charger[0], "CHARGER_TEL": po.charger[1], "CHARGER_EML": po.charger[2],
    }


def po_detail(po: Po) -> dict:
    row = po_row(po)
    row["PAY_TERM"] = po.pay_term
    row["ITEMS"] = [{"ITEM_CD": cd, "ITEM_NM": nm, "QTY": str(qty), "UNIT_PRICE": won(price)} for cd, nm, qty, price in po.items]
    return row


def vendor_row(v: tuple) -> Dict[str, str]:
    return {"VEND_CD": v[0], "VEND_NM": v[1], "BIZ_NO": v[2], "TEL": v[3]}


class LegacyDb:
    """환경 하나의 메모리 DB. 운영(op)과 스테이징(stg)이 각자 하나씩 가진다.

    바뀌는 것은 발주 목록, 발주 일련번호, 구매요청 번호, 임시저장 초안뿐이다.
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.pos = [_build_po(no, vend, ymd, stts, term, lines) for no, vend, ymd, stts, term, lines in PURCHASE_ORDERS]
        self.po_seq = 0
        self.pr_seq = 0
        self.draft = None  # type: Optional[Dict[str, str]]

    def list_pos(self, from_dt: str, to_dt: str, vend_cd: str, stts_cd: str) -> List[Po]:
        """조건은 빈 값이면 걸지 않는다. 최근 발주가 먼저 온다."""
        rows = [p for p in self.pos
                if (not from_dt or p.ymd >= from_dt) and (not to_dt or p.ymd <= to_dt)
                and (not vend_cd or p.vend_cd == vend_cd) and (not stts_cd or p.stts == stts_cd)]
        return sorted(rows, key=lambda p: (p.ymd, p.po_no), reverse=True)

    def find_po(self, po_no: str) -> Optional[Po]:
        return next((p for p in self.pos if p.po_no == po_no), None)

    def add_po(self, vend_cd: str, item_cd: str, qty: int, unit_price: int, pay_term: str) -> Po:
        """새 발주를 '작성' 상태로 넣는다. 마스터에 없는 코드는 코드를 이름 대신 쓴다."""
        self.po_seq += 1
        vend, item = VENDOR_BY_CD.get(vend_cd), ITEM_BY_CD.get(item_cd)
        po = Po("%s%04d" % (NEW_PO_PREFIX, self.po_seq), vend_cd, vend[1] if vend else vend_cd, "10", NEW_PO_YMD,
                (vend[4], vend[5], vend[6]) if vend else ("", "", ""), pay_term,
                [(item_cd, item[1] if item else item_cd, qty, unit_price)])
        self.pos.append(po)
        return po

    def approve(self, po_no: str) -> str:
        """승인대기(20) 발주만 승인(30)으로 바꾼다. 'ok' | 'none'(없음) | 'state'(상태가 맞지 않음)."""
        po = self.find_po(po_no)
        if po is None:
            return "none"
        if po.stts != "20":
            return "state"
        po.stts = "30"
        return "ok"

    def next_pr_no(self) -> str:
        return "%s%04d" % (NEW_PR_PREFIX, self.pr_seq + 1)


def search_vendors(name: str) -> List[Dict[str, str]]:
    """상호 부분 일치. 빈 값이면 전체."""
    name = (name or "").strip()
    return [vendor_row(v) for v in VENDORS if name in v[1]]


def list_prs(dept_cd: str, stts_cd: str) -> List[Dict[str, str]]:
    return [{"PR_NO": no, "PR_TITLE": title, "REQ_NM": req, "PR_STTS_CD": stts, "DEPT_CD": dept}
            for no, title, req, stts, dept in PURCHASE_REQUESTS
            if (not dept_cd or dept == dept_cd) and (not stts_cd or stts == stts_cd)]


def budget(dept_cd: str, yyyy: str) -> Optional[Dict[str, str]]:
    found = BUDGETS.get((dept_cd, yyyy))
    if found is None:
        return None
    total, used = found
    return {"DEPT_CD": dept_cd, "YYYY": yyyy, "BUDGET_AMT": won(total), "USED_AMT": won(used), "REMAIN_AMT": won(total - used)}


def monthly(yyyy: str) -> List[Dict[str, str]]:
    counts = MONTHLY.get(yyyy, [0] * 12)
    return [{"MM": "%02d" % (i + 1), "CNT": str(n)} for i, n in enumerate(counts)]


def codes(grp_cd: str) -> List[Dict[str, str]]:
    return [{"CD": cd, "CD_NM": nm} for cd, nm in CODES.get(grp_cd, [])]

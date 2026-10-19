"""이름 사전: 컬럼·테이블 이름에서 표시 이름과 API 이름을 짓고, 값을 가리고, 날짜·금액 값을 읽기 좋게 바꾼다.

레거시 DB 의 이름은 약어다(PO_AMT, CHRG_EMP_NO). 이 모듈은 세 단계로 이름을 정한다.
  1. (테이블, 컬럼) 또는 컬럼 이름 전체가 사전에 있으면 그대로 쓴다(EXACT_T, EXACT).
  2. 없으면 `_` 로 나눈 약어 토큰을 하나씩 풀어 이어 붙인다(TOKENS). 역할 약어(CHRG, REQ, INSP)가 사번 앞에 오면 "담당자 사번" 처럼 읽는다.
  3. 토큰도 모르면 그 토큰을 그대로 둔다 — 지어내지 않는다. 사용자가 화면에서 고친다.
규칙은 전부 여기 있고 LLM 을 부르지 않는다. 같은 DB 는 늘 같은 이름이 나온다.
"""
import re
from typing import Dict, List, Optional, Tuple

# ── 약어 사전 ──────────────────────────────────────────────────────────────

TOKENS: Dict[str, Tuple[str, str]] = {          # 약어 -> (한글, 영문)
    "NO": ("번호", "number"), "CD": ("코드", "code"), "NM": ("명", "name"), "YMD": ("일", "date"), "DT": ("일시", "at"), "TM": ("시각", "time"),
    "YM": ("연월", "yearMonth"), "YYYY": ("연도", "year"), "AMT": ("금액", "amount"), "QTY": ("수량", "quantity"), "PRC": ("단가", "price"),
    "CNT": ("건수", "count"), "SUM": ("합계", "sum"), "RATE": ("비율", "rate"), "YN": ("여부", "flag"), "STTS": ("상태", "status"), "TP": ("구분", "type"),
    "TYPE": ("구분", "type"), "SEQ": ("순번", "seq"), "RMK": ("비고", "remark"), "ADDR": ("주소", "address"), "TEL": ("연락처", "phone"),
    "TELNO": ("연락처", "phone"), "EML": ("이메일", "email"), "EMAIL": ("이메일", "email"), "ID": ("ID", "id"), "TITLE": ("제목", "title"),
    "DESC": ("설명", "description"), "GRP": ("그룹", "group"), "UNIT": ("단위", "unit"), "STD": ("기준", "standard"), "USE": ("사용", "use"), "REG": ("등록", "created"),
    "UPD": ("수정", "updated"), "CHG": ("변경", "changed"), "DEL": ("삭제", "deleted"), "BEF": ("변경 전", "before"), "AFT": ("변경 후", "after"), "VAL": ("값", "value"),
    "MST": ("", ""), "DTL": ("상세", "detail"), "INFO": ("", ""), "HIST": ("이력", "history"), "LOG": ("로그", "log"), "TB": ("", ""), "T": ("", ""), "V": ("", ""),
    "PO": ("발주", "po"), "PR": ("구매요청", "request"), "VEND": ("거래처", "vendor"), "ITEM": ("품목", "item"), "DEPT": ("부서", "department"), "EMP": ("직원", "employee"),
    "BDGT": ("예산", "budget"), "WH": ("창고", "warehouse"), "RCV": ("입고", "receipt"), "SLIP": ("전표", "voucher"), "ACCT": ("계정", "account"), "CUST": ("거래처", "customer"),
    "BIZ": ("사업자", "business"), "CEO": ("대표자", "ceo"), "DLV": ("납기", "delivery"), "CHRG": ("담당", "owner"), "REQ": ("요청", "request"), "INSP": ("검수", "inspector"),
    "APPR": ("결재", "approval"), "LINE": ("선", "line"), "TRD": ("거래", "trade"), "ORD": ("정렬", "order"), "SORT": ("정렬", "sort"), "UPPER": ("상위", "parent"),
    "JBGD": ("직급", "position"), "RSGNTN": ("퇴직", "resigned"), "JOIN": ("입사", "joined"), "ATND": ("근태", "attendance"), "DAY": ("일별", "daily"),
    "IN": ("출근", "in"), "OUT": ("퇴근", "out"), "DR": ("차변", "debit"), "CR": ("대변", "credit"), "REF": ("관련", "ref"), "SUMRY": ("적요", "summary"), "CMN": ("공통", "common"),
    "CODE": ("코드", "code"), "XML": ("XML", "xml"), "RANK": ("서열", "rank"), "MAIN": ("대표", "main"), "TOT": ("총", "total"), "TOTAL": ("합계", "total"),
}
KO_NO_SPACE = {"YMD", "NM"}          # 앞 낱말에 붙여 쓰는 한글("발주" + "일" = "발주일", "거래처" + "명")

ROLES: Dict[str, Tuple[str, str, str, str]] = {  # 역할 약어 -> (한글 사람 이름, 영문 링크 이름, 영문 역방향 접두어, 한글 역방향 접두어)
    "CHRG": ("담당자", "owner", "owned", "담당 "), "REQ": ("요청자", "requester", "requested", "요청한 "), "INSP": ("검수자", "inspector", "inspected", "검수한 "),
}

# 컬럼 이름 전체가 같을 때(테이블과 무관)
EXACT: Dict[str, Tuple[str, str]] = {
    "PO_NO": ("발주번호", "poNumber"), "PR_NO": ("구매요청 번호", "requestNumber"), "RCV_NO": ("입고번호", "receiptNumber"), "SLIP_NO": ("전표번호", "voucherNumber"),
    "PO_YMD": ("발주일", "orderDate"), "DLV_YMD": ("납기일", "deliveryDate"), "REQ_YMD": ("요청일", "requestDate"), "RCV_YMD": ("입고일", "receiptDate"),
    "SLIP_YMD": ("전표일", "voucherDate"), "PO_AMT": ("발주 금액", "amount"), "PO_STTS_CD": ("진행 상태", "status"), "PR_STTS_CD": ("진행 상태", "status"),
    "RCV_STTS_CD": ("검수 상태", "status"), "TRD_STTS_CD": ("거래 상태", "status"), "ATND_STTS_CD": ("근태 상태", "status"),
    "VEND_CD": ("거래처 코드", "vendorCode"), "VEND_NM": ("거래처명", "name"), "ITEM_CD": ("품목 코드", "itemCode"), "ITEM_NM": ("품목명", "name"),
    "ITEM_GRP_CD": ("품목군", "group"), "STD_PRC": ("기준 단가", "standardPrice"), "UNIT_PRC": ("단가", "unitPrice"), "QTY": ("수량", "quantity"), "SEQ": ("순번", "lineNo"),
    "DEPT_CD": ("부서 코드", "departmentCode"), "DEPT_NM": ("부서명", "name"), "UPPER_DEPT_CD": ("상위 부서 코드", "parentCode"),
    "EMP_NO": ("사번", "employeeId"), "EMP_NM": ("이름", "name"), "JBGD_NM": ("직급", "position"), "EML_ADDR": ("이메일", "email"), "RSGNTN_YN": ("퇴직 여부", ""),
    "CHRG_EMP_NO": ("담당자 사번", "ownerEmployeeId"), "REQ_EMP_NO": ("요청자 사번", "requesterId"), "INSP_EMP_NO": ("검수자 사번", "inspectorId"),
    "BIZ_NO": ("사업자번호", "businessNumber"), "CEO_NM": ("대표자", "ceoName"), "CHRG_TELNO": ("담당자 연락처", "contactPhone"), "ADDR": ("주소", "address"),
    "RMK": ("비고", "remark"), "REG_DT": ("등록 일시", "createdAt"), "REG_ID": ("등록자 ID", ""), "APPR_LINE_XML": ("결재선 원문", ""), "DEL_YN": ("삭제 여부", ""),
    "PR_TITLE": ("제목", "title"), "WH_CD": ("창고 코드", "warehouseCode"), "WH_NM": ("창고명", "name"), "WH_ADDR": ("주소", "address"), "USE_YN": ("사용 여부", "active"),
    "RCV_QTY_SUM": ("입고 수량 합계", "totalQuantity"), "YYYY": ("회계 연도", "fiscalYear"), "BDGT_AMT": ("예산", "budget"), "USE_AMT": ("사용액", "used"),
    "REMAIN_AMT": ("잔액", "remaining"), "USE_RATE": ("집행률 (%)", "usageRate"), "AVG_PRC": ("평균 단가", "avgPrice"), "MIN_PRC": ("최저 단가", "minPrice"),
    "MAX_PRC": ("최고 단가", "maxPrice"), "YM": ("연월", "yearMonth"), "PO_CNT": ("발주 건수", "orderCount"), "PO_AMT_SUM": ("발주 금액 합계", "totalAmount"),
    "PENDING_CNT": ("승인 대기 건수", "pendingCount"), "PENDING_AMT": ("승인 대기 금액", "pendingAmount"), "OLDEST_YMD": ("가장 오래된 발주일", "oldestOrderDate"),
    "ACCT_CD": ("계정 코드", "accountCode"), "ACCT_NM": ("계정명", "name"), "ACCT_TP": ("계정 구분", "type"), "CUST_BIZ_NO": ("거래처 사업자번호", "vendorBusinessNumber"),
    "REF_PO_NO": ("관련 발주번호", "poNumber"), "DR_AMT": ("차변 금액", "debit"), "CR_AMT": ("대변 금액", "credit"), "SUMRY": ("적요", "summary"),
    "CUST_NO": ("고객 번호", "customerNumber"), "CUST_NM": ("거래처명", "name"), "JOIN_YMD": ("입사일", "joinDate"), "ATND_YMD": ("근태일", "attendanceDate"),
    "SORT_NO": ("정렬 번호", "sortNo"), "GRP_CD": ("그룹 코드", "groupCode"), "CD": ("코드", "code"), "CD_NM": ("코드명", "name"),
}
# (테이블, 컬럼)이 같을 때: 같은 컬럼 이름이어도 테이블에 따라 뜻이 다르다
EXACT_T: Dict[Tuple[str, str], Tuple[str, str]] = {
    ("TB_PR_MST", "DEPT_CD"): ("요청 부서 코드", "departmentCode"), ("TB_BDGT", "DEPT_CD"): ("부서 코드", "departmentCode"),
    ("TB_PO_DTL", "PO_NO"): ("발주번호", "poNumber"), ("TB_RCV_MST", "VEND_CD"): ("거래처 코드", "vendorCode"),
}

# 테이블: 접두어(TB_, T_, V_)와 접미어(_MST, _INFO)를 뗀 이름 -> (한글, 영문). 사전에 없으면 토큰으로 짓는다.
TABLE_EXACT: Dict[str, Tuple[str, str]] = {
    "PO": ("발주", "PurchaseOrder"), "PO_DTL": ("발주 품목", "PurchaseOrderLine"), "VEND": ("거래처", "Vendor"), "ITEM": ("품목", "Item"), "PR": ("구매요청", "PurchaseRequest"),
    "BDGT": ("예산", "Budget"), "RCV": ("입고", "GoodsReceipt"), "WH": ("창고", "Warehouse"), "EMP": ("직원", "Employee"), "DEPT": ("부서", "Department"),
    "SLIP": ("전표", "Voucher"), "ACCT_CD": ("계정과목", "Account"), "CUST": ("고객", "Customer"), "RCV_DTL": ("입고 상세", "GoodsReceiptLine"), "SLIP_DTL": ("전표 상세", "VoucherLine"),
}

# 링크 이름: 객체 이름으로 만들되, 사번 같은 사람 링크는 역할 이름을 쓴다(담당자, 요청자, 검수자)
CODE_TABLE_COLS = ({"GRP_CD", "CD"}, {"GROUP_CD", "CODE"}, {"GRP_CD", "CODE"})       # 이 두 컬럼이 키인 테이블은 공통코드 표다

# ── 이름 짓기 ──────────────────────────────────────────────────────────────


def camel(snake: str) -> str:
    """USE_RATE -> useRate, po_cnt -> poCnt"""
    parts = [p for p in re.split(r"[_\W]+", snake) if p]
    return "".join((p.lower() if i == 0 else p[:1].upper() + p[1:].lower()) for i, p in enumerate(parts))


def pascal(snake: str) -> str:
    s = camel(snake)
    return s[:1].upper() + s[1:]


def snake_of(api: str) -> str:
    """PurchaseOrder -> purchase_order (도구 이름용)"""
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", api).lower()


def _tokens(col: str) -> List[str]:
    return [t for t in re.split(r"[_\s]+", col.upper()) if t]


def _ko_join(toks: List[str]) -> str:
    out = ""
    for t in toks:
        ko = TOKENS[t][0] if t in TOKENS else t
        if not ko:
            continue
        out += ko if (out and t in KO_NO_SPACE) else ((" " if out else "") + ko)
    return out


def _en_words(toks: List[str]) -> List[str]:
    return [(TOKENS[t][1] if t in TOKENS else t.lower()) for t in toks if not (t in TOKENS and not TOKENS[t][1])]


def col_names(table: str, col: str) -> Tuple[str, str]:
    """(표시 이름, API 이름). API 이름이 빈 문자열이면 AI 에 내보내지 않는 컬럼(비공개, 객체 필터)이다."""
    up = col.upper()
    if (table.upper(), up) in EXACT_T:
        return EXACT_T[(table.upper(), up)]
    if up in EXACT:
        return EXACT[up]
    toks = _tokens(up)
    if len(toks) >= 3 and toks[0] in ROLES and toks[-2:] == ["EMP", "NO"]:
        return ROLES[toks[0]][0] + " 사번", ROLES[toks[0]][1] + "EmployeeId"
    en = ""
    for w in _en_words(toks):
        en += w if not en else w[:1].upper() + w[1:]
    return _ko_join(toks) or col, en or camel(col)


def mart_col_names(col: str) -> Tuple[str, str]:
    """마트 컬럼의 (표시 이름, API 이름). 테이블 컬럼과 달리 이름 컬럼이 엔터티 접두를 유지한다(VEND_NM -> vendorName)."""
    ko, en = col_names("", col)
    if en == "name":
        toks = _tokens(col)
        en = "".join((w if i == 0 else w[:1].upper() + w[1:]) for i, w in enumerate(_en_words(toks))) or camel(col)
    return ko, en


def table_names(table: str) -> Tuple[str, str]:
    """(한글 이름, 영문 API 이름)"""
    core = re.sub(r"^(TB|T|V)_", "", table.upper())
    for key in (core, re.sub(r"_(MST|INFO|VW)$", "", core)):
        if key in TABLE_EXACT:
            return TABLE_EXACT[key]
    toks = [t for t in _tokens(re.sub(r"_(MST|INFO|VW)$", "", core))]
    en = "".join(w[:1].upper() + w[1:] for w in _en_words(toks))
    return _ko_join(toks) or table, en or pascal(table)


def role_of(col: str) -> Optional[Tuple[str, str, str, str]]:
    """CHRG_EMP_NO -> ('담당자', 'owner', 'owned', '담당 '). 역할이 없으면 None"""
    toks = _tokens(col)
    return ROLES.get(toks[0]) if toks and toks[0] in ROLES and len(toks) >= 2 else None


def plural(api: str) -> str:
    """영문 API 이름의 복수형: PurchaseOrder -> purchaseOrders, Category -> categories"""
    w = api[:1].lower() + api[1:]
    if re.search(r"[^aeiou]y$", w):
        return w[:-1] + "ies"
    if re.search(r"(s|x|ch|sh)$", w):
        return w + "es"
    return w + "s"


def jo(word: str, a: str, b: str) -> str:
    """한글 조사: 받침이 있으면 a, 없으면 b (을/를, 은/는, 이/가)"""
    if not word:
        return word
    c = ord(word[-1])
    return word + (a if 0xAC00 <= c <= 0xD7A3 and (c - 0xAC00) % 28 else b)


def ro(word: str) -> str:
    """'으로/로' 조사까지 붙인 말: 받침이 없거나 ㄹ 받침이면 로, 그 밖이면 으로"""
    if not word:
        return word
    c = ord(word[-1])
    return word + ("로" if not (0xAC00 <= c <= 0xD7A3) or (c - 0xAC00) % 28 in (0, 8) else "으로")


# ── 값을 읽기 좋게, 또는 가리기 ─────────────────────────────────────────────

_DATE8 = re.compile(r"^(\d{4})(\d{2})(\d{2})$")
_PHONE = re.compile(r"^(0\d{1,2})[-. ]?(\d{3,4})[-. ]?(\d{4})$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_RRN = re.compile(r"^(\d{6})-?([1-4]\d{6})$")
_BIZ = re.compile(r"^(\d{3})-?(\d{2})-?(\d{5})$")

MASK_KINDS = {"phone": "가운데 자리를 가림", "email": "아이디 일부를 가림", "rrn": "뒤 7자리를 가림", "biz": "뒤 5자리를 가림", "generic": "첫 글자만 보임"}


def mask_value(kind: str, v) -> object:
    """값을 가린다. 형식이 맞지 않으면 첫 글자만 남기고 가린다. None 과 빈 문자열은 그대로 둔다."""
    if v is None or v == "":
        return v
    s = str(v).strip()
    if kind == "phone":
        m = _PHONE.match(s)
        if m:
            return "%s-%s-%s" % (m.group(1), "*" * len(m.group(2)), m.group(3))
    elif kind == "email":
        if _EMAIL.match(s):
            local, dom = s.split("@", 1)
            head, dot, tail = local.partition(".")
            return "%s%s%s@%s" % (head[:1], "*" * max(len(head) - 1, 1), (dot + tail) if dot else "", dom)
    elif kind == "rrn":
        m = _RRN.match(s)
        if m:
            return "%s-%s" % (m.group(1), "*" * 7)
    elif kind == "biz":
        m = _BIZ.match(s)
        if m:
            return "%s-%s-*****" % (m.group(1), m.group(2))
    return s[:1] + "*" * max(len(s) - 1, 1)


def mask_name_kind(col: str) -> Optional[Tuple[str, bool]]:
    """컬럼 이름으로 마스킹 종류를 정한다. (종류, 개인정보 여부) 또는 None"""
    toks = set(_tokens(col))
    up = col.upper()
    if toks & {"TELNO", "TEL", "PHONE", "MOBILE", "HP", "CELL", "MBL"} or "TELNO" in up:
        return "phone", True
    if toks & {"EML", "EMAIL", "MAIL"} or "EMAIL" in up:
        return "email", True
    if toks & {"JUMIN", "RRN", "SSN"} or "RESIDENT" in up:
        return "rrn", True
    if "BIZ_NO" in up or "BIZNO" in up or "BRNO" in up:
        return "biz", False
    if toks & {"CARD", "ACNT"} and "NO" in toks:
        return "generic", True
    return None


def mask_value_kind(values: List[str]) -> Optional[Tuple[str, bool]]:
    """값 모양으로 마스킹 종류를 정한다. 표본의 60% 이상이 같은 모양이어야 한다."""
    vals = [str(v).strip() for v in values if v not in (None, "")]
    if len(vals) < 3:
        return None
    for kind, rx, pii in (("phone", _PHONE, True), ("email", _EMAIL, True), ("rrn", _RRN, True)):
        if sum(1 for v in vals if rx.match(v)) >= max(3, len(vals) * 0.6):
            return kind, pii
    return None


def fmt_date8(v) -> str:
    m = _DATE8.match(str(v).strip()) if v is not None else None
    if m:
        return "%s-%s-%s" % m.groups()
    return "" if v is None else str(v)


def is_date8(v) -> bool:
    m = _DATE8.match(str(v).strip()) if v is not None else None
    if not m:
        return False
    y, mo, d = (int(x) for x in m.groups())
    return 1900 <= y <= 2200 and 1 <= mo <= 12 and 1 <= d <= 31


def fmt_ts(v) -> str:
    """타임스탬프를 '2026-09-26 10:12' 로(초 아래는 자른다)."""
    s = "" if v is None else str(v)
    return s[:16].replace("T", " ")


def fmt_num(v) -> str:
    """천 단위 쉼표. 정수로 떨어지면 정수로."""
    if v is None or v == "":
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    if f == int(f):
        return "{:,}".format(int(f))
    return "{:,.2f}".format(f).rstrip("0").rstrip(".")


def parse_ctype(ctype: str) -> Tuple[str, Optional[int], Optional[int]]:
    """'NUMBER(15,2)' -> ('NUMBER', 15, 2)"""
    m = re.match(r"^\s*([A-Za-z_ ]+?)\s*(?:\(\s*(\d+)\s*(?:,\s*(-?\d+))?\s*\))?\s*$", ctype or "")
    if not m:
        return (ctype or "").upper(), None, None
    return m.group(1).upper().strip(), int(m.group(2)) if m.group(2) else None, int(m.group(3)) if m.group(3) else None

"""가상조달기관 레거시 3종(CTLG·DHGW·FINL)의 단일 카탈로그.

라우트(common/routes.py)와 명세 생성기(assets/make_assets.py)가 모두 이 파일을 본다.
op 이름 = 변환 후 MCP 도구 이름이다. 바꾸면 make_assets.py 를 다시 돌린다.

필드 이름 규칙 — 시스템의 '시대'를 드러낸다.
  CTLG(2009, 전자정부 프레임워크풍) : 대문자 스네이크(PRDCT_IDNT_NO), resultList/totCnt 봉투, pageIndex 페이징
  DHGW(신형 연계 게이트웨이)        : 조달청 공개 오픈API 의 필드명 규칙(bidNtceNo 등), response/header/body 봉투
  FINL(2015, 재정 연계 인터페이스)  : 대문자 스네이크, RESULT_CODE/DATA 봉투, 금액은 천 단위 쉼표 문자열
DHGW 필드명은 공개 활용가이드와 대조한다(db/check_fields.py). 대조 결과는 docs/FACT-CHECK.md.

[매설 결함 — 고치지 말 것] FINL selectPymntSttus 의 정의서(xlsx)에는 ACNT_DIV_CD(회계구분코드, 필수)가 있지만
실제 응답에는 없다. 레거시 DB 에는 값이 있다. 정의서와 실물이 다른 상황을 호출 검증이 잡아내는 것이 시연 포인트다.
"""
from legacy_pps.common.seed import DATA

D = DATA


def _like(v, q):
    return not q or q in (v or "")


def _between(v, lo, hi):
    return (not lo or v >= lo) and (not hi or v <= hi)


def _need(params, *keys):
    for k in keys:
        if not params.get(k):
            raise ValueError(f"필수 파라미터 {k} 가 없습니다")


# ── CTLG 목록정보 관리 ────────────────────────────────────────────────
def _paging_egov(rows, p):
    try:
        size = max(1, min(int(p.get("recordCountPerPage") or 10), 100))
        idx = max(1, int(p.get("pageIndex") or 1))
    except ValueError:
        raise ValueError("페이지 값은 숫자여야 합니다")
    return rows[(idx - 1) * size: idx * size], len(rows)


def q_clsfc_list(p):
    seen, rows = set(), []
    for x in D["prdct"]:
        if x["dtl_no"] in seen:
            continue
        if _like(x["dtl_no"], p.get("PRDCT_CLSFC_NO")) and _like(x["dtl_nm"], p.get("DTL_PRDCT_CLSFC_NM")):
            seen.add(x["dtl_no"])
            rows.append(dict(x, seg=x["clsfc_no"][:2], fam=x["clsfc_no"][:4], cls=x["clsfc_no"][:6]))
    return _paging_egov(rows, p)


def q_idnt_list(p):
    rows = [x for x in D["prdct"] if _like(x["dtl_no"], p.get("DTL_PRDCT_CLSFC_NO")) and _like(x["maker_nm"], p.get("MAKER_NM"))]
    return _paging_egov(rows, p)


def q_idnt_dtl(p):
    _need(p, "PRDCT_IDNT_NO")
    rows = [x for x in D["prdct"] if x["idnt_no"] == p["PRDCT_IDNT_NO"]]
    return rows, len(rows)


def q_entrps_list(p):
    rows = [x for x in D["entrps"] if _like(x["corp_nm"], p.get("CORP_NM")) and _like(x["bizno"], p.get("BIZRNO"))]
    return _paging_egov(rows, p)


# ── DHGW 조달데이터 연계 게이트웨이 ─────────────────────────────────────
# 조달청 공개 오픈API 활용가이드(입찰공고 1.2 · 낙찰 1.2 · 계약 1.0 · 쇼핑몰 1.3)의 파라미터·코드 체계를 따른다.
#   inqryDiv  입찰공고 1 등록일시 2 입찰공고번호 3 변경일시 / 낙찰 1 등록일시 2 공고일시 3 개찰일시 4 입찰공고번호 / 계약 1 등록일시 2 통합계약번호
#   오류      03 No Data · 06 날짜 Format 에러 · 07 입력범위 초과 · 08 필수값 누락
def _paging_open(rows, p):
    try:
        n = max(1, min(int(p.get("numOfRows") or 10), 999))
        pg = max(1, int(p.get("pageNo") or 1))
    except ValueError:
        raise ValueError("10|INVALID_REQUEST_PARAMETER_ERROR")
    return rows[(pg - 1) * n: pg * n], len(rows)


def _range12(p, need):
    lo, hi = p.get("inqryBgnDt", ""), p.get("inqryEndDt", "")
    if need and not (lo and hi):
        raise ValueError("08|필수값 누락(inqryBgnDt, inqryEndDt)")
    for v in (lo, hi):
        if v and (len(v) != 12 or not v.isdigit()):
            raise ValueError("06|날짜 Format 에러(YYYYMMDDHHMM)")
    if lo and hi and (int(hi[:6]) - int(lo[:6]) > 1 or (int(hi[:6]) - int(lo[:6]) == 1 and hi[6:] > lo[6:])):
        raise ValueError("07|입력범위 초과(조회기간 최대 1개월)")
    return lo, hi


def q_bid_list(p):
    div = p.get("inqryDiv", "")
    if div not in ("1", "2", "3"):
        raise ValueError("08|필수값 누락(inqryDiv: 1 등록일시, 2 입찰공고번호, 3 변경일시)")
    if div == "2":
        _need08(p, "bidNtceNo")
        rows = [b for b in D["bids"] if b["bid_ntce_no"] == p["bidNtceNo"]]
    else:
        lo, hi = _range12(p, True)
        rows = [b for b in D["bids"] if _between(b["bid_ntce_dt"], lo, hi) and (div == "1" or b["ntce_kind_nm"] == "변경공고")]
    rows.sort(key=lambda b: (b["bid_ntce_dt"], b["bid_ntce_ord"]), reverse=True)
    return _no_data(_paging_open(rows, p))


def q_scsbid(p):
    div = p.get("inqryDiv", "")
    if div not in ("1", "2", "3", "4"):
        raise ValueError("08|필수값 누락(inqryDiv: 1 등록일시, 2 공고일시, 3 개찰일시, 4 입찰공고번호)")
    if div == "4":
        _need08(p, "bidNtceNo")
        rows = [o for o in D["opngs"] if o["bid_ntce_no"] == p["bidNtceNo"]]
    else:
        lo, hi = _range12(p, True)
        rows = [o for o in D["opngs"] if _between(o["openg_dt"], lo, hi)]
    return _no_data(_paging_open(rows, p))


def q_opng(p):
    _need08(p, "bidNtceNo")
    rows = [o for o in D["opngs"] if o["bid_ntce_no"] == p["bidNtceNo"]]
    return _no_data(_paging_open(rows, p))


def q_cntrct(p):
    div = p.get("inqryDiv", "")
    if div not in ("1", "2"):
        raise ValueError("08|필수값 누락(inqryDiv: 1 등록일시, 2 통합계약번호)")
    if div == "2":
        _need08(p, "untyCntrctNo")
        rows = [c for c in D["cntrcts"] if c["unty_no"] == p["untyCntrctNo"]]
    else:
        lo, hi = _range12(p, True)
        rows = [c for c in D["cntrcts"] if _between(c["cntrct_cncls_date"] + "0900", lo, hi)]
    return _no_data(_paging_open(rows, p))


def q_dlvr(p):
    lo, hi = p.get("inqryBgnDate", ""), p.get("inqryEndDate", "")
    for v in (lo, hi):
        if v and (len(v) != 8 or not v.isdigit()):
            raise ValueError("06|날짜 Format 에러(YYYYMMDD)")
    rows = [d for d in D["dlvr"] if d["use_yn"] == "Y" and _like(d["dminstt_cd"], p.get("dminsttCd"))
            and _between(d["dlvr_req_date"], lo, hi)]
    return _no_data(_paging_open(rows, p))


def _need08(p, k):
    if not p.get(k):
        raise ValueError(f"08|필수값 누락({k})")


def _no_data(res):
    if res[1] == 0:
        raise ValueError("03|No Data")
    return res


# ── FINL 재정 연계 인터페이스 ──────────────────────────────────────────
_STTS = dict(D["codes"]["PYMNT_STTS"])


def _pym(rows):
    return [dict(r, pymnt_stts_nm=_STTS.get(r["pymnt_stts_cd"], "")) for r in rows]


def q_pymnt_sttus(p):
    if not (p.get("PYMNT_REQ_NO") or p.get("CNTRCT_NO")):
        raise ValueError("PYMNT_REQ_NO 또는 CNTRCT_NO 중 하나는 필수입니다")
    rows = [r for r in D["pymnt"] if (p.get("PYMNT_REQ_NO") and r["pymnt_req_no"] == p["PYMNT_REQ_NO"])
            or (p.get("CNTRCT_NO") and r["ref_no"] == p["CNTRCT_NO"])]
    return _pym(rows), len(rows)


def q_pymnt_list(p):
    rows = [r for r in D["pymnt"] if _like(r["dminstt_cd"], p.get("DMINSTT_CD")) and _like(r["pymnt_stts_cd"], p.get("PYMNT_STTS_CD"))]
    return _pym(rows), len(rows)


def q_bdgt(p):
    _need(p, "DMINSTT_CD")
    yr = p.get("BDGT_YR") or "2026"
    used = sum(r["req_amt"] for r in D["pymnt"] if r["dminstt_cd"] == p["DMINSTT_CD"] and r["pymnt_stts_cd"] == "30")
    asign = {"9990101": 900_000_000, "9990102": 320_000_000, "9990201": 1_200_000_000,
             "9990301": 450_000_000, "9990401": 780_000_000, "9990402": 510_000_000}.get(p["DMINSTT_CD"])
    if asign is None:
        return [], 0
    return [{"dminstt_cd": p["DMINSTT_CD"], "bdgt_yr": yr, "asign_amt": asign, "excut_amt": used, "rmnd_amt": asign - used}], 1


_NEW = []


def q_pymnt_insert(p):
    _need(p, "REF_NO", "REQ_AMT")
    ref = next((r for r in D["pymnt"] if r["ref_no"] == p["REF_NO"]), None) or next(
        (c for c in D["cntrcts"] if c["cntrct_no"] == p["REF_NO"]), None)
    if ref is None:
        raise ValueError("존재하지 않는 계약/납품요구 번호입니다")
    row = {"pymnt_req_no": f"P26N{len(_NEW) + 1:04d}", "ref_no": p["REF_NO"], "req_amt": int(str(p["REQ_AMT"]).replace(",", "")),
           "pymnt_stts_cd": "10", "pymnt_stts_nm": "청구접수", "req_date": "20261005"}
    _NEW.append(row)        # 메모리에만 — 재기동 시 사라진다(시연용)
    return [row], 1


# 원천 키 → 시스템 필드명. 순서가 곧 응답 필드 순서이자 명세 순서다
CATALOG = {
    "ctlg": {"title": "CTLG 목록정보 관리 (가상)", "ops": [
        {"op": "selectPrdctClsfcList", "method": "GET", "path": "/ctlg/clsfc/selectPrdctClsfcList.do", "mode": "read",
         "summary": "물품분류(세부품명) 목록 조회", "query": q_clsfc_list,
         "params": [("PRDCT_CLSFC_NO", "물품분류번호(앞자리 일치)", False), ("DTL_PRDCT_CLSFC_NM", "세부품명", False),
                    ("pageIndex", "페이지 번호", False), ("recordCountPerPage", "페이지당 건수", False)],
         "fields": [("clsfc_no", "PRDCT_CLSFC_NO"), ("dtl_no", "DTL_PRDCT_CLSFC_NO"), ("dtl_nm", "DTL_PRDCT_CLSFC_NM"),
                    ("seg", "SGMNT_CD"), ("fam", "FMLY_CD"), ("cls", "CLS_CD"), ("unit", "UNIT_NM")]},
        {"op": "selectPrdctIdntList", "method": "GET", "path": "/ctlg/idnt/selectPrdctIdntList.do", "mode": "read",
         "summary": "물품식별번호 목록 조회", "query": q_idnt_list,
         "params": [("DTL_PRDCT_CLSFC_NO", "세부품명번호 10자리", False), ("MAKER_NM", "제조사명", False),
                    ("pageIndex", "페이지 번호", False), ("recordCountPerPage", "페이지당 건수", False)],
         "fields": [("idnt_no", "PRDCT_IDNT_NO"), ("dtl_no", "DTL_PRDCT_CLSFC_NO"), ("dtl_nm", "DTL_PRDCT_CLSFC_NM"),
                    ("model_nm", "MODEL_NM"), ("maker_nm", "MAKER_NM"), ("unit_price", "UNIT_PRCE")]},
        {"op": "selectPrdctIdntDtl", "method": "GET", "path": "/ctlg/idnt/selectPrdctIdntDtl.do", "mode": "read",
         "summary": "물품식별번호 상세 조회", "query": q_idnt_dtl,
         "params": [("PRDCT_IDNT_NO", "물품식별번호 8자리", True)],
         "fields": [("idnt_no", "PRDCT_IDNT_NO"), ("clsfc_no", "PRDCT_CLSFC_NO"), ("dtl_no", "DTL_PRDCT_CLSFC_NO"),
                    ("dtl_nm", "DTL_PRDCT_CLSFC_NM"), ("model_nm", "MODEL_NM"), ("maker_bizno", "MAKER_BIZRNO"),
                    ("maker_nm", "MAKER_NM"), ("unit", "UNIT_NM"), ("unit_price", "UNIT_PRCE")]},
        {"op": "selectEntrpsList", "method": "GET", "path": "/ctlg/entrps/selectEntrpsList.do", "mode": "read",
         "summary": "조달업체 목록 조회", "query": q_entrps_list,
         "params": [("CORP_NM", "업체명", False), ("BIZRNO", "사업자등록번호", False),
                    ("pageIndex", "페이지 번호", False), ("recordCountPerPage", "페이지당 건수", False)],
         "fields": [("bizno", "BIZRNO"), ("corp_nm", "CORP_NM"), ("ceo_nm", "RPRSV_NM"), ("rgn_nm", "RGN_NM"),
                    ("entrps_div", "ENTRPS_DIV_NM"), ("telno", "TELNO")]},
    ]},
    "dhgw": {"title": "DHGW 조달데이터 연계 게이트웨이 (가상)", "ops": [
        {"op": "getBidPblancListInfoThng", "method": "GET", "path": "/dhgw/ad/BidPublicInfoService/getBidPblancListInfoThng", "mode": "read",
         "summary": "물품 입찰공고 목록 조회", "query": q_bid_list,
         "params": [("inqryDiv", "조회구분 1:등록일시 2:입찰공고번호 3:변경일시", True),
                    ("inqryBgnDt", "조회시작일시 YYYYMMDDHHMM (구분 1·3 필수, 최대 1개월)", False),
                    ("inqryEndDt", "조회종료일시 YYYYMMDDHHMM", False), ("bidNtceNo", "입찰공고번호 13자리 (구분 2 필수)", False),
                    ("pageNo", "페이지 번호", True), ("numOfRows", "한 페이지 결과 수", True)],
         "fields": [("bid_ntce_no", "bidNtceNo"), ("bid_ntce_ord", "bidNtceOrd"), ("ntce_kind_nm", "ntceKindNm"),
                    ("bid_ntce_dt", "bidNtceDt"), ("bid_ntce_nm", "bidNtceNm"), ("ntce_instt_cd", "ntceInsttCd"),
                    ("ntce_instt_nm", "ntceInsttNm"), ("dminstt_cd", "dminsttCd"), ("dminstt_nm", "dminsttNm"),
                    ("bid_methd_nm", "bidMethdNm"), ("cntrct_cncls_mthd_nm", "cntrctCnclsMthdNm"), ("bid_begin_dt", "bidBeginDt"),
                    ("bid_clse_dt", "bidClseDt"), ("openg_dt", "opengDt"), ("asign_bdgt_amt", "asignBdgtAmt"),
                    ("presmpt_prce", "presmptPrce"), ("dtl_no", "dtilPrdctClsfcNo"), ("dtl_nm", "dtilPrdctClsfcNoNm"),
                    ("qty", "prdctQty"), ("unit", "prdctUnit")]},
        {"op": "getScsbidListSttusThng", "method": "GET", "path": "/dhgw/as/ScsbidInfoService/getScsbidListSttusThng", "mode": "read",
         "summary": "물품 낙찰 목록 현황 조회", "query": q_scsbid,
         "params": [("inqryDiv", "조회구분 1:등록일시 2:공고일시 3:개찰일시 4:입찰공고번호", True),
                    ("inqryBgnDt", "조회시작일시 YYYYMMDDHHMM", False), ("inqryEndDt", "조회종료일시 YYYYMMDDHHMM", False),
                    ("bidNtceNo", "입찰공고번호 (구분 4 필수)", False), ("pageNo", "페이지 번호", True), ("numOfRows", "한 페이지 결과 수", True)],
         "fields": [("bid_ntce_no", "bidNtceNo"), ("bid_ntce_ord", "bidNtceOrd"), ("bid_ntce_nm", "bidNtceNm"),
                    ("prtcpt_cnum", "prtcptCnum"), ("bidwinnr_nm", "bidwinnrNm"), ("bidwinnr_bizno", "bidwinnrBizno"),
                    ("bidwinnr_ceo_nm", "bidwinnrCeoNm"), ("sucsfbid_amt", "sucsfbidAmt"), ("sucsfbid_rate", "sucsfbidRate"),
                    ("openg_dt", "rlOpengDt"), ("dminstt_cd", "dminsttCd"), ("dminstt_nm", "dminsttNm")]},
        {"op": "getOpengResultListInfoThng", "method": "GET", "path": "/dhgw/as/ScsbidInfoService/getOpengResultListInfoThng", "mode": "read",
         "summary": "물품 개찰결과 조회", "query": q_opng,
         "params": [("bidNtceNo", "입찰공고번호", True), ("pageNo", "페이지 번호", True), ("numOfRows", "한 페이지 결과 수", True)],
         "fields": [("bid_ntce_no", "bidNtceNo"), ("bid_ntce_ord", "bidNtceOrd"), ("openg_dt", "opengDt"),
                    ("prtcpt_cnum", "prtcptCnum"), ("openg_corp_info", "opengCorpInfo"), ("openg_rslt", "progrsDivCdNm")]},
        {"op": "getCntrctInfoListThng", "method": "GET", "path": "/dhgw/ao/CntrctInfoService/getCntrctInfoListThng", "mode": "read",
         "summary": "물품 계약 목록 조회", "query": q_cntrct,
         "params": [("inqryDiv", "조회구분 1:등록일시 2:통합계약번호", True), ("inqryBgnDt", "조회시작일시 YYYYMMDDHHMM", False),
                    ("inqryEndDt", "조회종료일시 YYYYMMDDHHMM", False), ("untyCntrctNo", "통합계약번호 13자리 (구분 2 필수)", False),
                    ("pageNo", "페이지 번호", True), ("numOfRows", "한 페이지 결과 수", True)],
         "fields": [("unty_no", "untyCntrctNo"), ("dcsn_no", "dcsnCntrctNo"), ("cntrct_nm", "cntrctNm"),
                    ("cntrct_cncls_date", "cntrctCnclsDate"), ("cntrct_amt", "thtmCntrctAmt"), ("cntrct_instt_nm", "cntrctInsttNm"),
                    ("bid_ntce_no", "ntceNo"), ("dminstt_list", "dminsttList"), ("corp_list", "corpList")]},
        {"op": "getDlvrReqInfoList", "method": "GET", "path": "/dhgw/at/ShoppingMallPrdctInfoService/getDlvrReqInfoList", "mode": "read",
         "summary": "나라장터 쇼핑몰형 납품요구 목록 조회", "query": q_dlvr,
         "params": [("inqryBgnDate", "납품요구 시작일자 YYYYMMDD", False), ("inqryEndDate", "납품요구 종료일자 YYYYMMDD", False),
                    ("dminsttCd", "수요기관코드", False), ("pageNo", "페이지 번호", True), ("numOfRows", "한 페이지 결과 수", True)],
         "fields": [("dlvr_req_no", "dlvrReqNo"), ("dlvr_req_date", "dlvrReqRcptDate"), ("dminstt_cd", "dminsttCd"),
                    ("dminstt_nm", "dminsttNm"), ("idnt_no", "prdctIdntNo"), ("dtl_nm", "krnPrdctNm"),
                    ("entrps_nm", "cntrctCorpNm"), ("entrps_bizno", "cntrctCorpBizno"), ("qty", "dlvrReqQty"),
                    ("unit_price", "prdctUprc"), ("dlvr_amt", "dlvrReqAmt"), ("dlvr_stts_cd", "dlvrReqSttsCd")]},
    ]},
    "finl": {"title": "FINL 재정 연계 인터페이스 (가상)", "ops": [
        {"op": "selectPymntSttus", "method": "GET", "path": "/finl/pymnt/selectPymntSttus", "mode": "read",
         "summary": "대금 지급 상태 조회", "query": q_pymnt_sttus,
         "params": [("PYMNT_REQ_NO", "대금청구번호", False), ("CNTRCT_NO", "계약번호 또는 납품요구번호", False)],
         "fields": [("pymnt_req_no", "PYMNT_REQ_NO"), ("ref_no", "CNTRCT_NO"), ("dminstt_cd", "DMINSTT_CD"),
                    ("entrps_bizno", "BIZRNO"), ("req_date", "REQ_YMD"), ("req_amt", "REQ_AMT"),
                    ("pymnt_stts_cd", "PYMNT_STTS_CD"), ("pymnt_stts_nm", "PYMNT_STTS_NM"), ("pymnt_date", "PYMNT_YMD"),
                    ("bdgt_acnt_nm", "BDGT_ACNT_NM")],
         # 정의서에만 있는 필드 — 응답(fields)에 넣지 말 것
         "doc_only": [("ACNT_DIV_CD", "VARCHAR(2)", "Y", "회계구분코드 (01 일반회계, 02 특별회계, 03 기금)")]},
        {"op": "selectPymntList", "method": "GET", "path": "/finl/pymnt/selectPymntList", "mode": "read",
         "summary": "수요기관별 대금 청구 목록", "query": q_pymnt_list,
         "params": [("DMINSTT_CD", "수요기관코드 7자리", False), ("PYMNT_STTS_CD", "지급상태코드", False)],
         "fields": [("pymnt_req_no", "PYMNT_REQ_NO"), ("ref_no", "CNTRCT_NO"), ("req_date", "REQ_YMD"),
                    ("req_amt", "REQ_AMT"), ("pymnt_stts_cd", "PYMNT_STTS_CD"), ("pymnt_stts_nm", "PYMNT_STTS_NM")]},
        {"op": "selectBdgtCnfm", "method": "GET", "path": "/finl/bdgt/selectBdgtCnfm", "mode": "read",
         "summary": "수요기관 예산 배정·집행 확인", "query": q_bdgt,
         "params": [("DMINSTT_CD", "수요기관코드 7자리", True), ("BDGT_YR", "예산연도 YYYY", False)],
         "fields": [("dminstt_cd", "DMINSTT_CD"), ("bdgt_yr", "BDGT_YR"), ("asign_amt", "ASIGN_AMT"),
                    ("excut_amt", "EXCUT_AMT"), ("rmnd_amt", "RMND_AMT")]},
        {"op": "insertPymntReq", "method": "POST", "path": "/finl/pymnt/insertPymntReq", "mode": "write",
         "summary": "대금 청구 등록", "query": q_pymnt_insert,
         "params": [("REF_NO", "계약번호 또는 납품요구번호", True), ("REQ_AMT", "청구금액", True)],
         "fields": [("pymnt_req_no", "PYMNT_REQ_NO"), ("ref_no", "CNTRCT_NO"), ("req_amt", "REQ_AMT"),
                    ("pymnt_stts_cd", "PYMNT_STTS_CD"), ("pymnt_stts_nm", "PYMNT_STTS_NM"), ("req_date", "REQ_YMD")]},
    ]},
}

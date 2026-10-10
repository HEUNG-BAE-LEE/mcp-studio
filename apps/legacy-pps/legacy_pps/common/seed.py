"""가상조달기관 레거시의 단일 데이터 원천.

조달청이 공개한 업무 흐름(조달요청 → 입찰공고 → 개찰 → 계약 → 납품요구 → 대금지급)과
공개 오픈API의 값 형식을 따르는 **가상 데이터**다. 기관·업체·사람은 전부 지어낸 것이다.

네 레거시 서버(CTLG·DHGW·FINL·STCK)와 레거시 DB 적재기(db/load.py)가 모두 이 모듈을 본다.
그래서 DHGW 의 계약번호와 FINL 의 대금 청구가 같은 계약을 가리키고, DB 를 조회해도 같은 값이 나온다.

결정적이다 — 같은 SEED 면 항상 같은 데이터. 시계를 읽지 않고 기준일(BASE_YMD)을 고정해,
시연한 날짜에 따라 "마감 전/후"가 바뀌지 않게 한다.
"""
import random
from datetime import date, datetime, timedelta

SEED = 20261005
BASE_YMD = "20261005"            # 데이터의 '오늘'. 이 날 이전 마감 공고만 개찰 결과가 있다
_BASE = date(2026, 10, 5)

# ── 수요기관 — 행정표준기관코드처럼 7자리지만 실존 기관과 겹치지 않게 999 로 시작한다
DMINSTT = [
    ("9990101", "한가람시청", "지방자치단체"),
    ("9990102", "한가람시 누리구청", "지방자치단체"),
    ("9990201", "가람도교육청", "교육기관"),
    ("9990301", "국립미래과학관", "국가기관"),
    ("9990401", "한빛도로공사", "공공기관"),
    ("9990402", "새벽수자원공단", "공공기관"),
]

# 공고·계약을 내는 쪽. 실제 조달청 조직명을 쓰지 않는다(사칭 방지)
NTCE_INSTT = [("9990001", "가상조달기관 구매사업과"), ("9990002", "가상조달기관 서부지원")]

# ── 물품 — 8자리는 UNSPSC 공개 코드(조달청 물품분류의 기반), 뒤 2자리 세부품명은 가상
# (분류8, 세부2, 세부품명, 단위, 기준단가)
PRDCT_CLSFC = [
    ("56101504", "01", "사무용의자", "개", 160000),
    ("56101703", "01", "사무용책상", "개", 240000),
    ("43211507", "01", "데스크톱컴퓨터", "대", 1150000),
    ("43211503", "01", "노트북컴퓨터", "대", 1480000),
    ("43211902", "01", "액정모니터", "대", 250000),
    ("44103103", "01", "토너카트리지", "개", 80000),
    ("14111507", "01", "복사용지", "상자", 25000),
    ("44121704", "01", "볼펜", "자루", 600),
]

# ── 조달업체 — 사업자등록번호는 검증 숫자 규칙을 따르지만 실존 번호와 무관하게 생성한다
_ENTRPS_NAMES = ["대한오피스가구", "한빛정보기술", "누리사무기기", "가람컴퓨터", "새길문구",
                 "동해토너", "미래디스플레이", "한결가구산업", "온누리지류", "바른전산"]
_CEO = ["김민준", "이서연", "박지훈", "최유진", "정하윤", "강도윤", "조수아", "윤지호", "장예린", "임현우"]
_REGION = ["서울특별시", "경기도", "대전광역시", "부산광역시", "충청북도", "경상남도"]

# 비축 대상 원자재(조달청 원자재 비축 사업의 비철금속 품목군). 재고량은 가상이다
STOCK_ITEMS = [("ALU", "알루미늄"), ("CU", "구리"), ("ZN", "아연"), ("PB", "납"), ("SN", "주석"), ("NI", "니켈")]
STOCK_SITES = [("S01", "가상비축기지 1"), ("S02", "가상비축기지 2")]


def _bizno(rng):
    """사업자등록번호 10자리 — 마지막 자리는 국세청 공개 검증 규칙으로 계산한다."""
    d = [rng.randint(1, 9)] + [rng.randint(0, 9) for _ in range(8)]
    d[3], d[4] = 8, 1                     # 개인/법인 구분 자리 — 법인(81)으로 고정
    w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
    s = sum(a * b for a, b in zip(d, w)) + (d[8] * 5) // 10
    d.append((10 - s % 10) % 10)
    n = "".join(map(str, d))
    return f"{n[:3]}-{n[3:5]}-{n[5:]}"


def _dt(d, hh=10, mm=0):
    return f"{d:%Y%m%d}{hh:02d}{mm:02d}"


def _build():
    rng = random.Random(SEED)

    entrps = []
    for i, nm in enumerate(_ENTRPS_NAMES):
        entrps.append({
            "bizno": _bizno(rng), "corp_nm": nm, "ceo_nm": _CEO[i], "rgn_nm": rng.choice(_REGION),
            "entrps_div": "제조" if i % 3 else "공급", "telno": f"0{rng.randint(2, 63)}-{rng.randint(200, 999)}-{rng.randint(1000, 9999)}",
        })

    prdct = []      # 물품식별 — 업체·모델별 8자리
    for c in PRDCT_CLSFC:
        for k in range(2):
            mk = rng.choice(entrps)
            prdct.append({
                "clsfc_no": c[0], "dtl_no": c[0] + c[1], "dtl_nm": c[2], "unit": c[3],
                "idnt_no": f"{rng.randint(20000000, 26999999)}", "model_nm": f"{mk['corp_nm'][:2]}-{c[2][:2]}{rng.randint(100, 999)}",
                "maker_bizno": mk["bizno"], "maker_nm": mk["corp_nm"],
                "unit_price": int(round(c[4] * rng.uniform(0.85, 1.2), -2)),
            })

    bids, opngs, cntrcts = [], [], []
    for i in range(36):
        c = PRDCT_CLSFC[i % len(PRDCT_CLSFC)]
        ntce_d = _BASE - timedelta(days=34 - i)
        clse_d = ntce_d + timedelta(days=rng.choice([7, 10, 14]))
        qty = rng.choice([10, 20, 30, 50, 100, 200]) if c[4] > 10000 else rng.choice([1000, 5000, 10000])
        prce = int(round(c[4] * qty, -3))
        dm = rng.choice(DMINSTT)
        no = f"R26BK{rng.randint(10000000, 99999999)}"
        cmthd = "제한경쟁" if prce < 100_000_000 else rng.choice(["일반경쟁", "협상에의한계약"])
        b = {
            "bid_ntce_no": no, "bid_ntce_ord": "000", "bid_ntce_nm": f"{dm[1]} {c[2]} 구매",
            "ntce_instt_cd": NTCE_INSTT[i % 2][0], "ntce_instt_nm": NTCE_INSTT[i % 2][1],
            "dminstt_cd": dm[0], "dminstt_nm": dm[1], "bid_ntce_dt": _dt(ntce_d, 9, 30),
            "bid_begin_dt": _dt(ntce_d + timedelta(days=1), 10), "bid_clse_dt": _dt(clse_d, 10),
            "openg_dt": _dt(clse_d, 11), "presmpt_prce": prce, "asign_bdgt_amt": int(prce * 1.1),
            "cntrct_cncls_mthd_nm": cmthd, "bid_methd_nm": "전자입찰", "ntce_kind_nm": "등록공고",
            "clsfc_no": c[0], "dtl_no": c[0] + c[1], "dtl_nm": c[2], "qty": qty, "unit": c[3],
        }
        if i % 9 == 4:      # 변경공고 — 같은 공고번호의 차수가 올라간다(공고번호+차수가 식별자)
            bids.append(b)
            b = dict(b, bid_ntce_ord="001", ntce_kind_nm="변경공고", bid_clse_dt=_dt(clse_d + timedelta(days=3), 10),
                     openg_dt=_dt(clse_d + timedelta(days=3), 11))
            clse_d = clse_d + timedelta(days=3)
        bids.append(b)

        if clse_d < _BASE:                       # 마감된 공고만 개찰
            win = rng.choice(entrps)
            rate = round(rng.uniform(86.0, 97.5), 3)
            amt = int(round(prce * rate / 100, -1))
            opngs.append({
                "bid_ntce_no": no, "bid_ntce_ord": b["bid_ntce_ord"], "openg_dt": b["openg_dt"],
                "prtcpt_cnum": rng.randint(3, 27), "bidwinnr_bizno": win["bizno"], "bidwinnr_nm": win["corp_nm"],
                "bidwinnr_ceo_nm": win["ceo_nm"], "bid_ntce_nm": b["bid_ntce_nm"], "dminstt_cd": dm[0], "dminstt_nm": dm[1],
                "sucsfbid_amt": amt, "sucsfbid_rate": rate, "openg_rslt": "개찰완료",
            })
            cd = clse_d + timedelta(days=rng.randint(3, 6))
            if cd < _BASE:
                cntrcts.append({
                    # 차세대 확정계약번호: R + 연도2 + 번호구분 TA + 순번8 (+ 수정차수2 는 dcsn_no 에서 붙인다)
                    "cntrct_no": f"R26TA{rng.randint(10000000, 99999999)}", "cntrct_chg_ord": "00",
                    # 통합계약번호 13자리 — 차세대 형식의 공개 예시가 없어 구 형식(YYYYMM+7자리)을 따른다(추정)
                    "unty_no": f"{cd:%Y%m}{rng.randint(0, 9999999):07d}",
                    "cntrct_nm": b["bid_ntce_nm"], "cntrct_cncls_date": f"{cd:%Y%m%d}", "cntrct_amt": amt,
                    "bid_ntce_no": no, "dminstt_cd": dm[0], "dminstt_nm": dm[1],
                    "cntrct_instt_nm": b["ntce_instt_nm"], "entrps_bizno": win["bizno"], "entrps_nm": win["corp_nm"],
                    "cntrct_mthd_nm": cmthd, "dlvr_tmlmt_date": f"{cd + timedelta(days=30):%Y%m%d}",
                    "clsfc_no": c[0], "dtl_nm": c[2], "qty": qty,
                })

    # 계약 변경 — 레거시답게 같은 테이블에 변경차수 행이 더 쌓인다
    for c in list(cntrcts)[::5]:
        cntrcts.append(dict(c, cntrct_chg_ord="01", cntrct_amt=int(round(c["cntrct_amt"] * 1.05, -1))))
    by_biz = {e["bizno"]: e for e in entrps}
    for c in cntrcts:
        c["dcsn_no"] = c["cntrct_no"] + c["cntrct_chg_ord"]      # 확정계약번호 15자리
        # 공개 계약정보서비스의 목록 문자열 형식 — [순번^코드^명^소관^부서^담당자^전화], [순번^업체구분^공동도급방식^업체명^대표자^국적^지분율^채권자^담당자^사업자번호]
        e = by_biz[c["entrps_bizno"]]
        c["dminstt_list"] = f"[1^{c['dminstt_cd']}^{c['dminstt_nm']}^^물품관리과^^]"
        c["corp_list"] = f"[1^단독^^{e['corp_nm']}^{e['ceo_nm']}^대한민국^100^^^{e['bizno'].replace('-', '')}]"
    for o in opngs:     # 개찰업체 문자열 — 업체명^사업자번호^대표자^투찰금액^투찰율 (1순위만)
        o["openg_corp_info"] = f"{o['bidwinnr_nm']}^{o['bidwinnr_bizno'].replace('-', '')}^{o['bidwinnr_ceo_nm']}^{o['sucsfbid_amt']}^{o['sucsfbid_rate']}"

    dlvr = []       # 종합쇼핑몰 납품요구
    for i in range(30):
        p = prdct[i % len(prdct)]
        dm = DMINSTT[i % len(DMINSTT)]
        d = _BASE - timedelta(days=40 - i)
        q = rng.choice([2, 5, 10, 20, 40])
        dlvr.append({
            "dlvr_req_no": f"D26{rng.randint(1000000, 9999999)}", "dlvr_req_date": f"{d:%Y%m%d}",
            "dminstt_cd": dm[0], "dminstt_nm": dm[1], "idnt_no": p["idnt_no"], "dtl_nm": p["dtl_nm"],
            "model_nm": p["model_nm"], "entrps_bizno": p["maker_bizno"], "entrps_nm": p["maker_nm"],
            "qty": q, "unit_price": p["unit_price"], "dlvr_amt": q * p["unit_price"],
            "dlvr_stts_cd": rng.choice(["10", "20", "30", "30", "30"]), "use_yn": "N" if i == 17 else "Y",
        })

    pymnt = []      # 대금 청구·지급 — 계약 원본 행(변경차수 00)과 납품요구 일부
    src = [("C", c["dcsn_no"], c["cntrct_amt"], c["dminstt_cd"], c["entrps_bizno"], c["cntrct_cncls_date"])
           for c in cntrcts if c["cntrct_chg_ord"] == "00"]
    src += [("D", d["dlvr_req_no"], d["dlvr_amt"], d["dminstt_cd"], d["entrps_bizno"], d["dlvr_req_date"])
            for d in dlvr if d["dlvr_stts_cd"] == "30"]
    for k, (kind, ref, amt, dm, biz, ymd) in enumerate(src):
        req = datetime.strptime(ymd, "%Y%m%d").date() + timedelta(days=rng.randint(10, 25))
        if req >= _BASE:
            continue
        st = rng.choice(["10", "20", "30", "30", "40"])
        pymnt.append({
            "pymnt_req_no": f"P26{k:05d}", "ref_kind": kind, "ref_no": ref, "dminstt_cd": dm, "entrps_bizno": biz,
            "req_date": f"{req:%Y%m%d}", "req_amt": amt, "pymnt_stts_cd": st,
            "pymnt_date": f"{req + timedelta(days=5):%Y%m%d}" if st == "30" else "",
            "acnt_div_cd": rng.choice(["01", "02", "03"]),      # DB 에는 있다. FINL API 는 이 값을 돌려주지 않는다(매설 결함)
            "bdgt_acnt_nm": rng.choice(["일반회계", "특별회계", "기금"]),
        })

    stock = []
    for code, nm in STOCK_ITEMS:
        for sc, snm in STOCK_SITES:
            stock.append({"item_cd": code, "item_nm": nm, "site_cd": sc, "site_nm": snm,
                          "stock_qty": round(rng.uniform(300, 4200), 1), "unit": "톤", "base_ymd": BASE_YMD})
    release = []
    for i in range(18):
        it = STOCK_ITEMS[i % len(STOCK_ITEMS)]
        d = _BASE - timedelta(days=5 + i * 4)
        release.append({"rels_no": f"S26{i:04d}", "item_cd": it[0], "item_nm": it[1], "rels_ymd": f"{d:%Y%m%d}",
                        "rels_qty": round(rng.uniform(5, 120), 1), "rqstr_nm": rng.choice(_ENTRPS_NAMES)})

    codes = {
        "DLVR_STTS": [("10", "납품요구접수"), ("20", "납품중"), ("30", "검수완료")],
        "PYMNT_STTS": [("10", "청구접수"), ("20", "검사완료"), ("30", "지급완료"), ("40", "반려")],
        "ACNT_DIV": [("01", "일반회계"), ("02", "특별회계"), ("03", "기금")],
    }
    return {"dminstt": DMINSTT, "entrps": entrps, "prdct": prdct, "bids": bids, "opngs": opngs,
            "cntrcts": cntrcts, "dlvr": dlvr, "pymnt": pymnt, "stock": stock, "release": release, "codes": codes}


DATA = _build()


def bizno_ok(no: str) -> bool:
    """사업자등록번호 검증 숫자 확인 — 생성기 자체 시험용."""
    d = [int(x) for x in no.replace("-", "")]
    w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
    s = sum(a * b for a, b in zip(d[:9], w)) + (d[8] * 5) // 10
    return (10 - s % 10) % 10 == d[9]


if __name__ == "__main__":
    for k, v in DATA.items():
        print(k, len(v))
    assert all(bizno_ok(e["bizno"]) for e in DATA["entrps"])
    assert DATA == _build(), "결정적이어야 한다"
    paid = {p["ref_no"] for p in DATA["pymnt"]}
    assert any(c["dcsn_no"] in paid for c in DATA["cntrcts"]), "계약과 대금이 이어져야 한다"
    print("ok")

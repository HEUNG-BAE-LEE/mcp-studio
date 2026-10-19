"""시연용 데이터셋. 목업(2차 개발 목업)이 보여 주는 값을 그대로 담는다.

구매관리 DB(PO), 인사 DB(HR), 회계 ERP DB(ACC) 세 DB 의 행을 파이썬 객체로 만든다. 씨앗을 고정해 늘 같은 값이 나오고,
목업의 질문과 답이 실제 쿼리로 같은 숫자가 나오게 다음 조건을 맞춘다. 전부 가짜 값이다.

  - 한빛상사(V0012)의 발주는 모두 42건이고, 2026년 9월 승인대기는 PO-2609-0142(4,850,000), 0131(1,700,000), 0118(760,000) 세 건이다(합계 7,310,000).
  - 세 건 중 인사팀(D1030)이 요청한 것은 PO-2609-0142 한 건뿐이다(구매요청 PR-2609-0088).
  - 김현우(20150301, 구매팀 팀장)가 맡은 발주는 128건, 구매팀 구성원은 12명, 인사팀 구성원은 9명, 인사팀의 구매요청은 27건(홍길동 3건)이다.
  - 구매팀 2026 예산 30,000,000 / 사용 21,450,000, 인사팀 12,000,000 / 7,380,000.
  - 구매요청 번호로 이어지는 발주의 98%, 회계 전표의 관련 발주번호 92% 가 실제 발주와 맞는다(나머지는 비어 있다).
"""
import random
from typing import Dict, List

VERSION = 3                 # 데이터셋 모양이 바뀌면 올린다(시험이 만들어 두는 템플릿 이름에 들어간다)

DEPTS = [          # (부서코드, 부서명, 상위 부서)
    ("D1000", "경영지원본부", None), ("D1010", "총무팀", "D1000"), ("D1030", "인사팀", "D1000"), ("D4010", "구매팀", "D1000"),
    ("D2000", "영업본부", None), ("D2010", "영업1팀", "D2000"), ("D2020", "영업2팀", "D2000"),
    ("D3000", "개발본부", None), ("D3010", "개발1팀", "D3000"), ("D3020", "개발2팀", "D3000"),
]
RANKS = [("1", "사원", 1), ("2", "선임", 2), ("3", "책임", 3), ("4", "팀장", 4), ("5", "본부장", 5)]
TEAM_SIZE = {"D1010": 3, "D1030": 9, "D4010": 12, "D2010": 10, "D2020": 8, "D3010": 7, "D3020": 9}      # 재직자 수
HEAD_OF = {"D1000": "본부장", "D2000": "본부장", "D3000": "본부장"}

NAMED = [          # (사번, 이름, 부서, 직급, 이메일 아이디)
    ("20150301", "김현우", "D4010", "팀장", "hyunwoo.kim"), ("20170822", "정수민", "D4010", "책임", "sumin.jung"), ("20200114", "박지훈", "D4010", "사원", "jihun.park"),
    ("20190412", "홍길동", "D1030", "선임", "gildong.hong"), ("20210305", "최유나", "D2010", "책임", "yuna.choi"), ("20180911", "이서연", "D3020", "책임", "seoyeon.lee"),
]
SURNAMES = list("김이박최정강조윤장임한오서신권황안송류")
GIVEN = ["현우", "서연", "지훈", "민수", "하윤", "유나", "민호", "수빈", "지우", "도현", "서준", "예은", "시우", "하은", "주원", "지민", "태양", "나연", "건우", "소율",
         "재윤", "다은", "준서", "채원", "승민", "유진", "서현", "동혁", "혜진", "성민", "하늘", "보람", "가온", "이안", "나래", "다솜"]
ROMAN = {"김": "kim", "이": "lee", "박": "park", "최": "choi", "정": "jung", "강": "kang", "조": "jo", "윤": "yoon", "장": "jang", "임": "lim", "한": "han", "오": "oh",
         "서": "seo", "신": "shin", "권": "kwon", "황": "hwang", "안": "ahn", "송": "song", "류": "ryu"}
GIVEN_ROMAN = {"현우": "hyunwoo", "서연": "seoyeon", "지훈": "jihun", "민수": "minsu", "하윤": "hayun", "유나": "yuna", "민호": "minho", "수빈": "subin", "지우": "jiwoo",
               "도현": "dohyun", "서준": "seojun", "예은": "yeeun", "시우": "siwoo", "하은": "haeun", "주원": "juwon", "지민": "jimin", "태양": "taeyang", "나연": "nayeon",
               "건우": "gunwoo", "소율": "soyul", "재윤": "jaeyoon", "다은": "daeun", "준서": "junseo", "채원": "chaewon", "승민": "seungmin", "유진": "yujin",
               "서현": "seohyun", "동혁": "donghyuk", "혜진": "hyejin", "성민": "seongmin", "하늘": "haneul", "보람": "boram", "가온": "gaon", "이안": "ian", "나래": "narae", "다솜": "dasom"}

VENDORS = [        # (코드, 상호, 사업자번호, 대표, 거래 상태, 담당자 연락처, 주소)
    ("V0007", "대한문구", "234-56-78901", "이대한", "Y", "031-345-6789", "경기 성남시 분당구 판교로"),
    ("V0012", "한빛상사", "123-45-67890", "박한빛", "Y", "010-4830-8830", "서울 강남구 테헤란로"),
    ("V0015", "서울오피스", "345-67-89012", "박서울", "Y", "02-2233-4455", "서울 송파구 올림픽로"),
    ("V0021", "한빛정보통신", "456-78-90123", "최정보", "Y", "02-6677-8899", "서울 금천구 가산디지털로"),
    ("V0031", "대한오피스", "214-81-30377", "김대한", "Y", "02-5530-4410", "경기 성남시 분당구 정자일로"),
    ("V0033", "동양사무기기", "567-89-01234", "정동양", "N", "042-482-1234", "대전 유성구 테크노로"),
    ("V0044", "미래상사", "305-12-45201", "이미래", "Y", "010-7712-1207", "인천 남동구 논현로"),
]
VENDOR_PREFIX = ["신한", "우리", "대성", "새한", "태영", "성진", "세종", "한성", "두리", "다온", "하나", "청운", "금강", "백두", "한라", "동서", "남강", "북두", "유니", "코리아"]
VENDOR_SUFFIX = ["상사", "오피스", "물산", "산업", "유통", "정보통신", "사무기기", "문구", "테크", "시스템"]
ADDRS = ["서울 강남구 테헤란로", "경기 성남시 분당구", "인천 남동구 논현로", "서울 마포구 월드컵북로", "경기 안양시 동안구", "부산 해운대구 센텀로", "대구 수성구 달구벌대로", "광주 북구 첨단과기로"]

ITEMS = [          # (품목코드, 품목명, 단위, 품목군, 기준 단가)
    ("P-10023", "A4 복사용지 80g", "BOX", "101", 12500), ("P-20410", "레이저 토너 검정", "EA", "201", 185000), ("P-30112", "2공 파일철", "EA", "101", 3000),
    ("P-10031", "중성펜 0.5mm 12입", "EA", "101", 6800), ("P-10107", "라벨지 A4 100매", "EA", "101", 9900), ("P-20015", "토너 카트리지(흑백)", "EA", "201", 80000),
    ("P-20042", "27인치 모니터", "EA", "201", 250000), ("P-30008", "사무용 의자", "EA", "301", 160000), ("P-40100", "설치·배송 용역", "EA", "401", 350000),
    ("P-50010", "에코백(로고 인쇄)", "EA", "101", 8500), ("P-10200", "스테이플러", "EA", "101", 7500), ("P-10210", "포스트잇 76x76", "EA", "101", 2400),
    ("P-10220", "화이트보드 마카 4색", "EA", "101", 4800), ("P-10230", "클리어파일 20매", "EA", "101", 2200), ("P-20100", "무선 마우스", "EA", "201", 28000),
    ("P-20110", "기계식 키보드", "EA", "201", 89000), ("P-20120", "USB-C 허브", "EA", "201", 42000), ("P-20130", "노트북 거치대", "EA", "201", 35000),
    ("P-20140", "웹캠 FHD", "EA", "201", 56000), ("P-20150", "HDMI 케이블 2m", "EA", "201", 9000), ("P-30020", "서랍장 3단", "EA", "301", 95000),
    ("P-30030", "회의용 테이블", "EA", "301", 420000), ("P-30040", "모니터 암", "EA", "301", 54000), ("P-10240", "복사용지 A3", "BOX", "101", 24000),
    ("P-10250", "택배 박스 중", "BOX", "101", 11000), ("P-10260", "일회용 컵 1000입", "BOX", "101", 18000), ("P-10270", "커피 믹스 200입", "BOX", "101", 14500),
    ("P-10280", "핸드타월", "BOX", "101", 9500), ("P-10290", "물티슈 캡형", "EA", "101", 1900), ("P-10300", "청소용품 세트", "EA", "101", 23000),
]
CODES = {          # 공통코드(PO 의 TB_CODE_DTL)
    "PO_STTS": [("10", "작성"), ("20", "승인대기"), ("30", "승인"), ("90", "취소")],
    "PR_STTS": [("10", "요청"), ("20", "승인"), ("30", "발주 완료"), ("40", "마감")],
    "ITEM_GRP": [("101", "사무용품"), ("201", "전산소모품"), ("301", "가구"), ("401", "용역")],
    "RCV_STTS": [("10", "검수 중"), ("20", "검수 완료")],
    "TRD_STTS": [("Y", "거래 중"), ("N", "거래 중지")],
}
WAREHOUSES = [("W01", "서울 1창고", "서울 금천구 가산동", "Y"), ("W02", "이천 물류센터", "경기 이천시 마장면", "Y"), ("W03", "부산 센터", "부산 강서구 녹산동", "Y"),
              ("W04", "대전 창고", "대전 유성구 탑립동", "Y"), ("W05", "구 인천 창고", "인천 서구 가좌동", "N")]

ACCOUNTS = [       # (계정코드, 계정명, 구분)
    ("11300", "보통예금", "1"), ("11500", "외상매출금", "1"), ("12100", "비품", "1"), ("25100", "미지급금", "2"), ("25300", "예수금", "2"), ("31100", "자본금", "3"),
    ("41100", "상품매출", "4"), ("51110", "소모품비", "5"), ("51120", "사무용품비", "5"), ("51130", "전산소모품비", "5"), ("51210", "복리후생비", "5"), ("51310", "접대비", "5"),
    ("51410", "여비교통비", "5"), ("51510", "통신비", "5"), ("51610", "수도광열비", "5"), ("51710", "임차료", "5"), ("51810", "수선비", "5"), ("51910", "광고선전비", "5"),
]
ACCT_TYPES = [("1", "자산"), ("2", "부채"), ("3", "자본"), ("4", "수익"), ("5", "비용")]

# 목업이 이름을 들어 보여 주는 발주들. (발주번호, 거래처, 발주일, 상태, 납기일, 담당 사번, 구매요청, 비고, [(품목, 수량, 단가)])
SPECIAL_POS = [
    ("PO-2609-0142", "V0012", "20260926", "20", "20261010", "20150301", "PR-2609-0088", "10월 사무용품 정기 발주",
     [("P-10023", 200, 12500), ("P-20410", 10, 185000), ("P-30112", 50, 3000), ("P-40100", 1, 350000)]),
    ("PO-2609-0139", "V0031", "20260924", "30", "20261002", "20150301", "PR-2609-0081", "모니터 교체", [("P-20410", 6, 185000), ("P-30112", 40, 3000)]),
    ("PO-2609-0131", "V0012", "20260917", "20", "20261005", "20150301", "PR-2609-0079", "영업1팀 판촉물", [("P-50010", 200, 8500)]),
    ("PO-2609-0127", "V0044", "20260921", "30", "20260930", "20170822", "PR-2609-0075", "", [("P-10023", 40, 19000)]),
    ("PO-2609-0118", "V0012", "20260908", "20", "20260930", "20150301", "PR-2609-0066", "", [("P-30112", 100, 3000), ("P-10023", 40, 11500)]),
    ("PO-2609-0105", "V0012", "20260902", "30", "20260915", "20150301", "PR-2609-0061", "분기 소모품", [("P-10031", 100, 6800), ("P-10107", 60, 9900)]),
    ("PO-2609-0101", "V0007", "20260901", "30", "20260914", "20170822", "PR-2609-0060", "전산 소모품", [("P-20410", 8, 185000), ("P-20120", 12, 42000)]),
    ("PO-2609-0122", "V0012", "20260911", "30", "20260925", "20150301", "PR-2609-0069", "회의실 비품", [("P-20130", 20, 35000), ("P-20150", 40, 9000)]),
]
# 구매요청이 정해진 것: (번호, 제목, 요청자, 부서, 상태, 요청일)
SPECIAL_PRS = [
    ("PR-2609-0088", "10월 사무용품 구매", "20190412", "D1030", "30", "20260922"), ("PR-2609-0081", "모니터 교체", "20210305", "D2010", "30", "20260918"),
    ("PR-2609-0075", "신규 입사자 노트북", "20180911", "D3020", "10", "20260915"), ("PR-2609-0079", "영업 판촉물 제작", "20210305", "D2010", "30", "20260916"),
    ("PR-2609-0066", "탕비실 비품 보충", "20170822", "D4010", "30", "20260905"), ("PR-2609-0061", "분기 소모품", "20200114", "D4010", "30", "20260901"),
    ("PR-2609-0060", "전산 소모품 보충", "20200114", "D4010", "30", "20260831"), ("PR-2609-0069", "회의실 비품 교체", "20170822", "D4010", "30", "20260908"),
]
DEPT_BUDGET = {"D4010": (30000000, 21450000), "D1030": (12000000, 7380000), "D2010": (25000000, 19900000)}


def ymd(y: int, m: int, d: int) -> str:
    return "%04d%02d%02d" % (y, m, d)


def _won(n: int) -> int:
    return int(round(n / 10) * 10)


class Dataset:
    """세 DB 의 모든 행. 속성마다 (열 이름 순서대로의) 튜플 리스트다."""

    def __init__(self, seed: int = 2609) -> None:
        self.rnd = random.Random(seed)
        self.depts = DEPTS
        self.emps = self._employees()
        self.vendors = self._vendors()
        self.items = [(c, n, u, g, p) for c, n, u, g, p in ITEMS]
        self.prs: List[tuple] = []
        self.pos: List[tuple] = []
        self.po_lines: List[tuple] = []
        self._purchase()
        self.budgets = self._budgets()
        self.rcvs, self.rcv_lines = self._receipts()
        self.po_hist = self._po_hist()
        self.atnd = self._attendance()
        self.emp_hist = self._emp_hist()
        self.customers, self.slips, self.slip_lines, self.slip_hist = self._accounting()

    # ------------------------------------------------------------------ 인사
    def _employees(self) -> List[tuple]:
        rnd, used_names = self.rnd, set()
        out: List[tuple] = []               # (사번, 이름, 부서, 직급코드, 이메일, 퇴직 여부, 입사일)
        by_rank = {nm: cd for cd, nm, _ in RANKS}
        used_no = {n[0] for n in NAMED}

        def email(local: str) -> str:
            return "%s@hanbit.local" % local

        for no, nm, dept, rank, local in NAMED:
            out.append((no, nm, dept, by_rank[rank], email(local), "N", ymd(int(no[:4]), int(no[4:6]), int(no[6:8]))))
            used_names.add(nm)
        for dept, size in TEAM_SIZE.items():
            have = sum(1 for e in out if e[2] == dept)
            need_head = not any(e[2] == dept and e[3] == "4" for e in out)
            while have < size:
                nm = self._unique_name(used_names)
                no = self._unique_no(used_no)
                rank = "4" if need_head else rnd.choice(["1", "1", "1", "2", "2", "3"])
                if need_head:
                    need_head = False
                local = "%s.%s" % (GIVEN_ROMAN[nm[1:]], ROMAN[nm[0]])
                out.append((no, nm, dept, rank, email(local), "N", ymd(int(no[:4]), int(no[4:6]), int(no[6:8]))))
                have += 1
        for dept, title in HEAD_OF.items():          # 본부장은 본부마다 한 명
            nm = self._unique_name(used_names)
            no = self._unique_no(used_no)
            out.append((no, nm, dept, "5", email("%s.%s" % (GIVEN_ROMAN[nm[1:]], ROMAN[nm[0]])), "N", ymd(int(no[:4]), int(no[4:6]), int(no[6:8]))))
        for dept in ("D1030", "D2010", "D3010", "D2020"):          # 퇴직자(객체 필터가 거른다)
            nm = self._unique_name(used_names)
            no = self._unique_no(used_no)
            out.append((no, nm, dept, "1", email("%s.%s" % (GIVEN_ROMAN[nm[1:]], ROMAN[nm[0]])), "Y", ymd(int(no[:4]), int(no[4:6]), int(no[6:8]))))
        return sorted(out, key=lambda e: e[0])

    def _unique_name(self, used: set) -> str:
        while True:
            nm = self.rnd.choice(SURNAMES) + self.rnd.choice(GIVEN)
            if nm not in used and nm[0] in ROMAN:
                used.add(nm)
                return nm

    def _unique_no(self, used: set) -> str:
        while True:
            no = "20%02d%02d%02d" % (self.rnd.randint(14, 25), self.rnd.randint(1, 12), self.rnd.randint(1, 28))
            if no not in used:
                used.add(no)
                return no

    # ------------------------------------------------------------------ 구매
    def _vendors(self) -> List[tuple]:
        rnd = self.rnd
        out = list(VENDORS)
        used_names = {v[1] for v in out}
        used_codes = {v[0] for v in out}
        n = 8
        while len(out) < 40:
            nm = rnd.choice(VENDOR_PREFIX) + rnd.choice(VENDOR_SUFFIX)
            code = "V%04d" % (10 + n * 3)
            n += 1
            if nm in used_names or code in used_codes:
                continue
            used_names.add(nm)
            used_codes.add(code)
            biz = "%03d-%02d-%05d" % (rnd.randint(100, 899), rnd.randint(10, 89), rnd.randint(10000, 99999))
            phone = rnd.choice(["02-%04d-%04d", "031-%03d-%04d", "010-%04d-%04d"])
            phone = phone % ((rnd.randint(1000, 9999), rnd.randint(1000, 9999)) if phone.startswith(("02", "010")) else (rnd.randint(100, 999), rnd.randint(1000, 9999)))
            out.append((code, nm, biz, rnd.choice(SURNAMES) + rnd.choice(GIVEN), "Y" if rnd.random() > 0.08 else "N", phone, rnd.choice(ADDRS)))
        return sorted(out)

    def _purchase(self) -> None:
        """구매요청과 발주를 만든다. 합계가 조건에 맞게 한 번에 정해진다."""
        rnd = self.rnd
        item_price = {i[0]: i[4] for i in self.items}
        emp_dept = {e[0]: e[2] for e in self.emps}
        buyers = [e[0] for e in self.emps if e[2] == "D4010" and e[5] == "N"]
        others = [b for b in buyers if b != "20150301"]
        vend_codes = [v[0] for v in self.vendors]
        v12 = "V0012"

        # --- 구매요청: 월별 번호. 인사팀 27건(홍길동 3건), 나머지 부서에 흩어 둔다
        prs: Dict[str, tuple] = {p[0]: p for p in SPECIAL_PRS}
        dept_pool = [d[0] for d in DEPTS if d[0] not in ("D1000", "D2000", "D3000")]
        month_prs = {m: [] for m in range(1, 10)}
        for m in range(1, 10):
            base, count = (60, 39) if m == 9 else (0, 12)
            for i in range(count):
                no = "PR-26%02d-%04d" % (m, base + 1 + i)
                if no in prs:
                    continue
                dept = rnd.choice(dept_pool)
                reqs = [e[0] for e in self.emps if e[2] == dept and e[5] == "N"]
                prs[no] = (no, rnd.choice(["사무용품 구매", "전산 소모품", "비품 교체", "회의실 물품", "행사 물품", "신규 입사자 장비", "교육 자료 인쇄", "탕비실 보충"]) + " %d" % rnd.randint(1, 30),
                           rnd.choice(reqs), dept, "30", ymd(2026, m, rnd.randint(1, 27)))
        # 인사팀 요청을 정확히 27건, 홍길동은 3건으로 맞춘다
        hr_prs = [k for k, p in prs.items() if p[3] == "D1030"]
        non_special = [k for k in prs if k not in {p[0] for p in SPECIAL_PRS}]
        rnd.shuffle(non_special)
        for k in non_special:
            if len(hr_prs) >= 27:
                break
            if prs[k][3] != "D1030":
                p = prs[k]
                prs[k] = (p[0], p[1], rnd.choice([e[0] for e in self.emps if e[2] == "D1030" and e[5] == "N" and e[0] != "20190412"]), "D1030", p[4], p[5])
                hr_prs.append(k)
        hr_keep = [k for k in hr_prs if k not in {p[0] for p in SPECIAL_PRS}]
        while len(hr_prs) > 27 and hr_keep:                  # 넘치면 다른 부서로 옮긴다
            k = hr_keep.pop()
            p = prs[k]
            dept = rnd.choice([d for d in dept_pool if d != "D1030"])
            prs[k] = (p[0], p[1], rnd.choice([e[0] for e in self.emps if e[2] == dept and e[5] == "N"]), dept, p[4], p[5])
            hr_prs.remove(k)
        hong = [k for k, p in prs.items() if p[2] == "20190412"]
        extra_hr = [k for k in hr_prs if k not in {p[0] for p in SPECIAL_PRS}]
        for k in extra_hr:
            p = prs[k]
            if len(hong) < 3 and p[2] != "20190412":
                prs[k] = (p[0], p[1], "20190412", p[3], p[4], p[5])
                hong.append(k)
            elif p[2] == "20190412" and len(hong) > 3:
                prs[k] = (p[0], p[1], rnd.choice([e[0] for e in self.emps if e[2] == "D1030" and e[0] != "20190412" and e[5] == "N"]), p[3], p[4], p[5])
                hong.remove(k)
        self.prs = sorted(prs.values())

        # --- 발주 번호와 일자
        rows: Dict[str, dict] = {}
        for no, vend, ymd_, stts, dlv, emp, pr, rmk, lines in SPECIAL_POS:
            rows[no] = dict(no=no, vend=vend, ymd=ymd_, stts=stts, dlv=dlv, emp=emp, pr=pr, rmk=rmk, lines=lines)

        def new_po(no: str, month: int, day: int, vend: str, stts: str) -> None:
            lines = []
            for _ in range(rnd.randint(1, 4)):
                code = rnd.choice(self.items)[0]
                if code in {l[0] for l in lines}:
                    continue
                qty = rnd.choice([1, 2, 5, 10, 20, 30, 50, 100])
                lines.append((code, qty, _won(item_price[code] * rnd.choice([1, 1, 1, 0.95, 1.05]))))
            dd = min(28, day + rnd.randint(7, 20))
            rows[no] = dict(no=no, vend=vend, ymd=ymd(2026, month, day), stts=stts, dlv=ymd(2026, month + 1 if dd < day else month, dd) if dd >= day else ymd(2026, month, 28),
                            emp=None, pr=None, rmk=rnd.choice(["", "", "정기 발주", "긴급 요청", "분기 소모품", "프로젝트 물품", "행사 준비"]), lines=lines)

        for m in range(1, 9):                                   # 1~8월: 24건씩
            for i in range(24):
                no = "PO-26%02d-%04d" % (m, i + 1)
                new_po(no, m, 1 + i * 27 // 23, rnd.choice(vend_codes), "30" if rnd.random() < 0.95 else "90")
        for n in range(101, 151):                                # 9월: 0101~0150
            no = "PO-2609-%04d" % n
            if no in rows:
                continue
            day = 1 + (n - 101) * 27 // 49
            r = rnd.random()
            stts = "30" if r < .5 else "20" if r < .78 else "10" if r < .94 else "90"
            vend = rnd.choice([v for v in vend_codes if v != v12])         # 한빛상사의 9월 발주는 정해 둔 것뿐이다
            new_po(no, 9, day, vend, stts)

        # --- 한빛상사 42건: 9월 정해 둔 6건 + 1~8월 36건(월 4~5건)
        v12_rows = [r for r in rows.values() if r["vend"] == v12]
        older = [r for r in rows.values() if r["no"] < "PO-2609" and r["vend"] != v12]
        rnd.shuffle(older)
        for r in older[:42 - len(v12_rows)]:
            r["vend"] = v12
            r["stts"] = "30"
        # 9월 승인대기 한빛상사 발주는 세 건뿐이다(다른 달은 모두 승인)
        for r in rows.values():
            if r["vend"] == v12 and r["ymd"] < "20260901":
                r["stts"] = "30"
        # --- 담당자: 김현우 128건
        specials = {p[0] for p in SPECIAL_POS}
        pool = [r for r in rows.values() if r["no"] not in specials]
        rnd.shuffle(pool)
        fixed_k = sum(1 for p in SPECIAL_POS if p[5] == "20150301")
        for i, r in enumerate(pool):
            r["emp"] = "20150301" if i < 128 - fixed_k else rnd.choice(others)
        # --- 구매요청: 월별 구매요청을 돌려 쓰고, 4건은 구매요청이 없다(98%)
        pr_by_month = {}
        for p in self.prs:
            pr_by_month.setdefault(p[0][3:7], []).append(p[0])
        fixed_pr = {p[0] for p in SPECIAL_POS}
        orphan_n = 0
        for r in sorted(pool, key=lambda x: x["no"]):
            ym = r["no"][3:7]
            avail = pr_by_month.get(ym) or pr_by_month["2609"]
            if orphan_n < 4 and rnd.random() < 0.03:
                r["pr"] = None if orphan_n % 2 == 0 else "PR-9999-%04d" % rnd.randint(1, 99)
                orphan_n += 1
            else:
                r["pr"] = rnd.choice(avail)
        while orphan_n < 4:                                      # 모자라면 앞에서부터 채운다
            r = next(x for x in sorted(pool, key=lambda x: x["no"]) if x["pr"] and not x["pr"].startswith("PR-9999") and x["no"] not in fixed_pr)
            r["pr"] = None
            orphan_n += 1
        # 인사팀이 요청한 PR 에 한빛상사 승인대기 발주가 더 붙지 않게 한다(질문의 답이 한 건이 되도록)
        hr_set = {p[0] for p in self.prs if p[3] == "D1030"}
        for r in rows.values():
            if r["vend"] == v12 and r["stts"] == "20" and r["no"] not in ("PO-2609-0142",) and r["pr"] in hr_set:
                r["pr"] = rnd.choice([k for k in pr_by_month["2609"] if k not in hr_set])
        # --- 직렬화
        reg_hour = [9, 10, 11, 13, 14, 15, 16]
        for r in sorted(rows.values(), key=lambda x: x["no"]):
            amount = sum(q * p for _, q, p in r["lines"])
            deleted = "Y" if (r["no"][3:7] in ("2601", "2602") and rnd.random() < 0.06) else "N"
            reg = "%s-%s-%s %02d:%02d:00" % (r["ymd"][:4], r["ymd"][4:6], r["ymd"][6:], rnd.choice(reg_hour), rnd.randint(0, 59))
            xml = "<line><step no=\"1\" emp=\"%s\"/><step no=\"2\" emp=\"%s\"/></line>" % (r["emp"], "20150301")
            self.pos.append((r["no"], r["ymd"], r["vend"], amount, r["stts"], r["dlv"], r["emp"], r["pr"], r["rmk"], reg, "ieum_%s" % r["emp"], xml, deleted))
            for seq, (code, qty, price) in enumerate(r["lines"], 1):
                self.po_lines.append((r["no"], seq, code, qty, price))
        _ = emp_dept

    def _budgets(self) -> List[tuple]:
        out = []
        for dept, *_ in DEPTS:
            for year in ("2025", "2026"):
                if year == "2026" and dept in DEPT_BUDGET:
                    total, used = DEPT_BUDGET[dept]
                else:
                    total = self.rnd.choice([8, 10, 12, 15, 20, 25]) * 1000000
                    used = int(total * (self.rnd.uniform(.55, .95) if year == "2025" else self.rnd.uniform(.4, .8)) // 10000 * 10000)
                out.append((dept, year, total, used))
        return out

    def _receipts(self):
        rnd = self.rnd
        rcvs, lines = [], []
        item_of = {}
        for po_no, seq, code, qty, price in self.po_lines:
            item_of.setdefault(po_no, []).append((code, qty))
        inspectors = ["20170822", "20200114", "20150301"]
        counter: Dict[str, int] = {}
        for po in self.pos:
            if po[4] != "30" or po[12] == "Y" or rnd.random() > 0.55:
                continue
            ym = po[1][2:6]
            n = counter.get(ym, 0) + 1
            counter[ym] = n
            no = "RC-%s-%04d" % (ym, (289 if ym == "2609" else 0) + n)
            day = min(28, int(po[1][6:]) + rnd.randint(3, 12))
            ymd_ = po[1][:6] + "%02d" % day
            total = sum(q for _, q in item_of[po[0]])
            rcvs.append((no, ymd_, po[0], rnd.choice(["W01", "W02", "W03", "W04"]), po[2], rnd.choice(["20", "20", "20", "10"]), rnd.choice(inspectors), total, "N"))
            for seq, (code, qty) in enumerate(item_of[po[0]], 1):
                lines.append((no, seq, code, qty))
        return rcvs, lines

    def _po_hist(self) -> List[tuple]:
        out, seq = [], 0
        for po in self.pos:
            if po[4] in ("30", "90"):
                seq += 1
                out.append((seq, po[0], po[9], "ieum_" + (po[6] or "x"), "20", po[4]))
        return out

    # ------------------------------------------------------------------ 인사 부속
    def _attendance(self) -> List[tuple]:
        rnd, out = self.rnd, []
        active = [e[0] for e in self.emps if e[5] == "N"]
        for d in range(1, 29):
            if d % 7 in (0, 6):                                  # 주말
                continue
            for no in active:
                if rnd.random() < 0.05:
                    out.append((no, ymd(2026, 9, d), "", "", "40"))
                else:
                    out.append((no, ymd(2026, 9, d), "%02d%02d" % (8, rnd.randint(30, 59)), "%02d%02d" % (rnd.choice([18, 19, 20]), rnd.randint(0, 59)), "10"))
        return out

    def _emp_hist(self) -> List[tuple]:
        out, seq = [], 0
        for e in self.emps[:30]:
            seq += 1
            out.append((seq, e[0], e[6], "입사", "", e[2]))
        return out

    # ------------------------------------------------------------------ 회계
    def _accounting(self):
        rnd = self.rnd
        vend_biz = {v[2]: v for v in self.vendors}
        customers, n = [], 0
        for v in self.vendors[:37]:                              # 구매관리의 거래처와 같은 사업자번호(37/40)
            n += 1
            customers.append(("C%04d" % n, v[2], v[1], v[3]))
        for i in range(3):                                       # 회계에만 있는 거래처
            n += 1
            customers.append(("C%04d" % n, "%03d-%02d-%05d" % (rnd.randint(900, 990), rnd.randint(10, 89), rnd.randint(10000, 99999)), "회계전용상사%d" % (i + 1), rnd.choice(SURNAMES) + rnd.choice(GIVEN)))
        known_biz = [c[1] for c in customers]
        slips, lines, hist, seq = [], [], [], 0
        pay_accts = ["51110", "51120", "51130"]
        for po in self.pos:
            if po[4] != "30" and po[0] not in ("PO-2609-0118", "PO-2609-0101"):
                continue
            if po[12] == "Y" or (rnd.random() > 0.75 and po[0] not in ("PO-2609-0118", "PO-2609-0101")):
                continue
            seq += 1
            ym = po[1][2:6]
            no = "AC-%s-%05d" % (ym, 54000 + seq * 7)
            biz = vend_biz[next(v[2] for v in self.vendors if v[0] == po[2])][2]
            slips.append((no, po[1][:6] + "%02d" % min(28, int(po[1][6:]) + 2), rnd.choice(pay_accts), biz, po[0], po[3], "%s 대금" % ("사무용품" if rnd.random() < .5 else "전산소모품")))
        for i in range(max(8, len(slips) // 12)):                # 수기 전표(관련 발주번호 없음)
            seq += 1
            slips.append(("AC-2609-%05d" % (54000 + seq * 7 + 3), ymd(2026, 9, rnd.randint(1, 28)), "25100", rnd.choice(known_biz), "", rnd.choice([0, 0, 120000, 560000]), "미지급금 정리"))
        slips.sort()
        for no, ymd_, acct, biz, ref, amt, summary in slips:
            lines.append((no, 1, acct, amt, 0))
            lines.append((no, 2, "25100", 0, amt))
            hist.append((len(hist) + 1, no, ymd_, "ieum_ro", "작성"))
        return customers, slips, lines, hist


def counts(ds: Dataset) -> Dict[str, int]:
    """시험과 로그가 읽는 요약."""
    return {"emps": len(ds.emps), "vendors": len(ds.vendors), "items": len(ds.items), "prs": len(ds.prs), "pos": len(ds.pos), "po_lines": len(ds.po_lines),
            "rcvs": len(ds.rcvs), "slips": len(ds.slips), "customers": len(ds.customers)}

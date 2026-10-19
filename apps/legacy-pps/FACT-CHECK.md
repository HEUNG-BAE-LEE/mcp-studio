# 사실 검증표 — 가상조달기관 레거시

검증일 2026-10-05. 시연 데이터가 어디까지 사실에 기대고, 어디부터 지어낸 것인지 한 장에 적는다.
심사에서 "이거 실제와 같습니까?"를 물으면 이 표로 답한다.

등급: **확인** 공식 문서·법령·실제 호출로 확인 · **2차** 공개 코드·해설 자료 · **추정** 근거 없이 그럴듯하게 정함 · **가상** 의도적으로 지어냄

## 1. 조달청 공개 오픈API 규격 (DHGW 가 따르는 것)

근거: 공공데이터포털 서비스 페이지의 Swagger, 같은 페이지 참고문서(활용가이드 docx 6종), 실제 호출.

| 항목 | 시뮬레이터 | 등급 | 근거 |
|---|---|---|---|
| 서비스 경로 체계 | `/ad/BidPublicInfoService`, `/as/ScsbidInfoService`, `/ao/CntrctInfoService`, `/at/ShoppingMallPrdctInfoService` 를 DHGW 경로에 그대로 씀 | 확인 | Swagger. 구 경로 `BidPublicInfoService05` 는 실제 호출 시 `NO_OPENAPI_SERVICE_ERROR`(12) |
| 오퍼레이션명 | `getBidPblancListInfoThng`, `getScsbidListSttusThng`, `getOpengResultListInfoThng`, `getCntrctInfoListThng`, `getDlvrReqInfoList` | 확인 | 활용가이드 |
| 공통 파라미터 | `pageNo`, `numOfRows`, `inqryDiv`, `inqryBgnDt`/`inqryEndDt` `YYYYMMDDHHMM` | 확인 | 활용가이드 |
| inqryDiv 코드 | 입찰공고 1 등록일시·2 공고번호·3 변경일시 / 낙찰 1~4 / 계약 1 등록일시·2 통합계약번호 | 확인 | 활용가이드 |
| 등록일시 조회 범위 최대 1개월 | 넘으면 `07 입력범위 초과` | 확인 | 활용가이드 |
| 쇼핑몰형만 일자 `YYYYMMDD` 파라미터(`inqryBgnDate`) | 그대로 | 확인 | 쇼핑몰 가이드 1.3 |
| 정상 봉투 | `response.header{resultCode "00", resultMsg "정상"}` + `body{items[], numOfRows, pageNo, totalCount}` | 확인 / items 배열은 2차 | 활용가이드, 공개 클라이언트 코드 |
| 제공기관 오류코드 | 03 No Data · 06 날짜 Format · 07 입력범위 초과 · 08 필수값 누락 | 확인 | 활용가이드 |
| 값 타입 | 전부 문자열, 금액은 쉼표 없는 정수, 비율은 소수 | 확인 | Swagger |
| 응답 일시 | `YYYY-MM-DD HH:MM:SS`, 일자 `YYYY-MM-DD` | 확인 | 활용가이드 응답 예시 |
| 입찰공고번호 | `R26BK` + 8자리 = 13자리, 차수 `000` | 확인 | 가이드 예시 `R25BK00940072` |
| 확정계약번호 | `R26TA` + 8자리 + 수정차수 2자리 = 15자리 (`dcsnCntrctNo`) | 확인 | 가이드 예시 `R26TA0155571200` |
| 통합계약번호 | 13자리 `YYYYMM` + 7자리 | **추정** | 차세대 형식의 공개 예시 없음. 구 예시 `2016050000077` 을 따름 |
| 목록 문자열 | `corpList` `[순번^업체구분^공동도급방식^업체명^대표자^국적^지분율^채권자^담당자^사업자번호]`, `dminsttList`, `opengCorpInfo` `업체명^사업자번호^대표자^투찰금액^투찰율` | 확인 | 활용가이드 |
| 사업자번호 | 10자리 숫자(하이픈 없음) | 확인 | 활용가이드 |
| 납품요구 필드 `dlvrReqNo`·`dlvrReqRcptDate`·`dlvrReqQty`·`dlvrReqAmt`·`dlvrReqSttsCd` | **추정** | 오퍼레이션 `getDlvrReqInfoList` 존재만 확인. 응답 필드 상세 미확보. `prdctIdntNo`·`krnPrdctNm`·`cntrctCorpNm`·`cntrctCorpBizno`·`prdctUprc` 는 확인 |
| 인증 | DHGW 는 OAuth2 | **가상** | 공개 오픈API 는 serviceKey 방식. DHGW 는 "기관 내부 연계 게이트웨이"라는 설정이라 다르게 둠 |

## 2. 물품 분류·식별 체계

| 항목 | 등급 | 근거 |
|---|---|---|
| 물품분류번호 8자리, 2자리씩 4단계(대·중·소·세분류) | 확인 | 「물품목록정보의 관리 및 이용에 관한 법률 시행령」 제9조 ① |
| 물품식별번호 8자리 | 확인 | 같은 조 |
| 세부품명번호 10자리 = 분류번호 8자리 + 2자리 | 2차 | 「물품목록정보의 관리 및 이용에 관한 규정」 제12조 ①, 활용가이드 `dtilPrdctClsfcNo` 설명 |
| UNSPSC 기반 분류 | 확인 | 물품목록정보서비스 설명 |
| 사용한 8자리 코드 8개 (56101504 Chairs · 56101703 Desks · 43211507 Desktop computers · 43211503 Notebook computers · 43211902 LCD monitors · 44103103 Printer toner · 14111507 Printer or copier paper · 44121704 Ball point pens) | 확인 | 공개 UNSPSC 코드 목록과 하나씩 대조 |
| 세부품명 뒤 2자리 `01`, 물품식별번호 값 | **가상** | 실제 번호와 무관 |

## 3. 조달청 조직·업무·시스템 (설명에 쓰는 사실)

| 사실 | 등급 | 근거 |
|---|---|---|
| 나라장터 2002년 개통, 차세대 전면 재구축(클라우드·새 인증체계), 자체 조달시스템 통합 | 확인 | 정책브리핑, 언론 |
| 조달정보시스템 18개 운영, 2025-10 정상화 발표 | 확인 | 보안뉴스 |
| 2026-01 조직개편(혁신조달기획과·혁신조달운영과 등), 2026-08 AI 조달혁신과 신설 | 확인 | 조달청 보도자료, 언론 |
| 원자재 비축 사업(비철금속) | 확인 | 조달청 개요 |
| 비축 품목별 재고량·기지 이름 | **가상** | — |

## 4. 지어낸 것 (사칭 방지를 위해 일부러)

- 수요기관(한가람시청 등)과 기관코드 `999xxxx` — 실존 기관과 겹치지 않게
- 공고기관 "가상조달기관 구매사업과" — 실제 조달청 조직명을 쓰지 않음
- 조달업체·대표자·전화. 사업자번호는 국세청 공개 검증 규칙을 만족하도록 생성했지만 실존 번호와 무관
- CTLG(2009)·FINL(2015) 의 대문자 스네이크 필드명, 봉투, 세션·API Key 인증 — 공공 레거시의 일반적 모습을 따른 **추정**. 조달청 내부 시스템의 실제 구조가 아님
- FINL 정의서의 `ACNT_DIV_CD` 불일치 — 시연용 매설 결함

## 5. 아직 확인하지 못한 것

- 현재 서비스키로 조달청 오픈API 실호출 불가(`SERVICE_KEY_IS_NOT_REGISTERED_ERROR`). 활용신청 후 실제 응답으로 다시 대조한다
- 차세대 통합계약번호 형식, 납품요구 응답 필드 상세

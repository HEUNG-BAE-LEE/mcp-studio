# legacy-pps — 가상조달기관 레거시 시뮬레이터

**시연용 가상 시스템이다. 조달청 실제 시스템이 아니며, 그 화면·주소·로고를 흉내 내지 않는다.**
조달청이 공개한 업무 흐름(입찰공고 → 개찰 → 계약 → 납품요구 → 대금지급)과 공개 오픈API 규격을 따라,
시대와 인증 방식이 다른 레거시 4종과 레거시 DB 를 재현한다. 무엇이 사실이고 무엇이 지어낸 것인지는 `FACT-CHECK.md`.

이음 플랫폼과 코드 의존성이 없다. 엠버링크 `legacy/` 의 구조(단일 카탈로그, 의도된 결함, 관리 채널 반입)를 그대로 따랐다.

| 시스템 | 포트 | 시대 · 인증 | 문서 | 시연 포인트 |
|---|---|---|---|---|
| CTLG 목록정보 관리 | 8001 | 2009년식 · 세션 로그인(JSESSIONID) | `/ctlg/v2/api-docs` Swagger 2.0 | 세션이 없으면 **200 + HTML "세션이 만료되었습니다"**, 로그인 실패도 200 + `resultCode 9001` |
| DHGW 조달데이터 연계 게이트웨이 | 8002 | 신형 · OAuth2 client_credentials | `/dhgw/openapi.yaml` OpenAPI 3.0 | 공개 오픈API 와 같은 경로·필드·봉투·오류코드(03·06·07·08), 조회기간 최대 1개월 |
| FINL 재정 연계 인터페이스 | 8003 | 2015년식 · `X-API-KEY` | **명세 없음.** `assets/finl_인터페이스정의서.xlsx` 뿐 | 정의서의 `ACNT_DIV_CD` 가 실제 응답에 없다(매설 결함 — 고치지 말 것) |
| STCK 비축물자 재고 | 8004 | SOAP 1.1 · WS-Security | `/stck/StockService?wsdl` | SOAP 레거시도 같은 MCP 도구로 |
| `pps_legacy` DB | 55432(로컬) | PostgreSQL | — | FK 없음, 문자열 일자·금액, `USE_YN`, 변경차수 행, 공통코드 분리, 개인정보 열 |

모든 응답에 `X-Demo-System: virtual` 헤더가 붙는다. 데이터는 `legacy_pps/common/seed.py` 한 곳에서 결정적으로 만든다 —
같은 계약번호(`R26TA…`, 15자리)가 DHGW·FINL·DB 에서 서로 맞는다.

## 실행

```bash
pip install -r requirements.txt
python assets/make_assets.py          # 카탈로그 → Swagger2 · OAS3 · 정의서 xlsx
./run_all.sh && ./check_auth.sh       # 4종 기동 + 시대별 인증·매설 결함 16개 확인
docker run -d --name pps-legacy-pg -e POSTGRES_USER=pps -e POSTGRES_PASSWORD=pps -e POSTGRES_DB=pps_legacy \
  -p 127.0.0.1:55432:5432 postgres:16-alpine
python db/load.py                     # 레거시 DB 적재
./stop_all.sh
```

| 환경변수 | 기본값 |
|---|---|
| `CTLG_USER` / `CTLG_PW` | `ctlgsvc` / `ctlg2009!` |
| `DHGW_CLIENT_ID` / `DHGW_CLIENT_SECRET` | `dhgw-ieum` / `dhgw-secret-26` |
| `FINL_API_KEY` | `FINL-KEY-2015` |
| `STCK_USER` / `STCK_PW` | `stckws` / `stck-ws-01` |
| `PPS_LEGACY_DSN` | `postgresql://pps:pps@127.0.0.1:55432/pps_legacy` |

Azure 배포는 `infra/pps/` (KT Cloud 공공존 구조 재현).

# MVP 검증 대상 사이트 및 시나리오 설계

* 작성일: 2026-07-26
* 상태: 승인됨
* 관련 문서: `.claude/PRD.md` v0.2 (§20.2 "MVP 대상 웹사이트" 항목을 확정)

---

## 1. 배경과 목적

PRD §20.2에 "MVP 대상 웹사이트 미정"이 남아 있었다. 이 항목은 §18의 첫 번째 위험요소(Hook 방식으로 일부 네트워크 요청을 수집하지 못할 수 있음)와 직결된다. 대상을 정하지 않고 1단계에 착수하면 Extension을 완성한 뒤에야 수집이 되지 않는 사이트임을 발견하게 된다.

이 문서는 후보 사이트를 실측으로 판정하고, 선정된 사이트마다 검증 시나리오를 정의한다. 시나리오는 개발 중 수동 테스트 명세이자 회귀 테스트 기준으로 사용한다.

### 전제 조건

앞서 확정된 결정이 후보 선정을 제약한다.

| 결정 | 출처 | 제약 |
| --- | --- | --- |
| 서버 직접 실행만 지원 | PRD §7.9 | 5단계에서 서버가 대상 API를 직접 호출할 수 있어야 한다 |
| 외부 공개 데모·오픈소스로 활용 | 본 문서 §2 | 타사 서비스의 비공식 내부 API를 자동화하는 사례는 공개할 수 없다 |
| 5단계는 5a까지 | 본 문서 §8 | 외부 MCP 클라이언트 연동은 검증 범위에서 제외 |

PRD §17의 5단계를 두 부분으로 나누고, MVP는 5a까지만 다룬다.

* **5a** — Tool Registry, 실행 게이트웨이, LLM 테스트 콘솔(§7.11). 여기까지로 §21 MVP 완료 정의가 완주된다.
* **5b** — `POST /mcp/{projectId}` JSON-RPC 엔드포인트(`initialize`, `tools/list`, `tools/call`). 6단계로 미룬다.

---

## 2. 판정 기준

후보를 다음 순서로 거른다.

| # | 기준 | 불합격 시 |
| --- | --- | --- |
| 1 | 클릭이 JSON을 반환하는 API 호출을 일으키는가 | 즉시 탈락. 액션으로 만들 대상이 없다 |
| 2 | 클릭 1회에 요청이 2건 이상 발생하는가 | 통과하되 §7.6 점수 정책 검증 가치가 낮다 |
| 3 | 생성·수정(POST/PUT) 액션을 만들 수 있는가 | 보조 등급. §6.2 시나리오 불가 |
| 4 | 서버가 외부에서 이 API를 호출할 수 있는가 | 보조 등급. 5단계 검증 불가 |
| 5 | 공개 데모로 써도 이용약관에 문제없는가 | 탈락 |

### 기준 1을 이렇게 정의한 이유

기준을 "fetch/XHR이 발생하는가"로 두면 Hook 방식의 한계 문제로 오해된다. Chrome 확장은 네트워크를 세 가지 방법으로 볼 수 있고, 각각 한계가 다르다.

| 방식 | 볼 수 있는 것 | 한계 |
| --- | --- | --- |
| Main World Hook (PRD MVP 채택) | fetch/XHR의 요청·응답 본문 전부 | 페이지 이동, `sendBeacon`, WebSocket, Service Worker 요청을 못 봄 |
| `chrome.webRequest` | 모든 요청의 URL·method·헤더 | 응답 본문을 읽을 수 없다 |
| `chrome.debugger` + CDP | 모든 요청 + 응답 본문 | 디버깅 배너 노출, 성능 부담, 별도 권한 |

즉 페이지 이동도 `chrome.webRequest`로는 잡힌다. 그러나 서버사이드 렌더링 사이트는 **페이지 자체가 응답**이므로, 수집 방식을 CDP로 올려도 돌아오는 것은 HTML 문서다. 그러면 §7.7의 `response.schema`를 만들 수 없고, MCP Tool로 만들어도 LLM이 소비할 수 없다. HTML을 파싱해 데이터를 추출하는 것은 스크레이핑이며 PRD §4 비목표에 가깝다.

따라서 판정의 본질은 수집 기술이 아니라 **API의 존재 여부**다.

### 부수적 결론

기준 1을 통과한 사이트라면 fetch/XHR Hook만으로 충분하다. CDP 지원(§17 6단계)을 앞당길 필요가 없다.

---

## 3. 실측 결과

Playwright 및 Chrome으로 각 사이트를 직접 열어 클릭 후 네트워크를 관찰했다.

| 사이트 | 클릭 시 발생 | 응답 | 판정 |
| --- | --- | --- | --- |
| 국토교통부 실거래가 `rt.molit.go.kr` | `POST /pt/gis/getMarker.do` 외 2건 | JSON | **주력 채택** |
| 국가통계포털 `kosis.kr` | `POST /statisticsList/selectTreeData.do` 외 3건 | 미확인 | **보조 채택** |
| 나라장터 `g2b.go.kr` | WebSquare 프레임워크 (`.wq`) | 미확인 | 보류 |
| 공공데이터포털 `data.go.kr` | 전체 페이지 이동 | HTML | 탈락 |
| Grafana Play `play.grafana.org` | API 요청 60건 이상 | JSON | 시나리오 탈락, 부하 테스트용 보존 |

### 3.1 국토교통부 실거래가 (주력)

아파트 탭에서 지도를 이동하면 다음 요청이 발생한다.

```text
POST /pt/gis/getMarker.do            단지 목록 조회
POST /cmm/gis/getCenterLedCdPnu.do   지도 중심 좌표 → 행정구역 코드 변환
POST /pt/main/accesLog.do            접속 로그
```

`getMarker.do`의 요청과 응답은 다음과 같다.

```text
요청 본문
minX=126.9654155&minY=37.5606793&maxX=126.9911647&maxY=37.5720409&srhYear=2026&poiType=A

응답 헤더
content-type: text/html;charset=UTF-8

응답 본문
{"list":[{"aprpnHsmpCode":"12","aprpnHsmpNm":"롯데미도파광화문빌딩",
  "signguCode":"11110","emdCode":"11700","mnnm":"0145","slno":"0000",
  "lo":126.9737048886730000000,"la":37.5713660636931000000}, ...]}
```

세 가지가 확인됐다.

* **응답 본문은 완전한 JSON인데 Content-Type이 `text/html`이다.**
* `accesLog.do`가 실재한다. PRD §6.1이 가정한 "사용자 행동 로그 API가 조회 API와 함께 발생한다"는 상황이 실물로 존재한다.
* 인증이 없다. 쿠키 없이 서버에서 직접 호출할 수 있다.

마지막 항목은 별도로 검증했다.

```bash
# 헤더 없이 호출 → 차단
curl -X POST 'https://rt.molit.go.kr/pt/gis/getMarker.do' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'minX=126.9654155&...'
# → HTTP 400  <H1>Request Blocked</H1>

# 브라우저 헤더를 붙이면 정상
curl -X POST 'https://rt.molit.go.kr/pt/gis/getMarker.do' \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; ...) Chrome/150.0.0.0 Safari/537.36' \
  -H 'Referer: https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=A&mobileAt=' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -H 'Accept: application/json, text/javascript, */*; q=0.01' \
  --data 'minX=126.9654155&...'
# → HTTP 200  {"list":[...]}
```

WAF가 요청 헤더를 검사한다. 실행 시 원본 헤더를 재현해야 한다.

### 3.2 국가통계포털 KOSIS (보조)

주제별 통계에서 "인구" 노드를 펼치면 다음이 발생한다.

```text
POST /statisticsList/selectTreeData.do   트리 데이터 조회
POST /oneid/cmmn/login/ActiveSessionFind.do   세션 확인
POST /oneid/cmmn/login/ActiveSessionFind.do   세션 확인 (중복)
GET  /include/check.jsp                       헬스체크
```

주요 API 1건에 노이즈 3건이 붙는다. 세션 확인 API가 중복 호출되는 양상이 실거래가와 달라, 점수 정책을 다른 각도로 검증할 수 있다.

**미확인 사항:** `selectTreeData.do`의 응답 본문 형식을 확인하지 않았다. 트리 데이터이므로 JSON으로 추정하나, 1단계 착수 시 먼저 확인해야 한다. XML이면 보조 대상에서 제외한다.

### 3.3 탈락 사유

**공공데이터포털** — 데이터목록 화면에서 "오픈 API" 필터를 클릭하면 `GET /tcs/dss/selectDataSetList.do?dType=API&...`로 **페이지 전체가 이동**한다. 응답은 HTML이고, 비정적 요청은 Google Analytics뿐이다. Extension을 붙여도 수집되는 것이 없다.

단, 검증한 것은 검색 화면 하나다. 다른 화면은 XHR을 쓸 수 있으나, 대표 업무 화면이 수집되지 않는 사이트를 주력으로 삼을 이유가 없다.

**Grafana Play** — Synthetic Monitoring 화면 진입 한 번에 `/api/` 요청이 60건 이상 발생했고 대부분 PromQL 쿼리였다. 신호 대비 노이즈 비율이 극단적이며, 개별 요청이 업무 액션으로서 의미를 갖지 않는다.

다만 이 극단값은 §14 성능 요구사항(세션당 최대 5,000요청, Extension이 페이지 동작을 방해하지 않을 것)의 **부하 테스트 대상**으로 보존한다.

**나라장터** — WebSquare 기반이다(`websquare/serverTime.wq`, `_wpack_/`). 국산 UI 프레임워크로 요청·응답 형식이 표준 REST와 다를 수 있어 판정을 보류한다. 주력·보조가 확보됐으므로 추가 조사는 필요할 때 수행한다.

---

## 4. 최종 대상 사이트

| 역할 | 사이트 | 담당 단계 | 선정 근거 |
| --- | --- | --- | --- |
| 주력 | 국토교통부 실거래가 | 1~5a 전 구간 | JSON API 확인. 로그 API 노이즈 실물. 인증 없이 서버 직접 호출 가능 |
| 보조 | 국가통계포털 KOSIS | 1~3단계 | 노이즈 양상이 달라 점수 정책 교차 검증 |
| 부하 테스트 | Grafana Play | §14 성능 검증 | 클릭 1회 60요청 극단값 |

두 사이트 모두 로그인이 필요 없고 공개 정보만 다룬다. 개인정보가 포함된 화면을 기록하지 않으므로 공개 데모로 사용할 수 있다.

### 알려진 한계

**생성·수정 액션을 만들 수 없다.** 두 사이트 모두 조회 전용이므로 PRD §6.2 "데이터 생성 액션 등록" 시나리오를 검증할 수 없다. §21 MVP 완료 정의는 조회 액션 하나로 완주되므로 MVP 검증에는 지장이 없으나, 생성 경로의 파라미터 스키마 추론(Request Body 기반)은 검증되지 않은 채 남는다.

**공공 서버에 실제 요청을 보낸다.** 5단계 실행 테스트는 우리 서버가 `rt.molit.go.kr`에 직접 요청한다. 테스트 수준의 소량이면 브라우저를 여는 것과 다르지 않으나, 반복 실행 시 호출 간격을 최소 1초 이상 둔다.

---

## 5. 시나리오 문서 구조

사이트마다 다음 항목을 작성한다. 주력은 8개 전부, 보조는 1~5만 작성한다.

1. 사이트 개요 — URL, 로그인 요부, 공개 데모 가능 근거
2. 담당 단계
3. 기록 시나리오 — 브라우저에서 수행할 조작 순서
4. 기대 수집 결과 — 발생해야 할 요청 목록, 주요 API와 노이즈 구분
5. 기대 점수 결과 — §7.6 규칙 적용 시 순위
6. 기대 ActionSpec — 초안
7. LLM 테스트 질의 — 예시 질의와 기대 동작
8. 합격 판정 기준

---

## 6. 주력 시나리오 — 국토교통부 실거래가

### 6.1 사이트 개요

* URL: `https://rt.molit.go.kr`
* 로그인: 불필요
* 취급 정보: 아파트 실거래가 (법령에 따라 공개되는 정보)
* 공개 데모 가능 근거: 로그인이 없어 개인정보가 화면에 나타나지 않는다

### 6.2 담당 단계

1~5a 전 구간.

### 6.3 기록 시나리오

1. Extension에서 프로젝트를 선택하고 기록을 시작한다.
2. `https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=A&mobileAt=` 로 이동한다.
3. 지도를 광화문 일대로 이동하거나 확대한다.
4. 기록을 종료하고 서버로 전송한다.

### 6.4 기대 수집 결과

3번 조작에서 다음 세 요청이 수집되어야 한다.

| URL | Method | 성격 |
| --- | --- | --- |
| `/pt/gis/getMarker.do` | POST | **주요 API** — 단지 목록 |
| `/cmm/gis/getCenterLedCdPnu.do` | POST | 지도 보조 |
| `/pt/main/accesLog.do` | POST | 접속 로그 (노이즈) |

`getMarker.do`의 응답이 JSON으로 파싱되어야 한다. Content-Type이 `text/html`이므로 헤더 기반 판정으로는 실패한다.

### 6.5 기대 점수 결과

PRD §7.6 규칙을 적용한다. 지도 이동은 버튼 텍스트가 없으므로 "버튼 텍스트와 URL 의미 유사 +2"는 적용하지 않는다.

| 요청 | 계산 | 점수 |
| --- | --- | --- |
| `getMarker.do` | POST +3, XHR +2, 1초 이내 +2, 200 +1, 응답 있음 +1 | **9** |
| `getCenterLedCdPnu.do` | POST +3, XHR +2, 1초 이내 +2, 200 +1, 응답 있음 +1 | **9** |
| `accesLog.do` | 위와 동일 −5 (로그 API) | **4** |

`accesLog.do`가 최하위로 내려가는 것이 1차 합격 조건이다.

**현행 점수표의 한계가 드러난다.** `getMarker.do`와 `getCenterLedCdPnu.do`가 동점이다. 두 요청은 method·타이밍·상태코드·응답 유무가 모두 같아 현행 규칙으로 구분되지 않는다. 이 경우 §7.6의 "사용자는 자동 추천 결과와 관계없이 원하는 API를 직접 선택할 수 있어야 한다"에 의존한다. 동점 처리 규칙(응답 크기, 배열 응답 가산점 등)이 필요한지는 3단계에서 판단한다.

### 6.6 기대 ActionSpec

```json
{
  "actionId": "action_apartment_markers",
  "version": 1,
  "name": "아파트 단지 조회",
  "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
  "projectId": "project_molit_rt",
  "trigger": {
    "pageUrlPattern": "/pt/gis/gis.do",
    "selector": null,
    "elementText": "지도 이동"
  },
  "request": {
    "method": "POST",
    "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
    "headers": {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "<원본 요청에서 보존>",
      "Referer": "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=A&mobileAt=",
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json, text/javascript, */*; q=0.01"
    },
    "querySchema": null,
    "bodySchema": {
      "minX": { "type": "number", "description": "조회 영역 서쪽 경도", "required": true },
      "minY": { "type": "number", "description": "조회 영역 남쪽 위도", "required": true },
      "maxX": { "type": "number", "description": "조회 영역 동쪽 경도", "required": true },
      "maxY": { "type": "number", "description": "조회 영역 북쪽 위도", "required": true },
      "srhYear": { "type": "integer", "description": "조회 연도", "required": true },
      "poiType": { "type": "string", "description": "물건 종류 (A=아파트)", "required": true }
    }
  },
  "response": {
    "successStatus": [200],
    "schema": {
      "type": "object",
      "properties": {
        "list": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "aprpnHsmpCode": { "type": "string" },
              "aprpnHsmpNm": { "type": "string" },
              "signguCode": { "type": "string" },
              "lo": { "type": "number" },
              "la": { "type": "number" }
            }
          }
        }
      }
    }
  },
  "execution": {
    "authMode": "NONE",
    "credentialId": null,
    "requiresConfirmation": false
  }
}
```

`authMode`에 `NONE`이 필요하다. PRD §11 `ProjectCredential.auth_type`은 `API_KEY | OAUTH2 | SERVICE_ACCOUNT | BEARER_TOKEN`만 정의하고 있어 인증 없는 API를 표현할 수 없다.

### 6.7 LLM 테스트 질의

| 질의 | 기대 동작 |
| --- | --- |
| "광화문 근처 아파트 단지 알려줘" | `search_apartment_markers` 선택. 좌표를 광화문 인근 값으로 생성 |
| "서울시청 주변 아파트 뭐가 있어?" | 같은 툴 선택. 좌표만 달라짐 |
| "2024년 기준으로 조회해줘" | `srhYear`를 2024로 설정 |

LLM이 위경도를 직접 생성해야 한다. 지명 → 좌표 변환은 모델의 사전 지식에 의존하므로, 좌표 정확도가 낮으면 §7.8의 "예시값" 필드로 보완한다.

### 6.8 합격 판정 기준

| 단계 | 합격 조건 |
| --- | --- |
| 1 | Extension UI에 세 요청이 실시간으로 표시된다 |
| 2 | 서버로 전송되어 관리자 화면에서 조회된다 |
| 3 | `accesLog.do`가 후보 목록 최하위로 내려간다 |
| 4 | `getMarker.do`의 Body 파라미터 6개가 스키마로 추론된다. 응답 구조가 `list` 배열로 추론된다 |
| 5a | 테스트 콘솔에서 자연어 질의로 실행되어 단지 목록이 반환된다. WAF에 차단되지 않는다 |

---

## 7. 보조 시나리오 — 국가통계포털 KOSIS

### 7.1 사이트 개요

* URL: `https://kosis.kr`
* 로그인: 불필요
* 취급 정보: 국가 통계 (공개 정보)

### 7.2 담당 단계

1~3단계. 조회 전용이며 응답 형식이 미확인이므로 4단계 이후는 담당하지 않는다.

### 7.3 기록 시나리오

1. 기록을 시작한다.
2. `https://kosis.kr/statisticsList/statisticsListIndex.do?menuId=M_01_01&vwcd=MT_ZTITLE` 로 이동한다.
3. 주제별 통계에서 "인구" 노드를 클릭해 펼친다.
4. 기록을 종료한다.

### 7.4 기대 수집 결과

| URL | Method | 성격 |
| --- | --- | --- |
| `/statisticsList/selectTreeData.do` | POST | **주요 API** |
| `/oneid/cmmn/login/ActiveSessionFind.do` | POST | 세션 확인 (노이즈) |
| `/oneid/cmmn/login/ActiveSessionFind.do` | POST | 세션 확인 중복 (노이즈) |
| `/include/check.jsp` | GET | 헬스체크 (노이즈) |

### 7.5 기대 점수 결과

`selectTreeData.do`가 1순위여야 한다. `ActiveSessionFind.do`는 동일 URL이 짧은 간격으로 2회 호출되므로 §7.6의 "반복 Polling 요청 −3"이 적용되는지 확인한다. 적용되지 않는다면 폴링 판정 규칙에 "동일 URL 중복 호출" 조건을 추가할지 3단계에서 결정한다.

---

## 8. 이 조사에서 도출된 PRD 변경사항

실측 과정에서 PRD를 수정해야 할 항목이 나왔다. 별도 작업으로 반영한다.

| # | 위치 | 변경 내용 | 근거 |
| --- | --- | --- | --- |
| 1 | §7.4 수집 제외 판정 | Content-Type이 아니라 **본문 파싱 시도**를 기준으로 JSON 여부를 판정한다 | `getMarker.do`가 JSON을 `text/html`로 반환 |
| 2 | §7.7 ActionSpec | 요청 헤더 중 마스킹 대상을 제외한 나머지(`User-Agent`, `Referer`, `X-Requested-With`, `Accept`)를 보존하고 실행 시 재현한다 | 헤더 없이 호출하면 WAF가 400으로 차단 |
| 3 | §11 `ProjectCredential` | `auth_type`에 `NONE`을 추가한다 | 인증 없는 공개 API를 표현할 수 없음 |
| 4 | §3.2 성공 기준 | "MCP Tool 형태로 노출" → 테스트 콘솔 내부로 한정 | 5a 범위 결정 |
| 5 | §12 MCP 엔드포인트 | 6단계로 이동 | 5a 범위 결정 |
| 6 | §16 MVP 제외 | "외부 MCP 클라이언트 연동" 추가 | 5a 범위 결정 |
| 7 | §17 5단계 | MCP 프로토콜 구현 항목을 6단계로 이동 | 5a 범위 결정 |
| 8 | §8.2, §11 | MCP 접속 토큰 관리 화면·테이블을 6단계로 이동 | 5a 범위 결정 |
| 9 | §20.2 | "MVP 대상 웹사이트" 항목을 확정 처리하고 §20.1로 이동 | 본 문서 |

4~8번은 5단계 범위를 5a(테스트 콘솔)까지로 한정한 결정에 따른 것이다. 외부 MCP 클라이언트 연동은 6단계로 미룬다.

---

## 9. 남은 제약과 후속 과제

| 항목 | 내용 | 처리 시점 |
| --- | --- | --- |
| KOSIS 응답 형식 미확인 | `selectTreeData.do`가 JSON인지 확인. XML이면 보조 대상에서 제외 | 1단계 착수 시 |
| 생성 액션 미검증 | 조회 전용 사이트만 선정되어 §6.2 시나리오와 Request Body 기반 스키마 추론이 검증되지 않는다 | 4단계에서 대상 재검토 |
| 동점 처리 규칙 | `getMarker.do`와 `getCenterLedCdPnu.do`가 §7.6 규칙으로 구분되지 않는다 | 3단계에서 판단 |
| 폴링 판정 규칙 | 동일 URL 중복 호출을 폴링으로 볼지 | 3단계에서 판단 |
| 나라장터 보류 | WebSquare 응답 형식 미확인 | 필요 시 |
| 호출 간격 | 5단계 반복 실행 시 공공 서버 부하를 고려해 최소 1초 간격 | 5단계 구현 시 |

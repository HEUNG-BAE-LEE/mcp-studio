# Web Action MCP Builder PRD

* 문서 버전: v0.3
* 문서 상태: Draft (대상 사이트 실측 결과 반영, 2026-07-26)
* 제품 유형: Chrome Extension 기반 Web Action 분석 및 MCP 생성 프레임워크
* 프로젝트 가칭: Web Action MCP Builder
* 주요 사용자: AI 서비스 개발자, 업무 자동화 개발자, API 연동 담당자, 사내 서비스 운영자

---

## 1. 제품 개요

### 1.1 제품 정의

Web Action MCP Builder는 사용자가 웹 서비스에서 수행하는 클릭과 입력 등의 행동을 기록하고, 해당 행동으로 인해 호출되는 API를 분석하여 하나의 실행 가능한 액션으로 정의하는 프레임워크다.

사용자는 별도의 API 문서를 직접 분석하지 않고도 웹 화면에서 실제 업무를 수행하면서 주요 API를 식별할 수 있으며, 선택한 액션을 MCP Tool 형태로 변환해 LLM 또는 AI Agent에서 호출하고 테스트할 수 있다.

### 1.2 핵심 사용자 흐름

1. 사용자가 분석할 웹사이트를 등록한다.
2. Chrome Extension에서 액션 기록을 시작한다.
3. 사용자가 웹페이지의 버튼, 링크, 입력 요소 등을 조작한다.
4. 클릭 이벤트와 해당 시점에 발생한 API 요청을 함께 수집한다.
5. 시스템이 클릭 이벤트와 API 요청의 연관성을 분석한다.
6. 시스템이 주요 API 후보를 사용자에게 제시한다.
7. 사용자가 실제 업무 액션에 해당하는 API를 선택한다.
8. 시스템이 요청 파라미터와 응답 구조를 분석한다.
9. 액션을 표준 ActionSpec으로 저장한다.
10. 저장된 액션을 MCP Tool로 생성한다.
11. 사용자가 자연어 질의를 입력해 LLM 기반으로 액션을 테스트한다.
12. 실행 결과와 오류, 요청·응답 로그를 확인한다.

---

## 2. 개발 배경

웹 기반 업무 서비스에는 다양한 기능과 API가 존재하지만 다음과 같은 이유로 AI Agent와 연동하기 어렵다.

* API 문서가 존재하지 않거나 최신 상태가 아니다.
* 화면 기능과 실제 호출 API 간 관계를 파악하기 어렵다.
* 개발자가 브라우저 개발자 도구에서 직접 네트워크 요청을 분석해야 한다.
* 인증과 세션이 필요한 API는 외부 환경에서 재현하기 어렵다.
* API를 MCP Tool로 변환하려면 파라미터와 응답 구조를 별도로 정의해야 한다.
* 동일한 화면 조작에서 분석용 API, 로그 API, 조회 API 등 여러 요청이 동시에 발생한다.

본 제품은 실제 사용자 행동을 기준으로 API를 탐색하고, 이를 AI가 실행할 수 있는 액션으로 변환하는 과정을 표준화하는 것을 목적으로 한다.

---

## 3. 제품 목표

### 3.1 핵심 목표

* 웹페이지의 사용자 행동과 API 호출을 함께 기록한다.
* 하나의 사용자 행동에 대응하는 주요 API를 식별한다.
* API 요청 정보를 재사용 가능한 ActionSpec으로 변환한다.
* ActionSpec을 기반으로 MCP Tool을 생성한다.
* 생성된 MCP Tool을 LLM에서 자연어로 테스트할 수 있도록 한다.
* 인증정보와 민감정보를 안전하게 처리한다.
* 개발자가 아닌 사용자도 화면을 통해 액션을 등록할 수 있도록 한다.

### 3.2 성공 기준

MVP 단계에서는 다음 조건을 만족해야 한다.

* 사용자가 Extension에서 기록을 시작하고 종료할 수 있다.
* 클릭 이벤트와 `fetch` 또는 `XMLHttpRequest` API 호출을 수집할 수 있다.
* 클릭과 API 요청을 시간 기준으로 연결할 수 있다.
* 하나의 클릭에 대해 API 후보 목록을 제공할 수 있다.
* 사용자가 주요 API를 직접 선택할 수 있다.
* 선택한 API를 ActionSpec으로 저장할 수 있다.
* ActionSpec을 MCP Tool 스키마로 변환할 수 있다.
* LLM 테스트 콘솔에서 LLM이 생성된 Tool을 호출할 수 있다. 외부 MCP 클라이언트 연동은 MVP 범위가 아니다.
* 실행 결과를 관리자 화면에서 확인할 수 있다.

---

## 4. 비목표

MVP에서는 다음 항목을 우선 지원하지 않는다.

* 모든 웹사이트와 브라우저에 대한 완전한 호환성
* 네이티브 모바일 앱의 사용자 행동 분석
* API 비즈니스 의미의 완전 자동 판별
* 복잡한 멀티스텝 업무 프로세스의 완전 자동 생성
* WebSocket 기반 양방향 통신의 완전한 분석
* CAPTCHA, OTP 등 사용자 개입이 필요한 인증 자동화
* 웹사이트의 보안 정책을 우회하는 기능
* 브라우저 로그인 없이 임의의 사용자 권한을 재현하는 기능
* 모든 API를 무인 자동 실행할 수 있도록 변환하는 기능

---

## 5. 사용자 유형

### 5.1 AI 서비스 개발자

웹 서비스의 기능을 AI Agent Tool로 연결하려는 사용자다.

주요 요구사항:

* 어떤 화면 기능이 어떤 API를 호출하는지 확인
* API 파라미터와 응답 구조 분석
* MCP Tool 자동 생성
* LLM 호출 테스트
* 실행 로그와 오류 원인 확인

### 5.2 업무 서비스 개발자

기존 웹 서비스의 기능을 AI에서 활용할 수 있도록 제공하려는 사용자다.

주요 요구사항:

* 기존 서비스 변경 최소화
* 인증 및 권한 정책 유지
* API 호출 범위 제어
* 액션 버전 관리
* 잘못된 API 실행 방지

### 5.3 서비스 운영자 및 도메인 담당자

업무적으로 의미 있는 액션을 선택하고 이름과 설명을 정의하는 사용자다.

주요 요구사항:

* 화면 중심의 쉬운 등록 방식
* API 기술 지식 없이 주요 기능 선택
* 액션 이름과 설명 수정
* 입력값과 출력값 의미 정의
* 테스트 결과 확인

---

## 6. 주요 사용 시나리오

### 6.1 단일 조회 액션 등록

사용자가 고객 목록 화면에서 검색 버튼을 클릭한다.

시스템은 다음 API를 감지한다.

* 사용자 행동 로그 API
* 검색조건 저장 API
* 고객 목록 조회 API

시스템은 호출 시점, HTTP Method, URL, 응답 데이터 등을 분석해 고객 목록 조회 API를 가장 높은 우선순위로 제안한다.

사용자는 해당 API를 선택하고 액션 이름을 `고객 목록 조회`로 등록한다.

### 6.2 데이터 생성 액션 등록

사용자가 신규 거래처 정보를 입력하고 저장 버튼을 클릭한다.

시스템은 `POST /customers` 요청을 주요 API 후보로 제안한다.

사용자는 요청 Body의 각 필드를 다음과 같이 정의한다.

* `companyName`: 회사명
* `businessNumber`: 사업자등록번호
* `representativeName`: 대표자명

시스템은 입력 스키마를 생성하고 MCP Tool로 변환한다.

### 6.3 LLM 테스트

사용자가 테스트 화면에서 다음과 같이 입력한다.

> 사업자등록번호가 123-45-67890인 거래처를 등록해줘.

LLM은 등록된 MCP Tool 중 `거래처 등록` 액션을 선택하고 파라미터를 생성한다.

실행 전 사용자는 최종 요청 정보를 확인하고 실행한다.

시스템은 API 응답과 성공 여부를 표시한다.

---

## 7. 전체 기능 범위

### 7.1 프로젝트 관리

사용자는 분석 대상 웹 서비스를 프로젝트 단위로 관리한다.

필수 기능:

* 프로젝트 생성
* 프로젝트명 입력
* 대상 웹사이트 URL 등록
* URL 패턴 등록
* 프로젝트 설명 입력
* 프로젝트 활성화 및 비활성화
* 프로젝트별 액션 목록 조회
* 프로젝트별 MCP 서버 설정
* 프로젝트별 허용 도메인 관리

프로젝트 예시:

```json
{
  "projectId": "project_001",
  "name": "SmartA Web Actions",
  "description": "SmartA 주요 업무 기능 MCP 변환 프로젝트",
  "allowedOrigins": [
    "https://smarta.example.com"
  ],
  "status": "ACTIVE"
}
```

---

### 7.2 Chrome Extension 연결

관리자 서버에서 생성된 프로젝트를 Chrome Extension과 연결한다.

필수 기능:

* Extension 로그인
* 프로젝트 선택
* 대상 사이트 확인
* 연결 상태 표시
* 기록 세션 시작
* 기록 일시정지
* 기록 종료
* 세션 초기화
* 수집 결과 서버 전송

Extension은 Chrome Side Panel 형태로 제공한다.

---

### 7.3 사용자 행동 기록

기록 대상:

* 클릭
* 링크 이동
* 버튼 선택
* 폼 제출
* 입력값 변경
* 드롭다운 선택
* 체크박스 선택
* 라디오 버튼 선택

클릭 이벤트 기본 수집 정보:

```json
{
  "interactionId": "interaction_uuid",
  "timestamp": "2026-07-26T12:00:00+09:00",
  "pageUrl": "https://example.com/customers",
  "eventType": "click",
  "element": {
    "tagName": "BUTTON",
    "text": "조회",
    "selector": "#customer-search-button",
    "role": "button",
    "ariaLabel": "고객 조회",
    "dataTestId": "customer-search"
  }
}
```

선택자 생성 우선순위:

1. 고유 ID
2. `data-testid`
3. `aria-label`
4. `name`
5. 역할과 텍스트
6. CSS 계층 경로
7. `nth-of-type`

비밀번호 필드와 민감한 입력값은 기록하지 않는다.

---

### 7.4 네트워크 요청 기록

MVP 수집 대상:

* Fetch API
* XMLHttpRequest
* 일반적인 REST API
* GraphQL HTTP 요청

수집 정보:

* 요청 발생 시각
* 요청 URL
* HTTP Method
* 요청 Header
* Query Parameter
* Request Body
* 응답 상태 코드
* 응답 Header
* Response Body 구조 및 샘플 1건
* 요청 처리 시간
* 요청 유형
* 발생 페이지
* 연관된 사용자 행동 ID

수집 제외 대상:

* 이미지
* CSS
* JavaScript 정적 파일
* Font
* 브라우저 확장 리소스
* OPTIONS 요청
* Analytics 요청
* 광고 및 추적 요청
* 주기적인 Health Check
* 반복 Polling 요청

JSON 여부 판정:

응답이 JSON인지는 **Content-Type 헤더가 아니라 본문 파싱 시도**로 판정한다. 국내 공공기관 사이트에는 JSON을 반환하면서 Content-Type을 `text/html`로 내려보내는 사례가 흔하다. 국토교통부 실거래가의 `getMarker.do`가 그렇다. 헤더를 기준으로 판정하면 정상 응답을 폐기하게 된다.

민감정보 마스킹 규칙:

마스킹은 2단계로 적용한다.

* 1차: Chrome Extension에서 서버로 전송하기 전에 적용
* 2차: Backend에서 저장하기 전에 재검사

치환값은 `***` 고정이며, **키 이름은 보존한다.** 어떤 인증 방식을 사용하는 API인지가 ActionSpec의 `authMode` 추론에 필요하기 때문이다. 값을 해시로 남기지 않는다.

규칙 1 — 헤더 이름 기준, 값 전체 치환:

* `Authorization`
* `Cookie`
* `Set-Cookie`
* `Proxy-Authorization`
* `X-API-Key`, `X-Auth-Token`
* 이름에 `token`, `secret`, `key`, `auth`가 포함된 모든 헤더

규칙 2 — Body 및 Query 파라미터 키 이름 기준, 값 치환:

* `password`, `passwd`, `pwd`
* `secret`, `token`, `accessToken`, `refreshToken`
* `apiKey`, `sessionId`
* `ssn`, `jumin`, `cardNumber`, `cvv`

규칙 3 — 값 패턴 기준, 키 이름과 무관하게 적용:

| 대상       | 정규식                                                 |
| -------- | --------------------------------------------------- |
| 주민등록번호   | `\d{6}-\d{7}`                                        |
| 카드번호     | `\d{4}-?\d{4}-?\d{4}-?\d{4}`                         |
| JWT      | `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`  |

---

#### 응답 Body 저장 정책

응답 본문은 원문을 저장하지 않고 **구조와 샘플 1건**만 저장한다.

* 객체: 모든 필드의 키와 타입을 보존하고 값은 1건만 남긴다.
* 배열: 첫 번째 요소만 값을 남기고 나머지는 개수만 기록한다.
* 저장 결과에도 위의 마스킹 규칙을 동일하게 적용한다.

고객 목록 조회처럼 응답에 개인정보가 수백 건 포함될 수 있는 API에서 노출 범위를 1건으로 제한하기 위한 것이다. ActionSpec의 `response.schema` 생성에는 구조만 필요하며, 샘플 1건은 사용자가 주요 API 후보를 선택할 때 확인용으로 사용한다.

---

### 7.5 클릭과 API 요청 연결

시스템은 사용자 행동과 네트워크 요청을 다음 기준으로 연결한다.

* 클릭 후 일정 시간 안에 발생했는가
* 동일한 브라우저 탭에서 발생했는가
* 동일한 페이지에서 발생했는가
* API URL과 버튼 텍스트가 의미적으로 유사한가
* 변경성 HTTP Method를 사용하는가
* 요청 결과가 성공했는가
* API 응답이 화면 변화와 연관되는가

기본 연관 시간 범위:

* 권장 기본값: 클릭 이후 5초
* 프로젝트별 설정 가능
* 사용자가 수동으로 연결 수정 가능

---

### 7.6 주요 API 후보 분석

각 API 요청에 점수를 부여해 주요 API 후보를 정렬한다.

초기 점수 정책:

| 조건                       |  점수 |
| ------------------------ | --: |
| POST, PUT, PATCH, DELETE |  +3 |
| Fetch 또는 XHR 요청          |  +2 |
| 클릭 후 1초 이내 발생            |  +2 |
| HTTP 상태 코드 200~299       |  +1 |
| 버튼 텍스트와 URL 의미 유사        |  +2 |
| 응답 데이터가 존재함              |  +1 |
| 정적 리소스                   | -10 |
| OPTIONS 요청               | -10 |
| Analytics 또는 로그 API      |  -5 |
| 반복 Polling 요청            |  -3 |
| 응답 실패                    |  -2 |

후보 API 표시 정보:

* API URL
* HTTP Method
* 요청 발생 시각
* 응답 상태
* 처리 시간
* 요청 Body
* 응답 미리보기
* 추천 점수
* 추천 사유
* 동일 클릭에서 발생한 전체 요청 수

사용자는 자동 추천 결과와 관계없이 원하는 API를 직접 선택할 수 있어야 한다.

---

### 7.7 액션 정의

사용자가 주요 API를 선택하면 하나의 액션으로 등록한다.

필수 등록 항목:

* 액션명
* 액션 설명
* 액션 카테고리
* 연결된 프로젝트
* 발생 페이지
* 트리거 요소
* HTTP Method
* API URL
* 요청 Header 정책
* Path Parameter
* Query Parameter
* Request Body
* Response Schema
* 인증 실행 방식
* 실행 전 사용자 확인 여부
* 활성화 상태

요청 Header 정책:

기록된 요청 헤더 중 §7.4의 마스킹 대상을 제외한 나머지를 ActionSpec에 보존하고, 실행 시 그대로 재현한다. 특히 `User-Agent`, `Referer`, `X-Requested-With`, `Accept`가 대상이다.

WAF가 이들 헤더를 검사하는 사이트가 있다. 국토교통부 실거래가는 이 헤더 없이 호출하면 `400 Request Blocked`를 반환하고, 브라우저와 동일한 헤더를 붙이면 정상 응답한다. 이들은 민감정보가 아니므로 마스킹 규칙과 충돌하지 않는다.

ActionSpec 예시:

```json
{
  "actionId": "action_customer_search",
  "version": 1,
  "name": "고객 목록 조회",
  "description": "조건에 맞는 고객 목록을 조회합니다.",
  "projectId": "project_001",
  "trigger": {
    "pageUrlPattern": "/customers",
    "selector": "#customer-search-button",
    "elementText": "조회"
  },
  "request": {
    "method": "GET",
    "urlTemplate": "https://example.com/api/customers",
    "headers": {
      "Content-Type": "application/json",
      "User-Agent": "<원본 요청에서 보존>",
      "Referer": "https://example.com/customers",
      "X-Requested-With": "XMLHttpRequest"
    },
    "querySchema": {
      "companyName": {
        "type": "string",
        "description": "검색할 회사명",
        "required": false
      }
    },
    "bodySchema": null
  },
  "response": {
    "successStatus": [
      200
    ],
    "schema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  },
  "execution": {
    "authMode": "API_KEY",
    "credentialId": "cred_001",
    "requiresConfirmation": false
  }
}
```

---

### 7.8 파라미터 스키마 편집

시스템은 실제 요청 데이터를 기반으로 파라미터 스키마 초안을 생성한다.

사용자는 각 파라미터에 대해 다음 정보를 수정할 수 있다.

* 파라미터 이름
* 사용자에게 표시되는 이름
* 설명
* 데이터 타입
* 필수 여부
* 기본값
* 예시값
* Enum 후보
* 민감정보 여부
* LLM 입력 허용 여부
* 고정값 여부
* 시스템 자동 주입 여부

지원 데이터 타입:

* string
* integer
* number
* boolean
* array
* object
* date
* datetime
* enum

파라미터 분류:

* LLM이 생성하는 입력값
* 사용자가 직접 입력하는 값
* 브라우저 세션에서 가져오는 값
* 시스템 환경설정에서 주입하는 값
* 고정된 상수값
* 이전 액션 결과에서 전달되는 값

---

### 7.9 인증 및 실행 방식

두 가지 실행 방식을 정의하되, **MVP에서는 서버 직접 실행만 구현한다.** 브라우저 릴레이 실행은 6단계 이후로 미룬다.

이 결정에 따라 Chrome Extension은 MVP에서 기록 전용으로 동작하며, Extension과 서버 사이의 통신은 기록 데이터의 단방향 업로드로 한정된다. 상시 연결이나 명령 수신 루프는 필요하지 않다.

#### 서버 직접 실행 (MVP 채택)

흐름:

```text
LLM
→ MCP Server
→ 대상 서비스 API
```

사용 가능한 인증 방식:

* API Key
* OAuth 2.0
* 서비스 계정
* 별도 발급 토큰

장점:

* 브라우저 없이 실행 가능
* 서버 자동화에 적합
* 운영 환경 적용이 용이함

제약:

* 대상 서비스에서 별도의 API 인증을 제공해야 함
* 사용자별 세션을 그대로 사용하기 어려움
* 인증정보를 서버가 보관해야 하므로 별도의 보안 저장소가 필요함

이 방식을 채택함에 따라 프로젝트별 자격증명 저장 기능이 추가로 필요하다. §11의 `ProjectCredential` 참조.

#### 브라우저 릴레이 실행 (MVP 제외 · 후속 과제)

흐름:

```text
LLM
→ MCP Server
→ Chrome Extension
→ 로그인된 브라우저 세션
→ 대상 서비스 API
```

장점:

* 현재 로그인된 사용자의 권한 활용 가능
* 별도의 API 인증 체계가 없는 서비스에도 적용 가능
* 기존 웹서비스 변경을 최소화할 수 있음

제약:

* Chrome Extension이 실행 중이어야 함
* 사용자의 브라우저가 연결된 상태여야 함
* 자동화 실행에 대한 사용자 확인 정책이 필요함

보안 원칙:

* Cookie 원문을 서버에 저장하지 않는다.
* Authorization Header 원문을 저장하지 않는다.
* 세션 토큰을 ActionSpec에 포함하지 않는다.
* 인증값은 실행 시점에만 브라우저 또는 보안 저장소에서 주입한다.
* 중요한 변경성 액션은 기본적으로 사용자 확인 후 실행한다.

---

### 7.10 MCP Tool 생성

저장된 ActionSpec을 기반으로 MCP Tool을 생성한다.

MCP Tool 생성 항목:

* Tool 이름
* Tool 설명
* Input Schema
* 실행 Endpoint
* 인증 방식
* 결과 변환 규칙
* 오류 응답 형식
* 실행 확인 정책

예시:

```json
{
  "name": "search_customers",
  "description": "회사명 등의 검색조건으로 고객 목록을 조회합니다.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "companyName": {
        "type": "string",
        "description": "검색할 회사명"
      }
    }
  }
}
```

Tool 이름 생성 규칙:

* 영문 소문자 사용
* 단어 구분은 `_` 사용
* 프로젝트 내 중복 불가
* 동사와 대상 객체 조합 권장

예시:

* `search_customers`
* `create_customer`
* `update_invoice`
* `delete_draft`
* `approve_document`

---

### 7.11 LLM 테스트

사용자는 등록된 액션을 LLM 기반으로 테스트할 수 있다.

테스트 화면 구성:

* 자연어 질의 입력
* LLM 모델 선택
* 사용 가능한 MCP Tool 목록
* 선택된 Tool 표시
* 생성된 입력 파라미터 표시
* 실행 전 확인
* API 요청 결과 표시
* 응답 요약
* 오류 메시지
* 전체 실행 로그

테스트 단계:

1. 사용자가 자연어 질의를 입력한다.
2. LLM이 적절한 Tool을 선택한다.
3. LLM이 입력 파라미터를 생성한다.
4. 시스템이 스키마 유효성을 검사한다.
5. 변경성 액션은 사용자 확인을 요청한다.
6. MCP Tool을 실행한다.
7. 결과를 LLM이 사용자 친화적인 형태로 변환한다.
8. 전체 과정을 로그로 저장한다.

---

### 7.12 실행 로그

필수 로그 항목:

* 실행 ID
* 사용자
* 프로젝트
* 액션
* 액션 버전
* 실행 일시
* 사용자 자연어 질의
* 선택된 Tool
* 입력 파라미터
* 실행 방식
* 대상 API
* 응답 상태
* 처리 시간
* 성공 여부
* 오류 유형
* 사용자 확인 여부

민감한 요청값은 마스킹하여 저장한다.

---

### 7.13 버전 관리

액션이 수정될 때 기존 정의를 덮어쓰지 않고 새로운 버전을 생성한다.

필수 기능:

* 액션 버전 조회
* 이전 버전과 비교
* 이전 버전 복원
* 현재 운영 버전 지정
* 변경 사용자 및 변경 시각 기록
* 변경 사유 기록

---

## 8. 화면 구성

### 8.1 프로젝트 목록

표시 항목:

* 프로젝트명
* 대상 도메인
* 액션 수
* 활성화 상태
* 최근 수정일
* 최근 기록 세션

주요 기능:

* 프로젝트 생성
* 프로젝트 검색
* 활성화 상태 변경
* 프로젝트 삭제
* 프로젝트 상세 이동

---

### 8.2 프로젝트 상세

구성 영역:

* 프로젝트 기본정보
* 대상 URL 설정
* Extension 연결 상태
* 등록 액션 목록
* 최근 기록 세션
* 자격증명 관리
* MCP 서버 상태 및 접속 토큰 관리 (6단계)
* 실행 로그

---

### 8.3 Chrome Extension Side Panel

필수 구성:

* 현재 프로젝트
* 현재 페이지 URL
* 대상 도메인 일치 여부
* 기록 시작 버튼
* 기록 중지 버튼
* 기록 초기화 버튼
* 클릭 이벤트 목록
* API 요청 목록
* 클릭별 API 후보
* 서버 전송 버튼

상태 표시:

* 연결됨
* 대상 사이트 아님
* 기록 중
* 기록 일시정지
* 서버 연결 실패
* 데이터 전송 완료

---

### 8.4 기록 세션 상세

표시 정보:

* 기록 시작 및 종료 시각
* 방문한 URL
* 클릭 이벤트 목록
* 클릭별 네트워크 요청
* API 추천 점수
* 선택된 주요 API
* 제외된 API
* 수집 오류

---

### 8.5 액션 편집

화면 구성:

1. 기본정보
2. 화면 트리거
3. 요청 URL
4. 요청 파라미터
5. 응답 구조
6. 인증 방식
7. 실행 정책
8. MCP Tool 정보
9. 테스트

---

### 8.6 LLM 테스트 콘솔

화면 구성:

* 대화형 질의 입력창
* 사용 Tool 제한 설정
* LLM 호출 결과
* 선택된 Tool과 선택 사유
* 입력 파라미터
* API 실행 결과
* 응답 Body
* 실행 로그
* 오류 상세

---

## 9. 시스템 아키텍처

```text
┌─────────────────────────────────────────┐
│              Target Web App             │
│                                         │
│  DOM Event       Fetch / XHR / GraphQL  │
└──────────────┬───────────────┬──────────┘
               │               │
               ▼               ▼
┌─────────────────────────────────────────┐
│            Chrome Extension             │
│                                         │
│  Content Script                         │
│  - Click Recording                      │
│  - Element Metadata                     │
│                                         │
│  Main World Network Hook                │
│  - Fetch / XHR Capture                  │
│  - Request / Response Metadata          │
│                                         │
│  Background Service Worker              │
│  - Session Management                   │
│  - Message Routing                      │
│                                         │
│  Side Panel                             │
│  - Recording Control                    │
│  - Candidate API Selection              │
└───────────────────┬─────────────────────┘
                    │ HTTPS (기록 데이터 단방향 업로드)
                    ▼
┌─────────────────────────────────────────┐
│           Framework Backend             │
│                                         │
│  Project API                            │
│  Recording API                          │
│  ActionSpec API                         │
│  API Correlation Engine                 │
│  Schema Generator                       │
│  Action Version Manager                 │
│  Execution Gateway                      │
│  Credential Store                       │
│  Audit Log                              │
└───────────────────┬─────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│    MCP Server    │   │    PostgreSQL    │
│  Streamable HTTP │   │ Organization     │
│ Tool Registry    │   │ Project          │
│ Tool Execution   │   │ Session          │
│ Schema Exposure  │   │ ActionSpec       │
└────────┬─────────┘   │ Version / Log    │
         │             └──────────────────┘
         ▼
┌─────────────────────────────────────────┐
│              LLM / AI Agent             │
└─────────────────────────────────────────┘
```

---

## 10. 권장 기술 스택

### Chrome Extension

* WXT
* React
* TypeScript
* Manifest V3
* Chrome Side Panel
* Chrome Storage Session
* Chrome Runtime Messaging

### Backend

선택안 1:

* FastAPI
* Uvicorn
* Pydantic
* SQLAlchemy
* PostgreSQL

선택안 2:

* Django
* Django REST Framework
* PostgreSQL

MVP와 비동기 API 중심 구조에는 FastAPI를 우선 권장한다.

### Frontend 관리자 화면

* React
* TypeScript
* Vite 또는 Next.js
* TanStack Query
* React Hook Form
* JSON Schema 기반 Form Renderer

### MCP

* Python MCP SDK (Backend와 동일 프로세스에 마운트하는 것을 권장)
* 전송 방식은 Streamable HTTP (JSON-RPC 2.0)
* ActionSpec 기반 동적 Tool Registry
* 프로젝트별 MCP Endpoint 분리

### 인프라

* Docker
* Nginx
* PostgreSQL
* Redis 선택 적용
* OpenTelemetry 또는 Elastic APM
* 중앙 로그 저장소

### 저장소 구조

세 덩어리를 단일 모노레포로 관리한다. ActionSpec 스키마를 Extension과 관리자 화면이 공유하기 때문이다.

```text
mcp-studio/
├── apps/
│   ├── extension/     Chrome Extension (WXT + React + TS)
│   ├── backend/       FastAPI + MCP Server (Python)
│   └── admin/         관리자 화면 (React + TS)
└── packages/
    └── schema/        ActionSpec 등 공유 타입 정의
```

---

## 11. 데이터 모델

### Organization

```text
id
name
status
created_at
updated_at
```

MVP에서는 단일 조직으로 고정 운영한다. 외부 사용자에게 제공하는 단계로 확장할 때 테넌트 분리의 기준이 되므로, 사용하지 않더라도 테이블은 처음부터 둔다.

### Project

```text
id
organization_id
name
description
allowed_origins
status
created_by
created_at
updated_at
```

### ProjectCredential

```text
id
project_id
name
auth_type          NONE | API_KEY | OAUTH2 | SERVICE_ACCOUNT | BEARER_TOKEN
encrypted_value
target_origin
expires_at
created_by
created_at
updated_at
```

서버 직접 실행에 필요한 대상 서비스의 인증정보를 보관한다. 값은 암호화하여 저장하고 API 응답으로 반환하지 않는다. 실행 시점에만 복호화하여 요청에 주입한다.

### McpAccessToken

```text
id
project_id
name
token_hash
last_used_at
expires_at
created_by
created_at
revoked_at
```

LLM 클라이언트가 프로젝트별 MCP 엔드포인트에 접속할 때 사용하는 Bearer 토큰이다. 원문은 발급 시 1회만 노출하고 해시만 저장한다.

### RecordingSession

```text
id
project_id
user_id
browser_tab_id
started_at
ended_at
status
page_urls
extension_version
```

### InteractionEvent

```text
id
session_id
interaction_id
event_type
page_url
element_selector
element_text
element_metadata
occurred_at
```

### NetworkRequest

```text
id
session_id
interaction_id
request_url
request_method
request_headers
request_query
request_body
response_status
response_headers
response_body_preview
duration_ms
request_type
occurred_at
```

### Action

```text
id
project_id
name
tool_name
description
category
active_version
status
created_by
created_at
updated_at
```

### ActionVersion

```text
id
action_id
version
action_spec
change_reason
created_by
created_at
```

### ExecutionLog

```text
id
project_id
action_id
action_version
user_id
natural_language_query
tool_input
execution_mode
response_status
response_preview
duration_ms
success
error_code
created_at
```

---

## 12. Backend API 초안

### 프로젝트

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/{projectId}
PUT    /api/projects/{projectId}
DELETE /api/projects/{projectId}
```

### 기록 세션

```text
POST /api/projects/{projectId}/recording-sessions
POST /api/recording-sessions/{sessionId}/events
POST /api/recording-sessions/{sessionId}/network-requests
POST /api/recording-sessions/{sessionId}/complete
GET  /api/recording-sessions/{sessionId}
```

### API 후보 분석

```text
POST /api/recording-sessions/{sessionId}/analyze
GET  /api/recording-sessions/{sessionId}/candidates
```

### 액션

```text
POST /api/projects/{projectId}/actions
GET  /api/projects/{projectId}/actions
GET  /api/actions/{actionId}
PUT  /api/actions/{actionId}
POST /api/actions/{actionId}/versions
POST /api/actions/{actionId}/activate
```

### 테스트

```text
POST /api/actions/{actionId}/dry-run
POST /api/actions/{actionId}/execute
POST /api/projects/{projectId}/llm-test
GET  /api/executions/{executionId}
```

### MCP (5b단계 · 6단계로 이월)

아래 엔드포인트는 MVP 범위가 아니다. MVP에서는 §7.11 LLM 테스트 콘솔이 Tool Registry를 직접 사용한다.

MCP는 REST가 아니라 JSON-RPC 2.0 기반 프로토콜이다. 전송 방식은 Streamable HTTP를 사용하며, 프로젝트마다 단일 엔드포인트를 노출한다.

```text
POST /mcp/{projectId}          JSON-RPC 요청 (응답: JSON 또는 SSE)
GET  /mcp/{projectId}          SSE 스트림 (서버 → 클라이언트 알림)
GET  /mcp/{projectId}/health
```

지원 JSON-RPC 메서드:

| 메서드                               | 설명                            |
| --------------------------------- | ----------------------------- |
| `initialize`                      | 프로토콜 핸드셰이크                    |
| `tools/list`                      | 활성 액션 목록을 MCP Tool 형태로 반환     |
| `tools/call`                      | 액션 실행                         |
| `notifications/tools/list_changed` | 액션 활성화 상태 변경 시 서버가 발송         |

`notifications/tools/list_changed`는 §7.13 버전 관리와 연동된다. 액션의 활성화 상태나 운영 버전이 바뀌면 이 알림을 발송하여, 접속 중인 클라이언트가 재접속 없이 Tool 목록을 갱신하도록 한다.

인증:

* 프로젝트별 Bearer 토큰을 `Authorization` 헤더로 전달한다.
* 인증 처리는 별도 미들웨어로 분리하여, 외부 제공 단계에서 OAuth 2.1로 교체할 수 있도록 설계한다.

관리자 화면에서 Tool 목록을 조회하거나 토큰을 관리할 때는 MCP 엔드포인트가 아니라 일반 REST를 사용한다.

```text
GET    /api/projects/{projectId}/mcp/tools
POST   /api/projects/{projectId}/mcp/tokens
GET    /api/projects/{projectId}/mcp/tokens
DELETE /api/mcp/tokens/{tokenId}
```

---

## 13. 기능 요구사항

### FR-01 프로젝트 등록

사용자는 프로젝트명과 분석 대상 URL을 등록할 수 있어야 한다.

인수 조건:

* 하나 이상의 허용 도메인을 등록할 수 있다.
* 허용하지 않은 도메인에서는 기록이 시작되지 않는다.
* 중복 프로젝트명은 정책에 따라 제한할 수 있다.

### FR-02 기록 세션 시작

사용자는 Extension에서 기록을 시작할 수 있어야 한다.

인수 조건:

* 기록 시작 시 세션 ID가 발급된다.
* 현재 프로젝트와 페이지 URL이 세션에 연결된다.
* 기록 중임을 명확히 표시한다.

### FR-03 클릭 이벤트 수집

웹페이지의 주요 클릭 이벤트를 수집해야 한다.

인수 조건:

* 클릭 시각과 요소 정보가 저장된다.
* 비밀번호 필드 값은 저장하지 않는다.
* Extension UI에 이벤트가 실시간 표시된다.

### FR-04 네트워크 요청 수집

클릭 후 발생하는 Fetch 및 XHR 요청을 수집해야 한다.

인수 조건:

* URL과 HTTP Method를 수집한다.
* 응답 상태 코드를 수집한다.
* 민감 Header는 마스킹한다.
* 정적 리소스는 후보에서 제외한다.

### FR-05 이벤트와 API 연결

하나의 클릭 이벤트에 관련 API 요청을 연결해야 한다.

인수 조건:

* 동일 탭과 시간 범위를 기준으로 연결한다.
* 하나의 클릭에 여러 요청을 연결할 수 있다.
* 잘못 연결된 요청을 사용자가 제거할 수 있다.

### FR-06 주요 API 후보 추천

시스템은 관련 가능성이 높은 API를 우선 제시해야 한다.

인수 조건:

* 각 후보에 점수와 추천 사유를 표시한다.
* 사용자가 다른 API를 선택할 수 있다.
* 자동 추천 결과를 수정할 수 있다.

### FR-07 ActionSpec 생성

선택된 API를 ActionSpec으로 변환해야 한다.

인수 조건:

* 요청 URL과 Method가 포함된다.
* 입력 파라미터 스키마를 생성한다.
* 응답 구조 초안을 생성한다.
* 사용자가 생성 결과를 수정할 수 있다.

### FR-08 MCP Tool 생성

활성화된 ActionSpec을 MCP Tool로 제공해야 한다.

인수 조건:

* Tool 목록에서 조회할 수 있다.
* Tool Input Schema가 ActionSpec과 일치한다.
* 비활성 액션은 Tool 목록에서 제외한다.

### FR-09 테스트 실행

사용자는 생성된 액션을 테스트할 수 있어야 한다.

인수 조건:

* 직접 파라미터 입력 방식과 자연어 입력 방식을 지원한다.
* 실행 전 요청값을 확인할 수 있다.
* 성공 및 실패 결과를 구분해 표시한다.
* 실행 로그가 저장된다.

### FR-10 사용자 확인

데이터를 생성, 수정, 삭제하는 액션은 실행 전 사용자 확인을 적용할 수 있어야 한다.

인수 조건:

* 액션별 확인 필요 여부를 설정할 수 있다.
* 확인 없이 실행되지 않도록 서버에서도 검증한다.
* 사용자의 승인 여부를 로그에 기록한다.

---

## 14. 비기능 요구사항

### 보안

* 모든 서버 통신은 HTTPS를 사용한다.
* 민감한 Header와 Body 필드는 마스킹한다.
* 프로젝트별 접근 권한을 분리한다.
* 사용자별 실행 권한을 확인한다.
* API 실행 허용 도메인을 제한한다.
* 임의의 외부 URL을 호출하지 못하도록 한다.
* SSRF 방어 정책을 적용한다.
* 감사 로그를 저장한다.

### 성능

* 클릭 이벤트는 사용자 체감 지연 없이 기록되어야 한다.
* Extension이 대상 웹페이지의 동작을 방해하지 않아야 한다.
* 네트워크 이벤트 기록으로 인한 페이지 지연을 최소화해야 한다.
* 한 세션당 이벤트 수 제한을 설정할 수 있어야 한다.
* 큰 응답 Body는 전체 저장하지 않고 크기를 제한한다.

권장 초기 제한:

* Response Body: 원문 저장 없음. 구조 + 샘플 1건, 최대 20KB
* Request Body 저장: 최대 100KB
* 세션 유지 시간: 최대 60분
* 세션당 사용자 이벤트: 최대 1,000건
* 세션당 네트워크 요청: 최대 5,000건

### 호환성

MVP 지원 범위:

* Google Chrome 최신 안정 버전
* Manifest V3
* 일반적인 SPA
* REST API
* HTTP 기반 GraphQL

후속 지원 범위:

* iframe
* 새 창 및 새 탭
* 파일 업로드
* WebSocket
* Service Worker 기반 네트워크 요청
* 브라우저 CDP 기반 고급 수집

### 관측성

* Extension 오류 로그
* 서버 API 로그
* MCP 실행 로그
* LLM Tool 선택 로그
* 요청 처리 시간
* 액션별 성공률
* 오류 유형별 통계

---

## 15. 성공 지표

### 제품 지표

* 기록 시작 대비 액션 등록 완료율
* 클릭 이벤트당 주요 API 식별 성공률
* 자동 추천 API가 최종 선택된 비율
* ActionSpec 생성 완료율
* MCP Tool 테스트 성공률
* 사용자가 액션 하나를 등록하는 데 필요한 평균 시간
* 액션 등록 후 수동 수정이 필요한 필드 수

### 초기 목표값

* API 후보 수집 성공률: 90% 이상
* Fetch 및 XHR 요청 수집률: 95% 이상
* 주요 API Top 3 포함률: 85% 이상
* ActionSpec 생성 성공률: 90% 이상
* 생성 Tool의 테스트 실행 성공률: 80% 이상
* 단일 액션 등록 평균 시간: 10분 이내

---

## 16. MVP 범위

### 포함

* Chrome Extension 프로젝트 연결
* 기록 시작 및 종료
* 클릭 이벤트 수집
* Fetch 요청 수집
* XMLHttpRequest 수집
* 클릭과 API 요청 연결
* API 후보 점수 계산
* 사용자 수동 선택
* ActionSpec 저장
* 요청 파라미터 편집
* 프로젝트 자격증명 등록
* MCP Tool 생성 및 접속 토큰 발급
* 직접 실행 테스트
* LLM Tool 호출 테스트
* 실행 로그 조회

### 제외

* 브라우저 릴레이 실행 (서버 직접 실행만 지원)
* 외부 MCP 클라이언트 연동 (5b단계, 6단계로 이월)
* 복수 액션 자동 연결
* 전체 업무 프로세스 자동 생성
* WebSocket 분석
* 모바일 앱 분석
* Chrome 이외의 브라우저
* 완전 자동 인증 재현
* 복잡한 응답 데이터를 이용한 화면 변화 분석
* AI 기반 API 의미 분석 고도화

---

## 17. 개발 단계

### 1단계: Extension 기록 기능

* WXT 프로젝트 구성
* Manifest V3 설정
* Side Panel 구성
* Content Script 구성
* 클릭 이벤트 기록
* Fetch Hook
* XMLHttpRequest Hook
* Extension 내부 세션 저장

완료 기준:

* Extension에서 기록을 시작한 후 클릭과 API 목록을 확인할 수 있다.

### 2단계: 관리자 서버 연동

* 프로젝트 API
* 기록 세션 API
* 이벤트 저장
* 네트워크 요청 저장
* 기록 결과 조회 화면

완료 기준:

* Extension에서 수집한 데이터를 서버로 전송하고 관리자 화면에서 확인할 수 있다.

### 3단계: API 후보 분석

* 클릭과 요청 시간 연결
* 정적 및 Analytics 요청 필터
* 점수 기반 후보 정렬
* 사용자의 주요 API 선택 화면

완료 기준:

* 하나의 클릭에 대해 관련 API 후보가 정렬되어 표시된다.

### 4단계: ActionSpec 관리

* ActionSpec 생성
* 파라미터 스키마 추론
* 액션 수정
* 버전 관리
* 활성화 및 비활성화
* 프로젝트 자격증명 등록 및 암호화 저장

완료 기준:

* 선택된 API를 실행 가능한 액션 정의로 저장할 수 있다.

### 5a단계: Tool 생성 및 LLM 테스트 콘솔 (MVP 범위)

* MCP Tool Registry
* ActionSpec 기반 Tool 스키마 생성
* 실행 게이트웨이 (파라미터 검증, 헤더 재현, 대상 API 호출)
* Tool 직접 실행
* LLM 테스트 콘솔 연동
* 실행 로그

완료 기준:

* 테스트 콘솔에서 자연어 요청을 통해 등록된 Tool이 선택되고 API가 실행된다.

### 5b단계: MCP 엔드포인트 노출 (6단계로 이월)

* Streamable HTTP 엔드포인트 (`initialize`, `tools/list`, `tools/call`)
* 접속 토큰 발급 및 인증 미들웨어
* SSE 스트림 및 `notifications/tools/list_changed` 발송

5a에서 만든 Tool Registry와 실행 게이트웨이를 재사용하므로 추가 작업은 JSON-RPC 계층에 한정된다. 5a만으로 §21 MVP 완료 정의가 완주되므로 MVP 범위에서 제외한다.

### 6단계: 고급 수집 및 실행 확장

* 브라우저 릴레이 실행
* Chrome Debugger 및 CDP 지원
* 응답 Body 고급 수집
* iframe 지원
* 새 탭 추적
* 파일 업로드 분석
* GraphQL 분석 강화

---

## 18. 주요 위험요소

### 브라우저별 API 수집 차이

웹사이트 구현 방식에 따라 Hook 방식으로 일부 네트워크 요청을 수집하지 못할 수 있다.

대응:

* MVP는 Fetch와 XHR 중심으로 지원
* 고급 모드에서 Chrome Debugger 및 CDP 제공
* 수집 방식과 한계를 사용자에게 표시

### 클릭과 API 관계 오판

하나의 클릭 이후 여러 API가 발생하면 주요 API를 잘못 추천할 수 있다.

대응:

* 자동 추천은 후보 제시 용도로만 활용
* 최종 선택은 사용자가 수행
* 점수 근거를 함께 표시
* 사용자의 선택 데이터를 향후 추천 모델 개선에 사용

### 인증정보 유출

요청 Header와 Body에 인증정보가 포함될 수 있다.

대응:

* 민감 Header 즉시 마스킹
* 서버 전송 전 Extension에서 1차 제거
* 서버 저장 단계에서 2차 필터링
* ActionSpec에 토큰 및 Cookie 저장 금지

### 잘못된 변경성 API 실행

LLM이 잘못된 파라미터로 생성, 수정, 삭제 API를 실행할 수 있다.

대응:

* 변경성 액션 기본 확인 절차
* JSON Schema 검증
* 허용값 및 Enum 제한
* 테스트 환경과 운영 환경 분리
* 실행 전 요청 미리보기 제공
* 액션별 실행 권한 관리

### 웹사이트 변경

대상 사이트의 URL이나 API 구조가 변경되면 기존 액션이 동작하지 않을 수 있다.

대응:

* 액션별 최근 성공 시점 관리
* 연속 실패 감지
* 스키마 변경 경고
* 재기록 기능 제공
* 액션 버전 관리

---

## 19. 향후 확장 방향

* 여러 화면 조작을 하나의 Workflow로 연결
* 액션 간 입력과 출력 자동 매핑
* 테스트 실행 결과를 기반으로 ActionSpec 자동 보정
* OpenAPI 문서와 기록 결과 결합
* API 이름과 설명 자동 생성
* 비슷한 API의 중복 액션 탐지
* 사용자 행동 기반 업무 프로세스 마이닝
* MCP 외 Function Calling 및 OpenAPI Tool 출력
* 조직별 Tool Marketplace
* 권한과 역할 기반 Tool 노출
* 테스트 케이스 자동 생성
* 회귀 테스트 자동화
* API 변경 감지
* 브라우저 액션과 API 액션의 혼합 실행
* 사용자 시연으로부터 Agent Workflow 생성

---

## 20. 주요 의사결정

### 20.1 확정된 사항 (2026-07-26)

| 항목                | 결정                                                 | 반영 위치            |
| ----------------- | -------------------------------------------------- | ---------------- |
| MCP 실행 방식         | 서버 직접 실행만 지원. 브라우저 릴레이는 6단계 이후                     | §7.9, §16, §17   |
| 운영 범위 및 권한 단위     | 사내 전용으로 시작. `Organization` 테이블은 두되 단일 조직 고정         | §11              |
| 저장소 구조            | 모노레포 (`apps/extension`, `apps/backend`, `apps/admin`) | §10              |
| 원문 저장 범위          | 응답 본문은 원문 저장 없음. 구조 + 샘플 1건, 최대 20KB               | §7.4, §14        |
| 마스킹 기준            | 헤더명 · 키명 · 값 패턴 3중 규칙, Extension과 Backend 2단계 적용    | §7.4             |
| MCP 전송 방식         | Streamable HTTP (JSON-RPC 2.0), 프로젝트별 단일 엔드포인트      | §12              |
| MCP 인증            | 프로젝트별 Bearer 토큰. 미들웨어 분리로 OAuth 2.1 확장 여지 확보        | §12, §11         |
| MVP 5단계 범위        | 5a(Tool Registry + 테스트 콘솔)까지. 5b(MCP 엔드포인트)는 6단계로 이월  | §3.2, §12, §16, §17 |
| MVP 대상 웹사이트       | 주력: 국토교통부 실거래가 / 보조: 국가통계포털 KOSIS                    | 별도 설계 문서       |

대상 웹사이트 선정 근거와 사이트별 검증 시나리오는 `docs/superpowers/specs/2026-07-26-target-site-scenarios-design.md`에 있다.

### 20.2 남은 결정 사항

착수 전 확정이 필요한 항목:

1. **기록 데이터 보존 기간.** 세션 원본을 얼마 후 삭제할지, ActionSpec은 별도로 유지할지.

단계별로 확정하면 되는 항목:

3. Extension 사용자 인증 방식 (2단계)
4. ActionSpec 표준을 내부 규격으로 둘지 OpenAPI와 결합할지 (4단계)
5. 변경성 API 실행 시 사용자 승인 정책 (5단계)
6. LLM 테스트에 사용할 모델과 운영 정책 (5단계)

---

## 21. MVP 최종 완료 정의

다음 시나리오가 처음부터 끝까지 정상적으로 수행되면 MVP 개발이 완료된 것으로 판단한다.

1. 사용자가 관리자 화면에서 프로젝트, 대상 URL, 대상 서비스 자격증명을 등록한다.
2. Chrome Extension에서 프로젝트를 선택한다.
3. 대상 사이트에서 기록을 시작한다.
4. 사용자가 특정 기능의 버튼을 클릭한다.
5. 클릭과 관련된 Fetch 또는 XHR API가 기록된다.
6. 시스템이 주요 API 후보를 추천한다.
7. 사용자가 주요 API를 선택한다.
8. 요청 파라미터와 응답 구조가 ActionSpec으로 생성된다.
9. 사용자가 액션명과 파라미터 설명을 수정한다.
10. 액션을 활성화한다.
11. 시스템이 MCP Tool을 생성한다.
12. 사용자가 자연어로 해당 업무를 요청한다.
13. LLM이 MCP Tool과 파라미터를 선택한다.
14. 사용자가 요청 내용을 확인한다.
15. API가 정상 실행된다.
16. 결과가 사용자에게 표시되고 실행 로그에 저장된다.

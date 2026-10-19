"""온톨로지(2차): DB 연결마다 온톨로지 하나. 객체(테이블·뷰·마트에서), 링크, 액션, 권한을 만들고 AI 가 질문하게 한다.

흐름: 연결(conn) -> 스키마 읽기(reader) -> 객체 구축(scan 스캔, build 객체 생성, marts 마트) -> 검토 -> 공개(publish) -> MCP 서버(mcp, runtime) / AI 질의 테스트(ask)

  conn        DB 연결: 읽기 전용 엔진, 쿼리 보호(행·시간·동시), 마트 저장소 연결, 주기 동기화 복제본 라우팅
  reader      스키마 읽기: 테이블·뷰·컬럼·키·FK·행 수, 뷰 정의 해석, 값 일치 질의
  dictionary  이름 사전(PO_AMT -> 발주 금액 / amount), 한글 조사, 마스킹
  profile     테이블 -> 객체 초안: 속성 타입·특성·코드값·예시, 테이블 역할(entity/history/code/fact/detail)
  scan        DB 스캔: 객체·링크·병합 제안과 반영, 값 일치율로 링크 추론(같은 DB, 다른 DB)
  build       객체 생성 마법사(테이블·마트), 객체·속성·링크 고치기, 검토 완료, AI 공개 토글
  links       링크 이름 짓기, 조인 키 문자열
  layout      그래프 좌표
  sqlguard    마트 SQL 검사(읽기 전용 SELECT, 컬럼 이름, 읽는 테이블)
  marts       마트: 미리 보기, 빌드(DB 간 조인은 작업 파일), 증분, 갱신 스케줄러
  replica     주기 동기화: 객체가 쓰는 테이블을 이음 저장소로 복사
  perm        실행 사용자 확인(직원 객체), 행·속성 권한 규칙
  query       질의 엔진: search / get / aggregate / follow, SQL 렌더링(권한 적용)
  actions     액션: 제출 조건 판정과 원본 시스템 API 실행(사용자 확인 뒤에만)
  ask         AI 질의 테스트: 질문 -> 계획 -> 단계 실행(정해 둔 질문은 규칙, 자유 질문은 GPT)
  tools       객체에서 만드는 AI(MCP) 도구의 정의와 실행
  publish     공개: 버전 스냅샷
  mcp         공개한 버전을 MCP 서버(runtime/)에 반영
  runtime     배포한 서버 프로세스가 쓰는 쪽(OntoDeployment)
  legacy_sync 시연 레거시 사이트의 변경을 시연 DB 에도 쓰는 후크
  demo        시연용 SQLite DB 3개(구매관리 po, 인사 hr, 회계 ERP acc), demo_data 가 데이터, demo_setup 이 시연 환경(온톨로지·마트·권한·액션)을 만든다
  store       JSON 저장소(연결, 객체, 링크, 마트, 공개 버전, 설정)
"""

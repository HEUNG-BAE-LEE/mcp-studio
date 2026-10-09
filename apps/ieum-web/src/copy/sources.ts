// 원본 시스템 문구 — 옛 원문 그대로(js/menu/sources.js). 다듬지 않는다
// 서버 사실과 다른 옛 문구(2차 안내 "1차에서는 …" · 검색 placeholder)는 이식 기간 동안 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
// 여기 두지 않는 것: 화면 제목 · 설명(copy/shell SCREEN_LABEL · PAGE_DESCRIPTION), 연결 방식 라벨(copy/protocol PROTOCOL_LABEL),
// 원본 상태 라벨(copy/status), 층의 닫기 · 취소(copy/shell LAYER_COPY), 실패 문장(서버 resultMsg 그대로 — copy/errors는 서버 문장이 없을 때만)
// 옛 문구의 <b> 강조는 앞(…Pre) · 강조(…Strong) · 뒤(…Post) 조각으로 나눈다 — 화면이 강조 조각만 요소로 감싼다(텍스트 렌더).
// 강조가 서버 값(원본 이름)이면 강조 조각 없이 뒤 조각만 둔다

const LATER_BADGE = '2차';
const CONNECT_FAILED = '연결하지 못했습니다.';

export const SOURCES = Object.freeze({
  // js/menu/sources.js:25-30
  toolbar: {
    searchPlaceholder: '시스템 이름으로 검색',
    searchLabel: '원본 시스템 검색',
    protoLabel: '연결 방식',
    // 나머지 선택지는 copy/protocol PROTOCOL_LABEL과 같은 글자다(js/menu/sources.js:27)
    protoAll: '연결 방식 전체',
    connect: '원본 시스템 연결',
  },
  table: {
    // js/menu/sources.js:33
    columns: {
      name: '원본 시스템',
      proto: '연결 방식',
      spec: '명세',
      auth: '인증',
      tools: 'AI 도구',
      status: '상태',
      sync: '마지막 동기화',
      manage: '관리',
    },
    // js/menu/sources.js:14 — 공개 수(굵게) 뒤의 "/ 전체"와 검토 수
    total: (n: number) => `/ ${n}`,
    pending: (n: number) => `검토 ${n}개`,
    // js/menu/sources.js:17
    reauth: '다시 인증',
    viewTools: '도구 보기',
    delete: '삭제',
    deleteLabel: (name: string) => `${name} 삭제`,
  },
  // js/menu/sources.js:6
  empty: {
    firstPre: '연결된 원본 시스템이 없습니다. 오른쪽 위 ',
    firstStrong: '원본 시스템 연결',
    firstPost: '로 시작하세요.',
    filtered: '조건에 맞는 원본 시스템이 없습니다. 검색어나 연결 방식을 바꿔 보세요.',
  },
  // js/menu/sources.js:36 — 강조가 둘이다
  hint: {
    countPre: 'AI 도구 수는 ',
    countStrong: '공개 중 / 전체 작업',
    countPost: '입니다. ',
    rereadPre: '명세가 바뀌었는지는 변환 스튜디오의 ',
    rereadStrong: '명세 다시 읽기',
    rereadPost: '로 확인합니다.',
  },
  // js/menu/sources.js:22,38-39 — icon은 글자가 아니라 아이콘 이름(옛 later 튜플의 첫 칸)
  later: {
    title: '2차 개발에서 지원할 연결 방식',
    note: '1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다',
    cards: [
      { icon: 'db', title: 'DB 직접 조회', description: 'SQL 조회문을 읽기 전용 도구로 변환' },
      { icon: 'graph', title: 'GraphQL', description: '스키마를 읽어 쿼리별 도구 생성' },
      { icon: 'layers', title: 'gRPC', description: 'proto 정의를 읽어 서비스별 도구 생성' },
    ],
    badge: LATER_BADGE,
  },
  wizard: {
    // js/menu/sources.js:101
    tag: '원본 시스템',
    title: '원본 시스템 연결',
    desc: 'REST(OpenAPI), SOAP(WSDL), 공공데이터포털, 호출 샘플로 연결합니다.',
    // js/menu/sources.js:44
    steps: ['연결 방식', '명세 불러오기', '인증', '분석'],
    // js/menu/sources.js:106-109
    stepCount: (n: number, total: number) => `${n}/${total} 단계`,
    prev: '이전',
    next: '다음',
    start: '연결하고 분석 시작',
    toStudio: '변환 스튜디오에서 검토',
    // js/menu/sources.js:54-55
    modeHint: '연결할 원본 시스템이 어떤 형태로 되어 있는지 고르세요.',
    recommend: '명세 없는 레거시에 추천',
    laterBadge: LATER_BADGE,
  },
  spec: {
    // js/menu/sources.js:57
    name: '시스템 이름',
    namePlaceholder: '비우면 명세의 이름을 씁니다',
    // js/menu/sources.js:59,61
    govLabel: '포털 API',
    govHint: '공공데이터포털에서 활용 신청한 API의 서비스키가 필요합니다. 다음 단계에서 입력합니다.',
    // js/menu/sources.js:62-64
    sampleReq: '요청 샘플',
    sampleReqPlaceholder: 'curl "https://erp.example.com/po/list?fromDt=20260901" 또는 GET https://...',
    sampleRes: '응답 샘플 (JSON)',
    sampleResPlaceholder: '{"list":[{"PO_NO":"P-1","AMT":"1200"}]}',
    sampleHint: '샘플 하나로 도구 하나를 만듭니다. 응답 필드의 의미는 추정이라 변환 스튜디오에서 꼭 확인하세요.',
    // js/menu/sources.js:65-66
    url: '명세 URL',
    urlPlaceholder: {
      rest: 'https://erp.example.com/openapi.json',
      soap: 'https://legacy.example.com/ws/Service?wsdl',
    },
    // js/menu/sources.js:67
    or: '또는',
    // js/menu/sources.js:68 — 파일을 올리기 전 · 뒤 안내, 아래 작은 글은 SOAP만 다르다(그 밖은 rest)
    drop: '명세 파일을 눌러서 고르세요',
    dropDone: (fileName: string) => `${fileName} 올림`,
    dropHint: {
      rest: '.json, .yaml 파일, 최대 10MB',
      soap: '.wsdl, .xml 파일, 최대 10MB',
    },
    fileLabel: '명세 파일 선택',
    // js/menu/sources.js:69 — SOAP만 다르다(그 밖은 rest)
    base: '서버 주소',
    basePlaceholder: {
      rest: '비우면 명세의 servers 주소를 씁니다',
      soap: '비우면 WSDL의 주소를 씁니다',
    },
  },
  auth: {
    // js/menu/sources.js:95
    method: '인증 방식',
    // js/menu/sources.js:81-84 — 인증 방식 선택지. 공공데이터 모드의 key 선택지는 serviceKey 글자다
    methods: {
      none: '인증 없음',
      key: 'API Key',
      bearer: 'Bearer 토큰',
      basic: 'HTTP Basic',
      oauth: 'OAuth 2.0 (Client Credentials)',
      wss: 'WS-Security (UsernameToken)',
      session: '세션 (서비스 계정)',
    },
    // js/menu/sources.js:90 — 이름 칸의 placeholder(X-API-KEY)는 문구가 아니라 기본값 상수다
    location: '전달 위치',
    header: '요청 헤더',
    query: '쿼리 파라미터',
    keyName: '이름',
    // js/menu/sources.js:91 — 공공데이터 모드는 serviceKey · serviceKeyPlaceholder
    key: 'API Key',
    serviceKey: '서비스키',
    serviceKeyPlaceholder: '포털에서 발급받은 일반 인증키 (Decoding)',
    // js/menu/sources.js:92-94
    token: '토큰',
    username: '계정',
    password: '비밀번호',
    tokenUrl: '토큰 URL',
    tokenUrlPlaceholder: 'https://auth.example.com/oauth/token',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    // js/menu/sources.js:71
    noticePre: '인증 정보는 이음 서버에 ',
    noticeStrong: '암호화해 저장',
    noticePost: '합니다. AI 모델에는 전달하지 않고, 원본 요청을 보낼 때만 이음이 넣습니다.',
  },
  analysis: {
    // js/menu/sources.js:45
    steps: ['명세 읽기', '작업 목록 추출', '파라미터 형식 분석', 'AI 설명 초안 작성', '쓰기, 민감 작업 분류'],
    // js/menu/sources.js:73 — 성공 뒤 steps 각 줄 끝에 붙는 요약(같은 순서)
    summary: {
      spec: '명세 1건',
      ops: (n: number) => `작업 ${n}개`,
      params: (n: number) => `파라미터 ${n}개`,
      descs: (n: number) => `설명 ${n}개`,
      writes: (n: number) => `쓰기 작업 ${n}개`,
    },
    // js/menu/sources.js:78
    result: {
      found: '찾은 작업',
      candidates: 'AI 도구 후보',
      writes: '쓰기 작업',
    },
    // js/menu/sources.js:79
    reviewPre: '새로 만든 도구는 모두 ',
    reviewStrong: '검토 필요',
    reviewPost: ' 상태로 시작합니다. 변환 스튜디오에서 설명과 매핑을 확인한 뒤 공개하세요.',
    // js/menu/sources.js:74-75 — 실패 상자 머리(굵게) 다음 줄에 서버 문장
    failTitle: CONNECT_FAILED,
    failHint: '이전 단계로 돌아가 주소와 인증 정보를 확인해 주세요.',
  },
  // js/menu/sources.js:136-137 — 본문은 원본 이름(굵게) 뒤에 bodyPost
  reauth: {
    title: '인증 정보 다시 입력',
    bodyPost: ' 연결에 문제가 있습니다. 인증 정보를 다시 입력하면 저장하고 연결을 복구합니다.',
    ok: '저장하고 다시 연결',
  },
  // js/menu/sources.js:144 — 본문은 원본 이름(굵게) 뒤에 bodyPost. 조사 "과"는 옛 그대로 고정이다
  deleteSource: {
    title: '원본 시스템 삭제',
    bodyPost: (toolCount: number) =>
      `과 이 시스템에서 만든 AI 도구 ${toolCount}개를 삭제합니다. 도구 묶음에서도 빠지며, 저장한 인증 정보도 지웁니다. 되돌릴 수 없습니다.`,
    ok: '삭제',
  },
  toast: {
    // js/menu/sources.js:156-157 — 2단계 다음(warn)
    needSample: '요청 샘플을 입력하세요.',
    needSpec: '명세 URL을 입력하거나 파일을 올려 주세요.',
    // js/menu/sources.js:192,194
    fileTooBig: '명세 파일은 10MB까지 올릴 수 있습니다.',
    fileLoaded: (fileName: string) => `${fileName} 파일을 올렸습니다.`,
    // js/menu/sources.js:127 — 마법사 완료 이동 뒤, 그리고 마법사를 닫은 뒤 연결이 끝났을 때(이동 없음)
    connected: (name: string, toolCount: number) => `'${name}' 연결을 마쳤습니다. 도구 후보 ${toolCount}개를 검토해 주세요.`,
    // 마법사를 닫은 뒤 연결이 실패했을 때(warn) — 실패 상자 머리(js/menu/sources.js:74) + 서버 문장.
    // 앞 문맥과 서버 문장은 옛 저장 실패 토스트처럼 빈칸 하나로 잇는다(js/common/api.js:22)
    connectFailed: (message: string) => `${CONNECT_FAILED} ${message}`,
    // js/menu/sources.js:138
    reauthSaved: (name: string) => `${name} 인증 정보를 저장했습니다.`,
    // js/menu/sources.js:149
    deleted: (name: string) => `${name} 연결을 삭제했습니다.`,
  },
} as const);

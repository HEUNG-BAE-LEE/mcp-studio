// 대시보드 · 호출 로그 문구 — 옛 원문 그대로(js/menu/dashboard.js · js/menu/logs.js). 다듬지 않는다
// 서버 사실과 다른 옛 문구(허브 "4종" · 알림 "인증 만료" 계열)는 이식 기간 동안 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
// 숫자는 호출하는 쪽이 원값으로 넘기고, 천 단위 쉼표는 옛이 `fmt`를 쓰던 자리에서만 여기서 붙인다
import { fmtNum } from './format';

/** 대시보드(js/menu/dashboard.js) */
export const DASH = Object.freeze({
  kpi: {
    // js/menu/dashboard.js:10
    sources: {
      label: '연결된 원본 시스템',
      unit: '개',
      detail: (ok: number, bad: number) => `정상 ${ok}개, 확인 필요 ${bad}개`,
    },
    // js/menu/dashboard.js:11
    tools: { label: '공개 중인 AI 도구', unit: '개', detail: (n: number) => `검토 대기 ${n}개` },
    // js/menu/dashboard.js:12 — 방향(▲ · ▼)은 글자가 아니라 아이콘이다. delta는 부호 없는 크기만 만든다
    calls: {
      label: '최근 24시간 호출',
      unit: '회',
      delta: (pct: number) => `${Math.abs(pct)}%`,
      deltaTail: ' 전일 대비',
    },
    // js/menu/dashboard.js:13
    success: { label: '변환 성공률', unit: '%', failed: (n: number) => `실패 ${fmtNum(n)}건` },
    // js/menu/dashboard.js:14
    convert: { label: '평균 변환 시간', unit: 'ms', sourceAvg: (ms: number) => `원본 응답 평균 ${ms}ms 별도` },
  },
  topology: {
    // js/menu/dashboard.js:20
    title: '연결 구조',
    sub: 'AI 쪽 형식과 원본 쪽 형식을 이음이 중간에서 바꿉니다',
    // js/menu/dashboard.js:18 — AI 노드 호출 수의 툴팁
    callsTitle: '최근 24시간 호출',
    // js/menu/dashboard.js:22
    aiHead: 'AI 모델, 에이전트',
    aiHeadCalls: '24시간 호출',
    // js/menu/dashboard.js:23,26
    linkAi: 'MCP, 함수 호출',
    linkSource: 'SOAP, REST, XML',
    // js/menu/dashboard.js:24-25 — published(n) · formatsCount는 굵게 그린다
    hub: {
      name: '이음 게이트웨이',
      publishedPre: '공개 도구 ',
      published: (n: number) => `${n}개`,
      formatsPre: 'AI 호출 형식 ',
      formatsCount: '4종',
      formatsPost: ' 변환',
      guards: '사용자 확인, 마스킹, 호출 한도',
    },
    // js/menu/dashboard.js:27
    sourceHead: '원본 시스템',
    // js/menu/dashboard.js:19
    sourceSub: (protoLabel: string, n: number) => `${protoLabel}, 도구 ${n}개`,
  },
  chart: {
    // js/menu/dashboard.js:42-44
    title: '시간대별 호출',
    sub: '최근 24시간',
    aria: '최근 24시간 시간대별 호출 수 막대 그래프',
    legendOk: '성공',
    legendErr: '실패',
    // js/menu/dashboard.js:38 — 호출 수는 천 단위 쉼표, 실패 수는 원값(옛 그대로)
    barTitle: (h: number, calls: number, errors: number) => `${h}시: ${fmtNum(calls)}회 (실패 ${errors}건)`,
    // js/menu/dashboard.js:40
    hour: (h: number) => `${h}시`,
    // 시각 숨김 표 머리 — 막대 값이 마우스 툴팁에만 있던 것을 표로 더한다. 낱말은 막대 툴팁 · 범례에서 가져왔다
    table: { caption: '시간대별 호출', hour: '시', calls: '호출', errors: '실패' },
  },
  rank: {
    // js/menu/dashboard.js:47-48
    title: '많이 쓰인 도구',
    sub: '최근 24시간',
    toLogs: '호출 로그 보기',
    empty: '아직 호출 기록이 없습니다.',
  },
  alerts: {
    // js/menu/dashboard.js:57,59
    title: '확인이 필요한 항목',
    count: (n: number) => `${n}건`,
    empty: '확인이 필요한 항목이 없습니다.',
    // js/menu/dashboard.js:51
    auth: {
      title: (name: string) => `${name} 연결에 문제가 있습니다.`,
      body: '인증 정보를 확인하고 다시 인증해 주세요.',
      action: '다시 인증',
    },
    // js/menu/dashboard.js:52 — 도구 id · 필드 이름은 코드 서식으로 사이사이에 끼운다
    drift: {
      title: (src: string) => `${src} API 명세가 바뀌었습니다.`,
      fieldPre: ' 응답 필드가 ',
      fieldArrow: ' → ',
      fieldPost: '(으)로 바뀌어 지금은 값이 비어서 전달됩니다.',
      action: '매핑 고치기',
    },
    // js/menu/dashboard.js:54
    writeReview: { title: (n: number) => `쓰기 작업 도구 ${n}개가 검토를 기다립니다.`, action: '검토하기' },
    // js/menu/dashboard.js:56
    guess: {
      title: (src: string) => `${src} 시스템은 호출 샘플로 형식을 추론했습니다.`,
      body: (n: number) => `의미가 확실하지 않은 필드가 있는 도구 ${n}개를 확인해 주세요.`,
      action: '확인하기',
    },
  },
  // js/menu/dashboard.js:61 — demoPre + 주소(코드 서식) + demoPost
  empty: {
    title: '연결된 원본 시스템이 없습니다',
    body: 'REST(OpenAPI), SOAP(WSDL) 명세나 호출 샘플로 시스템을 연결하면 AI 도구 후보가 만들어집니다.',
    demoPre: '직접 붙여 볼 시스템이 없다면 이 서버의 시연용 인사 시스템(',
    demoPost: ', 인증 X-API-KEY: demo-key)을 연결해 보세요.',
    action: '원본 시스템 연결',
  },
} as const);

/** 호출 로그(js/menu/logs.js) */
export const LOGS = Object.freeze({
  // js/menu/logs.js:19,21
  filter: { all: '전체', ok: '성공', err: '실패', clientAria: 'AI 클라이언트', clientAll: 'AI 클라이언트 전체' },
  // js/menu/logs.js:22
  search: { placeholder: '도구, 사용자, 시스템으로 검색', aria: '로그 검색' },
  // js/menu/logs.js:25
  cols: {
    time: '시각',
    user: '사용자',
    client: 'AI 클라이언트',
    tool: '도구',
    source: '원본 시스템',
    convert: '변환',
    sourceMs: '원본 응답',
    status: '상태',
  },
  // js/menu/logs.js:13,41-42 — 변환 · 원본 응답 시간의 단위(값이 없으면 붙이지 않는다)
  unitMs: 'ms',
  // js/menu/logs.js:11
  empty: {
    filtered: '조건에 맞는 호출 기록이 없습니다.',
    first: '아직 호출 기록이 없습니다. 테스트 실행이나 AI 연결로 도구를 호출하면 여기에 쌓입니다.',
  },
  // js/menu/logs.js:27
  retentionHint: '최근 300건을 보관합니다. 행을 누르면 AI 요청부터 원본 응답까지 실제 변환 과정을 볼 수 있습니다.',
  detail: {
    // js/menu/logs.js:35 — 사용자가 없으면 사용자 조각을 뺀다(옛은 ", 가 …"로 깨졌다). 쉼표는 남긴다
    label: '호출 기록',
    desc: (ts: string, user: string | null | undefined, client: string) =>
      user ? `${ts}, ${user}가 ${client}에서 호출` : `${ts}, ${client}에서 호출`,
    // js/menu/logs.js:38-43
    sum: {
      status: '상태',
      client: 'AI 클라이언트',
      source: '원본 시스템',
      convert: '변환 시간',
      sourceMs: '원본 응답 시간',
      reqId: '요청 ID',
    },
    reqId: (id: string) => `req_${id}`,
    // js/menu/logs.js:46
    noTrace: '이 호출은 변환 과정을 남기지 못했습니다.',
    // js/menu/logs.js:48
    footInfo: (name: string, protoLabel: string) => `${name}, ${protoLabel}`,
    openStudio: '변환 스튜디오에서 열기',
    close: '닫기',
  },
} as const);

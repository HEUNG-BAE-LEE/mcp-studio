// 변환 스튜디오 문구 — 옛 원문 그대로(js/menu/studio.js). 다듬지 않는다
// 서버 사실과 다른 옛 문구("오늘 새벽" · "12건" · "10분" · "사용자당" · 사용자 확인 설명 · 마스킹 설명 · MCP 정의 안내)는
// 이식 기간 동안 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
// 여기 두지 않는 것: 화면 제목 · 설명(copy/shell SCREEN_LABEL · PAGE_DESCRIPTION), 도구 상태 라벨(copy/status),
// 프로토콜 라벨 · 설명(copy/protocol), 읽기 · 쓰기(copy/mode), 규칙 라벨(copy/trace RULES), 검증 라벨(copy/discovery),
// 생성기 출력 안 한글(copy/convert), 실패 문장(서버 resultMsg 그대로)
// 문장 사이에 요소(인라인 코드 · 링크)가 끼는 문구는 조각으로 나눈다 — 조각의 앞뒤 공백은 옛 원문 그대로 조각에 들어 있다

/**
 * 공개 스위치를 끌 때 사유가 비어 있으면 넣는 값(js/menu/studio.js:189). 화면 문구이면서 **서버에 저장되는 값**이다 —
 * 글자를 바꾸면 옛 콘솔이 저장한 도구 JSON과 달라진다
 */
export const OFF_REASON_DEFAULT = '관리자가 공개를 껐습니다.';

/** 응답 매핑 예시 칸의 최대 글자 수(js/menu/studio.js:49 cut(r.ov, 30)) */
const EXAMPLE_MAX = 30;

export const STUDIO = Object.freeze({
  // js/menu/studio.js:120 — 링크 조각만 요소
  empty: {
    before: '아직 AI 도구가 없습니다. ',
    link: '원본 시스템',
    after: '을 연결하면 도구 후보가 만들어집니다.',
  },
  // js/menu/studio.js:127-131
  bar: {
    label: '원본 시스템',
    selectLabel: '원본 시스템 선택',
    /** 명세 · 동기화는 서버 문자열 그대로("방금" 포함) */
    syncLine: (spec: string, sync: string) => `${spec}, 마지막 동기화 ${sync}`,
    reread: '명세 다시 읽기',
  },
  // js/menu/studio.js:7,134-137
  list: {
    region: '도구 목록',
    title: '도구 목록',
    count: (n: number) => `${n}개`,
    filters: { all: '전체', review: '검토 필요', done: '공개 중', off: '제외' },
    searchPlaceholder: '도구 이름으로 검색',
    searchLabel: '도구 검색',
    noMatch: '이 조건에 맞는 도구가 없습니다.',
  },
  // js/menu/studio.js:79-81,140
  detail: {
    region: '도구 상세',
    /** 스위치 글자이자 aria-label */
    publish: 'AI에게 공개',
    /** 비활성 공개 스위치의 사유(옛 title) */
    publishBlocked: '검토를 마쳐야 공개할 수 있습니다',
    tryRun: '테스트 실행',
    save: '변경사항 저장',
  },
  // js/menu/studio.js:58-66 — 굵은 첫 문장(…Title) 뒤에 이어지는 글. 서버 값(driftMsg · offReason · recNote · 필드 이름)은 그대로
  notice: {
    driftTitle: '원본 명세가 바뀌었습니다.',
    /** "응답 필드 {o} → {newO}. 이 때문에 지금은 {a} 값이 비어서 전달됩니다." — 필드 이름은 인라인 코드 요소 */
    driftField: {
      before: '응답 필드 ',
      arrow: ' → ',
      mid: '. 이 때문에 지금은 ',
      after: ' 값이 비어서 전달됩니다.',
    },
    driftDetected: '오늘 새벽 명세를 다시 읽으면서 감지했습니다.',
    fixDrift: '새 필드로 매핑',
    keepPublic: '확인했고 계속 공개',
    writeTitle: '데이터를 만들거나 바꾸는 쓰기 작업입니다.',
    writeBody: '실행 방식이 사용자 확인 후 실행인지, 설명이 AI가 오해하지 않게 쓰였는지 확인한 뒤 검토를 마쳐 주세요.',
    reviewDone: '검토 완료',
    discTitle: '자동 탐색으로 찾은 API입니다.',
    /** 근거 종류 — both · src 밖의 값은 tr 글자다(옛 삼항의 마지막 갈래 — studio.js:63) */
    discEvidence: { both: '소스와 운영 트래픽 모두', src: 'Git 소스뿐', tr: '운영 트래픽뿐' },
    discBody: (evidence: string, verify: string) => `근거는 ${evidence}이고, 검증 결과는 ${verify}입니다.`,
    /** 근거가 tr일 때만 discBody 뒤에 붙는다 */
    discTrOnly: '소스가 없어 타입은 관찰한 값으로 추정했습니다.',
    discLink: '탐색 근거 보기',
    reviewTitle: '명세를 읽어 자동으로 만든 도구 후보입니다.',
    reviewBody: '설명과 파라미터 매핑이 맞는지 확인한 뒤 공개하세요.',
    guessTitle: '호출 샘플 12건으로 형식을 추론했습니다.',
    guessBody: '추정 표시가 있는 필드의 의미가 맞는지 확인해 주세요. 맞지 않으면 필드 이름과 설명을 고친 뒤 저장하세요.',
    guessDone: '확인 완료',
    offTitle: 'AI 공개 대상에서 제외된 작업입니다.',
    include: '다시 포함',
  },
  // js/menu/studio.js:85-90
  pipe: {
    label: '변환 흐름',
    source: '원본 작업',
    io: (inputs: number, outputs: number) => `입력 ${inputs}개, 응답 ${outputs}개`,
    hub: '이음 변압기',
    ruleCount: (label: string, n: number) => `${label} ${n}`,
    ai: 'AI 도구',
    aiKind: 'MCP 도구, JSON Schema',
    exposed: (n: number) => `AI에 입력 ${n}개 노출`,
  },
  // js/menu/studio.js:94-96,152
  desc: {
    title: 'AI가 읽는 도구 설명',
    hint: 'AI는 이 설명을 보고 언제 이 도구를 쓸지 판단합니다',
    label: '도구 설명',
    /** 글자 수는 문자열 length 그대로(쉼표 없음) */
    count: (n: number) => `${n}자`,
    rewrite: 'AI로 다시 쓰기',
    rewriting: '쓰는 중…',
  },
  // js/menu/studio.js:26,30-35,98 — 머리 보조 글은 위험색 표지(hintMark) 뒤에 hint
  params: {
    title: '입력 파라미터 매핑',
    hintMark: '*',
    hint: ' 필수, 보라색 규칙은 AI에게 보이지 않습니다',
    /** 두 번째 열(화살표)은 머리 글자가 없다 */
    cols: { origin: '원본 필드', ai: 'AI 파라미터', rule: '변환 규칙', desc: '설명' },
    noOrigin: '원본 필드 없음',
    /** 원본 필드 아래 줄 — 위치가 없으면 타입만(studio.js:30) */
    locType: (loc: string | undefined, ot: string) => (loc ? `${loc}, ${ot}` : ot),
    hidden: 'AI에 노출 안 함',
    nameLabel: 'AI 파라미터 이름',
    /** 필수 * 표지의 대체 글자(옛 title) */
    required: '필수',
    descLabel: '파라미터 설명',
  },
  // js/menu/studio.js:20-23
  ruleCell: {
    ruleLabel: '변환 규칙',
    injectPlaceholder: '고정값',
    injectLabel: '자동 주입 값',
    dateFmtLabel: '원본 날짜 형식',
    codesPlaceholder: '원본=AI값, 01=annual',
    codesLabel: '코드표',
  },
  // js/menu/studio.js:39-49,99
  res: {
    title: '응답 매핑',
    empty: '명세에서 응답 필드를 찾지 못했습니다. 원본 응답을 그대로 AI에게 전달합니다.',
    /** 두 번째 열(화살표)은 머리 글자가 없다 */
    cols: { origin: '원본 응답 필드', ai: 'AI 결과 필드', rule: '변환 규칙', example: '예시' },
    newField: '새 필드',
    guess: '추정',
    nameLabel: 'AI 결과 필드 이름',
    nullValue: '값 없음 (null)',
    /** 예시 칸 — 30자를 넘으면 잘라 "…"를 붙인다. 값이 없으면 빈 글자(옛 cut — studio.js:43) */
    example: (value: unknown) => {
      const text = String(value ?? '');
      return text.length > EXAMPLE_MAX ? `${text.slice(0, EXAMPLE_MAX)}…` : text;
    },
  },
  // js/menu/studio.js:102-109 — 마스킹 · 캐시 · 한도의 aria-label은 제목과 같은 글자(한도만 label)
  policy: {
    title: '실행 정책',
    execLabel: '실행 방식',
    auto: { title: '바로 실행', hint: '조회처럼 결과만 읽는 작업에 권장합니다' },
    confirm: {
      title: '사용자 확인 후 실행',
      hintWrite: '쓰기 작업은 이 방식만 쓸 수 있습니다',
      hintRead: 'AI가 호출하기 전에 사용자에게 내용을 보여 줍니다',
    },
    mask: { title: '개인정보 마스킹', hint: '전화번호, 이메일, 주민등록번호 일부를 가려서 전달' },
    cache: { title: '응답 캐시', hint: '같은 요청은 10분 동안 원본을 다시 부르지 않음' },
    limit: {
      title: '사용자당 호출 한도',
      hint: '1분 기준, 넘으면 AI에게 잠시 후 다시 시도하라고 알림',
      label: '분당 호출 한도',
    },
  },
  // js/menu/studio.js:53-55,113-114
  preview: {
    title: '미리보기',
    tabs: { mcp: 'MCP 도구 정의', req: '원본 요청', res: '응답 변환' },
    mcpNote: 'AI 모델은 이 정의만 봅니다. 원본 필드 이름, 코드값, 인증 정보는 드러나지 않습니다.',
    reqNote: '예시 값으로 만든 원본 요청입니다. 인증 정보는 이음 보관소에서 꺼내 넣고, AI에게는 보여주지 않습니다.',
    origResp: '원본 응답',
    aiResult: 'AI에게 전달하는 결과',
  },
  // js/menu/studio.js:157-174,189
  toast: {
    rewriteDone: 'AI가 설명을 다시 썼습니다. 마음에 들지 않으면 한 번 더 누르세요.',
    fixDrift: '새 필드로 매핑했습니다. 저장하면 다음 호출부터 적용됩니다.',
    reviewDone: (id: string) => `${id} 검토를 마치고 공개했습니다.`,
    include: (id: string) => `${id} 도구를 다시 공개했습니다.`,
    saved: '저장했습니다. 다음 배포 때 반영됩니다.',
    saveFailed: (message: string) => `저장하지 못했습니다. ${message}`,
    published: (id: string) => `${id} 도구를 공개했습니다.`,
    unpublished: (id: string) => `${id} 도구를 AI 공개 대상에서 뺐습니다.`,
    /** 명세 다시 읽기 결과 — 새 작업 · 바뀐 도구가 있는 조각만 ", "로 잇는다(studio.js:173-174) */
    reread: (added: number, drifted: number) => {
      const parts = [
        added > 0 ? `새 작업 ${added}개를 도구 후보로 추가했습니다` : '',
        drifted > 0 ? `명세가 바뀐 도구 ${drifted}개가 있습니다` : '',
      ].filter((part) => part !== '');
      return parts.length > 0 ? `명세를 다시 읽었습니다. ${parts.join(', ')}.` : '명세를 다시 읽었습니다. 바뀐 내용이 없습니다.';
    },
  },
});

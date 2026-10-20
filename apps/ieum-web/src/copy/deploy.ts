// AI 연결 배포 문구 — 옛 원문 그대로(apps/web/ieum/js/menu/deploy.js, 줄 번호는 그 파일). 다듬지 않는다
// 서버 사실과 다른 옛 문구(실행 중 안내 "127.0.0.1에서만" · 연결 예시의 자리표시 · 보안 정책 설명 · 키 발급 안내 · 폼 placeholder ·
// 배포 진행 "10초 가까이")는 이식 기간 동안 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
// 여기 두지 않는 것: 화면 제목 · 머리 설명(copy/shell SCREEN_LABEL · PAGE_DESCRIPTION), 묶음 · 키 상태 라벨(copy/status toolset · key),
// 도구 상태 · 읽기/쓰기(copy/status tool · copy/mode), 층의 닫기 · 취소(copy/shell LAYER_COPY), 실패 문장(서버 resultMsg 그대로),
// 연결 예시의 JSON · curl 모양(app/deploy/snippet — 문구가 아니라 설정 파일 모양)
// 옛 문구의 <b> 강조는 Emphasis(앞 · 강조 · 뒤) 조각으로 나눈다 — 화면이 강조 조각만 요소로 감싼다. 강조가 서버 값(묶음 · 키 이름)이어도 같은 모양이다
//
// 서식(DESIGN Copy 서식): 배포 시작 시각 — ko-KR 두 자리 시 · 분 + "에 시작"(옛 rtInfo :18 그대로 "오후 03:12에 시작"). 입력은 epoch ms
// (api/hooks/useToolsets select가 바꾼 값)
import type { Emphasis } from './discovery';

const em = (pre: string, strong: string, post: string): Emphasis => ({ pre, strong, post });

const TIME_LOCALE = 'ko-KR';
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** 배포 서버 시작 시각 "오후 03:12" — 브라우저 지역 시각(옛 rtInfo :18 toLocaleTimeString). 입력은 epoch ms */
export const fmtStartedAt = (ms: number): string => new Date(ms).toLocaleTimeString(TIME_LOCALE, TIME_FORMAT);

const DELETE_NOTE = '이 주소로 연결한 AI는 더 쓸 수 없습니다.';

export const DEPLOY = Object.freeze({
  // :52 — 묶음이 하나도 없을 때. 뒤 문장은 도구가 있는지에 따라 고른다
  empty: {
    none: '도구 묶음이 없습니다. ',
    hasTools: '도구를 골라 묶음을 만들고 MCP 서버로 배포하세요.',
    noTools: '먼저 원본 시스템을 연결해 도구를 만들어 주세요.',
  },
  /** 빈 상태 · 목록 아래 버튼과 만들기 모달 제목이 같은 말(:52,65,200) */
  createToolset: '도구 묶음 만들기',
  // :60-64
  list: {
    aria: '도구 묶음',
    head: '도구 묶음',
    count: (n: number) => `${n}개`,
    itemMeta: (toolCount: number, audience: string) => `도구 ${toolCount}개, 사용 대상 ${audience}`,
  },
  /** 묶음 칩 — 상태 라벨(copy/status toolset) 뒤에 버전. 초안은 버전 없이 라벨만(:10-12) */
  chip: (label: string, ver: string) => `${label} ${ver}`,
  // :67-75
  detail: {
    aria: '묶음 상세',
    /** updated는 서버가 박아 둔 문자열("방금") */
    meta: (audience: string, updated: string) => `사용 대상 ${audience}, 마지막 변경 ${updated}`,
    edit: '묶음 수정',
    serverLog: '서버 로그',
    stop: '중지',
    deployNext: '새 버전 배포',
    deployFirst: '처음 배포하기',
    endpointLabel: 'MCP 서버 주소',
    copyEndpointAria: '주소 복사',
    endpointNone: '처음 배포하면 주소가 발급됩니다.',
    runLabel: '실행 방식',
    /** 배포한 묶음 — 서버 정보(app/deploy/toolsetView runtimeInfo)가 있으면 " · "로 잇는다 */
    runDeployed: (info: string) => `이 컴퓨터의 프로세스${info ? ` · ${info}` : ''}`,
    runDraft: '배포하면 이 컴퓨터에서 서버 프로세스가 뜹니다',
    // :16-18 — 서버 정보 조각. 조각끼리 " · "로 잇는다
    runPort: (port: number) => `포트 ${port}`,
    runPid: (pid: number) => `PID ${pid}`,
    /** 입력은 epoch ms */
    runStartedAt: (ms: number) => `${fmtStartedAt(ms)}에 시작`,
    infoSeparator: ' · ',
    transportLabel: '전송 방식',
    transportValue: 'Streamable HTTP, 액세스 키 인증',
  },
  // :22-29 — 서버 상태 알림
  notice: {
    /** 굵은 머리 뒤 한 칸 띄고 서버 문장 원문(없으면 빈 글 — 옛 rt.message || '') */
    crashed: (message: string) => em('', '서버가 종료됐습니다.', ` ${message}`),
    restart: '다시 시작',
    stopped: em(
      '',
      '서버가 내려가 있습니다.',
      ' 마지막으로 배포한 버전 그대로 다시 띄울 수 있습니다. 그동안 AI는 이 묶음의 도구를 쓸 수 없습니다.',
    ),
    start: '시작',
    starting: '서버를 시작하는 중입니다. 잠시 뒤 주소가 열립니다.',
    runningHint:
      '이 서버는 이 컴퓨터(127.0.0.1)에서만 열려 있습니다. 같은 컴퓨터의 Claude Code, Gemini CLI 같은 앱은 바로 연결되지만, 클라우드에서 실행되는 AI(OpenAI API, 웹 커넥터 등)는 이 주소에 닿지 못합니다.',
    /** 시작 · 다시 시작 버튼의 요청 중 글자(:157) */
    startPending: '시작하는 중…',
  },
  // :3,31-43,78-80 — AI에 연결하기
  snippet: {
    title: 'AI에 연결하기',
    copy: '복사',
    /** 탭 라벨. 탭 순서는 app/deploy/snippet SNIPPET_CLIENTS */
    clients: { claude: 'Claude', gemini: 'Gemini', gpt: 'GPT', agent: '기타 에이전트' },
    /** 아직 주소가 없을 때(초안) 예시에 넣는 주소 */
    urlPlaceholder: 'http://127.0.0.1:<포트>/mcp',
    keyPlaceholder: 'Bearer <발급받은 액세스 키>',
    serverName: (slug: string) => `ieum-${slug}`,
    note: {
      claude:
        'Claude Code 설정 파일(.mcp.json)에 아래처럼 등록합니다. 터미널에서는 claude mcp add --transport http 로도 추가할 수 있습니다.',
      gemini: 'Gemini CLI 설정 파일(settings.json)의 mcpServers에 추가합니다.',
      gpt: 'OpenAI Responses API 요청의 tools 배열에 원격 MCP 도구로 넣습니다. OpenAI 서버가 이 주소를 직접 부르므로, 이 컴퓨터에서만 열리는 주소로는 연결되지 않습니다. 외부에서 닿는 주소가 필요합니다.',
      agent:
        'MCP 클라이언트를 직접 만든다면 JSON-RPC 2.0 요청을 그대로 보내면 됩니다. tools/list 로 도구 목록을, tools/call 로 실행을 요청합니다.',
    },
  },
  // :85-87 — 포함된 도구(저장본으로 센다)
  tools: {
    title: '포함된 도구',
    summary: (ready: number, held: number) =>
      `공개 ${ready}개${held ? `, 검토가 끝나지 않은 ${held}개는 배포에서 빠집니다` : ''}`,
    columns: { tool: '도구', source: '원본 시스템', mode: '방식', status: '상태' },
  },
  // :89-94 — 보안 정책
  policy: {
    title: '보안 정책',
    sub: '도구별 설정을 따릅니다',
    confirm: '사용자 확인 후 실행',
    confirmDesc: '쓰기 도구는 MCP 도구 정의에 확인 필요 표시가 붙어, 연결한 AI 앱이 사용자에게 먼저 묻습니다',
    mask: '개인정보 마스킹',
    maskDesc: '전화번호, 이메일 등을 가려서 전달',
    log: '호출 기록',
    logDesc: '모든 호출은 호출 로그에 남습니다 (최근 300건)',
    always: '항상',
    limit: '호출 한도',
    limitDesc: '도구별 분당 한도를 액세스 키 단위로 적용',
    perTool: '도구별',
    count: (n: number) => `${n}개`,
  },
  // :45-48 — 액세스 키 상자. 마지막 칸(폐기 버튼)은 머리 글자가 없다
  keys: {
    title: '액세스 키',
    issue: '키 발급',
    columns: { name: '이름', key: '키', created: '발급일', last: '마지막 사용', status: '상태' },
    empty: '발급한 키가 없습니다. 키를 발급해 AI 앱에 연결하세요.',
    revoke: '폐기',
  },
  // :105-117,141-155 — 배포 확인 창
  deployModal: {
    title: (name: string, ver: string) => `${name} ${ver} 배포`,
    /** how는 deployModal.how 중 하나(app/deploy/toolsetView deployHow) */
    body: (readyCount: number, how: string) => em('도구 ', `${readyCount}개`, `를 MCP 서버로 배포합니다. ${how}`),
    how: {
      first: '이 컴퓨터에서 MCP 서버 프로세스가 새로 뜨고 주소가 발급됩니다.',
      running:
        '떠 있는 서버가 다음 요청부터 새 도구 정의로 답합니다. 서버를 다시 시작하지 않아 연결된 AI가 끊기지 않습니다.',
      restart: '내려가 있는 서버를 새 버전으로 다시 띄웁니다.',
    },
    /** 뒤에 줄을 바꿔 도구 id를 인라인 코드로 늘어놓는다(:150) */
    dirty: (n: number) => `저장하지 않은 변경이 있는 도구 ${n}개를 먼저 저장하고 배포합니다.`,
    /** 뒤에 줄을 바꿔 도구 id를 인라인 코드로 늘어놓는다(:151) */
    held: (n: number) => `검토가 끝나지 않은 도구 ${n}개는 이번 배포에서 빠집니다.`,
    nonePublished: '공개 중인 도구가 없어 배포할 수 없습니다. 변환 스튜디오에서 도구를 공개해 주세요.',
    confirm: '배포하기',
    pending: '배포하는 중…',
    retry: '다시 시도',
    /** hasDirty — 요청 때 먼저 저장할 도구가 있었는가 */
    progress: (hasDirty: boolean) =>
      `${hasDirty ? '변경한 도구를 저장하고 ' : ''}서버를 배포하는 중입니다. 처음 띄울 때는 10초 가까이 걸릴 수 있습니다.`,
    /** 완료 토스트 — url은 응답 묶음의 주소(없으면 빈 글), skipped는 공개 상태가 아니어서 빠진 도구 수(있으면 info 토스트) */
    done: (name: string, ver: string, url: string, skipped: number) =>
      `${name} ${ver} 배포를 마쳤습니다. ${url}${skipped ? ` (공개 상태가 아닌 도구 ${skipped}개는 빠졌습니다)` : ''}`,
  },
  // :119-121,156-160 — 서버 시작. 실패 창은 넓은 모달 + 원문, 닫기만
  start: {
    /** url은 응답 묶음의 주소(없으면 빈 글) */
    done: (url: string) => `서버를 시작했습니다. ${url}`,
    failTitle: '서버를 시작하지 못했습니다',
  },
  // :161-164
  stop: {
    title: '서버 중지',
    body: (name: string) =>
      em('', name, ' 서버를 중지하면 연결된 AI가 이 주소로 도구를 쓸 수 없습니다. 다시 시작하면 같은 주소로 돌아옵니다.'),
    confirm: '중지',
    done: (name: string) => `${name} 서버를 중지했습니다.`,
  },
  // :165-171 — 서버 로그 창(닫기 · 새로 읽기)
  logs: {
    title: (name: string) => `${name} 서버 로그`,
    /** 코드 상자 안 문장이다 — 빈 상태 부품이 아니다(DESIGN Copy 빈 상태) */
    empty: '아직 남은 로그가 없습니다.',
    reload: '새로 읽기',
  },
  // :172-174 — 키 발급. 이름이 비면 defaultName으로 보낸다(서버도 같은 값을 넣는다)
  keyIssue: {
    title: '액세스 키 발급',
    nameLabel: '키 이름',
    namePlaceholder: '예: 영업팀 Gemini 연동',
    hint: '키마다 연결할 도구 묶음과 사용 대상을 따로 제한할 수 있습니다.',
    confirm: '발급',
    defaultName: '새 액세스 키',
  },
  // :176-177 — 발급 결과(취소 없음 · Esc · 가림막으로 닫히지 않음)
  keyReveal: {
    title: '키를 발급했습니다',
    body: em('아래 키는 ', '지금 한 번만', ' 보여 드립니다. 창을 닫기 전에 복사해 안전한 곳에 보관하세요.'),
    confirm: '확인',
  },
  // :180-182
  keyRevoke: {
    title: '액세스 키 폐기',
    body: (name: string) =>
      em('', name, ' 키를 폐기하면 이 키로 연결한 AI는 바로 도구를 쓸 수 없습니다. 폐기한 키는 되살릴 수 없습니다.'),
    confirm: '폐기',
    done: (name: string) => `${name} 키를 폐기했습니다.`,
  },
  // :190-212 — 묶음 만들기 · 수정 폼
  form: {
    createTitle: '도구 묶음 만들기',
    create: '만들기',
    created: (name: string) => `${name} 묶음을 만들었습니다. 배포하면 MCP 주소가 열립니다.`,
    editTitle: '도구 묶음 수정',
    save: '저장',
    saved: '저장했습니다. 새 버전을 배포하면 적용됩니다.',
    delete: '삭제',
    deleted: (name: string) => `${name} 묶음을 삭제했습니다. ${DELETE_NOTE}`,
    nameLabel: '이름',
    namePlaceholder: '예: 인사·근태 도우미',
    slugLabel: '주소 이름',
    slugPlaceholder: 'hr',
    audienceLabel: '사용 대상',
    /** 만들기 폼의 사용 대상 처음 값 */
    audienceDefault: '전 직원',
    toolsLabel: '포함할 도구',
  },
  /**
   * 묶음 삭제 확인 — 옛에는 없던 확인 창이다(옛은 수정 모달의 "삭제"가 바로 지웠다 :209-212). 수정 창 자리를 이 확인으로 바꿔 끼운다.
   * 새 문구: 제목은 이음 삭제 확인 꼴("원본 시스템 삭제" js/menu/sources.js:144), 본문 뒷문장은 삭제 완료 토스트(:211) 그대로
   */
  deleteConfirm: {
    title: '도구 묶음 삭제',
    body: (name: string) => em('', name, ` 묶음을 삭제합니다. ${DELETE_NOTE}`),
    confirm: '삭제',
  },
  /** 복사 버튼(주소 · 연결 예시 · 발급한 키) 결과 토스트 — 옛 copyText(js/common/overlay.js:34-37). 막히면 경고 */
  copy: {
    done: '복사했습니다.',
    blocked: '이 브라우저에서는 자동 복사가 막혀 있습니다. 직접 선택해 복사하세요.',
  },
});

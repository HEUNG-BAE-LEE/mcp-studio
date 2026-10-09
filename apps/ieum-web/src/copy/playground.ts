// 테스트 실행 문구 — 옛 원문 그대로(js/menu/playground.js · 확인 상자 js/common/convert.js:175). 다듬지 않는다
// 여기 두지 않는 것: 화면 제목 · 설명(copy/shell SCREEN_LABEL · PAGE_DESCRIPTION — 설명은 이식 기간 보존), 변환 과정 단계 머리
// (확인 대기 단계 포함 — copy/trace TRACE), 모델 라벨(서버 models), 실패 문장(서버 resultMsg · error 그대로)
// 문장 사이에 요소(링크 · 인라인 코드)가 끼는 문구는 조각으로 나눈다 — 조각의 앞뒤 공백은 옛 원문 그대로 조각에 들어 있다

export const PLAYGROUND = Object.freeze({
  // js/menu/playground.js:36 — 공개 대상 도구가 하나도 없을 때. 링크 조각만 요소
  empty: {
    before: '테스트할 도구가 없습니다. ',
    link: '원본 시스템',
    after: '을 연결해 도구를 만들어 주세요.',
  },
  // js/menu/playground.js:41-44 — 왼쪽 상자
  call: {
    /** 상자 제목이자 section 이름 */
    title: '도구 호출',
    /** 제목 옆 보조 글 — 이름은 workspace.user(요청 본문 user와 같은 값) */
    user: (name: string) => `호출 사용자 ${name}`,
    /** 모델 고르기 radiogroup 이름 */
    modelGroup: 'AI 모델',
  },
  // js/menu/playground.js:47 — 도구 select
  tool: {
    label: '도구',
    /** select 이름 — 교차 검증 드라이버가 이 이름으로 찾는다 */
    aria: '도구 선택',
    /** 옵션 글 = 도구 id + 쓰기면 이 글 + 검토 중(review · drift)이면 이 글. 다른 화면의 상태 라벨과 다르다(옛 그대로) */
    writeSuffix: ' (쓰기)',
    reviewSuffix: ' · 검토 중',
  },
  // js/menu/playground.js:15,17,24 — 인자 폼
  args: {
    none: '이 도구는 입력이 필요 없습니다.',
    /** 경고 토스트 — 이름 뒤 띄어쓰기도 옛 그대로 */
    notNumber: (name: string) => `${name} 는 숫자여야 합니다.`,
    notJson: (name: string) => `${name} 는 JSON 형식이어야 합니다.`,
  },
  // js/menu/playground.js:50 — 버튼 줄
  run: {
    idle: '실행',
    busy: '호출하는 중…',
  },
  reset: '초기화',
  // js/menu/playground.js:52-54,65-66,98,100,110 — 대화
  chat: {
    /** 대화 목록 이름 — 상자 제목("도구 호출")과 겹치지 않게 새로 둔 이름(옛 목록에는 이름이 없었다) */
    logLabel: '대화',
    placeholder: '자연어로 질문하면 Claude가 도구를 골라 실행합니다',
    inputAria: '질문 입력',
    sendAria: '보내기',
    /** 대화를 쓸 수 없을 때(chatEnabled false) 안내 — 가운데가 인라인 코드 */
    disabledBefore: '서버에 ',
    disabledCode: 'ANTHROPIC_API_KEY',
    disabledAfter: ' 환경변수를 설정하면 자연어 질문으로도 테스트할 수 있습니다.',
    /** 말풍선 위 화자 줄 — 답 · 오류 */
    byAssistant: 'Claude',
    byError: '오류',
    /** 호출 칩 = 도구 id + " " + 결과 글리프 + 이 글. 글리프는 아이콘 옆 시각 숨김 글로 남긴다(새 문구 없이 옛과 같이 읽힌다) */
    glyph: { ok: '✓', fail: '✕' },
    showTrace: ' 변환 과정 보기',
    typing: '도구를 호출하는 중',
    /** 답 글이 비었을 때 */
    noAnswer: '(답변 없음)',
    /** 대화 호출이 실패했을 때 변환 과정 실패 단계 문장 — 서버 오류 문장은 쓰지 않는다(옛 그대로) */
    callFailed: '호출에 실패했습니다.',
  },
  // js/menu/playground.js:56-57,73,77 — 오른쪽 상자
  trace: {
    /** 상자 제목이자 section 이름 */
    title: '변환 과정',
    /** 제목 옆 작은 부제 — 결과의 도구 id, 그 원본 이름 */
    sub: (toolId: string, sourceName: string) => `${toolId}, ${sourceName}`,
    /** 결과가 없을 때 두 줄 안내 */
    empty1: '도구를 실행하면 AI의 도구 호출이 원본 시스템 요청으로',
    empty2: '어떻게 바뀌는지 여기에 실제 요청과 응답으로 보여 드립니다.',
  },
  // js/common/convert.js:175 · js/menu/playground.js:112 — 확인 대기 상자 본문(단계 머리 "사용자 확인" · "쓰기 작업"은 copy/trace)
  hold: {
    /** 도구에 confirmQ가 없을 때의 질문 */
    defaultQuestion: '이 작업을 실행할까요?',
    approve: '실행',
    reject: '그만두기',
    note: '이 도구는 사용자 확인 후 실행하도록 설정되어 있습니다.',
    /** 그만두기 정보 토스트 */
    rejected: '실행하지 않았습니다.',
  },
});

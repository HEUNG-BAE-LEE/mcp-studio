// 자동 탐색 문구 — 옛 원문 그대로(apps/web/ieum/js/menu/discovery.js, 줄 번호는 그 파일). 다듬지 않는다
// 서버 사실과 다른 옛 문구(안전 설명 "로그인 요청만 예외" · "그 경로의 POST 만…", 근거 "한 가지라…" · 근거 실패 문장 하나)는
// 이식 기간 동안 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
// 여기 두지 않는 것: 상태 라벨(작업 · 추천 · 기록 태그 — copy/status), 마법사 머리 "원본 시스템" · "원본 시스템 연결" · "N/3 단계" · 이전 · 다음
// (copy/sources), 뒤로 링크 "원본 시스템"(copy/shell SCREEN_LABEL), 층의 닫기 · 취소(copy/shell), 값 없음 `—`(copy/format NONE),
// 실패 문장(서버 resultMsg 그대로)
// 옛 문구의 <b> 강조는 Emphasis(앞 · 강조 · 뒤) 조각으로, 인라인 코드는 CodeParts(짝수 칸 글 · 홀수 칸 코드)로 나눈다 — 화면이 조각만 요소로 감싼다
//
// 서식(DESIGN Copy 서식): 탐색 예약 시각 "M월 D일 HH:MM 시작"(브라우저 지역 시각) · 탐색 경과 "m:ss". 옛 fmtAt · mmss(:11,13)와 글자가 같다.
// 입력은 둘 다 ms다(api/discoveryJob · api/hooks/useDiscovery가 바꾼 값)
import { MS_PER_SEC } from '../api/time';
import type { ToolMode } from '../api/types';
import { pad2 } from './format';
import { modeLabel } from './mode';

/** 굵게 쓰는 한 조각과 그 앞뒤 글 */
export type Emphasis = Readonly<{ pre: string; strong: string; post: string }>;
/** 인라인 코드가 섞인 문장 — 짝수 칸(0, 2, …)은 글, 홀수 칸은 인라인 코드 */
export type CodeParts = readonly string[];

const em = (pre: string, strong: string, post: string): Emphasis => ({ pre, strong, post });

const SEC_PER_MIN = 60;

/** 탐색 예약 시각 "M월 D일 HH:MM 시작" — 브라우저 지역 시각(옛 fmtAt :13). 입력은 epoch ms */
export function fmtStartsAt(ms: number): string {
  const at = new Date(ms);
  return `${at.getMonth() + 1}월 ${at.getDate()}일 ${pad2(at.getHours())}:${pad2(at.getMinutes())} 시작`;
}

/** 탐색 경과 · 기록 시각 "m:ss" — 초로 반올림(옛 mmss(Math.round(s)) :11,195,228). 입력은 ms */
export function fmtMinSec(ms: number): string {
  const sec = Math.round(ms / MS_PER_SEC);
  return `${Math.floor(sec / SEC_PER_MIN)}:${pad2(sec % SEC_PER_MIN)}`;
}

type SourceSwitches = Readonly<{ git: boolean; crawl: boolean }>;
const joinOn = (opts: SourceSwitches, git: string, crawl: string, sep: string): string =>
  [opts.git && git, opts.crawl && crawl].filter(Boolean).join(sep);

const LOGIN_UNKNOWN = '로그인 방법을 알아내지 못해 이 도구들은 아직 실행할 수 없습니다. 화면 탐색을 켜고 다시 탐색해 주세요.';
const NO_GIT_RUN = '이번 탐색에서는 Git 소스 분석을 하지 않았습니다.';
const NO_CRAWL_RUN = '이번 탐색에서는 화면 탐색을 하지 않았습니다.';

// :6 — 모르는 값은 원문 그대로(frameworkLabel)
const FRAMEWORKS: Readonly<Record<string, string>> = Object.freeze({
  auto: '자동 감지',
  spring: 'Spring MVC, 전자정부, Spring Boot',
  express: 'Express',
  fastapi: 'FastAPI, Flask',
});

// :332 — 근거 요약 칸. 모르는 값은 "범위 밖"(옛 삼항의 마지막 갈래)
const EVIDENCE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  both: '소스와 트래픽 모두',
  src: '소스에만',
  tr: '트래픽에만',
  out: '범위 밖',
});

export const DISCOVERY = Object.freeze({
  // 원본 화면 아래 작업 표(:17-29)
  jobs: {
    title: '자동 탐색 작업',
    // :28 — 마지막 칸은 이름이 없다
    columns: { target: '대상', how: '방식', status: '상태', found: '찾은 API', registered: '등록', manage: '' },
    // :12 — 작업 화면 머리(head.how)와 다른 표기다
    how: (opts: SourceSwitches) => joinOn(opts, 'Git 소스', '운영 화면', ' + '),
    // :23 예약됨 칩 아래
    startsAt: (ms: number) => fmtStartsAt(ms),
    // :24 — 찾은 API 칸만 숫자를 강조한다(.num), 등록 칸은 꾸밈 없는 글
    count: (n: number) => em('', String(n), '개'),
    registered: (n: number) => `${n}개`,
    // :25
    open: '열기',
    review: '결과 검토',
    delete: '삭제',
    deleteAria: (name: string) => `${name} 탐색 기록 삭제`,
  },
  // 연결 마법사 탐색 모드(:40-86)
  wizard: {
    desc: '명세가 없는 시스템은 Git 소스와 운영 화면을 분석해 API를 찾습니다.',
    steps: ['연결 방식', '탐색 대상', '안전 설정'],
    // :86 — 시작 시각이 "지금 바로"면 start, "시각 예약"이면 schedule
    start: '탐색 시작',
    schedule: '탐색 예약',
    // :42 — 안내 뒤 한 칸 띄고 링크 버튼
    demoNotice: '이 서버에는 시연용 구매관리 시스템과 Java 소스 샘플이 들어 있어 바로 탐색해 볼 수 있습니다.',
    demoFill: '시연용 값 채우기',
    // :43
    name: { label: '시스템 이름', placeholder: '비우면 운영 주소의 호스트 이름을 씁니다' },
    // :45-48 — 계정 두 칸은 placeholder가 aria-label이다
    prod: {
      title: '운영 접속 정보',
      desc: '화면 탐색에 쓰고, Git에서 찾은 읽기 API를 실제로 호출해 검증할 때도 씁니다',
      base: '운영 주소',
      basePlaceholder: 'http://10.20.4.30:8080/po',
      start: '로그인 페이지',
      startPlaceholder: '/login.do',
      account: '테스트 계정',
      accountPlaceholder: '아이디',
      passwordPlaceholder: '비밀번호',
    },
    // :51-56 — 스위치 aria-label은 제목
    git: {
      title: 'Git 소스 분석',
      desc: '컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다',
      repo: '저장소',
      repoPlaceholder: 'https://git.example.com/legacy/po-web.git',
      branch: '브랜치',
      branchPlaceholder: '비우면 기본 브랜치',
      token: '접근 토큰',
      tokenPlaceholder: '비공개 저장소일 때만',
      tokenAria: '읽기 전용 접근 토큰',
      framework: '프레임워크',
      note: '읽기 전용 토큰만 쓰고, 분석이 끝나면 내려받은 소스를 지웁니다. 이 서버에 허용된 폴더는 경로로 바로 읽을 수 있습니다.',
      // 서버에 git이 없을 때만 note 뒤에 붙는다(한 칸 띄고 굵게)
      noGit: em(' ', '이 서버에는 git 이 없어 경로만 쓸 수 있습니다.', ''),
    },
    // :59-65 — 스위치 aria-label은 제목
    crawl: {
      title: '운영 화면 탐색',
      desc: '헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다',
      // 앞에 경고 아이콘
      noBrowser: [
        '이 서버에서 쓸 수 있는 브라우저가 없습니다. Chrome 을 설치하거나 서버에서 ',
        'python -m playwright install chromium',
        ' 을 실행해 주세요.',
      ] satisfies CodeParts,
      scope: '탐색 범위',
      scopePlaceholder: '비우면 운영 주소 아래 전부 (예: /po/*)',
      exclude: '제외 경로',
      excludePlaceholder: '/logout.do, /admin/*',
      readPost: '조회용 POST',
      readPostPlaceholder: '비움 (예: /po/*List.do)',
      maxPages: '최대 화면 수',
      note: [
        '경로는 ',
        '/po/*',
        ' 처럼 서버 기준으로도, ',
        '/logout.do',
        ' 처럼 운영 주소 기준으로도 쓸 수 있습니다. 조회에 POST 를 쓰는 시스템이면 그 경로만 적어 주세요. 그 경로의 POST 만 운영에 실제로 보냅니다.',
      ] satisfies CodeParts,
    },
  },
  frameworkLabel: (framework: string): string => FRAMEWORKS[framework] ?? framework,
  // 마법사 3단계(:68-78)
  safety: {
    // 스위치 aria-label은 제목
    block: {
      title: '쓰기 요청 차단',
      desc: '화면 탐색 중 생기는 POST, PUT, DELETE 요청은 가로채서 형식만 기록하고 운영에 보내지 않습니다. 로그인 요청만 예외로 보냅니다.',
    },
    ban: {
      title: '누르지 않을 버튼',
      desc: '버튼 글자에 아래 단어가 들어 있으면 누르지 않고 건너뜁니다',
      removeAria: (word: string) => `${word} 빼기`,
      addPlaceholder: '단어 추가',
      addAria: '누르지 않을 단어 추가',
    },
    stg: {
      title: 'Git에서 찾은 쓰기 API 검증',
      desc: '운영에서는 쓰기 API를 부르지 않습니다. 스테이징에서만 시험 값으로 호출합니다',
      on: '스테이징에서 검증',
      onHint: '스테이징에 시험 데이터가 생길 수 있습니다',
      urlPlaceholder: 'http://10.20.9.30:8080/po',
      urlAria: '스테이징 주소',
      off: '검증하지 않음',
      offHint: '미검증으로 표시하고 검토 때 직접 확인합니다',
    },
    mask: {
      title: '캡처 데이터 개인정보 마스킹',
      desc: '전화번호, 사업자번호, 주민번호, 카드번호, 이메일은 저장 전에 가립니다. 비밀번호와 토큰은 항상 가립니다',
      aria: '개인정보 마스킹',
    },
    when: {
      title: '탐색 시작 시각',
      desc: '운영 부하를 줄이려면 사용자가 적은 시간에 예약하세요. 서버가 켜져 있어야 시작합니다',
      now: '지금 바로',
      at: '시각 예약',
      timeAria: '예약 시각',
    },
    owner: { label: '승인해 준 담당자', placeholder: '예: 김현우 책임 (구매팀)' },
    approve: {
      title: '운영 시스템 담당자에게 탐색 승인을 받았습니다',
      desc: '탐색 기록은 담당자에게도 공유할 수 있게 남습니다',
    },
  },
  // 단계 검증 경고 토스트(:92-100) · 두 소스를 다 끄려 할 때(:411)
  check: {
    base: '운영 주소를 http:// 또는 https:// 로 시작하게 입력해 주세요.',
    account: '화면 탐색에는 테스트 계정이 필요합니다.',
    repo: 'Git 저장소 주소(또는 허용된 폴더 경로)를 입력해 주세요.',
    stgUrl: '스테이징 주소를 입력하거나 스테이징 검증을 꺼 주세요.',
    startTime: '예약 시각을 입력해 주세요.',
    owner: '승인해 준 담당자를 입력해 주세요.',
    approve: '운영 시스템 담당자의 승인을 받았는지 확인해 주세요.',
    needOne: 'Git 소스 분석과 운영 화면 탐색 중 하나는 켜야 합니다.',
  },
  toast: {
    // :113 info
    scheduled: (ms: number) => `${fmtStartsAt(ms)}합니다. 서버가 켜져 있어야 합니다.`,
    // :402 info
    demoFilled: '시연용 값을 채웠습니다.',
    // :395 info — 예약 취소도 같다
    stopping: '탐색을 멈추는 중입니다.',
    // :381 — 새로 더한 것이 있으면 완료, 없으면 info
    registered: (n: number) => `도구 후보 ${n}개를 등록했습니다. 검토한 뒤 공개하세요.`,
    alreadyRegistered: '고른 API 는 모두 이미 등록되어 있습니다. 기존 도구는 그대로 두었습니다.',
    // :382 — 옛은 3초 뒤 따로 띄웠다. 지금은 앞 토스트 글 뒤에 붙여 경고 하나로 띄운다(이식 기간 고침)
    loginUnknown: LOGIN_UNKNOWN,
    withLoginUnknown: (first: string) => `${first} ${LOGIN_UNKNOWN}`,
    // :363,365 warn — 근거를 못 열 때(요청 실패는 모두 두 번째 문장 — 이식 기간 보존)
    evidenceMissing: '이 API의 탐색 기록을 찾을 수 없습니다.',
    evidenceGone: '탐색 기록이 삭제되어 근거를 볼 수 없습니다.',
  },
  // 작업 화면 머리(:251-258)
  head: {
    title: (name: string) => `${name} 자동 탐색`,
    how: (opts: SourceSwitches) => joinOn(opts, 'Git 소스 분석', '운영 화면 탐색', ', '),
    desc: (how: string, base: string | undefined) => `${how}${base ? `, 운영 ${base}` : ''}`,
    cancel: '탐색 중단',
    cancelScheduled: '예약 취소',
    rerun: '같은 설정으로 다시 탐색',
  },
  // :8,180 — 단계 순서는 app/discovery/jobScreen STAGE_KEYS
  stages: { src: '소스 분석', web: '화면 탐색', merge: '교차 확인', verify: '호출 검증', review: '결과 검토' },
  stageState: { skip: '안 함', fail: '실패' },
  // :185-190 — 쓰지 않은 쪽 칸은 NONE
  counters: {
    pages: '방문한 화면',
    requests: '캡처한 요청',
    controllers: '분석한 컨트롤러',
    found: '발견한 API 후보',
    blocked: '차단한 쓰기 요청',
    skipped: '건너뛴 동작',
    ofMax: (n: number) => ` / ${n}`,
  },
  // 실시간 화면(:193-240)
  live: {
    scheduledAct: (ms: number) => `${fmtStartsAt(ms)}합니다`,
    elapsed: (ms: number) => `경과 ${fmtMinSec(ms)}`,
    browserTitle: '운영 화면 탐색',
    browserSub: (browser: string) => (browser ? `헤드리스 브라우저, ${browser}` : '헤드리스 브라우저'),
    liveBadge: '탐색 중',
    netTitle: '네트워크 기록',
    netSub: '이음이 캡처하고 보낸 요청',
    netEmpty: '아직 기록된 요청이 없습니다.',
    stgMark: '스테이징',
    gitTitle: 'Git 소스 분석',
    // :238 — repo는 스킴을 뗀 값(app/convert/url withoutScheme)
    gitSub: (repo: string, framework: string) => `${repo}${framework ? ` · ${framework}` : ''}`,
    noGit: NO_GIT_RUN,
    gitReading: '저장소를 읽는 중',
    fileName: (file: string) => `…/${file}`,
    deprecated: '@Deprecated',
    noCrawl: NO_CRAWL_RUN,
    // :213 — 캡처 전 자리
    blank: { running: '브라우저를 띄우는 중', scheduled: '예약한 시각에 브라우저를 띄웁니다', none: '캡처한 화면이 없습니다' },
    shotAlt: '헤드리스 브라우저가 보고 있는 운영 화면',
    // :224 — "차단"은 옮기지 않는다(서버가 보내지 않는다)
    hl: { act: '클릭', skip: '건너뜀' },
  },
  // 종료 화면(:267-268)
  ended: {
    why: { failed: '탐색하지 못했습니다.', cancelled: '탐색을 중단했습니다.', interrupted: '탐색이 중단되었습니다.' },
    noError: '찾은 결과가 없습니다.',
  },
  // 결과 검토(:277-317)
  result: {
    doneNotice: (n: number) =>
      em('', `도구 후보 ${n}개를 등록했습니다.`, ' 변환 스튜디오에서 설명과 매핑을 검토한 뒤 공개하세요.'),
    openStudio: '변환 스튜디오 열기',
    foundTitle: (n: number) => `찾은 API ${n}개`,
    vennHint: '원을 누르면 해당 API만 볼 수 있습니다',
    vennAria: (src: number, both: number, tr: number) => `소스 ${src}개, 둘 다 ${both}개, 트래픽 ${tr}개`,
    venn: { src: '소스에만', both: '모두 확인', tr: '트래픽에만', srcHead: 'Git 소스', trHead: '운영 트래픽' },
    legend: {
      both: (n: number) => em('', `모두 확인 ${n}개`, '실제로 쓰이고 있고 소스로 형식까지 확인한 API'),
      src: (n: number) =>
        em('', `소스에만 ${n}개`, '화면에서 호출되지 않은 API. 쓰기 기능이거나 사용하지 않는 API일 수 있습니다'),
      tr: (n: number) =>
        em('', `트래픽에만 ${n}개`, '저장소에 소스가 없는 API. 공통 모듈이나 다른 저장소에 있을 수 있습니다'),
    },
    safeTitle: '안전하게 탐색했습니다',
    safe: {
      blocked: (n: number) => em('쓰기 요청 ', `${n}건`, '을 가로채 운영에 보내지 않았습니다'),
      skipped: (n: number) => em('누르지 않을 버튼과 제외 경로 ', `${n}개`, '를 건너뛰었습니다'),
      masked: (n: number) => em('캡처한 요청과 응답의 개인정보 ', `${n}건`, '을 저장 전에 가렸습니다'),
      maskOff: '개인정보 마스킹을 꺼서 캡처한 값을 그대로 저장했습니다. 비밀번호와 토큰만 가렸습니다',
      // host는 스테이징 주소의 호스트(app/convert/url hostOf)
      stg: (n: number, host: string) =>
        em('쓰기 API ', `${n}개`, `는 스테이징(${host})에서만 호출했고, 운영에는 읽기 요청만 다시 보냈습니다`),
      noStg: '운영에는 읽기 요청만 다시 보냈고, 쓰기 API 는 호출하지 않아 미검증으로 남겼습니다',
      owner: (name: string) => `${name} 승인을 받고 탐색했습니다`,
    },
    filters: { all: '전체', rec: '등록 추천', both: '모두 확인', src: '소스에만', tr: '트래픽에만' },
    rowHint: '행을 누르면 소스 코드, 캡처한 요청, 파라미터 추론 근거를 볼 수 있습니다',
    // :315 — 첫 칸(선택)은 이름이 없다
    columns: { select: '', api: 'API', evidence: '근거', screen: '호출된 화면', verify: '검증', mode: '방식', recommend: '추천' },
    emptyFiltered: '이 조건에 맞는 API가 없습니다.',
    badge: { src: '소스', tr: '트래픽' },
    noScreen: '화면 호출 없음',
    selectAria: (title: string) => `${title} 선택`,
    // 체크 칸 title — 도구 이름이 없는 API만
    cannotTool: 'AI 도구로 만들 수 없는 API입니다',
  },
  // 선택 도크(:316)
  dock: {
    region: '선택한 API',
    count: (n: number) => em('', String(n), '개 선택'),
    recOnly: '추천만 선택',
    register: '도구 후보로 등록',
  },
  // 근거 드로어(:329-355)
  evidence: {
    eyebrow: '탐색 근거',
    title: (method: string, path: string) => `${method} ${path}`,
    // 제목 뒤 — 도구 이름이 있을 때만, 도구 이름은 고정폭
    toolPrefix: ', 도구 이름 제안 ',
    sum: { ev: '근거', verify: '검증', rec: '추천', mode: '방식', samples: '관찰한 호출', screen: '호출된 화면' },
    evLabel: (ev: string): string => EVIDENCE_LABEL[ev] ?? '범위 밖',
    // :335 — 매퍼까지 따라가 SQL 종류를 알면 괄호로
    mode: (mode: ToolMode, sql: string | null) => `${modeLabel(mode)}${sql ? ` (${sql})` : ''}`,
    samples: (n: number) => `${n}건`,
    noSamples: '없음',
    srcTitle: '소스 근거',
    location: (file: string, line: number) => `${file}:${line}`,
    mapperNote: (mapper: string, sql: string | null, mode: ToolMode): CodeParts => [
      '매퍼 ',
      mapper,
      ` 이 ${sql ?? ''} 문이라 ${modeLabel(mode)} 작업으로 분류했습니다.`,
    ],
    noMapper: '매퍼까지 따라가지 못해 메서드 이름으로 읽기·쓰기를 추정했습니다.',
    noSrc: '저장소에서 소스를 찾지 못했습니다.',
    noGit: NO_GIT_RUN,
    trTitle: '트래픽 근거',
    tr: {
      req: '캡처한 요청',
      reqSample: (n: number) => `관찰 ${n}건 중 1건`,
      res: '캡처한 응답',
      masked: '개인정보로 보이는 값은 저장 전에 가렸습니다.',
      blocked: '쓰기 요청이라 가로채서 차단했습니다. 운영에는 보내지 않았고 요청 형식만 기록했습니다.',
      file: '파일을 내려받는 응답이라 본문은 저장하지 않았습니다.',
    },
    noTr: '화면 탐색 중 호출되지 않았습니다.',
    noCrawl: NO_CRAWL_RUN,
    params: {
      title: '파라미터 추론',
      columns: { origin: '원본 파라미터', sourceType: '소스 타입', observed: '관찰한 값', inferred: '추론 결과' },
      noSrc: '소스 없음',
      noObs: '관찰 없음',
      hidden: 'AI 에게 보이지 않음',
    },
    // :354 — 범위 밖도 "한 가지라"(이식 기간 보존)
    foot: {
      both: '근거가 두 가지라 신뢰도가 높습니다',
      one: '근거가 한 가지라 검토가 필요합니다',
      add: '선택에 추가',
      remove: '선택에서 빼기',
      close: '닫기',
    },
  },
  // 기록 삭제 확인(:391) — 이름은 굵게, 취소 버튼은 층 기본
  del: {
    title: '탐색 기록 삭제',
    body: (name: string) =>
      em(
        '',
        name,
        ' 탐색 기록과 저장해 둔 계정 정보를 지웁니다. 이미 등록한 원본 시스템과 도구는 그대로 남지만, 도구의 "탐색 근거 보기"는 열리지 않습니다.',
      ),
    confirm: '삭제',
  },
  // 검증 라벨(:171-172) — 고르는 일은 app/discovery/verifyLabel. 코드 · ms는 서버 값 그대로(없으면 옛처럼 undefined가 글자로 보인다)
  verify: {
    ok: (code: number | undefined, ms: number | undefined) => `운영 ${code}, ${ms}ms`,
    file: (code: number | undefined) => `운영 ${code}, 파일 응답`,
    notFound: '운영 404',
    err: (code: number) => `운영 ${code}`,
    failed: '검증 실패',
    stg: (code: number | undefined, ms: number | undefined) => `스테이징 ${code}, ${ms}ms`,
    stgErr: (code: number | undefined) => `스테이징 ${code}`,
    block: '쓰기라 보내지 않음',
    out: '범위 밖이라 생략',
    none: '미검증',
  },
});

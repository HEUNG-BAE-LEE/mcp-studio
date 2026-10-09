// 연결 마법사 탐색 모드의 입력과 바꾸기 — 순수 함수 · 불변(받은 상태는 고치지 않고 새로 만든다). 옛 S.wz.d · S.wz.ban(js/menu/sources.js:49,
// js/menu/discovery.js:33-35 discWzInit)과 그 동작(:402-416)
// 시도(attemptId)마다 한 번 만든다 — 탐색 개요(GET /discovery/)가 준비된 뒤 처음 탐색 모드를 고를 때. 그 뒤 모드를 오가도 그대로 남고
// 닫으면 비밀번호 · 토큰과 함께 버려진다. 옛은 마법사를 열 때 부트 때 받은 개요로 만들었다
// 입력은 글자마다 쌓인다. 최대 화면 수는 입력 그대로 문자열로 두고 시작 본문을 만들 때 숫자로 바꾼다(startBody)
import type { DiscoveryDemo, DiscoveryResponse } from '../../../../api/types';
import { FALLBACK_MAX_PAGES } from '../../../discovery/jobScreen';

/** 로그인 페이지 · 제외 경로 · 예약 시각 · 프레임워크의 처음 값(옛 :33-35) */
export const DEFAULT_START = '/login.do';
export const DEFAULT_EXCLUDE = '/logout.do';
export const DEFAULT_TIME = '19:00';
const DEFAULT_FRAMEWORK = 'auto';

/** 탐색 시작 시각 — 지금 바로 · 시각 예약 */
export type DiscoverWhen = 'now' | 'at';

export type DiscoverState = Readonly<{
  /** 시스템 이름 — 비면 서버가 운영 주소의 호스트를 쓴다 */
  name: string;
  /** 운영 주소 · 로그인 페이지 · 테스트 계정 */
  base: string;
  start: string;
  account: string;
  password: string;
  /** Git 소스 분석 — 저장소(또는 허용된 폴더 경로) · 브랜치 · 접근 토큰 · 프레임워크(서버 defaults.frameworks의 값) */
  git: boolean;
  repo: string;
  branch: string;
  token: string;
  framework: string;
  /** 운영 화면 탐색 — 범위 · 제외 경로 · 조회용 POST · 최대 화면 수(입력 그대로) */
  crawl: boolean;
  scope: string;
  exclude: string;
  readPost: string;
  maxPages: string;
  /** 쓰기 API를 스테이징에서 검증 — Git을 끄면 함께 꺼진다 */
  stg: boolean;
  stgUrl: string;
  /** 개인정보 마스킹 */
  mask: boolean;
  when: DiscoverWhen;
  /** 예약 시각 HH:MM */
  startTime: string;
  /** 승인해 준 담당자 · 승인 확인 — 승인해야 시작 버튼이 풀린다 */
  owner: string;
  ok: boolean;
  /** 누르지 않을 버튼 단어 — 서버 기본값을 복사해 시작한다 */
  ban: readonly string[];
}>;

/** 글자 칸 하나로 고치는 것 */
export type DiscoverTextField =
  | 'name'
  | 'base'
  | 'start'
  | 'account'
  | 'password'
  | 'repo'
  | 'branch'
  | 'token'
  | 'scope'
  | 'exclude'
  | 'readPost'
  | 'maxPages'
  | 'stgUrl'
  | 'startTime'
  | 'owner';
/** 켜고 끄기만 하는 것. Git · 화면 탐색은 둘 다 끌 수 없어 toggleSource로 */
export type DiscoverFlag = 'stg' | 'mask' | 'ok';
/** 탐색 소스 두 가지 */
export type DiscoverSource = 'git' | 'crawl';

/**
 * 시도의 처음 상태(옛 discWzInit · ban 복사). 화면 탐색은 이 서버에 쓸 수 있는 브라우저가 있을 때만 켜고,
 * 최대 화면 수는 서버 기본(없으면 50), 금지어는 서버 defaults.ban을 복사한다(/sources/의 wizard.banWords가 아니다)
 */
export function initialDiscover({ capabilities, defaults }: DiscoveryResponse): DiscoverState {
  return {
    name: '',
    base: '',
    start: DEFAULT_START,
    account: '',
    password: '',
    git: true,
    repo: '',
    branch: '',
    token: '',
    framework: DEFAULT_FRAMEWORK,
    crawl: Boolean(capabilities.browser),
    scope: '',
    exclude: DEFAULT_EXCLUDE,
    readPost: '',
    maxPages: String(defaults.maxPages || FALLBACK_MAX_PAGES),
    stg: false,
    stgUrl: '',
    mask: true,
    when: 'now',
    startTime: DEFAULT_TIME,
    owner: '',
    ok: false,
    ban: [...defaults.ban],
  };
}

export const changeDiscoverText = (state: DiscoverState, field: DiscoverTextField, value: string): DiscoverState => ({
  ...state,
  [field]: value,
});

export const setDiscoverFlag = (state: DiscoverState, flag: DiscoverFlag, on: boolean): DiscoverState => ({
  ...state,
  [flag]: on,
});

export const selectFramework = (state: DiscoverState, framework: string): DiscoverState => ({ ...state, framework });

/** select 값 그대로 받는다 — at이 아니면 지금 바로 */
export const selectWhen = (state: DiscoverState, value: string): DiscoverState => ({
  ...state,
  when: value === 'at' ? 'at' : 'now',
});

/**
 * Git 소스 분석 · 운영 화면 탐색 스위치(옛 wzDChk :409-413). 둘 다 꺼지게 하는 것이면 null — 부르는 쪽이 상태를 그대로 두고
 * DISCOVERY.check.needOne 경고를 띄운다. Git을 끄면 스테이징 검증도 끈다
 */
export function toggleSource(state: DiscoverState, source: DiscoverSource, on: boolean): DiscoverState | null {
  const otherOn = source === 'git' ? state.crawl : state.git;
  if (!on && !otherOn) return null;
  if (source === 'crawl') return { ...state, crawl: on };
  return { ...state, git: on, stg: on ? state.stg : false };
}

/** 금지어 더하기(옛 Enter — js/main.js:57) — 앞뒤 공백을 빼고, 비었거나 이미 있으면 그대로 */
export function addBanWord(state: DiscoverState, raw: string): DiscoverState {
  const word = raw.trim();
  if (word === '' || state.ban.includes(word)) return state;
  return { ...state, ban: [...state.ban, word] };
}

/** 금지어 빼기(옛 wzBanDel :405) — 다 지워도 시작할 수 있다 */
export const removeBanWord = (state: DiscoverState, word: string): DiscoverState => ({
  ...state,
  ban: state.ban.filter((w) => w !== word),
});

/**
 * "시연용 값 채우기"(옛 wzDemo :402) — 시연 값 열 칸 + 스테이징 검증 켬 · 승인 해제, 그 뒤 Git 켬 · 화면 탐색은 브라우저가 있을 때만.
 * 나머지 칸(토큰 · 범위 · 금지어 등)은 그대로. 완료 안내(DISCOVERY.toast.demoFilled, info)는 부르는 쪽이 띄운다
 */
export function fillDemo(
  state: DiscoverState,
  demo: DiscoveryDemo,
  capabilities: DiscoveryResponse['capabilities'],
): DiscoverState {
  return {
    ...state,
    name: demo.name,
    base: demo.base,
    start: demo.start,
    account: demo.account,
    password: demo.password,
    repo: demo.repo,
    branch: demo.branch,
    stg: true,
    stgUrl: demo.stgUrl,
    owner: demo.owner,
    ok: false,
    git: true,
    crawl: Boolean(capabilities.browser),
  };
}

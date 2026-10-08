import type { ScreenId } from '../app/nav';

export const SCREEN_LABEL: Readonly<Record<ScreenId, string>> = {
  dashboard: '대시보드',
  sources: '원본 시스템',
  discovery: 'API 자동 탐색',
  studio: '변환 스튜디오',
  playground: '테스트 실행',
  deploy: 'AI 연결 배포',
  logs: '호출 로그',
  guide: '컴포넌트 카탈로그',
};
export const PENDING_NOTE = '이 화면은 옮기는 중입니다. 옛 콘솔에서 확인해 주세요.';

// 라우트 오류 화면(app/RouteError) — 화면을 그리다 예외가 났을 때
export const ROUTE_ERROR = Object.freeze({
  title: '화면을 표시하지 못했습니다.',
  body: '잠시 뒤 다시 시도하거나 대시보드로 돌아가 주세요.',
  home: '대시보드로 가기',
});

// ── 셸(app/shell) — 이음 원본 index.html:14-39 · js/common/state.js:13-21 · js/main.js:30-38 문구 그대로 ──

/** LNB 메뉴 화면(탐색 작업 · 카탈로그 제외) */
export type MenuScreenId = Exclude<ScreenId, 'discovery' | 'guide'>;

/** 화면 머리(PageHead) 설명 — 옛 VIEWS의 p(js/common/state.js:14-19). 제목은 SCREEN_LABEL */
export const PAGE_DESCRIPTION: Readonly<Record<MenuScreenId, string>> = {
  dashboard: '원본 시스템이 AI 도구로 바뀌어 얼마나, 어떻게 쓰이고 있는지 확인합니다.',
  sources: '사내 시스템이나 공공 API를 연결하면 명세를 읽어 AI가 쓸 수 있는 도구 후보를 자동으로 만듭니다.',
  studio: '원본 작업이 AI 도구로 어떻게 바뀌는지 확인하고, 설명과 파라미터 매핑을 다듬습니다.',
  playground: 'AI 모델에게 질문해 도구 호출부터 원본 응답 변환까지 단계별로 확인합니다.',
  deploy: '도구를 묶어 MCP 서버로 배포하고 Claude, Gemini, GPT, 사내 Agent에 연결합니다.',
  logs: 'AI가 어떤 도구를 호출했고 이음이 어떻게 변환했는지 기록을 확인합니다.',
};

/** 서비스 레일 — 버튼 이름(aria-label) 순서 그대로(index.html:14-21). 동작은 없다(버튼 그대로 — 이음 그대로) */
export const RAIL = Object.freeze({
  label: '서비스 메뉴',
  allServices: '전체 서비스',
  gateway: '게이트웨이 관리',
  docs: '개발자 문서',
  team: '팀과 권한',
  usage: '사용량',
  settings: '설정',
});

/** GNB(index.html:25-32) */
export const GNB = Object.freeze({
  logoLabel: '이음 AI 프로토콜 변압기',
  logoName: '이음',
  logoBadge: 'AI 프로토콜 변압기',
  scope: '1차 개발 범위',
  /** 사용자 이름이 빈 문자열일 때의 아바타 글자(js/main.js:66) */
  avatarFallback: '?',
});

/** LNB(index.html:36-37) */
export const LNB = Object.freeze({
  title: '이음 관리 콘솔',
  navLabel: '이음 관리 메뉴',
});

/** 1차 개발 범위 모달(js/main.js:30-38) — 서버 사실과 다른 옛 문구 그대로 보존(DESIGN ## 이식 기간 보존) */
export const SCOPE = Object.freeze({
  title: '1차 개발 범위',
  close: '닫기',
  included: '1차에 포함',
  includedItems: [
    'REST(OpenAPI), SOAP(WSDL), 공공데이터포털 연결',
    '명세 없는 레거시의 호출 샘플 추론',
    'AI 도구 설명 초안 자동 작성',
    '파라미터, 코드값, 날짜 형식 매핑',
    'MCP 서버 배포와 모델별 호출 형식 변환',
    '사용자 확인, 마스킹, 호출 한도 정책',
    '명세 변경 감지와 호출 로그',
  ],
  later: '2차 이후',
  laterItems: [
    'DB 직접 조회, GraphQL, gRPC 연결',
    '명세 변경 자동 반영 (1차는 감지만)',
    'A2A 에이전트 간 연동',
    '설치형(온프레미스) 게이트웨이',
    '도구 사용 통계 기반 설명 자동 개선',
  ],
} as const);

/** 층(ui/layers · Modal) 공용 — 옛 openModal의 닫기 ✕ · 취소 버튼(js/common/overlay.js:20,22) */
export const LAYER_COPY = Object.freeze({
  close: '닫기',
  cancel: '취소',
});

/** 화면 첫 조회 실패의 머리 한 줄(ScreenState) — 옛 부트 실패 문장(js/main.js:67)의 앞부분. 원문은 그 아래 줄 */
export const SCREEN_FAILED_TITLE = '서버에서 데이터를 불러오지 못했습니다.';

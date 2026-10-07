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

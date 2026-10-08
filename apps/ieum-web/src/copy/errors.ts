// 데이터 층(api/client.ts)이 만드는 실패 문구. 봉투 실패에 서버 resultMsg가 있으면 그것을 그대로 쓰고, 그 밖은 아래 문구다
/** fetch 예외(status 0) — 옛 콘솔에 없던 새 문구다. 옛 콘솔은 브라우저 영문 원문(Failed to fetch)을 그대로 보였다 */
export const NETWORK_FAILED = '서버에 연결하지 못했습니다.';
/** 봉투가 아닌 응답({detail} · 422 detail 배열 · 빈 본문 · text/plain) · resultMsg가 빈 봉투 실패 — 옛 js/common/api.js:14 문구 그대로 */
export const statusFailed = (status: number) => `요청에 실패했습니다 (${status})`;
/**
 * 개발용 ?mock 실패 시나리오가 봉투 resultMsg로 보내는 문장 — 백엔드 MESSAGES[500](apps/backend/app/ieum/responses.py)을 흉내 낸다.
 * 끝의 표시는 운영 dist에 이 문장이 없는지 grep하는 표식이다(api/scenario만 쓰고, 그곳은 import.meta.env.DEV 안에서만 불린다)
 */
export const SCENARIO_SERVER_ERROR = '서버 오류가 났습니다. [mock]';

// 주소 다듬기 — 글자 없는 순수 함수만 둔다. 옛 공용 hostOf · pathOf(apps/web/ieum/js/common/convert.js:38-39)와
// 자동 탐색의 스킴 떼기(js/menu/discovery.js:209,238) 그대로. 미리보기 원본 요청(origReq)과 자동 탐색 화면이 함께 쓴다

const SCHEME = /^https?:\/\//;

/** 앞의 http:// · https://를 뗀다 */
export const withoutScheme = (url: string): string => url.replace(SCHEME, '');

/** 주소의 호스트(포트 포함) — 스킴을 떼고 첫 `/` 앞까지(옛 hostOf) */
export const hostOf = (url: string): string => withoutScheme(url).split('/')[0] ?? '';

/** 주소의 경로 — 스킴과 호스트를 뗀 나머지를 `/`로 시작하게(옛 pathOf) */
export const pathOf = (url: string): string => `/${withoutScheme(url).split('/').slice(1).join('/')}`;

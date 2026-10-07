// 린트 값 표 — check-css.js · check-source.js가 읽는다. T2B.2에서 이음 규칙 값으로 채운다(R34 — design-guide 값을 이음 기본값으로 두지 않는다)
// 이 파일의 주인은 디자인 세션이다(D8). 정규식에는 g 플래그를 붙이지 않는다(값 전체를 문자열 하나로 본다)

/** 속성 → { allow: (문자열 | 정규식)[], hint }. 값이 allow 중 하나와 맞지 않으면 실패 (예: 자간 · z-index) */
export const ALLOWED_VALUES = Object.freeze({});
/** 속성 → { deny: 정규식[], hint }. 하나라도 맞으면 실패 (예: 웨이트 · 그림자 · 포커스 링 지우기 · 모션 리터럴) */
export const DISALLOWED_VALUES = Object.freeze({});
/** 화면 CSS(src/screens/**, _guide 제외)에서 쓰지 않는 속성 → hint (예: 글자 역할을 덮어쓰는 속성) */
export const SCREEN_DISALLOWED_PROPS = Object.freeze({});
/** 화면 CSS에서 ALLOWED_VALUES 위에 더하는 허용 값 표(모양은 ALLOWED_VALUES와 같다) */
export const SCREEN_ALLOWED_VALUES = Object.freeze({});

/** 값이 없는 자리에 쓰지 않는 표기. 항목 { text, where: 'any' | 'jsx' } — 문자열 전체가 text와 같을 때만 잡는다.
 *  'jsx'는 JSX 자리(텍스트 · 속성 · {…} 안의 값과 ?? · || · 삼항의 값)에서만 본다 */
export const EMPTY_MARKS = Object.freeze([]);
/** 화면에 쓰지 않는 말. 문자열 · JSX 텍스트에 들어 있으면 잡는다 */
export const BANNED_WORDS = Object.freeze([]);

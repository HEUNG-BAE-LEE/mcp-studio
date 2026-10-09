// 린트 값 표 — check-css.js · check-source.js · check-docs.js가 읽는다. 값은 이음 규칙(docs/DESIGN.md 핵심 규칙 · 각 절)에서 온다 — design-guide 값을 이음 기본값으로 두지 않는다
// 이 파일의 주인은 가이드 쪽이다(design-change 스킬 ## 7 — 검사 코드 check-*.js는 화면 쪽). 값을 바꾸면 DESIGN 해당 절을 같이 고친다(design-change 스킬). 정규식에는 g 플래그를 붙이지 않는다(값 전체를 문자열 하나로 본다)
// 정규식은 값 전체에 맞도록 ^ … $로 묶는다(check-css는 search로 대조한다). 토큰 이름이 tokens.css에 있는지는 check-css unknown-custom-property가 따로 본다

// ── 공용 모양 ──
/** 한 축의 토큰 하나만: var(--<접두>-<이름>) */
const tokenOf = (prefix) => new RegExp(`^var\\(--${prefix}-[a-z0-9-]+\\)$`);
/** 그림자 허용 토큰 일곱(DESIGN 핵심 규칙 4 · Elevation & Depth) — 떠 있는 층 하나 · 허브 둘 · 부품 안 표시 넷 */
const SHADOW_TOKEN = /^var\(--(shadow-float|shadow-brand|shadow-brand-sm|shadow-knob|ring-selected|edge-active|halo-current)\)$/;
/** 포커스 링을 지우는 값 — none · transparent · 단위가 있든 없든 0(0 · 0px · 0em · 0rem · 0.0px …). 앞뒤가 이름 · 숫자의 일부면 제외(10px · 0.5px · --x0은 통과) */
const OUTLINE_REMOVED = /(?<![\w.-])(none|transparent|0*\.?0+[a-z]*)(?![\w.%-])/i;
/** 포커스 링 색을 지우는 값 — transparent(색만 바꾸는 outline-color에서) */
const OUTLINE_COLOR_REMOVED = /(?<![\w-])transparent(?![\w-])/i;
/** 0이 아닌 시간 리터럴(120ms · .2s · 1.1s). 0s · 0ms는 지연 가시성(visibility 0s var(--m-*))에 쓰여 허용한다 */
const TIME_LITERAL = /(?<![\w.-])-?(?=\d*\.?\d*[1-9])\d*\.?\d+m?s(?![\w-])/i;

const HINT = Object.freeze({
  tracking: '자간은 var(--tracking-*) 넷 중 하나 — 링크로 바뀐 옛 버튼은 --tracking-control (DESIGN 핵심 규칙 5)',
  z: '쌓임은 var(--z-*) 토큰 (DESIGN Elevation & Depth)',
  fontWeight: '웨이트는 var(--fw-*) 넷 중 하나 — 600(--fw-mono-strong)은 고정폭 글꼴에서만 (DESIGN 핵심 규칙 5)',
  shadow: '그림자는 none 또는 허용 토큰 일곱(--shadow-float · --shadow-brand · --shadow-brand-sm · --shadow-knob · --ring-selected · --edge-active · --halo-current) 하나 — 카드 · 표 · 패널에는 쓰지 않는다 (DESIGN 핵심 규칙 4)',
  opacity: '투명도는 0 · 1 · var(--opacity-*) — 비활성은 --opacity-disabled, 건너뜀은 --opacity-skipped (DESIGN Elevation & Depth)',
  stagger: '시차는 var(--m-stagger) 또는 calc(var(--m-stagger) * 2) (DESIGN Motion)',
  outline:
    '포커스 링을 지우지 않는다(none · 0 · transparent) — 링은 base.css의 전역 :focus-visible 하나이고 예외가 없다. 자리를 옮기려면 outline-offset, 색만 바꾸려면 outline-color에 보이는 색 토큰 (DESIGN 핵심 규칙 12)',
  time: '시간은 var(--m-*) 토큰으로 쓴다 — 리터럴 ms · s는 모션 줄이기(0ms)를 따르지 않는다. 0s는 허용 (DESIGN Motion)',
  screenFont: '줄임 속성 font는 화면 CSS에서 쓰지 않는다 — 크기 · 웨이트 · 행간 · 자간 · 글꼴은 각 축 토큰 하나씩 (DESIGN 핵심 규칙 5)',
  screenAxis: (prefix) => `화면 CSS의 글자 값은 그 축의 토큰 var(--${prefix}-*) 하나만 (DESIGN 핵심 규칙 5 · Typography)`,
});

/** 속성 → { allow: (문자열 | 정규식)[], hint }. 값이 allow 중 하나와 맞지 않으면 실패 (예: 자간 · z-index) */
export const ALLOWED_VALUES = Object.freeze({
  'letter-spacing': { allow: [tokenOf('tracking')], hint: HINT.tracking },
  'z-index': { allow: [tokenOf('z')], hint: HINT.z },
  'font-weight': { allow: [tokenOf('fw')], hint: HINT.fontWeight },
  'box-shadow': { allow: ['none', SHADOW_TOKEN], hint: HINT.shadow },
  opacity: { allow: ['0', '1', tokenOf('opacity')], hint: HINT.opacity },
  'animation-delay': {
    allow: ['var(--m-stagger)', /^calc\(\s*var\(--m-stagger\)\s*\*\s*2\s*\)$/],
    hint: HINT.stagger,
  },
});

/** 속성 → { deny: 정규식[], hint }. 하나라도 맞으면 실패 (예: 웨이트 · 그림자 · 포커스 링 지우기 · 모션 리터럴) */
export const DISALLOWED_VALUES = Object.freeze({
  outline: { deny: [OUTLINE_REMOVED], hint: HINT.outline },
  'outline-style': { deny: [OUTLINE_REMOVED], hint: HINT.outline },
  'outline-width': { deny: [OUTLINE_REMOVED], hint: HINT.outline },
  'outline-color': { deny: [OUTLINE_COLOR_REMOVED], hint: HINT.outline },
  // 반복 모션(infinite)은 막지 않는다 — 이음 그대로 유지(DESIGN ## 이식 기간 유지)
  transition: { deny: [TIME_LITERAL], hint: HINT.time },
  'transition-duration': { deny: [TIME_LITERAL], hint: HINT.time },
  'transition-delay': { deny: [TIME_LITERAL], hint: HINT.time },
  animation: { deny: [TIME_LITERAL], hint: HINT.time },
  'animation-duration': { deny: [TIME_LITERAL], hint: HINT.time },
});

/** 화면 CSS(src/screens/**, _guide 제외)에서 쓰지 않는 속성 → hint (예: 글자 역할을 덮어쓰는 속성) */
export const SCREEN_DISALLOWED_PROPS = Object.freeze({
  font: HINT.screenFont,
});

/** 화면 CSS에서 ALLOWED_VALUES 위에 속성별로 덮어쓰는 허용 값 표(모양은 ALLOWED_VALUES와 같다) — 글자 다섯 축은 토큰 하나만 */
export const SCREEN_ALLOWED_VALUES = Object.freeze({
  'font-size': { allow: [tokenOf('fs')], hint: HINT.screenAxis('fs') },
  'font-weight': { allow: [tokenOf('fw')], hint: HINT.screenAxis('fw') },
  'line-height': { allow: [tokenOf('lh')], hint: HINT.screenAxis('lh') },
  'letter-spacing': { allow: [tokenOf('tracking')], hint: HINT.screenAxis('tracking') },
  'font-family': { allow: [tokenOf('font')], hint: HINT.screenAxis('font') },
});

/** 값이 없는 자리에 쓰지 않는 표기. 항목 { text, where: 'any' | 'jsx' } — 문자열 전체가 text와 같을 때만 잡는다.
 *  'jsx'는 JSX 자리(텍스트 · 속성 · {…} 안의 값과 ?? · || · 삼항의 값)에서만 본다.
 *  값 없음 표기 `—`는 copy/의 NONE · NONE_REASON.*로만 쓴다(DESIGN 핵심 규칙 6 · Copy 값 없음) */
export const EMPTY_MARKS = Object.freeze([{ text: '—', where: 'any' }]);
/** 화면에 쓰지 않는 말. 문자열 · JSX 텍스트에 들어 있으면 잡는다.
 *  비워 둔다 — 같은 개념의 여러 이름은 이식 기간에 자리별 지금 이름 그대로 옮긴다(DESIGN Copy 상태 값) */
export const BANNED_WORDS = Object.freeze([]);
/** 부품 · 레이아웃 CSS(*.module.css)에서 쓰는 @media 조건 — 이음 브레이크포인트 다섯 개(DESIGN 핵심 규칙 11 · Layout 브레이크포인트). 화면 CSS는 @media를 쓰지 않는다 */
export const ALLOWED_MEDIA = Object.freeze([
  '(max-width: 1680px)',
  '(max-width: 1500px)',
  '(max-width: 1360px)',
  '(max-width: 1100px)',
  '(max-width: 760px)',
]);

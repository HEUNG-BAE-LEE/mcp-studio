import disableReason from './apps/web/lint/disable-reason.js';
import knownCustomProperty from './apps/web/lint/known-custom-property.js';
import noLiteralPx from './apps/web/lint/no-literal-px.js';

// 규칙 번호는 DESIGN `## 핵심 규칙`. 내장 규칙은 팀원이 어느 토큰을 써야 하는지 알려 주는 메시지를 단다
const MOTION_LITERAL = /\b\d*\.?\d+m?s\b/;
const FONT_ROLE_TOKEN = /^var\(--t-[\w-]+\)$/;

// 속성별 안내. 한 규칙이 여러 속성을 검사하므로 메시지 함수가 속성 이름으로 고른다
const FOCUS_RING_HINT =
  '포커스 링을 지우지 않습니다. 링은 base.css의 :focus-visible 전역 규칙 하나이고 예외는 DESIGN 접근성 포커스 (DESIGN 핵심 규칙 12)';
const MOTION_HINT =
  '모션 시간은 var(--m-fast) · var(--m-fade) 토큰을 씁니다. 애니메이션을 끄려면 `transition: none` (DESIGN Motion)';

const ALLOWED_HINTS = {
  'letter-spacing': '자간은 0 또는 var(--tracking-*) 토큰만 씁니다 (DESIGN 핵심 규칙 5)',
  'z-index': '0 · 1 · auto 또는 var(--z-*) 토큰만 씁니다 (DESIGN Elevation & Depth)',
  font: '화면은 글자 역할을 덮어쓰지 않습니다. font: var(--t-…) 토큰 한 줄만 씁니다 (DESIGN 핵심 규칙 5)',
};

const DISALLOWED_HINTS = {
  'font-weight': '웨이트는 400 · 500 · 600만 씁니다. 600은 14px 이상 (DESIGN 핵심 규칙 5)',
  'box-shadow':
    '그림자는 var(--shadow-modal) · var(--shadow-panel) · var(--shadow-popover) 셋뿐이고 카드 · 표에는 쓰지 않습니다 (DESIGN 핵심 규칙 4)',
  outline: FOCUS_RING_HINT,
  'outline-width': FOCUS_RING_HINT,
  transition: MOTION_HINT,
  'transition-duration': MOTION_HINT,
  'transition-delay': MOTION_HINT,
  animation: MOTION_HINT,
  'animation-duration': MOTION_HINT,
  'animation-delay': MOTION_HINT,
};

const hintMessage = (hints) => (prop, value) => `${prop} "${value}": ${hints[prop]}`;

// overrides는 규칙 설정을 통째로 바꾸므로 기본 목록을 상수로 두고 양쪽에서 펼친다
const BASE_ALLOWED = {
  'letter-spacing': ['0', 'normal', /^var\(--tracking-[\w-]+\)$/],
  'z-index': ['0', '1', 'auto', /^var\(--z-[\w-]+\)$/],
};
const allowedList = (extra = {}) => [
  { ...BASE_ALLOWED, ...extra },
  { message: hintMessage(ALLOWED_HINTS) },
];

/** @type {import('stylelint').Config} */
export default {
  plugins: [noLiteralPx, knownCustomProperty, disableReason],
  // 규칙 이름 없는 `stylelint-disable`은 mcp/disable-reason까지 끄므로 막는다. 쓸모없는 끄기 주석도 막는다
  reportUnscopedDisables: true,
  reportNeedlessDisables: true,
  // 사유 없는 끄기는 내장 검사로 막는다. `mcp/disable-reason` 자신을 끄는 주석은 lint:docs(check-docs.js)가 막는다
  reportDescriptionlessDisables: true,
  rules: {
    // DESIGN 핵심 규칙 1 — 토큰만
    'color-no-hex': [
      true,
      { message: (hex) => `색 "${hex}": hex 대신 var(--*) 색 토큰을 씁니다 (DESIGN 핵심 규칙 1)` },
    ],
    'color-named': [
      'never',
      {
        message: (named) =>
          `색 이름 "${named}": 이름 대신 tokens.css의 색 토큰(var(--ink) · var(--canvas) · var(--hairline) …)을 씁니다 (DESIGN 핵심 규칙 1)`,
      },
    ],
    'function-disallowed-list': [
      ['rgb', 'rgba', 'hsl', 'hsla'],
      {
        message: (name) => `${name}(): 색 함수 대신 var(--*) 색 토큰을 씁니다 (DESIGN 핵심 규칙 1)`,
      },
    ],
    'mcp/no-literal-px': true,
    // TSX style 속성으로 넣는 값과 Radix가 주는 값은 tokens.css 밖이다
    'mcp/known-custom-property': [true, { ignore: [/^--radix-/] }],
    'mcp/disable-reason': true,
    // DESIGN 핵심 규칙 5 — 웨이트 400 · 500 · 600, 자간은 0 또는 토큰. 핵심 규칙 4 — 그림자 토큰 3종. 핵심 규칙 12 — 포커스 링을 지우지 않는다. 층 순서 · 모션은 토큰
    'declaration-property-value-allowed-list': allowedList(),
    'declaration-property-value-disallowed-list': [
      {
        'font-weight': [/^(?!(400|500|600)$)/],
        'box-shadow': [/^(?!(var\(--shadow-(modal|panel|popover)\)|none)$)/],
        outline: [/^(none|0)$/],
        'outline-width': [/^0(px)?$/],
        transition: [MOTION_LITERAL],
        'transition-duration': [MOTION_LITERAL],
        'transition-delay': [MOTION_LITERAL],
        animation: [MOTION_LITERAL],
        'animation-duration': [MOTION_LITERAL],
        'animation-delay': [MOTION_LITERAL],
      },
      { message: hintMessage(DISALLOWED_HINTS) },
    ],
  },
  overrides: [
    {
      // 화면은 글자 역할을 덮어쓰지 않는다 — `font: var(--t-*)` 한 줄(DESIGN Typography)
      files: ['apps/web/src/screens/**/*.module.css'],
      rules: {
        'property-disallowed-list': [
          ['font-weight', 'line-height', 'font-family', 'letter-spacing'],
          {
            message: (prop) =>
              `화면 CSS에서 ${prop}를 쓰지 않습니다. 글자는 font: var(--t-…) 토큰 한 줄로 씁니다 (DESIGN 핵심 규칙 5)`,
          },
        ],
        // 줄임 속성 `font`로 웨이트 · 행간 · 글꼴을 되살리지 못하게 한다
        'declaration-property-value-allowed-list': allowedList({ font: [FONT_ROLE_TOKEN] }),
      },
    },
    {
      files: ['apps/web/src/screens/_guide/**/*.module.css'],
      rules: {
        'property-disallowed-list': null,
        'declaration-property-value-allowed-list': allowedList(),
      },
    },
  ],
};

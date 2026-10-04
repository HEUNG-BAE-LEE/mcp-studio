// @ts-check
import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PLATFORM_ONLY = 'platform/*을 통해 접근한다 (README `## 구조`)';

// 화면 폴더끼리 import하지 않는다(README `## 구조`). 공용 조각은 ui/ · app/ · api/ · copy/로 옮긴다.
const SCREENS_DIR = 'apps/web/src/screens';
const SCREEN_FOLDERS = readdirSync(new URL(`./${SCREENS_DIR}`, import.meta.url), {
  withFileTypes: true,
})
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 문구 · 서식 · 값 없음 · 금지어 — DESIGN `## 핵심 규칙` 6 · 9 · 10, Copy 서식
const HANGUL = '/[가-힣]/';
const EMPTY_DASH = '/^\\s*—\\s*$/'; // 모든 소스
const EMPTY_HYPHEN_JSX = '/^\\s*-\\s*$/'; // JSX 안에서만(코드의 '-'는 구분자로 흔하다)
const BANNED_WORDS = '/MCP 커넥터|커넥터 고도화|배지/';

// whole: 템플릿은 조각이 하나일 때만 본다 — `${a}-${b}`의 사이 글자 '-'는 구분자지 값 없음 표기가 아니다
// (TemplateElement의 부모는 TemplateLiteral이다 — 선택자는 항상 TemplateLiteral을 거친다)
const tpl = (whole) => `TemplateLiteral${whole ? '[quasis.length=1]' : ''} > `;
const jsxStrings = (re, whole = false) => [
  `JSXText[value=${re}]`,
  `JSXAttribute > Literal[value=${re}]`,
  `JSXExpressionContainer > Literal[value=${re}]`,
  // {owner ?? '-'} · {ok ? v : '-'}
  `JSXExpressionContainer > :matches(LogicalExpression, ConditionalExpression) > Literal[value=${re}]`,
  `JSXExpressionContainer > ${tpl(whole)}TemplateElement[value.raw=${re}]`,
];
const anyStrings = (re, whole = false) => [
  `Literal[value=${re}]`,
  `${tpl(whole)}TemplateElement[value.raw=${re}]`,
];
const restrict = (selectors, message) => selectors.map((selector) => ({ selector, message }));

const EMPTY_MARK_MESSAGE =
  "값이 없는 자리에 '—' · '-'를 쓰지 않고 사유를 적는다. 범위 · 구분 표기는 copy/ 함수로 (DESIGN 핵심 규칙 6)";
/** 모든 소스: 값 없음 표기 · 금지어 */
const SOURCE_TEXT_RULES = [
  // JSXText는 Literal이 아니라 따로 본다. JSX의 나머지 자리는 generic Literal이 '—'를 이미 잡으므로 '-'만 JSX 묶음에 둔다
  ...restrict(jsxStrings(EMPTY_HYPHEN_JSX, true), EMPTY_MARK_MESSAGE),
  ...restrict(
    [`JSXText[value=${EMPTY_DASH}]`, ...anyStrings(EMPTY_DASH, true)],
    EMPTY_MARK_MESSAGE,
  ),
  ...restrict(
    [`JSXText[value=${BANNED_WORDS}]`, ...anyStrings(BANNED_WORDS)],
    '금지어다 (DESIGN 핵심 규칙 10)',
  ),
];
// 개발자용 메시지(warnOnce · console.*)의 인자는 화면 문장이 아니다
const DEV_MESSAGE =
  "CallExpression:matches([callee.name='warnOnce'], [callee.object.name='console'])";
/** 화면(_guide 제외): 문장은 copy/에서, 숫자 · 날짜 서식은 copy 함수로 */
const SCREEN_TEXT_RULES = [
  // 한글이 든 문자열은 어디에 있든(모듈 상단 상수 · 삼항 · 템플릿 · 속성) 화면 문장이다
  ...restrict(
    [
      `JSXText[value=${HANGUL}]`,
      `Literal[value=${HANGUL}]:not(${DEV_MESSAGE} *)`,
      `TemplateElement[value.raw=${HANGUL}]:not(${DEV_MESSAGE} *)`,
    ],
    '화면 문장은 copy/ 틀에서 만든다 (DESIGN 핵심 규칙 9)',
  ),
  ...restrict(
    [
      'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
      "MemberExpression[object.name='Intl']",
    ],
    '숫자 · 날짜 서식은 copy/format · copy/time 함수로 (DESIGN Copy 서식)',
  ),
];

const screenImportRules = SCREEN_FOLDERS.map((own) => {
  const others = SCREEN_FOLDERS.filter((f) => f !== own);
  const names = others.map(escapeRegex).join('|');
  // 상대 경로(../shell · ../../screens/shell) · 절대 경로(src/screens/shell)가 다른 화면 폴더로 들어가는 것
  const source = `^(\\.\\./)+(screens/)?(${names})(/|$)|(^|/)src/screens/(${names})(/|$)`;
  const message =
    '다른 화면 폴더를 import하지 않는다 — 공용 조각은 ui/ · app/ · api/ · copy/로 옮긴다 (README `## 구조`)';
  // esquery 정규식 리터럴은 `/`를 `\/`로 쓴다
  const selectorRegex = source.replaceAll('/', '\\/');
  return {
    files: [`${SCREENS_DIR}/${own}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: source, message }] }],
      // 동적 import() 경로도 같은 규칙. 문구 · 서식 묶음은 화면 블록이 통째로 갖는다(뒤 블록이 덮기 때문)
      'no-restricted-syntax': [
        'error',
        ...SOURCE_TEXT_RULES,
        ...(own === '_guide' ? [] : SCREEN_TEXT_RULES),
        { selector: `ImportExpression[source.value=/${selectorRegex}/]`, message },
      ],
    },
  };
});

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // tsconfig에 속하지 않는 루트 설정 · 도구 파일
          allowDefaultProject: [
            'eslint.config.js',
            'prettier.config.js',
            'stylelint.config.js',
            'apps/web/lint/*.js',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // `_`로 시작하는 이름과 rest 형제는 의도된 미사용으로 본다
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // 화면과 컴포넌트는 fetch · window · document · navigator를 직접 만지지 않는다 — platform/ · api/를 거친다
    files: ['apps/web/src/screens/**/*.{ts,tsx}', 'apps/web/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'api/hooks로 데이터를 받는다' },
        { name: 'window', message: PLATFORM_ONLY },
        { name: 'document', message: PLATFORM_ONLY },
        { name: 'navigator', message: PLATFORM_ONLY },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...SOURCE_TEXT_RULES] },
  },
  ...screenImportRules,
  {
    // 루트 설정 · 도구 스크립트는 Node에서 실행된다
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.js', '**/*.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);

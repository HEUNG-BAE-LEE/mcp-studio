// 문서 ↔ 코드 대조 — design-guide check-docs를 앱 폴더 기준으로 옮김(DESIGN 값은 한 곳)
// 1) 문서가 이름 붙인 토큰이 tokens.css에 있다  2) docs/에는 DESIGN.md · COMPONENTS.md만  3) COMPONENTS 카탈로그 값 ↔ /_guide 절 이름이 양방향으로 맞다  4) 두 다크 블록이 같고 라이트에 모두 있다
// 5) app/breakpoints.ts 폭 ↔ values.js ALLOWED_MEDIA 폭이 같은 집합이다
// 테스트 파일 금지는 check-source.js, 끄는 주석 사유는 check-css.js · check-source.js가 본다
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lintValues from './values.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DOCS_DIR = join(ROOT, 'docs');
const DOC_FILES = ['COMPONENTS.md', 'DESIGN.md'];
const TOKENS_FILE = join(ROOT, 'src/styles/tokens.css');
const GUIDE_DIR = join(ROOT, 'src/screens/_guide');
const DEFINITION = /(--[\w-]+)\s*:/g;
// 와일드카드(`--fix-*`) · 접미 행(`-fg`)은 이름이 완전하지 않아 잡지 않는다
const DOC_TOKEN = /`(--[a-z0-9-]+)`|var\((--[a-z0-9-]+)\)/g;
// _guide 절 정의: `group: '…', name: '…'`(두 키가 붙어 있으면 순서는 상관없다). 예시 데이터의 `name:`과 구분한다
const GUIDE_SECTION_NAME_PATTERNS = [/group:\s*'[^']*',\s*name:\s*'([^']+)'/g, /name:\s*'([^']+)',\s*group:\s*'[^']*'/g];
const CATALOG_LINE = '- **카탈로그**';
const BACKTICK_VALUE = /`([^`]+)`/g;
// `## 미정`은 아직 없는 토큰을 제안하는 자리라 대조하지 않는다
const PENDING_HEADING = /^## 미정\r?$/m;
// 주석은 같은 길이 공백으로 가린다(check-css mask와 같은 방식 — 위치가 그대로 남는다). 문자열은 값 비교에 쓰이므로 건너뛰기만 한다
const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g;
// 소스(.ts)는 `//` 줄 주석도 가린다 — 문자열이 먼저 맞으면 그 안의 `//`는 건드리지 않는다
const SOURCE_COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g;
const blank = (text) => text.replace(/[^\n]/g, ' ');
const isComment = (match) => match.startsWith('/*') || match.startsWith('//');
const maskComments = (text, pattern = COMMENT_OR_STRING) => text.replace(pattern, (m) => (isComment(m) ? blank(m) : m));
const TOKENS_CSS = maskComments(readFileSync(TOKENS_FILE, 'utf8'));

const tokenNames = new Set([...TOKENS_CSS.matchAll(DEFINITION)].map((m) => m[1]));

const missingDocs = () =>
  DOC_FILES.filter((file) => !existsSync(join(DOCS_DIR, file))).map((file) => `docs/${file}: 문서가 없다`);
const presentDocs = () => DOC_FILES.filter((file) => existsSync(join(DOCS_DIR, file)));
const readDoc = (file) => readFileSync(join(DOCS_DIR, file), 'utf8');
const checkedText = (file) => readDoc(file).split(PENDING_HEADING)[0];

const unknownTokens = (file) =>
  [...checkedText(file).matchAll(DOC_TOKEN)]
    .map((m) => m[1] ?? m[2])
    .filter((name) => !tokenNames.has(name))
    .map((name) => `docs/${file}: ${name} — tokens.css에 없는 토큰 (실제 토큰 이름으로 고치거나 \`## 미정\`으로 옮긴다)`);

const extraDocs = () =>
  readdirSync(DOCS_DIR)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !DOC_FILES.includes(name))
    .map((name) => `docs/${name}: docs/에는 DESIGN.md · COMPONENTS.md만 둔다`);

// /_guide는 T2B.6에서 생긴다. 없으면 절도 없다 — 그때 COMPONENTS에 카탈로그 행이 있으면 실패한다
const guideSectionNames = () =>
  existsSync(GUIDE_DIR)
    ? new Set(
        readdirSync(GUIDE_DIR)
          .filter((name) => name.endsWith('.tsx'))
          .flatMap((name) => {
            const source = readFileSync(join(GUIDE_DIR, name), 'utf8');
            return GUIDE_SECTION_NAME_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)]);
          })
          .map((m) => m[1]),
      )
    : new Set();

const catalogValues = () =>
  existsSync(join(DOCS_DIR, 'COMPONENTS.md'))
    ? new Set(
        readDoc('COMPONENTS.md')
          .split('\n')
          .filter((line) => line.startsWith(CATALOG_LINE))
          .flatMap((line) => [...line.matchAll(BACKTICK_VALUE)])
          .map((m) => m[1]),
      )
    : new Set();

const catalogMismatches = () => {
  const sections = guideSectionNames();
  const values = catalogValues();
  return [
    ...[...values].filter((name) => !sections.has(name)).map((name) => `COMPONENTS: ${name} — /_guide에 없는 절`),
    ...[...sections].filter((name) => !values.has(name)).map((name) => `/_guide: ${name} — COMPONENTS 카탈로그에 없는 절`),
  ];
};

// 다크 토큰 대조 — 두 다크 블록(시스템 다크 · 강제 다크)의 이름 · 값이 같고, 다크 이름이 라이트 :root에 모두 있다
const LIGHT_BLOCK = ':root {';
const MEDIA_DARK = '@media (prefers-color-scheme: dark)';
const MEDIA_DARK_ROOT = ":root:not([data-theme='light'])";
const FORCED_DARK = ":root[data-theme='dark']";
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;

const bodyFrom = (css, openIndex) => {
  let depth = 0;
  for (let i = openIndex; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(openIndex + 1, i);
    }
  }
  return null;
};
const blockBody = (css, header) => {
  const at = css.indexOf(header);
  return at < 0 ? null : bodyFrom(css, css.indexOf('{', at + header.length - 1));
};
const declarations = (body) =>
  new Map([...body.matchAll(DECLARATION)].map((m) => [m[1], m[2].trim()]));

const darkTokenMismatches = () => {
  // 셀렉터 따옴표(' · ")가 서식 도구에 따라 달라도 같은 블록을 찾는다
  const css = TOKENS_CSS.replaceAll('"', "'");
  const light = blockBody(css, LIGHT_BLOCK);
  const media = blockBody(css, MEDIA_DARK);
  const mediaRoot = media === null ? null : blockBody(media, MEDIA_DARK_ROOT);
  const forced = blockBody(css, FORCED_DARK);
  // 빈 블록(`:root {}`)의 본문은 ''이다 — 찾았는지는 null로만 가른다
  if (light === null || mediaRoot === null || forced === null)
    return [`tokens.css: 라이트 · 시스템 다크 · 강제 다크 블록 셋을 모두 찾지 못함`];
  const L = declarations(light);
  const A = declarations(mediaRoot);
  const B = declarations(forced);
  const out = [];
  for (const [name, value] of A) {
    if (!B.has(name)) out.push(`tokens.css: ${name} — 시스템 다크에만 있음`);
    else if (B.get(name) !== value) out.push(`tokens.css: ${name} — 두 다크 블록의 값이 다름`);
    if (!L.has(name)) out.push(`tokens.css: ${name} — 라이트 :root에 없는 다크 토큰`);
  }
  for (const name of B.keys())
    if (!A.has(name)) out.push(`tokens.css: ${name} — 강제 다크에만 있음`);
  return out;
};

// 브레이크포인트 대조(R24 · D11 Q5 안 C) — app/breakpoints.ts BREAKPOINTS의 숫자와 values.js ALLOWED_MEDIA 조건의 폭이 같은 집합이다.
// ALLOWED_MEDIA 항목은 공백을 무시하고 maxWidth 모양 `(max-width: Npx)`여야 한다. breakpoints.ts는 주석을 먼저 가린 뒤 목록 리터럴을 정규식으로 읽는다.
// 두 목록 중 하나라도 비면 오류다 — 빈 둘이 같다고 통과하지 않는다
const BREAKPOINTS_FILE = join(ROOT, 'src/app/breakpoints.ts');
const BREAKPOINTS_LIST = /export\s+const\s+BREAKPOINTS\s*=\s*\[([^\]]*)\]\s*as\s+const/;
const BREAKPOINT_ITEM = /^\d+$/;
const EMPTY_BREAKPOINTS = 'src/app/breakpoints.ts: BREAKPOINTS가 비었다(R24)';
const EMPTY_MEDIA = 'lint/values.js: ALLOWED_MEDIA가 비었다(R24)';
const MAX_WIDTH_QUERY = /^\(\s*max-width\s*:\s*(\d+)px\s*\)$/;

const breakpointWidths = () => {
  if (!existsSync(BREAKPOINTS_FILE)) return { errors: ['src/app/breakpoints.ts: 파일이 없다'], widths: [] };
  const m = BREAKPOINTS_LIST.exec(maskComments(readFileSync(BREAKPOINTS_FILE, 'utf8'), SOURCE_COMMENT_OR_STRING));
  if (!m) return { errors: ['src/app/breakpoints.ts: `export const BREAKPOINTS = [...] as const` 목록을 찾지 못함'], widths: [] };
  const items = m[1].split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return { errors: [EMPTY_BREAKPOINTS], widths: [] };
  const bad = items.filter((item) => !BREAKPOINT_ITEM.test(item));
  return {
    errors: bad.map((item) => `src/app/breakpoints.ts: ${item} — BREAKPOINTS에는 숫자 리터럴만 둔다`),
    widths: items.filter((item) => BREAKPOINT_ITEM.test(item)).map(Number),
  };
};

const mediaWidths = () => {
  const parsed = (lintValues.ALLOWED_MEDIA ?? []).map((query) => ({ query, m: MAX_WIDTH_QUERY.exec(query.trim()) }));
  if (parsed.length === 0) return { errors: [EMPTY_MEDIA], widths: [] };
  return {
    errors: parsed
      .filter(({ m }) => !m)
      .map(({ query }) => `lint/values.js ALLOWED_MEDIA: ${query} — maxWidth 모양 \`(max-width: Npx)\`이 아니다`),
    widths: parsed.filter(({ m }) => m).map(({ m }) => Number(m[1])),
  };
};

const breakpointMismatches = () => {
  const code = breakpointWidths();
  const media = mediaWidths();
  const inMedia = new Set(media.widths);
  const inCode = new Set(code.widths);
  return [
    ...code.errors,
    ...media.errors,
    ...[...inCode].filter((w) => !inMedia.has(w)).map((w) => `src/app/breakpoints.ts: ${w} — lint/values.js ALLOWED_MEDIA에 없는 폭`),
    ...[...inMedia].filter((w) => !inCode.has(w)).map((w) => `lint/values.js ALLOWED_MEDIA: (max-width: ${w}px) — src/app/breakpoints.ts에 없는 폭`),
  ];
};

const problems = [
  ...new Set([
    ...(existsSync(DOCS_DIR) ? [] : ['docs/: 폴더가 없다']),
    ...(existsSync(DOCS_DIR) ? [...missingDocs(), ...presentDocs().flatMap(unknownTokens), ...extraDocs()] : []),
    ...catalogMismatches(),
    ...darkTokenMismatches(),
    ...breakpointMismatches(),
  ]),
];
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('check-docs: 통과');

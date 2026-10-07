// CSS Modules 검사 — design-guide의 stylelint 설정 + 플러그인 셋(no-literal-px · known-custom-property · disable-reason)을
// 의존성 없이 옮긴 것(D3). 대상은 src/**/*.module.css이고, 하나도 없으면 실패한다(R7 — 조용히 꺼지지 않게)
// 규칙: color-literal · literal-px · unknown-custom-property · property-value · screen-property · screen-media · media-query
// @media(D11 Q5-b): 화면 CSS(src/screens/**, _guide 제외)는 쓰지 않는다(screen-media). 그 밖(ui · 레이아웃)은
// values.js ALLOWED_MEDIA(문자열 배열) 중 하나와 공백을 정규화해 글자 그대로 같을 때만 통과(media-query)
// 끄기: 바로 윗줄에 `/* check-css-disable-next-line <규칙>[, <규칙>] -- <사유> */`. 규칙 이름 · 사유가 없거나 끈 것이 없으면 실패
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as values from './values.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_DIR = join(ROOT, 'src');
const TOKENS_FILE = join(ROOT, 'src/styles/tokens.css');
const MODULE_CSS = /\.module\.css$/;
const SKIP_DIRS = new Set(['node_modules', 'dist']);
const SCREENS_DIR = 'src/screens/';
const GUIDE_DIR = 'src/screens/_guide/';

const { ALLOWED_VALUES, DISALLOWED_VALUES, SCREEN_ALLOWED_VALUES, SCREEN_DISALLOWED_PROPS } = values;

const RULE = Object.freeze({
  color: 'color-literal',
  px: 'literal-px',
  token: 'unknown-custom-property',
  value: 'property-value',
  screen: 'screen-property',
  screenMedia: 'screen-media',
  media: 'media-query',
});
const RULE_IDS = new Set(Object.values(RULE));
const DIRECTIVE_RULE = 'disable-comment';

// ── 핵심 규칙 1(토큰만)의 장치 ──
// 예외: 0 · 테두리 두께 1px · 레이아웃 고정폭 속성. outline 계열은 포커스 링 규칙이 따로 본다
const FIXED_WIDTH_PROPS = new Set([
  'width',
  'min-width',
  'max-width',
  'grid-template-columns',
  'grid-template-rows',
  'flex-basis',
  'outline',
  'outline-width',
  'outline-offset',
]);
const BORDER_WIDTH_PROP = /^border(-(top|right|bottom|left))?(-width)?$/;
// 숫자 + px. 음수 부호를 포함하고 대소문자를 가리지 않는다. 앞이 식별자 문자(--s-8px 같은 이름)거나 뒤가 단어면 제외
const PX = /(?<![\w.-])-?(\d*\.?\d+)px(?![\w-])/gi;
const HEX = /#([0-9a-f]+)(?![\w-])/gi;
const HEX_LENGTHS = new Set([3, 4, 6, 8]);
const COLOR_FUNCTION = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const WORD = /(?<![\w-])[a-z]+(?![\w-])/gi;
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
    'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
    'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred ' +
    'darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink ' +
    'deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold ' +
    'goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush ' +
    'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey ' +
    'lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime ' +
    'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
    'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise ' +
    'palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue ' +
    'saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow ' +
    'springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
// 값에 작성자가 지은 이름(애니메이션 · 그리드 영역 · 글꼴 · 카운터 등)이 들어가는 속성은 색 이름을 보지 않는다
const NAME_VALUE_PROPS = new Set([
  'animation',
  'animation-name',
  'composes',
  'container',
  'container-name',
  'counter-increment',
  'counter-reset',
  'counter-set',
  'font',
  'font-family',
  'grid',
  'grid-area',
  'grid-column',
  'grid-column-end',
  'grid-column-start',
  'grid-row',
  'grid-row-end',
  'grid-row-start',
  'grid-template',
  'grid-template-areas',
  'list-style',
  'list-style-type',
  'transition',
  'transition-property',
  'view-transition-name',
  'will-change',
]);

// ── CSS 읽기: 주석 · 문자열 · url() 속을 같은 길이의 공백으로 가린 뒤 선언을 찾는다(줄 번호가 그대로 남는다) ──
const MASKABLE =
  /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|url\((?:[^()"']|"[^"]*"|'[^']*')*\)/gi;
const DECLARATION = /[^{};]+(?=[;}])/g;
const PROPERTY = /^(--[\w-]+|-?[a-z][a-z0-9-]*)$/i;
const IMPORTANT = /\s*!important\s*$/i;
const DEFINITION = /(--[\w-]+)\s*:/g;
const USAGE = /var\(\s*(--[\w-]+)/g;
const DIRECTIVE = /^\s*check-css-disable(\S*)\s*([\s\S]*?)\s*$/;
const NEXT_LINE = '-next-line';
const REASON_SPLIT = /\s--(?:\s|$)/;
const RULE_LIST_SPLIT = /[\s,]+/;

const blank = (text) => text.replace(/[^\n]/g, ' ');
const maskOne = (match) => {
  if (match.startsWith('/*')) return blank(match);
  if (match.startsWith('"') || match.startsWith("'")) return match[0] + blank(match.slice(1, -1)) + match.at(-1);
  return `url(${blank(match.slice(4, -1))})`;
};
const mask = (css) => css.replace(MASKABLE, maskOne);
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;
const toPosix = (path) => path.split(sep).join('/');
const matchesPattern = (value, pattern) =>
  typeof pattern === 'string' ? value === pattern : value.search(pattern) !== -1;
const own = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);
// 공백 정규화: 연속 공백은 하나로, 괄호 안쪽 · 콜론 앞 공백은 지우고 콜론 뒤는 하나로
const normalizeMedia = (condition) =>
  condition
    .replace(/\s+/g, ' ')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')')
    .replace(/\s?:\s?/g, ': ')
    .trim();
const definedIn = (maskedCss) => new Set([...maskedCss.matchAll(DEFINITION)].map((m) => m[1]));

const TOKEN_NAMES = definedIn(mask(readFileSync(TOKENS_FILE, 'utf8')));

const declarationsOf = (css, masked) =>
  [...masked.matchAll(DECLARATION)].flatMap((m) => {
    const colon = m[0].indexOf(':');
    if (colon < 0) return [];
    const name = m[0].slice(0, colon).trim();
    if (!PROPERTY.test(name)) return [];
    const start = m.index + (m[0].length - m[0].trimStart().length);
    const valueStart = m.index + colon + 1;
    const valueEnd = m.index + m[0].length;
    return [
      {
        line: lineAt(css, start),
        prop: name.startsWith('--') ? name : name.toLowerCase(),
        value: masked.slice(valueStart, valueEnd).trim(),
        raw: css.slice(valueStart, valueEnd).trim().replace(IMPORTANT, ''),
      },
    ];
  });

// @media 조건(머리 부분)과 줄. 가린 CSS에서 찾으므로 주석 · 문자열 속 @media는 잡지 않는다
const MEDIA = /@media\b([^{;]*)\{/gi;
const mediaRulesOf = (css, masked) =>
  [...masked.matchAll(MEDIA)].map((m) => ({ line: lineAt(css, m.index), condition: normalizeMedia(m[1]) }));

const commentsOf = (css) =>
  [...css.matchAll(MASKABLE)]
    .filter((m) => m[0].startsWith('/*'))
    .map((m) => ({ endLine: lineAt(css, m.index + m[0].length), body: m[0].slice(2, -2) }));

// ── 규칙별 검사: 선언 하나 → 문제 목록 ──
const colorProblems = ({ prop, value }) => {
  const hexes = [...value.matchAll(HEX)]
    .filter((m) => HEX_LENGTHS.has(m[1].length))
    .map((m) => `색 "${m[0]}": hex 대신 var(--*) 색 토큰을 씁니다`);
  const functions = [...value.matchAll(COLOR_FUNCTION)].map(
    (m) => `${m[1]}(): 색 함수 대신 var(--*) 색 토큰을 씁니다`,
  );
  const names = NAME_VALUE_PROPS.has(prop)
    ? []
    : [...value.matchAll(WORD)]
        .filter((m) => NAMED_COLORS.has(m[0].toLowerCase()))
        .map((m) => `색 이름 "${m[0]}": 이름 대신 tokens.css의 색 토큰을 씁니다`);
  return [...hexes, ...functions, ...names].map((text) => ({ rule: RULE.color, text: `${text} (DESIGN 핵심 규칙 1)` }));
};

const isAllowedPx = (prop, px) => px === 0 || (px === 1 && BORDER_WIDTH_PROP.test(prop));
const pxProblems = ({ prop, value }) =>
  FIXED_WIDTH_PROPS.has(prop)
    ? []
    : [...value.matchAll(PX)]
        .filter((m) => !isAllowedPx(prop, Number(m[1])))
        .map((m) => ({
          rule: RULE.px,
          text:
            `"${prop}"의 ${m[0]}: px 리터럴 대신 var(--*) 토큰을 씁니다 (DESIGN 핵심 규칙 1). ` +
            `치수에서 파생된 값이면 바로 윗줄에 /* check-css-disable-next-line ${RULE.px} -- <근거> */`,
        }));

const tokenProblems = ({ value }, localNames) =>
  [...value.matchAll(USAGE)]
    .map((m) => m[1])
    .filter((name) => !TOKEN_NAMES.has(name) && !localNames.has(name))
    .map((name) => ({
      rule: RULE.token,
      text:
        `${name}: tokens.css에 없는 토큰입니다. 새 토큰은 design-change 스킬로 문서와 tokens.css에 먼저 더합니다. ` +
        `TSX style로 넣는 값이면 같은 파일에 기본값(${name}: 0)을 정의합니다`,
    }));

const valueProblems = ({ prop, raw }, allowedTable) => {
  const allowed = own(allowedTable, prop);
  const denied = own(DISALLOWED_VALUES, prop);
  const notAllowed = allowed && !allowed.allow.some((p) => matchesPattern(raw, p));
  const isDenied = denied && denied.deny.some((p) => matchesPattern(raw, p));
  return [
    ...(notAllowed ? [{ rule: RULE.value, text: `${prop} "${raw}": ${allowed.hint}` }] : []),
    ...(isDenied ? [{ rule: RULE.value, text: `${prop} "${raw}": ${denied.hint}` }] : []),
  ];
};

const screenProblems = ({ prop }) => {
  const hint = own(SCREEN_DISALLOWED_PROPS, prop);
  return hint ? [{ rule: RULE.screen, text: `화면 CSS에서 ${prop}를 쓰지 않는다: ${hint}` }] : [];
};

// ALLOWED_MEDIA는 디자인 세션이 values.js에 채운다(값 5개). 아직 없으면 빈 목록 — ui · 레이아웃의 @media도 모두 실패한다
const allowedMediaList = values.ALLOWED_MEDIA ?? [];
if (!Array.isArray(allowedMediaList) || !allowedMediaList.every((v) => typeof v === 'string')) {
  console.error('check-css: values.js ALLOWED_MEDIA는 문자열 배열이어야 한다');
  process.exit(1);
}
const ALLOWED_MEDIA = new Set(allowedMediaList.map(normalizeMedia));
const allowedMediaText = ALLOWED_MEDIA.size > 0 ? [...ALLOWED_MEDIA].join(' · ') : '(비어 있음)';

const mediaProblems = ({ condition }, isScreen) => {
  if (isScreen)
    return [
      {
        rule: RULE.screenMedia,
        text:
          `@media ${condition}: 화면 CSS에서 @media를 쓰지 않는다 (D11 Q5-b). ` +
          '폭에 따라 접히는 배치는 레이아웃 부품(SplitLayout · TwoColumn · FieldPair)이 맡는다',
      },
    ];
  if (ALLOWED_MEDIA.has(condition)) return [];
  return [
    {
      rule: RULE.media,
      text:
        `@media ${condition}: 허용 목록(lint/values.js ALLOWED_MEDIA)에 없는 조건이다 — ${allowedMediaText}. ` +
        '새 조건은 design-change 스킬로 문서와 values.js에 먼저 더한다',
    },
  ];
};

// ── 끄는 주석 ──
const parseDirective = ({ endLine, body }) => {
  const m = DIRECTIVE.exec(body);
  if (!m) return null;
  const [rulePart, ...reasonParts] = ` ${m[2]}`.split(REASON_SPLIT);
  const rules = rulePart.split(RULE_LIST_SPLIT).filter(Boolean);
  const reason = reasonParts.join(' -- ').trim();
  const errors = [
    ...(m[1] === NEXT_LINE ? [] : [`check-css-disable${m[1]}: 바로 윗줄 끄기(check-css-disable${NEXT_LINE})만 쓴다`]),
    ...(rules.length === 0 ? ['끌 규칙 이름을 적는다'] : []),
    ...rules.filter((r) => !RULE_IDS.has(r)).map((r) => `${r}: 없는 규칙이다 (${[...RULE_IDS].join(' · ')})`),
    ...(reason ? [] : ['사유를 `-- <사유>`로 적는다']),
  ];
  return { line: endLine + 1, commentLine: endLine, rules, errors };
};

const isSuppressedBy = (problem, directive) =>
  directive.errors.length === 0 && directive.line === problem.line && directive.rules.includes(problem.rule);

function checkFile(path) {
  const rel = toPosix(relative(ROOT, path));
  const css = readFileSync(path, 'utf8');
  const masked = mask(css);
  const localNames = definedIn(masked);
  const isScreen = rel.startsWith(SCREENS_DIR) && !rel.startsWith(GUIDE_DIR);
  const allowedTable = isScreen ? { ...ALLOWED_VALUES, ...SCREEN_ALLOWED_VALUES } : ALLOWED_VALUES;

  const found = declarationsOf(css, masked).flatMap((decl) =>
    [
      ...colorProblems(decl),
      ...pxProblems(decl),
      ...tokenProblems(decl, localNames),
      ...valueProblems(decl, allowedTable),
      ...(isScreen ? screenProblems(decl) : []),
    ].map((p) => ({ ...p, line: decl.line })),
  );
  const mediaFound = mediaRulesOf(css, masked).flatMap((media) =>
    mediaProblems(media, isScreen).map((p) => ({ ...p, line: media.line })),
  );
  const directives = commentsOf(css).map(parseDirective).filter(Boolean);
  const allFound = [...found, ...mediaFound];
  const directiveErrors = directives.flatMap((d) =>
    d.errors.map((text) => ({ rule: DIRECTIVE_RULE, line: d.commentLine, text })),
  );
  const unused = directives
    .filter((d) => d.errors.length === 0 && !allFound.some((p) => isSuppressedBy(p, d)))
    .map((d) => ({ rule: DIRECTIVE_RULE, line: d.commentLine, text: '끈 것이 없는 주석이다 — 지운다' }));
  const remaining = allFound.filter((p) => !directives.some((d) => isSuppressedBy(p, d)));

  return [...remaining, ...directiveErrors, ...unused]
    .toSorted((a, b) => a.line - b.line)
    .map((p) => `${rel}:${p.line}: [${p.rule}] ${p.text}`);
}

const cssFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return MODULE_CSS.test(entry.name) ? [path] : [];
  });

const files = cssFiles(SOURCE_DIR);
if (files.length === 0) {
  console.error('check-css: src/**/*.module.css가 하나도 없다 — 검사 경로를 확인한다(R7)');
  process.exit(1);
}
const problems = files.flatMap(checkFile);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-css: ${files.length}개 파일 통과`);

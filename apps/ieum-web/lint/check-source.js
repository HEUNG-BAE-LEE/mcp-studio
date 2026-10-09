// 소스 검사 — oxlint(.oxlintrc.json)로 못 하는 것을 typescript 컴파일러 API로 본다(새 의존성 없이 — design-guide eslint no-restricted-syntax 자리)
// 1) src/copy/ 밖의 한글 문자열 · JSX 텍스트(화면 문장은 copy/ — 핵심 규칙 9). _guide 카탈로그 예시와
//    개발자 메시지(console.* · warnOnce · new Error)는 뺀다
// 2) 값 없음 표기 · 금지어(목록은 lint/values.js)  3) 화면 폴더끼리 import(정적 · 동적 · export from)
//    값 없음 표기 검사(EMPTY_MARKS)는 src/copy/ 안에서 하지 않는다 — 문구 원본(NONE = '—')이 거기 있다. 한글 · 금지어 검사의 범위는 그대로
// 4) 화면 · ui의 전역 우회(window.fetch 등 — oxlint no-restricted-globals는 맨 이름만 본다), 화면의 toLocale*String · Intl
// 5) 테스트 파일 금지(앱 폴더 전체)  6) oxlint · eslint 끄는 주석은 규칙 이름과 `-- <사유>`를 단다
// 7) JSX `style` 속성(src/ 전체, _guide 포함 — 예외 없음): 객체 리터럴의 키는 CSS 사용자 속성('--…')만(inline-style-literal,
//    끌 수 없음). 객체 리터럴이 아닌 값(변수 · 호출 · 삼항)과 리터럴 속 펼침은 키를 미리 확인할 수 없어 실패로 보고(inline-style-dynamic),
//    `style` 속성이 있는 줄 바로 위에 `check-source-disable-next-line inline-style-dynamic -- <사유>`를 단 것만 통과 — 태그 안이면 `// …`, JSX 자식 사이면 `{/* … */}`
//    (여러 줄 태그에서 태그 위에 둔 주석은 먹지 않는다). 규칙 · 사유가 없거나 끈 것이 없으면 실패
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { BANNED_WORDS, EMPTY_MARKS } from './values.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(ROOT, 'src');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite']);
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const SRC_DIR = 'src/';
const COPY_DIR = 'src/copy/';
const SCREENS_DIR = 'src/screens/';
const GUIDE_DIR = 'src/screens/_guide/';
const UI_DIR = 'src/ui/';
const ALIAS = '@/';

// ── 장치 ──
const DEV_MESSAGE_CALLS = new Set(['warnOnce']);
const DEV_ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError']);
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);
// 화면 · ui가 전역 객체로 우회해 부르지 않는 것. 맨 이름(fetch)은 oxlint no-restricted-globals가 막는다
const SCREEN_UI_GLOBALS = new Set(['fetch']);
// 어디서도 부르지 않는 브라우저 대화상자(저장소 규칙 — 자동화를 막고 촬영 화면에서 튄다). 맨 이름 · window. · globalThis.는 oxlint no-alert가 막고, self.는 여기서 막는다
const DIALOG_GLOBALS = new Set(['alert', 'confirm', 'prompt']);
const FORMAT_METHODS = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']);
const FORMAT_GLOBAL = 'Intl';
const LINT_DIRECTIVE = /^(?:\/\/|\/\*)\s*(oxlint|eslint)-disable(-next-line|-line)?(?=[\s*]|$)([\s\S]*?)(?:\*\/)?$/;
const REASON_SPLIT = /\s--(?:\s|$)/;
const RULE_LIST_SPLIT = /[\s,]+/;
const STYLE_ATTRIBUTE = 'style';
const CUSTOM_PROPERTY_PREFIX = '--';
const RULE = Object.freeze({
  styleLiteral: 'inline-style-literal',
  styleDynamic: 'inline-style-dynamic',
  directive: 'disable-comment',
});
// check-source-disable-next-line로 끌 수 있는 규칙. inline-style-literal은 끌 수 없다(DESIGN 핵심 규칙 1)
const DISABLEABLE_RULES = new Set([RULE.styleDynamic]);
const SOURCE_DIRECTIVE = /^(?:\/\/|\/\*)\s*check-source-disable(\S*)\s*([\s\S]*?)\s*(?:\*\/)?$/;
const NEXT_LINE = '-next-line';

const MESSAGE = Object.freeze({
  hangul: '화면 문장은 copy/에서 만든다 (DESIGN 핵심 규칙 9)',
  emptyMark: '값이 없는 자리에 이 표기를 쓰지 않는다 (DESIGN 핵심 규칙 6)',
  banned: (word) => `"${word}"는 금지어다 (DESIGN Copy)`,
  screenImport: '다른 화면 폴더를 import하지 않는다 — 공용 조각은 ui/ · app/ · api/ · copy/로 옮긴다 (README ## 구조)',
  bypass: (name) => `${name}를 전역 객체로 우회해 부르지 않는다 — api/hooks로 데이터를 받는다`,
  dialog: (name) => `${name} 브라우저 대화상자를 쓰지 않는다 — 앱 안 Modal을 쓴다`,
  format: '숫자 · 날짜 서식은 copy/ 함수로 만든다 (DESIGN Copy 서식)',
  test: '테스트 파일을 두지 않는다 (CLAUDE.md 우선 블록)',
  unscoped: '끄는 주석에는 끌 규칙 이름을 적는다',
  noReason: '끄는 주석에는 `-- <사유>`를 단다',
  noSource: 'src/에 .ts · .tsx 파일이 하나도 없다 — 검사 경로를 확인한다',
  styleKey: (key) =>
    `style 객체에는 CSS 사용자 속성('--…') 키만 쓴다 — ${key}는 클래스 · 토큰으로 옮기고 비율 · 좌표만 '--…'로 넘긴다 (DESIGN 핵심 규칙 1)`,
  styleDynamic: (what) =>
    `style에 ${what}을 넘기지 않는다 — '--…' 키만 있는 객체 리터럴로 쓰거나, \`style\` 속성이 있는 줄 바로 위(태그 안이면 \`// …\`, JSX 자식 사이면 \`{/* … */}\`)에 check-source-disable${NEXT_LINE} ${RULE.styleDynamic} -- <사유>`,
  directiveNotNextLine: (suffix) => `check-source-disable${suffix}: 바로 윗줄 끄기(check-source-disable${NEXT_LINE})만 쓴다`,
  directiveNoRule: '끌 규칙 이름을 적는다',
  directiveUnknownRule: (rule) => `${rule}: 끌 수 있는 규칙이 아니다 (${[...DISABLEABLE_RULES].join(' · ')})`,
  directiveNoReason: '사유를 `-- <사유>`로 적는다',
  directiveUnused: '끈 것이 없는 주석이다 — 지운다',
});

const toPosix = (path) => path.split(sep).join('/');
const relOf = (path) => toPosix(relative(ROOT, path));

const filesUnder = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

const scriptKindOf = (path) => {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};
const parse = (path) =>
  ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, scriptKindOf(path));

// getChildren은 토큰까지 돌려준다 — 끄는 주석이 붙는 `}` 같은 토큰의 앞 공백까지 본다. JSDoc 속은 주석이라 내려가지 않는다
const descendants = (node, sf) => [
  node,
  ...node
    .getChildren(sf)
    .filter((child) => !ts.isJSDoc(child))
    .flatMap((child) => descendants(child, sf)),
];

const problemAt = (sf, pos, text) => {
  const { line } = sf.getLineAndCharacterOfPosition(pos);
  return `${relOf(sf.fileName)}:${line + 1}: ${text}`;
};

// ── 1 · 2) 문장 ──
const textOf = (node) => {
  if (ts.isJsxText(node)) return node.containsOnlyTriviaWhiteSpaces ? null : node.text;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return node.text;
  return null;
};
const isModuleSpecifier = (node) =>
  (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) && node.parent.moduleSpecifier === node;
const isDevMessageCall = (node) => {
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (ts.isIdentifier(callee)) return DEV_MESSAGE_CALLS.has(callee.text);
    return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'console';
  }
  return ts.isNewExpression(node) && ts.isIdentifier(node.expression) && DEV_ERROR_CLASSES.has(node.expression.text);
};
const isInDevMessage = (node) => Boolean(node.parent) && (isDevMessageCall(node.parent) || isInDevMessage(node.parent));
// JSX 자리: 텍스트 · 속성 값 · {…} 안의 값, 그리고 {a ?? '…'} · {x ? '…' : y}의 값
const isInJsxSlot = (node) => {
  if (ts.isJsxText(node)) return true;
  const parent =
    ts.isBinaryExpression(node.parent) || ts.isConditionalExpression(node.parent) || ts.isParenthesizedExpression(node.parent)
      ? node.parent.parent
      : node.parent;
  return ts.isJsxAttribute(parent) || ts.isJsxExpression(parent);
};
const isWholeString = (node) => ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

const textProblems = (sf, nodes, rel) => {
  const isCopy = rel.startsWith(COPY_DIR);
  const checksHangul = !isCopy && !rel.startsWith(GUIDE_DIR);
  const checksEmptyMark = !isCopy;
  return nodes.flatMap((node) => {
    const text = textOf(node);
    if (text === null || isModuleSpecifier(node)) return [];
    const trimmed = text.trim();
    const hangul = checksHangul && HANGUL.test(text) && !isInDevMessage(node) ? [MESSAGE.hangul] : [];
    const isEmptyMark = EMPTY_MARKS.some(
      (m) => isWholeString(node) && trimmed === m.text && (m.where === 'any' || isInJsxSlot(node)),
    );
    const empty = checksEmptyMark && isEmptyMark ? [MESSAGE.emptyMark] : [];
    const banned = BANNED_WORDS.filter((word) => text.includes(word)).map(MESSAGE.banned);
    return [...hangul, ...empty, ...banned].map((message) => problemAt(sf, node.getStart(sf), message));
  });
};

// ── 3) 화면 폴더끼리 import ──
const screenFolderOf = (absPath) => {
  const rel = relOf(absPath);
  return rel.startsWith(SCREENS_DIR) ? rel.slice(SCREENS_DIR.length).split('/')[0] : null;
};
const specifierOf = (node) => {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) return node.moduleSpecifier;
  const isDynamicImport = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
  return isDynamicImport ? node.arguments[0] : undefined;
};
const targetOf = (fromFile, spec) => {
  if (spec.startsWith('.')) return resolve(dirname(fromFile), spec);
  return spec.startsWith(ALIAS) ? join(SRC, spec.slice(ALIAS.length)) : null;
};
const importProblems = (sf, nodes, own) =>
  nodes.flatMap((node) => {
    const spec = specifierOf(node);
    if (!spec || !ts.isStringLiteralLike(spec)) return [];
    const target = targetOf(sf.fileName, spec.text);
    const folder = target && screenFolderOf(target);
    return folder && folder !== own ? [problemAt(sf, spec.getStart(sf), MESSAGE.screenImport)] : [];
  });

// ── 4) 전역 우회 · 서식 ──
const memberOf = (node) => {
  if (ts.isPropertyAccessExpression(node)) return { object: node.expression, name: node.name.text };
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression))
    return { object: node.expression, name: node.argumentExpression.text };
  return null;
};
// 전역 객체(window · globalThis · self)를 거쳐 names 중 하나를 부르는 곳
const globalMemberProblems = (sf, nodes, names, message) =>
  nodes.flatMap((node) => {
    const member = memberOf(node);
    const isHit =
      member && ts.isIdentifier(member.object) && GLOBAL_OBJECTS.has(member.object.text) && names.has(member.name);
    return isHit ? [problemAt(sf, node.getStart(sf), message(`${member.object.text}.${member.name}`))] : [];
  });
const bypassProblems = (sf, nodes) => globalMemberProblems(sf, nodes, SCREEN_UI_GLOBALS, MESSAGE.bypass);
const dialogProblems = (sf, nodes) => globalMemberProblems(sf, nodes, DIALOG_GLOBALS, MESSAGE.dialog);
const formatProblems = (sf, nodes) =>
  nodes.flatMap((node) => {
    const member = memberOf(node);
    if (!member) return [];
    const isFormat =
      FORMAT_METHODS.has(member.name) || (ts.isIdentifier(member.object) && member.object.text === FORMAT_GLOBAL);
    return isFormat ? [problemAt(sf, node.getStart(sf), MESSAGE.format)] : [];
  });

// ── 6) 끄는 주석: 파서가 본 주석만(문자열 · 정규식 · JSX 텍스트 속의 `//`는 주석이 아니다) ──
const commentsOf = (sf, nodes) => {
  const text = sf.text;
  const jsxTextSpans = nodes.filter(ts.isJsxText).map((n) => [n.pos, n.end]);
  const ranges = nodes.flatMap((n) => [
    ...(ts.getLeadingCommentRanges(text, n.pos) ?? []),
    ...(ts.getTrailingCommentRanges(text, n.end) ?? []),
  ]);
  return [...new Map(ranges.map((r) => [r.pos, r])).values()]
    .filter((r) => !jsxTextSpans.some(([start, end]) => r.pos >= start && r.pos < end))
    .map((r) => ({ pos: r.pos, body: text.slice(r.pos, r.end) }));
};
const directiveProblems = (sf, nodes) =>
  commentsOf(sf, nodes).flatMap(({ pos, body }) => {
    const m = LINT_DIRECTIVE.exec(body);
    if (!m) return [];
    const [rulePart, ...reasonParts] = ` ${m[3]}`.split(REASON_SPLIT);
    const hasRules = rulePart.split(RULE_LIST_SPLIT).some(Boolean);
    const hasReason = reasonParts.join(' -- ').trim().length > 0;
    return [...(hasRules ? [] : [MESSAGE.unscoped]), ...(hasReason ? [] : [MESSAGE.noReason])].map((message) =>
      problemAt(sf, pos, `${m[1]}-disable${m[2] ?? ''}: ${message}`),
    );
  });

// ── 7) JSX style 속성 ──
const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
// 타입 단언 · 괄호는 값의 모양을 바꾸지 않는다(`{ '--w': x } as CSSProperties`)
const unwrap = (node) =>
  ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;
const keyTextOf = (name) => {
  if (ts.isStringLiteralLike(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return null;
};
const isCustomPropertyKey = (name) =>
  !ts.isIdentifier(name) && (keyTextOf(name) ?? '').startsWith(CUSTOM_PROPERTY_PREFIX);

const memberFinding = (sf, member) => {
  const line = lineOf(sf, member.getStart(sf));
  if (ts.isSpreadAssignment(member))
    return { rule: RULE.styleDynamic, line, text: MESSAGE.styleDynamic('펼침(...)') };
  if (ts.isPropertyAssignment(member) && isCustomPropertyKey(member.name)) return null;
  const key = member.name ? (keyTextOf(member.name) ?? member.name.getText(sf)) : member.getText(sf);
  return { rule: RULE.styleLiteral, line, text: MESSAGE.styleKey(key) };
};
const styleFindings = (sf, attribute) => {
  const init = attribute.initializer;
  if (!init) return [];
  const line = lineOf(sf, attribute.getStart(sf));
  const value = ts.isJsxExpression(init) ? init.expression && unwrap(init.expression) : init;
  if (!value) return [];
  if (ts.isStringLiteralLike(value)) return [{ rule: RULE.styleLiteral, line, text: MESSAGE.styleKey(value.text) }];
  if (!ts.isObjectLiteralExpression(value))
    return [{ rule: RULE.styleDynamic, line, text: MESSAGE.styleDynamic('객체 리터럴이 아닌 값(변수 · 호출 · 삼항)') }];
  return value.properties.map((member) => memberFinding(sf, member)).filter(Boolean);
};
const isStyleAttribute = (node) =>
  ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === STYLE_ATTRIBUTE;

const parseSourceDirective = (sf, { pos, body }) => {
  const m = SOURCE_DIRECTIVE.exec(body);
  if (!m) return null;
  const [rulePart, ...reasonParts] = ` ${m[2]}`.split(REASON_SPLIT);
  const rules = rulePart.split(RULE_LIST_SPLIT).filter(Boolean);
  const errors = [
    ...(m[1] === NEXT_LINE ? [] : [MESSAGE.directiveNotNextLine(m[1])]),
    ...(rules.length === 0 ? [MESSAGE.directiveNoRule] : []),
    ...rules.filter((rule) => !DISABLEABLE_RULES.has(rule)).map(MESSAGE.directiveUnknownRule),
    ...(reasonParts.join(' -- ').trim() ? [] : [MESSAGE.directiveNoReason]),
  ];
  const commentLine = lineOf(sf, pos + body.length);
  return { commentLine, line: commentLine + 1, rules, errors };
};
const isSuppressedBy = (finding, directive) =>
  directive.errors.length === 0 && directive.line === finding.line && directive.rules.includes(finding.rule);

const styleProblems = (sf, nodes) => {
  const findings = nodes.filter(isStyleAttribute).flatMap((attribute) => styleFindings(sf, attribute));
  const directives = commentsOf(sf, nodes)
    .map((comment) => parseSourceDirective(sf, comment))
    .filter(Boolean);
  const directiveErrors = directives.flatMap((d) => d.errors.map((text) => ({ rule: RULE.directive, line: d.commentLine, text })));
  const unused = directives
    .filter((d) => d.errors.length === 0 && !findings.some((f) => isSuppressedBy(f, d)))
    .map((d) => ({ rule: RULE.directive, line: d.commentLine, text: MESSAGE.directiveUnused }));
  const remaining = findings.filter((f) => !directives.some((d) => isSuppressedBy(f, d)));
  return [...remaining, ...directiveErrors, ...unused]
    .toSorted((a, b) => a.line - b.line)
    .map((f) => `${relOf(sf.fileName)}:${f.line}: [${f.rule}] ${f.text}`);
};

function checkScript(path) {
  const rel = relOf(path);
  const sf = parse(path);
  const nodes = descendants(sf, sf);
  if (!rel.startsWith(SRC_DIR)) return directiveProblems(sf, nodes);
  const screen = screenFolderOf(path);
  const isScreenOrUi = screen !== null || rel.startsWith(UI_DIR);
  const isScreenText = screen !== null && !rel.startsWith(GUIDE_DIR);
  return [
    ...directiveProblems(sf, nodes),
    ...textProblems(sf, nodes, rel),
    ...styleProblems(sf, nodes),
    ...(screen !== null ? importProblems(sf, nodes, screen) : []),
    ...(isScreenOrUi ? bypassProblems(sf, nodes) : []),
    ...dialogProblems(sf, nodes),
    ...(isScreenText ? formatProblems(sf, nodes) : []),
  ];
}

const allFiles = filesUnder(ROOT);
const scripts = allFiles.filter((path) => SCRIPT_FILE.test(path));
const hasSource = scripts.some((path) => relOf(path).startsWith(SRC_DIR));
const problems = [
  ...(hasSource ? [] : [MESSAGE.noSource]),
  ...allFiles.filter((path) => TEST_FILE.test(path)).map((path) => `${relOf(path)}: ${MESSAGE.test}`),
  ...scripts.flatMap(checkScript),
];
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-source: ${scripts.length}개 파일 통과`);

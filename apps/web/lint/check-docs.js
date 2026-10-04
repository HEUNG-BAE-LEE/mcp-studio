// 문서 ↔ 코드 대조 · docs/에는 두 문서만 · 테스트 파일 없음 (CLAUDE.md 우선 블록 · DESIGN 값은 한 곳)
// 1) 문서가 이름 붙인 토큰이 tokens.css에 있다  2) COMPONENTS 카탈로그 값 ↔ /_guide 절 이름이 양방향으로 맞는다
// 3) 어느 파일도 stylelint `mcp/disable-reason`을 끄지 않는다 (사유 없는 끄기 주석을 막는 검사 자신)
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DOCS_DIR = join(ROOT, 'docs');
const DOC_FILES = ['COMPONENTS.md', 'DESIGN.md'];
const TOKENS_FILE = join(ROOT, 'apps/web/src/styles/tokens.css');
const GUIDE_DIR = join(ROOT, 'apps/web/src/screens/_guide');
const SOURCE_DIR = join(ROOT, 'apps');
const SKIP_DIRS = new Set(['node_modules', 'dist']);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEXT_FILE = /\.(css|[cm]?[jt]sx?|html|md|json)$/;
// `/* stylelint-disable… <규칙들> -- <사유> */` — 규칙 목록은 ` -- ` 앞까지만 본다
const DISABLE_COMMENT = /\/\*\s*stylelint-disable[\w-]*([\s\S]*?)\*\//g;
const DISABLE_REASON_RULE = 'mcp/disable-reason';
const DEFINITION = /(--[\w-]+)\s*:/g;
// 와일드카드(`--fix-*`) · 접미 행(`-fg`)은 이름이 완전하지 않아 잡지 않는다
const DOC_TOKEN = /`(--[a-z0-9-]+)`|var\((--[a-z0-9-]+)\)/g;
// _guide 절 정의: `group: '…', name: '…'`(두 키가 붙어 있으면 순서는 상관없다). 화면 · 컴포넌트 예시 데이터의 `name:`과 구분한다
const GUIDE_SECTION_NAME_PATTERNS = [
  /group:\s*'[^']*',\s*name:\s*'([^']+)'/g,
  /name:\s*'([^']+)',\s*group:\s*'[^']*'/g,
];
const CATALOG_LINE = '- **카탈로그**';
const BACKTICK_VALUE = /`([^`]+)`/g;

const tokenNames = new Set(
  [...readFileSync(TOKENS_FILE, 'utf8').matchAll(DEFINITION)].map((m) => m[1]),
);

const readDoc = (file) => readFileSync(join(DOCS_DIR, file), 'utf8');

// `## 미정`은 아직 없는 토큰을 제안하는 자리라 대조하지 않는다
const PENDING_HEADING = /^## 미정\r?$/m;
const checkedText = (file) => readDoc(file).split(PENDING_HEADING)[0];

const unknownTokens = (file) =>
  [...checkedText(file).matchAll(DOC_TOKEN)]
    .map((m) => m[1] ?? m[2])
    .filter((name) => !tokenNames.has(name))
    .map(
      (name) =>
        `docs/${file}: ${name} — tokens.css에 없는 토큰 (실제 토큰 이름으로 고치거나 \`## 미정\`으로 옮긴다)`,
    );

const extraDocs = () =>
  readdirSync(DOCS_DIR)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !DOC_FILES.includes(name))
    .map((name) => `docs/${name}: docs/에는 DESIGN.md · COMPONENTS.md만 둔다`);

const sourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });

const SOURCE_FILES = sourceFiles(SOURCE_DIR);

const testFiles = () =>
  SOURCE_FILES.filter((path) => TEST_FILE.test(path)).map(
    (path) => `${relative(ROOT, path)}: 테스트 파일을 두지 않는다 (CLAUDE.md)`,
  );

const namesDisableReasonRule = (commentBody) =>
  commentBody
    .split(/\s--\s/)[0]
    .split(/[\s,]+/)
    .includes(DISABLE_REASON_RULE);

const disabledReasonRule = () =>
  SOURCE_FILES.filter((path) => TEXT_FILE.test(path))
    .filter((path) =>
      [...readFileSync(path, 'utf8').matchAll(DISABLE_COMMENT)].some((m) =>
        namesDisableReasonRule(m[1]),
      ),
    )
    .map(
      (path) =>
        `${relative(ROOT, path)}: \`${DISABLE_REASON_RULE}\`은 끌 수 없다 (DESIGN 리터럴 px 예외 주석)`,
    );

const guideSectionNames = () =>
  new Set(
    readdirSync(GUIDE_DIR)
      .filter((name) => name.endsWith('.tsx'))
      .flatMap((name) => {
        const source = readFileSync(join(GUIDE_DIR, name), 'utf8');
        return GUIDE_SECTION_NAME_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)]);
      })
      .map((m) => m[1]),
  );

const catalogValues = () =>
  new Set(
    readDoc('COMPONENTS.md')
      .split('\n')
      .filter((line) => line.startsWith(CATALOG_LINE))
      .flatMap((line) => [...line.matchAll(BACKTICK_VALUE)])
      .map((m) => m[1]),
  );

const catalogMismatches = () => {
  const sections = guideSectionNames();
  const values = catalogValues();
  return [
    ...[...values]
      .filter((name) => !sections.has(name))
      .map((name) => `COMPONENTS: ${name} — /_guide에 없는 절`),
    ...[...sections]
      .filter((name) => !values.has(name))
      .map((name) => `/_guide: ${name} — COMPONENTS 카탈로그에 없는 절`),
  ];
};

const problems = [
  ...new Set([
    ...DOC_FILES.flatMap(unknownTokens),
    ...extraDocs(),
    ...testFiles(),
    ...catalogMismatches(),
    ...disabledReasonRule(),
  ]),
];
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

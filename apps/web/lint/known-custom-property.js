// var(--x)는 tokens.css나 같은 파일에 정의된 이름만 쓴다 — 토큰을 더하려면 design-change
import { readFileSync, statSync } from 'node:fs';
import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = 'mcp/known-custom-property';

export const messages = ruleMessages(ruleName, {
  rejected: (name) =>
    `${name}: tokens.css에 없는 토큰입니다. 새 토큰은 design-change 스킬로 문서와 tokens.css에 먼저 더합니다. ` +
    `TSX style로 넣는 값이면 같은 파일에 기본값(\`${name}: 0\`)을 정의합니다`,
});

const meta = { url: 'docs/DESIGN.md' };

const DEFINITION = /(--[\w-]+)\s*:/g;
const USAGE = /var\(\s*(--[\w-]+)/g;
const TOKENS_URL = new URL('../src/styles/tokens.css', import.meta.url);

const definedIn = (css) => new Set([...css.matchAll(DEFINITION)].map((m) => m[1]));

// 에디터 린트 서버는 오래 떠 있다 — tokens.css가 바뀌면(mtime) 다시 읽어 새 토큰을 바로 알아본다
let tokensCache = { mtimeMs: -1, names: new Set() };
function loadTokens() {
  const { mtimeMs } = statSync(TOKENS_URL);
  if (mtimeMs !== tokensCache.mtimeMs) {
    tokensCache = { mtimeMs, names: definedIn(readFileSync(TOKENS_URL, 'utf8')) };
  }
  return tokensCache.names;
}

const isString = (v) => typeof v === 'string';
const isRegExp = (v) => v instanceof RegExp;
const matchesAny = (name, patterns) =>
  patterns.some((p) => (isString(p) ? p === name : p.test(name)));

const ruleFunction = (primary, secondary) => (root, result) => {
  const valid = validateOptions(
    result,
    ruleName,
    { actual: primary, possible: [true] },
    { actual: secondary, possible: { ignore: [isString, isRegExp] }, optional: true },
  );
  if (!valid) return;

  const tokens = loadTokens();
  const ignore = secondary?.ignore ?? [];
  const local = new Set();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) local.add(decl.prop);
  });

  root.walkDecls((decl) => {
    for (const [, name] of decl.value.matchAll(USAGE)) {
      if (tokens.has(name) || local.has(name) || matchesAny(name, ignore)) continue;
      report({ ruleName, result, node: decl, message: messages.rejected(name), word: name });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

export default createPlugin(ruleName, ruleFunction);

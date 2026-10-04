// 린트 끄기 주석은 `-- 파생 치수: <근거>` 사유를 단다(DESIGN 리터럴 px 예외 주석)
import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = 'mcp/disable-reason';

export const messages = ruleMessages(ruleName, {
  rejected: () =>
    'stylelint-disable 주석에는 사유를 붙입니다: `/* stylelint-disable-next-line <규칙> -- 파생 치수: <근거> */` (DESIGN 리터럴 px 예외 주석)',
});

const meta = { url: 'docs/DESIGN.md' };

const DISABLE = /^\s*stylelint-disable/;
const REASON = /--\s*파생 치수:\s*\S/;

const ruleFunction = (primary) => (root, result) => {
  const valid = validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!valid) return;

  root.walkComments((comment) => {
    if (!DISABLE.test(comment.text) || REASON.test(comment.text)) return;
    report({ ruleName, result, node: comment, message: messages.rejected() });
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

export default createPlugin(ruleName, ruleFunction);

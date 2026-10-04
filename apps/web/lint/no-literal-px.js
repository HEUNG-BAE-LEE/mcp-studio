import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = 'mcp/no-literal-px';

export const messages = ruleMessages(ruleName, {
  rejected: (prop, px) =>
    `"${prop}"의 ${px}: px 리터럴 대신 var(--*) 토큰을 씁니다 (DESIGN 핵심 규칙 1). ` +
    `치수에서 파생된 값(막대 · 점 반지름 등)이면 바로 윗줄에 ` +
    `\`/* stylelint-disable-next-line ${ruleName} -- 파생 치수: <근거> */\`를 씁니다 ` +
    `(DESIGN 리터럴 px 예외 주석)`,
});

const meta = { url: 'docs/DESIGN.md#리터럴-px-예외-주석' };

// DESIGN 핵심 규칙 1의 예외: 0 · 1px 테두리 · 레이아웃 고정폭. outline은 포커스 링 규칙(2px)이다
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

// 숫자 + px. 앞의 음수 부호(-4px)도 포함하고 대소문자를 가리지 않는다(8PX).
// 앞이 식별자 문자면 제외(예: --s-8px 같은 이름), 뒤가 단어면 제외
const PX = /(?<![\w.-])-?(\d*\.?\d+)px(?![\w-])/gi;

// 1px 예외는 테두리 두께 속성만. border-radius · border-spacing · border-image-*는 제외
const BORDER_WIDTH_PROP = /^border(-(top|right|bottom|left))?(-width)?$/;

function isAllowed(prop, px) {
  if (px === 0) return true;
  if (px === 1 && BORDER_WIDTH_PROP.test(prop)) return true;
  return false;
}

const ruleFunction = (primary) => (root, result) => {
  const valid = validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!valid) return;

  root.walkDecls((decl) => {
    // 지역 변수(`--btn-lh` 등) 값도 본다 — 변수에 담으면 px 리터럴이 검사를 비켜 간다
    const prop = decl.prop.toLowerCase();
    if (FIXED_WIDTH_PROPS.has(prop)) return;

    for (const match of decl.value.matchAll(PX)) {
      const px = Number(match[1]);
      if (isAllowed(prop, px)) continue;
      report({
        ruleName,
        result,
        node: decl,
        message: messages.rejected(prop, match[0]),
        word: match[0],
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

export default createPlugin(ruleName, ruleFunction);

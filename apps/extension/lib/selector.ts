export function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId}"]`;

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

  const role = el.getAttribute("role");
  const text = (el.textContent || "").trim().slice(0, 30);
  if (role && text) return `[role="${role}"]:has-text("${text}")`;

  return cssPath(el);
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== "BODY" && parts.length < 5) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
    const tag = node.tagName.toLowerCase();
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag);
    node = parent;
  }
  return parts.join(" > ");
}

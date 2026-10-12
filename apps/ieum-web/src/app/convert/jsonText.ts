// JSON 코드 상자에 넣을 글 — 옛 code(text, 'json')(js/common/convert.js:159): 문자열은 그대로, 그 밖은 2칸 들여쓴 JSON.
// JSON으로 바꿀 수 없는 값(undefined)은 빈 글이다(옛 esc(undefined))
export const jsonText = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? '');

// apps/web/src/copy/warnOnce.ts — 같은 키의 경고는 한 번만(렌더마다 반복해 콘솔이 묻히지 않게)
const warned = new Set<string>();
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

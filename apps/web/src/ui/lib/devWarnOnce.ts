// 컴포넌트 계약(COMPONENTS) 위반 경고 — 개발 빌드에서만, 같은 키는 한 번만(렌더마다 반복해 콘솔이 묻히지 않게). 운영 빌드에서는 부르지 않는다
const warned = new Set<string>();

export function devWarnOnce(key: string, message: string): void {
  if (!import.meta.env.DEV || warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

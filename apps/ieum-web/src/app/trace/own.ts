// 표 자신의 키만 찾는다 — 'constructor' 같은 이름이 Object.prototype 값을 돌려주지 않게.
// 변환 과정(모델 표) · 호출 로그(모델 · 도구 표) · 테스트 실행(도구별 폼 값 · 인자)이 같이 쓴다
export const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

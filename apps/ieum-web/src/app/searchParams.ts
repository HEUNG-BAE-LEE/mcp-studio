// 주소 검색 파라미터 도우미 — 화면 필터 · 열린 항목(?q= · ?proto= · ?log= 등)을 주소에 쓰는 화면이 함께 쓴다

/** 키 하나를 바꾼 새 검색 파라미터. 값이 null · 빈 문자열이면 뺀다 — 받은 객체는 고치지 않는다 */
export function withParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null || value === '') next.delete(key);
  else next.set(key, value);
  return next;
}

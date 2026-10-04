// 목록 검색 상태(SectionHead 검색 + EmptyState filtered가 같이 쓴다): 질의 · 걸러진 행 · 0건 여부
import { useState } from 'react';

/** 공백 trim · 소문자 substring. 빈 질의는 전부(새 배열) */
function filterByQuery<T>(rows: readonly T[], query: string, haystackOf: (row: T) => string): T[] {
  const q = query.trim().toLowerCase();
  return q === '' ? [...rows] : rows.filter((r) => haystackOf(r).toLowerCase().includes(q));
}

export type SearchFilter<T> = {
  query: string;
  setQuery: (query: string) => void;
  /** EmptyState filtered `onClear` */
  clear: () => void;
  shown: T[];
  /** 필터 없는 총 건수 */
  total: number;
  /** 행은 있는데 질의가 모두 걸러냄 — EmptyState `filtered`를 그릴 때 */
  isNoMatch: boolean;
};

/** 검색 대상 문자열은 호출자가 정한다(예: 소스 `이름 타입` · 커넥터 `이름 요약`) */
export function useSearchFilter<T>(
  rows: readonly T[],
  haystackOf: (row: T) => string,
): SearchFilter<T> {
  const [query, setQuery] = useState('');
  const shown = filterByQuery(rows, query, haystackOf);
  return {
    query,
    setQuery,
    clear: () => setQuery(''),
    shown,
    total: rows.length,
    isNoMatch: rows.length > 0 && shown.length === 0,
  };
}

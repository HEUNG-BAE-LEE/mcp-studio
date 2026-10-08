// 원본 시스템 목록의 검색 · 연결 방식 필터 상태 — 주소 /sources?q=&proto=와 화면 입력을 잇는다.
// 검색 입력값은 이 화면의 상태이고 주소 q는 그 값을 따라 쓴다 — 입력을 주소에 직접 묶으면 라우터 갱신이 늦을 때 한글 조합 글자가 흔들린다.
// 연결 방식은 주소가 값이다. 필터를 바꾸는 것은 화면 안 선택이라 히스토리를 쌓지 않는다(replace). 요청은 없다 — 목록 쿼리 키가 주소와 상관없다
// 옛은 화면 상태 객체(S.srcQ · S.srcProto — apps/web/ieum/js/menu/sources.js:5,25-27)였고 메뉴를 오가도 남았다 — 메뉴별 마지막 주소(app/lastPath)가 이어 준다
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { withParam } from '../../app/searchParams';
import { ALL, parseProtoFilter, SOURCE_PARAM, type SourceFilter } from './sourceRows';

export type SourcesParams = Readonly<{
  filter: SourceFilter;
  /** 입력할 때마다 부른다 — 입력 원문 그대로 */
  setQuery: (value: string) => void;
  /** 선택지 값 — "all"이면 주소에서 뺀다 */
  setProto: (value: string) => void;
}>;

export function useSourcesParams(): SourcesParams {
  const [params, setParams] = useSearchParams();
  const [query, setQueryState] = useState(() => params.get(SOURCE_PARAM.q) ?? '');

  const setParam = (key: string, value: string | null) =>
    setParams((prev) => withParam(prev, key, value), { replace: true });

  return {
    filter: { proto: parseProtoFilter(params), q: query },
    setQuery: (value) => {
      setQueryState(value);
      setParam(SOURCE_PARAM.q, value);
    },
    setProto: (value) => setParam(SOURCE_PARAM.proto, value === ALL ? null : value),
  };
}

// 원본 시스템 목록의 순수 함수 — 거르기 · 연결 방식 필터 값 · 행 칸 값. 런타임에 부르는 것은 같은 앱 층 계산(app/status/sourceStatus)뿐이다.
// 거르는 식은 옛 srcRows(apps/web/ieum/js/menu/sources.js:3-6)와 같은 입력에 같은 결과를 낸다:
// 연결 방식 · 검색어를 모두 만족(AND), 검색어는 앞뒤 공백을 떼고 소문자로, 대상은 이름 + 설명을 구분자 없이 이은 한 문자열
// (이름 끝과 설명 앞에 걸친 검색어도 맞는다 — sources.js:5). 서버 순서(새 원본은 맨 뒤)를 그대로 두고 정렬하지 않는다
import type { Source, ToolRecord } from '../../api/types';
import type { SourceStatusValue } from '../../copy/status';
import { pendingCount, publishedCount, sourceStatusOf } from '../../app/status/sourceStatus';

/** 주소 검색 파라미터 이름 — 전체 · 빈 값이면 주소에서 뺀다 */
export const SOURCE_PARAM = Object.freeze({ q: 'q', proto: 'proto' } as const);

/** 연결 방식 필터 "전체" 값 — 선택지의 값이고 주소에는 쓰지 않는다 */
export const ALL = 'all';

/** 연결 방식 필터 선택지의 순서 — 옛 select 순서(js/menu/sources.js:27). 서버가 내는 연결 방식 다섯과 같다 */
export const PROTO_FILTER_VALUES = ['soap', 'rest', 'gov', 'sample', 'disc'] as const;
export type ProtoFilterValue = (typeof PROTO_FILTER_VALUES)[number];

export type SourceFilter = Readonly<{
  /** "all" 또는 연결 방식 값 */
  proto: typeof ALL | ProtoFilterValue;
  /** 입력 원문 — 거를 때 trim · 소문자 */
  q: string;
}>;

/** 아는 연결 방식인가 — 아니면 배지가 모르는 값 모양(unknown)이다 */
export const isKnownProto = (proto: string): proto is ProtoFilterValue =>
  (PROTO_FILTER_VALUES as readonly string[]).includes(proto);

/** 주소의 proto. 모르는 값 · 빈 값은 전체로 보고 주소는 고치지 않는다 */
export function parseProtoFilter(params: URLSearchParams): SourceFilter['proto'] {
  const proto = params.get(SOURCE_PARAM.proto);
  return proto !== null && isKnownProto(proto) ? proto : ALL;
}

/** 조건에 맞는 원본(서버 순서 그대로) */
export function filterSources(sources: readonly Source[], filter: SourceFilter): readonly Source[] {
  const q = filter.q.trim().toLowerCase();
  return sources.filter(
    (source) =>
      (filter.proto === ALL || source.proto === filter.proto) && (!q || (source.name + source.desc).toLowerCase().includes(q)),
  );
}

/** 표 한 행의 계산 값 — 글자는 화면이 copy/에서 만든다 */
export type SourceRow = Readonly<{
  source: Source;
  status: SourceStatusValue;
  /** 공개 중인 도구 수 */
  published: number;
  /** 그 원본의 도구 수(전체 작업) */
  total: number;
  /** 검토가 필요한 도구 수(review · drift) — 0이면 줄을 그리지 않는다 */
  pending: number;
}>;

/** tools는 그 원본의 도구 목록 — 도구가 없는 원본은 빈 목록이다 */
export function toSourceRow(source: Source, tools: readonly ToolRecord[]): SourceRow {
  return {
    source,
    status: sourceStatusOf(source, tools),
    published: publishedCount(tools),
    total: tools.length,
    pending: pendingCount(tools),
  };
}

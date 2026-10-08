// 도구 목록 패널 — 머리 "도구 목록 N개"(원본 전체 수) · 필터 칩 넷(개수는 원본 전체 기준, 검토 = 검토 대기 + 명세 변경) · 검색 · 두 줄 항목(옛 js/menu/studio.js:3-12,134-138)
// 수 · 칩 · 항목은 초안을 덮은 도구로 센다(공개 스위치를 끄면 바로 "제외"로). 검색은 id + 제목 + 원본 작업 표시를 소문자 부분 일치로 입력마다 거른다(한글 조합 중 포함).
// 필터 · 검색은 목록만 바꾸고 상세는 고른 도구 그대로다 — 고른 도구가 목록 밖이어도. 고른 항목을 보이게 목록을 스크롤하지 않는다
import type { Tool } from '../../api/types';
import { opLabel } from '../../app/convert/opLabel';
import { setToolQuery, useToolQuery } from '../../app/studio/studioUi';
import { modeKindOf, modeLabel } from '../../copy/mode';
import { STUDIO } from '../../copy/studio';
import {
  EmptyState,
  FilterChips,
  ModeTag,
  Panel,
  PanelBand,
  SearchInput,
  SelectableListItem,
  ToolStatusChip,
  type FilterChipItem,
} from '@/ui';
import { TOOL_FILTERS, type ToolFilter } from './useStudioRoute';

const isReview = (t: Tool) => t.status === 'review' || t.status === 'drift';

const matchesFilter = (t: Tool, filter: ToolFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'review') return isReview(t);
  return t.status === filter;
};

const countOf = (tools: readonly Tool[], filter: ToolFilter): number => tools.filter((t) => matchesFilter(t, filter)).length;

// 옛 `(t.id + t.title + opLabel(t))` 그대로 — 원본 작업 표시가 없으면 "undefined" 글자가 이어진다(js/menu/studio.js:6)
const searchTextOf = (t: Tool): string => `${t.id}${t.title}${String(opLabel(t))}`.toLowerCase();

type ToolListPanelProps = Readonly<{
  /** 지금 원본의 도구(초안 덮음, 서버 순서) */
  tools: readonly Tool[];
  selectedId: string | undefined;
  filter: ToolFilter;
  onFilter: (filter: string) => void;
  onPick: (toolId: string) => void;
}>;

export function ToolListPanel({ tools, selectedId, filter, onFilter, onPick }: ToolListPanelProps) {
  const query = useToolQuery();
  const needle = query.trim().toLowerCase();
  const visible = tools.filter((t) => matchesFilter(t, filter) && (!needle || searchTextOf(t).includes(needle)));
  const chips: readonly FilterChipItem[] = TOOL_FILTERS.map((value) => ({
    value,
    label: STUDIO.list.filters[value],
    count: countOf(tools, value),
  }));

  return (
    <Panel
      label={STUDIO.list.region}
      title={STUDIO.list.title}
      count={STUDIO.list.count(tools.length)}
      scroll
      tools={
        <>
          <FilterChips variant="band" items={chips} value={filter} onValueChange={onFilter} />
          <PanelBand>
            <SearchInput
              variant="full"
              value={query}
              onValueChange={setToolQuery}
              label={STUDIO.list.searchLabel}
              placeholder={STUDIO.list.searchPlaceholder}
            />
          </PanelBand>
        </>
      }
    >
      {visible.length === 0 ? (
        <EmptyState kind="filtered" container="inline">
          {STUDIO.list.noMatch}
        </EmptyState>
      ) : (
        visible.map((t) => (
          <SelectableListItem
            key={t.id}
            variant="id"
            title={t.id}
            status={<ToolStatusChip status={t.status} size="sm" />}
            description={
              <>
                {t.title}
                {modeKindOf(t.mode) === 'write' ? (
                  <>
                    {' '}
                    <ModeTag kind="write" label={modeLabel(t.mode)} size="sm" />
                  </>
                ) : null}
              </>
            }
            selected={t.id === selectedId}
            dimmed={t.status === 'off'}
            onSelect={() => onPick(t.id)}
          />
        ))
      )}
    </Panel>
  );
}

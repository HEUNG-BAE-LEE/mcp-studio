// 카탈로그 Panel 절 — 도구 목록(머리 + 수 · FilterChips band · PanelBand 안 검색 · 스크롤 목록 12개 — 필터 · 검색이 목록만 바꾼다) /
// 묶음 목록(footer 안 버튼이 칸 폭을 채움) / 빈 목록(EmptyState inline). 1100 이하 스크롤 최대 높이 280은 폭 전환으로 본다
import { useState } from 'react';
import { Button, EmptyState, FilterChips, ModeTag, SearchInput, StatusChip, ToolStatusChip, type FilterChipItem, type StatusTone } from '../../ui';
import { Panel, PanelBand } from '../../ui/Panel';
import { SelectableListItem } from '../../ui/SelectableListItem';
import catalog from './catalog.module.css';
import styles from './PanelSection.module.css';

type Tool = { id: string; title: string; status: 'done' | 'review' | 'drift' | 'off'; isWrite: boolean };

const TOOLS: readonly Tool[] = [
  { id: 'orders.search', title: '주문 검색', status: 'done', isWrite: false },
  { id: 'orders.create', title: '주문 생성', status: 'review', isWrite: true },
  { id: 'orders.cancel', title: '주문 취소', status: 'drift', isWrite: true },
  { id: 'orders.detail', title: '주문 상세 조회', status: 'done', isWrite: false },
  { id: 'items.list', title: '품목 목록', status: 'done', isWrite: false },
  { id: 'items.export', title: '품목 내보내기', status: 'off', isWrite: false },
  { id: 'customers.search', title: '고객 검색', status: 'done', isWrite: false },
  { id: 'customers.update', title: '고객 정보 수정', status: 'review', isWrite: true },
  { id: 'invoices.issue', title: '세금계산서 발행', status: 'off', isWrite: true },
  { id: 'invoices.list', title: '세금계산서 목록', status: 'done', isWrite: false },
  { id: 'warehouses.stock', title: '창고 재고 조회', status: 'done', isWrite: false },
  { id: 'warehouses.move', title: '창고 간 재고 이동', status: 'drift', isWrite: true },
];

const FILTER_LABEL: Readonly<Record<string, string>> = { all: '전체', review: '검토 필요', done: '공개 중', off: '제외' };
// 필터 "검토 필요"는 검토 필요 + 명세 변경(옛 스튜디오 그대로)
const matchesFilter = (tool: Tool, filter: string) =>
  filter === 'all' || (filter === 'review' ? tool.status === 'review' || tool.status === 'drift' : tool.status === filter);

const FILTER_ITEMS: readonly FilterChipItem[] = Object.entries(FILTER_LABEL).map(([value, label]) => ({
  value,
  label,
  count: TOOLS.filter((tool) => matchesFilter(tool, value)).length,
}));

const TOOLSETS = [
  { id: 'ts-sales', title: '영업 도구', tone: 'ok', chip: '배포 중 v3', summary: '도구 5개, 사용 대상 영업팀' },
  { id: 'ts-draft', title: '재고 조회 묶음', tone: 'mute', chip: '초안', summary: '도구 2개, 사용 대상 물류팀' },
  { id: 'ts-stopped', title: '경리 업무 도구', tone: 'danger', chip: '비정상 종료 v1', summary: '도구 4개, 사용 대상 경리팀' },
] as const satisfies readonly { id: string; title: string; tone: StatusTone; chip: string; summary: string }[];

function ToolListDemo() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(TOOLS[1]?.id ?? '');
  const needle = query.trim().toLowerCase();
  const visible = TOOLS.filter(
    (tool) => matchesFilter(tool, filter) && (needle === '' || (tool.id + tool.title).toLowerCase().includes(needle)),
  );
  return (
    <Panel
      label="도구 목록"
      title="도구 목록"
      count={`${TOOLS.length}개`}
      scroll
      tools={
        <>
          <FilterChips variant="band" items={FILTER_ITEMS} value={filter} onValueChange={setFilter} label="상태 필터" />
          <PanelBand>
            <SearchInput variant="full" value={query} onValueChange={setQuery} label="도구 검색" placeholder="도구 이름으로 검색" />
          </PanelBand>
        </>
      }
    >
      {visible.length === 0 ? (
        <EmptyState kind="filtered" container="inline">
          이 조건에 맞는 도구가 없습니다.
        </EmptyState>
      ) : (
        visible.map((tool) => (
          <SelectableListItem
            key={tool.id}
            variant="id"
            title={tool.id}
            status={<ToolStatusChip status={tool.status} size="sm" />}
            description={
              <>
                {tool.title}
                {tool.isWrite ? (
                  <>
                    {' '}
                    <ModeTag kind="write" label="쓰기" size="sm" />
                  </>
                ) : null}
              </>
            }
            selected={tool.id === picked}
            onSelect={() => setPicked(tool.id)}
            dimmed={tool.status === 'off'}
          />
        ))
      )}
    </Panel>
  );
}

function ToolsetListDemo() {
  const [picked, setPicked] = useState<string>(TOOLSETS[0].id);
  return (
    <Panel
      label="도구 묶음"
      title="도구 묶음"
      count={`${TOOLSETS.length}개`}
      footer={
        <Button icon="plus">도구 묶음 만들기</Button>
      }
    >
      {TOOLSETS.map((set) => (
        <SelectableListItem
          key={set.id}
          variant="name"
          title={set.title}
          status={
            <StatusChip tone={set.tone} size="sm">
              {set.chip}
            </StatusChip>
          }
          description={set.summary}
          selected={set.id === picked}
          onSelect={() => setPicked(set.id)}
        />
      ))}
    </Panel>
  );
}

export function PanelSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        1px --line-control 테두리 · --surface · 그림자 없음. 머리는 제목 요소가 아니라 글자 + 수(--primary)다. tools(필터 띠 · 검색 띠)는 목록 스크롤 밖에 있고,
        scroll을 켜면 본문이 최대 높이(760, 1100 이하 280) 안에서 스크롤한다. footer 안 버튼은 칸 폭을 채운다. 필터 · 검색은 목록만 바꾼다.
      </p>
      <h3 className={catalog.heading}>도구 목록 — 머리 + 수 · FilterChips band · PanelBand 안 SearchInput full · scroll 목록 12개</h3>
      <div className={styles.aside}>
        <ToolListDemo />
      </div>
      <h3 className={catalog.heading}>묶음 목록 — footer 안 Button이 칸 폭을 채움</h3>
      <div className={styles.aside}>
        <ToolsetListDemo />
      </div>
      <h3 className={catalog.heading}>빈 목록 — EmptyState kind=filtered container=inline</h3>
      <div className={styles.aside}>
        <Panel label="도구 목록" title="도구 목록" count="0개">
          <EmptyState kind="filtered" container="inline">
            이 조건에 맞는 도구가 없습니다.
          </EmptyState>
        </Panel>
      </div>
      <h3 className={catalog.heading}>수 없음 · 항목 하나 · 긴 머리 글자</h3>
      <div className={styles.aside}>
        <Panel label="수 없는 머리" title="수가 없는 아주 긴 머리 글자도 칸 안에서 접힌다">
          <SelectableListItem
            variant="id"
            title="orders.search"
            description="주문 검색"
            selected={false}
            onSelect={() => undefined}
          />
        </Panel>
      </div>
    </div>
  );
}

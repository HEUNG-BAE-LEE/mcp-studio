// 호출 로그 툴바 — 상태 칩(전체 · 성공 · 실패와 개수) · 클라이언트 선택 · 검색(옛 .toolbar — apps/web/ieum/js/menu/logs.js:18-23)
// 값은 화면(LogsScreen)이 주소와 검색 입력에서 읽어 넘기고, 바뀌면 onParam · onSearch로 알린다 — 이 파일은 그리기만 한다
import { LOGS } from '../../copy/dashboard-logs';
import { FilterChips, SearchInput, Select, Toolbar, ToolbarSpacer } from '@/ui';
import { ALL, LOG_PARAM, type LogCounts, type LogFilter } from './logFilter';
import type { LogModels } from './logView';

type LogsToolbarProps = Readonly<{
  className?: string;
  counts: LogCounts;
  /** q는 검색 입력 원문 */
  filter: LogFilter;
  /** 모델 조회가 실패했으면 null — 선택지는 "전체"뿐 */
  models: LogModels;
  /** 주소 파라미터 하나를 바꾼다. null이면 주소에서 뺀다 */
  onParam: (key: string, value: string | null) => void;
  onSearch: (value: string) => void;
}>;

export function LogsToolbar({ className, counts, filter, models, onParam, onSearch }: LogsToolbarProps) {
  return (
    <Toolbar className={className}>
      <FilterChips
        items={[
          { value: ALL, label: LOGS.filter.all, count: counts.all },
          { value: 'ok', label: LOGS.filter.ok, count: counts.ok },
          { value: 'err', label: LOGS.filter.err, count: counts.err },
        ]}
        value={filter.status}
        onValueChange={(value) => onParam(LOG_PARAM.status, value === ALL ? null : value)}
      />
      <ToolbarSpacer />
      <Select
        variant="toolbar"
        aria-label={LOGS.filter.clientAria}
        value={filter.client}
        onValueChange={(value) => onParam(LOG_PARAM.client, value === ALL ? null : value)}
      >
        <option value={ALL}>{LOGS.filter.clientAll}</option>
        {models
          ? Object.entries(models).map(([key, model]) => (
              <option key={key} value={key}>
                {model.label}
              </option>
            ))
          : null}
      </Select>
      <SearchInput
        value={filter.q}
        onValueChange={onSearch}
        label={LOGS.search.aria}
        placeholder={LOGS.search.placeholder}
      />
    </Toolbar>
  );
}

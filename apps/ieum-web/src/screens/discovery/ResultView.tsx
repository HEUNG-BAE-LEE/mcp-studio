// ResultView — 결과 검토(검토 대기 · 등록 완료 · 그 밖 — 옛 discResultHTML, js/menu/discovery.js:288-318)
// 위에서 아래로: 단계 줄 → (등록 완료만) 등록 안내 + "변환 스튜디오 열기" → 요약 두 열(찾은 API 벤 그림 · 안전 목록, 1360 이하 한 열) →
// 필터 칩 다섯 + 오른쪽 안내 → 결과 표 → (등록 전에만) 선택 도크 → 도크가 마지막 행을 가리지 않게 아래 빈 칸(등록 완료에도 둔다)
// - 필터 · 선택은 이 화면 안 상태다(주소에 두지 않는다 — 작업을 열 때마다 "전체" · 기본 선택). 같은 칩 · 같은 벤 영역을 다시 누르면 전체
// - "찾은 API N개"는 범위 밖을 뺀 수, 전체 칩은 범위 밖까지 센 수다(옛 그대로)
// - 행을 누르면 근거 드로어(공용 층 — app/layers openEvidenceDrawer). 등록 전이면 발에 선택 토글을 두고, 누르면 선택을 바꾼 뒤 드로어를 닫는다
// - "변환 스튜디오 열기"는 그 원본을 연다(app/sources/useGoSource — 인증 만료면 재인증 모달, 아니면 첫 도구 · 도구가 없으면 그 원본)
import { useState } from 'react';
import type { JobData } from '../../api/discoveryJob';
import type { DiscoveryApi } from '../../api/types';
import { EmphasisText } from '../../app/discovery/CopyParts';
import { canSelectApi } from '../../app/discovery/evidence';
import {
  countsOf,
  DEFAULT_FILTER,
  RESULT_FILTERS,
  resultRowsOf,
  toggleFilter,
  type ResultFilter,
} from '../../app/discovery/results';
import { openEvidenceDrawer } from '../../app/layers';
import { useGoSource } from '../../app/sources/useGoSource';
import { DISCOVERY } from '../../copy/discovery';
import { Button, DockSpacer, FilterChips, HelpText, Notice, Toolbar, ToolbarSpacer, TwoColumn } from '@/ui';
import { JobSteps } from './JobSteps';
import { ResultTable } from './ResultTable';
import { SafetyList } from './SafetyList';
import { SelectionDock } from './SelectionDock';
import { useSelection } from './useSelection';
import { VennSummary } from './VennSummary';
import styles from './ResultView.module.css';

const K = DISCOVERY.result;
const DONE_STATUS = 'done';
const NO_APIS: readonly DiscoveryApi[] = [];

/** 등록 완료 안내(옛 :304) */
function DoneNotice({ job }: Readonly<{ job: JobData }>) {
  const goSource = useGoSource();
  return (
    <Notice
      icon="check"
      className={styles.done}
      action={
        <Button size="sm" variant="primary" onClick={() => goSource(job.sourceId ?? '')}>
          {K.openStudio}
        </Button>
      }
    >
      <EmphasisText parts={K.doneNotice(job.registered)} />
    </Notice>
  );
}

const isResultFilter = (value: string): value is ResultFilter => (RESULT_FILTERS as readonly string[]).includes(value);

export function ResultView({ job }: Readonly<{ job: JobData }>) {
  const apis = job.apis ?? NO_APIS;
  const [filter, setFilter] = useState<ResultFilter>(DEFAULT_FILTER);
  const selection = useSelection(apis);
  const counts = countsOf(apis);
  const isRegistered = job.status === DONE_STATUS;

  const pickFilter = (next: string) => {
    if (isResultFilter(next)) setFilter((current) => toggleFilter(current, next));
  };
  const openApi = (api: DiscoveryApi) =>
    openEvidenceDrawer({
      jobId: job.id,
      api,
      opts: job.opts,
      canSelect: canSelectApi(api, job.status),
      isSelected: selection.ids.has(api.id),
      onToggle: () => selection.toggle(api.id),
    });

  return (
    <>
      <JobSteps stage={job.stage} />
      {isRegistered ? <DoneNotice job={job} /> : null}
      <TwoColumn layout="summary" className={styles.summary}>
        <VennSummary counts={counts} filter={filter} onFilter={pickFilter} />
        <SafetyList job={job} />
      </TwoColumn>
      <Toolbar className={styles.toolbar}>
        <FilterChips
          items={RESULT_FILTERS.map((value) => ({ value, label: K.filters[value], count: counts[value] }))}
          value={filter}
          onValueChange={pickFilter}
        />
        <ToolbarSpacer />
        <HelpText variant="inline">{K.rowHint}</HelpText>
      </Toolbar>
      <ResultTable rows={resultRowsOf(apis, filter)} status={job.status} selection={selection} onOpen={openApi} />
      {isRegistered ? null : <SelectionDock jobId={job.id} selection={selection} />}
      <DockSpacer />
    </>
  );
}

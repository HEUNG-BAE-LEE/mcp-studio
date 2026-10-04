// 영역 틀 조각(Stack · Region · RegionList) · PageColumns aside · Table 동적 열 · ScreenState inline · AlertPanel footer · Select xl 예시 — sections.tsx가 관련 절 뒤에 끼워 넣는다. 눈으로 확인한다
import { useId } from 'react';
import {
  EmptyState,
  Input,
  Label,
  PageBody,
  PageColumns,
  PageHeader,
  Region,
  RegionList,
  RowCard,
  ScreenState,
  SectionHead,
  Select,
  Stack,
  StatusChip,
  Table,
  type TableColumn,
} from '@/ui';
import { GUIDE_FRAME_WIDTH, GUIDE_NARROW_FRAME_WIDTH, guideFrameStyle } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

/** 예시 프레임 높이 — 카탈로그 상자 치수 */
const FRAME_HEIGHT = 400;
const TABLE_BOX_WIDTH = 520;
const FORM_WIDTH = 360;

const RUNS = ['11:42 실행 · 128건', '11:20 실행 · 0건', '10:58 실행 · 96건', '10:31 실행 · 140건'];

function GuideRunList({ count }: { count: number }) {
  const runs = RUNS.slice(0, count);
  const titleId = useId();
  return (
    <Region aria-labelledby={titleId}>
      <SectionHead divider title="실행 기록" titleId={titleId} count={String(runs.length)} />
      <RegionList
        empty={
          runs.length === 0 ? (
            <EmptyState kind="nothing-yet" title="아직 실행이 없다" body="실행하면 여기 쌓인다." />
          ) : null
        }
      >
        {runs.map((r) => (
          <RowCard
            key={r}
            title={r}
            status={
              <StatusChip tier="done" surface="soft">
                수집 완료
              </StatusChip>
            }
            summary="수집 기록"
            onClick={() => {}}
          />
        ))}
      </RegionList>
    </Region>
  );
}

/** scroll=regions · aside 변형 · 보조 열 = Stack fill(위 영역 + 남은 높이를 채우는 목록) */
function GuideAsideFrame({ narrow }: { narrow: boolean }) {
  const resultId = useId();
  const summaryId = useId();
  return (
    <div
      style={guideFrameStyle(narrow ? GUIDE_NARROW_FRAME_WIDTH : GUIDE_FRAME_WIDTH, FRAME_HEIGHT)}
    >
      <PageBody narrow={narrow} scroll="regions">
        <PageHeader title="질의 실행" description="작업 + 보조 열" />
        <PageColumns narrow={narrow} variant="aside">
          <Region aria-labelledby={resultId}>
            <SectionHead divider title="결과" titleId={resultId} count="0" />
            <RegionList>
              <ScreenState kind="loading" inline label="결과를 불러오는 중…" />
            </RegionList>
          </Region>
          <Stack fill>
            <section aria-labelledby={summaryId}>
              <SectionHead as="h3" title="요약" titleId={summaryId} />
            </section>
            <GuideRunList count={narrow ? 0 : RUNS.length} />
          </Stack>
        </PageColumns>
      </PageBody>
    </div>
  );
}

export const REGION_SECTION: GuideSection = {
  group: '레이아웃',
  name: 'Stack · Region · RegionList · PageColumns aside',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        PageColumns variant=aside — 작업 열 1fr + 보조 열 --w-aside 320 · 보조 열 Stack fill(영역
        사이 gap-section, 마지막 영역이 남은 높이) · Region + RegionList(위 10 · gap 8 · 스크롤) ·
        작업 열 ScreenState loading inline
      </span>
      <div className={styles.stage}>
        <GuideAsideFrame narrow={false} />
      </div>
      <span className={styles.caption}>
        1024(narrow) — 보조 열 폭 그대로 · RegionList empty(세로 가운데)
      </span>
      <div className={styles.stage}>
        <GuideAsideFrame narrow />
      </div>
    </div>
  ),
};

type GuideResultRow = { id: string; requestId: string; tool: string; at: string; payload: string };

const RESULT_ROWS: readonly GuideResultRow[] = [
  {
    id: '1',
    requestId: 'req_7f3a9c2e1b',
    tool: 'search_contracts',
    at: '11:42:08',
    payload: '{"query":"보험 인수심사 기준","limit":20,"filters":{"status":"active"}}',
  },
  {
    id: '2',
    requestId: 'req_1d8e4b0a77',
    tool: 'get_policy',
    at: '11:41:55',
    payload: '{"policyId":"P-2026-00412"}',
  },
];

const RESULT_COLUMNS: readonly TableColumn<GuideResultRow>[] = [
  {
    key: 'requestId',
    header: 'request_id',
    width: '1fr',
    minWidth: '140px',
    priority: 'high',
    mono: true,
  },
  { key: 'tool', header: 'tool', width: '1fr', minWidth: '140px', priority: 'high', mono: true },
  { key: 'at', header: '시각', width: '80px', priority: 'high' },
  {
    key: 'payload',
    header: 'payload',
    width: '2fr',
    minWidth: '220px',
    priority: 'high',
    mono: true,
  },
];

export const TABLE_DYNAMIC_SECTION: GuideSection = {
  group: '데이터',
  name: 'Table 동적 열',
  render: () => (
    <div className={styles.cell} style={{ width: TABLE_BOX_WIDTH }}>
      <span className={styles.caption}>
        minWidth — 열 최소 폭 합이 표 폭보다 크면 표 상자 안 가로 스크롤(헤더 함께) · mono 열 ·
        말줄임 글 셀은 title로 전체 값 · 모든 열 high
      </span>
      <Table
        aria-label="실행 결과"
        density="single"
        columns={RESULT_COLUMNS}
        rows={RESULT_ROWS}
        rowKey={(r) => r.id}
      />
    </div>
  ),
};

export const SELECT_XL_SECTION: GuideSection = {
  group: '기본',
  name: 'Select xl',
  render: () => (
    <div className={styles.cell} style={{ width: FORM_WIDTH }}>
      <span className={styles.caption}>xl 36 — 세로 폼에서 Input xl과 같은 높이 · 글자 ui 13</span>
      <Label htmlFor="guide-select-xl-name">이름</Label>
      <Input id="guide-select-xl-name" defaultValue="계약 원장" />
      <Label htmlFor="guide-select-xl-kind">종류</Label>
      <Select
        id="guide-select-xl-kind"
        size="xl"
        defaultValue="db"
        options={[
          { value: 'db', label: '데이터베이스' },
          { value: 'api', label: 'API' },
        ]}
      />
    </div>
  ),
};

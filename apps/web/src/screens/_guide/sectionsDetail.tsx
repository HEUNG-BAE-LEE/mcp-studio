// 상세형 화면에서 쓰는 컴포넌트 · 변형 — sections.tsx가 관련 절 뒤에 끼워 넣는다
import { useId } from 'react';
import {
  Button,
  CopyField,
  IconButton,
  Input,
  MetricCard,
  PageHeader,
  SectionHead,
  SegmentBar,
  StatusChip,
  Table,
  TableCellLines,
  Tag,
  type MetricCardProps,
  type Segment,
  type TableColumn,
} from '@/ui';
import { formatCount } from '../../copy/format';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

/** 요약 밴드 카드 한 칸 폭(본문 976 기준 4열) */
const GUIDE_METRIC_WIDTH = 236;
const GUIDE_METRIC_BAND = {
  display: 'grid',
  gridTemplateColumns: `repeat(3, ${GUIDE_METRIC_WIDTH}px)`,
  gap: 'var(--s-2-5)',
} as const;
const GUIDE_PROJECT_TAGS = ['인수심사', 'DB', '문서검색'] as const;

const GUIDE_METRICS: readonly MetricCardProps[] = [
  {
    label: '관문 통과',
    value: '1',
    tail: '/ 3',
    valueTone: 'progress',
    segments: [
      { weight: 1, tone: 'ink' },
      { weight: 2, tone: 'empty' },
    ],
    legend: [
      { label: '통과', value: '1', tone: 'ink' },
      { label: '미통과', value: '2', tone: 'empty' },
    ],
  },
  {
    label: 'P95 지연',
    value: '180',
    unit: 'ms',
    segments: [
      { weight: 64, tone: 'ink-soft' },
      { weight: 36, tone: 'empty' },
    ],
    mark: { left: '71%' },
    legend: [
      { label: '현재', value: '180ms', tone: 'ink-soft' },
      { label: '목표', value: '200ms', tone: 'fix', swatch: 'line' },
    ],
  },
  {
    label: '관문 통과',
    value: '집계 전',
    valueTone: 'faint',
    segments: [{ weight: 1, tone: 'empty' }],
    legend: [],
  },
];

/** 복사 결과 전환만 흉내 낸다(실제 복사는 화면이 platform.copyText로) — 성공 · 실패 */
function GuideCopyField() {
  return (
    <div className={styles.wide} style={{ maxWidth: 512 }}>
      <span className={styles.caption}>누르면 복사됨(유지 — 연결 정보 copiedMs=null)</span>
      <CopyField
        label="엔드포인트"
        value="https://mcp.internal/db_connector"
        copiedMs={null}
        onCopy={() => true}
      />
      <span className={styles.caption}>
        복사 실패(onCopy → false) — 2초 복사 안 됨 · status 안내
      </span>
      <CopyField label="인증 키" value="sk_live_••••••••db_c" onCopy={() => false} />
    </div>
  );
}

export const BUTTON_SM_PLUS_SECTION: GuideSection = {
  group: '기본',
  name: 'Button sm-plus · label',
  render: () => (
    <div className={styles.row}>
      <Button variant="primary" size="sm-plus" textStyle="label">
        + 소스 추가
      </Button>
      <Button size="sm-plus" textStyle="label">
        소스 고르기
      </Button>
      <Button variant="primary" size="sm-plus" textStyle="label" disabled>
        + 커넥터 만들기
      </Button>
    </div>
  ),
};

export const ICON_BUTTON_FILLED_SECTION: GuideSection = {
  group: '기본',
  name: 'IconButton filled · sm-plus',
  render: () => (
    <div className={styles.row}>
      <IconButton icon="settings" variant="filled" size="sm-plus" title="프로젝트 정보 수정" />
      <IconButton icon="settings" variant="filled" size="sm-plus" title="disabled" disabled />
    </div>
  ),
};

export const INPUT_SM_PLUS_SECTION: GuideSection = {
  group: '기본',
  name: 'Input sm-plus',
  render: () => (
    <div className={styles.row}>
      <Input
        size="sm-plus"
        aria-label="소스 검색"
        placeholder="이름 · 타입 검색"
        style={{ width: 150 }}
      />
      <Input
        size="sm-plus"
        aria-label="커넥터 검색"
        placeholder="이름 · 소스 검색"
        style={{ width: 110 }}
      />
    </div>
  ),
};

export const STATUS_CHIP_IDLE_SECTION: GuideSection = {
  group: '표식',
  name: 'StatusChip idle',
  render: () => (
    <div className={styles.row}>
      <StatusChip tier="idle" surface="soft">
        미발행
      </StatusChip>
      <StatusChip tier="idle">미발행</StatusChip>
      <StatusChip tier="idle" size="lg">
        미발행
      </StatusChip>
    </div>
  ),
};

export const TAG_PROJECT_SECTION: GuideSection = {
  group: '표식',
  name: 'Tag project',
  render: () => (
    <div className={styles.row}>
      {GUIDE_PROJECT_TAGS.map((t) => (
        <Tag key={t} variant="project">
          {t}
        </Tag>
      ))}
    </div>
  ),
};

export const METRIC_CARD_SECTION: GuideSection = {
  group: '데이터',
  name: 'MetricCard',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>값 figure 600 16/1.25 · 값 없음은 사유(`집계 전`)</span>
      <div style={GUIDE_METRIC_BAND}>
        {GUIDE_METRICS.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>
    </div>
  ),
};

/** SegmentBar tone 6종 — 손봐야 할 것 2(fix · progress) + 중립 단계(ink-soft · muted · faint) + empty */
const GUIDE_SEGMENT_TONES: readonly Segment[] = [
  { label: 'ink-soft', value: 5, tone: 'ink-soft' },
  { label: 'muted', value: 3, tone: 'muted' },
  { label: 'faint', value: 2, tone: 'faint' },
  { label: 'progress', value: 2, tone: 'progress' },
  { label: 'fix', value: 1, tone: 'fix' },
  { label: 'empty', value: 3, tone: 'empty' },
];

export const SEGMENT_BAR_SECTION: GuideSection = {
  group: '데이터',
  name: 'SegmentBar',
  render: () => (
    <div className={styles.cell} style={{ width: GUIDE_METRIC_WIDTH }}>
      <span className={styles.caption}>tone 6종 · 범례 2열(legend 기본 true)</span>
      <SegmentBar segments={GUIDE_SEGMENT_TONES} aria-label="tone 구성" />
    </div>
  ),
};

export const COPY_FIELD_SECTION: GuideSection = {
  group: '데이터',
  name: 'CopyField',
  render: () => <GuideCopyField />,
};

export const PAGE_HEADER_DETAIL_SECTION: GuideSection = {
  group: '레이아웃',
  name: 'PageHeader tags · meta · divider',
  render: () => (
    <div className={styles.wide}>
      <PageHeader
        divider
        title="보험 인수심사"
        description="인수심사 담당자가 계약 원장과 인수지침 문서를 함께 조회하는 프로젝트."
        tags={GUIDE_PROJECT_TAGS.map((t) => (
          <Tag key={t} variant="project">
            {t}
          </Tag>
        ))}
        meta={[
          { label: '생성일', value: '2026-04-18' },
          { label: '업데이트', value: '2026-09-10' },
        ]}
        actions={
          <IconButton icon="settings" variant="filled" size="sm-plus" title="프로젝트 정보 수정" />
        }
      />
    </div>
  ),
};

/** reason — 권한 없는 도구: 머리 아래 사유 한 줄 + 버튼 aria-describedby(title은 hover 보조) */
function GuideReasonHead() {
  const reasonId = useId();
  const reason = '이 프로젝트에서 소스를 연결할 권한이 없다';
  return (
    <SectionHead
      divider
      title="연결된 소스"
      count="3"
      reason={reason}
      reasonId={reasonId}
      tools={
        <Button
          variant="primary"
          size="sm-plus"
          textStyle="label"
          disabled
          title={reason}
          aria-describedby={reasonId}
        >
          + 소스 추가
        </Button>
      }
    />
  );
}

type GuideCallRow = { name: string; source: string; calls: number; when: string };
const GUIDE_CALL_ROWS: readonly GuideCallRow[] = [
  { name: 'search_policy', source: '계약 원장 DB', calls: 1284, when: '2026-09-10' },
  {
    name: 'get_contract_detail',
    source: '계약 원장 DB · 상품 문서',
    calls: 312,
    when: '2026-09-09',
  },
  { name: 'list_riders', source: '상품 문서', calls: 0, when: '' },
];
/** 글 열 minmax(0,Nfr) · 숫자 · 날짜 열만 고정 px · 날짜는 low(행 식별에 필요 없는 메타) */
const GUIDE_CALL_COLUMNS: readonly TableColumn<GuideCallRow>[] = [
  {
    key: 'name',
    header: '도구',
    width: 'minmax(0,2fr)',
    priority: 'high',
    cell: (r) => <TableCellLines main={r.name} sub={r.source} />,
  },
  {
    key: 'calls',
    header: '호출',
    width: '72px',
    priority: 'high',
    numeric: true,
    cell: (r) => formatCount(r.calls),
  },
  { key: 'when', header: '마지막 호출', width: '96px', priority: 'low', emptyReason: '호출 없음' },
];
const guideCallKey = (r: GuideCallRow) => r.name;

export const TABLE_LINES_SECTION: GuideSection = {
  group: '데이터',
  name: 'Table 두 줄 셀',
  render: () => (
    <div className={styles.cell} style={{ width: 560 }}>
      <span className={styles.caption}>
        TableCellLines — main 행 글자 · sub caption muted · double 행 · 빈 값은 emptyReason
      </span>
      <Table
        aria-label="도구 호출"
        columns={GUIDE_CALL_COLUMNS}
        rows={GUIDE_CALL_ROWS}
        rowKey={guideCallKey}
      />
    </div>
  ),
};

export const SECTION_HEAD_SECTION: GuideSection = {
  group: '데이터',
  name: 'SectionHead',
  render: () => (
    <div className={styles.cell} style={{ width: 474 }}>
      <SectionHead
        divider
        title="연결된 소스"
        count="3"
        tools={
          <>
            <Input
              size="sm-plus"
              aria-label="소스 검색"
              placeholder="이름 · 타입 검색"
              style={{ width: 150 }}
            />
            <Button variant="primary" size="sm-plus" textStyle="label">
              + 소스 추가
            </Button>
          </>
        }
      />
      <SectionHead
        divider
        title="생성 커넥터"
        count="0"
        tools={
          <Button variant="primary" size="sm-plus" textStyle="label" disabled>
            + 커넥터 만들기
          </Button>
        }
      />
      <GuideReasonHead />
      <SectionHead
        title="생성 커넥터"
        marker={
          <StatusChip tier="fix" surface="soft">
            실패
          </StatusChip>
        }
        count="1 / 3"
      />
      <SectionHead title="멤버" count="12" />
      <SectionHead as="h3" title="하위 영역(h3) · 구분선 없음" />
    </div>
  ),
};

// 데이터 절(Table · RowCard · SummaryCard · KeyValue) — sections.tsx가 BASE_SECTIONS에 순서대로 잇는다
import { useState } from 'react';
import {
  Button,
  KeyValue,
  RowCard,
  type RowCardType,
  SegmentBar,
  StatusChip,
  SummaryBand,
  SummaryCard,
  Table,
  type TableColumn,
} from '@/ui';
import { formatCount } from '../../copy/format';
import { GUIDE_KEY_VALUE_ROWS, GUIDE_SUMMARY_CARDS } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

type GuideToolRow = { name: string; desc: string; args: number | null };
type GuideCard = {
  title: string;
  type: RowCardType;
  tier: 'done' | 'progress' | 'fix';
  status: string;
  summary: string;
  action: string;
};

const GUIDE_SOURCE_CARDS: GuideCard[] = [
  {
    title: '계약 원장 DB',
    type: { label: 'DB' },
    tier: 'done',
    status: '수집 완료',
    summary: '객체 타입 12 · 승인 대기 2',
    action: '설정',
  },
  {
    title: '약관 문서 저장소',
    type: { label: '문서' },
    tier: 'progress',
    status: '수집 중',
    summary: '문서 318건 중 204건',
    action: '설정',
  },
  {
    title: '정책 Git',
    type: { label: 'Git' },
    tier: 'fix',
    status: '인증 실패',
    summary: '마지막 수집 3일 전',
    action: '설정',
  },
];
const GUIDE_CONNECTOR_CARDS: GuideCard[] = [
  {
    title: '계약 조회 커넥터',
    type: { label: '도구 7' },
    tier: 'done',
    status: '사용 중',
    summary: '계약 원장 DB · 7일 1,284 호출',
    action: '열기',
  },
  {
    title: '약관 검색 커넥터',
    type: { label: '도구 3' },
    tier: 'progress',
    status: '갱신 중',
    summary: '약관 문서 저장소 · 호출 없음',
    action: '열기',
  },
];

function GuideSummaryBand({ narrow = false }: { narrow?: boolean }) {
  return (
    <SummaryBand narrow={narrow}>
      {GUIDE_SUMMARY_CARDS.map((c) => (
        <SummaryCard key={c.title} title={c.title} value={c.value} valueTone={c.valueTone}>
          <SegmentBar segments={c.segments} aria-label={`${c.title} 구성`} />
        </SummaryCard>
      ))}
    </SummaryBand>
  );
}

function GuideRowCard({ card, selected = false }: { card: GuideCard; selected?: boolean }) {
  return (
    <RowCard
      title={card.title}
      type={card.type}
      status={
        <StatusChip tier={card.tier} surface="soft">
          {card.status}
        </StatusChip>
      }
      summary={card.summary}
      action={
        <Button size="sm" textStyle="label">
          {card.action}
        </Button>
      }
      selected={selected}
      onClick={() => {}}
    />
  );
}

const GUIDE_TOOLS: GuideToolRow[] = [
  { name: 'get_policy', desc: '계약번호로 계약 한 건을 읽습니다', args: 1 },
  { name: 'search_policy', desc: '상품명·체결일 범위로 계약을 찾습니다', args: 3 },
  { name: 'describe_schema', desc: '노출된 객체 타입과 속성을 알려 줍니다', args: null },
];
const GUIDE_TOOL_COLUMNS: TableColumn<GuideToolRow>[] = [
  { key: 'name', header: '도구', width: 'minmax(0,1.4fr)', priority: 'high' },
  { key: 'desc', header: '설명문', width: 'minmax(0,2.6fr)', priority: 'low' },
  {
    key: 'args',
    header: '인자',
    width: 'minmax(0,.8fr)',
    priority: 'high',
    numeric: true,
    cell: (r) => (r.args === null ? null : formatCount(r.args)),
    emptyReason: '호출 없음',
  },
];
const guideToolKey = (r: GuideToolRow) => r.name;

/** double: 헤더 · 행 클릭 선택 · emptyReason */
function TableDoubleSample() {
  const [selected, setSelected] = useState('search_policy');
  return (
    <Table
      aria-label="도구"
      columns={GUIDE_TOOL_COLUMNS}
      rows={GUIDE_TOOLS}
      rowKey={guideToolKey}
      selectedKey={selected}
      onRowClick={(r) => setSelected(r.name)}
    />
  );
}

/** 연결 설정 마지막 행 — 마스킹 값(mono) + 행 액션 */
const GUIDE_CREDENTIAL_ROW = {
  key: '자격증명',
  value: '••••••••',
  mono: true,
  action: <Button size="sm">교체</Button>,
};

const GUIDE_LONG_KEY_VALUES = [
  {
    key: '연결 문자열',
    value: 'postgres://svc_reader@10.42.3.18:5432/policy_core?sslmode=require&application_name=mcp',
    mono: true,
    truncate: true,
  },
  {
    key: '경로',
    value: '/var/lib/mcp-studio/sources/contract-ledger/snapshots/2026-09-10',
    truncate: true,
    action: <Button size="sm">교체</Button>,
  },
];

export const DATA_SECTIONS: readonly GuideSection[] = [
  {
    group: '데이터',
    name: 'Table',
    render: () => (
      <div className={styles.wide}>
        <span className={styles.caption}>double · 선택 · emptyReason</span>
        <TableDoubleSample />
        <span className={styles.caption}>single(한 줄 36) · headless</span>
        <Table
          density="single"
          headless
          aria-label="호출 순위"
          columns={GUIDE_TOOL_COLUMNS}
          rows={GUIDE_TOOLS}
          rowKey={guideToolKey}
        />
        <span className={styles.caption}>narrow (low 열 제거)</span>
        <Table
          narrow
          aria-label="도구 좁은 폭"
          columns={GUIDE_TOOL_COLUMNS}
          rows={GUIDE_TOOLS}
          rowKey={guideToolKey}
        />
      </div>
    ),
  },
  {
    group: '데이터',
    name: 'RowCard',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>소스 (타입 칩 DB · 문서 · Git — 중립)</span>
        {GUIDE_SOURCE_CARDS.map((c) => (
          <GuideRowCard key={c.title} card={c} />
        ))}
        <span className={styles.caption}>커넥터 · 두 번째는 selected</span>
        {GUIDE_CONNECTOR_CARDS.map((c, i) => (
          <GuideRowCard key={c.title} card={c} selected={i === 1} />
        ))}
      </div>
    ),
  },
  {
    group: '데이터',
    name: 'SummaryCard',
    render: () => (
      <div className={styles.wide}>
        <span className={styles.caption}>밴드 4열</span>
        <GuideSummaryBand />
        <span className={styles.caption}>narrow (2열)</span>
        <GuideSummaryBand narrow />
      </div>
    ),
  },
  {
    group: '데이터',
    name: 'KeyValue',
    render: () => (
      <div className={styles.wide}>
        <KeyValue items={[...GUIDE_KEY_VALUE_ROWS, GUIDE_CREDENTIAL_ROW]} />
        <span className={styles.caption}>truncate — 긴 값 한 줄 말줄임(원문은 title)</span>
        <div style={{ width: 420 }}>
          <KeyValue items={GUIDE_LONG_KEY_VALUES} />
        </div>
      </div>
    ),
  },
];

// 흐름 · 설정 모달에서 쓰는 컴포넌트 · 변형 — sections.tsx가 관련 절 뒤에 끼워 넣는다. hover는 눈으로 확인
import { useState } from 'react';
import {
  CopyField,
  FileDrop,
  Icon,
  ICON_NAMES,
  Illust,
  ILLUST_NAMES,
  InfoDot,
  KeyValue,
  Label,
  LogView,
  ProgressBar,
  Tabs,
  ToggleChip,
  Tooltip,
} from '@/ui';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';
import {
  FILE_DROP_FORMATS,
  FILE_DROP_LINES,
  FLOW_FORM_WIDTH,
  GIT_AUTO_NOTE,
  GUIDE_RAIL_ITEMS,
  GUIDE_SETTINGS_LOG,
  GUIDE_SETTINGS_STATE,
  RUN_ITEM_WIDTH,
  SETTINGS_CONTENT_WIDTH,
} from './fixturesFlow';

/** 흐름 진행 로그 최소 높이 */
const RUN_LOG_MIN_HEIGHT = 110;
const RUN_LOG = ['00:00:01  담은 2건 연결 확인', '00:00:06  읽을 범위 확인'];

export const LABEL_HINT_SECTION: GuideSection = {
  group: '기본',
  name: 'Label hint',
  render: () => (
    <div className={styles.row}>
      <Label requirement="required" hint="호스트와 포트">
        접속 주소
      </Label>
      <Label requirement="optional">설명</Label>
    </div>
  ),
};

function GuideRail() {
  const [tab, setTab] = useState('status');
  return <Tabs variant="rail" value={tab} onValueChange={setTab} items={GUIDE_RAIL_ITEMS} />;
}

export const TABS_RAIL_SECTION: GuideSection = {
  group: '기본',
  name: 'Tabs rail',
  render: () => <GuideRail />,
};

export const SETTINGS_VALUES_SECTION: GuideSection = {
  group: '데이터',
  name: 'KeyValue plain · CopyField 읽기 전용',
  render: () => (
    <div className={styles.cell} style={{ width: SETTINGS_CONTENT_WIDTH }}>
      <KeyValue variant="plain" items={GUIDE_SETTINGS_STATE} />
      <CopyField label="접속 주소" value="db-contract.internal:5432" />
      <CopyField label="읽기 권한 키" value="${vault:db/contract}" />
    </div>
  ),
};

export const LOG_VIEW_SOFT_SECTION: GuideSection = {
  group: '상태 표현',
  name: 'LogView soft',
  render: () => (
    <div className={styles.cell} style={{ width: SETTINGS_CONTENT_WIDTH }}>
      <LogView variant="soft" lines={GUIDE_SETTINGS_LOG} />
      <LogView variant="soft" minHeight={RUN_LOG_MIN_HEIGHT} lines={RUN_LOG} />
    </div>
  ),
};

export const TOOLTIP_NOTE_SECTION: GuideSection = {
  group: '기본',
  name: 'Tooltip note · InfoDot',
  render: () => (
    <div className={styles.row}>
      <Tooltip.Provider delayDuration={0}>
        <Tooltip variant="note" content={GIT_AUTO_NOTE} align="start" alignOffset={-8}>
          <InfoDot glyph="!" interactive aria-label="자동화 수준 설명" />
        </Tooltip>
      </Tooltip.Provider>
      <InfoDot glyph="i" />
    </div>
  ),
};

function GuideFileDrop() {
  const [names, setNames] = useState<readonly string[]>([]);
  return (
    <div className={styles.cell} style={{ width: FLOW_FORM_WIDTH }}>
      <FileDrop
        lines={FILE_DROP_LINES}
        formats={FILE_DROP_FORMATS}
        description="파일 첨부"
        multiple
        onFiles={(files) => setNames(files.map((f) => f.name))}
      />
      <span className={styles.caption}>
        {names.length > 0 ? names.join(' · ') : '고른 파일 없음'}
      </span>
    </div>
  );
}

export const FILE_DROP_SECTION: GuideSection = {
  group: '기본',
  name: 'FileDrop',
  render: () => <GuideFileDrop />,
};

const ICON_SIZES = [16, 17, 18, 20] as const;

export const ICON_SECTION: GuideSection = {
  group: '기본',
  name: 'Icon',
  render: () => (
    <div className={styles.wide}>
      <span className={styles.caption}>
        size 16 · 17(IconButton sm-plus) · 18(기본) · 20 — 색은 currentColor(기본 --icon)
      </span>
      <div className={styles.grid}>
        {ICON_NAMES.map((name) => (
          <div key={name} className={styles.cell}>
            <span className={styles.caption}>{name}</span>
            <div className={styles.row} style={{ color: 'var(--icon)' }}>
              {ICON_SIZES.map((size) => (
                <Icon key={size} name={name} size={size} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const ILLUST_SECTION: GuideSection = {
  group: '기본',
  name: 'Illust',
  render: () => (
    <div className={styles.row} style={{ color: 'var(--illust)' }}>
      {ILLUST_NAMES.map((name) => (
        <Illust key={name} name={name} />
      ))}
    </div>
  ),
};

const GUIDE_TOOLS = [
  { key: 'q', label: '조회 7' },
  { key: 'agg', label: '집계 3' },
  { key: 'w', label: '쓰기 0' },
] as const;

function GuideToggleChips() {
  const [on, setOn] = useState<Readonly<Record<string, boolean>>>({ q: true, agg: true });
  return (
    <div className={styles.row}>
      {GUIDE_TOOLS.map((t) => (
        <ToggleChip
          key={t.key}
          pressed={on[t.key] === true}
          onPressedChange={(next) => setOn((prev) => ({ ...prev, [t.key]: next }))}
        >
          {t.label}
        </ToggleChip>
      ))}
      <ToggleChip pressed={false} onPressedChange={() => undefined} disabled>
        비활성
      </ToggleChip>
    </div>
  );
}

export const TOGGLE_CHIP_SECTION: GuideSection = {
  group: '기본',
  name: 'ToggleChip',
  render: () => <GuideToggleChips />,
};

const PROGRESS_SAMPLES = [0, 42, 100] as const;

export const PROGRESS_BAR_SECTION: GuideSection = {
  group: '데이터',
  name: 'ProgressBar',
  render: () => (
    <div className={styles.cell} style={{ width: RUN_ITEM_WIDTH }}>
      {PROGRESS_SAMPLES.map((v) => (
        <ProgressBar key={`md-${v}`} value={v} aria-label={`전체 진행 ${v}`} />
      ))}
      {PROGRESS_SAMPLES.map((v) => (
        <ProgressBar key={`sm-${v}`} value={v} size="sm" aria-label={`항목 진행 ${v}`} />
      ))}
    </div>
  ),
};

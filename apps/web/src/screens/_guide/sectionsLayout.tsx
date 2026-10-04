// 레이아웃 절(PageHeader · AppShell · LNBPanel · LNB)과 LNB 예시 — sections.tsx가 BASE_SECTIONS 맨 뒤에 잇는다
import { useState } from 'react';
import {
  AppShell,
  Button,
  CloseButton,
  LNB,
  LNBPanel,
  type NavSection,
  PageHeader,
  SegmentedControl,
  StatusChip,
} from '@/ui';
import { GUIDE_LNB_ALERT, GUIDE_LNB_SECTIONS, GUIDE_LNB_TOP_ITEMS, noop } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

const GUIDE_LNB_BOX = {
  width: 240,
  height: 640,
  background: 'var(--surface-soft)',
  border: '1px solid var(--hairline)',
} as const;
const GUIDE_LNB_ACTIVE_SUB = 'ds';
const GUIDE_LNB_ONTO_ITEMS = [
  { id: 'onto-manager', label: '온톨로지 매니저', href: '#' },
  { id: 'onto-object', label: '객체 타입', pending: true },
] as const;

/** 예시용 구역: 온톨로지에 하위 항목을 넣고 데이터 소스를 현재 화면으로 둔다 */
const guideLnbSections = (expanded: Readonly<Record<string, boolean>>): NavSection[] =>
  GUIDE_LNB_SECTIONS.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      expanded: expanded[group.id] ?? group.expanded,
      items: (group.id === 'onto' ? GUIDE_LNB_ONTO_ITEMS : group.items).map((it) => ({
        ...it,
        active: it.id === GUIDE_LNB_ACTIVE_SUB,
      })),
    })),
  }));

function GuideLNBPanel() {
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({});
  const sections = guideLnbSections(expanded);
  const onToggleGroup = (groupId: string) => {
    const current = sections.flatMap((s) => s.groups).find((g) => g.id === groupId);
    setExpanded((prev) => ({ ...prev, [groupId]: !(current?.expanded ?? false) }));
  };
  return (
    <div style={GUIDE_LNB_BOX}>
      <LNBPanel
        topItems={GUIDE_LNB_TOP_ITEMS}
        sections={sections}
        alert={GUIDE_LNB_ALERT}
        onSearch={noop}
        onToggle={noop}
        onToggleGroup={onToggleGroup}
        onAlerts={noop}
      />
    </div>
  );
}

const GUIDE_LNB_WIDTHS = [200, 240, 320] as const;
const GUIDE_LNB_FRAME = { position: 'relative', display: 'flex', height: 640 } as const;
/** 1024 펼침 예시 — 레일 옆 본문 자리를 두어 패널이 본문 위에 뜨는 것을 보인다 */
const GUIDE_LNB_NARROW_FRAME = {
  ...GUIDE_LNB_FRAME,
  width: 480,
  border: '1px solid var(--hairline)',
} as const;

type GuideLNBState = { collapsed: boolean; hovering: boolean; width: number };

/** 제어 컴포넌트 LNB 예시 — 상태(접힘 · hover · 폭)는 여기서 들고 immutable로 바꾼다 */
function GuideLNB({ initialCollapsed = false, pinFloating = false, narrow = false }) {
  const [state, setState] = useState<GuideLNBState>({
    collapsed: initialCollapsed,
    hovering: false,
    width: GUIDE_LNB_WIDTHS[1],
  });
  const toggle = () =>
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed, hovering: false }));
  const floating = state.collapsed && (pinFloating || state.hovering);
  return (
    <div className={styles.cell}>
      <div className={styles.row}>
        <Button size="sm" textStyle="label" onClick={toggle}>
          {state.collapsed ? '펼치기' : '접기'}
        </Button>
        {GUIDE_LNB_WIDTHS.map((w) => (
          <Button
            key={w}
            size="sm"
            textStyle="label"
            onClick={() => setState((prev) => ({ ...prev, width: w }))}
          >
            폭 {w}
          </Button>
        ))}
      </div>
      <div style={narrow ? GUIDE_LNB_NARROW_FRAME : GUIDE_LNB_FRAME}>
        <LNB
          width={state.width}
          collapsed={state.collapsed}
          floating={floating}
          narrow={narrow}
          onToggle={toggle}
          onResizeStart={noop}
          onHoverChange={(hovering) => setState((prev) => ({ ...prev, hovering }))}
          rail={{ onSearch: noop, alertCount: GUIDE_LNB_ALERT?.count ?? 0, onAlerts: noop }}
          panel={
            <LNBPanel
              topItems={GUIDE_LNB_TOP_ITEMS}
              sections={GUIDE_LNB_SECTIONS}
              alert={GUIDE_LNB_ALERT}
              toggleTitle={floating ? '사이드바 고정' : undefined}
              onSearch={noop}
              onToggle={toggle}
              onToggleGroup={noop}
              onAlerts={noop}
            />
          }
        />
      </div>
    </div>
  );
}

/** AppShell 예시의 lnb — 프레임(position: relative)이 플로팅의 기준 */
function GuideShellLNB() {
  const [state, setState] = useState({ collapsed: false, hovering: false });
  const toggle = () =>
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed, hovering: false }));
  return (
    <LNB
      width={GUIDE_LNB_WIDTHS[1]}
      collapsed={state.collapsed}
      floating={state.collapsed && state.hovering}
      onToggle={toggle}
      onResizeStart={noop}
      onHoverChange={(hovering) => setState((prev) => ({ ...prev, hovering }))}
      rail={{ onSearch: noop, alertCount: GUIDE_LNB_ALERT?.count ?? 0, onAlerts: noop }}
      panel={
        <LNBPanel
          topItems={GUIDE_LNB_TOP_ITEMS}
          sections={GUIDE_LNB_SECTIONS}
          alert={GUIDE_LNB_ALERT}
          onSearch={noop}
          onToggle={toggle}
          onToggleGroup={noop}
          onAlerts={noop}
        />
      }
    />
  );
}

export const LAYOUT_SECTIONS: readonly GuideSection[] = [
  {
    group: '레이아웃',
    name: 'PageHeader',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>제목 24 + 표식 · 설명 위 3 · 우측 ✕ 26</span>
        <div style={{ width: 720 }}>
          <PageHeader
            title="커넥터 구성"
            marker={
              <StatusChip tier="idle" size="lg">
                미발행
              </StatusChip>
            }
            description="계약 원장 DB에서 나옵니다 · 커넥터 하나는 소스 하나만 씁니다"
            actions={<CloseButton size={26} />}
          />
        </div>
        <span className={styles.caption}>
          actions — 왼쪽부터 화면 필터(SegmentedControl sm-plus) · 하위 화면 링크 · 층 열기(Button
          sm)
        </span>
        <div style={{ width: 720 }}>
          <PageHeader
            title="대시보드"
            actions={
              <>
                <SegmentedControl
                  size="sm-plus"
                  aria-label="기간"
                  items={[
                    { value: '7d', label: '7일' },
                    { value: '30d', label: '30일' },
                  ]}
                />
                <Button variant="link" size="sm">
                  멤버
                </Button>
                <Button size="sm">내보내기</Button>
              </>
            }
          />
        </div>
      </div>
    ),
  },
  {
    group: '레이아웃',
    name: 'AppShell',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          프레임 = lnb + main · LNB 접기/펼치기 · 접힘에서 hover면 플로팅
        </span>
        <div className={styles.stage}>
          <div style={{ height: 640 }}>
            <AppShell lnb={<GuideShellLNB />}>
              <div style={{ padding: '24px 32px 0' }}>
                <PageHeader
                  title="커넥터 구성"
                  marker={
                    <StatusChip tier="idle" size="lg">
                      미발행
                    </StatusChip>
                  }
                  description="계약 원장 DB에서 나옵니다 · 커넥터 하나는 소스 하나만 씁니다"
                  actions={<CloseButton size={26} />}
                />
              </div>
            </AppShell>
          </div>
        </div>
      </div>
    ),
  },
  {
    group: '레이아웃',
    name: 'LNBPanel',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          240×640 · 그룹 행을 눌러 접고 편다 · 현재: 대시보드 · 데이터 소스
        </span>
        <GuideLNBPanel />
      </div>
    ),
  },
  {
    group: '레이아웃',
    name: 'LNB',
    render: () => (
      <div className={styles.list}>
        <div className={styles.row}>
          <div className={styles.cell}>
            <span className={styles.caption}>펼침 · 폭 버튼 · 접기 버튼으로 레일</span>
            <GuideLNB />
          </div>
          <div className={styles.cell}>
            <span className={styles.caption}>접힘 48 레일 · hover면 플로팅</span>
            <GuideLNB initialCollapsed />
          </div>
          <div className={styles.cell}>
            <span className={styles.caption}>플로팅 고정 표시(접힘 + popover 그림자)</span>
            <GuideLNB initialCollapsed pinFloating />
          </div>
        </div>
        <div className={styles.cell}>
          <span className={styles.caption}>
            narrow 펼침(1024) — 레일을 두고 패널이 본문 위에 뜬다 · 접기 버튼 · Esc로 닫힘
          </span>
          <GuideLNB narrow />
        </div>
      </div>
    ),
  },
];

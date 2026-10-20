// 카탈로그 SegmentedTabs 절 — 셋 항목 + SegmentedTabPanel(누르면 패널 내용이 바뀐다) · 좁은 자리에서 묶음 안 가로 스크롤.
// hover · 포커스 링(안쪽 — 고른 항목 위는 흰 링)은 직접 눌러 보고 Tab으로 닿아 본다
import { useState } from 'react';
import { SegmentedTabPanel, SegmentedTabs, type SegmentedItem } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SegmentedTabsSection.module.css';

const PREVIEW_TABS: readonly SegmentedItem[] = [
  { value: 'mcp', label: 'MCP 도구 정의' },
  { value: 'req', label: '원본 요청' },
  { value: 'res', label: '응답 변환' },
];
const PANEL_TEXT: Readonly<Record<string, string>> = {
  mcp: 'MCP 도구 정의 패널 — role="tabpanel", 이름은 지금 탭(aria-labelledby)',
  req: '원본 요청 패널 — 내용만 바꿔 그린다(패널 자리는 하나)',
  res: '응답 변환 패널 — 탭은 aria-controls로 이 패널을 가리킨다',
};
const LONG_TABS: readonly SegmentedItem[] = [
  { value: 'one', label: '아주 긴 탭 이름 하나' },
  { value: 'two', label: '아주 긴 탭 이름 둘' },
  { value: 'three', label: '아주 긴 탭 이름 셋' },
];

function Preview() {
  const [tab, setTab] = useState('mcp');
  return (
    <div className={catalog.stack}>
      <div className={catalog.row}>
        <SegmentedTabs idPrefix="guide-seg-preview" items={PREVIEW_TABS} value={tab} onValueChange={setTab} />
      </div>
      <SegmentedTabPanel idPrefix="guide-seg-preview" value={tab} className={catalog.frame}>
        {PANEL_TEXT[tab]}
      </SegmentedTabPanel>
    </div>
  );
}

function Narrow() {
  const [tab, setTab] = useState('one');
  return (
    <div className={styles.narrow}>
      <SegmentedTabs idPrefix="guide-seg-narrow" items={LONG_TABS} value={tab} onValueChange={setTab} />
    </div>
  );
}

export function SegmentedTabsSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        바깥 높이 --h-sm-plus · 1px --line-control · 항목 사이 세로선. 고른 탭은 --primary 필 · --on-fill 글자 · --fw-medium이고 hover에도 그대로다.
        tablist 안 tab(aria-selected · aria-controls) + SegmentedTabPanel 한 칸. 항목마다 Tab으로 닿고 Enter · Space로 고른다 — 화살표 키 이동은 없다.
        같은 모양의 라디오 역할은 SegmentedRadio다.
      </p>
      <h3 className={catalog.heading}>셋 항목 + 패널</h3>
      <Preview />
      <h3 className={catalog.heading}>좁은 자리 — 묶음 안에서 가로 스크롤</h3>
      <Narrow />
    </div>
  );
}

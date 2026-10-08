// 카탈로그 SegmentedRadio 절 — 넷 항목(테스트 실행 AI 모델) · label. 누르면 고른 항목이 바뀐다(hover · 포커스 링은 직접 본다)
import { useState } from 'react';
import { SegmentedRadio, type SegmentedItem } from '../../ui';
import catalog from './catalog.module.css';

const MODELS: readonly SegmentedItem[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'gpt', label: 'GPT' },
  { value: 'mcp', label: '사내 Agent' },
];

export function SegmentedRadioSection() {
  const [model, setModel] = useState('claude');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        SegmentedTabs와 같은 모양 · 같은 CSS. radiogroup(label = aria-label) 안 radio(aria-checked) 버튼이고, 항목마다 Tab으로 닿는다 — 화살표 키 이동은 없다(옛 그대로).
      </p>
      <h3 className={catalog.heading}>넷 항목 — label "AI 모델"</h3>
      <div className={catalog.row}>
        <SegmentedRadio label="AI 모델" items={MODELS} value={model} onValueChange={setModel} />
      </div>
    </div>
  );
}

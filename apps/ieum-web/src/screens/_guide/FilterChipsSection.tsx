// 카탈로그 FilterChips 절 — 묶음 모양(toolbar · band) × 개수 유무 × 고른 칩. 누르면 고른 칩이 바뀐다(포커스는 칩에 남는다)
import { useState } from 'react';
import { FilterChips, type FilterChipItem, type FilterChipsVariant } from '../../ui';
import catalog from './catalog.module.css';

const WITH_COUNT: readonly FilterChipItem[] = [
  { value: 'all', label: '전체', count: 128 },
  { value: 'ok', label: '성공', count: 120 },
  { value: 'fail', label: '실패', count: 8 },
  { value: 'none', label: '없음', count: 0 },
];
const WITHOUT_COUNT: readonly FilterChipItem[] = [
  { value: 'all', label: '전체' },
  { value: 'ok', label: '성공' },
  { value: 'fail', label: '실패' },
];

function Demo({ variant, items }: { variant: FilterChipsVariant; items: readonly FilterChipItem[] }) {
  const [value, setValue] = useState('all');
  return <FilterChips variant={variant} items={items} value={value} onValueChange={setValue} label="상태 필터" />;
}

export function FilterChipsSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        --h-xs 알약 · 토글 버튼(aria-pressed). 고른 칩은 테두리 --primary · 바탕 --primary-bg · 글자와 개수 --primary-ink다.
        개수는 서식 없이 그대로 보인다. band는 패널 머리 띠(안쪽 여백 · 아래 선)다.
      </p>
      <h3 className={catalog.heading}>toolbar</h3>
      <div className={catalog.stack}>
        <Demo variant="toolbar" items={WITH_COUNT} />
        <Demo variant="toolbar" items={WITHOUT_COUNT} />
      </div>
      <h3 className={catalog.heading}>band</h3>
      <div className={catalog.frame}>
        <Demo variant="band" items={WITH_COUNT} />
      </div>
    </div>
  );
}

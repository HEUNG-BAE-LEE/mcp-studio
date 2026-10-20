// 카탈로그 RadioList 절 — 설명 있는 줄 · 없는 줄. 줄 어디를 눌러도 고르고, 화살표로 묶음 안을 옮긴다
import { useState } from 'react';
import { RadioList, type RadioListItem } from '../../ui';
import catalog from './catalog.module.css';

const ITEMS: readonly RadioListItem[] = [
  { value: 'a', title: '사업자등록정보 진위확인', description: '국세청 · 서비스키 필요' },
  { value: 'b', title: '건축물대장 표제부 조회', description: '국토교통부' },
  { value: 'c', title: '설명 없는 선택지' },
];

export function RadioListSection() {
  const [value, setValue] = useState('a');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .gov-list — 브라우저 라디오 묶음(role=radiogroup, 라벨 줄이 이름). 줄 hover는 --surface-hover이고, 고름은 라디오의
        checked다.
      </p>
      <RadioList label="포털 API" items={ITEMS} value={value} onValueChange={setValue} />
    </div>
  );
}

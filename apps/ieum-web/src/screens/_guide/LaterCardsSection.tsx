// 카탈로그 LaterCards 절 — 카드 셋(3열, 1100 이하 한 열). 글자는 카탈로그 시연용이다
import { LaterCards, type LaterCardItem } from '../../ui';
import catalog from './catalog.module.css';

const ITEMS: readonly LaterCardItem[] = [
  { icon: 'db', title: '제목 하나', description: '짧은 설명이 한 줄 들어간다' },
  { icon: 'graph', title: '제목 둘', description: '짧은 설명이 한 줄 들어간다' },
  { icon: 'layers', title: '제목 셋', description: '짧은 설명이 한 줄 들어간다' },
];

export function LaterCardsSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        누를 수 없는 표시용 카드(점선 · 아이콘 칸 · 제목 + 흐린 설명 · 오른쪽 표지). 3열이고 뷰어 폭을 1100 이하로 바꾸면 한 열이다.
      </p>
      <LaterCards items={ITEMS} badge="표지" />
    </div>
  );
}

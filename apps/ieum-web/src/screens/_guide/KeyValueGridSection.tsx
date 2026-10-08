// 카탈로그 KeyValueGrid 절 — 6칸(3열 두 줄 · 760 이하 2열) · 고정폭 값 · 3칸 · 긴 값 · 값 없음 표기(쓰는 곳이 넣는다)
import { NONE } from '../../copy/format';
import { KeyValueGrid, type KeyValueItem } from '../../ui';
import catalog from './catalog.module.css';

const LOG_DETAIL: readonly KeyValueItem[] = [
  { label: '시각', value: '2026-10-08 14:32:07' },
  { label: '도구', value: 'orders.search' },
  { label: '원본 시스템', value: '주문 시스템' },
  { label: '상태', value: '성공' },
  { label: '응답 시간', value: '182ms' },
  { label: '요청 ID', value: '9f3c2a71-5b0e-4d18-8a6c-3e1d7f204b95', mono: true },
];

export function KeyValueGridSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        칸은 키(흐린 작은 글) + 값(본문 글). mono는 요청 ID 같은 값을 고정폭 작은 글자로 낸다. 값이 없는 칸은 쓰는 곳이 값 없음
        표기를 넣는다.
      </p>

      <h3 className={catalog.heading}>6칸 · mono 값</h3>
      <KeyValueGrid items={LOG_DETAIL} />

      <h3 className={catalog.heading}>3칸 · 값 없음 표기</h3>
      <KeyValueGrid
        items={[
          { label: '근거', value: 'OpenAPI 명세' },
          { label: '검증', value: NONE },
          { label: '관찰', value: NONE },
        ]}
      />

      <h3 className={catalog.heading}>4칸 · 긴 값(칸 안에서 줄바꿈)</h3>
      <KeyValueGrid
        items={[
          { label: '엔드포인트', value: 'https://internal.example.com/api/v2/orders/search?status=open&page=1' },
          { label: '메서드', value: 'GET' },
          { label: '요청 ID', value: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6', mono: true },
          { label: '응답 시간', value: '95ms' },
        ]}
      />
    </div>
  );
}

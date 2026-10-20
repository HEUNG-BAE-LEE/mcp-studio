// 카탈로그 SearchInput 절 — 툴바형 · 전폭형 × 빈 · 입력 · 자리표시. 입력할 때마다 바로 값이 바뀐다(한글 조합 중에도)
import { useState } from 'react';
import { SearchInput, type SearchInputVariant } from '../../ui';
import catalog from './catalog.module.css';

function Demo({ variant, initial, placeholder }: { variant: SearchInputVariant; initial: string; placeholder?: string }) {
  const [value, setValue] = useState(initial);
  return <SearchInput variant={variant} value={value} onValueChange={setValue} label="로그 검색" placeholder={placeholder} />;
}

export function SearchInputSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .search — input type=search + 누를 수 없는 돋보기 칸. 포커스 링은 상자 전체 둘레 하나이고 테두리가 --primary가
        된다. 입력할 때마다 바로 값이 바뀌고 한글 조합을 기다리지 않는다. toolbar는 760 이하에서 남은 폭을 채운다.
      </p>
      <h3 className={catalog.heading}>toolbar</h3>
      <div className={catalog.row}>
        <Demo variant="toolbar" initial="" placeholder="도구 · 클라이언트 검색" />
        <Demo variant="toolbar" initial="search_orders" />
      </div>
      <h3 className={catalog.heading}>full</h3>
      <div className={catalog.stack}>
        <Demo variant="full" initial="" placeholder="도구 검색" />
        <Demo variant="full" initial="주문" />
      </div>
    </div>
  );
}

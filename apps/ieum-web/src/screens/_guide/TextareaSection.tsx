// 카탈로그 Textarea 절 — code(줄 수 rows × 기본 · 비활성) · prose(도구 설명 · 비활성). 세로로만 늘어난다
import { useState } from 'react';
import { Field, Textarea } from '../../ui';
import catalog from './catalog.module.css';

function CodeDemo({ label, rows, initial, disabled }: { label: string; rows: number; initial: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <Field label={label} align="top">
      {({ id }) => (
        <Textarea id={id} rows={rows} value={value} onValueChange={setValue} disabled={disabled} placeholder='{"list":[{"PO_NO":"P-1"}]}' />
      )}
    </Field>
  );
}

function ProseDemo({ initial, disabled }: { initial: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return <Textarea variant="prose" value={value} onValueChange={setValue} disabled={disabled} aria-label="도구 설명" />;
}

export function TextareaSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        code는 이음 textarea.inp — 고정폭 작은 글자 · 최소 높이 120, 이름은 Field(align=&quot;top&quot;)의 라벨이다. prose는 .desc-ed textarea — 본문
        글꼴 · 설명 글 행간 · 최소 높이 78, 이름은 aria-label(옛 &quot;도구 설명&quot;)이다. 포커스에 테두리가 --primary가 된다.
      </p>
      <h3 className={catalog.heading}>code</h3>
      <div className={catalog.stack}>
        <CodeDemo label="요청 샘플" rows={3} initial="" />
        <CodeDemo label="응답 샘플" rows={6} initial={'{\n  "list": []\n}'} />
        <CodeDemo label="비활성" rows={3} initial="잠긴 칸" disabled />
      </div>
      <h3 className={catalog.heading}>prose — 도구 설명 편집</h3>
      <div className={catalog.stack}>
        <ProseDemo initial="발주 목록을 조회합니다. 기간과 거래처로 거를 수 있고, 결과는 발주 번호 · 품목 · 금액입니다." />
        <ProseDemo initial="잠긴 설명" disabled />
      </div>
    </div>
  );
}

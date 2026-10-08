// 카탈로그 Textarea 절 — 줄 수(rows) × 기본 · 비활성. 늘 고정폭이고 세로로만 늘어난다
import { useState } from 'react';
import { Field, Textarea } from '../../ui';
import catalog from './catalog.module.css';

function Demo({ label, rows, initial, disabled }: { label: string; rows: number; initial: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <Field label={label} align="top">
      {({ id }) => (
        <Textarea id={id} rows={rows} value={value} onValueChange={setValue} disabled={disabled} placeholder='{"list":[{"PO_NO":"P-1"}]}' />
      )}
    </Field>
  );
}

export function TextareaSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 textarea.inp — 고정폭 작은 글자 · 세로로만 늘인다 · 최소 높이 120. 이름은 Field(align=&quot;top&quot;)의 라벨이다.
        포커스에 테두리가 --primary가 된다.
      </p>
      <div className={catalog.stack}>
        <Demo label="요청 샘플" rows={3} initial="" />
        <Demo label="응답 샘플" rows={6} initial={'{\n  "list": []\n}'} />
        <Demo label="비활성" rows={3} initial="잠긴 칸" disabled />
      </div>
    </div>
  );
}

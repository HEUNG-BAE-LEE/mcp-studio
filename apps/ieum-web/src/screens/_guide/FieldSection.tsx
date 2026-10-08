// 카탈로그 Field 절 — 라벨 위치(center · top) × 입력 종류. 라벨을 누르면 입력에 포커스가 간다. 760 이하는 한 열
import { useState } from 'react';
import { Field, Input, Textarea } from '../../ui';
import catalog from './catalog.module.css';

export function FieldSection() {
  const [name, setName] = useState('');
  const [sample, setSample] = useState('');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .field — 라벨 열 --w-field-label + 입력 열. 라벨은 label for로 입력과 이어져 라벨을 누르면 입력에 포커스가 간다.
        760 이하에서는 라벨 위 · 입력 아래 한 열이다.
      </p>
      <h3 className={catalog.heading}>center</h3>
      <Field label="시스템 이름">
        {({ id }) => <Input id={id} value={name} onValueChange={setName} placeholder="비우면 명세의 이름을 씁니다" />}
      </Field>
      <h3 className={catalog.heading}>top</h3>
      <Field label="요청 샘플" align="top">
        {({ id }) => <Textarea id={id} rows={3} value={sample} onValueChange={setSample} />}
      </Field>
    </div>
  );
}

// 카탈로그 Field 절 — 라벨 위치(center · top) × 입력 종류, FieldNote(칸 묶음 아래 안내). 라벨을 누르면 입력에 포커스가 간다. 760 이하는 한 열 · 안내 들여쓰기 없음
import { useState } from 'react';
import { Field, FieldNote, InlineCode, Input, Textarea } from '../../ui';
import catalog from './catalog.module.css';

export function FieldSection() {
  const [name, setName] = useState('');
  const [sample, setSample] = useState('');
  const [scope, setScope] = useState('');
  const [pages, setPages] = useState('40');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .field — 라벨 열 --w-field-label + 입력 열. 라벨은 label for로 입력과 이어져 라벨을 누르면 입력에 포커스가 간다.
        760 이하에서는 라벨 위 · 입력 아래 한 열이다. FieldNote는 라벨 열만큼 들여 입력 열에 맞춘 흐린 안내(아래 4)이고 760 이하에서 들여쓰지 않는다.
      </p>
      <h3 className={catalog.heading}>center</h3>
      <Field label="시스템 이름">
        {({ id }) => <Input id={id} value={name} onValueChange={setName} placeholder="비우면 명세의 이름을 씁니다" />}
      </Field>
      <h3 className={catalog.heading}>top</h3>
      <Field label="요청 샘플" align="top">
        {({ id }) => <Textarea id={id} rows={3} value={sample} onValueChange={setSample} />}
      </Field>
      <h3 className={catalog.heading}>FieldNote — 칸 묶음 아래 안내</h3>
      <div>
        <Field label="탐색 범위">
          {({ id }) => <Input id={id} mono value={scope} onValueChange={setScope} placeholder="비우면 운영 주소 아래 전부 (예: /po/*)" />}
        </Field>
        <Field label="최대 화면 수">
          {({ id }) => <Input id={id} type="number" width="narrow" value={pages} onValueChange={setPages} />}
        </Field>
        <FieldNote>
          경로는 <InlineCode>/po/*</InlineCode> 처럼 서버 기준으로도 쓸 수 있습니다. <b>이 서버에는 git 이 없어 경로만 쓸 수 있습니다.</b>
        </FieldNote>
      </div>
    </div>
  );
}

// 카탈로그 Input 절 — 종류(text · password) × 고정폭 × 기본 · 비활성. 포커스에 테두리가 --primary가 된다
import { useState } from 'react';
import { Field, Input, type InputType } from '../../ui';
import catalog from './catalog.module.css';

type Case = { key: string; type: InputType; mono: boolean; disabled: boolean; placeholder?: string; initial: string; note: string };

const CASES: readonly Case[] = [
  { key: 'text', type: 'text', mono: false, disabled: false, placeholder: '비우면 명세의 이름을 씁니다', initial: '', note: '기본 — 자리표시는 브라우저 기본 색' },
  { key: 'mono', type: 'text', mono: true, disabled: false, initial: 'https://erp.example.com', note: 'mono — 서버 주소 · 키 이름 · 토큰 URL' },
  { key: 'password', type: 'password', mono: false, disabled: false, initial: 'secret', note: 'password — autocomplete="new-password"가 함께 들어간다' },
  { key: 'disabled', type: 'text', mono: false, disabled: true, initial: '잠긴 칸', note: 'disabled — --opacity-disabled' },
];

function Demo({ item }: { item: Case }) {
  const [value, setValue] = useState(item.initial);
  return (
    <Field label={item.key}>
      {({ id }) => (
        <Input
          id={id}
          type={item.type}
          mono={item.mono}
          disabled={item.disabled}
          placeholder={item.placeholder}
          value={value}
          onValueChange={setValue}
        />
      )}
    </Field>
  );
}

export function InputSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .inp — 높이 --h-md · 칸 전체 폭. 입력할 때마다 바로 값이 바뀐다. 이름은 Field의 라벨(id 연결)이고, 보이는 라벨이
        없는 칸은 aria-label을 준다.
      </p>
      <div className={catalog.stack}>
        {CASES.map((item) => (
          <div key={item.key}>
            <Demo item={item} />
            <p className={catalog.note}>{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

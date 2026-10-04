// apps/web/src/screens/project/settings/NameField.tsx — 설정 탭 공용 이름 입력(소스 정보 · 커넥터 만들기): Field(Label + Input) 한 칸. 폭은 내용 열(Tabs rail)이 정한다 · 편집 권한이 없으면 읽기 전용
import type { Ref } from 'react';
import { Field, Input } from '@/ui';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 편집 권한 없음 — 같은 칸을 읽기 전용으로 */
  readOnly?: boolean;
  /** 입력 — 저장 뒤 포커스를 돌려받는다(SourceSettingsModal) */
  inputRef?: Ref<HTMLInputElement>;
};

export function NameField({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  inputRef,
}: Props) {
  return (
    <Field label={label}>
      <Input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

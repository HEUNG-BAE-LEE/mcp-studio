// 카탈로그 Select 절 — 모양(toolbar · form · cell) × 기본 · 비활성. 값은 카탈로그 안에서만 바뀐다
import { useState } from 'react';
import { Select, type SelectVariant } from '../../ui';
import catalog from './catalog.module.css';

const VARIANTS: readonly SelectVariant[] = ['toolbar', 'form', 'cell'];
const NOTE: Readonly<Record<SelectVariant, string>> = {
  toolbar: '--h-lg · 각진 모서리 · 최대 폭 220 — 툴바 필터',
  form: '--h-md · 칸 전체 폭 · 포커스에 테두리 --primary — 폼 칸',
  cell: '--h-xs · 칸 전체 폭(최소 90) · 작은 글자 — 표 안 칸',
};
const OPTIONS = ['전체 AI 클라이언트', 'Claude Desktop', 'Cursor'] as const;

function Demo({ variant, disabled }: { variant: SelectVariant; disabled?: boolean }) {
  const [value, setValue] = useState<string>(OPTIONS[0]);
  return (
    <Select variant={variant} value={value} onValueChange={setValue} aria-label="AI 클라이언트" disabled={disabled}>
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}

export function SelectSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        네이티브 select에 모양만 입힌다. 펼침 화살표는 브라우저 기본이다. toolbar · cell은 보이는 라벨이 없어 aria-label을
        반드시 준다. 비활성은 --opacity-disabled 하나다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">variant</th>
              <th scope="col">기본</th>
              <th scope="col">disabled</th>
              <th scope="col">모양</th>
            </tr>
          </thead>
          <tbody>
            {VARIANTS.map((variant) => (
              <tr key={variant}>
                <th scope="row">
                  <code>{variant}</code>
                </th>
                <td>
                  <Demo variant={variant} />
                </td>
                <td>
                  <Demo variant={variant} disabled />
                </td>
                <td>{NOTE[variant]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

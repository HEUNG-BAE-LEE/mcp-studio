// 카탈로그 Select 절 — 모양(toolbar · form · cell · setting) × 기본 · 비활성, toolbar 최대 폭(기본 220 · wide 280). 값은 카탈로그 안에서만 바뀐다
import { useState } from 'react';
import { Select, type SelectVariant, type SelectWidth } from '../../ui';
import catalog from './catalog.module.css';

const VARIANTS: readonly SelectVariant[] = ['toolbar', 'form', 'cell', 'setting'];
const NOTE: Readonly<Record<SelectVariant, string>> = {
  toolbar: '--h-lg · 각진 모서리 · 최대 폭 220 — 툴바 필터',
  form: '--h-md · 칸 전체 폭 · 포커스에 테두리 --primary — 폼 칸',
  cell: '--h-xs · 칸 전체 폭(최소 90) · 작은 글자 — 표 안 칸',
  setting: '--h-sm · 내용 폭 · 오른쪽 정렬 · 포커스에 테두리 --primary — 설정 줄 오른쪽(탐색 시작 시각)',
};
const OPTIONS: Readonly<Record<SelectVariant, readonly string[]>> = {
  toolbar: ['전체 AI 클라이언트', 'Claude Desktop', 'Cursor'],
  form: ['전체 AI 클라이언트', 'Claude Desktop', 'Cursor'],
  cell: ['그대로', '날짜 형식', '코드표'],
  setting: ['지금 바로', '시각 예약'],
};
const LONG_OPTIONS = ['구매관리 시스템 운영 서버 2 — 아주 긴 원본 시스템 이름', 'ERP'] as const;

function Demo({ variant, disabled }: { variant: SelectVariant; disabled?: boolean }) {
  const options = OPTIONS[variant];
  const [value, setValue] = useState<string>(options[0] ?? '');
  return (
    <Select variant={variant} value={value} onValueChange={setValue} aria-label="AI 클라이언트" disabled={disabled}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}

function ToolbarWidthDemo({ width }: { width?: SelectWidth }) {
  const [value, setValue] = useState<string>(LONG_OPTIONS[0]);
  return (
    <Select variant="toolbar" width={width} value={value} onValueChange={setValue} aria-label="원본 시스템 선택">
      {LONG_OPTIONS.map((option) => (
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
        네이티브 select에 모양만 입힌다. 펼침 화살표는 브라우저 기본이다. toolbar · cell · setting은 보이는 라벨이 없어 aria-label을 반드시 준다.
        비활성은 --opacity-disabled 하나다.
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
      <h3 className={catalog.heading}>toolbar 최대 폭 — 기본 220 · width=&quot;wide&quot; 280(스튜디오 원본 선택)</h3>
      <div className={catalog.stack}>
        <ToolbarWidthDemo />
        <ToolbarWidthDemo width="wide" />
      </div>
    </div>
  );
}

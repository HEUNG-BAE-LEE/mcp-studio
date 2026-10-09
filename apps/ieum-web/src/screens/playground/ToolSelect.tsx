// 도구 고르기 — "도구" 칸의 select(옛 js/menu/playground.js:47). 원본 순서대로 원본 이름 optgroup, 그 안에 공개 대상 도구(제외만 빠진다).
// 공개 대상이 없는 원본도 빈 optgroup으로 남는다(옛 그대로). 옵션 글 = id + " (쓰기)" + " · 검토 중"(app/playground/view toolOptionLabel).
// 이름은 옛 aria-label "도구 선택" 그대로 두고 보이는 라벨은 id로 잇는다. 바꾸면 부르는 쪽이 결과를 비우고 주소를 replace로 바꾼다.
// 같은 도구 id가 여러 원본에 있으면 옛은 그 id의 옵션 모두에 selected를 달아 마지막 옵션이 골라져 보였다 — 도구 표(id → 마지막 도구)와
// 같은 쪽이다. React는 값이 같은 첫 옵션을 고르므로 그릴 때마다 마지막 옵션으로 옮긴다(값은 같다)
import { useLayoutEffect, useRef } from 'react';
import type { ToolGroup } from '../../app/playground/view';
import { PLAYGROUND } from '../../copy/playground';
import { Field, Select } from '@/ui';

const P = PLAYGROUND.tool;

type ToolSelectProps = Readonly<{
  groups: readonly ToolGroup[];
  /** 고른 도구 id */
  value: string;
  onPick: (toolId: string) => void;
}>;

export function ToolSelect({ groups, value, onPick }: ToolSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useLayoutEffect(() => {
    const select = selectRef.current;
    if (select === null) return;
    const last = Array.from(select.options, (option) => option.value).lastIndexOf(value);
    if (last >= 0 && select.selectedIndex !== last) select.selectedIndex = last;
  });

  return (
    <Field label={P.label}>
      {(control) => (
        <Select ref={selectRef} variant="form" id={control.id} aria-label={P.aria} value={value} onValueChange={onPick}>
          {groups.map((group) => (
            <optgroup key={group.sourceId} label={group.label}>
              {group.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}
    </Field>
  );
}

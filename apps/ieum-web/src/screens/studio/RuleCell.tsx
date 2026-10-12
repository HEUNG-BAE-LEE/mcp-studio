// 매핑 표의 변환 규칙 칸 — 규칙 선택(입력 9 · 응답 8) + 고른 규칙의 보조 칸(옛 ruleCell — js/menu/studio.js:13-24):
// 입력 행 자동 주입 → 고정값(v ?? ex ?? '') · 입력 행 날짜 → 원본 날짜 형식 · 코드값(두 표) → 코드표
// 선택지 밖 규칙(geo 등)은 첫 항목처럼 보이고 행의 규칙 값은 그대로다(ruleSelectValue — 옛 그대로). 보조 칸도 보이는 규칙을 따른다.
// 규칙을 바꾸면 타입 · 부가 값이 따라 바뀐다(applyRule). 코드표 칸은 입력 원문을 이 칸이 들고(쉼표 뒤 빈칸 등 저장 값과 글자가 다르다)
// 저장본 코드표로 설명 · 값 타입을 지켜 읽는다(parseCodes — 이식 기간 고침). 원문은 도구가 바뀌거나 다시 읽기 뒤에만 다시 채운다(상세 key)
import { useState } from 'react';
import type { CodeEntry, RuleName, Scalar } from '../../api/types';
import { ruleLabel } from '../../app/convert/ruleCounts';
import { applyRule, codesText, DATE_FMTS, parseCodes, RULE_OPTIONS, ruleSelectValue, type MapKind } from '../../app/studio/edit';
import { STUDIO } from '../../copy/studio';
import { Input, Select } from '@/ui';
import styles from './StudioScreen.module.css';

const R = STUDIO.ruleCell;

/** 두 매핑 행이 함께 가진 것 — 고정값 · 예시 · 원본 날짜 형식은 입력 행에만 있다 */
type CellRow = Readonly<{
  rule: RuleName;
  at: string;
  v?: Scalar;
  ex?: Scalar;
  ot?: string;
  codes?: readonly CodeEntry[];
}>;

type RuleCellProps<T extends CellRow> = Readonly<{
  kind: MapKind;
  /** 초안을 덮은 행 */
  row: T;
  /** 저장본(서버 도구) 같은 자리 행의 코드표 */
  savedCodes: readonly CodeEntry[] | undefined;
  /** 이 행을 바꾼다 */
  onEdit: (update: (row: T) => T) => void;
}>;

type CodesInputProps = Readonly<{
  codes: readonly CodeEntry[] | undefined;
  onText: (text: string) => void;
}>;

/** 코드표 칸 — 처음 글은 지금 코드표("원본=AI값"을 ", "로), 그 뒤로는 입력 원문 그대로 */
function CodesInput({ codes, onText }: CodesInputProps) {
  const [text, setText] = useState(() => codesText(codes));
  return (
    <Input
      variant="cell"
      mono
      className={styles.below}
      value={text}
      placeholder={R.codesPlaceholder}
      aria-label={R.codesLabel}
      onValueChange={(value) => {
        setText(value);
        onText(value);
      }}
    />
  );
}

export function RuleCell<T extends CellRow>({ kind, row, savedCodes, onEdit }: RuleCellProps<T>) {
  const shown = ruleSelectValue(kind, row.rule);
  const isParams = kind === 'params';
  return (
    <>
      <Select
        variant="cell"
        aria-label={R.ruleLabel}
        value={shown}
        onValueChange={(rule) => onEdit((r) => applyRule(kind, r, rule))}
      >
        {RULE_OPTIONS[kind].map((rule) => (
          <option key={rule} value={rule}>
            {ruleLabel(rule)}
          </option>
        ))}
      </Select>
      {isParams && shown === 'inject' ? (
        <Input
          variant="cell"
          mono
          className={styles.below}
          value={String(row.v ?? row.ex ?? '')}
          placeholder={R.injectPlaceholder}
          aria-label={R.injectLabel}
          onValueChange={(v) => onEdit((r) => ({ ...r, v }))}
        />
      ) : null}
      {isParams && shown === 'date' ? (
        <Select
          variant="cell"
          className={styles.below}
          aria-label={R.dateFmtLabel}
          value={row.ot ?? ''}
          onValueChange={(ot) => onEdit((r) => ({ ...r, ot }))}
        >
          {DATE_FMTS.map((fmt) => (
            <option key={fmt} value={fmt}>
              {fmt}
            </option>
          ))}
        </Select>
      ) : null}
      {shown === 'code' ? (
        <CodesInput codes={row.codes} onText={(text) => onEdit((r) => ({ ...r, codes: parseCodes(text, savedCodes) }))} />
      ) : null}
    </>
  );
}

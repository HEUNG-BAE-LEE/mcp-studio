// apps/web/src/screens/project/add-source/StepConnect.tsx — ② 담기: 모드 탭 · 수정 취소 · 담기(잠기면 primary + disabled · 사유 ReasonLine live reserve) · 첨부 상자 · 칸 grid(Field — 필수 required · 거부 사유 검증 문구, 1024는 1열) · 부를 때 정보(코드) + 바구니
import { useId, useRef, type ChangeEvent, type Dispatch } from 'react';
import { Button, Field, FileDrop, Input, ReasonLine, SectionHead, SegmentedControl } from '@/ui';
import type { SourceMode } from '../../../api/types';
import { useAppStore } from '../../../app/store';
import { ADD_SOURCE, fieldErrorText, formOf, type FieldCopy } from '../../../copy/addSource';
import { Basket } from './Basket';
import { MODES, missingOf, runtimeOf } from './model';
import { currentMode, currentValues, type FlowAction, type FlowState } from './useAddSource';
import styles from './flow.module.css';

const F = ADD_SOURCE.form;
const NO_ERRORS: Readonly<Record<string, string>> = {};
type GridProps = {
  fields: readonly FieldCopy[];
  values: Readonly<Record<string, string>>;
  /** 수정 중인 항목의 등록 거부 사유(칸 코드 → 사유 코드) */
  errors: Readonly<Record<string, string>>;
  onChange: (code: string) => (e: ChangeEvent<HTMLInputElement>) => void;
  prefix: string;
  /** 1024 — 칸 grid 1열 */
  narrow: boolean;
};
function FieldGrid({ fields, values, errors, onChange, prefix, narrow }: GridProps) {
  return (
    <div className={styles.grid} data-narrow={narrow || undefined}>
      {fields.map((f) => {
        const reason = errors[f.code];
        return (
          <Field
            key={f.code}
            className={styles.field}
            data-span={f.span}
            label={f.label}
            requirement={f.required ? 'required' : 'optional'}
            hint={f.required ? f.hint : undefined}
            message={reason !== undefined ? fieldErrorText(reason) : undefined}
          >
            <Input
              id={`${prefix}-${f.code}`}
              size="2xl"
              mono
              placeholder={f.placeholder}
              value={values[f.code] ?? ''}
              onChange={onChange(f.code)}
              required={f.required}
              aria-required={f.required || undefined}
            />
          </Field>
        );
      })}
    </div>
  );
}

export function StepConnect({
  state,
  dispatch,
}: {
  state: FlowState;
  dispatch: Dispatch<FlowAction>;
}) {
  const prefix = useId();
  const narrow = useAppStore((s) => s.narrow);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reasonId = `${prefix}-reason`;
  const runtimeTitleId = `${prefix}-runtime`;
  const type = state.type;
  if (!type) return null;
  const mode = currentMode(state);
  const fields = formOf(type, mode);
  const runtime = runtimeOf(type);
  const values = currentValues(state);
  const missing = missingOf(fields, values);
  const canAdd = missing.length === 0;
  const editing = state.editId !== null;
  const reason = canAdd ? undefined : F.missing(missing.map((f) => f.label));
  const errors = (state.editId !== null && state.fieldErrors[state.editId]) || NO_ERRORS;
  const set = (code: string) => (e: ChangeEvent<HTMLInputElement>) =>
    dispatch({ kind: 'field', code, value: e.target.value });
  // 담기 · 수정 반영 뒤 칸이 비고 버튼이 잠겨 포커스가 흐름 밖(body)으로 빠진다 —
  // 다음 항목을 적을 첫 칸으로 옮긴다(DESIGN 접근성 — 요청 중 · 완료 뒤)
  const add = () => {
    dispatch({ kind: 'add' });
    bodyRef.current?.querySelector('input')?.focus();
  };
  return (
    <div className={styles.connect}>
      <section className={styles.form} aria-label={ADD_SOURCE.types[type].name}>
        <div className={styles.formHead}>
          <div className={styles.formTools}>
            <SegmentedControl
              aria-label={ADD_SOURCE.card.fields}
              items={MODES[type].map((m) => ({ value: m, label: ADD_SOURCE.modes[m] }))}
              value={mode}
              onValueChange={(m) => dispatch({ kind: 'mode', mode: m as SourceMode })}
            />
            {editing ? (
              <Button
                variant="quiet"
                className={styles.push}
                onClick={() => dispatch({ kind: 'cancelEdit' })}
              >
                {F.cancelEdit}
              </Button>
            ) : null}
            <Button
              variant="primary"
              className={editing ? undefined : styles.push}
              disabled={!canAdd}
              aria-describedby={reason ? reasonId : undefined}
              onClick={add}
            >
              {editing ? F.update : F.add}
            </Button>
          </div>
          {/* 잠긴 이유(DESIGN 권한 — 영역 머리 · 발 밖의 액션). 칸을 채우면 바뀌어 live, 사유가 사라져도 한 줄 자리를 지켜 아래 칸이 뛰지 않는다(reserve) */}
          <ReasonLine id={reasonId} live reserve>
            {reason}
          </ReasonLine>
        </div>
        <div className={styles.formBody} ref={bodyRef}>
          <div className={styles.section}>
            {type === 'document' && mode === 'upload' ? (
              <FileDrop
                lines={F.drop.lines}
                formats={F.drop.formats}
                description={F.drop.description}
                multiple
                onFiles={(files) =>
                  dispatch({
                    kind: 'field',
                    code: 'files',
                    value: F.filesValue(files.map((f) => f.name)),
                  })
                }
              />
            ) : null}
            <FieldGrid
              fields={fields}
              values={values}
              errors={errors}
              onChange={set}
              prefix={prefix}
              narrow={narrow}
            />
          </div>
          {runtime.length > 0 ? (
            <section className={styles.section} aria-labelledby={runtimeTitleId}>
              <SectionHead as="h3" title={F.runtimeTitle} titleId={runtimeTitleId} />
              <FieldGrid
                fields={runtime}
                values={values}
                errors={errors}
                onChange={set}
                prefix={prefix}
                narrow={narrow}
              />
            </section>
          ) : null}
        </div>
      </section>
      <Basket state={state} dispatch={dispatch} />
    </div>
  );
}

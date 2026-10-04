// apps/web/src/screens/project/add-source/useAddSource.ts — 흐름 상태 순수 리듀서. 입력값 키 = `${type}:${mode}:${code}`
import type { SourceMode, SourceType } from '../../../api/types';
import { formOf } from '../../../copy/addSource';
import { MODES, missingOf, runtimeOf, type BasketItem, type FlowStep } from './model';
import type { ItemErrors } from './submitErrors';

export type FlowState = Readonly<{
  step: FlowStep;
  type: SourceType | null;
  modes: Readonly<Partial<Record<SourceType, SourceMode>>>;
  values: Readonly<Record<string, string>>;
  basket: readonly BasketItem[];
  editId: string | null;
  seq: number;
  chain: boolean;
  /** 담은 항목 id → 새 소스 id(pairCreated) */
  created: Readonly<Record<string, string>>;
  /** 등록 거부(400) 사유 — 담은 항목 id → 칸 코드 → 사유 코드 */
  fieldErrors: ItemErrors;
}>;
export type FlowAction =
  | { kind: 'pick'; type: SourceType }
  | { kind: 'next' }
  | { kind: 'back' }
  | { kind: 'mode'; mode: SourceMode }
  | { kind: 'field'; code: string; value: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'cancelEdit' }
  | { kind: 'remove'; id: string }
  | { kind: 'chain' }
  | { kind: 'submitted'; created: Readonly<Record<string, string>> }
  | { kind: 'rejected'; errors: ItemErrors };

export const INITIAL: FlowState = {
  step: 'type',
  type: null,
  modes: {},
  values: {},
  basket: [],
  editId: null,
  seq: 1,
  chain: true,
  created: {},
  fieldErrors: {},
};
/** 추적할 새 소스 id — 바구니 순서 */
export const createdIdsOf = (s: FlowState): readonly string[] =>
  s.basket.flatMap((b) => (s.created[b.id] ? [s.created[b.id] as string] : []));
const withoutErrors = (errors: ItemErrors, id: string | null): ItemErrors =>
  id === null ? errors : Object.fromEntries(Object.entries(errors).filter(([k]) => k !== id));
export const currentMode = (s: FlowState): SourceMode =>
  s.type ? (s.modes[s.type] ?? MODES[s.type][0] ?? 'url') : 'url';
const codesOf = (type: SourceType, mode: SourceMode) =>
  [...formOf(type, mode), ...runtimeOf(type)].map((f) => f.code);
const keyOf = (type: SourceType, mode: SourceMode, code: string) => `${type}:${mode}:${code}`;
/** 지금 폼(타입 · 모드)의 입력값 — 빈 칸은 빠진다 */
export function currentValues(s: FlowState): Readonly<Record<string, string>> {
  if (!s.type) return {};
  const { type } = s;
  const mode = currentMode(s);
  return Object.fromEntries(
    codesOf(type, mode).flatMap((c) => {
      const v = s.values[keyOf(type, mode, c)];
      return v ? [[c, v]] : [];
    }),
  );
}
const clearForm = (s: FlowState, type: SourceType, mode: SourceMode) => {
  const keys = new Set(codesOf(type, mode).map((c) => keyOf(type, mode, c)));
  return Object.fromEntries(Object.entries(s.values).filter(([k]) => !keys.has(k)));
};
export const isDirty = (s: FlowState) =>
  s.basket.length > 0 || Object.values(s.values).some((v) => v.trim() !== '');

export function reduce(s: FlowState, a: FlowAction): FlowState {
  const type = s.type;
  const mode = currentMode(s);
  switch (a.kind) {
    case 'pick':
      return a.type === type
        ? s
        : {
            ...s,
            type: a.type,
            modes: {},
            values: {},
            basket: [],
            editId: null,
            fieldErrors: {},
          };
    case 'next':
      return s.step === 'type' && type ? { ...s, step: 'connect' } : s;
    case 'back':
      return s.step === 'connect' ? { ...s, step: 'type', editId: null } : s;
    case 'mode':
      return type ? { ...s, modes: { ...s.modes, [type]: a.mode }, editId: null } : s;
    case 'field':
      return type ? { ...s, values: { ...s.values, [keyOf(type, mode, a.code)]: a.value } } : s;
    case 'add': {
      if (!type) return s;
      const values = Object.fromEntries(
        Object.entries(currentValues(s)).flatMap(([c, v]) => (v.trim() ? [[c, v.trim()]] : [])),
      );
      if (missingOf(formOf(type, mode), values).length > 0) return s;
      const item: BasketItem = { id: s.editId ?? `s${s.seq}`, type, mode, values };
      const basket = s.editId
        ? s.basket.map((b) => (b.id === s.editId ? item : b))
        : [...s.basket, item];
      return {
        ...s,
        basket,
        values: clearForm(s, type, mode),
        editId: null,
        seq: s.seq + 1,
        fieldErrors: withoutErrors(s.fieldErrors, s.editId),
      };
    }
    case 'edit': {
      const item = s.basket.find((b) => b.id === a.id);
      if (!item) return s;
      const loaded = Object.fromEntries(
        codesOf(item.type, item.mode).map((c) => [
          keyOf(item.type, item.mode, c),
          item.values[c] ?? '',
        ]),
      );
      return {
        ...s,
        values: { ...s.values, ...loaded },
        editId: item.id,
        modes: { ...s.modes, [item.type]: item.mode },
      };
    }
    case 'cancelEdit':
      return type ? { ...s, values: clearForm(s, type, mode), editId: null } : s;
    case 'remove':
      return {
        ...s,
        basket: s.basket.filter((b) => b.id !== a.id),
        editId: s.editId === a.id ? null : s.editId,
        fieldErrors: withoutErrors(s.fieldErrors, a.id),
      };
    case 'chain':
      return { ...s, chain: !s.chain };
    case 'submitted':
      return { ...s, step: 'run', created: a.created, fieldErrors: {} };
    case 'rejected':
      return { ...s, fieldErrors: a.errors };
    default:
      return s;
  }
}

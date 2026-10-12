// 스튜디오 편집 규칙 — 매핑 표 인라인 편집(옛 editMap · mrule — js/menu/studio.js:193-215)과 상세 동작(:160-163,183,189)이
// 초안에 더할 값을 만든다. 모두 받은 행 · 도구를 고치지 않고 새 객체를 돌려준다. 초안에 넣는 일은 drafts.editDraft가 한다:
//   editDraft(tool, (view) => editParamRow(view, i, (row) => applyRule('params', row, rule)))
// 입력 검증은 두지 않는다(이름 비움 · 겹침 · 한도 0 — 옛 그대로)
import type { CodeEntry, ExecMode, RuleName, Scalar, Tool, ToolParam, ToolResField } from '../../api/types';
import { OFF_REASON_DEFAULT } from '../../copy/studio';
import { isHiddenRule } from '../convert/visibleParams';
import type { DraftPatch } from './drafts';

/** 매핑 표 종류 — 입력 파라미터 · 응답 필드 */
export type MapKind = 'params' | 'res';

/** 날짜 규칙의 원본 날짜 형식 선택지(studio.js:14) */
export const DATE_FMTS = ['YYYYMMDD', 'YYYYMM', 'YYYY', 'MM', 'epoch'] as const;
const DEFAULT_DATE_FMT = DATE_FMTS[0];

/** 규칙 select 선택지(studio.js:17). 라벨은 copy/trace RULES */
export const RULE_OPTIONS: Readonly<Record<MapKind, readonly RuleName[]>> = Object.freeze({
  params: ['name', 'keep', 'date', 'time', 'num', 'code', 'pad', 'inject', 'ctx'],
  res: ['name', 'keep', 'date', 'time', 'num', 'code', 'strip', 'mask'],
});

/** select가 보일 값 — 선택지 밖 규칙은 첫 항목처럼 보이고 행의 규칙 값은 그대로 둔다(studio.js:18) */
export function ruleSelectValue(kind: MapKind, rule: RuleName): RuleName {
  const options = RULE_OPTIONS[kind];
  return options.includes(rule) ? rule : (options[0] ?? rule);
}

/** 규칙을 고르면 바뀌는 AI 타입(studio.js:194). 되돌려도 타입은 복원하지 않는다 */
const TYPE_BY_RULE: Readonly<Record<string, string>> = Object.freeze({
  date: 'string (date)',
  num: 'number',
  time: 'string',
  code: 'string',
  pad: 'string',
});

const typeOfRule = (rule: RuleName): string | undefined =>
  Object.hasOwn(TYPE_BY_RULE, rule) ? TYPE_BY_RULE[rule] : undefined;

/** 두 매핑 행이 함께 가진 모양 — 입력 행에만 있는 값(v · ex · ot)은 응답 행에서 비어 있다 */
type MapRow = Readonly<{ rule: RuleName; at: string; v?: Scalar; ex?: Scalar; ot?: string; codes?: readonly CodeEntry[] }>;

const isDateFmt = (value: string | undefined): boolean => (DATE_FMTS as readonly (string | undefined)[]).includes(value);

/**
 * 규칙을 바꾼 행(studio.js:205-212): AI 타입(입력 행은 숨김 규칙이 아닐 때만) · 자동 주입이면 고정값(v가 없을 때 ex 또는 '') ·
 * 입력 행의 날짜면 원본 형식(목록 밖이면 YYYYMMDD) · 코드값이면 빈 코드표(없을 때). 이전 규칙의 부가 값은 지우지 않는다
 */
export function applyRule<T extends MapRow>(kind: MapKind, row: T, rule: RuleName): T {
  const at = typeOfRule(rule);
  const setsType = at !== undefined && (kind === 'res' || !isHiddenRule(rule));
  const injects = rule === 'inject' && row.v === undefined;
  const datesOrigin = rule === 'date' && kind === 'params' && !isDateFmt(row.ot);
  const startsCodes = rule === 'code' && !row.codes;
  return {
    ...row,
    rule,
    ...(setsType ? { at } : {}),
    ...(injects ? { v: row.ex ?? '' } : {}),
    ...(datesOrigin ? { ot: DEFAULT_DATE_FMT } : {}),
    ...(startsCodes ? { codes: [] } : {}),
  };
}

/** 입력 매핑 index번째 행을 바꾼 초안 값 */
export const editParamRow = (view: Tool, index: number, update: (row: ToolParam) => ToolParam): DraftPatch => ({
  params: view.params.map((p, i) => (i === index ? update(p) : p)),
});

/** 응답 매핑 index번째 행을 바꾼 초안 값 */
export const editResRow = (view: Tool, index: number, update: (row: ToolResField) => ToolResField): DraftPatch => ({
  res: view.res.map((r, i) => (i === index ? update(r) : r)),
});

// ── 코드표 · 한도 입력 ──

/** 코드표 칸에 처음 보일 글 — "원본=AI값"을 ", "로 잇는다(studio.js:15) */
export const codesText = (codes: readonly CodeEntry[] | undefined): string =>
  (codes ?? []).map(([origin, ai]) => `${origin}=${ai}`).join(', ');

/**
 * 코드표 칸의 글을 코드표로(studio.js:197): 쉼표로 나누고 앞뒤 공백을 뺀 빈 조각은 버리고, "="이 없으면 AI값 = 원본값, 오른쪽이 비면 빈 AI값.
 * saved는 **저장본**(서버 도구) 그 행의 코드표다 — 같은 원본값의 저장본 항목이 있으면 설명(세 번째 값)을 남기고, AI값 글자가
 * 저장본 AI값의 글자와 같으면 저장본 값(불리언 · 숫자 타입)을 남긴다. 옛은 키 입력마다 다시 읽어 설명을 지우고 불리언을 글자로 바꿨다
 * (`Y=true` → `Y=tru` → `Y=true`로 고쳐 쳐도 되돌아오지 않았다)
 */
export function parseCodes(text: string, saved: readonly CodeEntry[] | undefined): readonly CodeEntry[] {
  return text
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece): CodeEntry => {
      const [origin = '', aiText] = piece.split('=').map((part) => part.trim());
      const ai = aiText ?? origin;
      const prev = saved?.find(([savedOrigin]) => String(savedOrigin) === origin);
      if (prev === undefined) return [origin, ai, ''];
      const [, savedAi, savedNote] = prev;
      return [origin, ai === String(savedAi) ? savedAi : ai, savedNote ?? ''];
    });
}

/** 분당 호출 한도 칸 → 저장 값. 숫자가 아니거나 0이면 1(옛 `+value || 1` — studio.js:183). 범위는 고치지 않는다 */
export const parseLimit = (text: string): number => Number(text) || 1;

// ── 상세 동작(알림 띠 버튼 · 공개 스위치 · 실행 방식) ──

/** "새 필드로 매핑" — drift 표시가 있는 모든 응답 행을 고친 것으로, 상태는 공개(studio.js:160) */
export const fixDriftPatch = (view: Tool): DraftPatch => ({
  res: view.res.map((r) => (r.drift ? { ...r, fixed: true } : r)),
  status: 'done',
});

const withoutGuess = (r: ToolResField): ToolResField => {
  if (!Object.hasOwn(r, 'guess')) return r;
  const { guess: _guess, ...rest } = r;
  return rest;
};

/** "검토 완료" · "확인 완료" — 상태는 공개, 응답 행의 추정 표시만 지운다(도구의 guess · disc는 둔다 — studio.js:161) */
export const reviewDonePatch = (view: Tool): DraftPatch => ({ status: 'done', res: view.res.map(withoutGuess) });

/** "다시 포함" · "확인했고 계속 공개"(studio.js:162) */
export const includePatch = (): DraftPatch => ({ status: 'done' });

/** 공개 스위치 — 끌 때 사유가 비어 있으면 기본 사유(저장되는 값 — studio.js:189) */
export function publishPatch(view: Tool, on: boolean): DraftPatch {
  if (on) return { status: 'done' };
  return view.offReason ? { status: 'off' } : { status: 'off', offReason: OFF_REASON_DEFAULT };
}

/** 실행 방식 — 쓰기 도구는 바로 실행을 고를 수 없다(null = 바꾸지 않음 — studio.js:163) */
export const execPatch = (view: Tool, exec: ExecMode): DraftPatch | null =>
  view.mode === 'write' && exec === 'auto' ? null : { exec };

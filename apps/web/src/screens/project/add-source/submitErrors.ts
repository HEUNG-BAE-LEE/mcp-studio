// apps/web/src/screens/project/add-source/submitErrors.ts — 배치 POST 400의 fields(`items.N.config.code` · `items.N.runtime.code` · `items.N.name`)를 담은 항목 id · 칸 코드로 되돌린다. 칸으로 못 가면 폼 밖 오류(ErrorBlock)
import { ApiError } from '@/api/errors';
import { formOf } from '../../../copy/addSource';
import { runtimeOf, type BasketItem } from './model';

/** 담은 항목 id → 칸 코드 → 사유 코드 */
export type ItemErrors = Readonly<Record<string, Readonly<Record<string, string>>>>;
type SubmitErrors = Readonly<{ byItem: ItemErrors; hasUnmapped: boolean }>;
const ITEM_PATH = /^items\.(\d+)\.(?:(?:config|runtime)\.([^.]+)|(name))$/;

const codesOf = (item: BasketItem) =>
  [...formOf(item.type, item.mode), ...runtimeOf(item.type)].map((f) => f.code);

/** 경로 하나 → [항목 id, 칸 코드]. 칸으로 못 가면 null */
function targetOf(path: string, basket: readonly BasketItem[]): readonly [string, string] | null {
  const match = ITEM_PATH.exec(path);
  if (!match) return null;
  const item = basket[Number(match[1])];
  const code = match[2] ?? match[3];
  if (!item || !code || !codesOf(item).includes(code)) return null;
  return [item.id, code];
}

export function submitErrorsOf(error: unknown, basket: readonly BasketItem[]): SubmitErrors {
  const fields = error instanceof ApiError ? (error.fields ?? {}) : {};
  if (Object.keys(fields).length === 0) return { byItem: {}, hasUnmapped: true };
  return Object.entries(fields).reduce<SubmitErrors>(
    (acc, [path, reason]) => {
      const target = targetOf(path, basket);
      if (!target) return { ...acc, hasUnmapped: true };
      const [id, code] = target;
      return { ...acc, byItem: { ...acc.byItem, [id]: { ...acc.byItem[id], [code]: reason } } };
    },
    { byItem: {}, hasUnmapped: false },
  );
}

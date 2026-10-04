// apps/web/src/screens/dashboard/asOfMeta.ts — 기준 줄을 PageHeader `meta`로: `기준 {MM.DD HH:mm · 최근 7일}` / 호출이 없으면 사유 문구만
import type { UsageRange } from '../../api/types';
import { DASHBOARD, usageRangeLabel } from '../../copy/dashboard';
import { shortDateTimeLabel } from '../../copy/time';
import type { PageHeaderMeta } from '@/ui';

export const asOfMeta = (
  asOf: string,
  range: UsageRange,
  hasCalls: boolean,
): readonly PageHeaderMeta[] =>
  hasCalls
    ? [
        {
          label: DASHBOARD.asOfLabel,
          value: `${shortDateTimeLabel(asOf)} · ${usageRangeLabel(range)}`,
        },
      ]
    : [{ label: DASHBOARD.asOfNone, value: '' }];

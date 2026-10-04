// apps/web/src/copy/list.ts — 목록 공용 문구 틀(영역 머리 수 · 필터 0건). 화면마다 다른 대상 이름은 호출자가 준다
import { countUnitLabel } from './format';

/** 영역 머리 수(SectionHead `count`): 전부면 `3`, 걸러지면 `1 / 3` */
export const countLabel = (shown: number, total: number) =>
  shown === total ? String(total) : `${shown} / ${total}`;
/** EmptyState filtered 한 줄: `조건에 맞는 소스가 없다 · 3건 가운데 0건`. 조사(`가`)를 포함한 대상은 호출자가 준다 */
export const noMatchLabel = (subject: string, total: number) =>
  `조건에 맞는 ${subject} 없다 · ${countUnitLabel(total, '건')} 가운데 0건`;

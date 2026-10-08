// 시간대별 호출 막대 그래프의 좌표 계산 — 옛 js/menu/dashboard.js:31-41 식 그대로. 그리는 일은 HourlyChart가 한다
// 좌표는 SVG 속성(viewBox 안 숫자)이라 스타일이 아니다. 계산 순서도 옛과 같게 둔다(부동소수 결과가 같아야 막대 위치가 같다)
import type { HourlyBucket } from '../../api/types';

/** SVG 좌표계 — 옛 720 × 190, 왼쪽 눈금 40 · 아래 시각 24 · 위 10 */
export const CHART = Object.freeze({ width: 720, height: 190, left: 40, bottom: 24, top: 10 });

/** 눈금 글자 · 시각 글자의 자리(옛 눈금 x = left − 8, 눈금 글자 y = 선 y + 4, 시각 글자 y = height − 6) */
export const TICK_LABEL = Object.freeze({ gap: 8, baseline: 4 });
export const HOUR_LABEL_RISE = 6;

// 하루 24칸 — 막대 한 칸의 폭은 받은 칸 수가 아니라 이 값으로 나눈다(옛 그대로)
const SLOTS = 24;
const RIGHT_GAP = 6;
// 가로 눈금 선은 0 ~ 4(다섯 줄)이고, 맨 위 눈금은 가장 높은 막대를 4의 배수로 올려 잡는다
const GRID_STEPS = 4;
const SLOT_INSET = 3;
// 칸 안에서 막대가 차지하는 자리(왼쪽에서 18%, 폭 64% — 가운데)
const BAR_START = 0.18;
const BAR_SPAN = 0.64;
// 시각 글자는 세 칸마다(2, 5, 8 … 번째 칸)
const LABEL_EVERY = 3;
const LABEL_PHASE = 2;
// 실패 조각은 높이가 0.5 이상일 때만 그리고, 그릴 때 최소 1.5로 보인다
const FAIL_MIN_VISIBLE = 0.5;
const FAIL_MIN_HEIGHT = 1.5;

export type ChartTick = Readonly<{ index: number; y: number; value: number }>;

export type ChartBar = Readonly<{
  slot: number;
  hour: number;
  calls: number;
  errors: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 실패 조각 높이 — 그리지 않으면 null */
  failHeight: number | null;
  /** 시각 글자 가운데 x — 글자가 없는 칸은 null */
  hourLabelX: number | null;
}>;

export type HourlyChartModel = Readonly<{ ticks: readonly ChartTick[]; bars: readonly ChartBar[] }>;

export function buildHourlyChart(hourly: readonly HourlyBucket[]): HourlyChartModel {
  const { width, height, left, bottom, top } = CHART;
  const plotHeight = height - top - bottom;
  const peak = Math.max(...hourly.map((b) => b.calls), 1);
  const max = Math.max(GRID_STEPS, Math.ceil(peak / GRID_STEPS) * GRID_STEPS);
  const slotWidth = (width - left - RIGHT_GAP) / SLOTS;

  const ticks = Array.from({ length: GRID_STEPS + 1 }, (_, index) => ({
    index,
    y: top + plotHeight * (1 - index / GRID_STEPS),
    value: (max * index) / GRID_STEPS,
  }));

  const bars = hourly.map((bucket, slot): ChartBar => {
    const slotX = left + SLOT_INSET + slot * slotWidth;
    const barHeight = (plotHeight * bucket.calls) / max;
    const failHeight = (plotHeight * bucket.errors) / max;
    return {
      slot,
      hour: bucket.hour,
      calls: bucket.calls,
      errors: bucket.errors,
      x: slotX + slotWidth * BAR_START,
      y: height - bottom - barHeight,
      width: slotWidth * BAR_SPAN,
      height: barHeight,
      failHeight: failHeight >= FAIL_MIN_VISIBLE ? Math.max(failHeight, FAIL_MIN_HEIGHT) : null,
      hourLabelX: slot % LABEL_EVERY === LABEL_PHASE ? slotX + slotWidth / 2 : null,
    };
  });

  return { ticks, bars };
}

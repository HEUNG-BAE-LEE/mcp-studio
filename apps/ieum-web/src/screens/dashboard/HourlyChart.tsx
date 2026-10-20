// HourlyChart — 최근 24시간 시간대별 호출 막대 그래프(SVG 24막대 + 범례 + 시각 숨김 표). 옛 js/menu/dashboard.js:31-44
// 막대 값은 옛에 마우스 툴팁(<title>)뿐이었다 — 같은 값을 시각 숨김 표로 더한다(보이는 차이 0). 호출 수는 천 단위 쉼표, 실패 수는 원값(옛 그대로)
import { Fragment } from 'react';
import type { HourlyBucket } from '../../api/types';
import { DASH } from '../../copy/dashboard-logs';
import { fmtNum } from '../../copy/format';
import { VisuallyHidden } from '@/ui';
import { buildHourlyChart, CHART, HOUR_LABEL_RISE, TICK_LABEL, type ChartBar } from './hourlyGeometry';
import styles from './HourlyChart.module.css';

function HourlyBar({ bar }: { bar: ChartBar }) {
  const { x, y, width, height, failHeight, hourLabelX } = bar;
  return (
    <>
      <rect className={styles.bar} x={x} y={y} width={width} height={height} rx={2}>
        <title>{DASH.chart.barTitle(bar.hour, bar.calls, bar.errors)}</title>
      </rect>
      {failHeight !== null && <rect className={styles.barFail} x={x} y={y} width={width} height={failHeight} rx={1} />}
      {hourLabelX !== null && (
        <text className={styles.axisLabel} x={hourLabelX} y={CHART.height - HOUR_LABEL_RISE} textAnchor="middle">
          {DASH.chart.hour(bar.hour)}
        </text>
      )}
    </>
  );
}

function ValueTable({ bars }: { bars: readonly ChartBar[] }) {
  const { caption, hour, calls, errors } = DASH.chart.table;
  return (
    <VisuallyHidden as="div">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{hour}</th>
            <th scope="col">{calls}</th>
            <th scope="col">{errors}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.slot}>
              <th scope="row">{bar.hour}</th>
              <td>{fmtNum(bar.calls)}</td>
              <td>{bar.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </VisuallyHidden>
  );
}

export function HourlyChart({ hourly }: { hourly: readonly HourlyBucket[] }) {
  const { ticks, bars } = buildHourlyChart(hourly);
  return (
    <>
      <div className={styles.chart}>
        <svg className={styles.svg} viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={DASH.chart.aria}>
          {ticks.map((tick) => (
            <Fragment key={tick.index}>
              <line className={styles.gridLine} x1={CHART.left} x2={CHART.width} y1={tick.y} y2={tick.y} />
              <text
                className={styles.axisLabel}
                x={CHART.left - TICK_LABEL.gap}
                y={tick.y + TICK_LABEL.baseline}
                textAnchor="end"
              >
                {fmtNum(tick.value)}
              </text>
            </Fragment>
          ))}
          {bars.map((bar) => (
            <HourlyBar key={bar.slot} bar={bar} />
          ))}
        </svg>
        <ValueTable bars={bars} />
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-tone="ok" aria-hidden="true" />
          {DASH.chart.legendOk}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-tone="fail" aria-hidden="true" />
          {DASH.chart.legendErr}
        </span>
      </div>
    </>
  );
}

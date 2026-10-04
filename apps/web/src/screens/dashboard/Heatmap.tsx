// apps/web/src/screens/dashboard/Heatmap.tsx — 요일 × 시간대 히트맵: div 격자, 셀은 ink를 밀도 %만큼 섞은 명도. 값은 서버 밀도 0–1
import { useId, type CSSProperties } from 'react';
import type { DashboardHeatmap } from '../../api/types';
import { Region, SectionHead } from '@/ui';
import { DASHBOARD, formatHeatmapNote, hourLabel, weekdayLabel } from '../../copy/dashboard';
import styles from './Heatmap.module.css';

const PERCENT = 100;
/** 셀 style — CSS 변수는 CSSProperties에 없어 교차 타입으로 받는다 */
type HeatStyle = CSSProperties & Record<'--heat', string>;
/** 0.45 → `--heat: 45%` — CSS color-mix가 ink를 그 비율로 섞는다 */
const densityStyle = (density: number): HeatStyle => ({
  '--heat': `${Math.round(density * PERCENT)}%`,
});

type Props = {
  heatmap: DashboardHeatmap;
  period: { from: string; to: string };
  hasCalls: boolean;
};

export function Heatmap({ heatmap, period, hasCalls }: Props) {
  const titleId = useId();
  return (
    <Region aria-labelledby={titleId}>
      <SectionHead
        title={DASHBOARD.heatmapTitle}
        titleId={titleId}
        note={formatHeatmapNote(period, hasCalls)}
      />
      {/* 셀은 색뿐이라 격자 전체를 그림 하나로 읽힌다(값은 서버 밀도 — 표로 옮길 수치가 없다) */}
      <div className={styles.grid} role="img" aria-label={DASHBOARD.heatmapAlt}>
        <div className={styles.hours}>
          <span />
          {heatmap.hours.map((hour) => (
            <span key={hour} className={styles.hour}>
              {hourLabel(hour)}
            </span>
          ))}
        </div>
        {heatmap.rows.map((row) => (
          <div key={row.weekday} className={styles.row}>
            <span className={styles.day}>{weekdayLabel(row.weekday)}</span>
            {row.cells.map((density, i) => (
              <span
                key={heatmap.hours[i] ?? i}
                className={styles.cell}
                style={densityStyle(density)}
              />
            ))}
          </div>
        ))}
      </div>
    </Region>
  );
}

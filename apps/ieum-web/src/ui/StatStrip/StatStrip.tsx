// StatStrip — 화면 머리 아래 수치 띠. 대시보드 KPI 5칸(.kpi css/console.css:530-537)과 탐색 실시간 6칸(.dk css/console.css:953-958)은 같은 모양이라 하나로 둔다.
// 서식 · 값 없음 표기는 쓰는 곳(copy/)이 정한다. 증감 아이콘은 장식 — 방향은 아이콘 곁의 시각 숨김 글자(▲ · ▼)와 글자(text)가 전한다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon } from '../icons/Icon';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './StatStrip.module.css';

export type StatTrend = {
  direction: 'up' | 'down';
  text: ReactNode;
};

/** 방향 글자 — 옛 js/menu/dashboard.js:9-15가 그린 글자. 아이콘은 장식이라 보조기기에는 이 글자가 방향을 읽힌다 */
const TREND_GLYPH: Readonly<Record<StatTrend['direction'], string>> = { up: '▲', down: '▼' };

export type StatItem = {
  /** 칸 이름 */
  label: ReactNode;
  /** 수치 */
  value: ReactNode;
  /** 수치 뒤 단위. 값이 없으면 넘기지 않는다 */
  unit?: ReactNode;
  /** 수치 색 — danger = 차단 수, primary = 강조 수치(발견한 API 후보) */
  tone?: 'danger' | 'primary';
  /** 보조 줄 앞 증감 — up만 --ok 굵게 */
  trend?: StatTrend;
  /** 보조 줄 */
  description?: ReactNode;
};

export type StatStripFailure = {
  /** 0부터 센 칸 번호 — 이 칸부터 끝까지를 그리지 않고 content 하나를 둔다 */
  from: number;
  content: ReactNode;
};

export type StatStripProps = {
  /** 칸 수. 6은 칸 여백 · 글자가 한 단계 작은 탐색 띠 */
  columns: 5 | 6;
  items: readonly StatItem[];
  /** 영역 실패 — 기본 열 수에서는 가려진 칸들의 열을, 1100 이하에서는 한 줄을 다 쓴다 */
  failure?: StatStripFailure;
  /** 배치(바깥 여백)만 */
  className?: string;
};

function Cell({ item }: { item: StatItem }) {
  const { label, value, unit, tone, trend, description } = item;
  const hasNote = trend !== undefined || description !== undefined;
  return (
    <div className={styles.cell}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} data-tone={tone}>
        {value}
        {unit !== undefined && <small className={styles.unit}>{unit}</small>}
      </span>
      {hasNote && (
        <span className={styles.note}>
          {trend && (
            <span className={styles.trend} data-direction={trend.direction}>
              <Icon name={trend.direction === 'up' ? 'arrow-up' : 'arrow-down'} size="sm" />
              <VisuallyHidden>{TREND_GLYPH[trend.direction]}</VisuallyHidden>
              {trend.text}
            </span>
          )}
          {description !== undefined && <span className={styles.description}>{description}</span>}
        </span>
      )}
    </div>
  );
}

export function StatStrip({ columns, items, failure, className }: StatStripProps) {
  const shown = failure ? items.slice(0, failure.from) : items;
  const failureSpan = failure ? columns - shown.length : 0;
  return (
    <div className={cx(styles.root, className)} data-columns={columns}>
      {shown.map((item, index) => (
        <Cell key={index} item={item} />
      ))}
      {failure && (
        <div className={styles.failure} style={{ '--failure-span': failureSpan }}>
          {failure.content}
        </div>
      )}
    </div>
  );
}

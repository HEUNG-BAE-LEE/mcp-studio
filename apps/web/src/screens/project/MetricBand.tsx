// apps/web/src/screens/project/MetricBand.tsx — 요약 밴드: 4열 grid gap 10 × MetricCard 8(1024에서도 4열)
import { MetricCard } from '@/ui';
import type { ProjectSummary } from '../../api/types';
import { PROJECT } from '../../copy/project';
import { toMetricCards } from './metrics';
import styles from './MetricBand.module.css';

export function MetricBand({
  summary,
  hasSources,
}: {
  summary: ProjectSummary;
  hasSources: boolean;
}) {
  return (
    <div className={styles.band} role="group" aria-label={PROJECT.metricsTitle}>
      {toMetricCards(summary, hasSources).map(({ key, ...card }) => (
        <MetricCard key={key} {...card} />
      ))}
    </div>
  );
}

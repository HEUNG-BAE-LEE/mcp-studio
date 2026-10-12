// VennSummary — 결과 요약 왼쪽 상자 "찾은 API N개"(범위 밖 제외 — 옛 :289,306-310). 벤 그림 + 범례 세 줄
// 벤 그림: 두 원(Git 소스 · 운영 트래픽)과 세 영역의 수 · 이름. 영역을 누르면 그 필터로 걸러지고 같은 영역을 다시 누르면 전체(옛 dfilter :398).
// 고른 영역은 수 · 이름이 주조색 굵게. 영역은 키보드 대상이 아니다 — 같은 필터가 필터 칩으로 닿는다(이식 기간 보존). 그림 전체는 이름 붙은 그림(role="img")
import type { ResultCounts, ResultFilter } from '../../app/discovery/results';
import { DISCOVERY } from '../../copy/discovery';
import { Box } from '@/ui';
import { EmphasisText } from '../../app/discovery/CopyParts';
import styles from './VennSummary.module.css';

const K = DISCOVERY.result;

type VennZone = 'src' | 'both' | 'tr';
/** 영역 글자 자리 — 옛 svg 좌표 그대로(:292-295) */
const ZONES: readonly Readonly<{ zone: VennZone; x: number }>[] = [
  { zone: 'src', x: 82 },
  { zone: 'both', x: 160 },
  { zone: 'tr', x: 238 },
];

type VennSummaryProps = Readonly<{
  counts: ResultCounts;
  filter: ResultFilter;
  onFilter: (filter: ResultFilter) => void;
}>;

function VennChart({ counts, filter, onFilter }: VennSummaryProps) {
  return (
    <svg viewBox="0 0 320 170" className={styles.venn} role="img" aria-label={K.vennAria(counts.src, counts.both, counts.tr)}>
      <circle cx="118" cy="85" r="72" className={styles.source} />
      <circle cx="202" cy="85" r="72" className={styles.traffic} />
      {ZONES.map(({ zone, x }) => (
        // 영역 클릭 필터는 마우스 보조다 — 같은 필터가 칩 버튼으로 키보드에 닿는다(옛 그대로 · 이식 기간 보존)
        <g key={zone} className={styles.zone} data-state={filter === zone ? 'on' : 'off'} onClick={() => onFilter(zone)}>
          <text x={x} y="82" className={styles.count}>
            {counts[zone]}
          </text>
          <text x={x} y="102" className={styles.label}>
            {K.venn[zone]}
          </text>
        </g>
      ))}
      <text x="70" y="16" className={styles.head}>
        {K.venn.srcHead}
      </text>
      <text x="250" y="16" className={styles.head}>
        {K.venn.trHead}
      </text>
    </svg>
  );
}

export function VennSummary(props: VennSummaryProps) {
  const { counts } = props;
  return (
    <Box title={K.foundTitle(counts.found)} description={K.vennHint}>
      <div className={styles.body}>
        <VennChart {...props} />
        <ul className={styles.legend}>
          <li>
            <EmphasisText parts={K.legend.both(counts.both)} />
          </li>
          <li>
            <EmphasisText parts={K.legend.src(counts.src)} />
          </li>
          <li>
            <EmphasisText parts={K.legend.tr(counts.tr)} />
          </li>
        </ul>
      </div>
    </Box>
  );
}

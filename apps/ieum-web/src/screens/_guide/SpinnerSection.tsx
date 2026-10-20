// 카탈로그 Spinner 절 — 크기(md · lg) × 자리(혼자 · 글자 곁). 상태는 없다(장식) — 모션 줄이기면 멈춘 원이다
import { Spinner, type SpinnerSize } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SpinnerSection.module.css';

const SIZES: readonly { size: SpinnerSize; note: string }[] = [
  { size: 'md', note: 'md — 16 · 테 --bw-strong(배포 진행 안내 · 탐색 현재 동작 줄)' },
  { size: 'lg', note: 'lg — 22 · 테 --bw-dashed(연결 분석 진행 칸 — ProgressList 안)' },
];

export function SpinnerSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        --primary 테 · 위쪽만 투명 · --m-spin 한 바퀴 반복(이음 그대로 유지하는 반복 모션). 장식(aria-hidden)이라 진행은 곁의 글자가
        전한다. 모션 줄이기를 켜면 멈춘 원이다.
      </p>
      {SIZES.map(({ size, note }) => (
        <div key={size} className={catalog.stack}>
          <h3 className={catalog.heading}>{note}</h3>
          <div className={catalog.row}>
            <Spinner size={size} />
            <span className={styles.beside}>
              <Spinner size={size} />
              서버를 배포하는 중입니다.
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

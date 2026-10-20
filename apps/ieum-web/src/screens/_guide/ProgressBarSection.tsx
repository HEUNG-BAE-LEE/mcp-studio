// 카탈로그 ProgressBar 절 — 변형(meter · progress) × 비율(0 · 일부 · 1 · 범위 밖). 막대는 장식이라 곁에 비율 글자를 둔다
import { ProgressBar, type ProgressBarVariant } from '../../ui';
import catalog from './catalog.module.css';
import styles from './ProgressBarSection.module.css';

const VARIANTS: readonly { variant: ProgressBarVariant; note: string }[] = [
  { variant: 'meter', note: 'meter — 채움 --tool(도구 비율)' },
  { variant: 'progress', note: 'progress — 채움 --primary + 폭 전환(분석 진행)' },
];

const VALUES: readonly { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 0.35, label: '0.35' },
  { value: 0.8, label: '0.8' },
  { value: 1, label: '1' },
  { value: 1.7, label: '1.7 (1로 자른다)' },
  { value: -0.4, label: '-0.4 (0으로 자른다)' },
  { value: Number.NaN, label: 'NaN (0으로 그린다)' },
];

export function ProgressBarSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>비율은 0 ~ 1이고 밖의 값 · NaN은 잘라 그린다. 폭은 쓰는 곳이 정한다(여기서는 상자 폭).</p>
      {VARIANTS.map(({ variant, note }) => (
        <div key={variant} className={catalog.stack}>
          <h3 className={catalog.heading}>{note}</h3>
          {VALUES.map(({ value, label }) => (
            <div key={label} className={styles.line}>
              <code className={styles.label}>{label}</code>
              <ProgressBar variant={variant} value={value} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

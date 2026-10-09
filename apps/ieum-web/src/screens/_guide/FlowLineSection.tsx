// 카탈로그 FlowLine 절 — verticalAt 1100(구조도) · 760(파이프라인). 뷰어 폭을 1100 · 760 이하로 바꾸면 그 줄만 세로로 선다
import { FlowLine, type FlowLineBreakpoint } from '../../ui';
import catalog from './catalog.module.css';
import styles from './FlowLineSection.module.css';

const BREAKPOINTS: readonly FlowLineBreakpoint[] = [1100, 760];

export function FlowLineSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        부모 칸(position: relative)의 가운데를 가로지르는 --primary 점선 · --opacity-flow · --m-flow 반복 흐름. 장식(aria-hidden)이고
        뜻은 곁의 라벨 글자가 전한다. verticalAt 폭 이하에서 세로로 서고, 모션 줄이기면 멈춘 점선이다.
      </p>
      {BREAKPOINTS.map((breakpoint) => (
        <div key={breakpoint} className={catalog.stack}>
          <h3 className={catalog.heading}>verticalAt={breakpoint}</h3>
          <div className={styles.pipe}>
            <div className={styles.cell}>A</div>
            <div className={styles.link}>
              <FlowLine verticalAt={breakpoint} />
            </div>
            <div className={styles.cell}>B</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// FlowLine — 연결 흐름을 잇는 흐르는 점선(이음 .tp-link i · .plink i css/console.css:557,561,883-884,894-896).
// 부모 칸이 위치 기준(position: relative)이고 선은 그 가운데를 가로지른다. verticalAt 폭 이하에서는 세로로 선다. 장식이다 — 흐름의 뜻은 곁의 라벨 글자가 전한다
import styles from './FlowLine.module.css';

/** 세로로 바뀌는 폭 — 구조도 1100 · 파이프라인 760(DESIGN Layout 브레이크포인트) */
export type FlowLineBreakpoint = 1100 | 760;

export type FlowLineProps = {
  /** 이 폭 이하에서 세로 점선 */
  verticalAt: FlowLineBreakpoint;
};

export function FlowLine({ verticalAt }: FlowLineProps) {
  return <span className={styles.root} data-vertical-at={verticalAt} aria-hidden="true" />;
}

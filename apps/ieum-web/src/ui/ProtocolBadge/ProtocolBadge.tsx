// ProtocolBadge — 원본 시스템의 연결 방식 배지. 이음 prBadge(js/common/state.js:36) · .pr(css/console.css:518-522,1045)
// 도메인 색(프로토콜)이라 Tag의 tone에 넣지 않고 이 부품이 맡는다. 글자는 쓰는 곳이 protocolLabel로 찾아 넘긴다
import styles from './ProtocolBadge.module.css';

/** rest · soap · gov · disc = 도메인 색, sample = 샘플 추론(점선), unknown = 모르는 값 */
export type ProtocolKind = 'rest' | 'soap' | 'gov' | 'sample' | 'disc' | 'unknown';

export type ProtocolBadgeProps = {
  /** 색 — 모르는 프로토콜 값은 쓰는 곳이 unknown으로 넘긴다 */
  kind: ProtocolKind;
  /** 글자 */
  label: string;
};

export function ProtocolBadge({ kind, label }: ProtocolBadgeProps) {
  return (
    <span className={styles.root} data-kind={kind}>
      {label}
    </span>
  );
}

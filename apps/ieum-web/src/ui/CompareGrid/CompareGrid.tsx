// CompareGrid — 같은 일의 두 쪽을 나란히(이음 .cmp · .cap css/console.css:727-729,897). 칸마다 CompareCaption + CodeBlock을 쓰는 곳이 넣는다.
// CompareCaption은 색 네모 + 캡션 글 + 흐린 보조 글이라 두 칸 밖에서 단독으로도 쓴다(탐색 근거 "캡처한 요청 · 응답"). 760 이하에서는 한 열
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './CompareGrid.module.css';

/** 색 네모의 뜻 — source = 원본 응답, tool = AI에게 전달하는 결과, traffic = 캡처한 요청 · 응답(DESIGN Colors ④ · ⑤) */
export type CompareTone = 'source' | 'tool' | 'traffic';

export type CompareGridProps = {
  /** 두 칸 — 칸마다 CompareCaption + CodeBlock */
  children: [ReactNode, ReactNode];
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function CompareGrid({ children, className }: CompareGridProps) {
  const [first, second] = children;
  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.cell}>{first}</div>
      <div className={styles.cell}>{second}</div>
    </div>
  );
}

export type CompareCaptionProps = {
  /** 색 네모 */
  tone: CompareTone;
  /** 캡션 글 */
  children: ReactNode;
  /** 캡션 뒤 흐린 보조 글 */
  description?: ReactNode;
  /** 아래 CodeBlock의 labelledBy 대상 */
  id?: string;
  /** 배치(바깥 여백 — 둘째 캡션 위)만 */
  className?: string;
};

export function CompareCaption({ tone, children, description, id, className }: CompareCaptionProps) {
  return (
    <p id={id} className={cx(styles.caption, className)}>
      <span className={styles.swatch} data-tone={tone} aria-hidden="true" />
      <span>{children}</span>
      {/* 공백 글자 — flex 줄에서는 보이지 않고, 코드 상자 이름(aria-labelledby)에서 캡션과 보조 글을 띄운다 */}
      {description ? (
        <>
          {' '}
          <span className={styles.description}>{description}</span>
        </>
      ) : null}
    </p>
  );
}

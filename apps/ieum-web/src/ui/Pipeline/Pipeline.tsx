// Pipeline — 도구 상세의 변환 흐름 띠(이음 js/menu/studio.js:85-91, .pipe · .pp · .plink css/console.css:653-665,894-896).
// 원본 작업 칸 · 이음 허브 칸 · AI 도구 칸을 흐름선(FlowLine)으로 잇는다. 글자는 모두 props로 받고, 760 이하에서는 세로로 선다.
// 띠는 이름 붙은 묶음(role="group")이다 — 로고 · 흐름선은 장식
import type { ReactNode } from 'react';
import { FlowLine } from '../FlowLine';
import { Logo } from '../icons/Logo';
import { cx } from '../lib/cx';
import styles from './Pipeline.module.css';

/** 원본 · AI 도구 칸 */
export type PipelineNode = {
  /** 칸 위 작은 라벨 — 칸 색 글자 */
  overline: ReactNode;
  /** 고정폭 굵은 이름 — 한 줄 말줄임(작업 `METHOD path` · 도구 id) */
  title: string;
  /** 아래 작은 줄들 */
  lines: readonly ReactNode[];
};

export type PipelineProps = {
  /** 띠 이름(role="group"의 이름) */
  label: string;
  /** 원본 칸 */
  source: PipelineNode;
  /** 허브 제목 — 로고 뒤 */
  hubTitle: ReactNode;
  /** 허브 요약 칩 — 글자는 쓰는 곳이 만든다 */
  hubChips: readonly ReactNode[];
  /** AI 도구 칸 */
  tool: PipelineNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

function PipelineCell({ kind, node }: { kind: 'source' | 'tool'; node: PipelineNode }) {
  return (
    <div className={styles.cell} data-kind={kind}>
      <span className={styles.overline}>{node.overline}</span>
      <b className={styles.title}>{node.title}</b>
      {node.lines.map((line, index) => (
        // 고정 줄 목록 — 순서가 바뀌거나 줄이 끼어들지 않아 자리 번호를 키로 쓴다
        <span key={index}>{line}</span>
      ))}
    </div>
  );
}

function PipelineLink() {
  return (
    <div className={styles.link}>
      <FlowLine verticalAt={760} />
    </div>
  );
}

export function Pipeline({ label, source, hubTitle, hubChips, tool, className }: PipelineProps) {
  return (
    <div role="group" aria-label={label} className={cx(styles.root, className)}>
      <PipelineCell kind="source" node={source} />
      <PipelineLink />
      <div className={styles.hub}>
        <span className={styles.hubHead}>
          <Logo size={20} />
          {hubTitle}
        </span>
        {hubChips.length > 0 ? (
          <span className={styles.chips}>
            {hubChips.map((chip, index) => (
              // 규칙 요약 줄 — 받을 때마다 통째로 다시 만들어 자리 번호를 키로 쓴다
              <span key={index} className={styles.chip}>
                {chip}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <PipelineLink />
      <PipelineCell kind="tool" node={tool} />
    </div>
  );
}

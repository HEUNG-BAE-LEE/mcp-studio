// CodeBlock — 이음 코드 상자(pre.code — css/console.css:724-726, code() js/common/convert.js:159). 강조는 highlight.ts가 나누고 여기서 <span>으로 그린다.
// 스크롤 상자라 tabindex=0 + 이름(labelledBy | label)을 단다 — 이름이 붙도록 role="region"(보이지 않는 ARIA 보강)
import { useMemo, type ReactNode } from 'react';
import type { TraceCode } from '@/app/trace/types';
import { cx } from '../lib/cx';
import { highlightCode, type CodeSegment, type CodeTokenKind } from './highlight';
import styles from './CodeBlock.module.css';

/** code = 언어별 강조 · 줄바꿈 없음, log = 서버 로그(강조 없음 · 긴 줄을 접음 · 최대 높이 화면 56% — js/menu/deploy.js:167) */
export type CodeBlockVariant = 'code' | 'log';

/** 스크롤 상자의 이름 — 다른 요소의 id(변환 과정은 그 단계 제목) 또는 글자 */
type CodeBlockName = { labelledBy: string; label?: never } | { label: string; labelledBy?: never };

export type CodeBlockProps = CodeBlockName & {
  /** 원문과 언어. 객체는 쓰는 곳이 JSON 글(2칸 들여쓰기)로 바꿔 넘긴다 */
  code: TraceCode;
  variant?: CodeBlockVariant;
  /** 배치(바깥 여백)만 */
  className?: string;
};

const TOKEN_CLASS: Readonly<Record<CodeTokenKind, string | undefined>> = {
  key: styles.key,
  string: styles.string,
  number: styles.number,
  literal: styles.literal,
  tag: styles.tag,
  comment: styles.comment,
  method: styles.method,
};

const renderSegments = (segments: readonly CodeSegment[]): ReactNode[] =>
  segments.map((segment, index) =>
    typeof segment === 'string' ? (
      segment
    ) : (
      <span key={index} className={TOKEN_CLASS[segment.kind]}>
        {renderSegments(segment.parts)}
      </span>
    ),
  );

export function CodeBlock({ code, variant = 'code', labelledBy, label, className }: CodeBlockProps) {
  const content = useMemo(
    () => (variant === 'log' ? code.text : renderSegments(highlightCode(code))),
    [code, variant],
  );
  return (
    <pre
      className={cx(styles.root, className)}
      data-variant={variant}
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 스크롤 상자는 키보드로 스크롤하도록 tabindex=0 + 이름(DESIGN 핵심 규칙 12 · 접근성 키보드)
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-label={label}
    >
      {content}
    </pre>
  );
}

// ModeTag — 도구의 읽기 · 쓰기 표지(이음 modeTag js/common/state.js:38, .md-tag css/console.css:523-525).
// 모양은 Tag(square)이고 이 부품은 읽기/쓰기의 색 뜻만 맡는다 — 글자는 쓰는 곳이 copy/로 만들어 label로 준다(쓰기가 아닌 값은 쓰는 곳이 read로 넘긴다)
import { Tag, type TagTone } from '../Tag';

/** read = 읽기(정보 색), write = 쓰기(주의 색) */
export type ModeKind = 'read' | 'write';
/** sm = 도구 목록 항목 안 축소 */
export type ModeTagSize = 'md' | 'sm';

export type ModeTagProps = {
  kind: ModeKind;
  /** 글자 — "읽기" · "쓰기" */
  label: string;
  /** 기본 md */
  size?: ModeTagSize;
};

// 읽기 = 정보(옛 .md-tag.r), 쓰기 = 주의(옛 .md-tag.w) — DESIGN Colors ③ 읽기/쓰기 표지
const TONE_OF: Readonly<Record<ModeKind, TagTone>> = { read: 'info', write: 'warn' };

export function ModeTag({ kind, label, size = 'md' }: ModeTagProps) {
  return (
    <Tag tone={TONE_OF[kind]} size={size}>
      {label}
    </Tag>
  );
}

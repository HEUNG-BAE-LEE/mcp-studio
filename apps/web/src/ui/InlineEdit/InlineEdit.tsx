// 그 자리 편집 — 값 하나를 그 자리에서 고친다(화면 제목 · 설정 값). 입력 lg + 저장 · 취소 lg + 아래 검증 문구 · 실패 블록 자리
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button } from '../Button';
import { InlineMessage } from '../InlineMessage';
import { Input } from '../Input';
import { cx } from '../lib/cx';
import { isImeComposing } from '../lib/ime';
import { CANCEL_LABEL } from '../lib/labels';
import styles from './InlineEdit.module.css';

const LABELS = { save: '저장', cancel: CANCEL_LABEL, saving: '저장 중…' };

export type InlineEditProps = Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> & {
  /** 편집을 시작할 때의 값 */
  defaultValue: string;
  /** 입력의 접근 가능한 이름(`프로젝트 이름`) — 묶음 `role=group`의 이름도 된다 */
  label: string;
  /** Enter · 저장 — 앞뒤 공백을 뗀 값. 처음 값과 같으면 부르지 않고 `onCancel`. 검증(빈 값 등)은 호출자 */
  onSave: (value: string) => void;
  /** Esc · 취소 · 바뀐 것 없이 저장 */
  onCancel: () => void;
  /** 저장 중 — 저장 `loading`(진행형 라벨) · 취소 비활성 · 입력 읽기 전용 · Esc 무시 */
  saving?: boolean;
  /** 테두리 `fix-fg` + `aria-invalid` */
  invalid?: boolean;
  /** 입력 아래 검증 문구(`label` 500 12 `fix-fg`) — 입력의 `aria-describedby` */
  message?: ReactNode;
  /** 칸으로 못 가는 실패(ErrorBlock 원문) — 줄 아래. 제목 요소(h1) 밖이다 */
  error?: ReactNode;
  /** `heading` = 화면 제목 편집(h1 600 24). 기본 `ui`(body 400 14) */
  textStyle?: 'ui' | 'heading';
  labels?: Partial<typeof LABELS>;
};

export const InlineEdit = forwardRef<HTMLDivElement, InlineEditProps>(function InlineEdit(
  {
    defaultValue,
    label,
    onSave,
    onCancel,
    saving = false,
    invalid = false,
    message,
    error,
    textStyle = 'ui',
    labels,
    className,
    ...rest
  },
  ref,
) {
  const [draft, setDraft] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const text = { ...LABELS, ...labels };
  // 열릴 때(마운트) 입력으로 포커스 + 전체 선택 — 편집은 그 자리가 열릴 때만 렌더한다
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const save = () => {
    if (saving) return;
    const value = draft.trim();
    if (value === defaultValue.trim()) onCancel();
    else onSave(value);
  };
  // 루트에서 받아 포커스가 저장 · 취소 버튼에 있어도 Esc가 닫는다. 모달 · 층의 Esc 닫기로 번지지 않게 막는다
  const onRootKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    rest.onKeyDown?.(e);
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (!saving) onCancel();
  };
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (isImeComposing(e)) return;
    e.preventDefault();
    save();
  };
  const hasMessage = message !== undefined && message !== null && message !== '';
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 자식 버튼 · 입력의 Esc를 받는 묶음 루트(role=group)
    <div
      {...rest}
      onKeyDown={onRootKeyDown}
      ref={ref}
      role="group"
      aria-label={label}
      className={cx(styles.root, className)}
      data-text-style={textStyle}
      data-saving={saving || undefined}
    >
      <div className={styles.row}>
        <Input
          ref={inputRef}
          size="lg"
          textStyle={textStyle}
          className={styles.input}
          aria-label={label}
          value={draft}
          readOnly={saving}
          invalid={invalid}
          aria-describedby={hasMessage ? messageId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onInputKeyDown}
        />
        <Button size="lg" variant="primary" loading={saving} onClick={save}>
          {saving ? text.saving : text.save}
        </Button>
        <Button size="lg" variant="secondary" disabled={saving} onClick={onCancel}>
          {text.cancel}
        </Button>
      </div>
      {hasMessage ? <InlineMessage id={messageId}>{message}</InlineMessage> : null}
      {error ?? null}
    </div>
  );
});

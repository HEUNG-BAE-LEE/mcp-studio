// Switch — 켜고 끄는 설정 하나. 이음 .sw(css/console.css:369-375) · .pubsw(:638-639) · .dz-h.ck2(:917-922, 760 :1065)
// 숨긴 <input type="checkbox">이 스위치 표시를 덮는다 — 역할은 체크박스 그대로다(옛 그대로). 포커스 링은 숨긴 입력이 아니라 표시에 그린다.
// standalone은 자기 <label>을 만들지 않아 바깥 <label htmlFor={id}> 안에 들어갈 수 있다(감싸기만 하면 jsx-a11y가 부품을 컨트롤로 보지 못한다)
import { useId, type ReactNode } from 'react';
import { VisuallyHidden } from '../VisuallyHidden';
import { cx } from '../lib/cx';
import styles from './Switch.module.css';

/** standalone = 스위치만, inline = 글자 + 스위치 묶음(공개 스위치), heading = 스위치 + 굵은 제목 + 아래 설명(탐색 영역 제목줄) */
export type SwitchVariant = 'standalone' | 'inline' | 'heading';

/** 비활성 사유 — 시각 숨김 글자(disabledReason)이거나 화면에 보이는 글의 id(aria-describedby). 둘을 함께 쓰지 않는다 */
type SwitchReason =
  | { disabledReason?: string; 'aria-describedby'?: never }
  | { 'aria-describedby'?: string; disabledReason?: never };

type SwitchCommon = SwitchReason & {
  /** 켜짐 */
  checked: boolean;
  /** 바꾸면 새 값 */
  onCheckedChange: (checked: boolean) => void;
  /** 입력 이름(aria-label). inline · heading은 이 글자를 보이는 글자로도 그린다 */
  label: string;
  /** 못 바꾸는 스위치 — inline만 묶음이 흐려지고 standalone · heading은 모양이 그대로다 */
  disabled?: boolean;
  /** 입력 id — standalone을 감싼 바깥 <label htmlFor>가 잇는다 */
  id?: string;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export type SwitchProps =
  | (SwitchCommon & { variant?: 'standalone' | 'inline'; description?: never })
  | (SwitchCommon & {
      variant: 'heading';
      /** 제목 아래 흐린 설명 — 스위치 폭 + 간격만큼 들여 쓴다 */
      description?: ReactNode;
    });

export function Switch(props: SwitchProps) {
  const {
    checked,
    onCheckedChange,
    label,
    variant = 'standalone',
    description,
    disabled = false,
    disabledReason,
    'aria-describedby': describedBy,
    id,
    className,
  } = props;
  const reasonId = useId();
  // 사유는 비활성일 때만 낸다 — 쓰는 곳은 늘 넘기고 disabled만 바꿔도 된다
  const reason = disabled ? disabledReason : undefined;
  const isStandalone = variant === 'standalone';

  // 스위치 표시 — standalone이면 이것이 루트다(배치 className · 사유 툴팁도 여기)
  const control = (
    <span className={cx(styles.switch, isStandalone && className)} title={isStandalone ? reason : undefined}>
      <input
        type="checkbox"
        id={id}
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={reason !== undefined ? reasonId : describedBy}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
      <span className={styles.track} aria-hidden="true" />
      {reason !== undefined ? <VisuallyHidden id={reasonId}>{reason}</VisuallyHidden> : null}
    </span>
  );

  if (isStandalone) return control;

  return (
    <label
      className={cx(styles.root, className)}
      data-variant={variant}
      data-disabled={disabled ? 'true' : undefined}
      title={reason}
    >
      {variant === 'inline' ? label : null}
      {control}
      {variant === 'heading' ? <b className={styles.title}>{label}</b> : null}
      {variant === 'heading' && description !== undefined ? (
        <small className={styles.description}>{description}</small>
      ) : null}
    </label>
  );
}

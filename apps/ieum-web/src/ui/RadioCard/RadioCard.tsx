// RadioCard — 제목 · 설명이 붙은 선택지 카드. 이음 .mode-card(card — css/console.css:260-268,821-822,913) · .opt(option — :704-711) · .radio(:263-265)
// 카드는 <button aria-pressed>다. 라디오 점 · 아이콘은 장식이고 이름은 카드 글자 전체다. 잠긴 카드는 disabled라 Tab이 닿지 않는다
// option의 slot은 누르는 버튼 밖 · 카드 테두리 안 · 글 열에 둔다 — 옛은 입력이 버튼 안에 있었다(js/menu/discovery.js:72)
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { cx } from '../lib/cx';
import styles from './RadioCard.module.css';

export type RadioCardVariant = 'card' | 'option';

type RadioCardBaseProps = {
  /** 제목 */
  title: ReactNode;
  /** 제목 아래 설명 */
  description?: ReactNode;
  /** 고른 카드 */
  selected: boolean;
  /** 누름 — 이미 고른 카드여도 부른다 */
  onSelect: () => void;
  /** 잠긴 카드 — 표지 · 입력까지 카드 전체가 흐려진다 */
  disabled?: boolean;
  /** 배치만(격자 칸 · 바깥 여백) */
  className?: string;
};

type RadioCardCardProps = RadioCardBaseProps & {
  /** card = 연결 방식 카드(굵은 제목 · 안쪽 테) */
  variant?: 'card';
  /** 제목 앞 아이콘(md · 주조색) */
  icon?: IconName;
  /** 제목 뒤 표지(Tag) */
  badges?: ReactNode;
  slot?: never;
};

type RadioCardOptionProps = RadioCardBaseProps & {
  /** option = 정책 · 검증 방식 작은 카드(아이콘 · 표지 없음) */
  variant: 'option';
  /** 고르면 설명 자리를 대신하는 입력 — 버튼 밖 · 글 열에 그린다 */
  slot?: ReactNode;
  icon?: never;
  badges?: never;
};

export type RadioCardProps = RadioCardCardProps | RadioCardOptionProps;

type ContentProps = {
  icon?: IconName;
  badges?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
};

function RadioCardContent({ icon, badges, title, description }: ContentProps) {
  return (
    <>
      <span className={styles.radio} aria-hidden="true" />
      <span className={styles.body}>
        <span className={styles.head}>
          {icon !== undefined ? <Icon name={icon} size="md" className={styles.icon} /> : null}
          {title}
          {badges}
        </span>
        {description !== undefined ? <span className={styles.description}>{description}</span> : null}
      </span>
    </>
  );
}

export function RadioCard(props: RadioCardProps) {
  const { variant = 'card', title, description, icon, badges, slot, selected, onSelect, disabled = false, className } = props;
  const state = selected ? 'on' : 'off';

  if (slot === undefined) {
    return (
      <button
        type="button"
        className={cx(styles.root, className)}
        data-variant={variant}
        data-state={state}
        data-disabled={disabled ? 'true' : undefined}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
      >
        <RadioCardContent icon={icon} badges={badges} title={title} description={description} />
      </button>
    );
  }

  // slot이 있으면 겉 칸이 테두리 · 바탕 · hover · 고름을, 안 버튼이 누름 · 포커스 링을 맡는다. 구조는 고름과 상관없이 같다(눌러도 버튼이 다시 그려지지 않게)
  return (
    <div
      className={cx(styles.root, className)}
      data-variant={variant}
      data-state={state}
      data-disabled={disabled ? 'true' : undefined}
      data-slot="true"
    >
      <button type="button" className={styles.button} aria-pressed={selected} disabled={disabled} onClick={onSelect}>
        <RadioCardContent title={title} description={selected ? undefined : description} />
      </button>
      {selected ? <div className={styles.slot}>{slot}</div> : null}
    </div>
  );
}

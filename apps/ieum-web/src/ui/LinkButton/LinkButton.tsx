// LinkButton — 이음 .link(css/console.css:184). to가 있으면 라우터 링크(<a href>), 없으면 <button type="button">. 모양은 data-variant
import type { MouseEventHandler, ReactNode } from 'react';
import { Link, type To } from 'react-router-dom';
import { Icon } from '../icons/Icon';
import styles from './LinkButton.module.css';

export type LinkButtonVariant = 'underline' | 'mono' | 'back';

type CommonProps = {
  /** underline = 밑줄 글자, mono = 밑줄 없는 고정폭 작은 글자(도구 id), back = 밑줄 없음 + 앞 back 아이콘 */
  variant?: LinkButtonVariant;
  /** 글자 */
  children: ReactNode;
};

/** 이동 링크 — onClick은 이동 전에 부른다(메뉴 다시 받기 등). disabled · pending은 버튼일 때만 */
type LinkProps = CommonProps & {
  to: To;
  /** 이동 상태 — 라우터 Link state로 그대로 넘긴다(도착 화면이 읽는 표지) */
  state?: unknown;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  disabled?: never;
  pending?: never;
};

/** 동작 버튼 — to가 없으면 onClick이 필수다 */
type ActionProps = CommonProps & {
  to?: undefined;
  state?: never;
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** 조건이 안 맞아 못 누름(native — 포커스를 받지 않는다) */
  disabled?: boolean;
  /** 요청 중 잠금(Button pending과 같은 계약) — aria-disabled · 누름 · Enter · Space 무시, 포커스는 버튼에 남는다. 모양은 바뀌지 않는다(옛 .link에 비활성 모양이 없다) */
  pending?: boolean;
};

export type LinkButtonProps = LinkProps | ActionProps;

export function LinkButton(props: LinkButtonProps) {
  const { variant = 'underline', children } = props;
  const content = (
    <>
      {variant === 'back' ? <Icon name="back" size="md-minus" /> : null}
      {children}
    </>
  );

  if (props.to !== undefined) {
    return (
      <Link to={props.to} state={props.state} onClick={props.onClick} className={styles.root} data-variant={variant}>
        {content}
      </Link>
    );
  }
  const { onClick, pending = false } = props;
  // 잠긴 동안은 쓰는 곳의 onClick을 부르지 않는다(Enter · Space도 click으로 온다) — native disabled가 아니라 포커스가 버튼에 남는다
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick(event);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={props.disabled}
      aria-disabled={pending || undefined}
      className={styles.root}
      data-variant={variant}
    >
      {content}
    </button>
  );
}

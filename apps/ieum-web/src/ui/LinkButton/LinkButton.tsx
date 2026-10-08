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

/** 이동 링크 — onClick은 이동 전에 부른다(메뉴 다시 받기 등). disabled는 버튼일 때만 */
type LinkProps = CommonProps & {
  to: To;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  disabled?: never;
};

/** 동작 버튼 — to가 없으면 onClick이 필수다 */
type ActionProps = CommonProps & {
  to?: undefined;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
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
      <Link to={props.to} onClick={props.onClick} className={styles.root} data-variant={variant}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled} className={styles.root} data-variant={variant}>
      {content}
    </button>
  );
}

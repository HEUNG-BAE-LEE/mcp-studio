// 14px 원 안 글리프(! · i). 흐름 자동화 수준 툴팁 트리거 · 바구니 발 안내 장식
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './InfoDot.module.css';

export type InfoDotGlyph = '!' | 'i';

type InteractiveInfoDotProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  glyph: InfoDotGlyph;
  /** 툴팁 트리거(키보드 포커스 · cursor help · hover ink) — 이름(aria-label) 필수 */
  interactive: true;
  'aria-label': string;
};

type DecorativeInfoDotProps = {
  glyph: InfoDotGlyph;
  /** 장식 span(aria-hidden) — 버튼 props · aria-label을 받지 않는다 */
  interactive?: false;
  className?: string;
  title?: string;
};

export type InfoDotProps = InteractiveInfoDotProps | DecorativeInfoDotProps;

export const InfoDot = forwardRef<HTMLButtonElement, InfoDotProps>(function InfoDot(props, ref) {
  if (props.interactive !== true) {
    const { glyph, className, title } = props;
    return (
      <span className={cx(styles.root, className)} title={title} aria-hidden="true">
        {glyph}
      </span>
    );
  }
  const { glyph, interactive: _interactive, className, type = 'button', ...rest } = props;
  return (
    <button
      {...rest}
      type={type}
      ref={ref}
      className={cx(styles.root, className)}
      data-interactive="true"
    >
      {glyph}
    </button>
  );
});

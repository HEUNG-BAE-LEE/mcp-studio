import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Tooltip } from '../Tooltip';
import styles from './AppShell.module.css';

export type AppShellProps = HTMLAttributes<HTMLDivElement> & {
  lnb?: ReactNode;
  /** 1024 폭 프레임 */
  narrow?: boolean;
  /** 앱 루트용 — 폭을 부모에 맞춘다(min 1024). 없으면 고정 1280(카탈로그 예시) */
  fill?: boolean;
  children?: ReactNode;
};

/** 앱 프레임 = lnb + main. 층의 컨테이너이며 Tooltip.Provider를 감싼다. 바깥 여백(page-*)은 앱 루트 몫 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  { lnb, narrow, fill, children, className, ...rest },
  ref,
) {
  return (
    <Tooltip.Provider>
      <div
        {...rest}
        className={cx(styles.frame, className)}
        data-narrow={narrow || undefined}
        data-fill={fill || undefined}
        ref={ref}
      >
        {lnb}
        <main className={styles.main}>{children}</main>
      </div>
    </Tooltip.Provider>
  );
});

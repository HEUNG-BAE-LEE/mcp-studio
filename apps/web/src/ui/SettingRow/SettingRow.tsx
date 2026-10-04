// 설정 한 줄 — 왼쪽 제목(+ 설명) · 오른쪽 컨트롤 하나(Switch · Button). 앞에 내용이 있으면 위에 1px hairline-soft.
// 위험 작업 입구는 컨트롤(Button `md` `danger`)이 뜻을 나른다 — 줄 자체에는 변형이 없다
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './SettingRow.module.css';

export type SettingRowProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** 제목 — `--t-ui-strong` `ink` */
  title: ReactNode;
  /** 설명 한 줄 — `--t-caption` `muted`. 없으면 그리지 않는다 */
  description?: ReactNode;
  /** 설명 줄 `id` — 컨트롤 `aria-describedby`로 잇는다 */
  descriptionId?: string;
  /** 오른쪽 컨트롤 하나(Switch · Button) */
  control: ReactNode;
};

const hasValue = (node: ReactNode) => node !== undefined && node !== null && node !== false;

export const SettingRow = forwardRef<HTMLDivElement, SettingRowProps>(function SettingRow(
  { title, description, descriptionId, control, className, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {hasValue(description) ? (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        ) : null}
      </div>
      <div className={styles.control}>{control}</div>
    </div>
  );
});

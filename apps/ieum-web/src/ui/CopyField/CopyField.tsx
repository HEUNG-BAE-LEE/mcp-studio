// CopyField — 값 하나를 보이고 복사하는 칸. 이음 .ep(css/console.css:791-793 — MCP 서버 주소, js/menu/deploy.js:73) · .newkey(:800-801 — 키 발급 결과, js/menu/deploy.js:177).
// 같은 일(값 + 복사)이라 한 부품 두 변형이다. 부품은 값을 그리고 복사 버튼을 누르면 onCopy를 부를 뿐 — 클립보드 쓰기 · 토스트(성공 · 실패)는 쓰는 곳이 한다.
// 값은 보이는 글자(<code>)로만 그린다 — title · data-* 속성 · 개발 콘솔에 싣지 않는다(옛은 data-text 속성에 키를 실었다)
import type { ReactNode } from 'react';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { cx } from '../lib/cx';
import styles from './CopyField.module.css';

/** inline = 칸 안 한 줄 말줄임 + 아이콘 버튼(서버 주소), block = 줄바꿈해 전부 보이는 값 상자 + 작은 버튼(발급한 키) */
export type CopyFieldVariant = 'inline' | 'block';

type CopyFieldCommon = {
  /** 복사 버튼 글자 — inline은 아이콘 버튼 이름(aria-label), block은 보이는 글자 */
  copyLabel: string;
  /** 복사 버튼을 누르면 값으로 부른다 — 클립보드 쓰기 · 토스트는 쓰는 곳 */
  onCopy: (value: string) => void;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export type CopyFieldProps = CopyFieldCommon &
  (
    | {
        variant: 'inline';
        /** 보일 값 */
        value: string;
        emptyText?: ReactNode;
      }
    | {
        variant: 'inline';
        /** 값이 없으면 emptyText를 그리고 복사 버튼을 두지 않는다 */
        value: null;
        /** 값이 없을 때 흐린 안내 */
        emptyText: ReactNode;
      }
    | { variant: 'block'; value: string; emptyText?: never }
  );

export function CopyField(props: CopyFieldProps) {
  const { copyLabel, onCopy, className } = props;

  if (props.variant === 'block') {
    const { value } = props;
    return (
      <div className={cx(styles.root, className)} data-variant="block">
        <code className={styles.value}>{value}</code>
        <Button size="sm" icon="copy" onClick={() => onCopy(value)}>
          {copyLabel}
        </Button>
      </div>
    );
  }

  const { value, emptyText } = props;
  return (
    <div className={cx(styles.root, className)} data-variant="inline">
      {value === null ? (
        <span className={styles.empty}>{emptyText}</span>
      ) : (
        <>
          <code className={styles.value}>{value}</code>
          <IconButton label={copyLabel} icon="copy" onClick={() => onCopy(value)} />
        </>
      )}
    </div>
  );
}

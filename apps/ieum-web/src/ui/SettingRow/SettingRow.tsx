// SettingRow — 제목 · 설명 + 오른쪽 컨트롤 한 줄. 이음 .tg(css/console.css:712-717)
// 실행 정책(스위치 · 숫자 칸 — js/menu/studio.js:107-109) · 배포 보안 정책 요약(읽기 전용 값 — js/menu/deploy.js:91-94) ·
// 탐색 안전 설정(스위치 · 단어 칩 · 선택 카드 · 시각 — js/menu/discovery.js:68-75). 이어진 줄 사이 선 · 첫 줄 모양은 앞 형제로 정한다(옛 .tg.first)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './SettingRow.module.css';

export type SettingRowProps = {
  /** 제목 */
  title: ReactNode;
  /** 제목 아래 작은 흐린 설명 */
  description?: ReactNode;
  /** 오른쪽 — 스위치 · 정책 칸 · 읽기 전용 값(<b>). 둘이면 사이 간격을 둔다. 없으면 글 열만 */
  control?: ReactNode;
  /** 설명 아래 글 열 안 내용 — 단어 칩 입력 · 선택 카드 묶음 */
  children?: ReactNode;
  /** 배치만 */
  className?: string;
};

export function SettingRow({ title, description, control, children, className }: SettingRowProps) {
  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.text}>
        <b className={styles.title}>{title}</b>
        {description !== undefined ? <small className={styles.description}>{description}</small> : null}
        {children !== undefined ? <div className={styles.extra}>{children}</div> : null}
      </div>
      {control !== undefined ? <div className={styles.control}>{control}</div> : null}
    </div>
  );
}

// 1차 개발 범위 모달 — 이음 js/main.js:30-38 · css/console.css:855-857,900. 넓은 모달 · 확인 없음 · 취소 자리 "닫기".
// 문구는 서버 사실과 다른 옛 문구 그대로(자동 탐색이 없다 — DESIGN ## 이식 기간 보존)
import { Icon, Modal, type IconName, type IconStroke } from '@/ui';
import { SCOPE } from '../../copy/shell';
import styles from './ScopeModal.module.css';

export type ScopeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ScopeColumn = Readonly<{ icon: IconName; stroke?: IconStroke; heading: string; items: readonly string[] }>;

// 옛 svg('check', 16, 2.4) · svg('layers', 16) — 크기 md, 선 bold · 기본
const COLUMNS: readonly ScopeColumn[] = [
  { icon: 'check', stroke: 'bold', heading: SCOPE.included, items: SCOPE.includedItems },
  { icon: 'layers', heading: SCOPE.later, items: SCOPE.laterItems },
];

export function ScopeModal({ open, onOpenChange }: ScopeModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={SCOPE.title} size="wide" cancelLabel={SCOPE.close}>
      <div className={styles.grid}>
        {COLUMNS.map((column) => (
          <div key={column.icon}>
            <h5 className={styles.heading}>
              <Icon name={column.icon} size="md" stroke={column.stroke} />
              {column.heading}
            </h5>
            <ul className={styles.list}>
              {column.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}

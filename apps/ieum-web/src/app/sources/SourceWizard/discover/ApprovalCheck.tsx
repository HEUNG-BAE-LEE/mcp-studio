// ApprovalCheck — 탐색 마법사 안전 설정 끝의 담당자 승인 상자(옛 .own — js/menu/discovery.js:78, css/console.css:931-935)
// 경고색 상자 안 체크 상자 + 굵은 제목 + 설명. 켜면 초록 상자로 바뀌고 시작 버튼이 풀린다(시작 버튼은 쓰는 곳 — 옛 wzOk :415).
// 상자 전체가 라벨이라 어디를 눌러도 바뀐다 — 감싸기만 하지 않고 <label htmlFor> + Checkbox id로 잇는다(린트가 감싼 부품 안 입력을 보지 못한다)
import { useId } from 'react';
import { DISCOVERY } from '../../../../copy/discovery';
import { Checkbox } from '@/ui';
import styles from './ApprovalCheck.module.css';

export type ApprovalCheckProps = Readonly<{
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}>;

export function ApprovalCheck({ checked, onCheckedChange }: ApprovalCheckProps) {
  const id = useId();
  const A = DISCOVERY.safety.approve;
  return (
    <label htmlFor={id} className={styles.root} data-state={checked ? 'on' : 'off'}>
      <Checkbox id={id} size="lg" checked={checked} onCheckedChange={onCheckedChange} />
      <span>
        <b className={styles.title}>{A.title}</b>
        <small className={styles.description}>{A.desc}</small>
      </span>
    </label>
  );
}

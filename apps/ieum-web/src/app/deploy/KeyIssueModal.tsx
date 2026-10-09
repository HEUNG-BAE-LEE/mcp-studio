// KeyIssueModal — 액세스 키 발급 모달의 내용(옛 keyNew — js/menu/deploy.js:172-174)
// 본문: "키 이름" 칸(placeholder) + 안내 한 줄 · 확인 "발급". 첫 포커스는 이름 칸(Modal 규칙 — 본문 첫 input). form이 아니다 — Enter로 보내지 않는다(옛도 보내지 않았다)
//
// ── 쓰는 곳 계약 ──
// keyIssueContentOf({ name, onNameChange, issueKey }) → ModalContent(app/sources/useModalAttempt)
//   name · onNameChange — 입력은 모달 칸이 쥔다(app/deploy/useDeployModalAttempt keyName — 시도마다 빈 칸)
//   issueKey — useIssueKey() 인스턴스(모달 칸이 쥔다). 요청 중이면 확인을 잠근다(대상 없는 요청이라 어느 발급이든)
// - 확인 = mutate({ name }) 한 번 — 앞뒤 공백 빼기 · 빈 이름의 "새 액세스 키"는 훅이 한다. 성공하면 훅이 이 칸을 키 결과로 바꾼다
//   (내용 교체 — 첫 포커스가 결과의 "확인"으로). 실패는 경고 토스트이고 창은 그대로
import { DEPLOY } from '../../copy/deploy';
import type { ModalContent } from '../sources/useModalAttempt';
import type { useIssueKey } from './useKeyMutations';
import { Field, HelpText, Input } from '@/ui';
import styles from './DeployModals.module.css';

type IssueMutation = ReturnType<typeof useIssueKey>;

export type KeyIssueInput = Readonly<{
  name: string;
  onNameChange: (name: string) => void;
  issueKey: IssueMutation;
}>;

const C = DEPLOY.keyIssue;

function KeyIssueBody({ name, onNameChange }: Pick<KeyIssueInput, 'name' | 'onNameChange'>) {
  return (
    <>
      <Field label={C.nameLabel}>
        {({ id }) => <Input id={id} value={name} onValueChange={onNameChange} placeholder={C.namePlaceholder} />}
      </Field>
      <HelpText className={styles.hint}>{C.hint}</HelpText>
    </>
  );
}

export function keyIssueContentOf({ name, onNameChange, issueKey }: KeyIssueInput): ModalContent {
  return {
    title: C.title,
    confirmLabel: C.confirm,
    onConfirm: () => issueKey.mutate({ name }),
    isLocked: issueKey.isPending,
    body: <KeyIssueBody name={name} onNameChange={onNameChange} />,
  };
}

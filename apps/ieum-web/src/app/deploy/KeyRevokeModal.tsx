// KeyRevokeModal — 액세스 키 폐기 확인 모달의 내용(옛 keyRevoke — js/menu/deploy.js:180-181)
//
// ── 쓰는 곳 계약 ──
// keyRevokeContentOf({ accessKey, revokeKey }) → ModalContent(app/sources/useModalAttempt)
//   accessKey — 연 순간의 키(이름은 텍스트로 그린다 — 옛은 이스케이프한 HTML). revokeKey — useRevokeKey() 인스턴스(모달 칸이 쥔다),
//   잠금은 그 요청이 이 키의 것일 때만
// - 확인 = mutate({ keyId }) 한 번. 키 행 고침 · 자기 칸 닫기 · 토스트와 실패 토스트(창은 그대로)는 훅의 옵션 콜백(app/deploy/useKeyMutations)
// - 확인 "폐기"는 주색 · 첫 포커스(옛 그대로)
import type { AccessKey } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { EmphasisText } from '../discovery/CopyParts';
import type { ModalContent } from '../sources/useModalAttempt';
import type { useRevokeKey } from './useKeyMutations';
import styles from './DeployModals.module.css';

type RevokeMutation = ReturnType<typeof useRevokeKey>;

export type KeyRevokeInput = Readonly<{ accessKey: AccessKey; revokeKey: RevokeMutation }>;

const C = DEPLOY.keyRevoke;

export function keyRevokeContentOf({ accessKey, revokeKey }: KeyRevokeInput): ModalContent {
  return {
    title: C.title,
    confirmLabel: C.confirm,
    onConfirm: () => revokeKey.mutate({ keyId: accessKey.id }),
    isLocked: revokeKey.isPending && revokeKey.variables?.keyId === accessKey.id,
    body: (
      <p className={styles.text}>
        <EmphasisText parts={C.body(accessKey.name)} />
      </p>
    ),
  };
}

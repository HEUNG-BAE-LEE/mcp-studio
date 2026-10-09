// KeyRevealModal — 발급한 키를 한 번만 보이는 모달의 내용(옛 keyNew 결과 — js/menu/deploy.js:175-177)
// 본문: 안내 문단("지금 한 번만" 굵게) + 전체 키 줄(CopyField block — 줄바꿈해 전부 보임 + 작은 "복사"). 확인 "확인"만(취소 없음).
// Esc · 가림막으로 닫히지 않는다(dismissible=false — ✕ · 확인으로만). 키 목록은 발급 성공 때 이미 고쳤다(닫는 방법과 상관없다)
// 키 원문은 이 층에만 있다 — 모달 칸이 닫히는 순간 비운다(app/LayerHost). 비면 키 줄을 그리지 않는다(닫힘 전환 동안 키 줄이 먼저 사라진다).
// 원문을 저장소 · 주소 · 개발 콘솔 · 속성(title · data-*)에 남기지 않는다(옛은 복사 버튼 data-text에 키를 실었다)
//
// ── 쓰는 곳 계약 ──
// keyRevealContentOf({ secret }) → ModalContent(app/sources/useModalAttempt). secret은 층의 원문(닫히면 빈 글)
// - 복사는 app/deploy/copyWithToast(클립보드 + 토스트), 확인은 칸을 닫는다
import { DEPLOY } from '../../copy/deploy';
import { EmphasisText } from '../discovery/CopyParts';
import { closeLayer } from '../layers';
import type { ModalContent } from '../sources/useModalAttempt';
import { copyWithToast } from './copyWithToast';
import { CopyField } from '@/ui';
import styles from './DeployModals.module.css';

const C = DEPLOY.keyReveal;

function KeyRevealBody({ secret }: Readonly<{ secret: string }>) {
  return (
    <>
      <p className={styles.lead}>
        <EmphasisText parts={C.body} />
      </p>
      {secret === '' ? null : (
        <CopyField
          variant="block"
          className={styles.secret}
          value={secret}
          copyLabel={DEPLOY.snippet.copy}
          onCopy={(value) => void copyWithToast(value)}
        />
      )}
    </>
  );
}

export function keyRevealContentOf({ secret }: Readonly<{ secret: string }>): ModalContent {
  return {
    title: C.title,
    confirmLabel: C.confirm,
    onConfirm: () => closeLayer('modal'),
    hideCancel: true,
    dismissible: false,
    body: <KeyRevealBody secret={secret} />,
  };
}

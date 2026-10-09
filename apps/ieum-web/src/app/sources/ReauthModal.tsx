// ReauthModal — 원본 시스템 인증 정보 다시 입력 모달의 내용(옛 reauth — js/menu/sources.js:133-141)
// 제목 · 본문(원본 이름 강조 + 문장, 그 아래 공용 인증 폼) · 확인 "저장하고 다시 연결"을 만든다. Modal은 모달 칸(app/LayerHost ModalSlot)이 하나만 그린다
//
// ── 쓰는 곳 계약 ──
// reauthContentOf({ source, cred, onCredChange, reauth }) → ModalContent(app/sources/useModalAttempt)
//   source — 연 순간에 잡은 원본. 본문 이름과 인증 칸의 연결 방식을 캐시에서 다시 찾지 않는다
//   cred · onCredChange — 입력 상태는 칸이 쥔다(확인이 Modal prop이라 같은 곳에서 읽는다). 시작 값은 useModalAttempt가 잡는다
//   reauth — useReauthSource() 인스턴스. 칸을 거쳐 남으므로 isLocked는 그 요청이 이 원본의 것일 때만 켠다(isPendingFor)
// - 확인 = reauth.mutate({ sourceId, auth: cred }) 한 번. 성공 뒤 캐시 · 자기 칸 닫기 · 토스트와 실패 토스트는 훅의 옵션 콜백이 한다
//   (useSourceMutations) — 실패하면 모달은 열린 채 남는다(옛 :138-139)
// - form이 아니다 — Enter로 확인하지 않는다(옛 keydown은 Esc · 다른 입력 · 표 행만 다뤘다 — js/main.js:54-59). 첫 포커스는 Modal 규칙
//   (본문 첫 input — 인증 방식 select는 건너뛴다 — 없으면 확인 버튼, 옛 js/common/overlay.js:23)
// - 본문은 문단 아래 인증 칸이다. 문단 아래 여백은 옛 <p>의 기본 아래 여백(글자 크기 1em = 14px)이다(js/menu/sources.js:136 margin-top:0만 지움)
import type { SourceCred } from '../../api/types';
import { SOURCES } from '../../copy/sources';
import { AuthForm } from './AuthForm';
import { isPendingFor, type ModalContent, type OpenedSource } from './useModalAttempt';
import type { useReauthSource } from './useSourceMutations';
import styles from './ReauthModal.module.css';

type ReauthMutation = ReturnType<typeof useReauthSource>;

export type ReauthContentInput = Readonly<{
  source: OpenedSource;
  cred: SourceCred;
  onCredChange: (cred: SourceCred) => void;
  reauth: ReauthMutation;
}>;

type ReauthBodyProps = Readonly<{
  source: OpenedSource;
  cred: SourceCred;
  onCredChange: (cred: SourceCred) => void;
}>;

function ReauthBody({ source, cred, onCredChange }: ReauthBodyProps) {
  return (
    <>
      <p className={styles.lead}>
        <b>{source.name}</b>
        {SOURCES.reauth.bodyPost}
      </p>
      <AuthForm mode={source.proto} cred={cred} onChange={onCredChange} />
    </>
  );
}

export function reauthContentOf({ source, cred, onCredChange, reauth }: ReauthContentInput): ModalContent {
  return {
    title: SOURCES.reauth.title,
    confirmLabel: SOURCES.reauth.ok,
    onConfirm: () => reauth.mutate({ sourceId: source.id, auth: cred }),
    isLocked: isPendingFor(reauth, source.id),
    body: <ReauthBody source={source} cred={cred} onCredChange={onCredChange} />,
  };
}

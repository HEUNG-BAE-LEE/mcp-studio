// DeployConfirmModal — 배포 확인 모달의 내용(옛 deploy · deployNow — js/menu/deploy.js:104-117,141-155)
// 제목 "{이름} {다음 버전} 배포". 공개 도구가 있으면: 문단("도구 **N개**를 MCP 서버로 배포합니다. {어떻게}") · 먼저 저장할 도구 경고(+ 도구 id) ·
// 빠지는 도구 경고(+ 도구 id) · 결과 자리(요청 중 = 도는 원 + 진행 문장, 실패 = 위험 실패 상자 — 서버 문장 원문). 확인 "배포하기" → 요청 중 "배포하는 중…"(잠금) →
// 실패면 "다시 시도"(같은 버튼으로 다시 보낸다). 공개 도구가 없으면 위험 알림 한 줄뿐이고 확인 버튼이 없다(첫 포커스는 머리 ✕).
//
// ── 쓰는 곳 계약 ──
// deployConfirmContentOf(input) → ModalContent(app/sources/useModalAttempt)
//   toolset · plan — 연 순간의 묶음과 세 목록(app/deploy/useDeployModalAttempt — 초안을 덮은 도구로 셌다). 성공해 버전이 바뀌어도 닫히는 동안 제목이 그대로다
//   attempt — 이 창을 연 기준 시각 뒤 그 묶음의 마지막 배포 요청 상태(app/deploy/useDeployToolset useDeployAttempt). 요청 중에 닫았다 다시 연 창도
//     "배포하는 중…" · 진행 문장(요청 때 먼저 저장할 도구가 있었는지)을 잇고 확인을 잠근다(옛은 다시 연 창의 "배포하기"가 살아 중복 배포가 됐다)
//   onDeploy — 배포 화면의 요청(층의 onDeploy). dirtyIds는 누르는 순간 다시 센다(currentDirtyIds — "다시 시도"면 앞 시도에서 저장된 도구가 빠진다)
// - 저장에서 멈췄으면 실패 상자 머리에 그 도구 id를 인라인 코드로 붙인다(새 문구 없음 — 옛은 어느 도구에서 멈췄는지 보이지 않았다)
// - 성공하면 훅이 이 창을 닫고 토스트를 띄운다. 창을 닫아도 요청은 이어지고, 닫힌 뒤 실패는 경고 토스트다(app/deploy/useDeployToolset)
import { Fragment } from 'react';
import type { Tool, ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { EmphasisText } from '../discovery/CopyParts';
import type { DeployRequest } from '../layers';
import type { ModalContent } from '../sources/useModalAttempt';
import type { DeployAttempt } from './useDeployToolset';
import { deployHow, nextVersion, type DeployPlan } from './toolsetView';
import { FailureBlock, InlineCode, Notice } from '@/ui';
import styles from './DeployModals.module.css';

const M = DEPLOY.deployModal;
/** 도구 id 사이 — 옛 join(' ') */
const ID_SEPARATOR = ' ';

export type DeployConfirmInput = Readonly<{
  toolset: ToolsetWire;
  plan: DeployPlan;
  attempt: DeployAttempt;
  onDeploy: DeployRequest;
  /** 누르는 순간 먼저 저장할 도구 id(이 묶음 도구 중 초안이 있는 것, 묶음 순서) */
  currentDirtyIds: () => readonly string[];
}>;

/** 도구 id를 인라인 코드로 늘어놓는다 — 줄을 바꾼 뒤(옛 <br> + join(' ')) */
function ToolIds({ tools }: Readonly<{ tools: readonly Tool[] }>) {
  return (
    <>
      <br />
      {tools.map((tool, index) => (
        <Fragment key={`${index}:${tool.id}`}>
          {index > 0 ? ID_SEPARATOR : null}
          <InlineCode>{tool.id}</InlineCode>
        </Fragment>
      ))}
    </>
  );
}

function DeployResult({ attempt }: Readonly<{ attempt: DeployAttempt }>) {
  if (attempt.isPending) return <Notice spinner>{M.progress(attempt.hasDirty)}</Notice>;
  if (attempt.error === null) return null;
  const stopped = attempt.stoppedToolId;
  return (
    <FailureBlock
      tone="danger"
      message={attempt.error.message}
      title={stopped === null ? undefined : <InlineCode>{stopped}</InlineCode>}
    />
  );
}

function DeployConfirmBody({ toolset, plan, attempt }: Pick<DeployConfirmInput, 'toolset' | 'plan' | 'attempt'>) {
  const { ready, held, dirty } = plan;
  return (
    <>
      <p className={styles.lead}>
        <EmphasisText parts={M.body(ready.length, M.how[deployHow(toolset)])} />
      </p>
      {dirty.length > 0 ? (
        <Notice tone="warn" className={styles.dirty}>
          {M.dirty(dirty.length)}
          <ToolIds tools={dirty} />
        </Notice>
      ) : null}
      {held.length > 0 ? (
        <Notice tone="warn">
          {M.held(held.length)}
          <ToolIds tools={held} />
        </Notice>
      ) : null}
      <div className={styles.result}>
        <DeployResult attempt={attempt} />
      </div>
    </>
  );
}

const confirmLabelOf = (attempt: DeployAttempt): string => {
  if (attempt.isPending) return M.pending;
  return attempt.error === null ? M.confirm : M.retry;
};

export function deployConfirmContentOf({ toolset, plan, attempt, onDeploy, currentDirtyIds }: DeployConfirmInput): ModalContent {
  const title = M.title(toolset.name, nextVersion(toolset));
  if (plan.ready.length === 0) {
    return { title, body: <Notice tone="danger">{M.nonePublished}</Notice> };
  }
  return {
    title,
    confirmLabel: confirmLabelOf(attempt),
    onConfirm: () => onDeploy(currentDirtyIds()),
    isLocked: attempt.isPending,
    body: <DeployConfirmBody toolset={toolset} plan={plan} attempt={attempt} />,
  };
}

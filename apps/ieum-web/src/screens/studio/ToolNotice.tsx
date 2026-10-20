// 도구 상태 알림 띠 — 상태별 일곱 가지 중 처음 맞는 하나(옛 noticeHTML 순서 그대로 — js/menu/studio.js:57-68):
//   명세 변경(고칠 응답 필드 있음 → "새 필드로 매핑" · 없음 → 서버 driftMsg + "확인했고 계속 공개") → 검토 대기 + 쓰기(쓰기 안내가 탐색보다 먼저) →
//   검토 대기 + 자동 탐색(근거 둘 다면 정보, 아니면 경고 · 검증 라벨 · 서버 recNote · "탐색 근거 보기") → 검토 대기(명세) → 검토 대기(호출 샘플 추론) →
//   제외(서버 · 초안 offReason) → 공개 중이면 띠 없음
// 띠 버튼은 초안만 고친다(저장해야 서버에 간다). 띠 모양은 Notice 조합이다 — 굵은 첫 문장 · 인라인 코드(필드 이름은 글자 그대로) · 링크 버튼 · 오른쪽 작은 버튼
// 서버 사실과 다른 옛 문구("오늘 새벽" · "12건")는 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
import type { ReactNode } from 'react';
import type { Tool, ToolResField } from '../../api/types';
import { openEvidence } from '../../app/discovery/openEvidence';
import { verifyLabel } from '../../app/discovery/verifyLabel';
import type { DraftPatch } from '../../app/studio/drafts';
import { fixDriftPatch, includePatch, reviewDonePatch } from '../../app/studio/edit';
import { toast } from '../../app/toast';
import { STUDIO } from '../../copy/studio';
import { Button, InlineCode, LinkButton, Notice, type IconName, type NoticeTone } from '@/ui';
import styles from './StudioScreen.module.css';

const N = STUDIO.notice;

type ToolNoticeProps = Readonly<{
  /** 초안을 덮은 도구 */
  tool: Tool;
  /** 지금 보이는 값으로 초안을 고친다 */
  onEdit: (update: (view: Tool) => DraftPatch | null) => void;
}>;

type Band = Readonly<{
  tone: NoticeTone;
  icon: IconName;
  body: ReactNode;
  action: ReactNode;
}>;

/** 근거 종류 글자 — both · src 밖의 값은 운영 트래픽뿐(옛 삼항의 마지막 갈래) */
const evidenceText = (ev: string): string => {
  if (ev === 'both') return N.discEvidence.both;
  if (ev === 'src') return N.discEvidence.src;
  return N.discEvidence.tr;
};

/** 아직 고치지 않은 첫 명세 변경 응답 필드 */
const firstDrift = (res: readonly ToolResField[]): ToolResField | undefined => res.find((r) => r.drift && !r.fixed);

function bandOf(tool: Tool, act: (patch: (view: Tool) => DraftPatch, message: string) => void): Band | null {
  const reviewDone = (label: string) => (
    <Button size="sm" variant="primary" onClick={() => act(reviewDonePatch, STUDIO.toast.reviewDone(tool.id))}>
      {label}
    </Button>
  );
  const include = (label: string) => (
    <Button size="sm" onClick={() => act(includePatch, STUDIO.toast.include(tool.id))}>
      {label}
    </Button>
  );

  if (tool.status === 'drift') {
    const drift = firstDrift(tool.res);
    if (drift === undefined) {
      return {
        tone: 'warn',
        icon: 'alert',
        body: (
          <>
            <b>{N.driftTitle}</b> {tool.driftMsg ?? ''}
          </>
        ),
        action: include(N.keepPublic),
      };
    }
    return {
      tone: 'warn',
      icon: 'alert',
      body: (
        <>
          <b>{N.driftTitle}</b> {N.driftField.before}
          <InlineCode>{drift.o}</InlineCode>
          {N.driftField.arrow}
          <InlineCode>{drift.newO}</InlineCode>
          {N.driftField.mid}
          <InlineCode>{drift.a}</InlineCode>
          {N.driftField.after} {N.driftDetected}
        </>
      ),
      action: (
        <Button size="sm" variant="primary" onClick={() => act(fixDriftPatch, STUDIO.toast.fixDrift)}>
          {N.fixDrift}
        </Button>
      ),
    };
  }
  if (tool.status === 'review' && tool.mode === 'write') {
    return {
      tone: 'warn',
      icon: 'shield',
      body: (
        <>
          <b>{N.writeTitle}</b> {N.writeBody}
        </>
      ),
      action: reviewDone(N.reviewDone),
    };
  }
  if (tool.status === 'review' && tool.disc) {
    const { ev, verify, recNote, job, id } = tool.disc;
    return {
      tone: ev === 'both' ? 'info' : 'warn',
      icon: 'search',
      body: (
        <>
          <b>{N.discTitle}</b> {N.discBody(evidenceText(ev), verifyLabel(verify).label)}
          {ev === 'tr' ? ` ${N.discTrOnly}` : null}
          {recNote ? ` ${recNote}` : null}{' '}
          <LinkButton onClick={() => openEvidence(job, id)}>{N.discLink}</LinkButton>
        </>
      ),
      action: reviewDone(N.reviewDone),
    };
  }
  if (tool.status === 'review' && !tool.guess) {
    return {
      tone: 'info',
      icon: 'info',
      body: (
        <>
          <b>{N.reviewTitle}</b> {N.reviewBody}
        </>
      ),
      action: reviewDone(N.reviewDone),
    };
  }
  if (tool.status === 'review') {
    return {
      tone: 'info',
      icon: 'info',
      body: (
        <>
          <b>{N.guessTitle}</b> {N.guessBody}
        </>
      ),
      action: reviewDone(N.guessDone),
    };
  }
  if (tool.status === 'off') {
    return {
      tone: 'mute',
      icon: 'lock',
      body: (
        <>
          <b>{N.offTitle}</b> {tool.offReason ?? ''}
        </>
      ),
      action: include(N.include),
    };
  }
  return null;
}

export function ToolNotice({ tool, onEdit }: ToolNoticeProps) {
  const act = (patch: (view: Tool) => DraftPatch, message: string) => {
    onEdit(patch);
    toast(message);
  };
  const band = bandOf(tool, act);
  if (band === null) return null;
  return (
    <Notice tone={band.tone} icon={band.icon} action={band.action} className={styles.notice}>
      {band.body}
    </Notice>
  );
}

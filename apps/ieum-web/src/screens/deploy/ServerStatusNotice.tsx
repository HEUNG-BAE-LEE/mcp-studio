// 서버 상태 알림 — 배포한 묶음의 서버(이 컴퓨터의 프로세스) 상태에 따라(옛 rtNotice — js/menu/deploy.js:21-30)
// 초안: 없음 · crashed: 위험 알림 "**서버가 종료됐습니다.** {서버 문장}" + "다시 시작" · stopped: 회색 알림 + "시작"(play) · starting: 안내 알림(refresh, 버튼 없음) ·
// 그 밖(running · 모르는 상태 값): 상자 아래 흐린 안내 "이 서버는 이 컴퓨터(127.0.0.1)에서만 …"(옛 갈래 그대로 — 모르는 값도 실행 중 안내로 떨어진다).
// 알림 문장은 서버 문장의 줄바꿈을 지킨다(옛 인라인 pre-wrap). 알림 위 14, 안내 위 10(옛 인라인)
// "시작" · "다시 시작"은 서버 시작 요청(배포 화면이 쥔 useStartToolset)을 보낸다. 그 묶음이 요청 중이면 글자 "시작하는 중…" · 아이콘 없음 · 잠금(포커스 유지) —
// 요청 상태를 묶음 id로 읽어 폴링 · 묶음 전환 · 다시 들어오기를 거쳐도 이어진다(옛은 다음 폴링이 다시 그려 글자가 돌아왔다)
import type { Toolset } from '../../api/types';
import { serverNoticeOf } from '../../app/deploy/toolsetView';
import { useIsStarting } from '../../app/deploy/useToolsetMutations';
import { EmphasisText } from '../../app/discovery/CopyParts';
import { DEPLOY } from '../../copy/deploy';
import { Button, HelpText, Notice } from '@/ui';
import styles from './DeployScreen.module.css';

const N = DEPLOY.notice;

type ServerStatusNoticeProps = Readonly<{
  toolset: Toolset;
  /** 서버 시작 요청을 보낸다 */
  onStart: () => void;
}>;

function StartButton({ toolsetId, label, withIcon, onStart }: Readonly<{ toolsetId: string; label: string; withIcon: boolean; onStart: () => void }>) {
  const isStarting = useIsStarting(toolsetId);
  return (
    <Button
      size="sm"
      variant="primary"
      icon={withIcon && !isStarting ? 'play' : undefined}
      pending={isStarting}
      onClick={onStart}
    >
      {isStarting ? N.startPending : label}
    </Button>
  );
}

export function ServerStatusNotice({ toolset, onStart }: ServerStatusNoticeProps) {
  const kind = serverNoticeOf(toolset);
  if (kind === 'none') return null;
  if (kind === 'crashed') {
    return (
      <Notice
        tone="danger"
        preserveLines
        className={styles.notice}
        action={<StartButton toolsetId={toolset.id} label={N.restart} withIcon={false} onStart={onStart} />}
      >
        <EmphasisText parts={N.crashed(toolset.runtime.message ?? '')} />
      </Notice>
    );
  }
  if (kind === 'stopped') {
    return (
      <Notice
        tone="mute"
        preserveLines
        className={styles.notice}
        action={<StartButton toolsetId={toolset.id} label={N.start} withIcon onStart={onStart} />}
      >
        <EmphasisText parts={N.stopped} />
      </Notice>
    );
  }
  if (kind === 'starting') {
    return (
      <Notice icon="refresh" preserveLines className={styles.notice}>
        {N.starting}
      </Notice>
    );
  }
  return <HelpText className={styles.hint}>{N.runningHint}</HelpText>;
}

// 도구 호출 칸 — 왼쪽 대화 상자(옛 vPlay section "도구 호출" — js/menu/playground.js:41-55)
// 머리 첫 줄: 제목 + "호출 사용자 {workspace.user}", 둘째 줄: AI 모델 라디오(서버 순서 — 직접 호출에만 쓴다. 바꿔도 지금 결과는 그대로, 옛 :109).
// 본문: 직접 호출 폼(도구 · 설명 · 인자 · 실행/초기화) 다음에 대화(키 있음) 또는 키 없음 안내(인라인 코드).
// "실행"은 이 칸이 그린 phase가 running이면 요청 중 잠금(Button pending — 포커스가 버튼에 남는다)과 "호출하는 중…". 잠금은 저장소의 그린 phase
// (drawn.call)로 해서 메뉴를 다녀와도 이어지고, 실행 중 대화를 보내거나 대화가 끝나도 풀리지 않는다(옛은 그때 이 칸을 다시 그리지 않았다 — :95,102). "초기화"는 요청 중에도 막지 않는다 — 늦은 응답이 결과를 다시 쓴다(옛 :50,113)
import { useMemo } from 'react';
import type { PlaygroundResponse, Tool } from '../../api/types';
import { reset, setModel, useDrawnCallPhase, usePlaygroundModel } from '../../app/playground/store';
import type { ToolGroup } from '../../app/playground/view';
import { PLAYGROUND } from '../../copy/playground';
import { Box, Button, HelpText, Icon, InlineCode, SegmentedRadio, type SegmentedItem } from '@/ui';
import { ArgForm } from './ArgForm';
import { ChatPanel } from './ChatPanel';
import { ToolSelect } from './ToolSelect';
import styles from './PlaygroundScreen.module.css';

const PG = PLAYGROUND;

type CallPanelProps = Readonly<{
  /** 지금 고른 도구(주소 ?tool=) */
  tool: Tool;
  groups: readonly ToolGroup[];
  /** workspace.user */
  user: string;
  playground: PlaygroundResponse;
  onPickTool: (toolId: string) => void;
  /** "실행" — 지금 폼 값 · 지금 모델로 직접 호출 */
  onRun: () => void;
}>;

export function CallPanel({ tool, groups, user, playground, onPickTool, onRun }: CallPanelProps) {
  const model = usePlaygroundModel();
  const isRunning = useDrawnCallPhase() === 'running';
  const { models } = playground;
  const modelItems = useMemo<readonly SegmentedItem[]>(
    () => Object.entries(models).map(([value, info]) => ({ value, label: info.label })),
    [models],
  );

  return (
    <Box
      variant="chat"
      label={PG.call.title}
      title={PG.call.title}
      actions={
        <span className={styles.ctx}>
          <Icon name="user" size="sm" className={styles.ctxIcon} />
          {PG.call.user(user)}
        </span>
      }
      headBelow={<SegmentedRadio label={PG.call.modelGroup} items={modelItems} value={model} onValueChange={setModel} />}
    >
      <div className={styles.direct}>
        <ToolSelect groups={groups} value={tool.id} onPick={onPickTool} />
        <HelpText>{tool.desc}</HelpText>
        <ArgForm tool={tool} />
        <div className={styles.runRow}>
          <Button variant="primary" icon="play" pending={isRunning} onClick={onRun}>
            {isRunning ? PG.run.busy : PG.run.idle}
          </Button>
          <Button icon="refresh" onClick={reset}>
            {PG.reset}
          </Button>
        </div>
      </div>
      {playground.chatEnabled ? (
        <ChatPanel user={user} />
      ) : (
        <HelpText className={styles.chatOff}>
          {PG.chat.disabledBefore}
          <InlineCode>{PG.chat.disabledCode}</InlineCode>
          {PG.chat.disabledAfter}
        </HelpText>
      )}
    </Box>
  );
}

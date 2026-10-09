// PlaygroundScreen — 도구를 실제로 불러 AI 호출이 원본 요청 · 응답으로 바뀌는 과정을 단계별로 본다(직접 호출 · 쓰기 확인 대기 · 자연어 대화)
// 진입: LNB "테스트 실행"(마지막 주소 — ?tool= 유지) · 변환 스튜디오 도구 머리 "테스트 실행"(지난 결과만 비우고 push — app/playground/store clearOut) · 주소
// 주소: /playground?tool=<도구 id> — 없음 · 모름 · 제외면 공개 대상 첫 도구로 고쳐 replace, 도구 select도 replace(옛 js/menu/playground.js:37,117).
//       모델 · 인자 · 결과 · phase · 대화는 주소에 두지 않는다(app/playground/store — 메뉴를 옮겨도 남고 새로고침에 빈다)
// 영역: 머리 = PageHead · 두 칸 = SplitLayout playground(CallPanel = Box chat — 호출 사용자 · SegmentedRadio · ToolSelect · ArgForm · 실행/초기화 ·
//       ChatPanel(ChatLog · ChatInput) 또는 키 없음 안내 / TracePanel = Box — EmptyState area 또는 TraceView + ApprovalBox)
// 조회: 화면 useSources · useTools · usePlayground(screenGate — 셋 다 부팅 자원, 다시 받지 않음 · 폴링 없음).
//       쓰기 useRunTool · useChat(app/playground/usePlaygroundMutations — 상태 · 토스트는 훅 정의 쪽이라 화면을 떠나도 결과가 남는다)
// 상태: 첫 로딩 = 본문 비움 + aria-busy · 화면 실패 = 본문 자리 실패 상자 · 처음 빈 상태(공개 대상 도구 0개) = 머리 + 점선 상자(원본 시스템 링크) ·
//       결과 없음 = 변환 과정 칸 안내 그림 · 직접 호출 중 = 실행 요청 중 잠금 · 대화 중 = 보내기 요청 중 잠금 · 실패 = 경고 토스트(직접) · 오류 말풍선(대화) · 실패 단계(ok:false)
// 옛 근거: apps/web/ieum/js/menu/playground.js · js/common/convert.js:166-196
// 처음 빈 상태의 "원본 시스템" 링크는 원본 메뉴의 마지막 주소로 간다(옛 nav — 변환 스튜디오 빈 상태와 같다, js/menu/playground.js:36 · js/main.js:29)
import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayground } from '../../api/hooks/usePlayground';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import type { PlaygroundResponse, Source } from '../../api/types';
import { useMenuHref } from '../../app/lastPath';
import { refreshMenu } from '../../app/menuRefresh';
import { redraw, selectTool } from '../../app/playground/store';
import { useRunTool } from '../../app/playground/usePlaygroundMutations';
import { isPlayable, pickToolId, toolGroups } from '../../app/playground/view';
import { screenGate } from '../../app/screenGate';
import { withParam } from '../../app/searchParams';
import { own } from '../../app/trace/own';
import { PLAYGROUND } from '../../copy/playground';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { EmptyState, LinkButton, PageHead, ScreenState, SplitLayout } from '@/ui';
import { CallPanel } from './CallPanel';
import { TracePanel } from './TracePanel';
import styles from './PlaygroundScreen.module.css';

/** 고른 도구를 싣는 검색 파라미터 */
const TOOL_PARAM = 'tool';

const PAGE_HEAD = <PageHead title={SCREEN_LABEL.playground} description={PAGE_DESCRIPTION.playground} />;

/** 처음 빈 상태 — 공개 대상(제외가 아닌) 도구가 없다. 두 칸을 그리지 않는다(옛 :35-36) */
function PlaygroundEmpty() {
  const sourcesHref = useMenuHref('sources');
  return (
    <>
      {PAGE_HEAD}
      <EmptyState kind="first" container="panel" className={styles.empty}>
        {PLAYGROUND.empty.before}
        <LinkButton to={sourcesHref} onClick={() => refreshMenu('sources')}>
          {PLAYGROUND.empty.link}
        </LinkButton>
        {PLAYGROUND.empty.after}
      </EmptyState>
    </>
  );
}

type PlaygroundBodyProps = Readonly<{
  sources: readonly Source[];
  /** workspace.user — 호출 사용자 표시 · 요청 본문 user */
  user: string;
  tools: ToolIndex;
  playground: PlaygroundResponse;
}>;

function PlaygroundBody({ sources, user, tools, playground }: PlaygroundBodyProps) {
  const [params, setParams] = useSearchParams();
  const requested = params.get(TOOL_PARAM);
  const toolId = pickToolId(requested, tools.byId);
  const tool = toolId === null ? undefined : own(tools.byId, toolId);
  const run = useRunTool();

  // 그리기 전에 주소를 고른 도구로 고친다(replace) — 고치기 전 주소가 히스토리 · 마지막 주소에 남지 않게
  useLayoutEffect(() => {
    if (toolId !== null && toolId !== requested) setParams((prev) => withParam(prev, TOOL_PARAM, toolId), { replace: true });
  }, [toolId, requested, setParams]);

  if (tool === undefined) return <PlaygroundEmpty />;

  // 도구를 바꾸면 결과를 비우고 idle로 — 대화 · 모델 · 다른 도구 인자는 그대로, 요청 중이어도 막지 않는다(옛 :117)
  const onPickTool = (id: string) => {
    selectTool();
    setParams((prev) => withParam(prev, TOOL_PARAM, id), { replace: true });
  };

  return (
    <>
      {PAGE_HEAD}
      <SplitLayout variant="playground" className={styles.split}>
        <CallPanel
          tool={tool}
          groups={toolGroups(sources, tools.bySource)}
          user={user}
          playground={playground}
          onPickTool={onPickTool}
          onRun={() => run({ tool, user, approved: false })}
        />
        <TracePanel
          tools={tools}
          sources={sources}
          models={playground.models}
          onApprove={() => run({ tool, user, approved: true })}
        />
      </SplitLayout>
    </>
  );
}

export function PlaygroundScreen() {
  // 들어올 때 한 번 칸마다 그린 phase를 지금 phase로 — 옛은 메뉴에 들어오면 전체를 다시 그렸다(js/main.js:15). 그리기 전에 맞춘다
  useLayoutEffect(() => {
    redraw();
  }, []);
  const sources = useSources();
  const tools = useTools();
  const playground = usePlayground();
  const gate = screenGate(
    { sources, tools, playground },
    { isEmpty: (data) => !data.tools.all.some(isPlayable) },
  );

  return (
    <ScreenState gate={gate} empty={() => <PlaygroundEmpty />}>
      {(data) => (
        <PlaygroundBody
          sources={data.sources.sources}
          user={data.sources.workspace.user}
          tools={data.tools}
          playground={data.playground}
        />
      )}
    </ScreenState>
  );
}

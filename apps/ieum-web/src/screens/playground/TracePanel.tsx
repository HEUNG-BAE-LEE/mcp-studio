// 변환 과정 칸 — 오른쪽 상자(옛 renderTrace · section "변환 과정" — js/menu/playground.js:56-58,69-80)
// 머리: 제목 + 작은 부제 "{도구 id}, {원본 이름}"(결과가 없거나 도구 · 원본을 찾지 못하면 없음). 결과가 없으면 안내 그림 두 줄,
// 있으면 변환 과정 단계(app/trace buildTraceSteps — 확인 대기 그림은 이 칸이 그린 phase(drawn.trace) === 'hold'로만 가른다, 옛 :78-79.
// 대화를 보낸 동안에는 확인 상자가 남아 누를 수 있고 대화가 끝나야 바뀐다 — 옛 :95,102).
// 확인 대기면 사용자 확인 단계 본문에 확인 상자를 넣는다. 결과가 와도 이 칸으로 스크롤하지 않고 읽어 주지도 않는다(옛 그대로).
// 확인 상자의 실행 · 그만두기로 상자가 사라져 포커스가 빠지면 이 상자 제목(tabIndex -1 — Box 제목은 포커스를 받지 않아 제목 글을 감싼다)으로 옮긴다
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ToolIndex } from '../../api/hooks/useTools';
import type { Source } from '../../api/types';
import { holdRows } from '../../app/playground/args';
import { reject, useDrawnTracePhase, usePlaygroundModel, usePlaygroundOut } from '../../app/playground/store';
import { holdQuestion, playgroundTraceInput, traceSubtitle } from '../../app/playground/view';
import { buildTraceSteps, type TraceModels } from '../../app/trace/buildTraceSteps';
import { PLAYGROUND } from '../../copy/playground';
import { Box, EmptyState, TraceView } from '@/ui';
import { ApprovalBox } from './ApprovalBox';

const T = PLAYGROUND.trace;

type TracePanelProps = Readonly<{
  tools: ToolIndex;
  sources: readonly Source[];
  /** 테스트 실행 조회의 models — 1단계 라벨 · 호출 형식 */
  models: TraceModels;
  /** 확인 상자 "실행" — 지금 고른 도구를 지금 폼 값 · 지금 모델로 approved 호출 */
  onApprove: () => void;
}>;

/** 확인 상자가 사라지며 포커스가 빠졌으면 제목으로 — 그리기마다(layout) 본다. 상자 정리가 표시를 남긴 같은 그리기에서 옮긴다 */
function useHoldFocusFallback() {
  const titleRef = useRef<HTMLSpanElement>(null);
  const isFocusLost = useRef(false);
  useLayoutEffect(() => {
    if (!isFocusLost.current) return;
    isFocusLost.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) titleRef.current?.focus();
  });
  const markFocusLost = useCallback(() => {
    isFocusLost.current = true;
  }, []);
  return { titleRef, markFocusLost };
}

export function TracePanel({ tools, sources, models, onApprove }: TracePanelProps) {
  const out = usePlaygroundOut();
  const drawnPhase = useDrawnTracePhase();
  const model = usePlaygroundModel();
  const focusFallback = useHoldFocusFallback();
  const steps = useMemo(
    () =>
      out === null ? [] : buildTraceSteps(playgroundTraceInput(out, { drawnPhase, model, byId: tools.byId, sources, models })),
    [out, drawnPhase, model, tools.byId, sources, models],
  );
  const subtitle = traceSubtitle(out, tools.byId, sources);

  return (
    <Box
      label={T.title}
      title={
        <span ref={focusFallback.titleRef} tabIndex={-1}>
          {T.title}
        </span>
      }
      description={subtitle === '' ? undefined : subtitle}
    >
      {out === null ? (
        <EmptyState kind="idle" container="area" icon="layers">
          {T.empty1}
          <br />
          {T.empty2}
        </EmptyState>
      ) : (
        <TraceView
          steps={steps}
          container="box"
          holdSlot={
            drawnPhase === 'hold' ? (
              <ApprovalBox
                question={holdQuestion(out, tools.byId)}
                rows={holdRows(out.trace.args)}
                onApprove={onApprove}
                onReject={reject}
                onFocusLost={focusFallback.markFocusLost}
              />
            ) : undefined
          }
        />
      )}
    </Box>
  );
}

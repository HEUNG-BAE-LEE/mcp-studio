// 분석 단계의 가짜 진행 — 옛 wzAnalyze(js/menu/sources.js:112-116) 그대로: 시작 0.5초 뒤 한 칸, 그 뒤 0.7초마다 한 칸, 마지막 칸에서 기다린다.
// 서버(POST /sources/connect/)는 단계 신호 없이 한 번에 응답한다 — 이 진행은 연출이다(이식 기간 보존 목록)
// 멈춤: running이 false가 되는 순간 — 응답이 왔거나, 드로어 칸이 이 시도를 더는 보이지 않을 때(닫힘 · 다시 열기 · 메뉴 이동).
// 쓰는 곳이 running에 "드로어가 이 시도를 보이는가"를 넣는다 — 층 호스트가 닫힌 뒤에도 내용을 남기므로 언마운트를 기다리면
// 닫힌 드로어 안에서 타이머가 돈다(옛 closeDrawer는 그 순간 clearTimeout — js/common/overlay.js:12)
// runKey가 바뀌면(새 분석 · 새 시도) 0부터 센다(옛 w.an = 0)
import { useEffect, useState } from 'react';

const FAKE_START_MS = 500;
const FAKE_STEP_MS = 700;

type Progress = Readonly<{ runKey: string; index: number }>;

/** 한 칸 앞으로 — 다른 분석의 값이거나 마지막 칸이면 그대로 */
const advance =
  (runKey: string, lastIndex: number) =>
  (prev: Progress): Progress =>
    prev.runKey !== runKey || prev.index >= lastIndex ? prev : { runKey, index: prev.index + 1 };

/** 지금 진행 중인 칸(0부터). lastIndex에서 멈춰 기다린다 */
export function useFakeProgress(runKey: string, running: boolean, lastIndex: number): number {
  const [progress, setProgress] = useState<Progress>({ runKey, index: 0 });
  // 새 분석이면 그리기 전에 0으로 되돌린다(렌더 중 상태 맞추기 — 이전 분석의 칸이 한 번도 보이지 않게)
  const current = progress.runKey === runKey ? progress : { runKey, index: 0 };
  if (current !== progress) setProgress(current);

  useEffect(() => {
    if (!running) return;
    // 옛 tick처럼 한 칸 움직인 뒤 다음 시각을 다시 건다
    let timer = setTimeout(function tick() {
      setProgress(advance(runKey, lastIndex));
      timer = setTimeout(tick, FAKE_STEP_MS);
    }, FAKE_START_MS);
    return () => clearTimeout(timer);
  }, [runKey, running, lastIndex]);

  return current.index;
}

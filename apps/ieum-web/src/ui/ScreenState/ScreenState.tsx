// ScreenState — 조회 상태 판정(app/screenGate의 screenGate · regionGate) 결과를 그리기만 한다. 판정 로직을 두지 않는다.
// pending: 그 자리를 비우고 aria-busy만(문구 · 스피너 없음 — 옛 부트 js/main.js:65와 같은 모양)
// error: screen = 본문 자리 실패 상자(머리 = 옛 부트 실패 문장 js/main.js:67 · 재시도 버튼 없음 · aria-busy 해제) · region = 그 상자 안 원문만
// not-found: notFound(없으면 실패로) · empty: empty(data)(없으면 children) · ready: children(data)
import type { ReactNode } from 'react';
import type { Gate } from '@/app/screenGate';
import { statusFailed } from '../../copy/errors';
import { SCREEN_FAILED_TITLE } from '../../copy/shell';
import { ErrorBlock, FailureBlock } from '../FailureBlock';

/** 판정 결과 — app/screenGate의 Gate<D> 그대로(타입만 가져온다 — 번들 의존 없음). 두 곳에 따로 적어 어긋나지 않게 한다 */
export type ScreenGate<D> = Gate<D>;

export type ScreenStateScope = 'screen' | 'region';

export type ScreenStateProps<D> = {
  gate: ScreenGate<D>;
  /** ready에 그린다(empty인데 empty prop이 없을 때도) */
  children: (data: D) => ReactNode;
  /** empty에 그린다 — 대개 EmptyState */
  empty?: (data: D) => ReactNode;
  /** not-found에 그린다(없는 탐색 작업 주소). 없으면 실패 상자 */
  notFound?: ReactNode;
  /** 실패 모양 — screen = FailureBlock + 머리, region = ErrorBlock. 기본 screen */
  scope?: ScreenStateScope;
};

/** not-found를 그릴 자리가 없을 때의 원문 — 데이터 층이 404에 내는 고정 문구와 같다(copy/errors statusFailed) */
const NOT_FOUND_STATUS = 404;

/** 실패 원문 — ApiError(Error)는 message, 그 밖은 문자열로 바꾼 값 */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function Failure({ scope, message }: { scope: ScreenStateScope; message: string }) {
  return scope === 'region' ? (
    <ErrorBlock message={message} />
  ) : (
    <FailureBlock tone="warn" title={SCREEN_FAILED_TITLE} message={message} />
  );
}

export function ScreenState<D>({ gate, children, empty, notFound, scope = 'screen' }: ScreenStateProps<D>) {
  switch (gate.kind) {
    case 'pending':
      return <div data-state="pending" aria-busy="true" />;
    case 'error':
      return <Failure scope={scope} message={messageOf(gate.error)} />;
    case 'not-found':
      return notFound ?? <Failure scope={scope} message={statusFailed(NOT_FOUND_STATUS)} />;
    case 'empty':
      return empty ? empty(gate.data) : children(gate.data);
    case 'ready':
      return children(gate.data);
  }
}

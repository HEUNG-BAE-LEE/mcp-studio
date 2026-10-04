// apps/web/src/app/useLeaveGuard.tsx — 화면 안 폼의 나가기 확인(DESIGN 층 선택 · 저장하지 않은 변경): 바뀐 값이 있는 채 다른 경로로 가려 하면 확인 Dialog를 연다
// 층(모달)의 닫기 확인은 ui `useUnsavedClose`. 이 훅은 라우트 이동을 막는다 — 라우터가 필요해 `app/`에 둔다
import { useEffect, useRef, type ReactElement } from 'react';
import { useBlocker, useLocation } from 'react-router';
import { Button, CANCEL_LABEL, Dialog } from '@/ui';
import { LEAVE_LABELS } from '../copy/common';
import { useFrameContainer } from './frame';

export type LeaveGuard = {
  /** 확인 Dialog — 화면 어디에 그려도 된다(층은 프레임으로 포털된다) */
  dialog: ReactElement;
  /** 바로 다음 이동 한 번은 확인 없이 보낸다 — 저장 · 삭제 성공 뒤 의도한 이동. 값이 바뀌거나 경로가 바뀌면 거둔다 */
  allowLeave: () => void;
};

/** 같은 경로 안의 이동(검색 문자열만 바뀜)은 화면을 나가는 것이 아니다 */
const isLeavingPath = (current: { pathname: string }, next: { pathname: string }) =>
  current.pathname !== next.pathname;

export function useLeaveGuard({ isDirty }: { isDirty: boolean }): LeaveGuard {
  const container = useFrameContainer();
  const { pathname } = useLocation();
  const isAllowed = useRef(false);
  // allowLeave는 바로 다음 이동 한 번만 — 값이 다시 바뀌거나 경로가 바뀌면(같은 화면 컴포넌트가 남는 이동) 거둔다
  useEffect(() => {
    isAllowed.current = false;
  }, [isDirty, pathname]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !isAllowed.current && isLeavingPath(currentLocation, nextLocation),
  );
  const dialog = (
    <Dialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
      container={container}
      title={LEAVE_LABELS.title}
      actions={{
        cancel: <Button>{CANCEL_LABEL}</Button>,
        confirm: (
          <Button
            variant="danger"
            onClick={(e) => {
              // 열림은 blocker 상태가 정한다 — 이동이 시작되면 Dialog가 저절로 닫힌다
              e.preventDefault();
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            {LEAVE_LABELS.discard}
          </Button>
        ),
      }}
    />
  );
  return {
    dialog,
    allowLeave: () => {
      isAllowed.current = true;
    },
  };
}

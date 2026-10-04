import {
  forwardRef,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { IconButton } from '../IconButton';
import { LNBLogo } from '../LNBPanel';
import { PANEL_TOGGLE_SELECTOR } from '../LNBPanel/LNBPanel';
import { cappedCount } from '../lib/cappedCount';
import { cx } from '../lib/cx';
import { useMergedRefs } from '../lib/mergeRefs';
import styles from './LNB.module.css';
import { useHoverIntent } from './useHoverIntent';
import { useToggleFocus } from './useToggleFocus';
import { LNB_WIDTH } from './width';

const LNB_MIN = LNB_WIDTH.min;
const LNB_MAX = LNB_WIDTH.max;
/** 핸들 포커스 ←/→ — 폭 계산(8px)은 호출자 몫 */
const RESIZE_KEYS: Readonly<Record<string, -1 | 1>> = { ArrowLeft: -1, ArrowRight: 1 };

/** 레일 컨트롤(검색 · 펼치기 · 알림 수) 위의 포인터는 열 진입으로 치지 않는다 — 플로팅이 레일을 덮어 누를 수 없게 되지 않도록 */
const isRailControl = (target: EventTarget) =>
  target instanceof Element && target.closest('button') !== null;

/** 접힘 레일(로고 · 검색 · 펼치기 · 알림 수) 동작 */
export type LNBRail = {
  onSearch: () => void;
  /** 없으면 `onToggle` */
  onExpand?: () => void;
  /** 0이면 알림 수를 그리지 않는다. 99를 넘으면 `99+`로 보인다(읽기 이름은 실제 수 — CountDot과 같다) */
  alertCount: number;
  onAlerts?: () => void;
};

export type LNBProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** 펼침 폭(px, 호출자 값 180–400) */
  width: number;
  /** 접힘 48 레일 */
  collapsed: boolean;
  /** 접힘 + 포인터 진입 — 열 위에 `width` 폭 플로팅 패널 */
  floating: boolean;
  /** 1024 — 펼침도 레일 폭 열을 두고 패널을 플로팅과 같은 꼴로 본문 위에 띄운다(핸들 없음). 패널 안 Esc는 `onToggle` */
  narrow?: boolean;
  /** 펼침 ↔ 접힘. 레일 펼치기 버튼의 기본 동작 · `narrow` 펼침의 Esc(패널 안 접기 버튼은 `panel` 쪽 `onToggle`로 연결한다) */
  onToggle: () => void;
  /** 드래그 핸들(7px 히트 띠, `role="separator"`) pointerdown. `e.currentTarget`은 히트 요소 — `setPointerCapture` 대상. 폭 계산 · 저장은 호출자 */
  onResizeStart: (e: PointerEvent<HTMLDivElement>) => void;
  /** 핸들 포커스 ←(-1) · →(1). 없으면 키를 가로채지 않는다(규칙 12). clamp(`LNB_WIDTH.min`–`LNB_WIDTH.max`)는 호출자 몫 */
  onResizeKey?: (direction: -1 | 1) => void;
  /** 핸들 `aria-valuemin`. 기본 `LNB_WIDTH.min`(width.ts) */
  minWidth?: number;
  /** 핸들 `aria-valuemax`. 기본 `LNB_WIDTH.max`(width.ts) */
  maxWidth?: number;
  /** 접힘 레일(컨트롤 위 제외) · 플로팅 패널 포인터 진입(`LNB_HOVER_ENTER_MS` 뒤 true) / 이탈(`LNB_HOVER_LEAVE_MS` 뒤 false). 지연은 LNB가 한다 */
  onHoverChange: (hovering: boolean) => void;
  /** `<LNBPanel>` */
  panel: ReactNode;
  rail: LNBRail;
};

/** 사이드바 제어 컴포넌트 — 상태는 모두 prop. 플로팅은 부모(AppShell 프레임, position: relative) 기준 절대 배치 */
export const LNB = forwardRef<HTMLElement, LNBProps>(function LNB(
  {
    width,
    collapsed,
    floating,
    narrow = false,
    onToggle,
    onResizeStart,
    onResizeKey,
    minWidth = LNB_MIN,
    maxWidth = LNB_MAX,
    onHoverChange,
    panel,
    rail,
    className,
    ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLElement>(null);
  const railExpandRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergedRefs(ref, rootRef);
  // 1024 펼침은 열을 레일 폭으로 두고 패널을 플로팅 자리에 띄운다 — 본문을 밀지 않는다
  const isPanelInline = !collapsed && !narrow;
  const isOverlay = !collapsed && narrow;
  const markFocus = useToggleFocus(rootRef, !collapsed, (expanded) =>
    expanded
      ? (rootRef.current?.querySelector<HTMLElement>(PANEL_TOGGLE_SELECTOR) ?? null)
      : railExpandRef.current,
  );
  const reportHover = useHoverIntent(floating, collapsed, onHoverChange);
  const hoverHandlers = {
    onMouseEnter: () => reportHover(true),
    onMouseLeave: () => reportHover(false),
  };
  // 접힘 레일만 플로팅을 연다. 레일 컨트롤 위면 이탈로 알려 예약된 열기를 거둔다(mouseover는 요소 경계마다 온다)
  const railHoverHandlers = collapsed
    ? {
        onMouseOver: (e: MouseEvent<HTMLDivElement>) => reportHover(!isRailControl(e.target)),
        onMouseLeave: () => reportHover(false),
      }
    : {};
  const onHandleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = RESIZE_KEYS[e.key];
    if (direction === undefined || !onResizeKey) return;
    e.preventDefault();
    onResizeKey(direction);
  };
  const onOverlayKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    markFocus();
    onToggle();
  };
  return (
    <nav
      {...rest}
      aria-label="사이드바"
      className={cx(styles.root, className)}
      data-narrow={narrow || undefined}
      ref={mergedRef}
      onClickCapture={(e) => {
        rest.onClickCapture?.(e);
        markFocus();
      }}
    >
      <div
        className={styles.column}
        style={{ width: isPanelInline ? width : LNB_WIDTH.collapsed }}
        {...railHoverHandlers}
      >
        {collapsed ? (
          <Rail rail={rail} onExpand={rail.onExpand ?? onToggle} expandRef={railExpandRef} />
        ) : null}
        {isPanelInline ? <div className={styles.panelSlot}>{panel}</div> : null}
      </div>
      {isPanelInline ? (
        // 0폭 자리. 상호작용은 7px 히트 띠가 받는다 — 포커스 링이 띠 둘레에 보인다(규칙 12)
        <div className={styles.handle}>
          {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- 포커스 가능한 separator(aria-valuenow)는 ARIA상 위젯이다. jsx-a11y는 separator를 비대화형으로만 본다 */}
          <div
            className={styles.handleHit}
            role="separator"
            aria-orientation="vertical"
            aria-label="사이드바 폭"
            aria-valuenow={width}
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onKeyDown={onHandleKeyDown}
          />
          {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        </div>
      ) : null}
      {floating || isOverlay ? (
        // narrow 펼침의 Esc는 패널 안 컨트롤에서 버블링된 키를 받는다 — 상자 자체는 포커스를 받지 않는다
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          className={styles.floating}
          data-floating="true"
          style={{ width }}
          onKeyDown={isOverlay ? onOverlayKeyDown : undefined}
          {...(isOverlay ? {} : hoverHandlers)}
        >
          <div className={styles.floatingSlot}>{panel}</div>
        </div>
      ) : null}
    </nav>
  );
});

type RailProps = { rail: LNBRail; onExpand: () => void; expandRef: Ref<HTMLButtonElement> };

function Rail({ rail, onExpand, expandRef }: RailProps) {
  return (
    <div className={styles.rail}>
      <LNBLogo />
      <IconButton
        icon="search"
        title="검색"
        className={styles.railControl}
        onClick={rail.onSearch}
      />
      <IconButton
        ref={expandRef}
        icon="sidebar-expand"
        title="사이드바 펼치기"
        className={styles.railControl}
        onClick={onExpand}
      />
      {rail.alertCount > 0 ? (
        <button
          type="button"
          className={styles.railCount}
          title="알림"
          aria-label={`알림 ${rail.alertCount}`}
          onClick={rail.onAlerts}
        >
          {cappedCount(rail.alertCount)}
        </button>
      ) : null}
    </div>
  );
}

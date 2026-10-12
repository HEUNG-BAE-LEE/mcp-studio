// Drawer — 이음 openDrawer(js/common/overlay.js:4-14) · .drawer · .d-head · .d-body · .d-foot(css/console.css:242-254, index.html:43).
// 머리(윗띠 + 라벨 · 제목 · 설명 + ✕) · 본문(넘치면 본문만 스크롤) · 발(왼쪽 정보 · 오른쪽 버튼). 층 공통 동작은 ui/layers
// (show() · 가두지 않음 · Esc 맨 위 층 · 닫으면 연 컨트롤로 포커스 복귀). 층 종류 drawer — useOpenLayers().drawer가 켜진다(도크 숨김)
// 첫 포커스: 드로어 안 문서 순서로 첫 버튼 · 입력(잠긴 것 제외) — 머리 ✕가 앞이면 ✕(js/common/overlay.js:8)
// 열린 채 다른 항목(contentKey가 바뀜): 옛 openDrawer 재호출처럼 그 순간의 포커스를 복귀 대상으로 다시 잡고 ✕로 옮기며 본문을 맨 위로(js/common/overlay.js:5,8)
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LAYER_COPY } from '../../copy/shell';
import { IconButton } from '../IconButton';
import { Overlay } from '../layers/Overlay';
import { useLayerDialog } from '../layers/useLayerDialog';
import styles from './Drawer.module.css';

export type DrawerProps = {
  open: boolean;
  /** ✕ · Esc · 가림막이 onOpenChange(false)를 부른다. 발의 닫기 버튼은 쓰는 곳이 넣고 부른다 */
  onOpenChange: (open: boolean) => void;
  /** 머리 제목(h3) — aria-labelledby 대상 */
  title: ReactNode;
  /** 제목을 고정폭 글꼴로(도구 id · 메서드 경로 — js/menu/logs.js:35 h3.mono) */
  titleMono?: boolean;
  /** 제목 위 작은 라벨(--primary — .ag) */
  overline?: ReactNode;
  /** 제목 아래 설명 한 줄 */
  description?: ReactNode;
  children: ReactNode;
  /** 발 오른쪽 버튼들 — 닫기("닫기" primary)도 쓰는 곳이 넣는다 */
  footer?: ReactNode;
  /** 발 왼쪽 정보 — 굵은 글(<b>)은 --primary */
  footerInfo?: ReactNode;
  /** 바뀌면 본문 스크롤을 맨 위로(마법사 단계 이동) */
  scrollResetKey?: string | number;
  /** 보이는 항목(행 id 등) — 열린 채 바뀌면 다시 연 것으로 친다: 그 순간의 포커스를 복귀 대상으로 · 첫 포커스(✕)로 · 본문 맨 위로 */
  contentKey?: string | number;
  /** false면 Esc · 가림막으로 닫히지 않는다. ✕는 그대로 닫는다 */
  dismissible?: boolean;
  /** 연 컨트롤이 닫힐 때 사라졌으면 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null;
};

// 첫 포커스 대상 — 옛 querySelector('.icon-btn, button, input')와 같은 문서 순서. 숨김 · 잠긴 것은 포커스를 받지 못해 뺀다
const FIRST_FOCUSABLE = 'button:not(:disabled), input:not([type="hidden"]):not(:disabled)';
const initialFocusOf = (dialog: HTMLDialogElement): HTMLElement | null =>
  dialog.querySelector<HTMLElement>(FIRST_FOCUSABLE);

export function Drawer({
  open,
  onOpenChange,
  title,
  titleMono = false,
  overline,
  description,
  children,
  footer,
  footerInfo,
  scrollResetKey,
  contentKey,
  dismissible = true,
  returnFocusFallback,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => onOpenChange(false);
  useLayerDialog(dialogRef, {
    layer: 'drawer',
    open,
    onOpenChange,
    dismissible,
    initialFocus: initialFocusOf,
    returnFocusFallback,
    contentKey,
  });

  // 열 때 · 단계나 항목이 바뀔 때 본문을 맨 위에서 보인다(옛은 열 때마다 내용을 새로 그려 스크롤이 처음이었다)
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [open, scrollResetKey, contentKey]);

  const hasFoot = footer !== undefined || footerInfo !== undefined;
  return createPortal(
    <>
      <Overlay layer="drawer" open={open} onDismiss={dismissible ? close : undefined} />
      <dialog
        ref={dialogRef}
        className={styles.root}
        data-dismissible={dismissible}
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <div className={styles.titles}>
            {overline !== undefined ? <div className={styles.overline}>{overline}</div> : null}
            <h3 id={titleId} className={styles.title} data-mono={titleMono}>
              {title}
            </h3>
            {description !== undefined ? <p className={styles.description}>{description}</p> : null}
          </div>
          <IconButton label={LAYER_COPY.close} icon="close" iconSize="xl" onClick={close} />
        </div>
        <div ref={bodyRef} className={styles.body}>
          {children}
        </div>
        {hasFoot ? (
          <div className={styles.foot}>
            {/* 정보 칸은 비어도 둔다 — 버튼을 오른쪽으로 미는 자리다(옛 .d-foot .info) */}
            <span className={styles.info}>{footerInfo}</span>
            {footer}
          </div>
        ) : null}
      </dialog>
    </>,
    document.body,
  );
}

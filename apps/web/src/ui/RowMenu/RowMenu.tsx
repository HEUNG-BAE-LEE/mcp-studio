import { forwardRef, useRef, type MouseEvent, type ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { useLayerContainer } from '../layers/layerContainer';
import { useMergedRefs } from '../lib/mergeRefs';
import styles from './RowMenu.module.css';

const SIDE_OFFSET = 6;
const MORE_GLYPH = '⋯';
const triggerLabelOf = (rowLabel: string) => `${rowLabel} 작업`;

export type RowMenuItem = {
  /** React key. 없으면 label */
  id?: string;
  label: string;
  /** 메뉴가 닫히고 포커스가 ⋯ 트리거로 돌아온 뒤 불린다 — 여기서 여는 Modal · Dialog가 트리거를 기억한다 */
  onSelect: () => void;
  /** danger — 되돌리는 Dialog · 확인 줄을 연다(글자 fix-fg) */
  tone?: 'danger';
  disabled?: boolean;
  /** disabled일 때 둘째 줄 사유(보이는 문장) */
  reason?: ReactNode;
};

export type RowMenuProps = {
  /** 행 이름 — 트리거 이름 `{rowLabel} 작업` */
  rowLabel: string;
  items: readonly RowMenuItem[];
  /** 층 밖에서 포털 위치(_guide · 검수용, 기본 body). 층 안이면 무시하고 그 층의 내용 상자로 포털한다 */
  container?: HTMLElement | null;
  disabled?: boolean;
};

/** 행 클릭(상세 열기)으로 번지지 않게 막는다 */
const stop = (event: MouseEvent) => event.stopPropagation();

/** 행 하나의 작업 메뉴(⋯ → DropdownMenu). 행 액션이 둘 이상일 때 액션 열에 이것 하나 */
export const RowMenu = forwardRef<HTMLButtonElement, RowMenuProps>(function RowMenu(
  { rowLabel, items, container, disabled = false },
  ref,
) {
  const label = triggerLabelOf(rowLabel);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // 고른 항목의 onSelect. 고르는 순간 부르면 그 항목(곧 사라진다)에 포커스가 있는 채로 층이 열려
  // 층이 사라질 항목을 여는 컨트롤로 기억한다(useReturnFocus) → 닫힐 때 포커스가 body로 간다
  const pendingSelectRef = useRef<(() => void) | null>(null);
  const setTriggerRef = useMergedRefs(triggerRef, ref);
  // 층 안이면 층 내용 상자가 먼저다 — 앱 프레임 · body로 포털하면 `--z-inline` 목록이 `--z-modal` 층 막 아래로 숨는다(Select와 같다)
  const portalTarget = useLayerContainer() ?? container ?? undefined;
  // 열 때마다 지난 고름을 비운다 — 닫힘 처리가 끝나지 않은 채 남은 onSelect가 다음 닫힘에 불리지 않게
  const onOpenChange = (open: boolean) => {
    if (open) pendingSelectRef.current = null;
  };
  // 메뉴가 닫히며 포커스를 돌려줄 때 — 고른 항목이 있으면 트리거로 포커스를 옮긴 뒤 그 onSelect를 부른다.
  // 고른 항목이 없으면(Esc · 바깥 클릭) Radix 기본 복귀에 맡긴다.
  // 그 사이 행 · 트리거가 사라졌으면(실시간 갱신) 없는 행의 작업을 열지 않고 버린다
  const onCloseAutoFocus = (event: Event) => {
    const pendingSelect = pendingSelectRef.current;
    if (!pendingSelect) return;
    pendingSelectRef.current = null;
    const trigger = triggerRef.current;
    if (!trigger?.isConnected) return;
    event.preventDefault();
    trigger.focus();
    pendingSelect();
  };
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          ref={setTriggerRef}
          type="button"
          className={styles.trigger}
          aria-label={label}
          title={label}
          onClick={stop}
        >
          <span aria-hidden="true">{MORE_GLYPH}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalTarget}>
        <DropdownMenu.Content
          className={styles.content}
          align="end"
          sideOffset={SIDE_OFFSET}
          onClick={stop}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.id ?? item.label}
              className={styles.item}
              data-tone={item.tone}
              disabled={item.disabled}
              onSelect={() => {
                pendingSelectRef.current = item.onSelect;
              }}
            >
              <span className={styles.label}>{item.label}</span>
              {item.disabled && item.reason !== undefined ? (
                <span className={styles.reason}>{item.reason}</span>
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
});

import { forwardRef, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Icon } from '../icons';
import { LayerRoot, type LayerScrim } from '../layers/LayerRoot';
import layer from '../layers/layer.module.css';
import { cx } from '../lib/cx';
import { isImeComposing } from '../lib/ime';
import styles from './SearchOverlay.module.css';

export type SearchOverlayScrim = LayerScrim;

/** 검색 상자가 프레임 위에서 떨어진 거리(COMPONENTS SearchOverlay) */
const DEFAULT_TOP = 104;

export type SearchOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  /** 입력 Enter(IME 조합 중 제외). 호출자가 첫 결과로 이동 */
  onSubmit?: () => void;
  placeholder?: string;
  /** 결과 영역 */
  children?: ReactNode;
  /** 포털 대상(앱 프레임 · 카탈로그 예시 상자). 없으면 body */
  container?: HTMLElement | null;
  /** 열릴 때 입력에 포커스. _guide 카탈로그 예시만 false */
  focusOnOpen?: boolean;
  scrim?: SearchOverlayScrim;
  /** 상자 위 여백(px). 기본 104 */
  top?: number;
  className?: string;
};

/** LNB 검색 층. 머리(아이콘 · 입력 · esc 키캡) + 결과 영역(`parts` 조각). 결과 계산 · 단축키 · 라우팅은 호출자 */
export const SearchOverlay = forwardRef<HTMLDivElement, SearchOverlayProps>(function SearchOverlay(
  {
    open,
    onOpenChange,
    value,
    onValueChange,
    onSubmit,
    placeholder,
    children,
    container,
    focusOnOpen = true,
    scrim = 'light',
    top = DEFAULT_TOP,
    className,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  // LayerRoot가 여는 컨트롤을 먼저 기억한 뒤(useReturnFocus) 불러 준다 — 그다음 입력으로 포커스를 옮긴다
  const onOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    if (focusOnOpen) inputRef.current?.focus();
  };
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || isImeComposing(e) || !onSubmit) return;
    e.preventDefault();
    onSubmit();
  };
  return (
    <LayerRoot
      primitive={Dialog}
      open={open}
      onOpenChange={onOpenChange}
      container={container}
      scrim={scrim}
      layer="search"
      focusOnOpen
      onOpenAutoFocus={onOpenAutoFocus}
      // 설명 요소가 없으므로 Radix 기본 describedby id(없는 요소를 가리킴 · 경고)를 덮는다
      hasDescription={false}
      overlayClassName={styles.overlay}
      overlayStyle={{ paddingTop: top }}
      contentClassName={cx(styles.content, className)}
      ref={ref}
    >
      <Dialog.Title className={layer.srOnly}>검색</Dialog.Title>
      <div className={styles.head}>
        <span className={styles.icon}>
          <Icon name="search" size={18} />
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onInputKeyDown}
        />
        <kbd className={styles.kbd}>esc</kbd>
      </div>
      <div className={styles.results}>{children}</div>
    </LayerRoot>
  );
});

// Dock · DockButton · DockLinkButton · DockSeparator · DockSpacer — 이음 .dock · .cnt · .clr · .sep · .btn.primary(css/console.css:222-234 · 482-483, js/menu/discovery.js:316-317)
// 여러 항목을 고르면 화면 아래 가운데에 떠 있는 일괄 작업 줄. 포털 없이 그 자리에 그린다(옛 .dock도 본문 안이라 Tab 순서가 표 뒤다) — 위치만 화면 고정이다.
// 층 목록 밖이다: Esc · closeAllLayers · 포커스 복귀와 상관없고, 쓰는 화면이 그리고 그 화면과 함께 사라진다.
// 보임은 open이 정하고, 드로어가 열려 있는 동안은 open과 상관없이 모션 없이 가린다 — 열린 층 상태를 직접 읽는다(옛 body.d-open, css/console.css:225)
// 첫 마운트 모션 없음: 요소를 처음 그릴 때 CSS 전환은 돌지 않는다(전환은 값이 바뀔 때만 돈다) — 처음부터 open이면 올라온 채로 그려진다
// 어두운 바탕 버튼은 쓰는 곳이 있는 주 버튼 하나뿐이다 — 보조(테두리) · 위험 버튼은 쓰는 화면이 생기면 variant로 더한다
import type { ComponentProps, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { useOpenLayers } from '../layers';
import { cx } from '../lib/cx';
import styles from './Dock.module.css';

export type DockProps = {
  /** 줄 이름 — role="region"의 aria-label(옛 "선택한 API") */
  label: string;
  /** 보임. 처음 그릴 때 true면 올라오는 모션 없이 보인 채로 그린다. 바뀌면 --m-dock · --ease-out으로 올라오고 내려간다 */
  open: boolean;
  /** 왼쪽 요약 — 굵은 글(<b>)은 어두운 면 위 파랑 + 한 단계 큰 글자(선택 수) */
  summary: ReactNode;
  /** 오른쪽 동작 — DockLinkButton · DockSeparator · DockButton을 순서대로 */
  children: ReactNode;
};

export function Dock({ label, open, summary, children }: DockProps) {
  // 드로어가 열려 있으면 가린다 — 모달은 가림막(--z-modal-scrim)이 도크(--z-dock) 위에서 덮는다
  const { drawer: isCovered } = useOpenLayers();
  return (
    <div role="region" aria-label={label} className={styles.root} data-open={open} data-covered={isCovered}>
      <span className={styles.summary}>{summary}</span>
      {children}
    </div>
  );
}

export type DockButtonProps = Omit<ComponentProps<'button'>, 'type' | 'aria-disabled'> & {
  /** 글자 앞 아이콘(md) */
  icon?: IconName;
  /** 기본 button — 폼 안에서 뜻밖에 제출하지 않는다 */
  type?: 'button' | 'submit' | 'reset';
  /** 요청 중 잠금 — aria-disabled · 누름 무시 · 비활성 모양, 포커스는 버튼에 남는다(Button pending과 같다). 조건이 안 맞아 못 누르는 것은 disabled */
  pending?: boolean;
};

/** 어두운 바탕의 주 버튼 — 면은 --inverse-fill(두 테마 같음). 높이 --h-md */
export function DockButton({ icon, type = 'button', pending = false, className, children, onClick, ...rest }: DockButtonProps) {
  // 잠긴 동안은 쓰는 곳의 onClick을 부르지 않고 기본 동작(폼 제출)도 막는다
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.button, className)}
      aria-disabled={pending || undefined}
      onClick={handleClick}
    >
      {icon ? <Icon name={icon} size="md" /> : null}
      {children}
    </button>
  );
}

export type DockLinkButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** 조건이 안 맞아 못 누름 — 흐리게, 포커스를 받지 않는다 */
  disabled?: boolean;
  /** 글자(옛 "추천만 선택") */
  children: ReactNode;
};

/** 밑줄 글자 버튼 — 어두운 면 위 흐린 글자(--on-fill-quiet), hover에서 --on-fill */
export function DockLinkButton({ onClick, disabled, children }: DockLinkButtonProps) {
  return (
    <button type="button" className={styles.link} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** 세로 구분선 — 장식 */
export function DockSeparator() {
  return <span className={styles.separator} aria-hidden="true" />;
}

/** 도크가 마지막 행을 가리지 않게 표 아래 두는 빈 칸 — 도크가 없는 때(등록 완료)에도 두므로 Dock 밖에 따로 그린다. 장식 */
export function DockSpacer() {
  return <div className={styles.spacer} aria-hidden="true" />;
}

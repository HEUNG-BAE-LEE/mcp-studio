import { forwardRef, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { CloseButton } from '../layers/CloseButton';
import { LayerRoot, type LayerScrim } from '../layers/LayerRoot';
import { cx } from '../lib/cx';
import styles from './Modal.module.css';

export type ModalKind = 'settings' | 'form' | 'info';
export type ModalScrim = LayerScrim;
export type ModalFooter = {
  /** 폼 발 위 한 줄(DESIGN 권한) — 한 문장만. 우선: 권한 사유 > 저장하지 않은 변경 > 저장 안내 */
  note?: ReactNode;
  /** 메모 `id` — 비활성 액션이 `aria-describedby`로 사유를 가리킨다 */
  noteId?: string;
  actions?: ReactNode;
};

/** kind별 크기(COMPONENTS Modal). form · info는 높이 auto */
const SIZE: Record<ModalKind, { width: number; height?: number }> = {
  settings: { width: 820, height: 552 },
  form: { width: 520 },
  info: { width: 560 },
};

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: ModalKind;
  width?: number;
  height?: number;
  /** Radix Title. settings · info는 이름, form은 키커 */
  title: ReactNode;
  /** info만 — 머리 첫 행(연결 정보) */
  kicker?: ReactNode;
  /** settings · info — StatusChip lg */
  marker?: ReactNode;
  /** settings · info — Radix Description */
  subtitle?: ReactNode;
  children?: ReactNode;
  /** 없으면 발을 그리지 않는다 */
  footer?: ModalFooter;
  /** 포털 대상(앱 프레임 · 카탈로그 예시 상자). 없으면 body */
  container?: HTMLElement | null;
  /** Radix가 열릴 때 내용으로 포커스를 옮긴다. _guide 카탈로그 예시만 false */
  focusOnOpen?: boolean;
  /** scrim 종류 — none은 scrim 없이 덮는다(카탈로그 예시) */
  scrim?: ModalScrim;
  /** 여는 컨트롤이 닫힐 때 사라졌으면(연결 해제로 행 삭제) 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null;
  /** false면 Esc · 바깥 클릭으로 닫히지 않는다 — 한 번만 보이는 값(발급된 비밀 값). ✕ · 발 닫기 버튼은 그대로 닫는다. 기본 true */
  dismissible?: boolean;
  className?: string;
};

function SettingsHead({
  title,
  marker,
  subtitle,
}: Pick<ModalProps, 'title' | 'marker' | 'subtitle'>) {
  return (
    <>
      <div className={styles.titleRow}>
        <Dialog.Title className={styles.title}>{title}</Dialog.Title>
        {marker}
        <Dialog.Close asChild>
          <CloseButton size={24} className={styles.close} />
        </Dialog.Close>
      </div>
      {subtitle !== undefined ? (
        <Dialog.Description className={styles.subtitle}>{subtitle}</Dialog.Description>
      ) : null}
    </>
  );
}

function FormHead({ title }: Pick<ModalProps, 'title'>) {
  return (
    <>
      <Dialog.Title className={styles.kicker}>{title}</Dialog.Title>
      <Dialog.Close asChild>
        <CloseButton size={24} />
      </Dialog.Close>
    </>
  );
}

function InfoHead({
  kicker,
  title,
  marker,
  subtitle,
}: Pick<ModalProps, 'kicker' | 'title' | 'marker' | 'subtitle'>) {
  return (
    <>
      <div className={styles.kickerRow}>
        <span className={styles.kicker}>{kicker}</span>
        <Dialog.Close asChild>
          <CloseButton size={24} />
        </Dialog.Close>
      </div>
      <div className={styles.infoTitleRow}>
        <Dialog.Title className={styles.infoTitle}>{title}</Dialog.Title>
        {marker}
      </div>
      {subtitle !== undefined ? (
        <Dialog.Description className={styles.subtitle}>{subtitle}</Dialog.Description>
      ) : null}
    </>
  );
}

function Head({
  kind,
  ...head
}: Pick<ModalProps, 'kicker' | 'title' | 'marker' | 'subtitle'> & { kind: ModalKind }) {
  if (kind === 'info') return <InfoHead {...head} />;
  if (kind === 'form') return <FormHead title={head.title} />;
  return <SettingsHead title={head.title} marker={head.marker} subtitle={head.subtitle} />;
}

function Foot({ note, noteId, actions }: ModalFooter) {
  return (
    <div className={styles.foot} data-part="foot">
      {note !== undefined ? (
        <span id={noteId} className={styles.note}>
          {note}
        </span>
      ) : null}
      {actions !== undefined ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

/** 설정 · 입력 · 정보 모달. 오버레이가 container를 덮고 상자를 가운데 둔다 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    open,
    onOpenChange,
    kind = 'settings',
    width,
    height,
    title,
    kicker,
    marker,
    subtitle,
    children,
    footer,
    container,
    focusOnOpen = true,
    scrim = 'default',
    returnFocusFallback,
    dismissible = true,
    className,
  },
  ref,
) {
  const size = { width: width ?? SIZE[kind].width, height: height ?? SIZE[kind].height };
  const hasDescription = (kind === 'settings' || kind === 'info') && subtitle !== undefined;
  return (
    <LayerRoot
      primitive={Dialog}
      open={open}
      onOpenChange={onOpenChange}
      container={container}
      scrim={scrim}
      focusOnOpen={focusOnOpen}
      returnFocusFallback={returnFocusFallback}
      dismissible={dismissible}
      // 부제가 없으면 Radix 기본 describedby id(없는 요소를 가리킴 · 경고)를 덮는다
      hasDescription={hasDescription}
      contentClassName={cx(styles.content, className)}
      contentStyle={size}
      contentProps={{ 'data-kind': kind, 'data-dismissible': dismissible ? undefined : 'false' }}
      ref={ref}
    >
      <div className={styles.head}>
        <Head kind={kind} kicker={kicker} title={title} marker={marker} subtitle={subtitle} />
      </div>
      <div className={styles.body}>{children}</div>
      {footer ? <Foot {...footer} /> : null}
    </LayerRoot>
  );
});

// 화면 상태 골격 — 데이터를 받기 전 · 받지 못했을 때 그 자리(화면 본문 · 층 내용 열 · 영역)에 하나만 그린다(로딩 · 실패 · 없음).
// 여백은 감싸는 자리(PageBody · 영역 · 층 내용 열)가 준다
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Button } from '../Button';
import { ErrorBlock } from '../ErrorBlock';
import { cx } from '../lib/cx';
import type { CopyHandler } from '../lib/useCopyState';
import styles from './ScreenState.module.css';

type Base = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export type ScreenStateProps =
  /** 진행형 한 줄(`프로젝트를 불러오는 중…`) — 루트 `aria-busy` + `role=status` */
  | (Base & {
      kind: 'loading';
      label: ReactNode;
      /** 영역 안 로딩(목록 · 표 자리) — 진행형 한 줄만, 세로 쌓기 · 간격 없음. 영역 실패는 `failed` */
      inline?: boolean;
    })
  /** ErrorBlock(원문) + `다시 시도`(Button md secondary) */
  | (Base & {
      kind: 'failed';
      raw: string;
      onRetry: () => void;
      retryLabel: string;
      /** ErrorBlock 복사(필수 — `platform.copyText(raw)`) */
      onCopy: CopyHandler;
      /** ErrorBlock 머리 줄 메타 */
      meta?: ReactNode;
    })
  /** `찾을 수 없음` 한 줄 + 돌아갈 곳(Button link — 목록 · 상위 화면) */
  | (Base & { kind: 'not-found'; message: ReactNode; action: ReactNode });

export const ScreenState = forwardRef<HTMLDivElement, ScreenStateProps>(
  function ScreenState(props, ref) {
    switch (props.kind) {
      case 'loading': {
        const { kind, label, inline = false, className, ...rest } = props;
        return (
          <div
            {...rest}
            ref={ref}
            className={cx(styles.root, className)}
            data-kind={kind}
            data-inline={inline || undefined}
            aria-busy="true"
          >
            <span role="status" className={styles.text}>
              {label}
            </span>
          </div>
        );
      }
      case 'failed': {
        const { kind, raw, onRetry, retryLabel, onCopy, meta, className, ...rest } = props;
        return (
          <div {...rest} ref={ref} className={cx(styles.root, className)} data-kind={kind}>
            <ErrorBlock raw={raw} onCopy={onCopy} meta={meta} />
            <Button onClick={onRetry}>{retryLabel}</Button>
          </div>
        );
      }
      case 'not-found': {
        const { kind, message, action, className, ...rest } = props;
        return (
          <div {...rest} ref={ref} className={cx(styles.root, className)} data-kind={kind}>
            <span className={styles.text}>{message}</span>
            {action}
          </div>
        );
      }
    }
  },
);

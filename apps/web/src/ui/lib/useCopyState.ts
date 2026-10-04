// 복사 결과 상태(ErrorBlock · CopyField · 화면이 만드는 로그 머리 줄의 복사 버튼이 같이 쓴다)
import { useEffect, useRef, useState } from 'react';

/** 복사 호출 — `false`를 돌려주거나 거부하면 실패, 그 밖(`void` · `true`)은 성공 */
export type CopyHandler = () => void | boolean | Promise<void | boolean>;
/** idle `복사` · copied `복사됨` · failed `복사 안 됨` */
export type CopyState = 'idle' | 'copied' | 'failed';

/** 복사 버튼 기본 문구. 맨 `실패`는 금지어라 `복사 안 됨` */
export const COPY_LABELS: Readonly<Record<CopyState, string>> = {
  idle: '복사',
  copied: '복사됨',
  failed: '복사 안 됨',
};
/** 결과 라벨을 유지하는 시간 */
export const COPY_RESULT_MS = 2000;

export type UseCopyStateOptions = {
  /** `복사됨` 유지 시간(ms). `null`이면 다음 누름 · 언마운트까지 유지(연결 정보). `복사 안 됨`은 늘 COPY_RESULT_MS 뒤 `복사`로 */
  copiedMs?: number | null;
};

/**
 * 복사 뒤 라벨 상태. 성공이면 `copied`, 실패(`false` · 거부)면 `failed` — 실패를 성공처럼 보이지도, 아무 일 없던 것처럼 두지도 않는다.
 * 거부는 밖으로 던지지 않고 `copy()`의 결과(`false`)로 돌려준다(사유 기록은 호출자 · platform 몫). 타이머는 언마운트 때 지운다
 */
export function useCopyState(
  onCopy?: CopyHandler,
  { copiedMs = COPY_RESULT_MS }: UseCopyStateOptions = {},
) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const copy = async (): Promise<boolean> => {
    let ok: boolean;
    try {
      ok = (await onCopy?.()) !== false;
    } catch {
      ok = false;
    }
    // 복사를 기다리는 사이 언마운트됐으면 상태도 타이머도 건드리지 않는다
    if (!mounted.current) return ok;
    clearTimeout(timer.current);
    setState(ok ? 'copied' : 'failed');
    const holdMs = ok ? copiedMs : COPY_RESULT_MS;
    if (holdMs !== null) timer.current = setTimeout(() => setState('idle'), holdMs);
    return ok;
  };
  return { state, copied: state === 'copied', copy };
}

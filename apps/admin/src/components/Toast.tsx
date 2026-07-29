import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "ok" | "error" | "info";

export type ToastItem = {
  id: number;
  message: string;
  detail?: string;
  kind: ToastKind;
};

// 실패는 오래 남겨야 읽을 수 있고, 성공은 빨리 비켜야 한다.
const LIFETIME: Record<ToastKind, number> = { ok: 2600, error: 6000, info: 2600 };
const MAX = 3;

/**
 * 알림을 한 곳으로 모은다. 이전에는 성공이 토스트로, 실패가 인라인 배너로
 * 갈려 같은 종류의 사건이 화면 두 곳에서 다른 모양으로 나타났다.
 *
 * 화면 전체를 대체해야 하는 오류(불러오기 실패)는 여전히 배너가 맡는다 —
 * 그건 알림이 아니라 화면의 상태이기 때문이다.
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "ok", detail?: string) => {
      const id = ++seq.current;
      // 스택은 세 개까지만 쌓는다. 그 이상은 읽히지 않고 화면만 가린다.
      setToasts((prev) => [...prev, { id, message, detail, kind }].slice(-MAX));
      timers.current.set(id, window.setTimeout(() => dismiss(id), LIFETIME[kind]));
    },
    [dismiss],
  );

  // 언마운트 후에 타이머가 남아 setState 를 호출하는 것을 막는다.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => window.clearTimeout(t));
      map.clear();
    };
  }, []);

  return { toasts, showToast, dismiss };
}

export default function Toast({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>
          <span className={t.kind === "error" ? "dot dot-danger" : t.kind === "ok" ? "dot dot-ok" : "dot"} />
          <span>
            <strong>{t.message}</strong>
            {t.detail && <p>{t.detail}</p>}
          </span>
          <button
            type="button"
            className="toast-close"
            aria-label="알림 닫기"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

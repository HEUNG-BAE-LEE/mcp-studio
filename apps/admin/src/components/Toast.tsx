import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast(message);
    // 이전 타이머를 지우지 않으면 연달아 호출했을 때 먼저 잡힌 타이머가
    // 나중 메시지를 조기에 지운다.
    timer.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  // 언마운트 후에 타이머가 남아 setToast를 호출하는 것을 막는다.
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  return { toast, showToast };
}

export default function Toast({ message }: { message: string }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

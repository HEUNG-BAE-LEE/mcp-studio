import { useEffect, useRef } from "react";

type Fact = { label: string; value: string };

type Props = {
  open: boolean;
  title: string;
  description?: string;
  /** 함께 사라지는 것들. 삭제 뒤 토스트로 알리던 내용을 삭제 전에 보여준다. */
  facts?: Fact[];
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
};

/**
 * 파괴적 조작 확인.
 *
 * `window.confirm` 은 쓰지 않는다 — 자동화를 막고 촬영 화면에서 튄다. 그렇다고
 * 표 셀 안에서 확인 문구를 펼치면 그 순간 열 폭이 넓어지며 앞 열을 밀어낸다.
 * 그래서 트리거에 앵커를 걸고 위로 띄운다. 레이아웃은 움직이지 않는다.
 */
export default function ConfirmPopover({
  open,
  title,
  description,
  facts,
  confirmLabel = "지우기",
  onConfirm,
  onCancel,
  children,
}: Props) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    function onDown(e: MouseEvent) {
      if (!anchor.current?.contains(e.target as Node)) onCancel();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onCancel]);

  return (
    <span className="pop-anchor" ref={anchor}>
      {children}
      {open && (
        <div className="popover" role="dialog" aria-label={title}>
          <strong>{title}</strong>
          {description && <p>{description}</p>}
          {facts && facts.length > 0 && (
            <div className="popover-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <span className="t3">{f.label}</span>
                  <span className="num">{f.value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="popover-actions">
            <button type="button" className="btn btn-danger btn-sm" onClick={onConfirm}>
              {confirmLabel}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

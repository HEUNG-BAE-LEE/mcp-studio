import { useEffect } from "react";
import CollectPanels from "./CollectPanels";

/**
 * 프로젝트 목록에서 바로 수집을 시작하는 팝업.
 *
 * 목록 → 프로젝트 → 수집 화면으로 두 번 들어갔다 나오는 대신 카드에서 한 번에
 * 연다. 안에서 하는 일은 전용 화면(/projects/:id/collect)과 같다 — 같은
 * CollectPanels 를 쓴다.
 */
export default function CollectModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  // Esc 로 닫힌다. 닫는 방법이 버튼 하나뿐이면 갇힌 것처럼 느껴진다.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="collect-title"
         onClick={onClose}>
      {/* 안쪽 클릭이 배경까지 올라가면 폼을 채우다 닫힌다 */}
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong id="collect-title">수집 시작</strong>
            <span>모은 API 는 {projectName} 에 담깁니다</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <CollectPanels projectId={projectId} projectName={projectName} onStarted={onClose} />
      </div>
    </div>
  );
}

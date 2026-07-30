import { useEffect } from "react";
import CollectPanels from "./CollectPanels";

/**
 * 프로젝트 목록에서 바로 수집을 시작하는 팝업.
 *
 * 목록 → 프로젝트 → 수집 화면으로 두 번 들어갔다 나오는 대신, 카드에서 한 번에
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
    <div className="dlg-backdrop" role="dialog" aria-modal="true" aria-labelledby="collect-title"
         onClick={onClose}>
      {/* 안쪽 클릭이 배경까지 올라가면 폼을 채우다 닫힌다 */}
      <div className="dlg collect-dlg" onClick={(event) => event.stopPropagation()}>
        <header className="dlg-head">
          <div>
            <h2 id="collect-title">수집 시작</h2>
            <p>모은 API 는 <b>{projectName}</b> 에 담깁니다</p>
          </div>
          <button className="dlg-close" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className="dlg-body">
          <CollectPanels projectId={projectId} projectName={projectName} onStarted={onClose} />
        </div>
      </div>
    </div>
  );
}

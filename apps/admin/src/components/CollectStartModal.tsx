import { useEffect, useState } from "react";
import PortalCrawlPanel from "./PortalCrawlPanel";
import { KindMark } from "./CollectionMark";

/**
 * 프로젝트 안에서 수집을 시작한다.
 *
 * 세션을 만들지 않는다 — 세션은 실제 수집이 만든다. 이 팝업이 하는 일은
 * 고른 엔진의 **시작 지점**으로 데려가는 것이다. 셋 중 관리자에서 바로
 * 시작할 수 있는 건 포털 일괄 수집 하나이고, 나머지 둘은 크롬 확장에서
 * 일어난다. 그 사실을 감추지 않는다.
 */
type Engine = "traffic" | "portal" | "document";

export default function CollectStartModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  const [engine, setEngine] = useState<Engine>("portal");

  // Esc 로 닫힌다. 팝업을 닫는 방법이 하나뿐이면 갇힌 것처럼 느껴진다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {/* 안쪽 클릭이 배경까지 올라가면 폼을 채우다 닫힌다 */}
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>수집 시작</strong>
            <span>{projectName} 에 담습니다</span>
          </div>
          <button onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="engine-picker">
          {([
            { key: "traffic", label: "트래픽 기반", hint: "화면이 부르는 호출 관측" },
            { key: "portal", label: "포털 공개 기반", hint: "포털이 공개한 명세 읽기" },
            { key: "document", label: "문서 기반", hint: "준비중" },
          ] as const).map((item) => (
            <button
              key={item.key}
              className={engine === item.key ? "on" : ""}
              disabled={item.key === "document"}
              onClick={() => setEngine(item.key)}
            >
              <KindMark kind={item.key} size={16} />
              <b>{item.label}</b>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>

        <div className="engine-body">
          {engine === "traffic" && (
            <ol className="guide-steps">
              <li>대상 사이트를 열고 확장 아이콘을 눌러 사이드 패널을 엽니다</li>
              <li>프로젝트 이름에 <strong>{projectName}</strong> 을 그대로 넣습니다 —
                  같은 이름이면 이 프로젝트에 담깁니다</li>
              <li>버튼·필터처럼 <strong>페이지가 넘어가지 않는 조작</strong>을 클릭합니다</li>
              <li><strong>기록 종료 및 전송</strong> 후 이 화면을 새로고침하면 세션이 보입니다</li>
            </ol>
          )}

          {engine === "portal" && (
            <>
              {/* 프로젝트 안에서 열렸으므로 프로젝트를 고를 필요가 없다 */}
              <PortalCrawlPanel projectId={projectId} />
              <p className="guide-note">
                <strong>한 건씩 모으려면 확장을 씁니다</strong>
                공공데이터포털 오픈API <strong>상세페이지</strong>(<code>요청주소</code>와
                <code>요청변수</code> 표가 함께 있는 화면)에서 사이드 패널을 열고
                프로젝트 이름에 <strong>{projectName}</strong> 을 넣어 수집하세요.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import PortalCrawlPanel from "./PortalCrawlPanel";
import DocumentCollectPanel from "./DocumentCollectPanel";
import TrafficPanel from "./TrafficPanel";
import { KindMark } from "./CollectionMark";

/**
 * 수집 방식 셋을 고르고, 고른 방식의 진행 화면을 그 자리에 보여준다.
 *
 * 같은 내용을 프로젝트 목록의 팝업(CollectModal)과 전용 화면(CollectPage)이
 * 함께 쓴다. 두 벌로 두면 한쪽만 고쳐지는 날이 온다 — 실제로 수집 시작 지점이
 * 전역 화면에서 프로젝트 안으로 옮겨질 때 같은 폼이 두 곳에 생겼었다.
 *
 * 방식이 셋이지만 관리자에서 바로 시작할 수 있는 것은 포털 일괄 수집과 문서
 * 수집 둘이다. 트래픽 기반은 브라우저(확장)에서 일어난다 — 그 사실을 감추지
 * 않고 무엇을 해야 하는지 적는다.
 */

export type Engine = "portal" | "document" | "traffic";

const ENGINES: { key: Engine; label: string; hint: string }[] = [
  { key: "portal", label: "포털 공개 기반", hint: "포털이 공개한 명세를 읽습니다" },
  { key: "document", label: "문서 기반", hint: "활용가이드에서 명세를 뽑습니다" },
  { key: "traffic", label: "트래픽 기반", hint: "확장이 화면의 호출을 관측합니다" },
];

export default function CollectPanels({
  projectId,
  projectName,
  onStarted,
  onEngineChange,
}: {
  projectId: number | null;
  projectName: string;
  /** 수집이 시작돼 다른 화면으로 넘어갈 때. 팝업 안이면 스스로 닫는다. */
  onStarted?: () => void;
  /** 고른 방식을 바깥에 알린다. 스튜디오는 옆에 그 방식의 절차를 띄운다. */
  onEngineChange?: (kind: Engine) => void;
}) {
  const [engine, setEngine] = useState<Engine>("portal");

  function pick(kind: Engine) {
    setEngine(kind);
    onEngineChange?.(kind);
  }

  return (
    <>
      <div className="engine-picker" role="tablist" aria-label="수집 방식">
        {ENGINES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={engine === item.key}
            className={engine === item.key ? "on" : ""}
            onClick={() => pick(item.key)}
          >
            <KindMark kind={item.key} size={16} />
            <b>{item.label}</b>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>

      <div className="engine-body">
        {/* onProjectChange 를 넘기지 않는다 = 프로젝트 고정 모드. 드롭다운 대신
            프로젝트 이름이 글씨로 보인다. */}
        {engine === "portal" && <PortalCrawlPanel projectId={projectId} onStarted={onStarted} />}

        {engine === "document" && <DocumentCollectPanel projectId={projectId} onStarted={onStarted} />}

        {engine === "traffic" && (
          <TrafficPanel projectId={projectId} projectName={projectName} />
        )}
      </div>
    </>
  );
}

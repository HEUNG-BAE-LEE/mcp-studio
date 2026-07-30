import { useState } from "react";
import { Link } from "react-router-dom";
import PortalCrawlPanel from "./PortalCrawlPanel";
import DocumentCollectPanel from "./DocumentCollectPanel";
import { KindMark } from "./CollectionMark";

/**
 * 수집 방식 셋을 탭으로 두고, 고른 방식의 진행 화면을 그 자리에 보여준다.
 *
 * 같은 내용을 프로젝트 화면의 팝업(CollectModal)과 전용 페이지(CollectPage)가
 * 함께 쓴다. 두 벌로 두면 한쪽만 고쳐지는 날이 온다 — 실제로 수집 시작 지점이
 * 전역 화면에서 프로젝트 안으로 옮겨질 때 같은 폼이 두 곳에 생겼었다.
 *
 * 방식이 셋이지만 관리자에서 바로 시작할 수 있는 것은 포털 일괄 수집과 문서
 * 수집 둘이다. 트래픽 기반은 브라우저(확장)에서 일어난다 — 그 사실을 감추지
 * 않고 무엇을 해야 하는지 적는다.
 */

export type Engine = "portal" | "document" | "traffic";

const TABS: { key: Engine; label: string; hint: string }[] = [
  { key: "portal", label: "포털 공개 기반", hint: "포털이 공개한 명세를 읽습니다" },
  { key: "document", label: "문서 기반", hint: "활용가이드에서 명세를 뽑습니다" },
  { key: "traffic", label: "트래픽 기반", hint: "확장이 화면의 호출을 관측합니다" },
];

export default function CollectPanels({
  projectId,
  projectName,
  onStarted,
}: {
  projectId: number | null;
  projectName: string;
  /** 수집이 실제로 시작돼 다른 화면으로 넘어갈 때. 팝업이면 스스로 닫는다. */
  onStarted?: () => void;
}) {
  const [engine, setEngine] = useState<Engine>("portal");

  return (
    <>
      <div className="engine-tabs" role="tablist" aria-label="수집 방식">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={engine === tab.key}
            className={engine === tab.key ? "on" : ""}
            onClick={() => setEngine(tab.key)}
          >
            <KindMark kind={tab.key} size={14} />
            <span>
              <b>{tab.label}</b>
              <small>{tab.hint}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="engine-body">
        {/* onProjectChange 를 넘기지 않는다 = 프로젝트 고정 모드. 드롭다운 대신
            프로젝트 이름이 글씨로 보인다. */}
        {engine === "portal" && <PortalCrawlPanel projectId={projectId} onStarted={onStarted} />}

        {engine === "document" && <DocumentCollectPanel projectId={projectId} onStarted={onStarted} />}

        {engine === "traffic" && (
          <article className="panel">
            <ol className="guide-steps">
              <li>대상 사이트를 열고 확장 아이콘을 눌러 사이드 패널을 엽니다</li>
              <li>프로젝트 이름에 <strong>{projectName || `#${projectId}`}</strong> 을 그대로 넣습니다 —
                  같은 이름이면 이 프로젝트에 담깁니다</li>
              <li>버튼·필터처럼 <strong>페이지가 넘어가지 않는 조작</strong>을 클릭합니다</li>
              <li><strong>기록 종료 및 전송</strong> 후 <Link to={`/projects/${projectId}`}>수집현황</Link>에서
                  세션을 확인합니다</li>
            </ol>
            <p className="guide-note">
              <strong>확장을 새로고침했다면 대상 페이지도 새로고침하세요</strong>
              이미 열려 있던 탭의 스크립트는 고아가 되어 클릭이 하나도 잡히지 않습니다.
              화면에는 오류 없이 “0 클릭”만 보여 알아채기 어렵습니다.
            </p>
          </article>
        )}
      </div>
    </>
  );
}

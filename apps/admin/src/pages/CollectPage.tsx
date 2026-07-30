import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import PortalCrawlPanel from "../components/PortalCrawlPanel";
import DocumentCollectPanel from "../components/DocumentCollectPanel";

/**
 * 한 프로젝트에 API 를 모으는 화면.
 *
 * **프로젝트가 URL 에서 온다**는 것이 이 화면의 핵심이다. 예전에는 같은 폼이
 * 전역 `/sources` 에 있어서 어느 프로젝트에 담을지 되물어야 했고, 그 되묻기가
 * 프로젝트 드롭다운이었다. 이름으로 프로젝트를 짐작하는 코드까지 생겼다
 * (`name.includes("공공데이터포털")`). 프로젝트를 URL 로 받으면 둘 다 사라진다 —
 * `PortalCrawlPanel` 에 `onProjectChange` 를 **넘기지 않으면** 그 컴포넌트가
 * 고정 모드로 그려져 드롭다운 대신 프로젝트 이름을 보여준다.
 *
 * 방식이 셋이지만 관리자에서 바로 시작할 수 있는 것은 포털 일괄 수집과 문서
 * 수집 둘이다. 트래픽 기반은 브라우저(확장)에서 일어난다 — 그 사실을 감추지
 * 않고 무엇을 해야 하는지 적는다.
 *
 * 세션을 미리 만들지 않는다. 세션은 실제 수집(확장의 업로드 · `CrawlJob` ·
 * 문서 변환)이 만든다. 빈 세션을 먼저 만들면 "만들었는데 아무것도 없는 것"이
 * 생기고 `RecordingSession` 에 상태 컬럼이 필요해져, 마이그레이션이 없는
 * `dev.db` 가 깨진다.
 */

type Engine = "portal" | "document" | "traffic";

// 탭 스타일은 dev 의 .kind-tabs 를 쓴다. 수집현황 화면도 같은 클래스라,
// 여기만 다른 모양을 쓰면 같은 앱에 탭이 두 종류가 된다.
const TABS: { key: Engine; label: string }[] = [
  { key: "portal", label: "포털 공개 기반" },
  { key: "document", label: "문서 기반" },
  { key: "traffic", label: "트래픽 기반" },
];

export default function CollectPage() {
  const { id } = useParams();
  const projectId = id ? Number(id) : null;

  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>("portal");

  // 브레드크럼과 안내 문구에 프로젝트 이름을 쓴다. 이름을 못 불러와도 수집
  // 자체는 projectId 로 되므로 폼을 막지 않고 인라인 배너로만 알린다.
  useEffect(() => {
    if (projectId == null) return;
    api.get("/api/projects")
      .then((list: { id: number; name: string }[]) => {
        const found = list.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  return (
    <Shell breadcrumb={["Projects", projectName, "API 수집하기"]} projectId={projectId} projectName={projectName}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">수집</p>
          <h1>API 수집하기</h1>
          <p className="subtitle">
            모은 결과는 <strong>{projectName || `#${projectId}`}</strong> 에 담깁니다.
            방식별 차이는 <Link to="/sources">수집 방식 안내</Link>에 있습니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>프로젝트 이름을 불러오지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="kind-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={engine === tab.key ? "on" : ""}
            onClick={() => setEngine(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {/* onProjectChange 를 넘기지 않는다 = 프로젝트 고정 모드. 드롭다운 대신
            프로젝트 이름이 글씨로 보인다. */}
        {engine === "portal" && <PortalCrawlPanel projectId={projectId} />}

        {engine === "document" && <DocumentCollectPanel projectId={projectId} />}

        {engine === "traffic" && (
          <article className="panel">
            <ol className="guide-steps">
              <li>대상 사이트를 열고 확장 아이콘을 눌러 사이드 패널을 엽니다</li>
              <li>프로젝트 이름에 <strong>{projectName || `#${projectId}`}</strong> 을 그대로 넣습니다 —
                  같은 이름이면 이 프로젝트에 담깁니다</li>
              <li>버튼·필터처럼 <strong>페이지가 넘어가지 않는 조작</strong>을 클릭합니다</li>
              <li><strong>기록 종료 및 전송</strong> 후 <strong>수집현황</strong>에서 세션을 확인합니다</li>
            </ol>
            <p className="guide-note">
              <strong>확장을 새로고침했다면 대상 페이지도 새로고침하세요</strong>
              이미 열려 있던 탭의 스크립트는 고아가 되어 클릭이 하나도 잡히지 않습니다.
              화면에는 오류 없이 “0 클릭”만 보여 알아채기 어렵습니다.
            </p>
          </article>
        )}
      </div>
    </Shell>
  );
}

import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

type Props = {
  breadcrumb: string[];
  projectId?: number | null;
  projectName?: string;
  /** 페이지 우측 상단 주 액션 (없으면 자리도 만들지 않는다) */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * 셸은 둘로 나뉜다.
 *
 * **레일**은 어떤 화면에서도 변하지 않는다 — 프로젝트 목록과 수집 엔진, 그리고
 * 하단의 테마 토글이 전부다. **컨텍스트 패널**은 프로젝트 안에서만 나타나며
 * 그 프로젝트에 속한 화면들을 담는다.
 *
 * 이전 구조는 사이드바 하나에 전역 항목과 프로젝트 항목을 섞어 두고, 프로젝트에
 * 들어가면 항목이 2개에서 5개로 늘어났다. 위치가 바뀌는 내비게이션은 사용자가
 * 지도를 만들지 못한다. 지금은 항목이 늘어나는 것이 아니라 **패널이 하나 더
 * 생기는 것**이라 레일의 좌표계가 흔들리지 않는다.
 *
 * 내비게이션에 세션·액션 개수를 띄우지 않는 이유: 그 숫자를 얻으려면 화면마다
 * 추가 요청이 필요하다. 표시를 위해 호출을 늘리지 않는다.
 */
export default function Shell({ breadcrumb, projectId, projectName, actions, children }: Props) {
  const { pathname } = useLocation();

  const projectItems = projectId
    ? [
        { label: "수집 세션", to: `/projects/${projectId}` },
        { label: "액션", to: `/projects/${projectId}/actions` },
        { label: "테스트 콘솔", to: `/projects/${projectId}/console` },
      ]
    : [];

  // 이름을 아직 못 불러왔으면 칩을 띄우지 않는다. 빈 칩이 잠깐 스쳤다가
  // 채워지는 것보다 조금 늦게 나타나는 편이 낫다.
  const chipLabel = (projectName ?? "").trim();
  const hasCtx = projectItems.length > 0;

  return (
    <div className={hasCtx ? "app-shell" : "app-shell no-ctx"}>
      <a className="skip-link" href="#content">
        본문으로 건너뛰기
      </a>

      <nav className="rail" aria-label="주 메뉴">
        <span className="rail-mark" aria-hidden="true">
          M
        </span>
        <Link to="/" className={pathname === "/" ? "rail-item active" : "rail-item"} title="프로젝트">
          <IconProjects />
          <span className="sr-only">프로젝트</span>
        </Link>
        <Link
          to="/sources"
          className={pathname === "/sources" ? "rail-item active" : "rail-item"}
          title="수집 엔진"
        >
          <IconEngine />
          <span className="sr-only">수집 엔진</span>
        </Link>
        <div className="rail-spacer" />
        <ThemeToggle />
      </nav>

      {hasCtx && (
        <aside className="ctx" aria-label="프로젝트 메뉴">
          {chipLabel && (
            <Link to="/" className="ctx-project" title="프로젝트 목록으로">
              <span className="ctx-avatar" aria-hidden="true">
                {Array.from(chipLabel)[0]}
              </span>
              <strong>{chipLabel}</strong>
            </Link>
          )}
          <div className="ctx-group">프로젝트</div>
          <div className="ctx-list">
            {projectItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={pathname === item.to ? "nav-item active" : "nav-item"}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>
      )}

      <main className="main">
        <header className="topbar">
          <div className="crumbs">
            {breadcrumb.filter(Boolean).map((crumb, i, all) => (
              <span key={i} className={i === all.length - 1 ? "here" : undefined}>
                {i > 0 && <em aria-hidden="true">/&nbsp;</em>}
                {crumb}
              </span>
            ))}
          </div>
          {actions}
        </header>
        <div className="content" id="content">
          {children}
        </div>
      </main>
    </div>
  );
}

/* 레일 아이콘. 이모지는 OS 마다 모양이 달라 촬영 화면에서 튀므로 라인 아이콘을
   쓴다 — CollectionMark 와 같은 20×20 격자, 같은 굵기다. */
function IconProjects() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M2.5 8h15" />
    </svg>
  );
}

function IconEngine() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7.5 8 4.5l5 3" strokeLinejoin="round" />
      <path d="M4.6 8.8v5.2M8 8.8v5.2M11.4 8.8v5.2M3.4 15h9.2" strokeLinecap="round" />
      <rect x="14.6" y="6.8" width="3.2" height="7.2" rx="1" />
    </svg>
  );
}

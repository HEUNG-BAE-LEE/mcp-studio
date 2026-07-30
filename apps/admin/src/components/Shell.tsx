import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

type Props = {
  breadcrumb: string[];
  projectId?: number | null;
  projectName?: string;
  children: React.ReactNode;
};

type NavItem = { label: string; to: string; prefixes: string[] };

/**
 * 셸은 둘로 나뉜다.
 *
 * **레일**은 어떤 화면에서도 변하지 않는다 — 프로젝트, 수집 엔진, 테마 토글.
 * **컨텍스트 패널**은 프로젝트 안에서만 나타나며 그 프로젝트에 속한 화면들을
 * 담는다. 항목이 늘었다 줄었다 하는 대신 패널이 통째로 생겼다 없어지므로
 * 레일의 좌표계가 흔들리지 않는다.
 *
 * 번호는 붙이지 않는다. 스테퍼가 이미 순서를 말하고 있어 사이드바에도 번호를
 * 달면 순서 표기가 화면에 둘이 된다. 순서는 스테퍼가, 위치는 내비게이션이 맡는다.
 *
 * 엔진은 장소가 아니라 수집 사건의 속성이다. 일괄 수집 폼이 프로젝트 안으로
 * 옮겨오면서 "수집 엔진"에는 더 이상 시작할 일이 없어 참고 자료로 남긴다.
 *
 * 내비게이션에 세션·액션 개수를 띄우지 않는 이유: 그 숫자를 얻으려면 화면마다
 * 추가 요청이 필요하다. 표시를 위해 호출을 늘리지 않는다.
 */
export default function Shell({ breadcrumb, projectId, projectName, children }: Props) {
  const { pathname } = useLocation();

  // 정확 일치(to)와 접두사(prefixes)를 따로 둔다. 하나의 목록에 섞어 담고
  // 끝의 슬래시로 구분하려 했더니 루트("/")가 모든 경로의 접두사여서
  // 프로젝트 항목이 항상 활성으로 잡혔다.
  function isActive(item: NavItem): boolean {
    return pathname === item.to || item.prefixes.some((p) => pathname.startsWith(p));
  }

  const railItems: NavItem[] = [
    { label: "프로젝트", to: "/", prefixes: [] },
    // /engines/:kind (EngineSessionList) 도 이 항목 소관이라 접두사로 함께 켠다.
    { label: "수집 엔진", to: "/sources", prefixes: ["/engines/"] },
  ];

  const projectItems: NavItem[] = projectId
    ? [
        {
          label: "수집 세션",
          to: `/projects/${projectId}`,
          // 세션 상세는 /sessions/:id · /spec-sessions/:id 로 빠진다. 정확 일치만
          // 보면 정작 작업하는 화면에서 내비게이션이 통째로 꺼져 위치를 잃는다.
          prefixes: ["/sessions/", "/spec-sessions/"],
        },
        { label: "액션", to: `/projects/${projectId}/actions`, prefixes: ["/actions/"] },
        { label: "테스트 콘솔", to: `/projects/${projectId}/console`, prefixes: [] },
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
        {railItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={isActive(item) ? "rail-item active" : "rail-item"}
            title={item.label}
          >
            {item.to === "/" ? <IconProjects /> : <IconEngine />}
            <span className="sr-only">{item.label}</span>
          </Link>
        ))}
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
                className={isActive(item) ? "nav-item active" : "nav-item"}
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

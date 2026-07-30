import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

type Props = {
  breadcrumb: string[];
  projectId?: number | null;
  projectName?: string;
  children: React.ReactNode;
};

/**
 * 사이드바는 순수 내비게이션이고 스테퍼는 세션 컨텍스트 안의 진행 표시다.
 * 목업은 둘을 사이드바 하나로 합쳤는데, 세션이 여러 개 쌓이면 "현재 단계"가
 * 무엇을 가리키는지 모호해지므로 분리한다.
 *
 * 기록 세션·액션·테스트 콘솔은 프로젝트 안에서만 의미가 있다. 프로젝트가
 * 정해지지 않은 목록 화면에서는 회색으로 두지 않고 아예 감춘다 — 회색 항목
 * 세 개는 "아직 안 만든 기능"으로 읽힌다. 대신 프로젝트에 들어가면 상단에
 * 프로젝트 칩이 함께 나타나, 항목이 늘어난 이유가 화면에 드러난다.
 */
export default function Shell({ breadcrumb, projectId, projectName, children }: Props) {
  const { pathname } = useLocation();

  // 사이드바 번호는 "이 순서로 하면 된다"를 말한다. 수집 방식이 셋(트래픽·포털·
  // 문서)으로 늘면서 어디서 시작해 어디서 확인하는지가 한눈에 안 잡혀, 화면
  // 이름과 함께 순서를 붙였다.
  //
  // 수집은 **프로젝트 안에서** 시작한다. "API 수집하기"(02)를 전역 /sources 가
  // 아니라 /projects/:id/collect 로 두는 이유다 — 전역 페이지에 두면 어느
  // 프로젝트에 담을지 되묻게 되고, 그 되묻기가 프로젝트 드롭다운이었다.
  // /sources 는 프로젝트 없이도 볼 수 있는 방식 소개로 맨 아래 남긴다.
  // 정확 일치(to)와 접두사(prefixes)를 따로 둔다. 하나의 목록에 섞어 담고
  // 끝의 슬래시로 구분하려 했더니 루트("/")가 모든 경로의 접두사여서
  // 프로젝트 항목이 항상 활성으로 잡혔다. 세션 상세는 /sessions/:id ·
  // /spec-sessions/:id 로 빠지므로, 정확 일치만 보면 정작 작업하는 화면에서
  // 사이드바가 통째로 꺼져 위치를 잃는다.
  const items = [
    { label: "프로젝트", number: "01", to: "/", prefixes: [] as string[] },
    ...(projectId
      ? [
          {
            label: "API 수집하기",
            number: "02",
            to: `/projects/${projectId}/collect`,
            prefixes: [] as string[],
          },
          {
            label: "수집현황",
            number: "03",
            to: `/projects/${projectId}`,
            prefixes: ["/sessions/", "/spec-sessions/"],
          },
          {
            label: "수집 진행현황",
            number: "04",
            to: `/projects/${projectId}/crawls`,
            prefixes: [] as string[],
          },
          {
            label: "MCP 조회하기",
            number: "05",
            to: `/projects/${projectId}/actions`,
            prefixes: ["/actions/"],
          },
          {
            label: "Playground",
            number: "06",
            to: `/projects/${projectId}/console`,
            prefixes: [] as string[],
          },
        ]
      : []),
    // 엔진은 장소가 아니라 수집 사건의 속성이다. 시작하는 곳이 아니라 무엇이
    // 있는지 읽는 곳이라 번호를 붙이지 않고 맨 아래 둔다.
    // /engines/:kind (EngineSessionList) 도 이 항목 소관이라 접두사로 함께 켠다.
    { label: "수집 방식 안내", number: undefined as string | undefined, to: "/sources", prefixes: ["/engines/"] },
  ];

  function isActive(item: { to: string; prefixes: string[] }): boolean {
    return pathname === item.to || item.prefixes.some((p) => pathname.startsWith(p));
  }

  // 이름을 아직 못 불러왔으면 칩을 띄우지 않는다. 빈 칩이 잠깐 스쳤다가
  // 채워지는 것보다 조금 늦게 나타나는 편이 낫다.
  const chipLabel = (projectName ?? "").trim();

  // 전역 항목과 프로젝트 항목을 갈라 레일과 컨텍스트 패널에 나눠 담는다.
  // 항목이 늘었다 줄었다 하는 대신 패널이 통째로 생겼다 없어지므로 레일의
  // 좌표계가 흔들리지 않는다. 번호는 master 의 결정을 따른다 — 수집 방식이
  // 셋으로 늘면서 "이 순서로 하면 된다"를 말해 줄 것이 필요해졌다.
  const projectItems = items.filter((i) => i.to !== "/sources");
  // 패널이 뜨는 조건은 projectId 다. projectItems.length 로 보면 "01 프로젝트"가
  // 항상 들어 있어 늘 참이 되고, 프로젝트를 고르기 전에도 패널이 떴다 —
  // 제목이 "프로젝트"인데 안에는 지금 보고 있는 페이지로 가는 링크 하나뿐이고,
  // 그 목적지는 레일 아이콘에도 이미 있어 화면 폭만 썼다.
  const hasCtx = projectId != null;

  return (
    <div className={hasCtx ? "app-shell" : "app-shell no-ctx"}>
      <a className="skip-link" href="#content">본문으로 건너뛰기</a>

      <nav className="rail" aria-label="주 메뉴">
        <span className="rail-mark" aria-hidden="true">M</span>
        <Link to="/" className={pathname === "/" ? "rail-item active" : "rail-item"} title="프로젝트">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="M2.5 8h15" />
          </svg>
          <span className="sr-only">프로젝트</span>
        </Link>
        <Link
          to="/sources"
          className={pathname === "/sources" || pathname.startsWith("/engines/") ? "rail-item active" : "rail-item"}
          title="수집 엔진"
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 7.5 8 4.5l5 3" strokeLinejoin="round" />
            <path d="M4.6 8.8v5.2M8 8.8v5.2M11.4 8.8v5.2M3.4 15h9.2" strokeLinecap="round" />
            <rect x="14.6" y="6.8" width="3.2" height="7.2" rx="1" />
          </svg>
          <span className="sr-only">수집 엔진</span>
        </Link>
        <div className="rail-spacer" />
        <ThemeToggle />
      </nav>

      {hasCtx && (
        <aside className="ctx" aria-label="프로젝트 메뉴">
          {chipLabel && (
            <Link to="/" className="ctx-project" title="프로젝트 목록으로">
              <span className="ctx-avatar" aria-hidden="true">{Array.from(chipLabel)[0]}</span>
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
                <span className="nav-no">{item.number}</span>
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
        <div className="content" id="content">{children}</div>
      </main>
    </div>
  );
}

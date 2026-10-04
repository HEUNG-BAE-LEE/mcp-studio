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

/** 레일 아이콘. 경로마다 모양을 달리해 접힌 레일에서도 위치를 잃지 않게 한다. */
function RailIcon({ to }: { to: string }) {
  const common = {
    width: 17, height: 17, viewBox: "0 0 20 20", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6,
  } as const;

  if (to === "/") {
    // 홈 — 지붕
    return <svg {...common}><path d="M3 9.2 10 3.6l7 5.6" strokeLinejoin="round" />
      <path d="M4.8 10.4V16h10.4v-5.6" strokeLinejoin="round" /></svg>;
  }
  if (to === "/market") {
    // 마켓 — 장바구니
    return <svg {...common}><path d="M3 4h2l1.6 8.4h8L16.6 6.6H6.2" strokeLinejoin="round" />
      <circle cx="8" cy="15.6" r="1.2" /><circle cx="14" cy="15.6" r="1.2" /></svg>;
  }
  if (to === "/projects") {
    // 프로젝트 — 카드 묶음
    return <svg {...common}><rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M2.5 8h15" /></svg>;
  }
  if (to === "/studio") {
    // 스튜디오 — 변환(들어가서 나온다)
    return <svg {...common}><path d="M3.5 6.5h7l-2-2M16.5 13.5h-7l2 2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="14.5" cy="6.5" r="2" /><circle cx="5.5" cy="13.5" r="2" /></svg>;
  }
  // 수집 방식 안내 — 엔진
  return <svg {...common}>
    <path d="M3 7.5 8 4.5l5 3" strokeLinejoin="round" />
    <path d="M4.6 8.8v5.2M8 8.8v5.2M11.4 8.8v5.2M3.4 15h9.2" strokeLinecap="round" />
    <rect x="14.6" y="6.8" width="3.2" height="7.2" rx="1" />
  </svg>;
}

export default function Shell({ breadcrumb, projectId, projectName, children }: Props) {
  const { pathname } = useLocation();

  // 사이드바 번호는 "이 순서로 하면 된다"를 말한다. 수집 방식이 셋(트래픽·포털·
  // 문서)으로 늘면서 어디서 시작해 어디서 확인하는지가 한눈에 안 잡혀, 화면
  // 이름과 함께 순서를 붙였다.
  //
  // 수집은 **프로젝트 안에서** 시작하고, 시작 지점은 팝업 하나다. 전에는
  // 전용 화면과 팝업이 함께 있어서 같은 "수집 시작" 이 어디서 누르느냐에 따라
  // 페이지가 되기도 팝업이 되기도 했다.
  // /sources 는 프로젝트 없이도 볼 수 있는 방식 소개로 맨 아래 남긴다.
  // 정확 일치(to)와 접두사(prefixes)를 따로 둔다. 하나의 목록에 섞어 담고
  // 끝의 슬래시로 구분하려 했더니 루트("/")가 모든 경로의 접두사여서
  // 프로젝트 항목이 항상 활성으로 잡혔다. 세션 상세는 /sessions/:id ·
  // /spec-sessions/:id 로 빠지므로, 정확 일치만 보면 정작 작업하는 화면에서
  // 사이드바가 통째로 꺼져 위치를 잃는다.
  // 표면을 둘로 가른다.
  //   GLOBAL   어디서나 갈 수 있는 곳 — 레일 아이콘
  //   프로젝트  프로젝트가 정해져야 뜻이 있는 곳 — 컨텍스트 패널
  // 번호를 뗀 이유는 이제 "이 순서로 하면 된다"가 하나가 아니기 때문이다.
  // 마켓에서 담아 쓰는 길과 스튜디오에서 만들어 쓰는 길이 함께 있다.
  const GLOBAL = [
    { label: "홈", to: "/", prefixes: [] as string[] },
    { label: "마켓플레이스", to: "/market", prefixes: ["/market/"] },
    { label: "내 프로젝트", to: "/projects", prefixes: [] as string[] },
    { label: "수집 스튜디오", to: "/studio", prefixes: [] as string[] },
    { label: "수집 방식 안내", to: "/sources", prefixes: ["/engines/"] },
  ];

  const projectItems = projectId
    ? [
        { label: "수집현황", to: `/projects/${projectId}`,
          prefixes: ["/sessions/", "/spec-sessions/"] },
        { label: "MCP 조회하기", to: `/projects/${projectId}/actions`,
          prefixes: ["/actions/"] },
        { label: "스킬", to: `/projects/${projectId}/skills`,
          prefixes: [`/projects/${projectId}/skills/`] },
        { label: "Playground", to: `/projects/${projectId}/console`,
          prefixes: [] as string[] },
      ]
    : [];

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
        {GLOBAL.map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className={isActive(g) ? "rail-item active" : "rail-item"}
            title={g.label}
          >
            <RailIcon to={g.to} />
            <span className="sr-only">{g.label}</span>
          </Link>
        ))}
        <div className="rail-spacer" />
        <ThemeToggle />
      </nav>

      {hasCtx && (
        <aside className="ctx" aria-label="프로젝트 메뉴">
          {chipLabel && (
            <Link to="/projects" className="ctx-project" title="프로젝트 목록으로">
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
                {item.label}
              </Link>
            ))}
            <Link className="nav-item is-cta" to={`/studio?project=${projectId}`}>
              ＋ API 수집하기
            </Link>
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

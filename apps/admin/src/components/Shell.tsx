import { Link, useLocation } from "react-router-dom";

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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>MCP Studio</span>
        </div>

        {/* 목업의 워크스페이스 칩에는 셰브론이 있지만 여기엔 드롭다운이 없다.
            누를 수 있을 것처럼 보이기만 하는 표시는 넣지 않는다. 칩 자체를
            프로젝트 목록 링크로 두어 다른 프로젝트로 옮기는 길을 만든다. */}
        {projectId && chipLabel && (
          <Link to="/" className="workspace" title="프로젝트 목록으로">
            <span className="workspace-dot">{Array.from(chipLabel)[0]}</span>
            <span>
              <strong>{chipLabel}</strong>
              <small>프로젝트</small>
            </span>
          </Link>
        )}

        <nav>
          {items.map((item) => (
            <Link
              to={item.to}
              key={item.label}
              className={isActive(item) ? "nav-item active" : "nav-item"}
            >
              {/* 번호가 없는 항목(방식 소개)은 빈 칸을 남기지 않는다. 예전에
                  빈 nav-number 가 좁은 폭에서 라벨 없는 빈 줄로 보였다. */}
              {item.number && <span className="nav-number">{item.number}</span>}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span>/</span>}
                {crumb}
              </span>
            ))}
          </div>
        </header>
        <div className="content">{children}</div>
      </section>
    </main>
  );
}

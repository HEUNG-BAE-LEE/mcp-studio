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

  // 번호를 붙이지 않는다. 상단 스테퍼가 이미 STEP 1~5 로 순서를 말하고 있어서,
  // 사이드바에도 01~05 를 달면 다섯 개짜리 번호 순서가 화면에 둘이 된다.
  // 게다가 3·4·5 는 뜻이 맞아떨어지고 1·2 는 전혀 달라서, 부분적으로만 맞는
  // 대응 관계를 학습시켰다. 순서는 스테퍼가, 위치는 사이드바가 맡는다.
  //
  // 프로젝트가 다시 작업의 중심이다. 일괄 수집 폼이 프로젝트 안으로 옮겨오면서
  // "수집 엔진"에는 더 이상 시작할 일이 없다 — 참고 자료로 맨 아래에 둔다.
  // 정확 일치(to)와 접두사(prefixes)를 따로 둔다. 하나의 목록에 섞어 담고
  // 끝의 슬래시로 구분하려 했더니 루트("/")가 모든 경로의 접두사여서
  // 프로젝트 항목이 항상 활성으로 잡혔다.
  const items = [
    { label: "프로젝트", to: "/", prefixes: [] as string[] },
    ...(projectId
      ? [
          {
            label: "수집 세션",
            to: `/projects/${projectId}`,
            // 세션 상세는 /sessions/:id · /spec-sessions/:id 로 빠진다. 정확 일치만
            // 보면 정작 작업하는 화면에서 사이드바가 통째로 꺼져 위치를 잃는다.
            prefixes: ["/sessions/", "/spec-sessions/"],
          },
          {
            label: "액션",
            to: `/projects/${projectId}/actions`,
            prefixes: ["/actions/"],
          },
          {
            label: "테스트 콘솔",
            to: `/projects/${projectId}/console`,
            prefixes: [] as string[],
          },
        ]
      : []),
    // 엔진은 장소가 아니라 수집 사건의 속성이다. 참고 자료로 맨 아래 둔다.
    // /engines/:kind (EngineSessionList) 도 이 항목 소관이라 접두사로 함께 켠다.
    { label: "수집 엔진", to: "/sources", prefixes: ["/engines/"] },
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

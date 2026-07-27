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

  const items = [
    { label: "프로젝트", number: "01", to: "/" },
    ...(projectId
      ? [
          { label: "기록 세션", number: "02", to: `/projects/${projectId}` },
          { label: "액션", number: "03", to: `/projects/${projectId}/actions` },
          { label: "테스트 콘솔", number: "04", to: `/projects/${projectId}/console` },
        ]
      : []),
  ];

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
              className={pathname === item.to ? "nav-item active" : "nav-item"}
            >
              <span className="nav-number">{item.number}</span>
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

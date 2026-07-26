import { Link, useLocation } from "react-router-dom";

type Props = {
  breadcrumb: string[];
  projectId?: number | null;
  children: React.ReactNode;
};

/**
 * 사이드바는 순수 내비게이션이고 스테퍼는 세션 컨텍스트 안의 진행 표시다.
 * 목업은 둘을 사이드바 하나로 합쳤는데, 세션이 여러 개 쌓이면 "현재 단계"가
 * 무엇을 가리키는지 모호해지므로 분리한다.
 *
 * projectId가 없으면 2~4번 항목은 갈 곳이 없으므로 비활성으로 둔다.
 */
export default function Shell({ breadcrumb, projectId, children }: Props) {
  const { pathname } = useLocation();

  const items: { label: string; number: string; to: string | null }[] = [
    { label: "프로젝트", number: "01", to: "/" },
    { label: "기록 세션", number: "02", to: projectId ? `/projects/${projectId}` : null },
    { label: "액션", number: "03", to: projectId ? `/projects/${projectId}/actions` : null },
    { label: "테스트 콘솔", number: "04", to: projectId ? `/projects/${projectId}/console` : null },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>MCP Studio</span>
        </div>
        <nav>
          {items.map((item) =>
            item.to === null ? (
              <span className="nav-item" key={item.label} style={{ opacity: 0.4 }}>
                <span className="nav-number">{item.number}</span>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                key={item.label}
                className={pathname === item.to ? "nav-item active" : "nav-item"}
              >
                <span className="nav-number">{item.number}</span>
                {item.label}
              </Link>
            ),
          )}
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

/**
 * 로딩 · 빈 상태 · 오류 세 가지 상태면.
 *
 * 이전에는 로딩이 "불러오는 중..." 한 줄이라 데이터가 도착하는 순간 레이아웃이
 * 두 번 튀었고, 빈 상태는 다음에 무엇을 하면 되는지 알려주지 않았다.
 */

/** 표가 채워질 자리에 같은 골격을 미리 그린다. 도착해도 화면이 움직이지 않는다. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel panel-pad" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={i > 0 ? { marginTop: 22 } : undefined}>
          <span className="skel" style={{ width: "34%", height: 13 }} />
          <span className="skel" style={{ width: "58%" }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="3.5" width="11" height="9" rx="1.6" />
          <path d="M2 6.4h11" />
          <path d="M14.6 8.6c2 0 1.7 2.4 3.6 2.4" strokeDasharray="1.8 1.8" />
        </svg>
      </div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

/**
 * 오류를 조용히 삼키면 "결과가 없는 상태"와 구분되지 않는다. 촬영 중 백엔드가
 * 꺼져 있으면 원인을 화면에서 바로 읽을 수 있어야 한다.
 */
export function ErrorBox({
  title = "요청을 처리하지 못했습니다",
  message,
  detail,
}: {
  title?: string;
  message: string;
  detail?: string;
}) {
  return (
    <div className="error-box" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {detail && <code className="detail">{detail}</code>}
    </div>
  );
}

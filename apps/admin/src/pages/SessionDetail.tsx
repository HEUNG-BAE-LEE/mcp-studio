import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";

// URL 파싱 실패가 화면 전체를 날리지 않게 한다.
// new URL()은 상대 경로나 깨진 값에 예외를 던지고, React 렌더 중 예외는
// 컴포넌트 트리 전체를 없앤다. 요청 하나 때문에 화면이 사라지면 안 된다.
function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 세션 자체 정보(프로젝트 id/이름)는 브레드크럼을 채우는 데 쓴다.
  const session = useQuery({
    queryKey: ["session", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}`),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["candidates", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}/candidates`),
  });

  const projectId: number | null = session.data?.projectId ?? null;
  const projectName: string = session.data?.projectName ?? "";

  if (isLoading) {
    return (
      <Shell breadcrumb={["Projects", projectName, `세션 #${id}`]} projectId={projectId}>
        <p>불러오는 중...</p>
      </Shell>
    );
  }

  // 오류를 조용히 삼키면 "클릭이 없는 세션"과 구분되지 않는다.
  // 촬영 중 백엔드가 꺼져 있으면 원인을 화면에서 바로 읽을 수 있어야 한다.
  if (isError) {
    return (
      <Shell breadcrumb={["Projects", projectName, `세션 #${id}`]} projectId={projectId}>
        <div className="error-banner">
          <strong>불러오지 못했습니다</strong>
          <p>{errorMessage(error)}</p>
        </div>
      </Shell>
    );
  }

  const groups = data ?? [];

  return (
    <Shell breadcrumb={["Projects", projectName, `세션 #${id}`]} projectId={projectId}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">API 분석</p>
          <h1>세션 #{id}</h1>
          <p className="subtitle">클릭과 연결된 API 후보입니다.</p>
        </div>
      </section>

      <Stepper current={2} />

      {groups.length === 0 && (
        <div className="empty-state">
          <strong>이 세션에는 클릭과 연결된 요청이 없습니다</strong>
        </div>
      )}

      {groups.map((group: any) => (
        <article className="panel" key={group.interaction.id} style={{ marginTop: 16, padding: 18 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{group.interaction.text || "(텍스트 없음)"}</strong>
            <code style={{ marginLeft: 8 }}>{group.interaction.selector}</code>
            <span className="mono" style={{ marginLeft: 8, color: "var(--muted)", fontSize: 12 }}>
              요청 {group.totalRequests}건
            </span>
          </div>

          <div className="project-table table-6col">
            <div className="table-head">
              <span>점수</span>
              <span>Method</span>
              <span>URL</span>
              <span>상태</span>
              <span>추천 사유</span>
              <span />
            </div>
            {group.candidates.map((c: any, i: number) => (
              <div className="table-row" key={c.id}>
                <span className="mono">
                  {i === 0 ? "★ " : ""}
                  {c.score}
                </span>
                <span>{c.method}</span>
                {/* .table-row .mono은 넘치는 값을 말줄임표로 자른다. 실제 공공 API
                    경로는 길어서 화면에서 잘리므로, 호스트·쿼리까지 포함한 원본
                    URL을 title로 달아 마우스만 올리면 전부 읽을 수 있게 한다. */}
                <span className="mono" title={c.url}>{safePath(c.url)}</span>
                <span style={{ color: c.status < 300 ? "var(--green)" : "#dc2626" }}>{c.status}</span>
                <span>{Array.isArray(c.reasons) ? c.reasons.join(", ") : ""}</span>
                <span>
                  <button
                    className="primary"
                    disabled={!c.isJson}
                    onClick={() => navigate(`/actions/new?requestId=${c.id}`)}
                  >
                    액션 만들기
                  </button>
                </span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </Shell>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";

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

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
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
  const breadcrumb = ["프로젝트", projectName, `세션 #${id}`];

  if (isLoading) {
    return (
      <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
        <SkeletonRows />
      </Shell>
    );
  }

  // 오류를 조용히 삼키면 "클릭이 없는 세션"과 구분되지 않는다.
  // 촬영 중 백엔드가 꺼져 있으면 원인을 화면에서 바로 읽을 수 있어야 한다.
  if (isError) {
    return (
      <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
        <ErrorBox
          title="불러오지 못했습니다"
          message={errorMessage(error)}
          detail={`GET /api/recording-sessions/${id}/candidates`}
        />
      </Shell>
    );
  }

  const groups = data ?? [];

  return (
    <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
      <div className="page-head">
        <div>
          <span className="eyebrow">traffic analysis</span>
          <h1>세션 #{id}</h1>
          <p className="page-sub">클릭과 연결된 API 후보입니다</p>
        </div>
      </div>

      <Stepper current={2} />

      {groups.length === 0 && (
        <EmptyState title="이 세션에는 클릭과 연결된 요청이 없습니다" />
      )}

      {groups.map((group: any) => (
        <article className="panel" key={group.interaction.id} style={{ marginTop: 12 }}>
          {/* 클릭 텍스트(제목) / 셀렉터(모노 칩) / 요청 수(우측)로 나눈다.
              이전에는 세 값이 인라인으로 한 줄에 붙어 무엇이 제목인지 흐렸다. */}
          <header className="group-head">
            <strong>{group.interaction.text || "(텍스트 없음)"}</strong>
            <span className="selector" title={group.interaction.selector}>
              {group.interaction.selector}
            </span>
            <span className="push num t3 xs">
              요청 {group.totalRequests}
            </span>
          </header>

          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 110 }}>점수</th>
                <th style={{ width: 72 }}>Method</th>
                <th>URL</th>
                <th style={{ width: 70 }}>상태</th>
                <th style={{ width: 190 }}>추천 사유</th>
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {group.candidates.map((c: any, i: number) => (
                <tr key={c.id}>
                  <td data-label="점수">
                    <span className="cluster">
                      <span className="bar">
                        <span style={{ width: `${Math.min(100, Math.max(0, Number(c.score) || 0))}%` }} />
                      </span>
                      <span className="num">{c.score}</span>
                      {i === 0 && (
                        <span className="sr-only">이 상호작용에서 가장 높은 점수</span>
                      )}
                    </span>
                  </td>
                  <td data-label="Method" className="num">{c.method}</td>
                  {/* 경로는 길어서 잘리므로 호스트를 위에 회색으로 분리해 두고,
                      원본 URL 전체는 title 로 달아 마우스만 올리면 읽히게 한다. */}
                  <td data-label="URL" title={c.url}>
                    <span className="num truncate" style={{ display: "block" }}>
                      {safePath(c.url)}
                    </span>
                    <span className="cell-sub truncate">{safeHost(c.url)}</span>
                  </td>
                  <td data-label="상태">
                    <span className={c.status < 300 ? "dot dot-ok" : "dot dot-danger"}>{c.status}</span>
                  </td>
                  <td data-label="추천 사유">
                    <span className="reasons">
                      {(Array.isArray(c.reasons) ? c.reasons : []).map((r: string) => (
                        <span className="reason" key={r}>
                          {r}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="right">
                    {/* 비활성 버튼을 이유 없이 두지 않는다. JSON 이 아니면
                        스키마를 추론할 수 없어 MCP 를 만들 수 없다. */}
                    {c.isJson ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/actions/new?requestId=${c.id}`)}
                      >
                        MCP 만들기
                      </button>
                    ) : (
                      <span className="t3 xs">
                        JSON 응답이 아님
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </Shell>
  );
}

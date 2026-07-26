import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

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
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["candidates", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}/candidates`),
  });

  if (isLoading) return <p style={{ padding: 24 }}>불러오는 중...</p>;

  // 오류를 조용히 삼키면 "클릭이 없는 세션"과 구분되지 않는다.
  // 촬영 중 백엔드가 꺼져 있으면 원인을 화면에서 바로 읽을 수 있어야 한다.
  if (isError) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 20 }}>기록 세션 #{id}</h1>
        <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 6 }}>
          불러오지 못했습니다: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  const groups = data ?? [];

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>기록 세션 #{id}</h1>

      {groups.length === 0 && (
        <p style={{ marginTop: 16, color: "#666" }}>
          이 세션에는 클릭과 연결된 요청이 없습니다.
        </p>
      )}

      {groups.map((group: any) => (
        <section key={group.interaction.id} style={{ marginTop: 28 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{group.interaction.text || "(텍스트 없음)"}</strong>
            <code style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>
              {group.interaction.selector}
            </code>
            <span style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>
              요청 {group.totalRequests}건
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={{ padding: 8, width: 60 }}>점수</th>
                <th style={{ padding: 8, width: 70 }}>Method</th>
                <th style={{ padding: 8 }}>URL</th>
                <th style={{ padding: 8, width: 60 }}>상태</th>
                <th style={{ padding: 8 }}>추천 사유</th>
                <th style={{ padding: 8, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {group.candidates.map((c: any, i: number) => (
                <tr key={c.id} style={{ borderTop: "1px solid #eee", background: i === 0 ? "#f0f7ff" : undefined }}>
                  <td style={{ padding: 8, fontWeight: 700 }}>
                    {i === 0 ? "★ " : ""}
                    {c.score}
                  </td>
                  <td style={{ padding: 8 }}>{c.method}</td>
                  <td style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
                    {safePath(c.url)}
                  </td>
                  <td style={{ padding: 8, color: c.status < 300 ? "#16a34a" : "#dc2626" }}>{c.status}</td>
                  <td style={{ padding: 8, fontSize: 11, color: "#666" }}>
                    {Array.isArray(c.reasons) ? c.reasons.join(", ") : ""}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      disabled={!c.isJson}
                      onClick={() => navigate(`/actions/new?requestId=${c.id}`)}
                    >
                      액션 만들기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

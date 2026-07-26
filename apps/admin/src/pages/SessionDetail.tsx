import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["candidates", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}/candidates`),
  });

  if (isLoading) return <p style={{ padding: 24 }}>불러오는 중...</p>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>기록 세션 #{id}</h1>

      {(data ?? []).map((group: any) => (
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
                    {new URL(c.url).pathname}
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

import { useState } from "react";
import { api, errorMessage } from "../api/client";

export default function LlmConsole() {
  const [query, setQuery] = useState("광화문 근처 아파트 단지 알려줘");
  const [selection, setSelection] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 실패했는데 화면이 그대로면 멈춘 것처럼 보인다. 두 핸들러 모두
  // 오류를 붙잡아 한국어로 띄우고, 실패한 단계의 낡은 결과는 지운다.
  async function ask() {
    setBusy(true); setResult(null); setError(null);
    try {
      setSelection(await api.post(`/api/projects/1/llm-test`, { query }));
    } catch (err) {
      setSelection(null);   // 실행 버튼이 남아 있으면 안 된다
      setError(errorMessage(err));
    } finally { setBusy(false); }
  }

  async function run() {
    setBusy(true); setResult(null); setError(null);
    try {
      setResult(await api.post(`/api/actions/${selection.actionId}/execute`, {
        arguments: selection.arguments, query,
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ fontSize: 20 }}>LLM 테스트 콘솔</h1>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, padding: 10 }} />
        <button onClick={ask} disabled={busy} style={{ padding: "10px 20px" }}>질의</button>
      </div>

      {error && (
        <div style={{
          marginTop: 20, border: "1px solid #dc2626", background: "#fef2f2",
          padding: 16, borderRadius: 6, color: "#991b1b",
        }}>
          <strong>요청을 처리하지 못했습니다</strong>
          <p style={{ marginTop: 6, fontSize: 14, whiteSpace: "pre-wrap" }}>{error}</p>
        </div>
      )}

      {selection && (
        <div style={{ marginTop: 20, border: "1px solid #ddd", padding: 16, borderRadius: 6 }}>
          <div>선택된 Tool: <strong>{selection.selectedTool ?? "없음"}</strong></div>
          {selection.reason && <p style={{ color: "#666", fontSize: 13 }}>{selection.reason}</p>}
          {selection.arguments && (
            <pre style={{ background: "#f8f8f8", padding: 12, fontSize: 12, overflowX: "auto" }}>
              {JSON.stringify(selection.arguments, null, 2)}
            </pre>
          )}
          {selection.actionId && (
            <button onClick={run} disabled={busy}
              style={{ padding: "10px 20px", background: "#16a34a", color: "#fff", border: 0, borderRadius: 6 }}>
              이 내용으로 실행
            </button>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, border: "1px solid #16a34a", padding: 16, borderRadius: 6 }}>
          <div>HTTP {result.status} · {result.elapsedMs}ms</div>
          <p style={{ fontSize: 15, marginTop: 8 }}>{result.summary}</p>
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>원본 응답 보기</summary>
            <pre style={{ background: "#f8f8f8", padding: 12, fontSize: 11, maxHeight: 300, overflow: "auto" }}>
              {result.rawPreview}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

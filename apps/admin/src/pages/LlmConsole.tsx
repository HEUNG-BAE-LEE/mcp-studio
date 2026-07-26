import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";

export default function LlmConsole() {
  const { id } = useParams();
  const projectId = Number(id);

  const [query, setQuery] = useState("광화문 근처 아파트 단지 알려줘");
  const [selection, setSelection] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");

  // 프로젝트 이름은 브레드크럼에만 쓴다 — 경로가 이미 어느 프로젝트인지 정한다.
  useEffect(() => {
    api.get("/api/projects")
      .then((rows: { id: number; name: string }[]) => {
        const found = rows.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  // 실패했는데 화면이 그대로면 멈춘 것처럼 보인다. 두 핸들러 모두
  // 오류를 붙잡아 한국어로 띄우고, 실패한 단계의 낡은 결과는 지운다.
  async function ask() {
    setBusy(true); setResult(null); setError(null);
    try {
      setSelection(await api.post(`/api/projects/${projectId}/llm-test`, { query }));
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
    <Shell breadcrumb={["Projects", projectName, "테스트 콘솔"]} projectId={projectId}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">테스트</p>
          <h1>LLM 테스트 콘솔</h1>
          <p className="subtitle">ACTIVE 상태인 액션만 선택 대상이 됩니다.</p>
        </div>
      </section>

      <Stepper current={4} />

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, padding: 10 }} />
        <button className="primary" onClick={ask} disabled={busy}>질의</button>
      </div>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {selection && (
        <article className="panel" style={{ marginTop: 20, padding: 16 }}>
          {/* 사람이 붙인 한국어 이름을 앞세운다. tool_name은 모델이 보는 식별자일
              뿐이라 화면에 그것만 띄우면 무엇을 실행하는지 알아볼 수 없다. */}
          <div>
            선택된 액션: <strong>{selection.actionName ?? "없음"}</strong>
            {selection.selectedTool && <code style={{ marginLeft: 8 }}>{selection.selectedTool}</code>}
          </div>
          {selection.reason && <p style={{ color: "var(--muted)", fontSize: 13 }}>{selection.reason}</p>}
          {selection.arguments && (
            <pre style={{ background: "var(--soft)", padding: 12, fontSize: 12, overflowX: "auto" }}>
              {JSON.stringify(selection.arguments, null, 2)}
            </pre>
          )}
          {selection.actionId && (
            <button className="primary" onClick={run} disabled={busy}>이 내용으로 실행</button>
          )}
        </article>
      )}

      {result && (
        <div className="test-layout" style={{ marginTop: 20 }}>
          <article className="panel test-summary">
            <div className="metric-grid">
              <div>
                <small>HTTP 상태</small>
                <strong>{result.status}</strong>
              </div>
              <div>
                <small>소요 시간</small>
                <strong>{result.elapsedMs}ms</strong>
              </div>
            </div>
            <p style={{ fontSize: 15, marginTop: 8 }}>{result.summary}</p>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>원본 응답 보기</summary>
              <pre style={{ background: "var(--soft)", padding: 12, fontSize: 11, maxHeight: 300, overflow: "auto" }}>
                {result.rawPreview}
              </pre>
            </details>
          </article>
        </div>
      )}
    </Shell>
  );
}

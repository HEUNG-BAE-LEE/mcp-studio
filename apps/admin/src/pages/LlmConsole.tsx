import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";
import CredentialPanel from "../components/CredentialPanel";
import { ErrorBox } from "../components/States";

/**
 * 질의 → 도구 선택 → 실행을 좌측 궤적으로 세우고, 결과와 인증키는 우측
 * 계측 열로 뺀다. 이전에는 셋이 같은 무게로 세로로 쌓여 어디가 결과인지
 * 읽히지 않았고, 인증키 패널이 언제나 화면 맨 위를 차지했다.
 *
 * 호출은 이전과 같다 — 질의 1회(`llm-test`), 실행 1회(`execute`). 궤적은
 * 화면 상태일 뿐이라 새로고침하면 사라진다. 히스토리 누적·재실행·스트리밍은
 * 넣지 않는다.
 */
export default function LlmConsole() {
  const { id } = useParams();
  const projectId = Number(id);

  const [query, setQuery] = useState("광화문 근처 아파트 단지 알려줘");
  const [selection, setSelection] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [asked, setAsked] = useState("");

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
    setBusy(true);
    setResult(null);
    setError(null);
    setAsked(query);
    try {
      setSelection(await api.post(`/api/projects/${projectId}/llm-test`, { query }));
    } catch (err) {
      setSelection(null); // 실행 버튼이 남아 있으면 안 된다
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      setResult(
        await api.post(`/api/actions/${selection.actionId}/execute`, {
          arguments: selection.arguments,
          query,
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      breadcrumb={["프로젝트", projectName, "테스트 콘솔"]}
      projectId={projectId}
      projectName={projectName}
    >
      <div className="page-head">
        <div>
          <span className="eyebrow">test console</span>
          <h1>LLM 테스트 콘솔</h1>
          <p className="page-sub">활성 상태인 액션만 선택 대상이 됩니다</p>
        </div>
      </div>

      <Stepper current={4} />

      <div className="console-grid">
        <div className="trace">
          <div className="panel trace-step">
            <span className="field-label">질의</span>
            <div className="ask-row">
              <input
                className="input"
                value={query}
                aria-label="질의"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) ask();
                }}
              />
              <button type="button" className="btn btn-primary" onClick={ask} disabled={busy}>
                {busy && !selection ? "묻는 중…" : "질의"}
              </button>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {selection && (
            <div className="panel trace-step is-active">
              <div className="cluster between">
                <span className="field-label m0">
                  도구 선택
                </span>
                <span className="num t3" style={{ fontSize: 11 }}>
                  tool_choice=required
                </span>
              </div>
              {/* 사람이 붙인 한국어 이름을 앞세운다. tool_name은 모델이 보는
                  식별자일 뿐이라 화면에 그것만 띄우면 무엇을 실행하는지
                  알아볼 수 없다. */}
              <strong style={{ display: "block", marginTop: 7 }}>{selection.actionName ?? "없음"}</strong>
              {selection.selectedTool && (
                <code className="param-key" style={{ marginTop: 6, display: "inline-block" }}>
                  {selection.selectedTool}
                </code>
              )}
              {selection.reason && (
                <p className="field-help" style={{ marginTop: 7 }}>
                  {selection.reason}
                </p>
              )}
              {selection.arguments && (
                <div className="code mt-3">
                  <div className="code-head">
                    <span>arguments</span>
                  </div>
                  <pre>{JSON.stringify(selection.arguments, null, 2)}</pre>
                </div>
              )}
              {selection.actionId && (
                <div className="cluster mt-3">
                  <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={busy}>
                    {busy ? "실행 중…" : "이 내용으로 실행"}
                  </button>
                  {asked && (
                    <span className="t3 truncate xs">
                      “{asked}”
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          {result && (
            <article className="panel panel-pad">
              <span className="field-label">실행 결과</span>
              <div className="metrics" style={{ marginTop: 4 }}>
                <div className={result.status < 300 ? "is-ok" : "is-danger"}>
                  <b>{result.status}</b>
                  <small>HTTP</small>
                </div>
                <div>
                  <b>
                    {result.elapsedMs}
                    <span style={{ fontSize: 12, color: "var(--tx-3)" }}>ms</span>
                  </b>
                  <small>소요</small>
                </div>
              </div>
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--tx-2)" }}>{result.summary}</p>
              {result.rawPreview && (
                <details style={{ marginTop: 12 }}>
                  <summary className="field-help" style={{ cursor: "pointer" }}>
                    원본 응답 보기
                  </summary>
                  <div className="code mt-2">
                    <pre>{result.rawPreview}</pre>
                  </div>
                </details>
              )}
            </article>
          )}

          <CredentialPanel projectId={projectId} />
        </div>
      </div>
    </Shell>
  );
}

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import CredentialPanel from "../components/CredentialPanel";
import { KindMark } from "../components/CollectionMark";

/**
 * Playground — 수집한 MCP 도구로 실제로 답이 나오는지 확인하는 화면.
 *
 * 대화만 보여주면 "그럴듯한 답"과 "실제 API 를 호출해서 얻은 답"을 구분할 수
 * 없다. 그래서 왼쪽은 대화, 오른쪽은 그 답이 어떻게 만들어졌는지를 둔다 —
 * 어떤 도구를 왜 골랐고, 무엇을 보냈고, 무엇이 돌아왔는지.
 *
 * 대상은 이 프로젝트에서 **사용 중**인 도구뿐이다. 미사용 도구까지 후보에
 * 넣으면 화면에서 끈 도구가 호출되어 혼란스럽다.
 */

// 수집해 둔 공공데이터포털 API 로 실제로 답이 나오는 질문들.
// 예시가 실제 도구와 맞지 않으면 처음 쓰는 사람이 "안 되는 기능"으로 오해한다.
const EXAMPLES = [
  "서울 종로구 지금 미세먼지 알려줘",
  "내일 대기질 예보가 어때?",
  "부산 대기질 측정소 목록 보여줘",
  "경기도 초미세먼지 주간예보 알려줘",
  "미세먼지 경보가 발령된 곳이 있어?",
];

type Step = {
  toolName: string;
  actionId: number | null;
  actionName: string;
  sourceKind: string;
  why: string;
  arguments: Record<string, unknown>;
  status?: number;
  elapsedMs?: number;
  request?: { method: string; url: string; content?: string | null };
  body?: unknown;
  rawPreview?: string;
  error?: string;
};

type PoolItem = { toolName: string; actionId: number; name: string; sourceKind: string };

type Turn = {
  id: number;
  question: string;
  answer: string | null;
  steps: Step[];
  error: string | null;
  /** 호출 상한에 걸려 더 부르지 못한 채 답했는지 */
  truncated: boolean;
};

// 한 질문에 쓸 수 있는 도구 호출 수. 서버(MAX_TOOL_CALLS)와 같은 값이며,
// 응답에 실린 maxToolCalls 로 덮어쓴다.
const DEFAULT_MAX_CALLS = 3;

function pretty(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 2xx 는 초록, 그 밖은 빨강. 호출이 성공했는지가 한눈에 보여야 한다. */
function statusClass(status?: number): string {
  if (status === undefined) return "";
  return status >= 200 && status < 300 ? "ok" : "bad";
}

export default function LlmConsole() {
  const { id } = useParams();
  const projectId = Number(id);

  const [projectName, setProjectName] = useState("");
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 오른쪽에 무엇을 띄울지. null 이면 도구 목록(무엇 중에서 고르는지)을 보여준다.
  const [picked, setPicked] = useState<{ turn: number; index: number } | null>(null);
  const [maxCalls, setMaxCalls] = useState(DEFAULT_MAX_CALLS);

  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    api.get("/api/projects")
      .then((rows: { id: number; name: string }[]) => {
        const found = rows.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));

    // 대화를 시작하기 전에도 무엇이 후보인지 보여준다. 빈 오른쪽 패널은
    // 이 화면이 무엇을 대상으로 도는지 감추는 셈이다.
    api.get(`/api/projects/${projectId}/actions`)
      .then((rows: any[]) => setPool(
        rows.filter((r) => r.status === "ACTIVE").map((r) => ({
          toolName: r.toolName, actionId: r.id, name: r.name, sourceKind: r.sourceKind || "traffic",
        })),
      ))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const turnId = turns.length;
    setTurns((prev) => [...prev, {
      id: turnId, question, answer: null, steps: [], error: null, truncated: false,
    }]);
    setQuery("");
    setBusy(true);
    setError(null);

    // 이전 대화를 함께 보낸다. "그럼 부산은?" 같은 이어지는 질문이 통해야 한다.
    const messages = [
      ...turns.flatMap((t) => (
        t.answer
          ? [{ role: "user", content: t.question }, { role: "assistant", content: t.answer }]
          : [{ role: "user", content: t.question }]
      )),
      { role: "user", content: question },
    ];

    try {
      const res = await api.post(`/api/projects/${projectId}/chat`, { messages });
      setTurns((prev) => prev.map((t) => (
        t.id === turnId
          ? { ...t, answer: res.answer, steps: res.steps ?? [], truncated: !!res.truncated }
          : t
      )));
      if (res.pool?.length) setPool(res.pool);
      if (res.maxToolCalls) setMaxCalls(res.maxToolCalls);
      // 방금 호출한 도구를 바로 펼쳐 준다. 로그를 보려고 한 번 더 클릭하게
      // 만들 이유가 없다.
      if (res.steps?.length) setPicked({ turn: turnId, index: 0 });
    } catch (err) {
      const message = errorMessage(err);
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, error: message } : t)));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const pickedStep = picked ? turns[picked.turn]?.steps[picked.index] : undefined;

  return (
    <Shell breadcrumb={["Projects", projectName, "Playground"]} projectId={projectId} projectName={projectName}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">PLAYGROUND</p>
          <h1>Playground</h1>
          <p className="subtitle">
            물으면 이 프로젝트에서 <b>사용 중</b>인 MCP 도구를 골라 실제로 호출하고, 결과가 모자라면
            최대 <b>{maxCalls}번</b>까지 이어서 부른 뒤 답합니다.
            오른쪽에서 호출마다 왜 그 도구였는지, 무엇을 주고받았는지 볼 수 있습니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      <CredentialPanel projectId={projectId} />

      <div className="pg-layout">
        {/* ── 왼쪽: 대화 ── */}
        <section className="pg-chat panel">
          <div className="pg-thread">
            {turns.length === 0 && (
              <div className="pg-welcome">
                <span className="pg-avatar">MCP</span>
                <div>
                  <strong>수집한 도구로 답해 드립니다</strong>
                  <p>
                    지금 사용 중인 도구는 <b>{pool.length}개</b>입니다. 아래 예시를 누르거나
                    직접 물어보세요.
                  </p>
                </div>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className="pg-turn">
                <div className="pg-msg is-user"><p>{turn.question}</p></div>

                {turn.error ? (
                  <div className="pg-msg is-bot is-error">
                    <span className="pg-avatar">!</span>
                    <div><p>{turn.error}</p></div>
                  </div>
                ) : turn.answer === null ? (
                  <div className="pg-msg is-bot">
                    <span className="pg-avatar">MCP</span>
                    <div className="pg-typing"><i /><i /><i /></div>
                  </div>
                ) : (
                  <div className="pg-msg is-bot">
                    <span className="pg-avatar">MCP</span>
                    <div>
                      {turn.steps.length > 0 && (
                        <div className="pg-steps">
                          <span className="pg-steps-count">
                            도구 {turn.steps.length}/{maxCalls}회
                          </span>
                          {turn.steps.map((step, index) => {
                            const on = picked?.turn === turn.id && picked?.index === index;
                            const failed = step.error !== undefined
                              || (step.status !== undefined && step.status >= 400);
                            return (
                              <button
                                key={`${step.toolName}-${index}`}
                                className={`pg-step ${on ? "on" : ""} ${failed ? "failed" : ""}`}
                                onClick={() => setPicked({ turn: turn.id, index })}
                                title="이 호출의 입력·출력 보기"
                              >
                                <b>{index + 1}</b>
                                <KindMark kind={step.sourceKind} size={12} />
                                <span className="mono">{step.toolName}</span>
                                {step.status !== undefined && (
                                  <em className={statusClass(step.status)}>{step.status}</em>
                                )}
                                {step.error !== undefined && <em className="bad">실패</em>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p>{turn.answer}</p>
                      {turn.truncated && (
                        <p className="pg-truncated">
                          도구 호출 상한({maxCalls}회)에 닿아 더 확인하지 않고 답했습니다.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="pg-composer">
            {turns.length === 0 && (
              <div className="pg-examples">
                {EXAMPLES.map((example) => (
                  <button key={example} onClick={() => ask(example)} disabled={busy}>{example}</button>
                ))}
              </div>
            )}
            <div className="pg-input">
              <textarea
                ref={inputRef}
                rows={1}
                value={query}
                placeholder="예: 서울 종로구 지금 미세먼지 알려줘"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter 로 보내고 Shift+Enter 로 줄바꿈. 채팅에서 기대되는 동작이다.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(query);
                  }
                }}
                disabled={busy}
              />
              <button className="primary" onClick={() => ask(query)} disabled={busy || !query.trim()}>
                {busy ? "호출 중…" : "보내기"}
              </button>
            </div>
          </div>
        </section>

        {/* ── 오른쪽: 호출 로그 ── */}
        <aside className="pg-log panel">
          <header className="pg-log-head">
            <strong>
              {pickedStep
                ? `호출 로그 ${(picked?.index ?? 0) + 1}/${turns[picked!.turn]?.steps.length ?? 1}`
                : "대상 MCP 도구"}
            </strong>
            {pickedStep && (
              <button className="btn-quiet" onClick={() => setPicked(null)}>도구 목록</button>
            )}
          </header>

          {!pickedStep ? (
            <div className="pg-pool">
              <p className="pg-log-note">
                사용 중인 <b>{pool.length}개</b> 중에서 고릅니다. 미사용 도구는 후보에서 빠지며,
                한 질문에 최대 <b>{maxCalls}번</b>까지 이어서 부릅니다.
              </p>
              <ul>
                {pool.map((item) => (
                  <li key={item.actionId}>
                    <KindMark kind={item.sourceKind} size={12} />
                    <span className="mono">{item.toolName}</span>
                    <small>{item.name}</small>
                  </li>
                ))}
              </ul>
              {pool.length === 0 && (
                <p className="pg-log-note">
                  사용 중인 도구가 없습니다. <b>MCP 조회하기</b>에서 도구를 켜 주세요.
                </p>
              )}
            </div>
          ) : (
            <div className="pg-detail">
              <div className="pg-detail-top">
                <KindMark kind={pickedStep.sourceKind} size={13} />
                <b className="mono">{pickedStep.toolName}</b>
                {pickedStep.status !== undefined && (
                  <span className={`pg-status ${statusClass(pickedStep.status)}`}>
                    {pickedStep.status}
                  </span>
                )}
                {pickedStep.elapsedMs !== undefined && (
                  <span className="pg-ms">{pickedStep.elapsedMs}ms</span>
                )}
              </div>
              <p className="pg-detail-name">{pickedStep.actionName}</p>

              {(turns[picked!.turn]?.steps.length ?? 0) > 1 && (
                <div className="pg-step-nav">
                  {turns[picked!.turn].steps.map((step, index) => (
                    <button
                      key={`${step.toolName}-${index}`}
                      className={index === picked!.index ? "on" : ""}
                      onClick={() => setPicked({ turn: picked!.turn, index })}
                      title={step.toolName}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              )}

              <section className="pg-block">
                <h4>선택 이유</h4>
                <p className="pg-why">
                  {pickedStep.why || "모델이 이유를 남기지 않았습니다. 도구 설명만 보고 골랐습니다."}
                </p>
              </section>

              <section className="pg-block">
                <h4>INPUT · 모델이 채운 인자</h4>
                <pre>{pretty(pickedStep.arguments) || "{}"}</pre>
              </section>

              {pickedStep.request && (
                <section className="pg-block">
                  <h4>요청</h4>
                  <pre>{`${pickedStep.request.method} ${pickedStep.request.url}`}</pre>
                  <p className="pg-log-note">인증키는 실행 시점에 주입되며 값은 표시하지 않습니다.</p>
                </section>
              )}

              {pickedStep.error && (
                <section className="pg-block is-error">
                  <h4>실패</h4>
                  <p>{pickedStep.error}</p>
                </section>
              )}

              {pickedStep.body !== undefined && (
                <section className="pg-block">
                  <h4>OUTPUT · 응답 요약</h4>
                  <pre>{pretty(pickedStep.body)}</pre>
                </section>
              )}

              {pickedStep.rawPreview && (
                <details className="pg-raw">
                  <summary>원문 응답 보기</summary>
                  <pre>{pickedStep.rawPreview}</pre>
                </details>
              )}
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

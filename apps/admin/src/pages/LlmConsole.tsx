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
 * 무엇을 호출했고, 무엇을 보냈고, 무엇이 돌아왔는지.
 *
 * 오른쪽에 후보 도구 목록을 늘어놓지는 않는다. 스물몇 개를 나열해 봐야 읽지 않고,
 * 정작 알고 싶은 것은 "이번에 무엇이 돌았는가"이기 때문이다.
 */

// 한 질문에 쓸 수 있는 도구 호출 수. 서버(MAX_TOOL_CALLS)와 같은 값이며,
// 응답에 실린 maxToolCalls 로 덮어쓴다.
const DEFAULT_MAX_CALLS = 3;

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

type Turn = {
  id: number;
  question: string;
  answer: string | null;
  steps: Step[];
  error: string | null;
  /** 호출 상한에 걸려 더 부르지 못한 채 답했는지 */
  truncated: boolean;
};

/** 사람이 읽는 이름인가. 포털 수집은 요약이 없으면 영문 오퍼레이션명을 그대로
 *  이름으로 쓴다(getUlfptcaAlarmInfo). 그런 이름을 "이렇게 물어보세요"로 내밀면
 *  무엇을 하는 도구인지 알 수 없다. */
function readable(name: string): boolean {
  return /[가-힣]/.test(name || "");
}

/** 설명에 붙은 제공기관 접두와 끝의 오퍼레이션명을 떼어 본문만 남긴다.
 *  "한국환경공단] 한국환경공단_에어코리아_미세먼지 경보 발령 현황 — getUlfptca…" */
function cleanDescription(text: string): string {
  return (text || "")
    .replace(/^[^\]]*\]\s*/, "")
    .replace(/\s*—\s*\w+$/, "")
    .replace(/^[^_]+_/, "")
    .replace(/_/g, " ")
    .trim();
}

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
function tone(step: Step): "ok" | "bad" {
  if (step.error !== undefined) return "bad";
  if (step.status !== undefined && (step.status < 200 || step.status >= 300)) return "bad";
  return "ok";
}

/** 긴 URL 은 쿼리 앞에서 끊어 보여준다. 전체는 title 로 남겨 둔다. */
function shortUrl(url: string): string {
  const [base] = url.split("?");
  return base.replace(/^https?:\/\//, "");
}

export default function LlmConsole() {
  const { id } = useParams();
  const projectId = Number(id);

  const [projectName, setProjectName] = useState("");
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  // 빈 화면에 무엇을 물어볼 수 있는지 알려주려면 이 프로젝트가 실제로 가진 도구를
  // 보여줘야 한다. 질문 예시를 코드에 박아 두면 수집한 API 가 바뀐 프로젝트에서
  // 엉뚱한 예시가 뜨고, 눌러 본 사람은 "안 되는 기능"으로 오해한다.
  const [tools, setTools] = useState<{ label: string; toolName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxCalls, setMaxCalls] = useState(DEFAULT_MAX_CALLS);
  // 오른쪽에서 펼쳐 둔 호출. `${turnId}-${index}` 형태.
  const [openStep, setOpenStep] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    api.get("/api/projects")
      .then((rows: { id: number; name: string }[]) => {
        const found = rows.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));

    api.get(`/api/projects/${projectId}/actions`)
      .then((rows: any[]) => setTools(
        rows.filter((r) => r.status === "ACTIVE").map((r) => ({
          label: readable(r.name) ? r.name : cleanDescription(r.description) || r.name,
          toolName: r.toolName,
        }))))
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
      if (res.maxToolCalls) setMaxCalls(res.maxToolCalls);
      // 방금 돈 호출을 펼쳐 둔다. 로그를 보려고 한 번 더 누르게 만들 이유가 없다.
      if (res.steps?.length) setOpenStep(`${turnId}-0`);
    } catch (err) {
      const message = errorMessage(err);
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, error: message } : t)));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  // 오른쪽은 지금까지 실제로 돈 호출만 시간순으로 쌓는다.
  const calls = turns.flatMap((turn) =>
    turn.steps.map((step, index) => ({ turn, step, index, key: `${turn.id}-${index}` })));

  return (
    <Shell breadcrumb={["Projects", projectName, "Playground"]} projectId={projectId} projectName={projectName}>
      <section className="heading-row pg-head">
        <div>
          <p className="eyebrow">PLAYGROUND</p>
          <h1>Playground</h1>
          <p className="subtitle">
            물으면 수집한 MCP 도구를 골라 실제로 호출합니다. 결과가 모자라면 최대 {maxCalls}번까지
            이어서 부른 뒤 답하며, 오른쪽에 무엇을 주고받았는지 남습니다.
          </p>
        </div>
        <CredentialPanel projectId={projectId} />
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="pg-layout">
        {/* ── 왼쪽: 대화 ── */}
        <section className="pg-chat">
          <div className="pg-thread">
            {turns.length === 0 && (
              <div className="pg-welcome">
                <span className="pg-orb" aria-hidden="true" />
                <h2>무엇이든 물어보세요</h2>
                <p>
                  {tools.length === 0 ? "수집한" : <><b>{tools.length}개</b>의</>} MCP 도구 중에서 골라
                  실제 공공 API 를 호출해 답합니다.
                </p>
                {tools.length > 0 && (
                  <>
                    <p className="pg-tools-label">이런 것을 물어볼 수 있습니다</p>
                    <div className="pg-examples">
                      {tools.slice(0, 4).map((tool) => (
                        <button
                          key={tool.toolName}
                          onClick={() => { setQuery(tool.label); inputRef.current?.focus(); }}
                          disabled={busy}
                          title={tool.toolName}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className="pg-turn">
                <div className="pg-msg is-user"><p>{turn.question}</p></div>

                {turn.error ? (
                  <div className="pg-msg is-bot">
                    <span className="pg-avatar is-error" aria-hidden="true">!</span>
                    <div className="pg-bubble is-error"><p>{turn.error}</p></div>
                  </div>
                ) : turn.answer === null ? (
                  <div className="pg-msg is-bot">
                    <span className="pg-avatar" aria-hidden="true" />
                    <div className="pg-bubble">
                      <div className="pg-typing"><i /><i /><i /></div>
                    </div>
                  </div>
                ) : (
                  <div className="pg-msg is-bot">
                    <span className="pg-avatar" aria-hidden="true" />
                    <div className="pg-bubble">
                      {turn.steps.length > 0 && (
                        <div className="pg-used">
                          {turn.steps.map((step, index) => (
                            <button
                              key={`${step.toolName}-${index}`}
                              className={`pg-used-chip ${tone(step)} ${openStep === `${turn.id}-${index}` ? "on" : ""}`}
                              onClick={() => setOpenStep(`${turn.id}-${index}`)}
                              title="오른쪽에서 이 호출의 입력·출력 보기"
                            >
                              <KindMark kind={step.sourceKind} size={11} />
                              <span className="mono">{step.toolName}</span>
                            </button>
                          ))}
                          <span className="pg-used-count">{turn.steps.length}/{maxCalls}</span>
                        </div>
                      )}
                      <p>{turn.answer}</p>
                      {turn.truncated && (
                        <p className="pg-truncated">
                          호출 상한({maxCalls}회)에 닿아 더 확인하지 않고 답했습니다.
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
            <div className="pg-input">
              <textarea
                ref={inputRef}
                rows={1}
                value={query}
                placeholder={tools[0] ? `예: ${tools[0].label}` : "무엇이 궁금하세요?"}
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
              <button
                className="pg-send"
                onClick={() => ask(query)}
                disabled={busy || !query.trim()}
                aria-label="보내기"
              >
                {busy ? (
                  <span className="pg-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 13V3M8 3 3.6 7.4M8 3l4.4 4.4" />
                  </svg>
                )}
              </button>
            </div>
            <p className="pg-hint">Enter 로 전송 · Shift+Enter 로 줄바꿈</p>
          </div>
        </section>

        {/* ── 오른쪽: 실제로 돈 호출 ── */}
        <aside className="pg-log">
          <header className="pg-log-head">
            <strong>호출 로그</strong>
            {calls.length > 0 && <span className="pg-log-count">{calls.length}건</span>}
          </header>

          {calls.length === 0 ? (
            <div className="pg-log-empty">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M4 6h16M4 12h10M4 18h13" strokeLinecap="round" />
              </svg>
              <strong>아직 호출된 도구가 없습니다</strong>
              <small>질문하면 어떤 MCP 를 왜 골랐고, 무엇을 주고받았는지 여기에 쌓입니다.</small>
            </div>
          ) : (
            <div className="pg-log-list">
              {calls.map(({ turn, step, index, key }, flat) => {
                const open = openStep === key;
                return (
                  <article key={key} className={`pg-call ${tone(step)} ${open ? "is-open" : ""}`}>
                    {/* 질문이 바뀌는 지점에만 붙여, 어느 물음에서 나온 호출인지 구분한다 */}
                    {index === 0 && <p className="pg-call-q">{turn.question}</p>}

                    <button className="pg-call-head" onClick={() => setOpenStep(open ? null : key)}>
                      <span className="pg-call-no">{flat + 1}</span>
                      <span className="pg-call-title">
                        <b className="mono">
                          <KindMark kind={step.sourceKind} size={11} />
                          <span>{step.toolName}</span>
                        </b>
                        <small>{step.actionName}</small>
                      </span>
                      <span className="pg-call-meta">
                        {step.error !== undefined
                          ? <em className="pg-status bad">실패</em>
                          : step.status !== undefined && (
                            <em className={`pg-status ${tone(step)}`}>{step.status}</em>
                          )}
                        {step.elapsedMs !== undefined && <span>{step.elapsedMs}ms</span>}
                      </span>
                      <svg className="pg-call-caret" width="12" height="12" viewBox="0 0 16 16"
                           fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="m5 6.5 3 3 3-3" />
                      </svg>
                    </button>

                    {open && (
                      <div className="pg-call-body">
                        {step.why && <p className="pg-why">{step.why}</p>}

                        <div className="pg-io">
                          <h4>Input</h4>
                          <pre>{pretty(step.arguments) || "{}"}</pre>
                        </div>

                        {step.request && (
                          <div className="pg-io">
                            <h4>Request</h4>
                            <p className="pg-req" title={step.request.url}>
                              <em>{step.request.method}</em>
                              <span>{shortUrl(step.request.url)}</span>
                            </p>
                          </div>
                        )}

                        {step.error && (
                          <div className="pg-io is-error">
                            <h4>Error</h4>
                            <p>{step.error}</p>
                          </div>
                        )}

                        {step.body !== undefined && (
                          <div className="pg-io">
                            <h4>Output</h4>
                            <pre>{pretty(step.body)}</pre>
                          </div>
                        )}

                        {step.rawPreview && (
                          <details className="pg-raw">
                            <summary>원문 응답</summary>
                            <pre>{step.rawPreview}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

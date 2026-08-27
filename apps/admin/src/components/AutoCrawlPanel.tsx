import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { ErrorBox } from "./States";

/**
 * 자동 트래픽 수집 — 사람은 로그인만, 탐색은 기계가.
 *
 * 전에는 사람이 화면을 하나씩 눌러야 API 가 잡혔다. 고객이 그 수고를 할 리
 * 없고, 안 눌러 본 화면의 API 는 존재조차 모른 채 끝났다.
 *
 * 이 화면이 묻는 것은 둘뿐이다 — **어디서 시작할지**와 **무엇을 모으고
 * 싶은지**. 그 한 문장이 어디로 갈지와 무엇을 담을지를 함께 정한다.
 *
 * 로그인은 사람이 한다. 아이디·비밀번호를 우리에게 주지 않는다 —
 * 받지 않는 것이 설계다.
 */

type Status = { hasSession: boolean; loginOpen: boolean; playwright: boolean };
type Api = {
  method: string; url: string; path: string; seen: number; statuses: number[];
  required: string[]; optional: string[]; why: string; fromPages: string[];
};
type Job = {
  jobId: string; phase: string; visited: number; queued: number; found: number;
  current: string; done: boolean; error: string; log: string[];
  result?: { apis: Api[]; visited: number; skipped: { url: string; text: string; why: string }[]; seconds: number };
};

const PRESET_INTENTS = [
  "주문과 배송 조회에 관련된 API 를 모으고 싶습니다. 결제나 관리자 기능은 필요 없습니다.",
  "고객 정보와 상담 이력을 조회하는 API 를 찾고 있습니다.",
  "상품 목록과 재고를 조회하는 API 만 필요합니다.",
];

export default function AutoCrawlPanel({
  projectId, projectName,
}: {
  projectId: number | null;
  projectName: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState("");
  const [intent, setIntent] = useState("");
  const [readOnly, setReadOnly] = useState(true);
  const [maxPages, setMaxPages] = useState(40);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [made, setMade] = useState<{ created: number; sessionId: number } | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const poll = useRef<number | null>(null);

  const loadStatus = useCallback(() => {
    if (projectId == null) return;
    api.get(`/api/autocrawl/status/${projectId}`)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [projectId]);

  useEffect(loadStatus, [loadStatus]);

  // 탐색이 도는 동안만 묻는다. 끝나면 스스로 멈춘다 — 끝난 작업을
  // 계속 폴링하면 서버에 의미 없는 부하가 쌓인다.
  useEffect(() => {
    if (!job || job.done) {
      if (poll.current) window.clearInterval(poll.current);
      return;
    }
    poll.current = window.setInterval(() => {
      api.get(`/api/autocrawl/jobs/${job.jobId}`)
        .then((next: Job) => {
          setJob(next);
          // 끝나면 검증된 것을 미리 골라 둔다. 하나씩 누르게 하면
          // 30개를 다 눌러야 한다.
          if (next.done && next.result) {
            setPicked(next.result.apis.map((a) => a.url));
          }
        })
        .catch(() => { /* 잠깐의 실패로 화면을 끄지 않는다 */ });
    }, 1500);
    return () => { if (poll.current) window.clearInterval(poll.current); };
  }, [job]);

  async function call(what: string, fn: () => Promise<unknown>) {
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      loadStatus();
    }
  }

  const canStart = url.trim().startsWith("http") && projectId != null;

  if (projectId == null) {
    return <p className="guide-note"><strong>프로젝트를 먼저 고르세요</strong>
      수집한 MCP 가 담길 곳이 정해져야 시작할 수 있습니다.</p>;
  }

  if (status && !status.playwright) {
    return (
      <div className="tf-bar is-missing">
        <div className="tf-bar-head">
          <span className="tf-dot" aria-hidden="true" />
          <strong>자동 탐색용 브라우저가 없습니다</strong>
        </div>
        <p>
          자동 수집은 서버가 브라우저를 직접 열어 화면을 타고 다닙니다.
          그 브라우저를 한 번 설치해야 합니다.
        </p>
        <pre className="code-line">python -m playwright install chromium</pre>
        <p className="tf-hint">설치 후 이 페이지를 새로고침하세요.</p>
      </div>
    );
  }

  return (
    <div className="ac">
      {error && <ErrorBox message={error} />}

      {/* ── 1. 어디서 · 무엇을 ── */}
      <div className="ac-form">
        <label className="field-label" htmlFor="ac-url">시작할 주소</label>
        <input id="ac-url" className="input" value={url}
               placeholder="https://portal.example.co.kr/dashboard"
               onChange={(e) => setUrl(e.target.value)} />

        <label className="field-label" htmlFor="ac-intent" style={{ marginTop: 16 }}>
          무엇을 수집하고 싶나요
        </label>
        <textarea id="ac-intent" className="textarea" rows={3} value={intent}
                  placeholder="주문과 배송 조회에 관련된 API 를 모으고 싶습니다. 결제나 관리자 기능은 필요 없습니다."
                  onChange={(e) => setIntent(e.target.value)} />
        <p className="field-help">
          이 문장이 <strong>어디로 갈지</strong>와 <strong>무엇을 담을지</strong>를 함께 정합니다.
          적지 않으면 사이트 전체를 무작정 돌게 됩니다.
        </p>
        <div className="ac-presets">
          {PRESET_INTENTS.map((t) => (
            <button key={t} type="button" className="ac-preset" onClick={() => setIntent(t)}>
              {t.slice(0, 22)}…
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. 로그인 (필요할 때만) ── */}
      <div className={`ac-step ${status?.hasSession ? "is-done" : ""}`}>
        <div className="ac-step-hd">
          <span className="ac-no" aria-hidden="true">{status?.hasSession ? "✓" : "1"}</span>
          <strong>로그인은 직접 하세요</strong>
          {status?.hasSession && <span className="state-pill is-ok">세션 저장됨</span>}
        </div>
        <p>
          브라우저 창이 열리면 평소처럼 로그인하세요.
          <strong> 아이디·비밀번호는 저장하지 않습니다</strong> — 로그인이 끝난 뒤의
          세션만 보관하고 창은 닫습니다.
        </p>
        <div className="cluster">
          {!status?.loginOpen && (
            <button type="button" className="btn" disabled={!canStart || busy !== null}
                    onClick={() => call("open", () =>
                      api.post("/api/autocrawl/login-open", { url: url.trim(), projectId }))}>
              {busy === "open" ? "여는 중…" : "브라우저 열기"}
            </button>
          )}
          {status?.loginOpen && (
            <>
              <button type="button" className="btn btn-primary" disabled={busy !== null}
                      onClick={() => call("confirm", () =>
                        api.post("/api/autocrawl/login-confirm", { url: url.trim(), projectId }))}>
                {busy === "confirm" ? "저장 중…" : "로그인했습니다"}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy !== null}
                      onClick={() => call("cancel", () =>
                        api.post("/api/autocrawl/login-cancel", { url: url.trim(), projectId }))}>
                취소
              </button>
            </>
          )}
          {status?.hasSession && !status.loginOpen && (
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => call("forget", () =>
                      api.delete(`/api/autocrawl/session/${projectId}`))}>
              저장된 로그인 지우기
            </button>
          )}
          <span className="tf-hint">로그인이 필요 없는 사이트면 건너뛰어도 됩니다.</span>
        </div>
      </div>

      {/* ── 3. 범위 ── */}
      <div className="ac-step">
        <div className="ac-step-hd">
          <span className="ac-no" aria-hidden="true">2</span>
          <strong>어디까지 볼지 정하세요</strong>
        </div>
        <div className="ac-limits">
          <label className="ac-toggle">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            <span>읽기 전용 — 삭제·전송처럼 <strong>무언가 바꾸는 버튼은 누르지 않습니다</strong></span>
          </label>
          <label className="ac-num">
            최대 화면 수
            <input type="number" className="input" min={1} max={200} value={maxPages}
                   onChange={(e) => setMaxPages(Number(e.target.value))} />
          </label>
        </div>
        {!readOnly && (
          <p className="guide-note">
            <strong>테스트 계정에서만 끄세요</strong>
            읽기 전용을 끄면 쓰기 동작도 눌러 봅니다. 실제 데이터가 바뀔 수 있습니다.
          </p>
        )}
      </div>

      {/* ── 4. 시작 ── */}
      {!job && (
        <button type="button" className="btn btn-primary btn-lg" disabled={!canStart || busy !== null}
                onClick={() => call("start", async () => {
                  const r = await api.post("/api/autocrawl/start", {
                    projectId, url: url.trim(), intent: intent.trim(),
                    maxPages, maxDepth: 3, maxSeconds: 600, readOnly,
                  });
                  setJob({
                    jobId: r.jobId, phase: "시작", visited: 0, queued: 0, found: 0,
                    current: url.trim(), done: false, error: "", log: [],
                  });
                  setMade(null);
                })}>
          {busy === "start" ? "시작하는 중…" : "자동 탐색 시작"}
        </button>
      )}

      {/* ── 진행 ── */}
      {job && (
        <div className={`ac-run ${job.done ? "is-done" : ""}`}>
          <div className="ac-run-hd">
            {!job.done && <span className="tf-pulse" aria-hidden="true" />}
            <strong>{job.done ? "탐색 완료" : "탐색 중"}</strong>
            <span className="mono t3">{job.phase}</span>
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => { setJob(null); setPicked([]); setMade(null); }}>
              {job.done ? "다시 하기" : "화면에서 치우기"}
            </button>
          </div>

          <div className="ac-metrics">
            <div><b className="num">{job.visited}</b><span>방문 화면</span></div>
            <div><b className="num">{job.found}</b><span>찾은 API</span></div>
            <div><b className="num">{job.queued}</b><span>대기</span></div>
            {job.result && <div><b className="num">{job.result.seconds}초</b><span>소요</span></div>}
          </div>

          {!job.done && job.current && (
            <p className="ac-current mono">보는 중 · {job.current}</p>
          )}

          {/* 건너뛴 이유가 실시간으로 보인다. 자동 판단을 믿으려면
              무엇을 안 봤는지 알 수 있어야 한다. */}
          <div className="ac-log">
            {job.log.slice(-8).map((line, i) => (
              <div key={`${line}-${i}`} className="mono">{line}</div>
            ))}
            {!job.log.length && <div className="mono t4">시작하는 중…</div>}
          </div>

          {job.error && <ErrorBox message={job.error} />}
        </div>
      )}

      {/* ── 결과 ── */}
      {job?.done && job.result && !made && (
        <div className="ac-result">
          <div className="skl-lbl" style={{ marginTop: 0 }}>
            찾은 API {job.result.apis.length}개
          </div>

          {job.result.apis.length === 0 && (
            <p className="guide-note">
              <strong>API 를 찾지 못했습니다</strong>
              화면이 서버를 부르지 않거나, 로그인이 필요한 곳일 수 있습니다.
              로그인 세션을 만들고 다시 시도하거나, 확장으로 직접 관측해 보세요.
            </p>
          )}

          {job.result.apis.map((a) => {
            const on = picked.includes(a.url);
            return (
              <button key={a.url} type="button" className={`ac-api ${on ? "on" : ""}`}
                      onClick={() => setPicked((s) =>
                        s.includes(a.url) ? s.filter((x) => x !== a.url) : [...s, a.url])}>
                <span className="wiz-cb" aria-hidden="true">✓</span>
                <span className={`skl-meth ${a.method.toLowerCase()} mono`}>{a.method}</span>
                <span className="ac-api-nm">
                  <b>{a.path}</b>
                  <span className="mono">
                    {a.seen}회 관측
                    {a.required.length > 0 && ` · 필수 ${a.required.join(", ")}`}
                    {a.optional.length > 0 && ` · 선택 ${a.optional.slice(0, 3).join(", ")}`}
                  </span>
                  {a.why && <span className="ac-why">{a.why}</span>}
                </span>
              </button>
            );
          })}

          {/* 자동 판단은 반드시 틀린다. 버린 것을 볼 수 없으면
              사용자는 무엇을 놓쳤는지 영원히 모른다. */}
          {job.result.skipped.length > 0 && (
            <>
              <button type="button" className="btn btn-ghost btn-sm ac-skiptoggle"
                      onClick={() => setShowSkipped((v) => !v)}>
                건너뛴 {job.result.skipped.length}곳 {showSkipped ? "접기" : "보기"}
              </button>
              {showSkipped && (
                <div className="ac-skipped">
                  {job.result.skipped.map((s, i) => (
                    <div key={`${s.url}-${i}`} className="ac-skip mono">
                      <span className="why">{s.why}</span>
                      <span>{s.text || s.url}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {job.result.apis.length > 0 && (
            <div className="ac-foot">
              <span className="mono t3">{picked.length}개 선택됨</span>
              <button type="button" className="btn btn-primary" disabled={!picked.length || busy !== null}
                      onClick={() => call("adopt", async () => {
                        const r = await api.post("/api/autocrawl/adopt",
                                                 { jobId: job.jobId, urls: picked });
                        setMade({ created: r.created, sessionId: r.sessionId });
                      })}>
                {busy === "adopt" ? "만드는 중…" : `${picked.length}개로 MCP 만들기`}
              </button>
            </div>
          )}
        </div>
      )}

      {made && (
        <div className="tf-live">
          <div className="tf-live-head">
            <strong>MCP {made.created}개를 만들었습니다</strong>
          </div>
          <div className="cluster">
            <Link className="btn btn-sm" to={`/projects/${projectId}/actions`}>MCP 보기</Link>
            <Link className="btn btn-sm" to={`/sessions/${made.sessionId}`}>수집 기록 보기</Link>
            <span className="tf-hint">{projectName} 에 담겼습니다.</span>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

// URL 파싱 실패가 사이드패널 전체를 날리지 않게 한다.
// injected.ts가 메타데이터 추출에 실패하면 url이 ""로 남을 수 있고,
// content.ts는 typeof raw.url === "string" 검사만 하므로 ""도 통과한다.
// new URL("")은 예외를 던지고, 렌더 중 예외는 컴포넌트 트리를 통째로
// 없앤다 — 기록 중인 화면이 사라지면 안 된다.
function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

// 확장 프로그램이 마지막으로 사용한 프로젝트 이름을 기억해 두는 키.
// chrome.storage.local은 세션과 달리 브라우저를 껐다 켜도 남는다.
const LAST_PROJECT_NAME_KEY = "mcpStudioLastProjectName";

// 데모 전용. background.ts의 API_BASE와 같은 방식으로 상수에 둔다.
const ADMIN_BASE = "http://localhost:5173";

type SpecDetection = {
  supported: boolean;
  isSpecPage: boolean;
  portalLabel: string;
  serviceName: string;
  operationCount: number;
  paramCount: number;
};

type SpecResult = {
  sessionId: number;
  portalLabel: string;
  serviceName: string;
  added: number;
  collected: number;
  availableTotal: number;
};

// 라인 아이콘. 이모지는 OS마다 모양이 달라 촬영 화면에서 튄다.
// 관리자 화면(components/CollectionMark.tsx)과 같은 격자·같은 path 를 쓴다 —
// 도형이 갈리면 사용자는 두 화면을 다른 도구로 읽는다.
function MarkPortal({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ flexShrink: 0 }}
    >
      <path d="M2 7.6 L7.6 4 L13.2 7.6" strokeLinejoin="round" />
      <path d="M4 8.6v5.8M7.6 8.6v5.8M11.2 8.6v5.8M2.4 15.4h10.4" strokeLinecap="round" />
      <rect x="14.4" y="6.4" width="4.2" height="8" rx="1" />
      <path d="M14.4 9h4.2" />
    </svg>
  );
}

function MarkTraffic({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ flexShrink: 0 }}
    >
      <rect x="2" y="3.5" width="11" height="9" rx="1.6" />
      <path d="M2 6.4h11" />
      <path d="M6.4 9v6l1.9-1.9 1.3 2.6 1.4-.7-1.3-2.5 2.4-.3z" fill="currentColor" stroke="none" />
      <path d="M14.6 8.6c2 0 1.7 2.4 3.6 2.4" strokeDasharray="1.8 1.8" />
    </svg>
  );
}

export default function App() {
  const [recording, setRecording] = useState(false);
  const [counts, setCounts] = useState({ interactionCount: 0, networkCount: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finishedSessionId, setFinishedSessionId] = useState<number | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [detection, setDetection] = useState<SpecDetection | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [specResult, setSpecResult] = useState<SpecResult | null>(null);

  // 열릴 때마다 마지막으로 입력했던 프로젝트 이름을 복원한다 - 매번 다시
  // 타이핑하지 않도록 하기 위함이다.
  useEffect(() => {
    chrome.storage.local.get(LAST_PROJECT_NAME_KEY).then((stored) => {
      const saved = stored[LAST_PROJECT_NAME_KEY];
      if (typeof saved === "string" && saved) setProjectName(saved);
    });
  }, []);

  useEffect(() => {
    function apply(s: any) {
      if (!s) return;
      setRecording(s.recording);
      setCounts({ interactionCount: s.interactionCount, networkCount: s.networkCount });
      setRecent(s.recent ?? []);
      setError(s.lastError ?? null);
      setCanRetry(!!s.canRetry);
    }

    chrome.runtime.sendMessage({ type: "state" }, apply);

    const listener = (msg: any) => {
      if (msg.type === "state-changed") apply(msg);
    };
    chrome.runtime.onMessage.addListener(listener);

    // 서비스 워커가 재시작하면 broadcast가 오지 않아 패널이 낡은 상태로 남는다.
    // 주기적으로 다시 물어 실제 상태와 맞춘다.
    const timer = setInterval(() => {
      chrome.runtime.sendMessage({ type: "state" }, apply);
    }, 2000);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      clearInterval(timer);
    };
  }, []);

  // 지금 보고 있는 페이지가 명세 페이지인지 계속 확인한다. 사용자가 상세기능을
  // 바꾸거나 다른 탭으로 옮기면 판정이 달라지고, 그에 따라 주 버튼이 바뀐다.
  useEffect(() => {
    let alive = true;

    async function probe() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const result = await chrome.tabs.sendMessage(tab.id, { type: "detect-spec" });
        if (alive) setDetection(result ?? null);
      } catch {
        // 콘텐츠 스크립트가 없는 탭(chrome:// 등)이거나 확장 재로드 직후다.
        // 감지 실패는 일반 페이지와 같게 취급한다.
        if (alive) setDetection(null);
      }
    }

    probe();
    const timer = setInterval(probe, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const specMode = !!detection?.isSpecPage && !recording;

  function collectSpec() {
    const trimmed = projectName.trim();
    if (!trimmed) {
      setError("프로젝트 이름을 입력해 주세요");
      return;
    }
    setCollecting(true);
    setSpecResult(null);
    setError(null);
    chrome.storage.local.set({ [LAST_PROJECT_NAME_KEY]: trimmed });
    chrome.runtime.sendMessage({ type: "collect-spec", projectName: trimmed }, (r) => {
      setCollecting(false);
      if (r?.ok) {
        setSpecResult(r);
        setFinishedSessionId(null);
      } else {
        setError(r?.error ?? "수집에 실패했습니다");
      }
    });
  }

  function startRecording() {
    const trimmed = projectName.trim();
    if (!trimmed) {
      setError("프로젝트 이름을 입력해 주세요");
      return;
    }
    setFinishedSessionId(null);
    setSpecResult(null);
    setCanRetry(false);
    chrome.storage.local.set({ [LAST_PROJECT_NAME_KEY]: trimmed });
    chrome.runtime.sendMessage({ type: "start", projectName: trimmed }, (r) => {
      setRecording(!!r?.ok);
      setError(r?.error ?? null);
    });
  }

  return (
    <>
      {recording ? (
        <div className="rec-bar">
          <span className="dot dot-danger" />
          <strong>기록 중</strong>
          <span className="push mono" style={{ fontSize: 11.5, color: "var(--tx-2)" }}>
            {counts.networkCount} 요청
          </span>
        </div>
      ) : (
        <div className="panel-head">
          <div className="row">
            <span className="mark" aria-hidden="true">
              M
            </span>
            <strong>MCP Studio</strong>
          </div>
        </div>
      )}

      <div className="panel-body">
        <label className="label" htmlFor="project-name">
          프로젝트
        </label>
        <input
          id="project-name"
          className="input"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          disabled={recording}
          placeholder="프로젝트 이름을 입력하세요"
        />

        {recording ? (
          <div style={{ marginTop: 12 }}>
            {/* 되돌릴 수 없는 조작이라 시그널 색을 쓰는 유일한 버튼이다. */}
            <button
              type="button"
              className="btn btn-critical"
              onClick={() =>
                chrome.runtime.sendMessage({ type: "stop" }, (r) => {
                  setRecording(false);
                  setError(r?.error ?? null);
                  // 전송이 성공했을 때만 링크를 띄운다. 실패하면 관리자에 아무것도 없다.
                  setFinishedSessionId(r?.ok ? (r.sessionId ?? null) : null);
                })
              }
            >
              기록 종료 및 전송
            </button>
          </div>
        ) : (
          <>
            {/* 두 수집 방식을 카드로 나눈다. 페이지 판정에 따라 어느 쪽이
                주버튼을 갖는지만 달라진다 — order 로 뒤집지 않는다. */}
            <section className={specMode ? "card card-portal method" : "card method is-idle"}>
              <div className="row">
                <span style={{ color: specMode ? "var(--kind-portal)" : "var(--tx-3)" }}>
                  <MarkPortal />
                </span>
                <h2>공개 명세 페이지</h2>
                {specMode && <span className="badge push">권장</span>}
              </div>
              {specMode ? (
                <p className="mono" style={{ marginTop: 6, fontSize: 11.5, color: "var(--tx-3)" }}>
                  {detection?.portalLabel} · op {detection?.operationCount} · param {detection?.paramCount}
                </p>
              ) : (
                <p className="help" style={{ marginTop: 6 }}>
                  이 페이지에서 공개 명세 표가 감지되지 않았습니다
                </p>
              )}
              <button
                type="button"
                className={specMode ? "btn btn-primary" : "btn"}
                onClick={collectSpec}
                disabled={!specMode || collecting}
              >
                {collecting ? "수집 중…" : "공개 명세 수집"}
              </button>
            </section>

            <section className={specMode ? "card method is-idle" : "card method"}>
              <div className="row">
                <span style={{ color: specMode ? "var(--tx-3)" : "var(--kind-traffic)" }}>
                  <MarkTraffic />
                </span>
                <h2>트래픽 기록</h2>
              </div>
              <p className="help" style={{ marginTop: 6 }}>
                화면을 조작하는 동안 오가는 API 호출을 기록합니다
              </p>
              <button
                type="button"
                className={specMode ? "btn" : "btn btn-primary"}
                onClick={startRecording}
              >
                기록 시작
              </button>
            </section>
          </>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {/* 전송이 실패해도 기록은 남아 있다. 다시 보낼 길이 없으면 그대로 사라진다. */}
        {canRetry && !recording && (
          <button
            type="button"
            className="btn"
            style={{ marginTop: 8 }}
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              chrome.runtime.sendMessage({ type: "retry" }, (r) => {
                setRetrying(false);
                setError(r?.error ?? null);
                setFinishedSessionId(r?.ok ? (r.sessionId ?? null) : null);
              });
            }}
          >
            {retrying ? "재전송 중…" : "전송 재시도"}
          </button>
        )}

        {/* 포털 상세페이지는 상세기능을 목록으로 전환하는 구조라, 한 번에 하나만 실린다.
            몇 개 중 몇 개를 수집했는지 밝혀야 사용자가 나머지를 가져올 수 있다. */}
        {specResult && (
          <div className="result">
            <strong>
              {specResult.added > 0
                ? `오퍼레이션 ${specResult.added}개 수집`
                : "이미 수집된 오퍼레이션입니다"}
            </strong>
            <p className="help">
              {specResult.serviceName}
              <br />
              전체 <span className="mono">{specResult.availableTotal}</span>개 중{" "}
              <strong className="mono">{specResult.collected}</strong>개 수집됨
            </p>
            {specResult.collected < specResult.availableTotal && (
              <p className="help" style={{ marginTop: 5 }}>
                페이지의 상세기능 목록에서 다른 항목을 고른 뒤 다시 누르면 이어서 수집됩니다
              </p>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => chrome.tabs.create({ url: `${ADMIN_BASE}/sessions/${specResult.sessionId}` })}
            >
              관리자에서 열기
            </button>
          </div>
        )}

        {finishedSessionId !== null && (
          <div className="card" style={{ marginTop: 10 }}>
            <strong style={{ fontSize: 12 }}>세션 #{finishedSessionId} 전송 완료</strong>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 10 }}
              onClick={() => chrome.tabs.create({ url: `${ADMIN_BASE}/sessions/${finishedSessionId}` })}
            >
              관리자에서 열기
            </button>
          </div>
        )}

        <div className="hair" />

        <div className="stats">
          <div>
            <b>{counts.interactionCount}</b>
            <small>클릭</small>
          </div>
          <div>
            <b>{counts.networkCount}</b>
            <small>API 요청</small>
          </div>
        </div>

        {recent.length === 0 ? (
          <p className="help" style={{ marginTop: 10 }}>
            기록을 시작하면 여기에 요청이 쌓입니다
          </p>
        ) : (
          <div className="recent" style={{ marginTop: 10 }}>
            {recent.map((r, i) => (
              <div key={i}>
                <span className="method-name">{r.method}</span>
                <span className={r.status < 300 ? "ok" : "bad"}>{r.status}</span>
                <span className="path">{safePath(r.url)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

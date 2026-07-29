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

// 수집 방식별 색. 관리자 화면(app.css)의 방식 배지와 같은 계열을 쓴다.
const PORTAL_COLOR = "#0d9488";
const TRAFFIC_COLOR = "#3157e8";

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
function MarkPortal({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={color}
         strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <path d="M2 7.6 L7.6 4 L13.2 7.6" strokeLinejoin="round" />
      <path d="M4 8.6v5.8M7.6 8.6v5.8M11.2 8.6v5.8M2.4 15.4h10.4" strokeLinecap="round" />
      <rect x="14.4" y="6.4" width="4.2" height="8" rx="1" />
      <path d="M14.4 9h4.2" />
    </svg>
  );
}

function MarkTraffic({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={color}
         strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <rect x="2" y="3.5" width="11" height="9" rx="1.6" />
      <path d="M2 6.4h11" />
      <path d="M6.4 9v6l1.9-1.9 1.3 2.6 1.4-.7-1.3-2.5 2.4-.3z" fill={color} stroke="none" />
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

  return (
    <div
      style={{
        padding: 16,
        fontFamily: '-apple-system, "Apple SD Gothic Neo", system-ui, sans-serif',
        fontSize: 13,
        color: "#172033",
      }}
    >
      <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>MCP Studio</h2>

      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        disabled={recording}
        placeholder="프로젝트 이름을 입력하세요"
        style={{ width: "100%", padding: 6, marginBottom: 12, boxSizing: "border-box" }}
      />

      {/* 현재 페이지 판정. 어느 수집 방식이 맞는지 사용자가 고르지 않아도 되게 한다. */}
      {!recording && (
        <div
          style={{
            display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10,
            padding: "9px 11px", borderRadius: 8, fontSize: 11.5,
            background: specMode ? "#ecfdf5" : "#f1f5f9",
            border: `1px solid ${specMode ? "#a7f3d0" : "#e2e8f0"}`,
            color: specMode ? "#0f766e" : "#64748b",
          }}
        >
          {specMode ? <MarkPortal color={PORTAL_COLOR} /> : <MarkTraffic color="#94a3b8" />}
          <div>
            {specMode ? (
              <>
                <strong>공개 명세 페이지 감지</strong>
                <div style={{ marginTop: 2 }}>
                  {detection?.portalLabel} · 상세기능 {detection?.operationCount} · 요청변수 {detection?.paramCount}
                </div>
              </>
            ) : (
              <>
                <strong>일반 페이지</strong>
                <div style={{ marginTop: 2 }}>공개 명세 표가 감지되지 않았습니다</div>
              </>
            )}
          </div>
        </div>
      )}

      {!recording ? (
        <>
          {/* 두 버튼을 항상 함께 둔다. 페이지 판정에 따라 주/보조만 뒤바꾼다. */}
          <button
            onClick={specMode ? collectSpec : undefined}
            disabled={!specMode || collecting}
            style={{
              width: "100%", padding: 10, borderRadius: 6, marginBottom: 7,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              border: specMode ? 0 : "1px solid #cbd5e1",
              background: specMode ? PORTAL_COLOR : "#fff",
              color: specMode ? "#fff" : "#94a3b8",
              cursor: specMode ? "pointer" : "default",
              order: specMode ? 0 : 1,
            }}
          >
            <MarkPortal color={specMode ? "#fff" : "#94a3b8"} />
            {collecting ? "수집 중…" : specMode ? "공개 명세 수집" : "공개 명세 수집 (감지 안 됨)"}
          </button>

          <button
            onClick={() => {
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
            }}
            style={{
              width: "100%", padding: 10, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              border: specMode ? "1px solid #cbd5e1" : 0,
              background: specMode ? "#fff" : TRAFFIC_COLOR,
              color: specMode ? "#475569" : "#fff",
            }}
          >
            <MarkTraffic color={specMode ? "#475569" : "#fff"} />
            트래픽 기록 시작
          </button>

          <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
            {specMode
              ? "이 페이지의 명세를 읽어 액션을 만듭니다"
              : "화면을 조작하면 API 호출을 기록합니다"}
          </div>
        </>
      ) : (
        <button
          onClick={() =>
            chrome.runtime.sendMessage({ type: "stop" }, (r) => {
              setRecording(false);
              setError(r?.error ?? null);
              // 전송이 성공했을 때만 링크를 띄운다. 실패하면 관리자에 아무것도 없다.
              setFinishedSessionId(r?.ok ? (r.sessionId ?? null) : null);
            })
          }
          style={{ width: "100%", padding: 10, background: "#dc2626", color: "#fff", border: 0, borderRadius: 6 }}
        >
          기록 종료 및 전송
        </button>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 8, background: "#fef2f2", color: "#b91c1c", borderRadius: 4, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* 전송이 실패해도 기록은 남아 있다. 다시 보낼 길이 없으면 그대로 사라진다. */}
      {canRetry && !recording && (
        <button
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            chrome.runtime.sendMessage({ type: "retry" }, (r) => {
              setRetrying(false);
              setError(r?.error ?? null);
              setFinishedSessionId(r?.ok ? (r.sessionId ?? null) : null);
            });
          }}
          style={{ width: "100%", marginTop: 8, padding: 9, background: "#fff", color: "#3157e8",
                   border: "1px solid #3157e8", borderRadius: 6 }}
        >
          {retrying ? "재전송 중…" : "전송 재시도"}
        </button>
      )}

      {/* 포털 상세페이지는 상세기능을 목록으로 전환하는 구조라, 한 번에 하나만 실린다.
          몇 개 중 몇 개를 수집했는지 밝혀야 사용자가 나머지를 가져올 수 있다. */}
      {specResult && (
        <div style={{ marginTop: 10, padding: 10, background: "#ecfdf5", border: "1px solid #a7f3d0",
                      borderRadius: 6, fontSize: 12, color: "#0f766e" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {specResult.added > 0 ? `오퍼레이션 ${specResult.added}개 수집` : "이미 수집된 오퍼레이션입니다"}
          </div>
          <div style={{ marginBottom: 8 }}>
            {specResult.serviceName}
            <br />
            전체 {specResult.availableTotal}개 중 <strong>{specResult.collected}개</strong> 수집됨
            {specResult.collected < specResult.availableTotal && (
              <div style={{ marginTop: 3, color: "#475569" }}>
                페이지의 상세기능 목록에서 다른 항목을 고른 뒤 다시 누르면 이어서 수집됩니다
              </div>
            )}
          </div>
          <button
            // 포털 세션은 /spec-sessions/:id 다. /sessions/:id 로 열면 트래픽 화면이
            // 나와 "클릭과 연결된 요청이 없습니다"만 보인다 — 오퍼레이션이 멀쩡히
            // 있는데도 수집이 실패한 것처럼 읽힌다.
            onClick={() => chrome.tabs.create({ url: `${ADMIN_BASE}/spec-sessions/${specResult.sessionId}` })}
            style={{ width: "100%", padding: 8, background: PORTAL_COLOR, color: "#fff", border: 0, borderRadius: 6 }}
          >
            관리자에서 열기
          </button>
        </div>
      )}

      {finishedSessionId !== null && (
        <div style={{ marginTop: 10, padding: 10, background: "#eef2ff", borderRadius: 6, fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>세션 #{finishedSessionId} 전송 완료</div>
          <button
            onClick={() =>
              chrome.tabs.create({ url: `${ADMIN_BASE}/sessions/${finishedSessionId}` })
            }
            style={{ width: "100%", padding: 8, background: "#3157e8", color: "#fff", border: 0, borderRadius: 6 }}
          >
            관리자에서 열기
          </button>
        </div>
      )}

      <div style={{ margin: "16px 0", display: "flex", gap: 16 }}>
        <div><strong style={{ fontSize: 22 }}>{counts.interactionCount}</strong><div>클릭</div></div>
        <div><strong style={{ fontSize: 22 }}>{counts.networkCount}</strong><div>API 요청</div></div>
      </div>

      <div>
        {recent.map((r, i) => (
          <div key={i} style={{ padding: "6px 0", borderTop: "1px solid #e2e7ef", fontFamily: "monospace", fontSize: 11 }}>
            <span style={{ color: "#2563eb" }}>{r.method}</span>{" "}
            <span style={{ color: r.status < 300 ? "#16a34a" : "#dc2626" }}>{r.status}</span>{" "}
            {safePath(r.url)}
          </div>
        ))}
      </div>
    </div>
  );
}

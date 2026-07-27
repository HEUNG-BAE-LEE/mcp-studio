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

export default function App() {
  const [recording, setRecording] = useState(false);
  const [counts, setCounts] = useState({ interactionCount: 0, networkCount: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finishedSessionId, setFinishedSessionId] = useState<number | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);

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

      {!recording ? (
        <button
          onClick={() => {
            const trimmed = projectName.trim();
            if (!trimmed) {
              setError("프로젝트 이름을 입력해 주세요");
              return;
            }
            setFinishedSessionId(null);
            setCanRetry(false);
            chrome.storage.local.set({ [LAST_PROJECT_NAME_KEY]: trimmed });
            chrome.runtime.sendMessage({ type: "start", projectName: trimmed }, (r) => {
              setRecording(!!r?.ok);
              setError(r?.error ?? null);
            });
          }}
          style={{ width: "100%", padding: 10, background: "#3157e8", color: "#fff", border: 0, borderRadius: 6 }}
        >
          기록 시작
        </button>
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

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

const PROJECTS = [
  { id: 1, name: "국토교통부 실거래가" },
  { id: 2, name: "국가통계포털 KOSIS" },
];

export default function App() {
  const [recording, setRecording] = useState(false);
  const [counts, setCounts] = useState({ interactionCount: 0, networkCount: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function apply(s: any) {
      if (!s) return;
      setRecording(s.recording);
      setCounts({ interactionCount: s.interactionCount, networkCount: s.networkCount });
      setRecent(s.recent ?? []);
      setError(s.lastError ?? null);
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
    <div style={{ padding: 16, fontFamily: "system-ui", fontSize: 13 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>MCP Studio</h2>

      <select
        value={projectId}
        onChange={(e) => setProjectId(Number(e.target.value))}
        disabled={recording}
        style={{ width: "100%", padding: 6, marginBottom: 12 }}
      >
        {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {!recording ? (
        <button
          onClick={() =>
            chrome.runtime.sendMessage({ type: "start", projectId }, (r) => {
              setRecording(!!r?.ok);
              setError(r?.error ?? null);
            })
          }
          style={{ width: "100%", padding: 10, background: "#2563eb", color: "#fff", border: 0, borderRadius: 6 }}
        >
          기록 시작
        </button>
      ) : (
        <button
          onClick={() =>
            chrome.runtime.sendMessage({ type: "stop" }, (r) => {
              setRecording(false);
              setError(r?.error ?? null);
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

      <div style={{ margin: "16px 0", display: "flex", gap: 16 }}>
        <div><strong style={{ fontSize: 22 }}>{counts.interactionCount}</strong><div>클릭</div></div>
        <div><strong style={{ fontSize: 22 }}>{counts.networkCount}</strong><div>API 요청</div></div>
      </div>

      <div>
        {recent.map((r, i) => (
          <div key={i} style={{ padding: "6px 0", borderTop: "1px solid #eee", fontFamily: "monospace", fontSize: 11 }}>
            <span style={{ color: "#2563eb" }}>{r.method}</span>{" "}
            <span style={{ color: r.status < 300 ? "#16a34a" : "#dc2626" }}>{r.status}</span>{" "}
            {safePath(r.url)}
          </div>
        ))}
      </div>
    </div>
  );
}

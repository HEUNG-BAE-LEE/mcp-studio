const API_BASE = "http://localhost:8000";

type Buffered = { interactions: any[]; networks: any[] };
const buffer: Buffered = { interactions: [], networks: [] };
let recording = false;
let sessionId: number | null = null;
let lastError: string | null = null;

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "interaction" && recording) {
      buffer.interactions.push(msg.payload);
      broadcast();
    } else if (msg.type === "network" && recording) {
      if (isCollectible(msg.payload.url)) {
        buffer.networks.push(msg.payload);
        broadcast();
      }
    } else if (msg.type === "start") {
      startSession(msg.projectId).then(sendResponse);
      return true;
    } else if (msg.type === "stop") {
      stopSession().then(sendResponse);
      return true;
    } else if (msg.type === "state") {
      sendResponse({ recording, sessionId, lastError, ...counts() });
    }
  });
});

function counts() {
  return { interactionCount: buffer.interactions.length, networkCount: buffer.networks.length };
}

function broadcast() {
  chrome.runtime
    .sendMessage({
      type: "state-changed",
      recording,
      lastError,
      ...counts(),
      recent: buffer.networks.slice(-10),
    })
    .catch(() => {});  // Side Panel이 닫혀 있으면 무시
}

// PRD §7.4 수집 제외 대상
const STATIC_EXT = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|ico|map)(\?|$)/i;
const NOISE_HOST = /(google-analytics|googletagmanager|doubleclick|sentry\.io|youtube\.com)/i;

function isCollectible(url: string): boolean {
  if (STATIC_EXT.test(url)) return false;
  if (NOISE_HOST.test(url)) return false;
  if (url.startsWith("chrome-extension://")) return false;
  return true;
}

// 서버가 꺼져 있으면 fetch가 던진다. 잡지 않으면 sendResponse가 호출되지
// 않아 Side Panel의 콜백이 영영 오지 않고 버튼이 멈춘 상태로 남는다.
// PRD §8.3이 "서버 연결 실패" 상태 표시를 요구하는 것도 이 때문이다.
async function startSession(projectId: number) {
  try {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/recording-sessions`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    sessionId = data.id;
    buffer.interactions = [];
    buffer.networks = [];
    recording = true;
    lastError = null;
    broadcast();
    return { ok: true, sessionId };
  } catch (e) {
    recording = false;
    lastError = `서버 연결 실패: ${e instanceof Error ? e.message : String(e)}`;
    broadcast();
    return { ok: false, error: lastError };
  }
}

async function stopSession() {
  recording = false;
  if (sessionId === null) {
    broadcast();
    return { ok: false, error: "진행 중인 세션이 없습니다" };
  }
  try {
    const res = await fetch(`${API_BASE}/api/recording-sessions/${sessionId}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buffer),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastError = null;
    broadcast();
    return { ok: true, sessionId, ...data };
  } catch (e) {
    lastError = `전송 실패: ${e instanceof Error ? e.message : String(e)}`;
    broadcast();
    return { ok: false, error: lastError };
  }
}

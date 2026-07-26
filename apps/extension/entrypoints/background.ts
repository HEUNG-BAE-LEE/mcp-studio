const API_BASE = "http://localhost:8000";

// MV3 서비스 워커는 30초쯤 유휴하면 종료된다. 모듈 레벨 변수에 기록 상태를
// 두면 워커가 죽는 순간 수집한 데이터가 통째로 사라지고, 깨어난 워커는
// recording=false 로 시작해 이후 이벤트를 조용히 버린다. 2분짜리 시연 중에
// 충분히 일어나는 일이다. 상태는 전부 chrome.storage.session에 둔다.
// PRD §10의 "Chrome Storage Session"이 이것이다.
const STATE_KEY = "mcpStudioState";

// PRD §14 권장 초기 제한
const MAX_INTERACTIONS = 1000;
const MAX_NETWORKS = 5000;

// chrome.storage.session의 할당량은 10MB다. Task 1이 본문을 100KB까지
// 담아 보내므로 항목 50개만 쌓여도 할당량이 찬다. 초과하면 set()이 reject하고,
// 그 뒤로는 어떤 이벤트도 저장되지 않는다 — 기록은 계속되는 것처럼 보이는데
// 데이터만 안 쌓이는, 방금 고친 것과 똑같은 증상이 다른 경로로 재현된다.
// 항목당 상한과 전체 상한을 함께 건다.
const RESPONSE_STORE_LIMIT = 32_000;   // 실제 업무 API JSON은 이 안에 들어온다
const MAX_TOTAL_BYTES = 4_000_000;     // 10MB 할당량에 대한 안전 여유

type SessionState = {
  recording: boolean;
  sessionId: number | null;
  lastError: string | null;
  interactions: any[];
  networks: any[];
  approxBytes: number;
};

const EMPTY: SessionState = {
  recording: false,
  sessionId: null,
  lastError: null,
  interactions: [],
  networks: [],
  approxBytes: 0,
};

async function loadState(): Promise<SessionState> {
  const stored = await chrome.storage.session.get(STATE_KEY);
  return (stored[STATE_KEY] as SessionState) ?? EMPTY;
}

// 저장 실패를 삼키지 않는다. 실패하면 기록을 멈추고 사용자에게 보인다.
// 조용히 넘어가면 "기록 중인데 아무것도 안 쌓이는" 상태가 된다.
async function saveState(state: SessionState): Promise<boolean> {
  try {
    await chrome.storage.session.set({ [STATE_KEY]: state });
    return true;
  } catch (e) {
    const failed: SessionState = {
      ...state,
      recording: false,
      lastError: `저장 실패로 기록을 중단했습니다: ${e instanceof Error ? e.message : String(e)}`,
    };
    try {
      // 데이터는 버리고 상태만이라도 남긴다
      await chrome.storage.session.set({
        [STATE_KEY]: { ...failed, interactions: [], networks: [], approxBytes: 0 },
      });
    } catch {
      // 여기까지 실패하면 더 할 수 있는 게 없다
    }
    broadcast(failed);
    return false;
  }
}

// 상태 변경은 반드시 직렬화한다. 클릭 한 번에 요청이 여러 건 쏟아지는데,
// 각 핸들러가 동시에 읽고-고치고-쓰면 나중 쓰기가 앞선 쓰기를 덮어써
// 이벤트가 조용히 사라진다.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "interaction") {
      enqueue(async () => {
        const state = await loadState();
        if (!state.recording) return;
        if (state.interactions.length >= MAX_INTERACTIONS) return;
        state.interactions.push(msg.payload);
        state.approxBytes += 300;
        if (await saveState(state)) broadcast(state);
      });
      return false;
    }

    if (msg.type === "network") {
      enqueue(async () => {
        const state = await loadState();
        if (!state.recording) return;
        if (!isCollectible(msg.payload.url)) return;
        if (state.networks.length >= MAX_NETWORKS) return;

        // 항목당 본문을 줄여 담는다. 백엔드는 스키마 추론과 샘플 1건만
        // 필요하므로 이 크기면 충분하다.
        const entry = {
          ...msg.payload,
          requestBody:
            typeof msg.payload.requestBody === "string"
              ? msg.payload.requestBody.slice(0, RESPONSE_STORE_LIMIT)
              : msg.payload.requestBody,
          responseText:
            typeof msg.payload.responseText === "string"
              ? msg.payload.responseText.slice(0, RESPONSE_STORE_LIMIT)
              : "",
        };
        const size = (entry.responseText?.length ?? 0) + (entry.requestBody?.length ?? 0) + entry.url.length + 200;

        if (state.approxBytes + size > MAX_TOTAL_BYTES) {
          state.recording = false;
          state.lastError = "수집 용량 상한에 도달해 기록을 중단했습니다. 종료 후 전송하세요.";
          await saveState(state);
          broadcast(state);
          return;
        }

        state.networks.push(entry);
        state.approxBytes += size;
        if (await saveState(state)) broadcast(state);
      });
      return false;
    }

    // 실패해도 sendResponse는 반드시 부른다. 부르지 않으면 패널 콜백이
    // 영영 오지 않고 버튼이 멈춘다.
    if (msg.type === "start") {
      enqueue(() => startSession(msg.projectId))
        .catch((e) => ({ ok: false, error: `시작 실패: ${e instanceof Error ? e.message : String(e)}` }))
        .then(sendResponse);
      return true;
    }

    if (msg.type === "stop") {
      enqueue(() => stopSession())
        .catch((e) => ({ ok: false, error: `종료 실패: ${e instanceof Error ? e.message : String(e)}` }))
        .then(sendResponse);
      return true;
    }

    if (msg.type === "state") {
      loadState()
        .then((state) => snapshot(state))
        .catch(() => snapshot(EMPTY))
        .then(sendResponse);
      return true;
    }

    return false;
  });
});

function snapshot(state: SessionState) {
  return {
    recording: state.recording,
    sessionId: state.sessionId,
    lastError: state.lastError,
    interactionCount: state.interactions.length,
    networkCount: state.networks.length,
    recent: state.networks.slice(-10),
  };
}

function broadcast(state: SessionState) {
  chrome.runtime
    .sendMessage({ type: "state-changed", ...snapshot(state) })
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
  const state = await loadState();
  try {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/recording-sessions`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const next: SessionState = {
      recording: true,
      sessionId: data.id,
      lastError: null,
      interactions: [],
      networks: [],
      approxBytes: 0,
    };
    await saveState(next);
    broadcast(next);
    return { ok: true, sessionId: next.sessionId };
  } catch (e) {
    const next: SessionState = {
      ...state,
      recording: false,
      lastError: `서버 연결 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
    await saveState(next);
    broadcast(next);
    return { ok: false, error: next.lastError };
  }
}

async function stopSession() {
  const state = await loadState();
  state.recording = false;

  if (state.sessionId === null) {
    state.lastError = "진행 중인 세션이 없습니다";
    await saveState(state);
    broadcast(state);
    return { ok: false, error: state.lastError };
  }

  try {
    const res = await fetch(`${API_BASE}/api/recording-sessions/${state.sessionId}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactions: state.interactions, networks: state.networks }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.lastError = null;
    await saveState(state);
    broadcast(state);
    return { ok: true, sessionId: state.sessionId, ...data };
  } catch (e) {
    state.lastError = `전송 실패: ${e instanceof Error ? e.message : String(e)}`;
    await saveState(state);
    broadcast(state);
    return { ok: false, error: state.lastError };
  }
}

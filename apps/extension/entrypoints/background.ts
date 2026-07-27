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

// .length는 UTF-16 코드 유닛 수라 한글(UTF-8 3바이트)이 섞이면 실제 바이트보다
// 훨씬 작게 잡힌다. 이 프로젝트의 데이터는 대부분 한글 API 응답이라 그 경우가
// 예외가 아니라 기본값이다. TextEncoder로 실제 UTF-8 바이트 수를 잰다.
const encoder = new TextEncoder();
function byteSize(value: unknown): number {
  return encoder.encode(JSON.stringify(value) ?? "").length;
}

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
        state.approxBytes += byteSize(msg.payload);
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
        const size = byteSize(entry);

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
      enqueue(() => startSession(msg.projectName))
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

    if (msg.type === "retry") {
      enqueue(() => retryUpload())
        .catch((e) => ({ ok: false, error: `재전송 실패: ${e instanceof Error ? e.message : String(e)}` }))
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
    // 전송이 실패하면 기록은 storage.session 에 그대로 남는다. 그 상태에서만
    // 재시도를 제안한다 — 성공하면 lastError 가 null 이 되어 사라진다.
    canRetry:
      !state.recording &&
      state.sessionId !== null &&
      state.lastError !== null &&
      state.interactions.length + state.networks.length > 0,
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
/**
 * 서버가 보낸 실패 이유를 버리지 않는다.
 *
 * 상태 코드만 던지면 패널에 "HTTP 422"만 뜬다. 실제로 서버는 어느 필드가 왜
 * 틀렸는지(예: networks.0.requestHeaders.X-Ts: Input should be a valid string)를
 * 본문에 실어 보내는데, 그걸 버리면 확장을 다시 빌드해야만 원인을 알 수 있다.
 * 요청 210건짜리 기록이 이 메시지 하나 없이 통째로 날아간 적이 있다.
 */
async function describeFailure(res: Response): Promise<string> {
  let detail = "";
  try {
    const parsed = JSON.parse(await res.text());
    const d = parsed?.detail;
    if (typeof d === "string") {
      detail = d;
    } else if (Array.isArray(d) && d.length > 0) {
      // FastAPI 검증 오류는 배열이다. 첫 건의 위치와 사유만 요약한다.
      const first = d[0];
      const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "";
      detail = [loc, first?.msg].filter(Boolean).join(": ");
      if (d.length > 1) detail += ` (외 ${d.length - 1}건)`;
    }
  } catch {
    // JSON이 아니면 상태 코드만 쓴다
  }
  return detail ? `HTTP ${res.status} — ${detail}` : `HTTP ${res.status}`;
}

async function startSession(projectName: string) {
  const state = await loadState();
  const trimmed = typeof projectName === "string" ? projectName.trim() : "";
  if (!trimmed) {
    const next: SessionState = {
      ...state,
      recording: false,
      lastError: "프로젝트 이름을 입력해 주세요",
    };
    await saveState(next);
    broadcast(next);
    return { ok: false, error: next.lastError };
  }

  try {
    // 이름 -> id 해석은 백그라운드가 담당한다 (사이드패널은 네트워크 호출을
    // 하지 않는다). 동일한 이름으로 반복 호출해도 안전한 get-or-create
    // 엔드포인트라, 기록 시작마다 호출해도 프로젝트가 중복 생성되지 않는다.
    const projectRes = await fetch(`${API_BASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!projectRes.ok) throw new Error(await describeFailure(projectRes));
    const project = await projectRes.json();

    const res = await fetch(`${API_BASE}/api/projects/${project.id}/recording-sessions`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(await describeFailure(res));
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

  return uploadPending(state);
}

/**
 * 전송이 실패해도 기록은 storage.session 에 그대로 남는다. 예전에는 다시 보낼
 * 길이 없어 클릭 13건·요청 210건이 그대로 사라졌다. 저장된 것을 그대로 다시
 * 올린다 — 새로 수집하지 않는다.
 */
async function retryUpload() {
  const state = await loadState();

  if (state.recording) {
    return { ok: false, error: "기록 중에는 재전송할 수 없습니다" };
  }
  if (state.sessionId === null) {
    return { ok: false, error: "재전송할 세션이 없습니다" };
  }
  if (state.interactions.length + state.networks.length === 0) {
    return { ok: false, error: "재전송할 기록이 없습니다" };
  }

  // 서버가 이미 처리했는데 응답만 유실된 경우가 있다. 그대로 다시 올리면 같은
  // 요청이 두 벌 저장된다(실측: 1건 -> 2건). 세션 상태로 구분한다 - 전송이
  // 성공하면 서버가 COMPLETED 로 바꾼다.
  try {
    const check = await fetch(`${API_BASE}/api/recording-sessions/${state.sessionId}`);
    if (check.ok) {
      const info = await check.json();
      if (info.status === "COMPLETED") {
        // 서버가 이미 갖고 있으니 재전송 대비로 들고 있을 이유가 없다.
        // uploadPending 의 성공 경로와 같은 정리를 한다.
        const next: SessionState = {
          ...state,
          lastError: null,
          interactions: [],
          networks: [],
          approxBytes: 0,
        };
        await saveState(next);
        broadcast(next);
        return { ok: true, sessionId: next.sessionId, alreadyUploaded: true };
      }
    }
  } catch {
    // 확인 자체가 실패하면 그대로 재전송을 시도한다. 서버가 꺼져 있다면
    // 아래에서 같은 오류가 다시 날 뿐이다.
  }

  return uploadPending(state);
}

/**
 * 모아둔 기록을 서버로 올린다. 최초 전송과 재전송이 같은 경로를 쓴다.
 *
 * 전송에 성공하면 수집 데이터를 비운다. 남겨두는 이유는 재전송뿐인데, 서버가
 * 이미 받았으면 다시 보낼 일이 없다. 비우지 않으면 다음 기록을 시작할 때까지
 * 이전 세션의 클릭·요청 수가 초기 화면에 그대로 떠 새 기록의 것처럼 보인다.
 * 실패 경로에서는 그대로 남으므로 "전송 재시도"는 영향받지 않는다.
 */
async function uploadPending(state: SessionState) {
  try {
    const res = await fetch(`${API_BASE}/api/recording-sessions/${state.sessionId}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactions: state.interactions, networks: state.networks }),
    });
    if (!res.ok) throw new Error(await describeFailure(res));
    const data = await res.json();
    const next: SessionState = {
      ...state,
      lastError: null,
      interactions: [],
      networks: [],
      approxBytes: 0,
    };
    await saveState(next);
    broadcast(next);
    return { ok: true, sessionId: next.sessionId, ...data };
  } catch (e) {
    state.lastError = `전송 실패: ${e instanceof Error ? e.message : String(e)}`;
    await saveState(state);
    broadcast(state);
    return { ok: false, error: state.lastError };
  }
}

/**
 * 관리자 화면 ↔ 확장 다리.
 *
 * 관리자 화면(수집 스튜디오)은 웹페이지라서 확장이 깔렸는지 알 방법이 없다.
 * "확장을 여세요"라고 글로만 적어두면 화면은 아무것도 모르는 채로 안내만
 * 하고, 사용자는 여기서 시작하는 줄 알고 들어왔다가 빈손으로 나간다.
 *
 * 그래서 content script 가 우리 화면에서만 두 가지를 한다.
 *   1) <html> 에 표식을 남긴다  → 화면이 "설치됨"을 안다
 *   2) postMessage 를 받아 사이드패널을 연다 → 화면에 버튼을 둘 수 있다
 *
 * 우리 화면에서만 도는 이유는 명백하다. 아무 사이트에나 표식을 남기면
 * 그 사이트가 사용자의 확장 설치 여부를 알게 된다(지문). 대상 사이트에서는
 * 이 다리를 아예 만들지 않는다.
 */

const MARK = "data-mcp-studio-ext";

/** 관리자 화면으로 인정하는 곳. 대상 사이트에는 표식을 남기지 않는다. */
function isAdminOrigin(): boolean {
  const { hostname, port } = location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // 5173 = vite 개발 서버, 8000 = 백엔드가 화면까지 서빙하는 컨테이너 모드
    return port === "5173" || port === "8000";
  }
  return hostname.endsWith(".azurecontainerapps.io");
}

export type BridgeMessage =
  | { source: "mcp-studio-web"; type: "open-panel" }
  | { source: "mcp-studio-web"; type: "get-state" }
  | { source: "mcp-studio-web"; type: "ping" };

export function installWebBridge(version: string): void {
  if (!isAdminOrigin()) return;

  // document_start 에 돌면 <html> 은 이미 있다. 화면은 이 속성을 읽어
  // 설치 여부와 버전을 안다.
  document.documentElement.setAttribute(MARK, version);

  window.addEventListener("message", (event) => {
    // 같은 창에서 온 것만 받는다. iframe 이나 다른 창의 메시지는 무시한다.
    if (event.source !== window) return;
    const data = event.data as BridgeMessage | undefined;
    if (data?.source !== "mcp-studio-web") return;

    if (data.type === "ping") {
      window.postMessage({ source: "mcp-studio-ext", type: "pong", version }, location.origin);
      return;
    }

    // 기록 중 건수는 서버에 없다. 확장이 종료 시점에 한 번에 올리기
    // 때문이다(중간 전송을 하지 않는 것은 의도된 설계다 — 사용자가 그만두면
    // 아무것도 남기지 않는다). 그래서 진행 중 숫자는 확장에게 직접 묻는다.
    if (data.type === "get-state") {
      try {
        chrome.runtime.sendMessage({ type: "state" }, (res) => {
          const ok = !chrome.runtime.lastError;
          window.postMessage(
            { source: "mcp-studio-ext", type: "state", ok, state: ok ? res : null },
            location.origin,
          );
        });
      } catch {
        window.postMessage(
          { source: "mcp-studio-ext", type: "state", ok: false, state: null },
          location.origin,
        );
      }
      return;
    }

    if (data.type === "open-panel") {
      // 사이드패널은 확장 컨텍스트에서만 열 수 있다. 여기서 바로 열지 못하고
      // background 에 넘긴다. 사용자 클릭 직후에만 허용되므로, 화면 쪽에서도
      // 반드시 클릭 핸들러 안에서 이 메시지를 보내야 한다.
      try {
        chrome.runtime.sendMessage({ type: "open-panel" }, (res) => {
          // 실패해도 화면이 멈추면 안 된다. 결과를 돌려주면 화면이
          // "직접 아이콘을 눌러 주세요"로 안내를 바꾼다.
          const ok = !chrome.runtime.lastError && res?.ok === true;
          window.postMessage(
            { source: "mcp-studio-ext", type: "open-panel-result", ok },
            location.origin,
          );
        });
      } catch {
        window.postMessage(
          { source: "mcp-studio-ext", type: "open-panel-result", ok: false },
          location.origin,
        );
      }
    }
  });
}

import { buildSelector } from "../lib/selector";
import { sanitizeNetworkPayload } from "../lib/payload";
import { detectSpecPage } from "../lib/spec-detect";

const CORRELATION_WINDOW_MS = 5000;

// MV3에서 서비스 워커가 잠들어 있으면 sendMessage가 reject한다
// ("Could not establish connection"). 잡지 않으면 대상 사이트의 콘솔에
// unhandled rejection이 남는다 — 촬영 중 개발자 도구를 열면 그대로 보인다.
// 확장을 다시 로드하면 이미 주입돼 있던 이 스크립트는 고아가 된다.
// chrome.runtime 자체가 undefined 가 되어 sendMessage 에 접근하는 순간
// 동기 TypeError 가 나고, .catch() 를 붙이기도 전에 페이지로 새어나간다
// ("Extension context invalidated", "Cannot read properties of undefined").
// 이 상태에서는 클릭도 요청도 전달되지 않으므로 페이지를 새로고침해야 한다.
let orphanWarned = false;

function post(type: "interaction" | "network", payload: unknown): void {
  try {
    if (!chrome.runtime?.id) {
      if (!orphanWarned) {
        orphanWarned = true;
        console.warn(
          "[MCP Studio] 확장이 다시 로드되어 이 페이지의 기록이 끊겼습니다. " +
            "페이지를 새로고침한 뒤 다시 기록을 시작하세요.",
        );
      }
      return;
    }
    void chrome.runtime.sendMessage({ type, payload }).catch(() => {});
  } catch {
    // 확인과 호출 사이에 무효화될 수도 있다. 여기서 삼키지 않으면 대상
    // 사이트의 콘솔에 예외가 그대로 남는다.
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  async main(ctx) {
    // injectScript는 비동기다. 이 await가 끝나기 전에 페이지가 보낸 요청은
    // 후킹되지 않는다. 기법상 불가피하며, 시나리오는 로딩 후 클릭이므로
    // 데모에는 영향이 없다.
    await injectScript("/injected.js", { keepInDom: true });

    let currentInteractionId: string | null = null;
    let interactionExpiresAt = 0;

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element | null;
        if (!target) return;
        const el = target.closest("button, a, input, select, [role=button]") ?? target;

        currentInteractionId = crypto.randomUUID();
        interactionExpiresAt = Date.now() + CORRELATION_WINDOW_MS;

        post("interaction", {
          interactionId: currentInteractionId,
          eventType: "click",
          pageUrl: location.href,
          selector: buildSelector(el),
          elementText: (el.textContent || "").trim().slice(0, 50),
          occurredAt: new Date().toISOString(),
        });
      },
      true,
    );

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.source !== "mcp-studio" || event.data.type !== "network") return;

      const payload = sanitizeNetworkPayload(event.data.payload);
      if (!payload) return;

      payload.interactionId = Date.now() < interactionExpiresAt ? currentInteractionId : null;
      post("network", payload);
    });

    // 포털 공개 기반 수집. 사이드패널이 물으면 판정 결과를, 수집을 누르면
    // 현재 DOM 을 그대로 돌려준다. 서버가 포털을 직접 긁지 않는 이유는
    // 백엔드 services/spec_parser.py 주석에 적어두었다.
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "detect-spec") {
        sendResponse(detectSpecPage(document, location.href));
        return true;
      }
      if (msg?.type === "capture-spec") {
        // outerHTML 은 사용자가 지금 보고 있는 상태 그대로다. 상세기능을
        // 바꿔가며 여러 번 수집하면 백엔드가 같은 세션에 누적한다.
        sendResponse({ url: location.href, html: document.documentElement.outerHTML });
        return true;
      }
      return undefined;
    });
  },
});

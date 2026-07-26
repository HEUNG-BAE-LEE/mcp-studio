import { buildSelector } from "../lib/selector";
import { maskHeaders, maskBody } from "../lib/masking";

const CORRELATION_WINDOW_MS = 5000;

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  async main(ctx) {
    // Main-World 스크립트를 주입해 fetch/XHR를 패치한다 (Task 1)
    await injectScript("/injected.js", { keepInDom: true });

    let currentInteractionId: string | null = null;
    let interactionExpiresAt = 0;

    // 클릭을 기록하고 상관관계 창(5초)을 연다
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element | null;
        if (!target) return;
        const el = target.closest("button, a, input, select, [role=button]") ?? target;

        currentInteractionId = crypto.randomUUID();
        interactionExpiresAt = Date.now() + CORRELATION_WINDOW_MS;

        chrome.runtime.sendMessage({
          type: "interaction",
          payload: {
            interactionId: currentInteractionId,
            eventType: "click",
            pageUrl: location.href,
            selector: buildSelector(el),
            elementText: (el.textContent || "").trim().slice(0, 50),
            occurredAt: new Date().toISOString(),
          },
        });
      },
      true,
    );

    // Main-World 스크립트가 postMessage로 보낸 네트워크 이벤트를 받아
    // 가장 최근 클릭과 연결하고 1차 마스킹을 적용한 뒤 백그라운드로 중계한다
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.source !== "mcp-studio" || event.data.type !== "network") return;

      const p = event.data.payload;
      // 5초 창 안에 도착한 요청만 클릭에 연결한다. 창을 벗어난 요청은
      // interactionId가 null이 되며, 이는 의도된 동작이다(오래된 클릭에
      // 임의로 붙이지 않는다).
      const linked = Date.now() < interactionExpiresAt ? currentInteractionId : null;

      chrome.runtime.sendMessage({
        type: "network",
        payload: {
          ...p,
          interactionId: linked,
          requestHeaders: maskHeaders(p.requestHeaders ?? {}),
          requestBody: maskBody(p.requestBody ?? null),
        },
      });
    });
  },
});

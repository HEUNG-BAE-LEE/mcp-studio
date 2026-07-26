import { buildSelector } from "../lib/selector";
import { sanitizeNetworkPayload } from "../lib/payload";

const CORRELATION_WINDOW_MS = 5000;

// MV3에서 서비스 워커가 잠들어 있으면 sendMessage가 reject한다
// ("Could not establish connection"). 잡지 않으면 대상 사이트의 콘솔에
// unhandled rejection이 남는다 — 촬영 중 개발자 도구를 열면 그대로 보인다.
function post(type: "interaction" | "network", payload: unknown): void {
  void chrome.runtime.sendMessage({ type, payload }).catch(() => {});
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
  },
});

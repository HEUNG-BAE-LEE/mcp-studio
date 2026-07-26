import { buildSelector } from "../lib/selector";
import { maskHeaders, maskBody } from "../lib/masking";

const CORRELATION_WINDOW_MS = 5000;
const MAX_FIELD = 100_000;

// MV3에서 서비스 워커가 잠들어 있으면 sendMessage가 reject한다
// ("Could not establish connection"). 잡지 않으면 대상 사이트의 콘솔에
// unhandled rejection이 남는다 — 촬영 중 개발자 도구를 열면 그대로 보인다.
function post(type: "interaction" | "network", payload: unknown): void {
  void chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}

// 이 스크립트는 페이지의 window를 공유한다. 그 페이지에서 이미 돌고 있는
// 광고·추적 스크립트도 {source:"mcp-studio"} 메시지를 흉내낼 수 있다.
// 스프레드로 통째로 넘기지 않고 필요한 필드만 타입과 길이를 확인해 추린다.
function sanitizeNetworkPayload(raw: any): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.url !== "string" || typeof raw.method !== "string") return null;
  if (typeof raw.status !== "number") return null;

  const headers =
    raw.requestHeaders && typeof raw.requestHeaders === "object" && !Array.isArray(raw.requestHeaders)
      ? (raw.requestHeaders as Record<string, string>)
      : {};

  return {
    url: raw.url.slice(0, 2000),
    method: raw.method.slice(0, 16).toUpperCase(),
    requestHeaders: maskHeaders(headers),
    requestBody: maskBody(typeof raw.requestBody === "string" ? raw.requestBody.slice(0, MAX_FIELD) : null),
    status: raw.status,
    responseText: typeof raw.responseText === "string" ? raw.responseText.slice(0, MAX_FIELD) : "",
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    occurredAt: typeof raw.occurredAt === "string" ? raw.occurredAt : new Date().toISOString(),
  };
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

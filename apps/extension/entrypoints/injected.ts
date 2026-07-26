// apps/extension/entrypoints/injected.ts
export default defineUnlistedScript(() => {
  const MAX_BODY = 100_000;

  function emit(payload: unknown) {
    window.postMessage({ source: "mcp-studio", type: "network", payload }, "*");
  }

  // fetch 후킹
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const started = Date.now();
    const request = new Request(...args);
    let bodyText: string | null = null;
    try {
      bodyText = await request.clone().text();
    } catch {
      bodyText = null;
    }
    const response = await originalFetch.apply(this, args);
    const clone = response.clone();
    let responseText = "";
    try {
      responseText = (await clone.text()).slice(0, MAX_BODY);
    } catch {
      responseText = "";
    }
    emit({
      url: request.url,
      method: request.method,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: bodyText ? bodyText.slice(0, MAX_BODY) : null,
      status: response.status,
      responseText,
      durationMs: Date.now() - started,
      occurredAt: new Date().toISOString(),
    });
    return response;
  };

  // XMLHttpRequest 후킹
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
    (this as any).__mcp = { method, url, headers: {} as Record<string, string> };
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const meta = (this as any).__mcp;
    if (meta) meta.headers[name] = value;
    return originalSetHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = (this as any).__mcp;
    const started = Date.now();
    this.addEventListener("loadend", () => {
      if (!meta) return;
      emit({
        url: new URL(meta.url, location.href).href,
        method: meta.method,
        requestHeaders: meta.headers,
        requestBody: typeof body === "string" ? body.slice(0, MAX_BODY) : null,
        status: this.status,
        responseText: (this.responseText || "").slice(0, MAX_BODY),
        durationMs: Date.now() - started,
        occurredAt: new Date().toISOString(),
      });
    });
    return originalSend.call(this, body as any);
  };
});

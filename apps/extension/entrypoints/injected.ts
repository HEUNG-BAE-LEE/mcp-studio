// apps/extension/entrypoints/injected.ts
export default defineUnlistedScript(() => {
  const MAX_BODY = 100_000;

  function emit(payload: unknown) {
    window.postMessage({ source: "mcp-studio", type: "network", payload }, "*");
  }

  // fetch 후킹
  //
  // 이 코드는 남의 사이트 안에서 돈다. 수집 로직의 어떤 실패도 페이지의
  // 원래 요청을 깨뜨려서는 안 된다. 두 가지 규칙을 지킨다.
  //
  // 1) input이 Request 객체이면 절대 new Request(input, ...)로 감싸지 않는다.
  //    Request 생성자는 원본의 본문 스트림을 소비(disturbed) 처리하므로,
  //    뒤이어 originalFetch(input)을 부르면 페이지의 실제 요청이 실패한다.
  //    본문이 필요하면 clone()으로만 읽는다.
  // 2) 메타데이터 추출과 emit 전체를 try/catch로 감싼다. 응답은 이미
  //    성공했는데 수집 코드의 예외 때문에 페이지가 받는 Promise가
  //    거부되는 일이 없어야 한다.
  const originalFetch = window.fetch;
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const started = Date.now();

    // 요청 메타데이터는 원본을 건드리지 않고 뽑는다
    let url = "";
    let method = "GET";
    let requestHeaders: Record<string, string> = {};
    let requestBody: string | null = null;
    try {
      if (input instanceof Request) {
        url = input.url;
        method = input.method;
        requestHeaders = Object.fromEntries(input.headers.entries());
        requestBody = await input.clone().text();   // clone만 읽는다
      } else {
        url = new URL(String(input), location.href).href;
        method = (init?.method ?? "GET").toUpperCase();
        requestHeaders = Object.fromEntries(new Headers(init?.headers).entries());
        requestBody = typeof init?.body === "string" ? init.body : null;
      }
    } catch {
      // 메타데이터 추출 실패는 무시한다. 요청은 그대로 진행한다.
    }

    // 원본 input/init을 손대지 않고 그대로 넘긴다
    const response = await originalFetch.call(window, input, init);

    try {
      let responseText = "";
      try {
        responseText = (await response.clone().text()).slice(0, MAX_BODY);
      } catch {
        responseText = "";
      }
      emit({
        url,
        method,
        requestHeaders,
        requestBody: requestBody ? requestBody.slice(0, MAX_BODY) : null,
        status: response.status,
        responseText,
        durationMs: Date.now() - started,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // 수집 실패가 페이지 응답에 영향을 주지 않게 한다
    }

    return response;
  };

  // XMLHttpRequest 후킹
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  // fetch와 동일한 이유(TS2556)로 spread 대신 open()의 실제 오버로드 시그니처를 명시적으로 받는다.
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    (this as any).__mcp = { method, url: String(url), headers: {} as Record<string, string> };
    return originalOpen.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const meta = (this as any).__mcp;
    if (meta) meta.headers[name] = value;
    return originalSetHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = (this as any).__mcp;
    const started = Date.now();

    // once: true 가 핵심이다. XHR 객체를 재사용해 open()+send()를 다시 부르면
    // 리스너가 쌓이고, 오래된 리스너가 낡은 meta와 새 응답을 섞어 중복 보고한다.
    this.addEventListener(
      "loadend",
      () => {
        if (!meta) return;
        try {
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
        } catch {
          // 수집 실패가 페이지 동작에 영향을 주지 않게 한다.
          // responseType이 json/blob이면 responseText 접근이 예외를 던진다.
        }
      },
      { once: true },
    );

    return originalSend.call(this, body as any);
  };
});

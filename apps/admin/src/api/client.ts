const BASE = "http://localhost:8000";

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    // 서버가 보낸 설명을 버리지 않는다. 백엔드는 422에 어느 필드가 왜
    // 틀렸는지를 detail로 실어 보낸다. 상태 코드만 던지면 촬영 중 문제가
    // 생겼을 때 개발자 도구를 열어야만 원인을 알 수 있다.
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = typeof parsed.detail === "string" ? parsed.detail : text;
    } catch {
      // JSON이 아니면 본문을 그대로 쓴다
    }
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }

  // 204처럼 본문이 없는 응답에서 JSON.parse가 던지지 않게 한다
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
};

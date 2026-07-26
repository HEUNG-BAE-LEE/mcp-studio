const BASE = "http://localhost:8000";

/** 서버가 보낸 상태 코드와 한국어 설명을 함께 나르는 오류 */
export interface ApiError extends Error {
  status: number;
  detail: string;
}

/** 오류에서 화면에 띄울 한국어 문구를 꺼낸다. 서버 설명이 있으면 그것을 쓴다. */
export function errorMessage(err: unknown): string {
  // 빈 문자열은 쓰지 않는다. 본문 없는 오류 응답(프록시발 502 등)이면
  // detail이 ""가 되는데, 그대로 넘기면 배너가 렌더되지 않아 화면이
  // 멈춘 것처럼 보인다 — 이 파일이 막으려던 바로 그 증상이다.
  const detail = (err as ApiError)?.detail;
  if (typeof detail === "string" && detail !== "") {
    return detail;
  }
  return err instanceof Error ? err.message : String(err);
}

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
    // 화면에 그대로 띄울 수 있게 서버 설명을 따로 실어 보낸다. message는
    // 기존 화면들이 그대로 쓰고 있으므로 형식을 바꾸지 않는다.
    const error = new Error(`${method} ${path} → ${res.status}: ${detail}`) as ApiError;
    error.status = res.status;
    error.detail = detail;
    throw error;
  }

  // 204처럼 본문이 없는 응답에서 JSON.parse가 던지지 않게 한다
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
  delete: (path: string) => request("DELETE", path),
};

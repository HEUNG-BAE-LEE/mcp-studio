import { maskHeaders, maskBody } from "./masking";

const MAX_FIELD = 100_000;

/**
 * 헤더 값을 서버가 받을 수 있는 형태(문자열)로 맞춘다.
 *
 * injected.ts 는 setRequestHeader(name, value) 를 후킹하면서 value 를 받은
 * 그대로 저장한다. 타입 시그니처는 string 이지만 런타임에는 페이지가 무엇이든
 * 넘길 수 있고, 브라우저는 실제 헤더를 만들 때만 문자열로 바꾼다 — 우리 사본은
 * 원래 타입을 그대로 들고 있다.
 *
 * 서버의 NetworkIn.requestHeaders 는 Dict[str, str] 이라 값이 문자열이 아니면
 * 422 가 나고 **배치 전체가 거부된다.** 요청 210건 중 헤더 하나가 숫자이면
 * 기록 전체가 날아간다. 실제로 그렇게 잃은 적이 있다.
 *
 * null·undefined 는 "null" 이라는 문자열을 지어내지 않고 버린다.
 */
function stringifyHeaderValues(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    out[name] = typeof value === "string" ? value : String(value);
  }
  return out;
}

/**
 * 페이지가 보낸 network 페이로드를 서버 스키마에 맞는 형태로 추린다.
 *
 * 이 스크립트는 페이지의 window 를 공유한다. 그 페이지에서 이미 돌고 있는
 * 광고·추적 스크립트도 {source:"mcp-studio"} 메시지를 흉내낼 수 있다.
 * 스프레드로 통째로 넘기지 않고 필요한 필드만 타입과 길이를 확인해 추린다.
 */
export function sanitizeNetworkPayload(raw: any): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.url !== "string" || typeof raw.method !== "string") return null;
  if (typeof raw.status !== "number") return null;

  const headers =
    raw.requestHeaders && typeof raw.requestHeaders === "object" && !Array.isArray(raw.requestHeaders)
      ? (raw.requestHeaders as Record<string, unknown>)
      : {};

  return {
    url: raw.url.slice(0, 2000),
    method: raw.method.slice(0, 16).toUpperCase(),
    requestHeaders: maskHeaders(stringifyHeaderValues(headers)),
    requestBody: maskBody(typeof raw.requestBody === "string" ? raw.requestBody.slice(0, MAX_FIELD) : null),
    status: raw.status,
    responseText: typeof raw.responseText === "string" ? raw.responseText.slice(0, MAX_FIELD) : "",
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    occurredAt: typeof raw.occurredAt === "string" ? raw.occurredAt : new Date().toISOString(),
  };
}

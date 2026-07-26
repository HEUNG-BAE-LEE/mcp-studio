const MASK = "***";
// 정확히 일치하는 이름이면 민감 헤더로 취급한다
const HEADER_NAMES = new Set([
  "authorization", "cookie", "set-cookie", "proxy-authorization",
  "x-api-key", "x-auth-token",
]);
// User-Agent, Referer, X-Requested-With, Accept 등은 여기 포함되지 않으며
// 이후 단계에서 WAF 우회를 위해 그대로 재사용되므로 절대 추가하지 않는다.
// "auth"가 포함되어 Authorization은 이름 일치와 부분 일치 양쪽에 걸리는데, 의도된 동작이다.
const HEADER_SUBSTRINGS = ["token", "secret", "key", "auth"];
const BODY_KEYS = new Set([
  "password", "passwd", "pwd", "secret", "token", "accesstoken", "refreshtoken",
  "apikey", "sessionid", "ssn", "jumin", "cardnumber", "cvv",
]);

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    const sensitive = HEADER_NAMES.has(lower) || HEADER_SUBSTRINGS.some(s => lower.includes(s));
    // 헤더 이름은 그대로 남기고 값만 마스킹한다 (이름으로 auth 모드를 추론하기 때문)
    out[name] = sensitive ? MASK : value;
  }
  return out;
}

export function maskBody(body: string | null): string | null {
  if (!body) return body;
  // form-urlencoded
  if (body.includes("=") && !body.trimStart().startsWith("{")) {
    return body
      .split("&")
      .map(pair => {
        const [k, ...rest] = pair.split("=");
        return BODY_KEYS.has(k.toLowerCase()) ? `${k}=${MASK}` : [k, ...rest].join("=");
      })
      .join("&");
  }
  // JSON
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(maskObject(parsed));
  } catch {
    return body;
  }
}

function maskObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskObject);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = BODY_KEYS.has(k.toLowerCase()) ? MASK : maskObject(v);
    }
    return out;
  }
  return value;
}

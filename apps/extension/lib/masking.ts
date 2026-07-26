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

  // JSON 판정은 시작 문자가 아니라 파싱 시도로 한다.
  //
  // 시작 문자가 '{'인지만 보면 JSON 배열 본문이 form 분기로 샌다.
  // 예: [{"password":"a=b"}] 는 '{'로 시작하지 않고 '='를 포함하므로
  // form 분기로 가고, split("=")의 키가 `[{"password":"a` 가 되어
  // BODY_KEYS와 일치하지 않는다. 결과적으로 비밀번호가 마스킹되지 않은 채
  // 서버로 전송된다. 백엔드의 parse_json_body와 같은 원칙을 쓴다.
  const trimmed = body.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.stringify(maskObject(JSON.parse(body)));
    } catch {
      // JSON이 아니면 아래 form 처리로 내려간다
    }
  }

  // form-urlencoded
  if (body.includes("=")) {
    return body
      .split("&")
      .map(pair => {
        const [k, ...rest] = pair.split("=");
        return BODY_KEYS.has(k.toLowerCase()) ? `${k}=${MASK}` : [k, ...rest].join("=");
      })
      .join("&");
  }

  return body;
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

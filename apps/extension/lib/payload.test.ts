import { describe, expect, it } from "vitest";
import { sanitizeNetworkPayload } from "./payload";

// 서버의 NetworkIn 은 requestHeaders 를 Dict[str, str] 로 받는다.
// 값이 문자열이 아니면 Pydantic 이 422 를 내고, 배치 전체가 거부된다 —
// 요청 210건 중 헤더 하나가 어긋나면 기록 전체가 날아간다.
describe("sanitizeNetworkPayload — 헤더 값 타입", () => {
  const base = {
    url: "https://x.kr/a",
    method: "get",
    status: 200,
    responseText: "{}",
    durationMs: 10,
    occurredAt: "2026-07-27T01:00:00.000Z",
  };

  it("숫자 헤더 값을 문자열로 바꾼다", () => {
    const out = sanitizeNetworkPayload({ ...base, requestHeaders: { "X-Ts": 1737000000 } });
    expect(out!.requestHeaders).toEqual({ "X-Ts": "1737000000" });
  });

  it("불리언 헤더 값을 문자열로 바꾼다", () => {
    const out = sanitizeNetworkPayload({ ...base, requestHeaders: { "X-Flag": true } });
    expect(out!.requestHeaders).toEqual({ "X-Flag": "true" });
  });

  it("null·undefined 헤더는 버린다", () => {
    // "null" 이라는 문자열을 만들어 보내는 것보다 없는 편이 정직하다
    const out = sanitizeNetworkPayload({
      ...base,
      requestHeaders: { "X-A": null, "X-B": undefined, "X-C": "ok" },
    });
    expect(out!.requestHeaders).toEqual({ "X-C": "ok" });
  });

  it("객체·배열 헤더 값도 문자열로 바꾼다", () => {
    const out = sanitizeNetworkPayload({ ...base, requestHeaders: { "X-A": ["a", "b"] } });
    expect(typeof (out!.requestHeaders as Record<string, unknown>)["X-A"]).toBe("string");
  });

  it("정상 문자열 헤더는 그대로 둔다", () => {
    const out = sanitizeNetworkPayload({
      ...base,
      requestHeaders: { "X-Requested-With": "XMLHttpRequest" },
    });
    expect(out!.requestHeaders).toEqual({ "X-Requested-With": "XMLHttpRequest" });
  });
});

describe("sanitizeNetworkPayload — 기존 방어는 유지된다", () => {
  it("url 이나 method 가 문자열이 아니면 통째로 버린다", () => {
    expect(sanitizeNetworkPayload({ url: null, method: "GET", status: 200 })).toBeNull();
    expect(sanitizeNetworkPayload({ url: "https://x.kr", method: 1, status: 200 })).toBeNull();
  });

  it("status 가 숫자가 아니면 통째로 버린다", () => {
    expect(sanitizeNetworkPayload({ url: "https://x.kr", method: "GET", status: "200" })).toBeNull();
  });

  it("method 는 대문자로 바꾼다", () => {
    const out = sanitizeNetworkPayload({ url: "https://x.kr", method: "post", status: 200 });
    expect(out!.method).toBe("POST");
  });

  it("responseText 가 없으면 빈 문자열로 채운다", () => {
    const out = sanitizeNetworkPayload({ url: "https://x.kr", method: "GET", status: 200 });
    expect(out!.responseText).toBe("");
    expect(out!.durationMs).toBe(0);
    expect(typeof out!.occurredAt).toBe("string");
  });
});

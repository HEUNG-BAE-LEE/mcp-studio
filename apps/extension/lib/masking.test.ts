import { describe, it, expect } from "vitest";
import { maskHeaders, maskBody } from "./masking";

describe("maskHeaders", () => {
  it("Authorization 값을 가리고 키는 남긴다", () => {
    expect(maskHeaders({ Authorization: "Bearer abc" })).toEqual({ Authorization: "***" });
  });

  it("이름에 token이 들어간 헤더를 가린다", () => {
    expect(maskHeaders({ "X-Csrf-Token": "zzz" })).toEqual({ "X-Csrf-Token": "***" });
  });

  it("대소문자를 가리지 않는다", () => {
    expect(maskHeaders({ authorization: "Bearer abc" })).toEqual({ authorization: "***" });
  });

  // 이 네 헤더는 Task 13에서 WAF 통과를 위해 그대로 재현해야 한다.
  // 가려지면 실행 단계가 400으로 막힌다.
  it("실행에 필요한 헤더 4개를 보존한다", () => {
    const passthrough = {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://rt.molit.go.kr/pt/gis/gis.do",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
    };
    expect(maskHeaders(passthrough)).toEqual(passthrough);
  });
});

describe("maskBody", () => {
  it("form-urlencoded의 password 값을 가린다", () => {
    expect(maskBody("id=kim&password=1234")).toBe("id=kim&password=***");
  });

  it("값에 =가 들어 있어도 키만 보고 판단한다", () => {
    expect(maskBody("token=a=b=c&name=kim")).toBe("token=***&name=kim");
  });

  it("JSON 객체의 중첩된 민감 키를 가린다", () => {
    const out = maskBody('{"user":{"id":"kim","password":"1234"},"apiKey":"zzz"}');
    expect(JSON.parse(out!)).toEqual({ user: { id: "kim", password: "***" }, apiKey: "***" });
  });

  // 배열 본문이 form 분기로 새면 마스킹이 조용히 실패한다
  it("JSON 배열 본문도 마스킹한다", () => {
    const out = maskBody('[{"password":"a=b"},{"id":"kim"}]');
    expect(JSON.parse(out!)).toEqual([{ password: "***" }, { id: "kim" }]);
  });

  it("=가 없는 평범한 문자열은 그대로 둔다", () => {
    expect(maskBody("hello")).toBe("hello");
  });

  it("빈 값은 그대로 반환한다", () => {
    expect(maskBody("")).toBe("");
    expect(maskBody(null)).toBe(null);
  });
});

import { describe, it, expect } from "vitest";
import { maskHeaders, maskBody } from "./masking";

describe("maskHeaders", () => {
  it("Authorization 값을 가리고 키는 남긴다", () => {
    expect(maskHeaders({ Authorization: "Bearer abc" })).toEqual({ Authorization: "***" });
  });

  it("이름에 token이 들어간 헤더를 가린다", () => {
    expect(maskHeaders({ "X-Csrf-Token": "zzz" })).toEqual({ "X-Csrf-Token": "***" });
  });

  it("일반 헤더는 보존한다", () => {
    expect(maskHeaders({ Referer: "https://a.b/" })).toEqual({ Referer: "https://a.b/" });
  });
});

describe("maskBody", () => {
  it("password 키의 값을 가린다", () => {
    expect(maskBody("id=kim&password=1234")).toBe("id=kim&password=***");
  });
});

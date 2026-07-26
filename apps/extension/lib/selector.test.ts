import { describe, it, expect } from "vitest";
import { buildSelector } from "./selector";

describe("buildSelector", () => {
  it("고유 ID를 최우선으로 쓴다", () => {
    document.body.innerHTML = `<button id="search-btn" data-testid="x">조회</button>`;
    expect(buildSelector(document.querySelector("button")!)).toBe("#search-btn");
  });

  it("ID가 없으면 data-testid를 쓴다", () => {
    document.body.innerHTML = `<button data-testid="customer-search">조회</button>`;
    expect(buildSelector(document.querySelector("button")!)).toBe('[data-testid="customer-search"]');
  });

  it("둘 다 없으면 aria-label을 쓴다", () => {
    document.body.innerHTML = `<button aria-label="고객 조회">조회</button>`;
    expect(buildSelector(document.querySelector("button")!)).toBe('[aria-label="고객 조회"]');
  });
});

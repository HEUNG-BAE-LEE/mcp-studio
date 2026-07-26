import { defineConfig } from "vitest/config";

// Task 2에서 apps/extension/lib/*.test.ts가 document.body.innerHTML을 사용하므로
// DOM 환경(happy-dom)을 기본값으로 설정한다.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["lib/**/*.test.ts"],
    // Task 2가 lib/*.test.ts를 추가하기 전까지는 테스트 파일이 없어도 실패하지 않도록 한다.
    passWithNoTests: true,
  },
});

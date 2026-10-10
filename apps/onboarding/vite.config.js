import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 빌드 결과는 이음 콘솔 정적 폴더 아래(/ieum/onboarding/)에 둔다. 백엔드가 콘솔과 함께 서빙한다.
// 개발 서버(npm run dev)는 이음 백엔드(:18000)로 API 를 넘긴다.
export default defineConfig({
  plugins: [react()],
  base: "/ieum/onboarding/",
  build: { outDir: "../web/ieum/onboarding", emptyOutDir: true },
  server: {
    port: 15174,
    proxy: { "/api": process.env.IEUM_BACKEND || "http://127.0.0.1:18000" },
  },
});

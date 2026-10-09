import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// 개발 서버가 /api/ieum을 넘길 백엔드. 백엔드 포트를 바꿨으면 IEUM_BACKEND로 맞춘다(chore/start-ports 병합 시 18000)
const BACKEND = process.env.IEUM_BACKEND ?? 'http://localhost:8000';
const DEV_PORT = 5174;

export default defineConfig({
  base: '/ieum/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  // 개발 중 대시보드 빈 상태의 시연 원본 주소는 location.origin(:5174)이 아니라 백엔드 주소로 만든다
  define: { __IEUM_BACKEND__: JSON.stringify(BACKEND) },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /node_modules[\\/](react-router|react-router-dom)[\\/]/ },
            { name: 'data', test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
  // 문자열 축약형이라 changeOrigin이 켜진다 — 백엔드 request.base_url이 :5174가 되지 않는다
  server: { port: DEV_PORT, strictPort: true, proxy: { '/api/ieum': BACKEND } },
});

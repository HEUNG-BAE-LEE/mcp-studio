import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  build: {
    rolldownOptions: {
      output: {
        // 본 번들 하나가 500kB를 넘지 않게 라이브러리를 나눈다(바뀌지 않는 묶음은 캐시도 오래 간다).
        // 순서가 우선순위다 — react를 맨 앞에 둬야 뒤 그룹이 의존성으로 react를 끌어가지 않는다
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /node_modules[\\/]react-router[\\/]/ },
            { name: 'radix', test: /node_modules[\\/](radix-ui|@radix-ui)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](@tanstack|zustand)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 흔한 5173 을 피한다. 확장의 "관리자에서 열기"가 이 포트를 가리킨다(apps/extension)
  server: { port: 15173, strictPort: true },
})

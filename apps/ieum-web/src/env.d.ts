/// <reference types="vite/client" />

// 모듈 확장(declare module 'react')을 쓰려면 이 파일이 모듈이어야 한다 — 전역 선언은 declare global로 옮겼다
export {};

declare global {
  /** vite.config.ts define — 개발 서버가 프록시하는 백엔드 주소 */
  const __IEUM_BACKEND__: string;
}

// D16: style은 '--*' 키만 쓴다(check-source inline-style-literal) — 타입 단언 없이 쓰도록 CSSProperties가 사용자 속성 키를 받게 한다
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

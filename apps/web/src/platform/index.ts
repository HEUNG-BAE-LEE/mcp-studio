// apps/web/src/platform/index.ts — 플랫폼 경계. 화면은 이 인터페이스만 본다. Electron은 web.ts만 바꾼다
import type { AppEventMap, AppEventName } from './events';

export type { AppEventMap, AppEventName } from './events';

export type MediaSubscription = {
  /** 현재 일치 여부(읽을 때마다 평가) */
  readonly matches: boolean;
  /** 변경 구독. 반환값으로 해제 */
  subscribe(onChange: (matches: boolean) => void): () => void;
};

export type EventStream = {
  on<E extends AppEventName>(event: E, handler: (data: AppEventMap[E]) => void): () => void;
  close(): void;
};

export interface Platform {
  /** 동기 키-값(LNB 폭 · 접힘 저장). 실패(사생활 모드 · 용량)는 삼키고 null */
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  };
  /** `(max-width: 1279px)` 같은 미디어 쿼리 구독 */
  media(query: string): MediaSubscription;
  /** 클립보드 복사(연결 정보). 거부 · 비보안 컨텍스트 · 미지원은 false */
  copyText(text: string): Promise<boolean>;
  /** 실시간 스트림. 공유 연결 위 핸들. close()로 내 핸들러만 떼고, 마지막 핸들이 닫히면 연결을 닫는다 */
  events(): EventStream;
}

export { webPlatform as platform } from './web';

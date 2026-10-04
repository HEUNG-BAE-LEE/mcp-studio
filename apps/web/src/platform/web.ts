// apps/web/src/platform/web.ts — 웹 구현(저장 · 미디어 쿼리 · 클립보드 · 실시간 이벤트). localStorage · matchMedia · navigator는 이 파일만 만진다
import type { AppEventName } from './events';
import { subscribe as subscribeDummy } from '../api/dummy/realtime';
import type { EventStream, MediaSubscription, Platform } from './index';

const storage: Platform['storage'] = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // 사생활 모드 · 저장소 차단
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // 용량 초과 · 차단 — 저장 실패는 기능을 막지 않는다(저장은 편의)
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 위와 같다
    }
  },
};

function media(query: string): MediaSubscription {
  const mql = matchMedia(query);
  return {
    get matches() {
      return mql.matches;
    },
    subscribe(onChange) {
      const handler = (e: { matches: boolean }) => onChange(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    },
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // 권한 거부 · 비보안 컨텍스트 · 미지원 — 호출자는 false만 본다
    console.warn('[platform] 클립보드 복사 실패', error);
    return false;
  }
}

type Handler = Readonly<{ name: AppEventName; fn: (data: unknown) => void }>;
let handlers: readonly Handler[] = [];
let openHandles = 0;
let disconnect: (() => void) | null = null;
/** 구독자 하나의 오류가 다른 구독자 · 연결을 막지 않게 핸들러마다 가둔다 */
const dispatch = (name: AppEventName, data: unknown) => {
  for (const h of handlers) {
    if (h.name !== name) continue;
    try {
      h.fn(data);
    } catch (error) {
      console.error('[platform] 실시간 구독자 오류', error);
    }
  }
};
/** 더미 실시간(api/dummy/realtime)에 붙는다. 서버가 없어 항상 이 스트림만 쓴다 */
const connect = (): (() => void) => subscribeDummy(dispatch);
/** 공유 연결 하나 위의 핸들(참조 계수). 화면은 api/realtime 훅만 쓴다 */
function events(): EventStream {
  if (openHandles === 0) disconnect = connect();
  openHandles += 1;
  let own: readonly Handler[] = [];
  let closed = false;
  return {
    on(name, handler) {
      if (closed) return () => {}; // 닫힌 핸들은 아무것도 받지 않는다
      // 이름별 페이로드 타입은 AppEventMap이 보장한다 — 저장은 unknown 하나로
      const h: Handler = { name, fn: handler as (data: unknown) => void };
      own = [...own, h];
      handlers = [...handlers, h];
      return () => {
        own = own.filter((x) => x !== h);
        handlers = handlers.filter((x) => x !== h);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      handlers = handlers.filter((h) => !own.includes(h));
      own = [];
      openHandles -= 1;
      if (openHandles === 0) {
        disconnect?.();
        disconnect = null;
      }
    },
  };
}

export const webPlatform: Platform = {
  storage,
  media,
  copyText,
  events,
};

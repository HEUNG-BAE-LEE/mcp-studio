// 화면 간 공유 상태의 틀 — useSyncExternalStore 위 모듈 저장소(D3 · 설계 3절 "화면 간 공유 상태").
// 저장소 자체(스튜디오 초안 · 테스트 실행 상태 · Toast 한 칸)는 3단계 ② ③ ④가 createStore로 만든다.
// 모듈 상태라 새로고침하면 비고, 브라우저 저장소에 쓰지 않는다
import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

export type Store<T> = Readonly<{
  get: () => T;
  /** 늘 새 객체를 돌려준다(불변 갱신). 같은 객체를 돌려주면 바뀌지 않은 것으로 보고 알리지 않는다 */
  set: (update: (prev: T) => T) => void;
  subscribe: (listener: Listener) => () => void;
}>;

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  // 구독 목록도 바꿀 때마다 새로 만든다 — 알리는 도중의 구독 · 해제가 순회를 흔들지 않는다
  let listeners: ReadonlySet<Listener> = new Set();

  const get = () => state;
  const set = (update: (prev: T) => T) => {
    const next = update(state);
    if (Object.is(next, state)) return;
    state = next;
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: Listener) => {
    listeners = new Set([...listeners, listener]);
    return () => {
      listeners = new Set([...listeners].filter((l) => l !== listener));
    };
  };
  return { get, set, subscribe };
}

/**
 * 저장소의 일부를 읽어 바뀔 때 다시 그린다. 선택자는 저장된 값의 일부를 **그대로** 돌려준다 —
 * 그 자리에서 새 배열 · 객체를 만들면 스냅숏이 매번 달라져 무한 렌더가 난다(파생 값은 컴포넌트의 useMemo로)
 */
export function useStore<T, S>(store: Store<T>, select: (state: T) => S): S {
  const getSnapshot = useCallback(() => select(store.get()), [store, select]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

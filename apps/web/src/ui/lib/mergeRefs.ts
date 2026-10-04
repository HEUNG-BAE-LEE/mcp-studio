// 한 노드를 여러 ref(콜백 · 객체 · forwardRef 바깥 ref)에 함께 넘긴다 — Radix 내부 모듈(`radix-ui/internal`)에 기대지 않는다
import { useMemo, type Ref, type RefCallback } from 'react';

type MaybeRef<T> = Ref<T> | undefined;

function assignRef<T>(ref: MaybeRef<T>, node: T | null) {
  if (typeof ref === 'function') {
    ref(node);
    return;
  }
  // ref 객체는 React가 정한 쓰기 자리다(current)
  if (ref) ref.current = node;
}

/** 두 ref에 같은 노드를 넘기는 콜백 ref */
export const mergeRefs =
  <T>(a: MaybeRef<T>, b: MaybeRef<T>): RefCallback<T> =>
  (node) => {
    assignRef(a, node);
    assignRef(b, node);
  };

/**
 * 렌더마다 새 콜백을 만들지 않는 `mergeRefs`. 콜백이 바뀌면 React가 ref를 null로 뗐다가 다시 붙이므로,
 * state 설정자(setNode)를 ref로 넘기면 렌더가 끝없이 돈다
 */
export const useMergedRefs = <T>(a: MaybeRef<T>, b: MaybeRef<T>) =>
  useMemo(() => mergeRefs(a, b), [a, b]);

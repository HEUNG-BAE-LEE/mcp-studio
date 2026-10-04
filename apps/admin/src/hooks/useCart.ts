import { useCallback, useEffect, useState } from "react";

/**
 * 마켓 장바구니.
 *
 * 담기를 즉시 연결로 만들지 않은 이유는 화면 밖에 있다 — 둘러보는 행위와
 * 프로젝트를 바꾸는 행위를 분리해야 실수로 프로젝트를 건드리지 않는다.
 * 담기는 되돌리기 쉽고, 보내기는 명시적이다.
 *
 * 상태는 localStorage 에 둔다. 마켓에서 담다가 상세로 들어갔다 나오면
 * 라우팅이 컴포넌트를 새로 만드는데, 메모리에만 있으면 그때 비워진다.
 * 서버에 둘 값은 아니다 — 아직 아무것도 확정하지 않은 상태이기 때문이다.
 */

const KEY = "mcp-studio.cart";

export type CartItem = {
  id: number;
  name: string;
  kind: string;
  tools: number;
  pricePerCall: number;
};

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    // 손상된 값이면 조용히 비운다. 장바구니 때문에 화면 전체가 죽는 건 과하다.
    return [];
  }
}

/** 같은 탭의 다른 컴포넌트들이 함께 갱신되도록 하는 신호. */
const EVENT = "mcp-studio.cart-changed";

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(read);

  useEffect(() => {
    const sync = () => setItems(read());
    // storage 는 다른 탭, EVENT 는 같은 탭. 마켓 목록과 하단 장바구니 바가
    // 서로 다른 컴포넌트라 같은 탭 신호가 반드시 필요하다.
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const add = useCallback((item: CartItem) => {
    const next = read();
    if (next.some((i) => i.id === item.id)) return;
    write([...next, item]);
  }, []);

  const remove = useCallback((id: number) => {
    write(read().filter((i) => i.id !== id));
  }, []);

  const toggle = useCallback((item: CartItem) => {
    const next = read();
    write(next.some((i) => i.id === item.id)
      ? next.filter((i) => i.id !== item.id)
      : [...next, item]);
  }, []);

  const clear = useCallback(() => write([]), []);

  const has = useCallback((id: number) => items.some((i) => i.id === id), [items]);

  // 담는 순간 비용을 보여주기 위한 합계. 결제 직전이 아니라 여기서 알려야
  // "모르고 썼는데 청구서가 왔다"가 생기지 않는다.
  const tools = items.reduce((n, i) => n + i.tools, 0);
  const paid = items.filter((i) => i.pricePerCall > 0);

  return { items, add, remove, toggle, clear, has, tools, paid };
}

import { useState } from 'react';

/** 층이 포털로 덮을 상자(container)를 ref 콜백으로 붙잡는다. `[box, setBox]` — `ref={setBox}` */
export function useBox() {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return [box, setBox] as const;
}

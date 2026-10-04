/** 바닥 판정 오차(px) */
const BOTTOM_EPS = 1;

type ScrollBox = { scrollTop: number; scrollHeight: number; clientHeight: number };

/** 바닥(오차 BOTTOM_EPS)이거나 스크롤이 없으면 true */
export const isAtBottom = ({ scrollTop, scrollHeight, clientHeight }: ScrollBox) =>
  scrollHeight - scrollTop - clientHeight <= BOTTOM_EPS;

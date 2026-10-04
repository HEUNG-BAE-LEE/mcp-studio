// 알림 수 표시 글 — 좁은 자리(CountDot 16 pill · LNB 접힘 레일 26 상자)에 들어가게 99에서 자른다. 읽기 이름(aria-label)은 실제 수를 쓴다
const MAX_SHOWN = 99;

/** 7 → `7`, 120 → `99+` */
export const cappedCount = (count: number) => (count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count));

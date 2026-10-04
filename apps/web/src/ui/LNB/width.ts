// LNB 폭(px)의 유일한 원본 — 펼침 기본 · 접힘 · 드래그 최소 · 최대. CSS 토큰을 두지 않는다: LNB는 인라인 style로, 알림 패널 기본 위치(ui/AlertPanel)와 app/store가 이 값을 쓴다
export const LNB_WIDTH = { default: 240, collapsed: 48, min: 180, max: 400 } as const;

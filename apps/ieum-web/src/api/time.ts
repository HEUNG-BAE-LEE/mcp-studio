// 서버 시각 단위 맞추기(D14 · R27). 서버는 epoch 초(float)로 주고, 앱 안에서는 epoch ms로 쓴다.
// 훅의 select에서 한 번만 바꾼다 — 화면 · copy는 늘 ms를 받는다(표시 서식은 DESIGN Copy 절). 소요 시간은 서버도 ms라 바꾸지 않는다
const MS_PER_SEC = 1000;

/** epoch 초 → epoch ms. 값이 없으면(null · undefined) 그대로 돌려준다 */
export function secToMs(sec: number): number;
export function secToMs(sec: number | null): number | null;
export function secToMs(sec: number | undefined): number | undefined;
export function secToMs(sec: number | null | undefined): number | null | undefined {
  return sec == null ? sec : Math.round(sec * MS_PER_SEC);
}

// 서버 시각 단위 맞추기. 서버는 epoch 초(float)로 주고, 앱 안에서는 epoch ms로 쓴다.
// 훅의 select에서 한 번만 바꾼다 — 화면 · copy는 늘 ms를 받는다(표시 서식은 DESIGN Copy 절). 소요 시간은 서버도 ms라 바꾸지 않는다
/** 1초의 ms — 단위를 바꾸는 곳(api/discoveryJob · copy/discovery)도 이 값을 쓴다 */
export const MS_PER_SEC = 1000;

/**
 * epoch 초 → epoch ms. 값이 없으면(null · undefined) 그대로 돌려준다.
 * 1ms 아래는 버린다 — 옛 콘솔의 new Date(ts * 1000)이 그렇게 해서, 초 끝자락의 시각이 다음 초로 올라가지 않게 같게 맞춘다
 */
export function secToMs(sec: number): number;
export function secToMs(sec: number | null): number | null;
export function secToMs(sec: number | undefined): number | undefined;
export function secToMs(sec: number | null | undefined): number | null | undefined {
  return sec == null ? sec : Math.trunc(sec * MS_PER_SEC);
}

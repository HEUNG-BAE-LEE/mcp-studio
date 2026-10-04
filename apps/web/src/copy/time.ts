// apps/web/src/copy/time.ts — 시각 서식은 여기 한 곳. 모두 브라우저 로컬 시각 기준
//   dateTimeLabel      YYYY-MM-DD HH:MM   상세 · 설정
//   dateLabel          YYYY-MM-DD         날짜만 보이는 메타(생성일 · 업데이트)
//   shortDateTimeLabel MM-DD HH:MM        목록 · 표
//   clockLabel         HH:MM:SS           로그 · 실시간만
//   dayRangeLabel      YYYY-MM-DD – YYYY-MM-DD  기간(날짜만 온 값 두 개)
//   durationLabel      n초 / n분 n초 / n시간 n분
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_DAY = 86_400_000;

export const pad2 = (v: number) => String(v).padStart(2, '0');
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
/** `2026-09-10` — 날짜만 보이는 메타(PageHeader `meta` 생성일 · 업데이트) */
export const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
export const mmdd = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** `2026-09-10 03:00` — 상세 · 설정 */
export const dateTimeLabel = (iso: string) => `${dateLabel(iso)} ${hhmm(iso)}`;
/** `09-10 03:00` — 목록 · 표 */
export const shortDateTimeLabel = (iso: string) => `${mmdd(iso)} ${hhmm(iso)}`;
/** `03:00:02` — 로그 · 실시간만 */
export const clockLabel = (iso: string) => `${hhmm(iso)}:${pad2(new Date(iso).getSeconds())}`;
/** `2026-09-05 – 2026-09-11` — 날짜만(`YYYY-MM-DD`) 오는 기간(en dash, 같은 해도 연도 생략 안 함). `new Date`를 거치지 않아 시간대에 밀리지 않는다 */
export const dayRangeLabel = (from: string, to: string) => `${from} – ${to}`;

/** 144000 → `2분 24초` · 45000 → `45초` · 3,900,000 → `1시간 5분`. 음수 · NaN은 0초 */
export function durationLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / MS_PER_SECOND)) || 0;
  if (totalSeconds < SECONDS_PER_MINUTE) return `${totalSeconds}초`;
  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  if (totalMinutes < MINUTES_PER_HOUR) {
    return `${totalMinutes}분 ${totalSeconds % SECONDS_PER_MINUTE}초`;
  }
  return `${Math.floor(totalMinutes / MINUTES_PER_HOUR)}시간 ${totalMinutes % MINUTES_PER_HOUR}분`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
/** `오늘 03:00` · `어제 23:10` · 그 전은 `09-05 08:00` */
export function relativeDayTime(iso: string, now: Date): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return `오늘 ${hhmm(iso)}`;
  if (sameDay(d, new Date(now.getTime() - MS_PER_DAY))) return `어제 ${hhmm(iso)}`;
  return shortDateTimeLabel(iso);
}

// apps/web/src/api/dummy/data/seed.ts — 시드 공용 헬퍼. 새 시드는 여기 헬퍼를 쓴다(파일마다 다시 만들지 않는다)
import type { Notification } from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type Subject = Notification['subjects'][number];
/** 알림 대상 소스 · 커넥터 */
export const src = (id: string, name: string): Subject => ({ kind: 'source', id, name });
export const con = (id: string, name: string): Subject => ({ kind: 'connector', id, name });

/** 'YYYY-MM-DD' + 'HH:mm:ss'(로컬) → ISO. 화면(copy/time)이 로컬 시각으로 되돌리므로 어느 시간대에서도 글자가 같다 */
export const localIso = (date: string, time: string) => {
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number);
  const [h = 0, mi = 0, s = 0] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
};
/** 오늘 로컬 시각 HH:mm → ISO. 화면 틀이 로컬 시각으로 "11:20" · "오늘 03:00"을 그린다 */
export const todayAt = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
/** 지금에서 days일 뒤(음수는 앞) ISO */
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

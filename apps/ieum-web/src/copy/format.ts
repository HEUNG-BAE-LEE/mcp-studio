// 값 없음 표기와 숫자 · 시각 서식. 모든 메뉴가 쓴다 — 서식 직접 호출(toLocale* · Intl)과 값 없음 표기 리터럴은 copy/ 밖에서 막힌다(lint:source)
// 규칙은 docs/DESIGN.md Copy `값 없음` · `서식`이다. 모양은 옛 출력 그대로다

/** 숫자 · 시간 · 짧은 칸의 값 없음. 단위를 붙이지 않는다(`—ms` 없음) */
export const NONE = '—';

/** 사유를 아는 자리의 값 없음 — 이음 지금 문구 그대로 */
export const NONE_REASON = Object.freeze({
  /** 로그 상세 원본 응답 시간 — 원본을 부르기 전에 끝난 호출(js/menu/logs.js:42) */
  beforeCall: '호출 전',
  /** 대시보드 전일 대비 — 전일 기록이 없다(js/menu/dashboard.js:12) */
  noPrevDay: '전일 기록 없음',
  /** 대시보드 평균 변환 시간 보조 문구 — 마침표 없음(js/menu/dashboard.js:14) */
  noCallsYet: '아직 호출 기록이 없습니다',
  /** 로그 표 · 상세 — 호출 뒤 지워진 도구의 원본 이름 자리(js/menu/logs.js:13) */
  deletedTool: '삭제된 도구',
} as const);

const NUMBER_LOCALE = 'ko-KR';
const TWO_DIGITS = 2;

/** 천 단위 쉼표(옛 js/common/util.js:6 `fmt`) */
export const fmtNum = (n: number): string => n.toLocaleString(NUMBER_LOCALE);

const plain = (n: number): string => String(n);

/**
 * 값이 없으면(null · undefined) `NONE`만, 아니면 서식한 값 + 단위. 0은 값이다.
 * 서식을 주지 않으면 원값 그대로(옛 화면이 `fmt`를 쓰지 않는 칸 — 성공률 · 변환 ms)
 */
export const orNone = (value: number | null | undefined, unit = '', format: (n: number) => string = plain): string =>
  value == null ? NONE : `${format(value)}${unit}`;

/** 두 자리로 앞을 0으로 채운다 — 시각 서식(copy/discovery도 쓴다) */
export const pad2 = (n: number): string => String(n).padStart(TWO_DIGITS, '0');

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * 호출 로그 시각 — 브라우저 지역 시각으로 오늘이면 `HH:mm:ss`, 아니면 `MM-DD HH:mm:ss`(옛 js/menu/logs.js:4-5 `fmtTs`).
 * 입력은 둘 다 epoch ms다(훅이 서버 초를 바꾼 값). now를 받아 한 번 그릴 때 같은 기준으로 가른다
 */
export function fmtLogTs(ms: number, now: number): string {
  const at = new Date(ms);
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`;
  if (isSameLocalDay(at, new Date(now))) return time;
  return `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${time}`;
}

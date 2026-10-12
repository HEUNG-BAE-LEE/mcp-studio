import { DEFAULT_ICON_NAME, isIconName, type IconName } from './names';

// 이미 경고한 값 — 같은 모르는 값은 한 번만 알린다(렌더마다 콘솔이 넘치지 않게)
const warnedValues = new Set<string>();

/**
 * 서버가 내는 문자열(ic 등)을 아이콘 이름으로 바꾼다. 아는 이름이면 그대로, 모르면 기본 아이콘.
 * 이음 원본은 모르는 이름이면 빈 svg를 그렸다(util.js svg()) — 여기서는 기본 아이콘으로 떨어뜨리고 개발 콘솔에 한 번 알린다
 */
export function iconOf(value: string): IconName {
  if (isIconName(value)) return value;
  if (import.meta.env.DEV && !warnedValues.has(value)) {
    warnedValues.add(value);
    console.warn(`모르는 아이콘 이름 "${value}" — 기본 아이콘(${DEFAULT_ICON_NAME})으로 그립니다`);
  }
  return DEFAULT_ICON_NAME;
}

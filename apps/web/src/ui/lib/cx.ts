type ClassValue = string | false | null | undefined;

/** 참인 클래스 이름만 공백으로 잇는다. 아무것도 없으면 undefined(속성을 내지 않는다). */
export function cx(...values: ClassValue[]): string | undefined {
  const joined = values.filter((v): v is string => typeof v === 'string' && v.length > 0).join(' ');
  return joined.length > 0 ? joined : undefined;
}

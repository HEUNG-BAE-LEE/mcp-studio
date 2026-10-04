// apps/web/src/api/errors.ts — 데이터 계층(api/dummy)이 던지는 오류 하나. 화면 · copy는 code로 문장을 고른다
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields?: Readonly<Record<string, string>>,
    readonly raw?: string,
    /** 서버가 영향받은 값을 이름으로 알려 주는 자리(문구 틀이 쓴다) */
    readonly subjects?: readonly string[],
  ) {
    super(`${code} (${status})`);
    this.name = 'ApiError';
  }
}

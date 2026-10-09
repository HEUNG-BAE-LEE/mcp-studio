// 데이터 층이 던지는 오류 하나. message가 화면에 보이는 문장이다 — 봉투 실패의 서버 resultMsg 그대로(서버 문장을 그대로 보이는 것을 허용한다),
// 없거나 비었거나 봉투가 아니면 copy/errors의 고정 문구다(client.ts)
// tsconfig erasableSyntaxOnly라 생성자 매개변수 속성 대신 필드를 직접 적는다
export const NETWORK_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  /** 응답 본문 원문(FastAPI {detail} · text/plain 영문 포함). 화면에 내지 않는다 — 실패 상자는 message를 보인다 */
  readonly raw?: string;

  constructor(status: number, message: string, raw?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.raw = raw;
  }
}

// 데이터 층이 던지는 오류 하나. message가 화면에 보이는 문장이다 — 봉투 실패의 서버 resultMsg 그대로(서버 문장 렌더 허용 — 설계 결정),
// 없거나 비었거나 봉투가 아니면 copy/errors의 고정 문구다(client.ts, D11 Q7)
// tsconfig erasableSyntaxOnly라 생성자 매개변수 속성 대신 필드를 직접 적는다(T2A.1 Step 3)
export const NETWORK_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  /** 응답 본문 원문(FastAPI {detail} · text/plain 영문 포함). 화면에 내지 않는다 — 실패 상자는 message를 보인다(설계 3절 데이터 층) */
  readonly raw?: string;

  constructor(status: number, message: string, raw?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.raw = raw;
  }
}

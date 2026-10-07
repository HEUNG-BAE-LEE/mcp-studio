// 데이터 층이 던지는 오류 하나. message는 서버 resultMsg가 있으면 그대로(서버 문장 렌더 허용 — 설계 결정),
// 없거나 비면 copy/errors의 고정 문구다(client.ts)
// tsconfig erasableSyntaxOnly라 생성자 매개변수 속성 대신 필드를 직접 적는다(T2A.1 Step 3)
export const NETWORK_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  /** 응답 본문 원문(실패 블록 원문 자리 — 무엇을 보일지는 핵심 규칙 8) */
  readonly raw?: string;

  constructor(status: number, message: string, raw?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.raw = raw;
  }
}

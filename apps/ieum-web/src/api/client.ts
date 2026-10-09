// /api/ieum 호출 한 곳. 봉투 {resultCode, resultMsg, resultData}를 풀고 실패는 ApiError로 던진다
// 경로는 백엔드 라우터 그대로(끝 슬래시 포함) — 빠지면 307로 출처가 바뀐다
// 실패 문구(옛 js/common/api.js:14): 봉투 실패는 resultMsg 그대로, 비었거나 봉투가 아니면({detail} 포함) statusFailed.
// 서버 detail · 본문 원문은 화면 문구로 쓰지 않는다(영문이 화면에 나오지 않게 — 원문은 ApiError.raw에만)
import { NETWORK_FAILED, statusFailed } from '../copy/errors';
import { ApiError, NETWORK_STATUS } from './errors';
import { scenarioData, scenarioDelay, scenarioFailure } from './scenario';

/** 백엔드 이음 API 뿌리. fetch를 거치지 않는 주소(탐색 캡처 `<img src>` — app/discovery/shotUrl)도 이 값으로 만든다 */
export const API_ROOT = '/api/ieum';
const HTTP_ERROR_FROM = 400;
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
// resultMsg는 서버가 무엇을 보낼지 모르므로 unknown으로 받고 쓸 때 좁힌다
type Envelope = { resultCode: number; resultMsg: unknown; resultData: unknown };
export type RequestOptions = Readonly<{ region?: boolean; signal?: AbortSignal }>;

const isEnvelope = (v: unknown): v is Envelope =>
  typeof v === 'object' && v !== null && 'resultCode' in v && 'resultMsg' in v;
// 비었거나 문자열이 아닌 resultMsg는 서버 문장으로 보지 않는다 — 옛 콘솔 api.js:14도 상태 코드 문구로 대신했다
const serverMessage = (json: unknown): string | null =>
  isEnvelope(json) && typeof json.resultMsg === 'string' && json.resultMsg.trim() !== '' ? json.resultMsg : null;

const parseJson = (text: string): unknown => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

/** 실패 응답 하나를 ApiError로. 실제 응답과 ?mock 실패 시나리오가 같은 길을 지난다 */
const failureOf = (status: number, text: string, json: unknown = parseJson(text)): ApiError =>
  new ApiError(status, serverMessage(json) ?? statusFailed(status), text);

// fetch 예외 · 본문 읽기 예외를 status 0 하나로 모은다(원문은 콘솔에만). 중단(AbortError)은 부른 쪽이 알도록 그대로 돌려준다
const toNetworkError = (error: unknown, context: string): unknown => {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  console.warn(`[api] ${context}`, error);
  return new ApiError(NETWORK_STATUS, NETWORK_FAILED);
};

async function readText(res: Response, label: string): Promise<string> {
  try {
    return await res.text();
  } catch (error) {
    throw toNetworkError(error, `body read failure ${label}`);
  }
}

export async function request<T>(method: Method, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  if (import.meta.env.DEV) {
    await scenarioDelay();
    const failure = scenarioFailure({ method, path, region: options.region });
    if (failure) throw failureOf(failure.status, failure.body);
  }
  const label = `${method} ${path}`;
  let res: Response;
  try {
    res = await fetch(API_ROOT + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    throw toNetworkError(error, `network failure ${label}`);
  }
  const text = await readText(res, label);
  const json = parseJson(text);
  // 성공은 HTTP 2xx이면서 봉투(resultCode · resultMsg)이고 resultCode가 400 미만일 때만. 옛 api.js:14보다 엄하다 — 옛은 JSON이 아니거나
  // resultCode ≥ 400일 때만 실패로 봐 봉투가 아닌 200 JSON을 성공(데이터 없음)으로 넘겼다. /api/ieum은 모두 봉투라(responses.py) 지금은 닿지 않는다
  if (!res.ok || !isEnvelope(json) || json.resultCode >= HTTP_ERROR_FROM) throw failureOf(res.status, text, json);
  const data = json.resultData as T;
  return import.meta.env.DEV ? (scenarioData(method, path, data) as T) : data;
}

// POST는 본문이 없어도 {}와 JSON 헤더를 보낸다 — 옛 api.js:18(api.post = (p, b = {})). PUT은 옛처럼 기본값이 없다
export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body: unknown = {}, options?: RequestOptions) => request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
  del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
};

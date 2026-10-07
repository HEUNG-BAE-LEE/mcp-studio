// /api/ieum 호출 한 곳. 봉투 {resultCode, resultMsg, resultData}를 풀고 실패는 ApiError로 던진다
// 경로는 백엔드 라우터 그대로(끝 슬래시 포함) — 빠지면 307로 출처가 바뀐다
import { NETWORK_FAILED, UNEXPECTED_RESPONSE, statusFailed } from '../copy/errors';
import { ApiError, NETWORK_STATUS } from './errors';
import { emptyOf, scenarioDelay, scenarioFailure } from './scenario';

const API_ROOT = '/api/ieum';
const HTTP_ERROR_FROM = 400;
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
// resultMsg는 서버가 무엇을 보낼지 모르므로 unknown으로 받고 쓸 때 좁힌다
type Envelope = { resultCode: number; resultMsg: unknown; resultData: unknown };
export type RequestOptions = Readonly<{ region?: boolean; signal?: AbortSignal }>;

const isEnvelope = (v: unknown): v is Envelope =>
  typeof v === 'object' && v !== null && 'resultCode' in v && 'resultMsg' in v;
const detailText = (v: unknown): string | null =>
  typeof v === 'object' && v !== null && 'detail' in v && typeof v.detail === 'string' ? v.detail : null;
// 비었거나 문자열이 아닌 resultMsg는 서버 문장으로 보지 않는다 — 옛 콘솔 api.js:14도 상태 코드 문구로 대신했다
const serverMessage = (json: Envelope): string | null =>
  typeof json.resultMsg === 'string' && json.resultMsg.trim() !== '' ? json.resultMsg : null;

// fetch 예외 · 본문 읽기 예외를 status 0 하나로 모은다(원문은 콘솔에만). 중단(AbortError)은 부른 쪽이 알도록 그대로 돌려준다
const toNetworkError = (error: unknown, context: string): unknown => {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  console.warn(`[api] ${context}`, error);
  return new ApiError(NETWORK_STATUS, NETWORK_FAILED);
};

async function readBody(res: Response, label: string): Promise<{ text: string; json: unknown }> {
  let text: string;
  try {
    text = await res.text();
  } catch (error) {
    throw toNetworkError(error, `body read failure ${label}`);
  }
  try {
    return { text, json: text ? JSON.parse(text) : null };
  } catch {
    return { text, json: null };
  }
}

export async function request<T>(method: Method, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  if (import.meta.env.DEV) {
    await scenarioDelay();
    const failure = scenarioFailure({ method, path, region: options.region });
    if (failure) throw new ApiError(failure.status, failure.message, failure.raw);
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
  const { text, json } = await readBody(res, label);
  if (isEnvelope(json)) {
    if (res.ok && json.resultCode < HTTP_ERROR_FROM) {
      const data = json.resultData as T;
      return import.meta.env.DEV ? (emptyOf(method, path, data) as T) : data;
    }
    throw new ApiError(res.status, serverMessage(json) ?? statusFailed(res.status), text);
  }
  if (res.ok) throw new ApiError(res.status, UNEXPECTED_RESPONSE, text);
  throw new ApiError(res.status, detailText(json) ?? statusFailed(res.status), text);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
  del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
};

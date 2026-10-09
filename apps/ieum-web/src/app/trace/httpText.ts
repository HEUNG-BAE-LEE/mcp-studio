// 원본 요청 · 응답을 HTTP 글로 — 요청 줄(상태 줄) · 헤더 줄 · 빈 줄 · 본문(옛 httpReq · httpResp — js/common/convert.js:162-163)
import type { OriginRequest, OriginResponse } from '../../api/types';
import type { TraceCode } from './types';

const HEAD_BODY_GAP = '\n\n';
const XML_START = '<';

const headerLines = (headers: Readonly<Record<string, string>> | null | undefined): string =>
  Object.entries(headers || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

// 본문이 빈 글이면 빈 줄도 붙이지 않는다
const withBody = (head: string, body: string | null | undefined): string => (body ? `${head}${HEAD_BODY_GAP}${body}` : head);

/** http 글의 본문 언어 — 처음 나오는 빈 줄 뒤가 본문이다(옛 hlHTTP — convert.js:149-157) */
const bodyLangOf = (text: string): TraceCode['bodyLang'] => {
  const gap = text.indexOf(HEAD_BODY_GAP);
  const body = gap < 0 ? '' : text.slice(gap + HEAD_BODY_GAP.length);
  if (!body) return undefined;
  return body.trim().startsWith(XML_START) ? 'xml' : 'json';
};

/** HTTP 글을 코드 상자 데이터로. 스튜디오 미리보기가 만든 HTTP 글에도 쓴다 */
export const httpCode = (text: string): TraceCode => {
  const bodyLang = bodyLangOf(text);
  return bodyLang ? { text, lang: 'http', bodyLang } : { text, lang: 'http' };
};

/** 실제로 보낸 원본 요청 */
export const httpRequestText = (req: OriginRequest): string =>
  withBody(`${req.method} ${req.url} HTTP/1.1\n${headerLines(req.headers)}`, req.body);

/** 원본이 돌려준 응답 */
export const httpResponseText = (res: OriginResponse): string =>
  withBody(`HTTP/1.1 ${res.status}\n${headerLines(res.headers)}`, res.body);

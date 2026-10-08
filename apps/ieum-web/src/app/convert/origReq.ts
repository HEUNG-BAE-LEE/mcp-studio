// 미리보기 "원본 요청" — 예시 값(ex)으로 만든 HTTP 글. 옛 origReq(js/common/convert.js:41-77) 출력과 글자 단위로 같다:
// SOAP은 엔벨로프(값을 XML 이스케이프하지 않음), 공공데이터는 쿼리를 줄마다(인코딩 안 함), 그 밖은 경로 치환 · GET 쿼리(인코딩) ·
// JSON 본문 · 프로토콜별 가린 인증 줄. ex가 없으면 "undefined" 글자가 그대로 들어간다(옛 템플릿 동작)
import type { Source, ToolParam, ToolRecord } from '../../api/types';
import { SOAP_SIGN_COMMENT } from '../../copy/convert';
import { hostOf, pathOf } from './url';

/** 생성기가 읽는 원본 값 — 프로토콜 · 서버 주소 · SOAP 네임스페이스 */
export type PreviewSource = Pick<Source, 'proto' | 'base' | 'ns'>;

type ReqSource = Pick<ToolRecord, 'method' | 'path' | 'op' | 'params'>;

const TRAILING_SLASH = /\/$/;
const MASKED = '••••••••';
const BEARER_LINE = `Authorization: Bearer ${MASKED}`;
/** 프로토콜별 가린 인증 줄 — 표에 없으면 Bearer(convert.js:71) */
const AUTH_LINE: Readonly<Record<string, string>> = Object.freeze({
  sample: `X-API-KEY: ${MASKED}`,
  disc: `Cookie: JSESSIONID=${MASKED}`,
});

const authLineOf = (proto: string): string => (Object.hasOwn(AUTH_LINE, proto) ? (AUTH_LINE[proto] ?? BEARER_LINE) : BEARER_LINE);

function soapRequest(tool: ReqSource, source: PreviewSource, params: readonly ToolParam[]): string {
  return `POST ${pathOf(source.base)} HTTP/1.1
Host: ${hostOf(source.base)}
Content-Type: text/xml; charset=UTF-8
SOAPAction: "urn:${tool.op}"

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hr="${source.ns}">
  <soapenv:Header>
    <wsse:Security><!-- ${SOAP_SIGN_COMMENT} --></wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <hr:${tool.op}>
${params.map((p) => `      <hr:${p.o}>${p.ex}</hr:${p.o}>`).join('\n')}
    </hr:${tool.op}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function govRequest(tool: ReqSource, source: PreviewSource, params: readonly ToolParam[]): string {
  return `GET ${pathOf(source.base)}/${tool.op}
  ?${params.map((p) => `${p.o}=${p.ex}`).join('\n  &')} HTTP/1.1
Host: ${hostOf(source.base)}`;
}

type RestParts = Readonly<{ path: string | undefined; query: readonly string[]; body: Readonly<Record<string, unknown>> }>;

/** 파라미터마다 경로 자리 `{o}`를 처음 하나 바꾸고, 자리가 없으면 GET은 쿼리, 그 밖은 본문으로(convert.js:66-70) */
const restParts = (tool: ReqSource, params: readonly ToolParam[]): RestParts =>
  params.reduce<RestParts>(
    (acc, p) => {
      const slot = `{${p.o}}`;
      if (acc.path?.includes(slot)) return { ...acc, path: acc.path.replace(slot, String(p.ex)) };
      if (tool.method === 'GET') return { ...acc, query: [...acc.query, `${p.o}=${encodeURIComponent(String(p.ex))}`] };
      return { ...acc, body: { ...acc.body, [p.o]: p.ex } };
    },
    { path: tool.path, query: [], body: {} },
  );

function restRequest(tool: ReqSource, source: PreviewSource, params: readonly ToolParam[]): string {
  const { path, query, body } = restParts(tool, params);
  const queryText = query.length > 0 ? `?${query.join('&')}` : '';
  const head = `${tool.method} ${pathOf(source.base).replace(TRAILING_SLASH, '')}${path}${queryText} HTTP/1.1
Host: ${hostOf(source.base)}
${authLineOf(source.proto)}`;
  return tool.method === 'GET' ? head : `${head}\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}`;
}

export function origReq(tool: ReqSource, source: PreviewSource): string {
  // 원본 필드 이름이 있는 파라미터만 보낸다
  const params = tool.params.filter((p) => p.o);
  if (source.proto === 'soap') return soapRequest(tool, source, params);
  if (source.proto === 'gov') return govRequest(tool, source, params);
  return restRequest(tool, source, params);
}

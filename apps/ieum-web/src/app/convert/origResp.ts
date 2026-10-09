// 미리보기 "응답 변환"의 원본 응답 — 응답 매핑의 원본 예시 값(ov)으로 만든 HTTP 글. 옛 origResp(js/common/convert.js:78-117)와 글자 단위로 같다:
// SOAP은 RSLT_CD 행이 없으면 0000을 앞에 채우고, 공공데이터는 resXml이 있으면 그대로 · 없으면 category 항목형 + 일반 항목형 XML,
// 그 밖은 원본 경로(drift면 새 필드 newO)로 조립한 JSON
import type { ToolRecord, ToolResField } from '../../api/types';
import type { PreviewSource } from './origReq';
import { setPath } from './setPath';

type RespSource = Pick<ToolRecord, 'op' | 'res' | 'resXml' | 'valKey'>;

const RESULT_CODE_FIELD = 'RSLT_CD';
const RESULT_CODE_ROW = `      <hr:${RESULT_CODE_FIELD}>0000</hr:${RESULT_CODE_FIELD}>`;
/** 일반 항목형으로 넣을 수 있는 원본 이름(점 · 배열 표시 없는 한 단어) */
const PLAIN_NAME = /^[\w]+$/;

function soapResponse(tool: RespSource, source: PreviewSource): string {
  const hasResultCode = tool.res.some((r) => r.o === RESULT_CODE_FIELD);
  const rows = [
    ...(hasResultCode ? [] : [RESULT_CODE_ROW]),
    ...tool.res.map((r) => `      <hr:${r.o}>${r.ov}</hr:${r.o}>`),
  ];
  return `HTTP/1.1 200 OK
Content-Type: text/xml; charset=UTF-8

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hr="${source.ns}">
  <soapenv:Body>
    <hr:${tool.op}Response>
${rows.join('\n')}
    </hr:${tool.op}Response>
  </soapenv:Body>
</soapenv:Envelope>`;
}

const plainItem = (plain: readonly ToolResField[]): string =>
  `      <item>\n${plain.map((r) => `        <${r.o}>${r.ov}</${r.o}>`).join('\n')}\n      </item>`;

function govItemsBody(tool: RespSource): string {
  const categories = tool.res.filter((r) => r.cat);
  const plain = tool.res.filter((r) => !r.cat && PLAIN_NAME.test(r.o));
  const items = [
    ...categories.map(
      (r) => `      <item><category>${r.cat}</category><${tool.valKey}>${r.ov}</${tool.valKey}></item>`,
    ),
    ...(plain.length > 0 ? [plainItem(plain)] : []),
  ];
  return `<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL_SERVICE</resultMsg>
  </header>
  <body>
    <items>
${items.join('\n')}
    </items>
  </body>
</response>`;
}

const govResponse = (tool: RespSource): string =>
  `HTTP/1.1 200 OK\nContent-Type: application/xml; charset=UTF-8\n\n${tool.resXml || govItemsBody(tool)}`;

function jsonResponse(tool: RespSource): string {
  const body = tool.res.reduce((acc, r) => setPath(acc, r.newO || r.o, r.ov), {});
  return `HTTP/1.1 200 OK\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}`;
}

export function origResp(tool: RespSource, source: PreviewSource): string {
  if (source.proto === 'soap') return soapResponse(tool, source);
  if (source.proto === 'gov') return govResponse(tool);
  return jsonResponse(tool);
}

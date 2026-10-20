// 미리보기 "MCP 도구 정의" — 옛 mcpDef(js/common/convert.js:12-28)와 같은 키 · 같은 순서로 만든다(JSON 글자가 같아야 한다).
// 서버가 실제로 내는 tools/list와 다른 점(_meta 확인 표시 · at 쪼개기 등)도 옛 화면 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
import type { Scalar, ToolParam, ToolRecord } from '../../api/types';
import { GEO_EXAMPLE } from '../../copy/convert';
import { visibleParams } from './visibleParams';

/** 입력 스키마의 속성 하나. description은 설명이 없으면(undefined) JSON에서 빠지고 빈 문자열은 그대로 남는다 */
export type McpProperty = Readonly<{
  type: string;
  description: string | undefined;
  format?: string;
  enum?: readonly Scalar[];
  examples?: readonly string[];
}>;

export type McpToolDef = Readonly<{
  name: string;
  title: string;
  description: string;
  inputSchema: Readonly<{
    type: 'object';
    properties: Readonly<Record<string, McpProperty>>;
    required: readonly string[];
  }>;
  annotations: Readonly<{ readOnlyHint: boolean; destructiveHint?: boolean }>;
  _meta?: Readonly<Record<string, string>>;
}>;

type DefSource = Pick<ToolRecord, 'id' | 'title' | 'desc' | 'mode' | 'destructive' | 'exec' | 'params'>;

/** "string (date)"처럼 형식이 붙은 타입은 공백 앞이 type, 뒤의 괄호를 뗀 것이 format이다 */
const FORMAT_WRAP = /[()]/g;
const CONFIRM_META: Readonly<Record<string, string>> = Object.freeze({ 'ieum/approval': 'user_confirm' });

/** 코드표가 있으면 코드표의 AI값(불리언 · 숫자 그대로), 없으면 파라미터의 enum */
const enumOf = (p: ToolParam): Pick<McpProperty, 'enum'> => {
  if (p.codes && p.codes.length > 0) return { enum: p.codes.map((c) => c[1]) };
  return p.enum ? { enum: p.enum } : {};
};

function propertyOf(p: ToolParam): McpProperty {
  const [type = '', format] = p.at.split(' ');
  return {
    type,
    description: p.d,
    ...(format ? { format: format.replace(FORMAT_WRAP, '') } : {}),
    ...enumOf(p),
    ...(p.rule === 'geo' ? { examples: [GEO_EXAMPLE] } : {}),
  };
}

export function mcpDef(tool: DefSource): McpToolDef {
  const params = visibleParams(tool);
  const readOnlyHint = tool.mode === 'read';
  return {
    name: tool.id,
    title: tool.title,
    description: tool.desc,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(params.map((p) => [p.a, propertyOf(p)])),
      required: params.filter((p) => p.req).map((p) => p.a),
    },
    annotations: tool.mode === 'write' ? { readOnlyHint, destructiveHint: Boolean(tool.destructive) } : { readOnlyHint },
    ...(tool.exec === 'confirm' ? { _meta: CONFIRM_META } : {}),
  };
}

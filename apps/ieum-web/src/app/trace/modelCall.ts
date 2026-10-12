// 변환 과정 1단계 · 스튜디오 미리보기의 "AI가 보낸 도구 호출" — 모델마다 형식이 다르다(옛 js/common/convert.js:124-129).
// id 값은 화면 예시용 고정값이다(옛 그대로)

type Args = Readonly<Record<string, unknown>>;

const CLAUDE_TOOL_USE_ID = 'toolu_01HvQ3kT7mR2xPzN';
const GPT_CALL_ID = 'call_Zp81fLx0qW';
const MCP_REQUEST_ID = 42;

/** 형식을 아는 모델. 그 밖(mcp · 모르는 클라이언트)은 MCP JSON-RPC 형식이다 */
type FormatModel = 'claude' | 'gemini' | 'gpt';

const FORMATS: Readonly<Record<FormatModel, (name: string, args: Args) => unknown>> = Object.freeze({
  claude: (name, args) => ({ type: 'tool_use', id: CLAUDE_TOOL_USE_ID, name, input: args }),
  gemini: (name, args) => ({ functionCall: { name, args } }),
  gpt: (name, args) => ({
    tool_calls: [{ id: GPT_CALL_ID, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
  }),
});

const mcpCall = (name: string, args: Args) => ({ jsonrpc: '2.0', id: MCP_REQUEST_ID, method: 'tools/call', params: { name, arguments: args } });

const isFormatModel = (client: string): client is FormatModel => Object.hasOwn(FORMATS, client);

/**
 * 클라이언트(모델 id)의 도구 호출 형식. 형식은 이 함수가 아는 키로만 고른다 — 모델 목록 조회가 실패해도 claude 로그는 claude 형식이다.
 * 옛은 모델 목록에 없는 클라이언트를 mcp로 보냈다(convert.js:170). 서버 모델 목록(claude · gemini · gpt · mcp)이 있으면 결과가 같다
 */
export const modelCall = (client: string, name: string, args: Args): unknown =>
  isFormatModel(client) ? FORMATS[client](name, args) : mcpCall(name, args);

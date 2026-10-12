// "AI에 연결하기" 예시 — 클라이언트마다 안내 한 문장과 설정 글(옛 snippet — js/menu/deploy.js:31-44). 글자는 옛 출력과 같다:
// 설정 객체는 JSON 2칸 들여쓰기(옛 code(body) · 복사 data-text의 JSON.stringify(body, null, 2) :80-81), 기타 에이전트는 curl 명령(http 강조).
// 화면에 보이는 글과 복사하는 글이 같다(code.text). 안내 문장 · 자리표시는 copy/deploy, 객체 모양과 curl 줄은 여기(문구가 아니라 설정 파일 모양)
import type { Toolset } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import type { TraceCode } from '../trace/types';
import { endpointOf } from './toolsetView';

/** 탭 순서 그대로(옛 CLIENTS :3) */
export const SNIPPET_CLIENTS = ['claude', 'gemini', 'gpt', 'agent'] as const;
export type SnippetClient = (typeof SNIPPET_CLIENTS)[number];

export type ConnectSnippet = Readonly<{
  /** 예시 위 안내 한 문장 */
  note: string;
  /** 보이는 글 = 복사하는 글 */
  code: TraceCode;
}>;

type SnippetContext = Readonly<{ url: string; name: string; key: string }>;

const JSON_INDENT = 2;
/** MCP 서버에 도구 목록을 묻는 JSON-RPC 요청(옛 :43) */
const TOOLS_LIST_REQUEST = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

const jsonCode = (value: unknown): TraceCode => ({ text: JSON.stringify(value, null, JSON_INDENT), lang: 'json' });

const curlCode = ({ url, key }: SnippetContext): TraceCode => ({
  text: [
    `curl ${url} \\`,
    `  -H "Authorization: ${key}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '${JSON.stringify(TOOLS_LIST_REQUEST)}'`,
  ].join('\n'),
  lang: 'http',
});

// 객체 키 순서가 곧 출력 순서다 — 옛 객체 리터럴 순서 그대로 둔다
const BUILDERS: Readonly<Record<SnippetClient, (ctx: SnippetContext) => ConnectSnippet>> = {
  claude: ({ url, name, key }) => ({
    note: DEPLOY.snippet.note.claude,
    code: jsonCode({ mcpServers: { [name]: { type: 'http', url, headers: { Authorization: key } } } }),
  }),
  gemini: ({ url, name, key }) => ({
    note: DEPLOY.snippet.note.gemini,
    code: jsonCode({ mcpServers: { [name]: { httpUrl: url, headers: { Authorization: key } } } }),
  }),
  gpt: ({ url, name, key }) => ({
    note: DEPLOY.snippet.note.gpt,
    code: jsonCode({ type: 'mcp', server_label: name, server_url: url, headers: { Authorization: key } }),
  }),
  agent: (ctx) => ({ note: DEPLOY.snippet.note.agent, code: curlCode(ctx) }),
};

/** 그 클라이언트의 연결 예시. 주소가 아직 없으면(초안) 자리표시 주소, 키는 늘 자리표시다(발급한 키는 다시 볼 수 없다) */
export function connectSnippet(client: SnippetClient, toolset: Pick<Toolset, 'slug' | 'runtime'>): ConnectSnippet {
  return BUILDERS[client]({
    url: endpointOf(toolset) || DEPLOY.snippet.urlPlaceholder,
    name: DEPLOY.snippet.serverName(toolset.slug),
    key: DEPLOY.snippet.keyPlaceholder,
  });
}

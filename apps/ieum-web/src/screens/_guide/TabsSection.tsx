// 카탈로그 Tabs 절 — 클라이언트 탭 넷(탭마다 패널 내용이 바뀐다: 설명 줄 + 작은 버튼 + 코드 상자) · 항목마다 고른 모습 · 좁은 폭에서 넷이 한 줄.
// hover · 포커스 링(전역 링)은 직접 눌러 보고 Tab으로 닿아 본다 — 화살표 키 이동은 없다
import { useState } from 'react';
import { Button, CodeBlock, Tabs, type TabItem } from '../../ui';
import type { TraceCode } from '../../app/trace/types';
import catalog from './catalog.module.css';
import styles from './TabsSection.module.css';

const MCP_CONFIG = JSON.stringify(
  { mcpServers: { hr: { type: 'http', url: 'http://127.0.0.1:8101/mcp', headers: { Authorization: 'Bearer <액세스 키>' } } } },
  null,
  2,
);

type ClientSnippet = { value: string; label: string; note: string; code: TraceCode };

// 탭마다 설명 · 코드가 다르다(실제 화면은 서버 주소로 만든다 — 카탈로그는 모양만)
const SNIPPETS: readonly ClientSnippet[] = [
  { value: 'claude', label: 'Claude', note: 'Claude 설정의 MCP 서버 목록에 아래 내용을 넣습니다.', code: { text: MCP_CONFIG, lang: 'json' } },
  { value: 'gemini', label: 'Gemini', note: 'Gemini 설정 파일의 서버 항목에 아래 내용을 넣습니다.', code: { text: MCP_CONFIG, lang: 'json' } },
  { value: 'gpt', label: 'GPT', note: 'GPT 쪽 커넥터 설정에 아래 주소와 키를 넣습니다.', code: { text: MCP_CONFIG, lang: 'json' } },
  {
    value: 'agent',
    label: '기타 에이전트',
    note: '직접 호출하는 에이전트는 아래 요청을 그대로 보냅니다.',
    code: {
      text: 'POST /mcp HTTP/1.1\nHost: 127.0.0.1:8101\nAuthorization: Bearer <액세스 키>\nContent-Type: application/json',
      lang: 'http',
    },
  },
];

const CLIENTS: readonly TabItem[] = SNIPPETS.map(({ value, label }) => ({ value, label }));

// 쓰는 곳의 조합 예 — 설명 줄 + 작은 복사 버튼 + 코드 상자(코드 상자의 이름은 고른 탭 글자). 버튼은 모양만 보이는 것이라 누르면 아무 일도 하지 않는다
function SnippetPanel({ snippet }: { snippet: ClientSnippet }) {
  return (
    <>
      <div className={styles.head}>
        <p className={styles.headNote}>{snippet.note}</p>
        <Button size="sm" icon="copy">
          복사
        </Button>
      </div>
      <CodeBlock code={snippet.code} label={snippet.label} />
    </>
  );
}

function Connect() {
  const [client, setClient] = useState('claude');
  const snippet = SNIPPETS.find((item) => item.value === client);
  return (
    <Tabs items={CLIENTS} value={client} onValueChange={setClient}>
      {snippet ? <SnippetPanel snippet={snippet} /> : null}
    </Tabs>
  );
}

// 항목마다 고른 모습 — 고른 값을 고정해 늘어놓는다(눌러도 바뀌지 않는다)
function Pinned({ value }: { value: string }) {
  return (
    <Tabs items={CLIENTS} value={value} onValueChange={() => undefined}>
      <p className={styles.pinnedNote}>고른 탭 {value}</p>
    </Tabs>
  );
}

function Narrow() {
  const [client, setClient] = useState('agent');
  return (
    <div className={styles.narrow}>
      <Tabs items={CLIENTS} value={client} onValueChange={setClient}>
        <p className={styles.pinnedNote}>패널은 탭 줄 폭을 따른다</p>
      </Tabs>
    </div>
  );
}

export function TabsSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        밑줄 탭 줄 + 패널 하나. 줄 아래 1px --line-control, 탭은 줄 폭을 똑같이 나누고 줄바꿈하지 않는다. 고른 탭은 굵게 · --text · 아래
        --bw-tab 밑줄 --tool이고 hover에도 그대로다(hover는 글자 --text). 패널은 role=&quot;tabpanel&quot; 하나이고 내용만 바꿔 그린다 —
        탭을 눌러도 포커스는 누른 탭에 남는다. 항목마다 Tab으로 닿고 Enter · Space로 고른다(화살표 키 이동은 없다).
      </p>
      <h3 className={catalog.heading}>클라이언트 탭 넷 — 패널 내용이 탭마다 바뀐다</h3>
      <Connect />
      <h3 className={catalog.heading}>항목마다 고른 모습</h3>
      <div className={catalog.stack}>
        {CLIENTS.map((item) => (
          <Pinned key={item.value} value={item.value} />
        ))}
      </div>
      <h3 className={catalog.heading}>좁은 폭 — 넷이 한 줄에 들어간다(390 폭 본문 폭 가까이)</h3>
      <Narrow />
    </div>
  );
}

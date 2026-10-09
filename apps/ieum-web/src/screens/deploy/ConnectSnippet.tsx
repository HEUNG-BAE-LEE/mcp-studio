// AI에 연결하기 — 소절 제목 + 클라이언트 탭 넷(Claude · Gemini · GPT · 기타 에이전트) + 안내 한 줄과 "복사" + 설정 예시 코드 상자(옛 js/menu/deploy.js:31-44,78-82)
// 예시 글은 app/deploy/snippet connectSnippet(고른 탭 · 묶음 — 주소가 없으면 자리표시, 키는 늘 자리표시). 보이는 글 = 복사하는 글.
// 고른 탭은 모듈 저장소라 묶음 · 메뉴를 오가도 남고 새로고침하면 Claude로 돌아간다(app/deploy/snippetTab — 옛 S.client). 탭을 눌러도 포커스가 탭에 남는다
// 코드 상자의 이름은 고른 탭 글자다(새 문구 없음)
import type { Toolset } from '../../api/types';
import { copyWithToast } from '../../app/deploy/copyWithToast';
import { SNIPPET_CLIENTS, connectSnippet, type SnippetClient } from '../../app/deploy/snippet';
import { setSnippetClient, useSnippetClient } from '../../app/deploy/snippetTab';
import { DEPLOY } from '../../copy/deploy';
import { Button, CodeBlock, SectionTitle, Tabs, type TabItem } from '@/ui';
import styles from './DeployScreen.module.css';

const S = DEPLOY.snippet;

const TAB_ITEMS: readonly TabItem[] = SNIPPET_CLIENTS.map((client) => ({ value: client, label: S.clients[client] }));

const clientOf = (value: string): SnippetClient | undefined => SNIPPET_CLIENTS.find((client) => client === value);

export function ConnectSnippet({ toolset }: Readonly<{ toolset: Toolset }>) {
  const client = useSnippetClient();
  const { note, code } = connectSnippet(client, toolset);
  const onTab = (value: string) => {
    const next = clientOf(value);
    if (next !== undefined) setSnippetClient(next);
  };

  return (
    <>
      <SectionTitle level="sub" title={S.title} />
      <Tabs items={TAB_ITEMS} value={client} onValueChange={onTab}>
        <div className={styles.snippetHead}>
          <p className={styles.snippetNote}>{note}</p>
          <Button size="sm" icon="copy" onClick={() => void copyWithToast(code.text)}>
            {S.copy}
          </Button>
        </div>
        <CodeBlock code={code} label={S.clients[client]} />
      </Tabs>
    </>
  );
}

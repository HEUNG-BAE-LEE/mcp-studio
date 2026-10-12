// ServerLogModal — 묶음 서버 로그 모달의 내용(옛 tsLog — js/menu/deploy.js:165-171)
// 넓은 모달 · 본문은 로그 상자(CodeBlock log — 강조 없음 · 긴 줄 접음 · 최대 높이 화면 56% · 키보드로 스크롤) · 발은 "새로 읽기" + "닫기".
// 줄이 없으면 상자 안에 "아직 남은 로그가 없습니다."(옛 그대로 상자 안 글). 열 때와 새로 읽을 때마다 상자를 맨 아래로(followKey = 읽은 시각).
// 확인 · 입력이 없어 첫 포커스는 머리 ✕
//
// ── 쓰는 곳 계약 ──
// serverLogContentOf({ toolset, lines, readAt }) → ModalContent(app/sources/useModalAttempt)
//   toolset — 연 순간의 묶음(제목 이름). lines · readAt — 층에 실린 받은 줄과 읽은 시각
// - "새로 읽기"는 받고 나서 같은 칸의 줄만 바꾼다(app/layers replaceServerLog — 같은 시도라 포커스가 누른 버튼에 남는다, 옛은 모달을 다시 그려 잃었다).
//   실패는 경고 토스트이고 보이던 줄은 그대로다(app/deploy/serverLog). 받는 사이 창을 닫았거나 다른 창으로 바뀌었으면 열지 않는다
import type { ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { LAYER_COPY } from '../../copy/shell';
import { replaceServerLog } from '../layers';
import type { ModalContent } from '../sources/useModalAttempt';
import { loadServerLog } from './serverLog';
import { Button, CodeBlock } from '@/ui';

const C = DEPLOY.logs;
const LINE_BREAK = '\n';

export type ServerLogInput = Readonly<{ toolset: ToolsetWire; lines: readonly string[]; readAt: number }>;

async function reload(toolsetId: string): Promise<void> {
  const lines = await loadServerLog(toolsetId);
  if (lines !== null) replaceServerLog(toolsetId, lines, Date.now());
}

export function serverLogContentOf({ toolset, lines, readAt }: ServerLogInput): ModalContent {
  const title = C.title(toolset.name);
  return {
    title,
    size: 'wide',
    cancelLabel: LAYER_COPY.close,
    extra: (
      <Button icon="refresh" onClick={() => void reload(toolset.id)}>
        {C.reload}
      </Button>
    ),
    body: (
      <CodeBlock
        variant="log"
        label={title}
        code={{ text: lines.join(LINE_BREAK) || C.empty, lang: 'plain' }}
        followKey={readAt}
      />
    ),
  };
}

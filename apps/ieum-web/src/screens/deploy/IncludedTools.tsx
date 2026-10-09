// 포함된 도구 — 소절 제목 "포함된 도구" + 보조 "공개 N개(, 검토가 끝나지 않은 M개는 배포에서 빠집니다)" + 표 넷 칸(도구 · 원본 시스템 · 방식 · 상태)
// (옛 js/menu/deploy.js:54-55,85-88). 도구는 저장본(useTools — 스튜디오에서 저장하지 않은 공개 상태는 번지지 않는다), 묶음 순서 · 목록에 없는 id는 뺀다.
// 도구 id는 변환 스튜디오로 가는 링크(고정폭 · 밑줄 없음) — 도착 표지를 실어 스튜디오가 검색어를 비우고 필터는 전체다(push — 맨 위로).
// 새 탭 · 링크 복사는 같은 주소다(옛은 버튼이었다 — 이식 기간 허용 차이 · 메뉴로 가는 링크).
// 원본을 찾지 못하는 도구 행은 원본 칸을 값 없음 표기로 그린다(옛은 예외로 화면이 멈췄다 — 이식 기간 고침). 도구가 없으면 표 본문이 빈다(옛 그대로)
import type { Source, Tool } from '../../api/types';
import { isPublished } from '../../app/deploy/toolsetView';
import { toolLink } from '../../app/studio/links';
import { DEPLOY } from '../../copy/deploy';
import { NONE } from '../../copy/format';
import { modeKindOf, modeLabel } from '../../copy/mode';
import {
  CompactTable,
  CompactTableCell,
  CompactTableHeadCell,
  CompactTableRow,
  LinkButton,
  ModeTag,
  SectionTitle,
  ToolStatusChip,
} from '@/ui';
import styles from './DeployScreen.module.css';

const T = DEPLOY.tools;

type IncludedToolsProps = Readonly<{
  /** 이 묶음의 도구(저장본, 묶음 순서) */
  tools: readonly Tool[];
  sources: readonly Source[];
}>;

function ToolLink({ toolId }: Readonly<{ toolId: string }>) {
  const link = toolLink(toolId);
  return (
    <LinkButton variant="mono" to={link.to} state={link.state}>
      {toolId}
    </LinkButton>
  );
}

export function IncludedTools({ tools, sources }: IncludedToolsProps) {
  const ready = tools.filter(isPublished).length;
  const sourceName = (sourceId: string) => sources.find((s) => s.id === sourceId)?.name ?? NONE;

  return (
    <div>
      <SectionTitle level="sub" title={T.title} description={T.summary(ready, tools.length - ready)} />
      <CompactTable
        minWidth={420}
        head={
          <>
            <CompactTableHeadCell>{T.columns.tool}</CompactTableHeadCell>
            <CompactTableHeadCell>{T.columns.source}</CompactTableHeadCell>
            <CompactTableHeadCell>{T.columns.mode}</CompactTableHeadCell>
            <CompactTableHeadCell>{T.columns.status}</CompactTableHeadCell>
          </>
        }
      >
        {tools.map((tool, index) => (
          // 같은 id가 묶음에 두 번 담겨 있어도(옛 수정 창이 저장한 묶음) 줄마다 키가 다르게 — 순서 고정 목록이다
          <CompactTableRow key={`${index}:${tool.id}`}>
            <CompactTableCell>
              <ToolLink toolId={tool.id} />
            </CompactTableCell>
            <CompactTableCell className={styles.description}>{sourceName(tool.src)}</CompactTableCell>
            <CompactTableCell>
              <ModeTag kind={modeKindOf(tool.mode)} label={modeLabel(tool.mode)} />
            </CompactTableCell>
            <CompactTableCell>
              <ToolStatusChip status={tool.status} />
            </CompactTableCell>
          </CompactTableRow>
        ))}
      </CompactTable>
    </div>
  );
}

// 도구 묶음 목록 — 머리 "도구 묶음 N개" · 두 줄 항목(이름 + 배포 상태 칩 / 도구 수 · 사용 대상) · 아래 전폭 "도구 묶음 만들기"(옛 js/menu/deploy.js:60-66)
// 항목을 누르면 그 묶음 주소로 바꾼다(replace — 화면 안 선택). 고른 항목은 다시 그려져도 포커스가 남는다(옛은 화면을 다시 그려 잃었다).
// 도구 수는 묶음의 도구 id 수 그대로다(옛 x.tools.length — 상세 표와 어긋날 수 있다). 목록은 스크롤하지 않는다(옛 패널에 최대 높이가 없다)
import type { Toolset } from '../../api/types';
import { openToolsetCreate } from '../../app/layers';
import { DEPLOY } from '../../copy/deploy';
import { Button, Panel, SelectableListItem } from '@/ui';
import { DeployStateChip } from './DeployStateChip';

type ToolsetListProps = Readonly<{
  toolsets: readonly Toolset[];
  selectedId: string;
  onPick: (toolsetId: string) => void;
}>;

export function ToolsetList({ toolsets, selectedId, onPick }: ToolsetListProps) {
  return (
    <Panel
      label={DEPLOY.list.aria}
      title={DEPLOY.list.head}
      count={DEPLOY.list.count(toolsets.length)}
      footer={
        <Button icon="plus" onClick={openToolsetCreate}>
          {DEPLOY.createToolset}
        </Button>
      }
    >
      {toolsets.map((ts) => (
        <SelectableListItem
          key={ts.id}
          variant="name"
          title={ts.name}
          status={<DeployStateChip toolset={ts} />}
          description={DEPLOY.list.itemMeta(ts.tools.length, ts.audience)}
          selected={ts.id === selectedId}
          onSelect={() => onPick(ts.id)}
        />
      ))}
    </Panel>
  );
}

// 카탈로그 SplitLayout 절 — variant 둘(list · playground) 자리표시 + 목록 + 상세를 부품으로 맞춘 한 벌(Panel · SelectableListItem · DetailHead).
// 1100 이하 한 열(왼쪽이 위)은 폭 전환으로 본다 — 접어도 간격은 그대로, 목록 스크롤 최대 높이는 280
import { useState } from 'react';
import { Button, DetailHead, Panel, SelectableListItem, SplitLayout, StatusChip, type SplitLayoutVariant } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SplitLayoutSection.module.css';

type VariantRow = { variant: SplitLayoutVariant; note: string };

const ROWS: readonly VariantRow[] = [
  { variant: 'list', note: '왼쪽 --w-list-aside + 1fr · 간격 --s-7 · 위 정렬 · 1100에서 한 열' },
  { variant: 'playground', note: '왼쪽 320 ~ 430 + 1fr · 간격 --s-6 · 위 정렬 · 1100에서 한 열' },
];

const TOOLS = [
  { id: 'orders.search', title: '주문 검색', code: 'GET /orders/search' },
  { id: 'orders.create', title: '주문 생성', code: 'POST /orders' },
  { id: 'items.list', title: '품목 목록', code: 'GET /items' },
] as const;

function ListDetailDemo() {
  const [pickedId, setPickedId] = useState<string>(TOOLS[0].id);
  const tool = TOOLS.find((item) => item.id === pickedId);
  return (
    <SplitLayout variant="list">
      <Panel label="도구 목록" title="도구 목록" count={`${TOOLS.length}개`} scroll>
        {TOOLS.map((item) => (
          <SelectableListItem
            key={item.id}
            variant="id"
            title={item.id}
            status={
              <StatusChip tone="ok" size="sm">
                공개 중
              </StatusChip>
            }
            description={item.title}
            selected={item.id === pickedId}
            onSelect={() => setPickedId(item.id)}
          />
        ))}
      </Panel>
      {tool ? (
        <section aria-label="도구 상세">
          <DetailHead
            title={tool.id}
            titleMono
            badges={<StatusChip tone="ok">공개 중</StatusChip>}
            description={tool.title}
            code={tool.code}
            actions={<Button icon="play">테스트 실행</Button>}
          />
          <div className={`${styles.cell} ${styles.tall}`}>상세 본문 자리</div>
        </section>
      ) : null}
    </SplitLayout>
  );
}

export function SplitLayoutSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        정해 둔 두 조합만. 칸은 최소 폭 0으로 줄어들고, 접히면 왼쪽이 위 · 오른쪽이 아래다. 위 바깥 여백(스튜디오 16 · 배포 · 테스트 실행 22)은 쓰는 곳이 className으로 준다.
      </p>
      {ROWS.map(({ variant, note }) => (
        <div key={variant} className={catalog.stack}>
          <h3 className={catalog.heading}>variant={variant}</h3>
          <p className={catalog.note}>{note}</p>
          <SplitLayout variant={variant}>
            <div className={`${styles.cell} ${styles.tall}`}>왼쪽 열</div>
            <div className={styles.cell}>오른쪽 상세</div>
          </SplitLayout>
        </div>
      ))}
      <h3 className={catalog.heading}>목록 + 상세 — Panel · SelectableListItem · DetailHead</h3>
      <ListDetailDemo />
    </div>
  );
}

// 카탈로그 SelectableListItem 절 — id(기본 · 고름 · dimmed · 둘째 줄에 쓰기 표지 · 긴 id 말줄임) · name(기본 · 고름 · 긴 이름 줄바꿈) 세로로 쌓아 아래 선이 이어지게.
// 호버 · 포커스(안쪽 링)는 직접 눌러 본다. 마지막 목록은 눌러서 고르기(이미 고른 항목을 눌러도 부른다)
import { useState } from 'react';
import { ModeTag, StatusChip } from '../../ui';
import { SelectableListItem } from '../../ui/SelectableListItem';
import catalog from './catalog.module.css';
import styles from './SelectableListItemSection.module.css';

const NOOP = () => undefined;
const LONG_ID = 'inventory.warehouse.stock.adjustment.history.search.by.customer.and.period';
const PICK_ITEMS = [
  { id: 'orders.search', title: '주문 검색' },
  { id: 'orders.create', title: '주문 생성' },
  { id: 'items.list', title: '품목 목록' },
] as const;

const WRITE_TAG = <ModeTag kind="write" label="쓰기" size="sm" />;

function PickDemo() {
  const [picked, setPicked] = useState<string>(PICK_ITEMS[0].id);
  const [pickCount, setPickCount] = useState(0);
  return (
    <>
      <p className={catalog.note}>눌러서 고르기 — 누른 횟수 {pickCount}(이미 고른 항목을 눌러도 센다)</p>
      <div className={styles.list}>
        {PICK_ITEMS.map((item) => (
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
            selected={item.id === picked}
            onSelect={() => {
              setPicked(item.id);
              setPickCount((count) => count + 1);
            }}
          />
        ))}
      </div>
    </>
  );
}

export function SelectableListItemSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        전체 폭 &lt;button&gt; + aria-pressed · 아래 1px --line-divider. 고른 항목은 --surface-selected + 왼쪽 막대(--edge-active)이고 고른 채 가리켜도 그대로다.
        dimmed는 두 줄 글자만 옅게 하고 칩 · 표지 색은 그대로다. 첫 줄은 제목과 칩이 양끝이고, 포커스 링은 안쪽이다(목록 스크롤 상자에 잘리지 않게).
      </p>
      <h3 className={catalog.heading}>variant=id — 기본 · 고름 · dimmed · 둘째 줄 쓰기 표지 · 긴 id 말줄임</h3>
      <div className={styles.list}>
        <SelectableListItem
          variant="id"
          title="orders.search"
          status={
            <StatusChip tone="ok" size="sm">
              공개 중
            </StatusChip>
          }
          description="기본 — 주문 검색"
          selected={false}
          onSelect={NOOP}
        />
        <SelectableListItem
          variant="id"
          title="orders.create"
          status={
            <StatusChip tone="warn" size="sm">
              검토 필요
            </StatusChip>
          }
          description={<>고른 항목 — 주문 생성 {WRITE_TAG}</>}
          selected
          onSelect={NOOP}
        />
        <SelectableListItem
          variant="id"
          title="items.export"
          status={
            <StatusChip tone="mute" size="sm">
              제외
            </StatusChip>
          }
          description={<>dimmed — 품목 내보내기 {WRITE_TAG}</>}
          selected={false}
          onSelect={NOOP}
          dimmed
        />
        <SelectableListItem
          variant="id"
          title={LONG_ID}
          status={
            <StatusChip tone="warn" size="sm">
              명세 변경
            </StatusChip>
          }
          description="긴 id는 한 줄에서 말줄임 — 칩은 줄어들지 않는다"
          selected={false}
          onSelect={NOOP}
        />
        <SelectableListItem
          variant="id"
          title="customers.update"
          description="칩 없음 — 첫 줄은 제목만"
          selected={false}
          onSelect={NOOP}
        />
      </div>
      <h3 className={catalog.heading}>variant=name — 기본 · 고름 · 긴 이름 줄바꿈</h3>
      <div className={styles.list}>
        <SelectableListItem
          variant="name"
          title="영업 도구"
          status={
            <StatusChip tone="ok" size="sm">
              배포 중 v3
            </StatusChip>
          }
          description="도구 5개, 사용 대상 영업팀"
          selected={false}
          onSelect={NOOP}
        />
        <SelectableListItem
          variant="name"
          title="재고 조회 묶음"
          status={
            <StatusChip tone="mute" size="sm">
              초안
            </StatusChip>
          }
          description="도구 2개, 사용 대상 물류팀"
          selected
          onSelect={NOOP}
        />
        <SelectableListItem
          variant="name"
          title="아주 긴 이름의 도구 묶음은 칸 안에서 줄을 바꾼다 — SalesOperationsMonthlyClosingToolset"
          status={
            <StatusChip tone="danger" size="sm">
              비정상 종료 v1
            </StatusChip>
          }
          description="도구 4개, 사용 대상 경리팀"
          selected={false}
          onSelect={NOOP}
        />
      </div>
      <h3 className={catalog.heading}>눌러서 고르기</h3>
      <PickDemo />
    </div>
  );
}

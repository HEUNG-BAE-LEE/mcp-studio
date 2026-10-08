// 카탈로그 DetailHead 절 — 도구 상세(titleMono + 칩 · 표지 + 설명 + code + 동작: 기본 · play 아이콘 · primary 비활성 / pending) · 묶음 상세(본문 글꼴 제목 + 칩 + 설명 + 동작 넷) ·
// 긴 id가 줄 끝에서 접히는 모양 · 있는 것만 그리는 변형(제목만 · code만). 760 이하 동작 줄 전체 폭은 폭 전환으로 본다
import { useState } from 'react';
import { Button, ModeTag, StatusChip, Switch, ToolStatusChip } from '../../ui';
import { DetailHead } from '../../ui/DetailHead';
import catalog from './catalog.module.css';

const LONG_ID = 'inventory.warehouse.stock.adjustment.history.search.by.customer.and.period.with.pagination';

/** 공개 스위치(Switch inline) — 동작 줄 맨 앞 */
function PublishSwitch() {
  const [published, setPublished] = useState(true);
  return <Switch variant="inline" label="AI에게 공개" checked={published} onCheckedChange={setPublished} />;
}

export function DetailHeadSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        제목은 h3 — 고정폭은 --fw-mono-strong, 본문 글꼴은 --fw-bold. 아래 1px --line-divider. 글 열은 최소 폭 260이라 동작 줄은 좁으면 아래로 접히고, 760 이하에서는
        동작 줄이 줄 전체 폭을 쓴다. 긴 제목은 아무 글자에서나 접힌다.
      </p>
      <h3 className={catalog.heading}>도구 상세 — titleMono · 칩 · 읽기/쓰기 표지 · 설명 + code · 동작(공개 스위치 포함)</h3>
      <DetailHead
        title="orders.search"
        titleMono
        badges={
          <>
            <ToolStatusChip status="done" />
            <ModeTag kind="read" label="읽기" />
          </>
        }
        description="주문 검색"
        code="GET /orders/search"
        actions={
          <>
            <PublishSwitch />
            <Button icon="play">테스트 실행</Button>
            <Button variant="primary" disabled>
              변경사항 저장
            </Button>
          </>
        }
      />
      <h3 className={catalog.heading}>저장 가능 · 요청 중(pending)</h3>
      <DetailHead
        title="orders.create"
        titleMono
        badges={
          <>
            <ToolStatusChip status="review" />
            <ModeTag kind="write" label="쓰기" />
          </>
        }
        description="주문 생성"
        code="POST /orders"
        actions={
          <>
            <Button icon="play">테스트 실행</Button>
            <Button variant="primary">변경사항 저장</Button>
          </>
        }
      />
      <DetailHead
        title="orders.create"
        titleMono
        badges={<StatusChip tone="warn">검토 필요</StatusChip>}
        description="주문 생성"
        code="POST /orders"
        actions={
          <Button variant="primary" pending>
            저장하는 중…
          </Button>
        }
      />
      <h3 className={catalog.heading}>묶음 상세 — 본문 글꼴 제목 · 칩 · 설명 · 동작 넷</h3>
      <DetailHead
        title="영업 도구"
        badges={<StatusChip tone="ok">배포 중 v3</StatusChip>}
        description="사용 대상 영업팀, 마지막 변경 2026-10-08 14:32"
        actions={
          <>
            <Button>묶음 수정</Button>
            <Button icon="code">서버 로그</Button>
            <Button icon="stop">중지</Button>
            <Button variant="primary" icon="rocket">
              새 버전 배포
            </Button>
          </>
        }
      />
      <h3 className={catalog.heading}>긴 id — 아무 글자에서나 접힌다</h3>
      <DetailHead
        title={LONG_ID}
        titleMono
        badges={<StatusChip tone="warn">명세 변경</StatusChip>}
        description="창고 재고 조정 이력 검색"
        code="GET /inventory/warehouse/stock/adjustment/history"
        actions={<Button icon="play">테스트 실행</Button>}
      />
      <h3 className={catalog.heading}>있는 것만 그린다 — 제목만 · code만(설명 없음)</h3>
      <DetailHead title="제목만 있는 머리" />
      <DetailHead title="items.list" titleMono code="listItems (SOAP 작업)" />
    </div>
  );
}

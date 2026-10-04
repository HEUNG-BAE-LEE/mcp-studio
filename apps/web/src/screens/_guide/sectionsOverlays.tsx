// 층 절 앞쪽 셋(Modal · Dialog · FlowOverlay). sections.tsx가 BASE_SECTIONS에 순서대로 잇는다
import { useId, useState } from 'react';
import {
  Button,
  CopyField,
  Dialog,
  FlowOverlay,
  FlowStepHead,
  HelperPanel,
  Input,
  KeyValue,
  Label,
  Modal,
  type ModalKind,
  StatusChip,
  StepList,
} from '@/ui';
import { GUIDE_FLOW_STEPS, GUIDE_KEY_VALUE_ROWS, GUIDE_LAYER_BOX } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';
import { GuideSettingsBody } from './sectionsSettings';
import { useBox } from './useBox';

const GUIDE_FLOW_BOX = { ...GUIDE_LAYER_BOX, width: 1040, height: 600 } as const;
const GUIDE_FLOW_NOTE = {
  title: '지금 고르는 것이 다음 화면을 정합니다',
  body: '소스 종류에 따라 물어보는 항목이 달라집니다.',
};
/** 내용 열 스크롤을 보이려고 쌓는 예시 줄 수 */
const GUIDE_FLOW_FILLER = Array.from({ length: 24 }, (_, i) => `예시 내용 ${i + 1}`);
const GUIDE_FLOW_LINE = { margin: 0, font: 'var(--t-ui)', color: 'var(--ink-soft)' } as const;

/** 실제 동작(열 때 포커스 이동 · Esc · ✕ · 닫으면 여는 버튼으로 복귀)을 그대로 쓴다 */
function GuideModal() {
  const [box, setBox] = useBox();
  const [openKind, setOpenKind] = useState<ModalKind | null>(null);
  const onOpenChange = (open: boolean) => {
    if (!open) setOpenKind(null);
  };
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpenKind('settings')}>settings 열기</Button>
        <Button onClick={() => setOpenKind('form')}>form 열기</Button>
        <Button onClick={() => setOpenKind('info')}>info 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_LAYER_BOX}>
          {box ? (
            <>
              <Modal
                open={openKind === 'settings'}
                onOpenChange={onOpenChange}
                container={box}
                title="계약 원장 DB"
                marker={
                  <StatusChip tier="done" size="lg">
                    수집 완료
                  </StatusChip>
                }
                subtitle="스키마 contract · 표 34개 · 마지막 수집 2026-09-10 03:00"
                footer={{
                  note: '바꾼 값은 다음 수집부터 적용됩니다',
                  actions: (
                    <>
                      <Button onClick={() => onOpenChange(false)}>닫기</Button>
                      <Button variant="primary">지금 다시 수집</Button>
                    </>
                  ),
                }}
              >
                <GuideSettingsBody />
              </Modal>
              <Modal
                open={openKind === 'form'}
                onOpenChange={onOpenChange}
                container={box}
                kind="form"
                title="새 프로젝트"
                footer={{
                  actions: (
                    <>
                      <Button onClick={() => onOpenChange(false)}>취소</Button>
                      <Button variant="primary">생성</Button>
                    </>
                  ),
                }}
              >
                <Label htmlFor="guide-modal-name">프로젝트 이름</Label>
                <Input id="guide-modal-name" placeholder="예: 계약 조회" />
              </Modal>
              <Modal
                open={openKind === 'info'}
                onOpenChange={onOpenChange}
                container={box}
                kind="info"
                kicker="연결 정보"
                title="계약 조회 커넥터"
                marker={
                  <StatusChip tier="done" size="lg">
                    사용 중
                  </StatusChip>
                }
                subtitle="보험 인수심사 · 계약 원장 DB · 도구 7개"
                footer={{
                  actions: (
                    <>
                      <Button onClick={() => onOpenChange(false)}>닫기</Button>
                      <Button variant="primary">커넥터 열기</Button>
                    </>
                  ),
                }}
              >
                <CopyField
                  label="엔드포인트"
                  value="https://mcp.internal/db_connector"
                  onCopy={() => {}}
                />
                <CopyField label="프로토콜" value="MCP / streamable-http" onCopy={() => {}} />
                <CopyField label="인증 키" value="sk_live_••••••••db_c" onCopy={() => {}} />
              </Modal>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** 확인 다이얼로그 — 열기 버튼 + 예시 상자. 취소 · Esc는 닫고, 확인도 닫는다 */
function GuideDialog() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>확인 다이얼로그 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_LAYER_BOX}>
          {box ? (
            <Dialog
              open={open}
              onOpenChange={setOpen}
              container={box}
              title="발행하시겠습니까"
              description="배포가 끝날 때까지 호출이 중단됩니다. 한 번에 한 정의만 서비스하므로 낡은 배포본이 먼저 내려갑니다."
              actions={{
                cancel: <Button>취소</Button>,
                confirm: <Button variant="primary">발행</Button>,
              }}
            >
              <KeyValue items={GUIDE_KEY_VALUE_ROWS.slice(0, 2)} />
            </Dialog>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** 흐름 전체 덮기 — 예시 상자(1040×600, relative)를 덮는다. Esc로 닫고 여는 버튼으로 포커스가 돌아온다.
 *  단계 머리 고정 · 내용 열 스크롤 · HelperPanel 따로 스크롤 · 발 note(비활성 주 액션 사유) */
function GuideFlowOverlay() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>흐름 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_FLOW_BOX}>
          {box ? (
            <FlowOverlay
              open={open}
              onOpenChange={setOpen}
              container={box}
              title="새로운 소스 추가"
              heading={
                <FlowStepHead
                  title="어떤 소스를 연결할까요?"
                  description="연결할 데이터 소스 유형을 선택하면 다음 단계로 넘어갑니다."
                />
              }
              note="소스 종류를 고르면 다음으로 갈 수 있다"
              noteId={noteId}
              aside={
                <HelperPanel title="소스 연결 과정">
                  <StepList items={GUIDE_FLOW_STEPS} current={0} note={GUIDE_FLOW_NOTE} />
                </HelperPanel>
              }
              footer={
                <>
                  <Button variant="danger" size="lg" onClick={() => setOpen(false)}>
                    나가기
                  </Button>
                  <Button variant="primary" size="lg" disabled aria-describedby={noteId}>
                    다음
                  </Button>
                </>
              }
            >
              {GUIDE_FLOW_FILLER.map((line) => (
                <p key={line} style={GUIDE_FLOW_LINE}>
                  {line}
                </p>
              ))}
            </FlowOverlay>
          ) : null}
        </div>
      </div>
    </>
  );
}

export const OVERLAY_SECTIONS: readonly GuideSection[] = [
  {
    group: '층',
    name: 'Modal',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          settings 820×552 · form 520×auto — 오버레이는 예시 상자(컨테이너)를 덮는다
        </span>
        <GuideModal />
      </div>
    ),
  },
  {
    group: '층',
    name: 'Dialog',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          확인 다이얼로그 폭 520 — 취소 · 발행은 actions 슬롯(Radix Cancel · Action)
        </span>
        <GuideDialog />
      </div>
    ),
  },
  {
    group: '층',
    name: 'FlowOverlay',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          본문 열 전체를 덮는 흐름 층 — 머리 56 · heading 고정 + 내용 열 스크롤 · aside 따로 스크롤
          · 발 56(note = 비활성 주 액션 사유, 주 액션 바로 왼쪽 · scrim 없음)
        </span>
        <GuideFlowOverlay />
      </div>
    ),
  },
];

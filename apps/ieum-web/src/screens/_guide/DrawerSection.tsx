// 카탈로그 Drawer 절 — 실제로 열어 본다: 상세(라벨 · 제목 · 설명 · 발 정보 · 버튼) · 고정폭 제목 · 발 없음 · 마법사(단계 · 긴 본문 · scrollResetKey)
// · dismissible=false · 드로어 위 모달(Esc는 맨 위 층만) · 열린 채 다른 항목 열기(contentKey). 첫 포커스(머리 ✕) · 가림막 · ✕ · 닫은 뒤 연 버튼으로 포커스 복귀 ·
// Tab이 층 밖으로 나가는 것(가두지 않음)을 키보드로 본다. 열린 층 줄은 useOpenLayers의 값이다 — 드로어가 열리면 드로어가 켜진다
import { useState } from 'react';
import { Button, Drawer, Modal, useOpenLayers } from '../../ui';
import catalog from './catalog.module.css';
import styles from './DrawerSection.module.css';

type Example = 'detail' | 'mono' | 'plain' | 'wizard' | 'locked' | 'stacked' | 'items';

// 열린 채 다른 항목 열기 — 호출 로그처럼 같은 드로어에 행마다 다른 기록을 보인다(contentKey = 항목 id)
const ITEMS = ['hr_employee_search', 'pr_draft_save', 'erp_order_list'] as const;
type Item = (typeof ITEMS)[number];

const WIZARD_STEPS = ['연결 방식', '접속 정보', '도구 확인'] as const;
// 넘치는 본문 — 본문만 스크롤되고 머리 · 발은 그대로인지 본다
const LONG_LINES = Array.from({ length: 40 }, (_, index) => `본문 ${index + 1}번째 줄 — 머리와 발은 고정되고 본문만 스크롤된다.`);

export function DrawerSection() {
  const [opened, setOpened] = useState<Example | null>(null);
  const [step, setStep] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [item, setItem] = useState<Item>(ITEMS[0]);
  const openLayers = useOpenLayers();
  const openChange = (example: Example) => (open: boolean) => setOpened(open ? example : null);
  const close = () => setOpened(null);
  const openWizard = () => {
    setStep(0);
    setOpened('wizard');
  };
  const isLastStep = step === WIZARD_STEPS.length - 1;
  const openItem = (next: Item) => {
    setItem(next);
    setOpened('items');
  };

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        &lt;dialog&gt;.show() — 오른쪽에서 밀려온다(폭 min(--w-drawer, 100vw)). 포커스를 가두지 않는다. 가림막 · Esc(맨 위 층만) · ✕로
        닫고, 닫으면 연 버튼으로 포커스가 돌아간다. 발의 닫기 버튼은 쓰는 곳이 넣는다. 760 이하에서 안쪽 여백이 줄어든다.
      </p>
      <p className={catalog.note}>
        useOpenLayers — 모달 {openLayers.modal ? '열림' : '닫힘'} · 드로어 {openLayers.drawer ? '열림' : '닫힘'}
      </p>
      <div className={catalog.row}>
        <Button onClick={() => setOpened('detail')}>상세(라벨 · 설명 · 발)</Button>
        <Button onClick={() => setOpened('mono')}>고정폭 제목</Button>
        <Button onClick={() => setOpened('plain')}>발 없음</Button>
        <Button onClick={openWizard}>마법사(긴 본문 · 단계)</Button>
        <Button onClick={() => setOpened('locked')}>dismissible=false</Button>
        <Button onClick={() => setOpened('stacked')}>드로어 위 모달</Button>
      </div>
      <p className={catalog.note}>
        열린 채 다른 항목 열기(contentKey) — 하나를 연 뒤 Tab으로 층 밖의 다른 항목 버튼으로 가 Enter. 포커스가 ✕로 오고, 닫으면 마지막으로
        연 항목 버튼으로 돌아간다.
      </p>
      <div className={catalog.row}>
        {ITEMS.map((id) => (
          <Button key={id} onClick={() => openItem(id)}>
            {id}
          </Button>
        ))}
      </div>

      <Drawer
        open={opened === 'detail'}
        onOpenChange={openChange('detail')}
        overline="원본 시스템"
        title="인사 시스템"
        description="REST(OpenAPI) 명세로 연결한 원본 시스템이다."
        footerInfo={
          <>
            도구 <b>3</b>개 선택
          </>
        }
        footer={
          <>
            <Button>변환 스튜디오에서 열기</Button>
            <Button variant="primary" onClick={close}>
              닫기
            </Button>
          </>
        }
      >
        <p className={styles.text}>첫 포커스는 문서 순서로 첫 버튼 — 머리 ✕다. 발 정보의 굵은 글은 주조색이다.</p>
      </Drawer>
      <Drawer
        open={opened === 'mono'}
        onOpenChange={openChange('mono')}
        overline="호출 기록"
        title="hr_employee_search"
        titleMono
        description="설명이 길면 상자 폭 안에서 줄을 바꾼다. 제목은 도구 id · 메서드 경로라 고정폭 글꼴로 그린다."
        footer={
          <Button variant="primary" onClick={close}>
            닫기
          </Button>
        }
      >
        <p className={styles.text}>titleMono — 제목만 고정폭이다.</p>
      </Drawer>
      <Drawer open={opened === 'plain'} onOpenChange={openChange('plain')} title="발 없는 드로어">
        <p className={styles.text}>footer · footerInfo가 둘 다 없으면 발을 그리지 않는다.</p>
      </Drawer>
      <Drawer
        open={opened === 'wizard'}
        onOpenChange={openChange('wizard')}
        overline="원본 시스템"
        title="원본 시스템 연결"
        description={`${step + 1}단계 — ${WIZARD_STEPS[step]}`}
        scrollResetKey={step}
        footerInfo={`${step + 1} / ${WIZARD_STEPS.length}`}
        footer={
          <>
            <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              이전
            </Button>
            <Button variant="primary" onClick={isLastStep ? close : () => setStep((s) => s + 1)}>
              {isLastStep ? '완료' : '다음'}
            </Button>
          </>
        }
      >
        <p className={styles.text}>본문을 내린 뒤 다음 · 이전을 누르면 본문이 맨 위로 돌아간다(scrollResetKey).</p>
        {LONG_LINES.map((line) => (
          <p key={line} className={styles.text}>
            {line}
          </p>
        ))}
      </Drawer>
      <Drawer
        open={opened === 'locked'}
        onOpenChange={openChange('locked')}
        title="닫기 잠금"
        dismissible={false}
        footer={
          <Button variant="primary" onClick={close}>
            닫기
          </Button>
        }
      >
        <p className={styles.text}>dismissible=false — Esc · 가림막으로 닫히지 않고 ✕ · 닫기로만 닫힌다.</p>
      </Drawer>
      <Drawer
        open={opened === 'stacked'}
        onOpenChange={openChange('stacked')}
        title="드로어 위 모달"
        footer={
          <>
            <Button onClick={() => setIsModalOpen(true)}>모달 열기</Button>
            <Button variant="primary" onClick={close}>
              닫기
            </Button>
          </>
        }
      >
        <p className={styles.text}>모달을 연 뒤 Esc — 모달만 닫히고 포커스는 모달을 연 버튼으로 돌아간다. 한 번 더 Esc면 드로어가 닫힌다.</p>
      </Drawer>
      <Drawer
        open={opened === 'items'}
        onOpenChange={openChange('items')}
        overline="호출 기록"
        title={item}
        titleMono
        description="열린 채 다른 항목 버튼을 누르면 내용만 바뀐다."
        contentKey={item}
        footer={
          <Button variant="primary" onClick={close}>
            닫기
          </Button>
        }
      >
        <p className={styles.text}>
          contentKey가 바뀌면 그 순간 포커스가 있던 버튼을 복귀 대상으로 다시 잡고, 포커스를 ✕로 옮기고, 본문을 맨 위로 올린다(옛
          openDrawer 재호출).
        </p>
      </Drawer>
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title="위 층 모달" cancelLabel="닫기">
        드로어 위에 뜬 모달 — 가림막 · z가 드로어 짝보다 위다.
      </Modal>
    </div>
  );
}

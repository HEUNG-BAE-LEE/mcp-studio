// 카탈로그 Modal 절(가림막 Overlay 포함) — 실제로 열어 본다: 확인 모달 · 입력 모달 · select · textarea가 앞선 입력 모달 · 넓은 안내 모달 · dismissible=false.
// 첫 포커스(본문 첫 input → 확인 → ✕) · Esc(맨 위 층만) · 가림막 · ✕ · 닫은 뒤 연 버튼으로 포커스 복귀 · Tab이 층 밖으로 나가는 것(가두지 않음)을 키보드로 본다.
// 열린 층 줄은 useOpenLayers의 값이다 — 이 페이지의 어느 층(셸 절의 범위 모달 포함)이든 열리고 닫힐 때 바뀐다
import { useId, useState } from 'react';
import { Button, Modal, useOpenLayers } from '../../ui';
import catalog from './catalog.module.css';
import styles from './ModalSection.module.css';

type Example = 'confirm' | 'form' | 'mixed' | 'info' | 'locked';

export function ModalSection() {
  const [opened, setOpened] = useState<Example | null>(null);
  const nameId = useId();
  const mixedKindId = useId();
  const mixedNoteId = useId();
  const mixedNameId = useId();
  const openLayers = useOpenLayers();
  const openChange = (example: Example) => (open: boolean) => setOpened(open ? example : null);
  const close = () => setOpened(null);

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        &lt;dialog&gt;.show() — 포커스를 가두지 않는다. 가림막 · Esc(맨 위 층만) · ✕ · 취소로 닫고, 닫으면 연 버튼으로 포커스가
        돌아간다. 확인은 onConfirm만 부른다(닫기는 쓰는 곳). dismissible=false는 Esc · 가림막으로 닫히지 않는다.
      </p>
      <p className={catalog.note} data-modal={openLayers.modal} data-drawer={openLayers.drawer}>
        useOpenLayers — 모달 {openLayers.modal ? '열림' : '닫힘'} · 드로어 {openLayers.drawer ? '열림' : '닫힘'}
      </p>
      <div className={catalog.row}>
        <Button onClick={() => setOpened('confirm')}>확인 모달</Button>
        <Button onClick={() => setOpened('form')}>입력 모달</Button>
        <Button onClick={() => setOpened('mixed')}>입력 모달(select · textarea 앞)</Button>
        <Button onClick={() => setOpened('info')}>안내 모달(wide)</Button>
        <Button onClick={() => setOpened('locked')}>dismissible=false</Button>
      </div>

      <Modal
        open={opened === 'confirm'}
        onOpenChange={openChange('confirm')}
        title="원본 시스템 삭제"
        confirmLabel="삭제"
        onConfirm={close}
      >
        <b>인사 시스템</b>을 삭제합니다. 첫 포커스는 확인 버튼이다.
      </Modal>
      <Modal
        open={opened === 'form'}
        onOpenChange={openChange('form')}
        title="액세스 키 발급"
        confirmLabel="발급"
        onConfirm={close}
      >
        <label htmlFor={nameId} className={styles.label}>
          키 이름
        </label>
        <input id={nameId} className={styles.input} />
        <p className={styles.hint}>첫 포커스는 첫 input(키 이름)이다.</p>
      </Modal>
      <Modal
        open={opened === 'mixed'}
        onOpenChange={openChange('mixed')}
        title="액세스 키 발급"
        confirmLabel="발급"
        onConfirm={close}
      >
        <label htmlFor={mixedKindId} className={styles.label}>
          키 종류
        </label>
        <select id={mixedKindId} className={styles.input}>
          <option>운영</option>
          <option>시험</option>
        </select>
        <label htmlFor={mixedNoteId} className={styles.label}>
          메모
        </label>
        <textarea id={mixedNoteId} className={styles.textarea} rows={2} />
        <label htmlFor={mixedNameId} className={styles.label}>
          키 이름
        </label>
        <input id={mixedNameId} className={styles.input} />
        <p className={styles.hint}>select · textarea가 앞에 있어도 첫 포커스는 첫 input(키 이름)이다.</p>
      </Modal>
      <Modal
        open={opened === 'info'}
        onOpenChange={openChange('info')}
        title="서버 로그"
        size="wide"
        cancelLabel="닫기"
      >
        확인 버튼이 없는 안내 모달 — 첫 포커스는 머리 ✕다.
      </Modal>
      <Modal
        open={opened === 'locked'}
        onOpenChange={openChange('locked')}
        title="키를 발급했습니다"
        confirmLabel="확인"
        onConfirm={close}
        hideCancel
        dismissible={false}
      >
        지금 한 번만 보여 드립니다. Esc · 가림막으로 닫히지 않고 ✕ · 확인으로만 닫힌다.
      </Modal>
    </div>
  );
}

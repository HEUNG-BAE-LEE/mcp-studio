// 카탈로그 Modal 절(가림막 Overlay 포함) — 실제로 열어 본다: 확인 모달 · 입력 모달 · select · textarea가 앞선 입력 모달 · 넓은 안내 모달 · dismissible=false.
// 첫 포커스(본문 첫 input → 확인 → ✕) · Esc(맨 위 층만) · 가림막 · ✕ · 닫은 뒤 연 버튼으로 포커스 복귀 · Tab이 층 밖으로 나가는 것(가두지 않음)을 키보드로 본다.
// 열린 층 줄은 useOpenLayers의 값이다 — 이 페이지의 어느 층(셸 절의 범위 모달 포함)이든 열리고 닫힐 때 바뀐다
// contentKey 예시: 한 Modal로 대상 A(확인 — 첫 포커스 확인 버튼) · B(입력 — 첫 포커스 input)를 연다(층 호스트의 한 칸과 같은 쓰임).
// 바로 해 볼 수 있는 쪽은 층 안 "B로 바꾸기" — 그 순간 포커스가 층 안이라 복귀 대상은 A를 연 버튼 그대로이고 첫 포커스가 B의 input으로 간다.
// 층 밖 "대상 B 열기"는 가림막이 덮어 마우스로 누를 수 없고, 층이 body 끝에 포털돼 A를 연 채 Tab으로 60번 넘게(Shift+Tab은 100번 넘게) 가야 닿는다 —
// 닿아서 열면 그 버튼이 복귀 대상이 되고 첫 포커스가 B의 input으로 간다
// 확인 잠금 예시: 확인을 누르면 1초 잠긴다(요청 중 흉내 — confirmDisabled). 모달은 열린 채라 잠긴 동안 포커스가 확인 버튼에 남는지 ·
// 풀린 뒤 Enter가 다시 누르는지를 본다(누른 횟수가 는다)
import { useEffect, useId, useState } from 'react';
import { Button, Modal, useOpenLayers } from '../../ui';
import catalog from './catalog.module.css';
import styles from './ModalSection.module.css';

type Example = 'confirm' | 'form' | 'mixed' | 'info' | 'locked' | 'switch' | 'pending';
type SwitchTarget = 'a' | 'b';

// 확인 잠금 예시의 잠금 시간(요청 하나를 흉내 낸다)
const CONFIRM_LOCK_MS = 1000;

export function ModalSection() {
  const [opened, setOpened] = useState<Example | null>(null);
  const [isConfirmLocked, setConfirmLocked] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  useEffect(() => {
    if (!isConfirmLocked) return;
    const timer = window.setTimeout(() => setConfirmLocked(false), CONFIRM_LOCK_MS);
    return () => window.clearTimeout(timer);
  }, [isConfirmLocked]);
  const nameId = useId();
  const mixedKindId = useId();
  const mixedNoteId = useId();
  const mixedNameId = useId();
  const switchNameId = useId();
  const [switchTarget, setSwitchTarget] = useState<SwitchTarget>('a');
  const openLayers = useOpenLayers();
  const openChange = (example: Example) => (open: boolean) => setOpened(open ? example : null);
  const close = () => setOpened(null);
  const openSwitch = (target: SwitchTarget) => () => {
    setSwitchTarget(target);
    setOpened('switch');
  };
  const openPending = () => {
    setPressCount(0);
    setOpened('pending');
  };
  const pressPending = () => {
    setPressCount((count) => count + 1);
    setConfirmLocked(true);
  };

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
        <Button onClick={openPending}>확인 잠금(누르면 1초)</Button>
      </div>
      <p className={catalog.note}>
        contentKey — 한 Modal로 다른 대상을 연다. &quot;대상 A 열기&quot; 뒤 층 안 &quot;B로 바꾸기&quot;를 누르면 첫 포커스가 B의
        input으로 가고, 닫으면 복귀 대상은 A를 연 버튼 그대로다. 층 밖 &quot;대상 B 열기&quot;는 가림막이 덮고 층이 body 끝에 있어
        Tab으로 60번 넘게(Shift+Tab은 100번 넘게) 가야 닿는다 — 거기서 열면 그 버튼이 복귀 대상이 되어 닫을 때 &quot;대상 B 열기&quot;로 돌아간다.
      </p>
      <div className={catalog.row}>
        <Button onClick={openSwitch('a')}>대상 A 열기</Button>
        <Button onClick={openSwitch('b')}>대상 B 열기</Button>
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
      <Modal
        open={opened === 'pending'}
        onOpenChange={openChange('pending')}
        title="원본 시스템 삭제"
        confirmLabel="삭제"
        onConfirm={pressPending}
        confirmDisabled={isConfirmLocked}
      >
        <b>인사 시스템</b>을 삭제합니다. 확인을 누르면 1초 잠긴다(confirmDisabled) — 잠긴 동안 포커스는 확인 버튼에 남고,
        풀리면 Enter가 다시 누른다. 누른 횟수 <output data-press-count>{pressCount}</output>
      </Modal>
      <Modal
        open={opened === 'switch'}
        onOpenChange={openChange('switch')}
        contentKey={switchTarget}
        title={switchTarget === 'a' ? '대상 A — 확인' : '대상 B — 입력'}
        confirmLabel="확인"
        onConfirm={close}
        extra={switchTarget === 'a' ? <Button onClick={() => setSwitchTarget('b')}>B로 바꾸기</Button> : undefined}
      >
        {switchTarget === 'a' ? (
          <>
            <b>대상 A</b> — 입력이 없어 첫 포커스는 확인 버튼이다.
          </>
        ) : (
          <>
            <label htmlFor={switchNameId} className={styles.label}>
              대상 B 이름
            </label>
            <input id={switchNameId} className={styles.input} />
            <p className={styles.hint}>contentKey가 B로 바뀌면 첫 포커스가 이 input으로 다시 잡힌다.</p>
          </>
        )}
      </Modal>
    </div>
  );
}

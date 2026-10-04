// 층 변형 — ✕ 버튼 · 닫히지 않는 모달 · 저장하지 않은 변경 닫기 확인 · 화면 나가기 확인 · 비동기 확인 다이얼로그. sections.tsx가 관련 절 뒤에 끼워 넣는다
import { useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import {
  Button,
  CloseButton,
  CopyField,
  Dialog,
  ErrorBlock,
  Field,
  Input,
  Modal,
  ModalPanel,
  Notice,
  ScreenState,
  useUnsavedClose,
} from '@/ui';
import { useLeaveGuard } from '../../app/useLeaveGuard';
import { GUIDE_LAYER_BOX } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';
import { useBox } from './useBox';

const GUIDE_BOX = { ...GUIDE_LAYER_BOX, height: 520 } as const;
/** 비동기 확인 예시의 가짜 지연 */
const GUIDE_CONFIRM_MS = 800;
const GUIDE_DELETE_RAW = 'HTTP 409 Conflict\n{"code":"IN_USE","detail":"connector is published"}';

/** 한 번만 보이는 값(DESIGN 층 선택) — form 결과 단계: 안내 Notice info + CopyField + 발 `닫기`(secondary)만, dismissible=false */
function GuideSecretModal() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>발급 모달 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_BOX}>
          {box ? (
            <Modal
              open={open}
              onOpenChange={setOpen}
              container={box}
              kind="form"
              dismissible={false}
              title="인증 키 발급"
              footer={{
                actions: <Button onClick={() => setOpen(false)}>닫기</Button>,
              }}
            >
              <Notice
                tone="info"
                title="인증 키는 지금 한 번만 보입니다"
                body="닫은 뒤에는 다시 볼 수 없어 새로 발급해야 합니다."
              />
              <CopyField label="인증 키" value="sk_live_7f3a9c2e41db" onCopy={() => {}} />
            </Modal>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** 비동기 확인 — confirm preventDefault → Dialog busy → 성공이면 닫힘, 실패면 열어 둔 채 ErrorBlock */
function GuideAsyncDialog() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);
  const attempts = useRef(0);
  const openDialog = () => {
    setErrorRaw(null);
    setOpen(true);
  };
  const confirm = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setBusy(true);
    attempts.current += 1;
    // 홀수 번째는 실패, 짝수 번째는 성공 — 두 결과를 차례로 본다
    const isFailure = attempts.current % 2 === 1;
    setTimeout(() => {
      setBusy(false);
      if (isFailure) {
        setErrorRaw(GUIDE_DELETE_RAW);
        return;
      }
      setOpen(false);
    }, GUIDE_CONFIRM_MS);
  };
  return (
    <>
      <div className={styles.row}>
        <Button onClick={openDialog}>삭제 다이얼로그 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_BOX}>
          {box ? (
            <Dialog
              open={open}
              onOpenChange={setOpen}
              busy={busy}
              container={box}
              title="커넥터를 삭제할까요"
              description="삭제하면 엔드포인트가 바로 닫히고 되돌릴 수 없습니다."
              actions={{
                cancel: <Button>취소</Button>,
                confirm: (
                  <Button variant="danger" onClick={confirm}>
                    {busy ? '삭제하는 중…' : '삭제'}
                  </Button>
                ),
              }}
            >
              {errorRaw ? <ErrorBlock raw={errorRaw} onCopy={() => true} /> : null}
            </Dialog>
          ) : null}
        </div>
      </div>
    </>
  );
}

const GUIDE_SAVED_NAME = '계약 원장 DB';

/** 저장하지 않은 변경 — 바뀐 값이 있으면 ✕ · Esc · 바깥 클릭 · 닫기에 확인 Dialog, 발 note, 바뀐 것이 없으면 저장 비활성 */
function GuideUnsavedModal() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(GUIDE_SAVED_NAME);
  const [name, setName] = useState(GUIDE_SAVED_NAME);
  const isDirty = name.trim() !== saved;
  const close = () => {
    setOpen(false);
    setName(saved);
  };
  const unsaved = useUnsavedClose({ isDirty, onClose: close, container: box });
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>편집 모달 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_BOX}>
          {box ? (
            <Modal
              open={open}
              onOpenChange={(next) => (next ? setOpen(true) : unsaved.requestClose())}
              container={box}
              kind="form"
              title="소스 이름 수정"
              footer={{
                note: unsaved.note,
                actions: (
                  <>
                    <Button onClick={unsaved.requestClose}>닫기</Button>
                    <Button
                      variant="primary"
                      disabled={!isDirty || name.trim() === ''}
                      onClick={() => setSaved(name.trim())}
                    >
                      저장
                    </Button>
                  </>
                ),
              }}
            >
              <Field label="소스 이름" description="목록 · 알림에 보이는 이름">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </Modal>
          ) : null}
          {unsaved.dialog}
        </div>
      </div>
    </>
  );
}

const GUIDE_LEAVE_NAME = '계약 원장 DB';

/** 화면 나가기 확인 — 값을 바꾼 채 다른 경로로 가면 확인 Dialog(나가기 danger · 취소), 바꾸지 않았으면 바로 간다 */
function GuideLeaveGuard() {
  const [name, setName] = useState(GUIDE_LEAVE_NAME);
  const guard = useLeaveGuard({ isDirty: name !== GUIDE_LEAVE_NAME });
  return (
    <>
      <Field label="소스 이름" description="목록 · 알림에 보이는 이름">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <span className={styles.caption}>값을 바꾼 뒤 아래 링크를 누르면 확인이 뜬다</span>
      <div className={styles.row}>
        <Button variant="link" asChild>
          <Link to="/">대시보드로</Link>
        </Button>
      </div>
      {guard.dialog}
    </>
  );
}

/** 설정 모달 내용 열 예시 상자(내용 열 ≈ 584) — 레이아웃 고정폭 */
const GUIDE_PANEL_FRAME = {
  display: 'flex',
  width: 584,
  height: 176,
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)',
  overflow: 'hidden',
} as const;
const GUIDE_PANEL_RAW = 'INTERNAL (500)\nupstream timeout after 30s';

export const MODAL_PANEL_SECTION: GuideSection = {
  group: '층',
  name: 'ModalPanel',
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
      <div className={styles.cell}>
        <span className={styles.caption}>불러오는 중 — 탭 없이 내용 열을 직접 쓴다</span>
        <div style={GUIDE_PANEL_FRAME}>
          <ModalPanel>
            <ScreenState kind="loading" inline label="소스를 불러오는 중…" />
          </ModalPanel>
        </div>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>실패 원문 — ErrorBlock 그대로</span>
        <div style={GUIDE_PANEL_FRAME}>
          <ModalPanel>
            <ErrorBlock raw={GUIDE_PANEL_RAW} onCopy={() => true} />
          </ModalPanel>
        </div>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>안의 Field는 최대 폭 --w-field</span>
        <div style={GUIDE_PANEL_FRAME}>
          <ModalPanel>
            <Field label="소스 이름">
              <Input defaultValue="계약 원장 DB" />
            </Field>
          </ModalPanel>
        </div>
      </div>
    </div>
  ),
};

const CLOSE_BUTTON_SIZES = [22, 24, 26] as const;

export const CLOSE_BUTTON_SECTION: GuideSection = {
  group: '층',
  name: 'CloseButton',
  render: () => (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <span className={styles.caption}>
          filled(기본) — 22 AlertPanel · 24 Modal · 26 PageHeader
        </span>
        <div className={styles.row}>
          {CLOSE_BUTTON_SIZES.map((size) => (
            <CloseButton key={size} size={size} />
          ))}
        </div>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>ghost — 목록 항목 빼기(흐름 바구니)</span>
        <div className={styles.row}>
          <CloseButton variant="ghost" aria-label="계약 원장 DB 빼기" />
        </div>
      </div>
    </div>
  ),
};

export const MODAL_DISMISSIBLE_SECTION: GuideSection = {
  group: '층',
  name: 'Modal dismissible',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        dismissible=false — 한 번만 보이는 값. Esc · 바깥 클릭으로 닫히지 않고 ✕ · 닫기만 닫는다
      </span>
      <GuideSecretModal />
    </div>
  ),
};

export const DIALOG_ASYNC_SECTION: GuideSection = {
  group: '층',
  name: 'Dialog 비동기 확인',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        데이터를 잃는 확인 = danger · 취소 · 확인 preventDefault → 진행형 라벨 → 성공이면 닫힘 /
        실패면 열어 둔 채 ErrorBlock(첫 시도 실패 · 다음 시도 성공)
      </span>
      <GuideAsyncDialog />
    </div>
  ),
};

export const MODAL_UNSAVED_SECTION: GuideSection = {
  group: '층',
  name: 'Modal 저장하지 않은 변경',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        useUnsavedClose — 바뀐 값이 있으면 ✕ · Esc · 바깥 클릭 · 닫기에 확인 Dialog(닫기 danger ·
        취소) · 발 note 저장하지 않은 변경 · 바뀐 것이 없으면 저장 비활성
      </span>
      <GuideUnsavedModal />
    </div>
  ),
};

export const LEAVE_GUARD_SECTION: GuideSection = {
  group: '층',
  name: '화면 나가기 확인',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        useLeaveGuard — 바뀐 값이 있는 채 다른 경로로 가면 확인 Dialog(나가기 danger · 취소) · 같은
        경로 안 이동(검색 문자열)은 막지 않는다 · 저장 · 삭제 성공 뒤 이동은 allowLeave() 다음에
      </span>
      <GuideLeaveGuard />
    </div>
  ),
};

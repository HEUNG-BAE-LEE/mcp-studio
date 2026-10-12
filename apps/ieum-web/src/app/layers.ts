// 공용 층 저장소 — 드로어 한 칸 · 모달 한 칸. 옛 콘솔의 #drawer · #modal 두 자리와 같다(옛 js/common/overlay.js)
// 칸은 따로라 함께 열릴 수 있고 모달이 위다(옛은 마법사를 연 채 재인증 모달을 띄웠다 — js/menu/sources.js:179 credTarget).
// 여는 쪽: 대시보드 "원본 시스템 연결" · 알림 "다시 인증" · 구조도 err 원본, 원본 목록 행 · 툴바 · 관리 버튼 · 자동 탐색 작업 표 "삭제",
// 탐색 결과 표 행 · 변환 스튜디오 "탐색 근거 보기"(근거 드로어 — 옛은 두 곳이 같은 #drawer를 열었다, js/menu/discovery.js:279,397 · js/menu/studio.js:63),
// AI 연결 배포 화면(묶음 만들기 · 수정 · 삭제 확인 · 배포 확인 · 중지 확인 · 서버 로그 · 키 발급 · 키 폐기 확인)과 배포 쓰기 요청(시작 실패 · 키 결과 —
// 옛 openModal을 그때그때 불렀다, js/menu/deploy.js:119-121,176-177).
// 칸을 그리는 것은 앱 층의 층 호스트(RootLayout의 셸 옆)다. 메뉴가 바뀌면 열린 층을 닫는 일은 셸(ui/layers closeAllLayers)이 하고,
// 호스트가 그때 closeLayer로 칸을 비운다. 층 종류는 그 메뉴를 옮길 때 이 유니온에 더한다
//
// 층마다 attemptId — 열 때마다 늘어나는 번호다(두 칸이 같은 수열을 쓴다). 열린 채 다시 열어도 새 번호가 된다:
// 같은 마법사 · 같은 원본의 모달을 다시 열면 새 시도라 이전 입력 · 진행 중 요청이 새 층에 섞이지 않는다(옛 wzOpen · reauth가
// 부를 때마다 상태를 새로 만들었다 — js/menu/sources.js:46-50,135). 호스트는 층 본문의 React key로 쓴다
//
// 쓰기 요청의 옵션 콜백(화면이 사라져도 돈다 — app/sources/useSourceMutations · app/discovery/useDiscoveryMutations)은 React 밖이라
// 훅 대신 아래 읽기 · 조건부 닫기를 쓴다:
// - isWizardShowing(attemptId): 드로어 칸이 아직 그 시도의 마법사인가 — 아니면(닫힘 · 다시 열기 · 메뉴 이동) 결과를 토스트로 알린다
// - closeModalIf(target): 모달 칸이 그 종류 · 그 대상(원본 · 탐색 작업 · 묶음 · 키)일 때만 비운다 — 요청 중 다른 대상의 모달로 바뀌었으면 그 모달은 두고,
//   옛은 성공하면 지금 모달을 무엇이든 닫았다(js/menu/sources.js:138,149 · js/menu/discovery.js:392 · js/menu/deploy.js:112,163,181,201,206 closeModal)
// - isModalShowing(target): 모달 칸이 지금 그 종류 · 그 대상인가 — 배포 실패를 확인 창 안에 둘지 토스트로 알릴지 가른다
// - openStartError · openKeyReveal: 배포 쓰기가 끝난 뒤 모달 칸을 시작 실패 · 키 결과로 바꾼다(열려 있던 모달은 내용 교체)
// 비교는 종류와 대상 id만 본다(ModalMatch) — 배포 확인의 기준 시각 · 키 원문 같은 내용과 attemptId는 견주지 않는다
// 모듈 상태라 새로고침하면 빈다
import type { DiscoveryApi, JobOpts } from '../api/types';
import { createStore, useStore } from './store';

/** 연결 마법사 — 열 때마다 새 시도라 이전 입력 · 진행 중 요청이 새 마법사에 섞이지 않는다 */
export type WizardLayer = Readonly<{ kind: 'wizard'; attemptId: number }>;

/** 근거 드로어가 보일 API 하나와 그 작업의 설정 · 선택 — 여는 쪽(결과 표 · 스튜디오 안내 띠)이 가진 값을 그대로 넣는다 */
export type EvidenceTarget = Readonly<{
  jobId: string;
  api: DiscoveryApi;
  /** 그 작업의 설정 — 소스 · 트래픽 근거가 없을 때의 문구와 마스킹 안내를 고른다 */
  opts: JobOpts;
  /** 발에 선택 토글을 둘지 — 검토 대기 작업의 결과 표에서 연 것만(옛 discEvidenceFor :359) */
  canSelect: boolean;
  /** 연 순간 선택돼 있었는가 — 토글 글자("선택에서 빼기" · "선택에 추가")를 고른다 */
  isSelected: boolean;
  /** 선택 토글 — 결과 화면이 준 선택 바꾸기. 호스트가 부른 뒤 드로어를 닫는다(옛 dselToggle :399) */
  onToggle?: () => void;
}>;
export type EvidenceLayer = EvidenceTarget & Readonly<{ kind: 'evidence'; attemptId: number }>;

export type DrawerLayer = WizardLayer | EvidenceLayer;

/** 모달 칸이 보이는 대상 — 종류와 원본 · 탐색 작업 · 묶음 · 키. 조건부 닫기가 종류와 대상 id로 자기 칸인지 알아본다 */
export type SourceModalTarget = Readonly<{ kind: 'reauth'; sourceId: string }> | Readonly<{ kind: 'deleteSource'; sourceId: string }>;

/** 배포 확인을 보내는 함수 — 배포 화면의 요청 인스턴스(app/deploy/useDeployToolset)가 준다. dirtyIds는 누르는 순간 먼저 저장할 도구 */
export type DeployRequest = (dirtyIds: readonly string[]) => void;

/**
 * AI 연결 배포 층(옛 openModal 호출 — js/menu/deploy.js:141-212). 묶음 삭제 확인은 수정 창 자리에 바꿔 끼운다.
 * 배포 확인의 since는 연 순간의 기준 시각(app/deploy/useDeployToolset deployBaseline), onDeploy는 연 화면의 배포 요청 —
 * 근거 드로어의 onToggle처럼 여는 쪽이 넘긴다. 서버 로그는 받은 줄과 읽은 시각(새로 읽기는 replaceServerLog로 같은 시도에 바꾼다)
 */
export type DeployModalTarget =
  | Readonly<{ kind: 'toolsetCreate' }>
  | Readonly<{ kind: 'toolsetEdit'; toolsetId: string }>
  | Readonly<{ kind: 'toolsetDelete'; toolsetId: string }>
  | Readonly<{ kind: 'deployConfirm'; toolsetId: string; since: number; onDeploy: DeployRequest }>
  | Readonly<{ kind: 'stopConfirm'; toolsetId: string }>
  | Readonly<{ kind: 'startError'; toolsetId: string; message: string }>
  | Readonly<{ kind: 'serverLog'; toolsetId: string; lines: readonly string[]; readAt: number }>
  | Readonly<{ kind: 'keyIssue' }>
  | Readonly<{ kind: 'keyReveal'; secret: string }>
  | Readonly<{ kind: 'keyRevoke'; keyId: string }>;
export type DeployModalKind = DeployModalTarget['kind'];

export type ModalTarget = SourceModalTarget | Readonly<{ kind: 'deleteJob'; jobId: string }> | DeployModalTarget;

/** 조건부 닫기 · 보이는지 묻기에 넘기는 모양 — 종류와 대상 id만 */
export type ModalMatch =
  | SourceModalTarget
  | Readonly<{ kind: 'deleteJob'; jobId: string }>
  | Readonly<{ kind: 'toolsetCreate' | 'keyIssue' | 'keyReveal' }>
  | Readonly<{
      kind: 'toolsetEdit' | 'toolsetDelete' | 'deployConfirm' | 'stopConfirm' | 'startError' | 'serverLog';
      toolsetId: string;
    }>
  | Readonly<{ kind: 'keyRevoke'; keyId: string }>;
export type ModalLayer = ModalTarget &
  Readonly<{
    /** 열 때마다 늘어난다 — 같은 대상의 모달을 다시 열어도 새 입력 · 새 요청 상태로 시작한다 */
    attemptId: number;
  }>;
export type LayerSlot = 'drawer' | 'modal';

type Layers = Readonly<{ drawer: DrawerLayer | null; modal: ModalLayer | null }>;

const layerStore = createStore<Layers>({ drawer: null, modal: null });
let lastAttemptId = 0;

const nextAttemptId = (): number => {
  lastAttemptId += 1;
  return lastAttemptId;
};

const openModal = (target: ModalTarget): void => {
  const modal: ModalLayer = { ...target, attemptId: nextAttemptId() };
  layerStore.set((prev) => ({ ...prev, modal }));
};

/** 연결 마법사 드로어를 연다. 이미 열려 있어도 새 시도로 다시 연다 */
export function openWizard(): void {
  const drawer: DrawerLayer = { kind: 'wizard', attemptId: nextAttemptId() };
  layerStore.set((prev) => ({ ...prev, drawer }));
}

/**
 * 탐색 근거 드로어를 연다 — 여는 쪽이 이미 가진 API 값으로 바로 연다(결과 표). 받고 나서 여는 길(스튜디오)은 app/discovery/openEvidence.
 * 드로어 칸 하나라 열린 마법사 · 다른 근거는 이것으로 바뀐다(옛 #drawer 한 칸)
 */
export function openEvidenceDrawer(target: EvidenceTarget): void {
  const drawer: DrawerLayer = { ...target, kind: 'evidence', attemptId: nextAttemptId() };
  layerStore.set((prev) => ({ ...prev, drawer }));
}

/** 원본 시스템 인증 다시 입력 모달을 연다 */
export function openReauth(sourceId: string): void {
  openModal({ kind: 'reauth', sourceId });
}

/** 원본 시스템 삭제 확인 모달을 연다 */
export function openDeleteSource(sourceId: string): void {
  openModal({ kind: 'deleteSource', sourceId });
}

/** 자동 탐색 기록 삭제 확인 모달을 연다(작업 표 "삭제" — 옛 discDel :389-394) */
export function openDeleteJob(jobId: string): void {
  openModal({ kind: 'deleteJob', jobId });
}

/** 도구 묶음 만들기 창(옛 tsNew — js/menu/deploy.js:200) */
export function openToolsetCreate(): void {
  openModal({ kind: 'toolsetCreate' });
}

/** 도구 묶음 수정 창(옛 tsEdit :203-208) */
export function openToolsetEdit(toolsetId: string): void {
  openModal({ kind: 'toolsetEdit', toolsetId });
}

/** 도구 묶음 삭제 확인 — 수정 창의 "삭제"가 같은 칸을 이 확인으로 바꾼다(옛은 확인 없이 지웠다 :209-212) */
export function openToolsetDelete(toolsetId: string): void {
  openModal({ kind: 'toolsetDelete', toolsetId });
}

/** 배포 확인 창(옛 deploy :141-155) */
export function openDeployConfirm(toolsetId: string, since: number, onDeploy: DeployRequest): void {
  openModal({ kind: 'deployConfirm', toolsetId, since, onDeploy });
}

/** 서버 중지 확인(옛 tsStop :161-164) */
export function openStopConfirm(toolsetId: string): void {
  openModal({ kind: 'stopConfirm', toolsetId });
}

/** 서버 시작 실패 창 — 서버 문장 원문(옛 deployError :119-121). 배포 화면에 있을 때만 시작 요청이 부른다 */
export function openStartError(toolsetId: string, message: string): void {
  openModal({ kind: 'startError', toolsetId, message });
}

/** 서버 로그 창 — 받은 뒤에 연다(옛 tsLog :165-171) */
export function openServerLog(toolsetId: string, lines: readonly string[], readAt: number): void {
  openModal({ kind: 'serverLog', toolsetId, lines, readAt });
}

/**
 * 열린 서버 로그 창의 줄만 바꾼다("새로 읽기") — 같은 시도라 첫 포커스를 다시 잡지 않고 누른 버튼에 남는다.
 * 모달 칸이 그 묶음의 서버 로그가 아니면(닫힘 · 다른 창) 두고 false
 */
export function replaceServerLog(toolsetId: string, lines: readonly string[], readAt: number): boolean {
  const { modal } = layerStore.get();
  if (modal === null || modal.kind !== 'serverLog' || modal.toolsetId !== toolsetId) return false;
  const next: ModalLayer = { ...modal, lines, readAt };
  layerStore.set((prev) => ({ ...prev, modal: next }));
  return true;
}

/** 액세스 키 발급 창(옛 keyNew :172) */
export function openKeyIssue(): void {
  openModal({ kind: 'keyIssue' });
}

/** 발급한 키 결과 — 모달 칸을 결과로 바꾼다(발급 창이 닫혔거나 메뉴를 옮겼어도 연다). 원문은 이 층에만 두고 닫는 순간 비운다(app/LayerHost) */
export function openKeyReveal(secret: string): void {
  openModal({ kind: 'keyReveal', secret });
}

/** 액세스 키 폐기 확인(옛 keyRevoke :180-181) */
export function openKeyRevoke(keyId: string): void {
  openModal({ kind: 'keyRevoke', keyId });
}

/** 그 칸만 비운다. 이미 비었으면 알리지 않는다 */
export function closeLayer(slot: LayerSlot): void {
  layerStore.set((prev) => {
    if (prev[slot] === null) return prev;
    return slot === 'drawer' ? { ...prev, drawer: null } : { ...prev, modal: null };
  });
}

/** 드로어 칸이 아직 그 시도의 마법사인가. React 밖(쓰기 요청 콜백)에서 읽는다 — 화면은 useDrawerLayer */
export function isWizardShowing(attemptId: number): boolean {
  const { drawer } = layerStore.get();
  return drawer !== null && drawer.kind === 'wizard' && drawer.attemptId === attemptId;
}

/** 드로어 칸의 지금 층 — React 밖에서 "그 사이 다른 층이 열렸나"를 볼 때 읽는다(근거를 받고 나서 열기) */
export const currentDrawerLayer = (): DrawerLayer | null => layerStore.get().drawer;

/** 모달 대상의 원본 · 작업 · 묶음 · 키 id. 대상이 없는 층(만들기 · 키 발급 · 키 결과)은 빈 글 — 키 원문은 id로 쓰지 않는다 */
export function modalTargetIdOf(target: ModalMatch): string {
  if ('sourceId' in target) return target.sourceId;
  if ('jobId' in target) return target.jobId;
  if ('toolsetId' in target) return target.toolsetId;
  if ('keyId' in target) return target.keyId;
  return '';
}

const isSameTarget = (layer: ModalLayer, target: ModalMatch): boolean =>
  layer.kind === target.kind && modalTargetIdOf(layer) === modalTargetIdOf(target);

const DEPLOY_MODAL_KINDS: ReadonlySet<string> = new Set<DeployModalKind>([
  'toolsetCreate',
  'toolsetEdit',
  'toolsetDelete',
  'deployConfirm',
  'stopConfirm',
  'startError',
  'serverLog',
  'keyIssue',
  'keyReveal',
  'keyRevoke',
]);

/** 배포 층인가 — 층 호스트가 내용을 배포 쪽(app/deploy/useDeployModalContent)에서 받을지 가른다 */
export const isDeployModalLayer = (layer: ModalLayer): layer is Extract<ModalLayer, DeployModalTarget> =>
  DEPLOY_MODAL_KINDS.has(layer.kind);

/** 모달 칸이 지금 그 종류 · 그 대상인가. React 밖(쓰기 요청 콜백)에서 읽는다 */
export function isModalShowing(target: ModalMatch): boolean {
  const { modal } = layerStore.get();
  return modal !== null && isSameTarget(modal, target);
}

/** 모달 칸이 그 종류 · 그 대상일 때만 비운다(다른 대상으로 바뀌었으면 둔다). 비웠으면 true */
export function closeModalIf(target: ModalMatch): boolean {
  if (!isModalShowing(target)) return false;
  closeLayer('modal');
  return true;
}

const selectDrawer = (state: Layers) => state.drawer;
const selectModal = (state: Layers) => state.modal;

/** 드로어 칸의 지금 층. 비었으면 null */
export const useDrawerLayer = (): DrawerLayer | null => useStore(layerStore, selectDrawer);
/** 모달 칸의 지금 층. 비었으면 null */
export const useModalLayer = (): ModalLayer | null => useStore(layerStore, selectModal);

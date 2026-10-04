// apps/web/src/copy/common.ts — 화면이 달라도 같은 말: 취소 · 태그 라벨 · 나가기 확인(LEAVE_LABELS)(DESIGN Copy UI 공용 어휘). 저장하지 않은 변경 문구는 ui `UNSAVED_LABELS`(useUnsavedClose)
/** Dialog · InlineConfirm · 폼 발의 취소 버튼 — 원본은 ui(`ui/lib/labels` — 컴포넌트 기본 라벨과 한 곳). copy 틀은 여기서 가져온다 */
export { CANCEL_LABEL } from '@/ui';

/** 태그 칸 라벨 — 프로젝트 폼 · 소스 정보가 같은 말 */
export const TAGS_LABEL = '태그';

/** 화면 안 폼의 나가기 확인(app/useLeaveGuard) — 닫기 확인(ui UNSAVED_LABELS)과 같은 꼴 */
export const LEAVE_LABELS = {
  title: '저장하지 않고 나갈까요?',
  discard: '나가기',
} as const;

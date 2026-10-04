// 흐름 · 설정 모달 카탈로그 예시 값(소스 연결 흐름 · 설정 모달의 폭과 문구)
import type { KeyValueItem, TabItem } from '@/ui';

/** 설정 모달 내용 열 폭 = 820 − 레일 188 − 내용 좌우 24 × 2 */
export const SETTINGS_CONTENT_WIDTH = 584;

export const GUIDE_RAIL_ITEMS: TabItem[] = [
  { value: 'status', label: '상태 · 수집', note: '수집 완료' },
  { value: 'connection', label: '접속 정보', note: '4항목' },
  { value: 'connector', label: '커넥터 만들기', note: '' },
  { value: 'info', label: '소스 정보', note: '' },
];

export const GUIDE_SETTINGS_STATE: KeyValueItem[] = [
  { key: '상태', value: '수집 완료 — 정상' },
  { key: '마지막 수집', value: '2026-09-10 03:00' },
  { key: '다음 예정', value: '매일 03:00' },
  { key: '산출물', value: '객체 타입 12 · 승인 대기 2' },
];

export const GUIDE_SETTINGS_LOG: readonly string[] = [
  '03:00:02  수집 시작 — 스키마 contract',
  '03:00:14  표 34개 확인',
  '03:02:41  객체 타입 12개 만듦',
  '03:02:44  승인 대기 2건 — 온톨로지 › 객체 타입에서 확인',
];

/** 흐름 폼 안 폭 586 = 620 − 2 − 16×2 */
export const FLOW_FORM_WIDTH = 586;
/** 진행 항목 막대 폭 252 = 패널 안 278 − 2 − 12×2 */
export const RUN_ITEM_WIDTH = 252;

export const FILE_DROP_LINES = ['파일을 여기로 끌어 놓거나,', '여기를 눌러 첨부합니다.'] as const;
export const FILE_DROP_FORMATS = 'PDF · DOCX · XLSX';
export const GIT_AUTO_NOTE =
  '호출 지점을 그대로 도구로 옮깁니다. 고도화 단계에서 손댈 것이 가장 적습니다.';

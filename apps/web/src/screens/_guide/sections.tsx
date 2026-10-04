import type { ReactNode } from 'react';
import { BASIC_SECTIONS } from './sectionsBasics';
import { MARK_SECTIONS } from './sectionsMarks';
import { DATA_SECTIONS } from './sectionsData';
import { STATE_SECTIONS } from './sectionsStates';
import { OVERLAY_SECTIONS } from './sectionsOverlays';
import { PANEL_SECTIONS } from './sectionsPanels';
import { LAYOUT_SECTIONS } from './sectionsLayout';
import { FIELD_SECTION, SEGMENTED_SIZE_SECTION } from './sectionsForm';
import {
  FIELD_TAG_INPUT_SECTION,
  READ_ONLY_SECTION,
  SECTION_HEAD_NOTE_SECTION,
  SETTING_ROW_SECTION,
  SUMMARY_DELTA_SECTION,
} from './sectionsSettings';
import {
  CLOSE_BUTTON_SECTION,
  DIALOG_ASYNC_SECTION,
  LEAVE_GUARD_SECTION,
  MODAL_DISMISSIBLE_SECTION,
  MODAL_PANEL_SECTION,
  MODAL_UNSAVED_SECTION,
} from './sectionsLayers';
import {
  FIELD_GROUP_SECTION,
  FLOW_STEP_HEAD_SECTION,
  INLINE_CONFIRM_REJECTION_SECTION,
  INLINE_MESSAGE_SECTION,
  REASON_LINE_SECTION,
  ROW_MENU_SECTION,
  STEP_LIST_SECTION,
  VISUALLY_HIDDEN_SECTION,
} from './sectionsParts';
import {
  BUTTON_SM_PLUS_SECTION,
  COPY_FIELD_SECTION,
  ICON_BUTTON_FILLED_SECTION,
  INPUT_SM_PLUS_SECTION,
  METRIC_CARD_SECTION,
  PAGE_HEADER_DETAIL_SECTION,
  SECTION_HEAD_SECTION,
  SEGMENT_BAR_SECTION,
  TABLE_LINES_SECTION,
  STATUS_CHIP_IDLE_SECTION,
  TAG_PROJECT_SECTION,
} from './sectionsDetail';
import {
  FILE_DROP_SECTION,
  ICON_SECTION,
  ILLUST_SECTION,
  LABEL_HINT_SECTION,
  LOG_VIEW_SOFT_SECTION,
  PROGRESS_BAR_SECTION,
  SETTINGS_VALUES_SECTION,
  TABS_RAIL_SECTION,
  TOGGLE_CHIP_SECTION,
  TOOLTIP_NOTE_SECTION,
} from './sectionsFlow';
import {
  INLINE_EDIT_SECTION,
  PAGE_BODY_SECTION,
  PAGE_HEADER_BACK_SECTION,
  SCREEN_STATE_SECTION,
  SECTION_SEARCH_SECTION,
  TAG_INPUT_SECTION,
} from './sectionsFrames';
import { REGION_SECTION, SELECT_XL_SECTION, TABLE_DYNAMIC_SECTION } from './sectionsRegions';

export type GuideSection = { group: string; name: string; render: () => ReactNode };

/** 기본 절 — 그룹 파일 배열을 COMPONENTS.md 절 순서(기본 → 표식 → 데이터 → 상태 표현 → 층 → 레이아웃 → 아이콘)대로 잇는다. 새 기본 절은 그룹 파일 배열에 */
const BASE_SECTIONS: GuideSection[] = [
  ...BASIC_SECTIONS,
  ...MARK_SECTIONS,
  ...DATA_SECTIONS,
  ...STATE_SECTIONS,
  ...OVERLAY_SECTIONS,
  ...PANEL_SECTIONS,
  ...LAYOUT_SECTIONS,
];

/**
 * 그룹 파일(`*_SECTIONS` 배열) 밖의 변형 절(`sectionsX.tsx`의 `X_SECTION`)을 관련 절 바로 뒤에 둔다 — 목차 · 본문 순서가 같게.
 * 새 절 = 해당 `sectionsX.tsx`에 `export const X_SECTION` → `INSERT_AFTER`에 이웃 기본 절 키 뒤 한 줄 → COMPONENTS `**카탈로그**`에 같은 이름
 */
const INSERT_AFTER: Readonly<Record<string, readonly GuideSection[]>> = {
  Button: [BUTTON_SM_PLUS_SECTION],
  IconButton: [ICON_BUTTON_FILLED_SECTION],
  Tabs: [TABS_RAIL_SECTION],
  Input: [
    INPUT_SM_PLUS_SECTION,
    LABEL_HINT_SECTION,
    FIELD_SECTION,
    FIELD_GROUP_SECTION,
    INLINE_MESSAGE_SECTION,
    REASON_LINE_SECTION,
    READ_ONLY_SECTION,
    INLINE_EDIT_SECTION,
    TAG_INPUT_SECTION,
    FIELD_TAG_INPUT_SECTION,
    VISUALLY_HIDDEN_SECTION,
  ],
  SegmentedControl: [SEGMENTED_SIZE_SECTION],
  StatusChip: [STATUS_CHIP_IDLE_SECTION],
  Tooltip: [TOOLTIP_NOTE_SECTION, FILE_DROP_SECTION, ICON_SECTION, ILLUST_SECTION],
  Tag: [TAG_PROJECT_SECTION],
  Select: [SELECT_XL_SECTION],
  'Checkbox · Switch': [TOGGLE_CHIP_SECTION],
  Table: [TABLE_LINES_SECTION, ROW_MENU_SECTION, TABLE_DYNAMIC_SECTION],
  InlineConfirm: [INLINE_CONFIRM_REJECTION_SECTION],
  FlowOverlay: [FLOW_STEP_HEAD_SECTION],
  HelperPanel: [STEP_LIST_SECTION],
  RowCard: [SECTION_HEAD_SECTION, SECTION_HEAD_NOTE_SECTION, SECTION_SEARCH_SECTION],
  SummaryCard: [SUMMARY_DELTA_SECTION, METRIC_CARD_SECTION, SEGMENT_BAR_SECTION],
  KeyValue: [
    SETTING_ROW_SECTION,
    COPY_FIELD_SECTION,
    SETTINGS_VALUES_SECTION,
    PROGRESS_BAR_SECTION,
  ],
  ErrorBlock: [SCREEN_STATE_SECTION],
  Notice: [CLOSE_BUTTON_SECTION],
  Modal: [
    MODAL_DISMISSIBLE_SECTION,
    MODAL_UNSAVED_SECTION,
    LEAVE_GUARD_SECTION,
    MODAL_PANEL_SECTION,
  ],
  Dialog: [DIALOG_ASYNC_SECTION],
  LogView: [LOG_VIEW_SOFT_SECTION],
  PageHeader: [
    PAGE_HEADER_DETAIL_SECTION,
    PAGE_HEADER_BACK_SECTION,
    PAGE_BODY_SECTION,
    REGION_SECTION,
  ],
};

/** 개발 중에만 — INSERT_AFTER 키 오타 · 절 이름 중복을 잡아 절이 조용히 빠지지 않게 한다 */
function assertSections(
  base: readonly GuideSection[],
  inserted: Readonly<Record<string, readonly GuideSection[]>>,
) {
  const baseNames = new Set(base.map((s) => s.name));
  const unknownKey = Object.keys(inserted).find((key) => !baseNames.has(key));
  if (unknownKey) throw new Error(`INSERT_AFTER 키 '${unknownKey}'가 기본 절 이름에 없다`);
  const names = [...base, ...Object.values(inserted).flat()].map((s) => s.name);
  const duplicate = names.find((name, i) => names.indexOf(name) !== i);
  if (duplicate) throw new Error(`카탈로그 절 이름이 겹친다: '${duplicate}'`);
}
if (import.meta.env.DEV) assertSections(BASE_SECTIONS, INSERT_AFTER);

export const SECTIONS: readonly GuideSection[] = BASE_SECTIONS.flatMap((s) => [
  s,
  ...(INSERT_AFTER[s.name] ?? []),
]);

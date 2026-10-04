import type {
  IconName,
  LNBPanelAlert,
  NavItem,
  NavSection,
  Segment,
  SegmentItem,
  SummaryValueTone,
} from '@/ui';
import { projectPath, screenPath } from '../../app/nav';

/** 카탈로그(/_guide) 예시 데이터 — 화면 더미 데이터와 무관한 고정 값 */

// 구성 총합 4칸(SummaryBand · SummaryCard)
type GuideSummaryCard = {
  title: string;
  value: string;
  valueTone: SummaryValueTone;
  segments: readonly Segment[];
};
export const GUIDE_SUMMARY_CARDS: readonly GuideSummaryCard[] = [
  {
    title: '소스',
    value: '8',
    valueTone: 'ink',
    segments: [
      { label: 'DB', value: 3, tone: 'ink-soft' },
      { label: '문서', value: 4, tone: 'muted' },
      { label: 'Git', value: 1, tone: 'faint' },
    ],
  },
  {
    title: '커넥터',
    value: '16',
    valueTone: 'ink',
    segments: [
      { label: '사용 중', value: 8, tone: 'ink-soft' },
      { label: '갱신 중', value: 2, tone: 'progress' },
      { label: '실패', value: 2, tone: 'fix' },
      { label: '미발행', value: 4, tone: 'faint' },
    ],
  },
  {
    title: '도구 (발행 기준)',
    value: '52',
    valueTone: 'ink',
    segments: [
      { label: '호출됨', value: 8, tone: 'ink-soft' },
      { label: '호출 없음', value: 44, tone: 'empty' },
    ],
  },
  {
    title: '점검 필요',
    value: '4',
    valueTone: 'fix',
    segments: [
      { label: '실패', value: 2, tone: 'fix' },
      { label: '갱신 중', value: 2, tone: 'progress' },
    ],
  },
];

/** 연결 설정 6행(KeyValue) */
export const GUIDE_KEY_VALUE_ROWS: { key: string; value: string; mono?: boolean }[] = [
  { key: '엔진', value: 'PostgreSQL 15.4' },
  { key: '호스트 · 포트', value: '10.42.3.18 : 5432', mono: true },
  { key: 'DB명', value: 'policy_core', mono: true },
  { key: '계정', value: 'svc_reader', mono: true },
  { key: '만든 시각', value: '2026-09-08 10:12' },
  { key: '마지막 수집', value: '2026-09-10 13:41 · 4분 12초' },
];

// LNB 펼침 LNBPanel. 대시보드 현재 · Playground 준비 중 · 기본 열림 데이터 가공 · 공유 · 내 프로젝트.
// href는 예시용 '#' — href 있는 하위 항목은 ink-soft, 없는 항목은 faint(pending)
const guideProject = (label: string, i: number) => ({ id: `p-${i}`, label, href: '#' });
export const GUIDE_LNB_TOP_ITEMS: readonly NavItem[] = [
  { id: 'dash', label: '대시보드', icon: 'dashboard', href: '#', active: true },
  { id: 'new', label: '새 프로젝트 생성', icon: 'plus', title: '새 프로젝트 생성' },
  { id: 'play', label: 'Playground', icon: 'playground', href: '#', pending: '준비 중' },
];
export const GUIDE_LNB_SECTIONS: readonly NavSection[] = [
  {
    id: 'work',
    label: '작업 영역',
    groups: [
      {
        id: 'proc',
        label: '데이터 가공',
        icon: 'database',
        expanded: true,
        items: [
          { id: 'ds', label: '데이터 소스', href: '#' },
          { id: 'catalog', label: '데이터 카탈로그', pending: true },
          { id: 'pipe', label: '파이프라인 빌더', href: '#' },
          { id: 'sql', label: 'SQL 스튜디오', href: '#' },
          { id: 'dataset', label: '데이터셋 / 데이터 마트', pending: true },
          { id: 'lineage', label: '데이터 리니지', pending: true },
        ],
      },
      { id: 'onto', label: '온톨로지', icon: 'ontology', expanded: false, items: [] },
      { id: 'rag', label: 'RAG', icon: 'document', expanded: false, items: [] },
    ],
  },
  {
    id: 'projects',
    label: '프로젝트',
    groups: [
      {
        id: 'shared',
        label: '공유받은 프로젝트',
        icon: 'folder-shared',
        expanded: true,
        items: ['코드 검색', '민원 응대 지원', '사내 규정 검색', '재보험 정산'].map(guideProject),
      },
      {
        id: 'mine',
        label: '내 프로젝트',
        icon: 'folder',
        expanded: true,
        items: [
          '계약 변경 이력 조회',
          '상품 약관 검색',
          '지급 통계 리포트',
          '영업 교육 자료',
          '언더라이팅 실험',
          '보험 인수심사',
          '해외 지점 데이터',
          '청구 심사 지원',
        ].map((label, i) => guideProject(label, i + 4)),
      },
    ],
  },
];
export const GUIDE_LNB_ALERT: LNBPanelAlert = { count: 2, tone: 'fix' };

// LNB 검색 `데이터` 결과. 라우트 없는 항목은 pending(faint)
type GuideSearchHit = {
  id: string;
  label: string;
  note: string;
  href?: string;
  pending?: boolean;
  icon?: IconName;
};
type GuideSearchGroup = { label: string; hits: readonly GuideSearchHit[] };
export const GUIDE_SEARCH_HITS: readonly GuideSearchGroup[] = [
  {
    label: '작업 영역',
    hits: [
      { id: 'ds', label: '데이터 소스', note: '데이터 가공', href: screenPath('ds') },
      { id: 'catalog', label: '데이터 카탈로그', note: '데이터 가공', pending: true },
      { id: 'mart', label: '데이터셋 / 데이터 마트', note: '데이터 가공', pending: true },
      { id: 'lineage', label: '데이터 리니지', note: '데이터 가공', pending: true },
      { id: 'mapping', label: '데이터 매핑', note: '온톨로지', pending: true },
    ],
  },
  {
    label: '프로젝트',
    hits: [
      {
        id: 'project_7',
        label: '해외 지점 데이터',
        note: '내 프로젝트',
        href: projectPath('project_7'),
        icon: 'folder',
      },
    ],
  },
];

/** 예시 핸들러 — 누르면 아무 일도 하지 않는다 */
export const noop = () => undefined;

/** 층 예시 상자: 오버레이가 컨테이너를 덮으므로 앱 프레임 대신 relative 상자를 준다. settings 820×552가 들어가는 크기 */
export const GUIDE_LAYER_BOX = {
  position: 'relative',
  width: 1000,
  height: 700,
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)',
  overflow: 'hidden',
} as const;

/** 소스 연결 흐름 단계(FlowOverlay · HelperPanel) */
export const GUIDE_FLOW_STEPS = [
  {
    id: 'type',
    label: '소스 고르기',
    description: '코드 · 데이터베이스 · 문서 중 하나를 고릅니다',
  },
  { id: 'connect', label: '연결', description: '접속 정보를 넣어 담습니다' },
  { id: 'run', label: '읽어오기', description: '담은 순서대로 구조를 읽습니다' },
] as const;

/** 입력 방식 전환(SegmentedControl) 예시 항목 */
export const GUIDE_MODE_ITEMS: readonly SegmentItem[] = [
  { value: 'fields', label: '접속 정보' },
  { value: 'url', label: '연결 문자열' },
];

/** 영역 머리 예시 폭(프로젝트 상세 열 ≈ 474) */
export const GUIDE_HEAD_WIDTH = 474;

/** 화면 틀 예시 프레임 폭 — 1280 · 1024 본문 자리(카탈로그 상자 치수) */
export const GUIDE_FRAME_WIDTH = 976;
export const GUIDE_NARROW_FRAME_WIDTH = 720;

/** 화면 틀 예시 프레임 — 높이는 절마다 다르다(본문 스크롤 확인용) */
export const guideFrameStyle = (width: number, height: number) => ({
  width,
  height,
  display: 'flex',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)',
  overflow: 'hidden',
});

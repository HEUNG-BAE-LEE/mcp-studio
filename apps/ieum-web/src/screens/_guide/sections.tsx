// 카탈로그 절 목록 — 순서가 목차 · 본문 순서다. 새 절은 절 파일(`<Name>Section.tsx`)을 만들고 여기에 한 줄 더한다(공유 파일: 한 번에 한 작업자)
// 부품 절은 group 키 바로 다음에 name 키를 한 줄에 쓴다 — lint/check-docs가 이 쌍을 읽어 docs/COMPONENTS.md의 카탈로그 행과 양방향 대조한다.
// group이 없는 절(토큰처럼 부품이 아닌 절)은 대조에서 빠진다. 이 파일 주석에 그 쌍 모양을 예시로 적지 않는다(check-docs는 주석도 읽는다)
import type { ComponentType } from 'react';
import { BoxSection } from './BoxSection';
import { ButtonSection } from './ButtonSection';
import { CodeBlockSection } from './CodeBlockSection';
import { DrawerSection } from './DrawerSection';
import { EmptyStateSection } from './EmptyStateSection';
import { ErrorBlockSection } from './ErrorBlockSection';
import { FailureBlockSection } from './FailureBlockSection';
import { FilterChipsSection } from './FilterChipsSection';
import { FlowLineSection } from './FlowLineSection';
import { HelpTextSection } from './HelpTextSection';
import { IconButtonSection } from './IconButtonSection';
import { IconsSection } from './IconsSection';
import { InlineCodeSection } from './InlineCodeSection';
import { KeyValueGridSection } from './KeyValueGridSection';
import { LinkButtonSection } from './LinkButtonSection';
import { LogoSection } from './LogoSection';
import { ModalSection } from './ModalSection';
import { NoticeSection } from './NoticeSection';
import { PageHeadSection } from './PageHeadSection';
import { ProgressBarSection } from './ProgressBarSection';
import { RuleChipSection } from './RuleChipSection';
import { ScreenStateSection } from './ScreenStateSection';
import { SearchInputSection } from './SearchInputSection';
import { SelectSection } from './SelectSection';
import { ShellSection } from './ShellSection';
import { SourceStatusSection } from './SourceStatusSection';
import { StatStripSection } from './StatStripSection';
import { StatusChipSection } from './StatusChipSection';
import { StatusDotSection } from './StatusDotSection';
import { TableSection } from './TableSection';
import { TagSection } from './TagSection';
import { ToastSection } from './ToastSection';
import { TokensSection } from './TokensSection';
import { ToolbarSection } from './ToolbarSection';
import { TopologySection } from './TopologySection';
import { TraceViewSection } from './TraceViewSection';
import { TwoColumnSection } from './TwoColumnSection';

export type GuideSection = {
  /** 본문 앵커 · 목차 이동에 쓰는 id(영문 소문자) */
  id: string;
  /** 부품 절만 — COMPONENTS.md의 묶음(`##` 제목). 없으면 부품이 아닌 절(카탈로그 대조에서 빠진다) */
  group?: string;
  /** 목차와 절 제목에 보이는 이름. 부품 절은 COMPONENTS `- **카탈로그**` 행의 값과 같다 */
  name: string;
  Component: ComponentType;
};

export const SECTIONS: readonly GuideSection[] = [
  { id: 'tokens', name: '토큰', Component: TokensSection },
  { id: 'button', group: '기본', name: 'Button', Component: ButtonSection },
  { id: 'icon-button', group: '기본', name: 'IconButton', Component: IconButtonSection },
  { id: 'link-button', group: '기본', name: 'LinkButton', Component: LinkButtonSection },
  { id: 'select', group: '입력', name: 'Select', Component: SelectSection },
  { id: 'search-input', group: '입력', name: 'SearchInput', Component: SearchInputSection },
  { id: 'filter-chips', group: '입력', name: 'FilterChips', Component: FilterChipsSection },
  { id: 'status-chip', group: '표시', name: 'StatusChip', Component: StatusChipSection },
  { id: 'status-dot', group: '표시', name: 'StatusDot', Component: StatusDotSection },
  { id: 'tag', group: '표시', name: 'Tag', Component: TagSection },
  { id: 'inline-code', group: '표시', name: 'InlineCode', Component: InlineCodeSection },
  { id: 'help-text', group: '표시', name: 'HelpText', Component: HelpTextSection },
  { id: 'progress-bar', group: '표시', name: 'ProgressBar', Component: ProgressBarSection },
  { id: 'empty-state', group: '상태 표현', name: 'EmptyState', Component: EmptyStateSection },
  { id: 'failure-block', group: '상태 표현', name: 'FailureBlock', Component: FailureBlockSection },
  { id: 'error-block', group: '상태 표현', name: 'ErrorBlock', Component: ErrorBlockSection },
  { id: 'screen-state', group: '상태 표현', name: 'ScreenState', Component: ScreenStateSection },
  { id: 'notice', group: '상태 표현', name: 'Notice', Component: NoticeSection },
  { id: 'modal', group: '층', name: 'Modal', Component: ModalSection },
  { id: 'drawer', group: '층', name: 'Drawer', Component: DrawerSection },
  { id: 'toast', group: '층', name: 'Toast', Component: ToastSection },
  { id: 'page-head', group: '레이아웃', name: 'PageHead', Component: PageHeadSection },
  { id: 'box', group: '레이아웃', name: 'Box', Component: BoxSection },
  { id: 'toolbar', group: '레이아웃', name: 'Toolbar', Component: ToolbarSection },
  { id: 'two-column', group: '레이아웃', name: 'TwoColumn', Component: TwoColumnSection },
  { id: 'shell', group: '레이아웃', name: '셸', Component: ShellSection },
  { id: 'key-value-grid', group: '데이터', name: 'KeyValueGrid', Component: KeyValueGridSection },
  { id: 'stat-strip', group: '데이터', name: 'StatStrip', Component: StatStripSection },
  { id: 'table', group: '데이터', name: 'Table', Component: TableSection },
  { id: 'code-block', group: '데이터', name: 'CodeBlock', Component: CodeBlockSection },
  { id: 'icons', group: '아이콘', name: 'Icon', Component: IconsSection },
  { id: 'logo', group: '아이콘', name: 'Logo', Component: LogoSection },
  { id: 'source-status', group: '이음 전용', name: 'SourceStatus', Component: SourceStatusSection },
  { id: 'rule-chip', group: '이음 전용', name: 'RuleChip', Component: RuleChipSection },
  { id: 'flow-line', group: '이음 전용', name: 'FlowLine', Component: FlowLineSection },
  { id: 'topology', group: '이음 전용', name: 'Topology', Component: TopologySection },
  { id: 'trace-view', group: '이음 전용', name: 'TraceView', Component: TraceViewSection },
];

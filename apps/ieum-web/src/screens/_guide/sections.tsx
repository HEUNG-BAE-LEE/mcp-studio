// 카탈로그 절 목록 — 순서가 목차 · 본문 순서다. 새 절은 절 파일(`<Name>Section.tsx`)을 만들고 여기에 한 줄 더한다(공유 파일: 한 번에 한 작업자)
// 부품 절은 group 키 바로 다음에 name 키를 한 줄에 쓴다 — lint/check-docs가 이 쌍을 읽어 docs/COMPONENTS.md의 카탈로그 행과 양방향 대조한다.
// group이 없는 절(토큰처럼 부품이 아닌 절)은 대조에서 빠진다. 이 파일 주석에 그 쌍 모양을 예시로 적지 않는다(check-docs는 주석도 읽는다)
import type { ComponentType } from 'react';
import { ButtonSection } from './ButtonSection';
import { EmptyStateSection } from './EmptyStateSection';
import { ErrorBlockSection } from './ErrorBlockSection';
import { FailureBlockSection } from './FailureBlockSection';
import { IconButtonSection } from './IconButtonSection';
import { IconsSection } from './IconsSection';
import { LogoSection } from './LogoSection';
import { ModalSection } from './ModalSection';
import { PageHeadSection } from './PageHeadSection';
import { ScreenStateSection } from './ScreenStateSection';
import { ShellSection } from './ShellSection';
import { TokensSection } from './TokensSection';

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
  { id: 'empty-state', group: '상태 표현', name: 'EmptyState', Component: EmptyStateSection },
  { id: 'failure-block', group: '상태 표현', name: 'FailureBlock', Component: FailureBlockSection },
  { id: 'error-block', group: '상태 표현', name: 'ErrorBlock', Component: ErrorBlockSection },
  { id: 'screen-state', group: '상태 표현', name: 'ScreenState', Component: ScreenStateSection },
  { id: 'modal', group: '층', name: 'Modal', Component: ModalSection },
  { id: 'page-head', group: '레이아웃', name: 'PageHead', Component: PageHeadSection },
  { id: 'shell', group: '레이아웃', name: '셸', Component: ShellSection },
  { id: 'icons', group: '아이콘', name: 'Icon', Component: IconsSection },
  { id: 'logo', group: '아이콘', name: 'Logo', Component: LogoSection },
];

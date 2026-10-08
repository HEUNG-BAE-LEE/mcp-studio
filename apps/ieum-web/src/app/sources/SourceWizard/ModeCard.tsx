// ModeCard — 연결 방식 카드 하나(옛 .mode-card — js/menu/sources.js:55, css/console.css:260-269,821-822,911-914). RadioCard + Tag + iconOf
// 계약: mode(서버 wizard.modes 한 항목) · selected · onSelect(v). 카드 글자 · 아이콘 이름은 서버 값 그대로 그린다(모르는 아이콘은 iconOf 기본 아이콘)
// - 잠긴 카드(isModeLocked — 서버 dis)는 RadioCard disabled라 Tab이 닿지 않고 표지까지 흐려진다
// - 표지: dis → "2차"(neutral), rec → 추천(ok). 자동 탐색 카드는 추천 표지를 단 넓은 카드다
// - rec 카드는 줄 전체 칸(옛 .mode-card.wide)
import type { WizardMode } from '../../../api/types';
import { SOURCES } from '../../../copy/sources';
import { iconOf, RadioCard, Tag } from '@/ui';
import { isModeLocked } from './wizardSteps';
import styles from './ModeCard.module.css';

export type ModeCardProps = Readonly<{
  mode: WizardMode;
  selected: boolean;
  /** 카드를 누름 — 이미 고른 카드여도 부른다(옛 wzMode) */
  onSelect: (mode: string) => void;
}>;

/** 제목 뒤 표지 — 옛 순서 그대로 "2차" 다음 추천 */
function ModeBadges({ mode }: Readonly<{ mode: WizardMode }>) {
  if (!mode.dis && !mode.rec) return null;
  return (
    <>
      {mode.dis ? <Tag tone="neutral">{SOURCES.wizard.laterBadge}</Tag> : null}
      {mode.rec ? <Tag tone="ok">{SOURCES.wizard.recommend}</Tag> : null}
    </>
  );
}

export function ModeCard({ mode, selected, onSelect }: ModeCardProps) {
  return (
    <RadioCard
      icon={iconOf(mode.ic)}
      title={mode.t}
      description={mode.d}
      badges={<ModeBadges mode={mode} />}
      selected={selected}
      onSelect={() => onSelect(mode.v)}
      disabled={isModeLocked(mode)}
      className={mode.rec ? styles.wide : undefined}
    />
  );
}

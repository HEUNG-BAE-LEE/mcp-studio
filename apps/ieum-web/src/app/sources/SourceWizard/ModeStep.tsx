// ModeStep — 1단계 연결 방식(옛 wzBody step 1 — js/menu/sources.js:54-55)
// 안내 한 줄 + 서버 wizard.modes를 묶음(g)별로 — 묶음 순서는 처음 나온 순서, 묶음마다 두 열 카드 격자(760 이하 한 열 — CardGrid)
import { Fragment } from 'react';
import type { WizardMode } from '../../../api/types';
import { SOURCES } from '../../../copy/sources';
import { CardGrid, HelpText } from '@/ui';
import { ModeCard } from './ModeCard';
import styles from './ModeStep.module.css';

export type ModeStepProps = Readonly<{
  modes: readonly WizardMode[];
  /** 고른 연결 방식(v) */
  value: string;
  onSelect: (mode: string) => void;
}>;

type ModeGroup = Readonly<{ name: string; modes: readonly WizardMode[] }>;

/** 묶음 제목별로 — 처음 나온 순서(옛 [...new Set(WZ_MODES.map(m => m.g))]) */
const groupsOf = (modes: readonly WizardMode[]): readonly ModeGroup[] =>
  [...new Set(modes.map((m) => m.g))].map((name) => ({ name, modes: modes.filter((m) => m.g === name) }));

export function ModeStep({ modes, value, onSelect }: ModeStepProps) {
  return (
    <>
      <HelpText className={styles.hint}>{SOURCES.wizard.modeHint}</HelpText>
      {groupsOf(modes).map((group, index) => (
        <Fragment key={group.name}>
          <div className={index === 0 ? `${styles.group} ${styles.groupFirst}` : styles.group}>{group.name}</div>
          <CardGrid columns={2} collapseAt={760}>
            {group.modes.map((mode) => (
              <ModeCard key={mode.v} mode={mode} selected={value === mode.v} onSelect={onSelect} />
            ))}
          </CardGrid>
        </Fragment>
      ))}
    </>
  );
}

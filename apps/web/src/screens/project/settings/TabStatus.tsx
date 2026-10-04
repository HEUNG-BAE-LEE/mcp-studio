// apps/web/src/screens/project/settings/TabStatus.tsx — 상태 · 수집 탭: 4행(KeyValue plain) + 수집 로그 영역(Region — SectionHead h3 + LogView soft, 원문). 로그가 없으면 nothing-yet
import { EmptyState, KeyValue, LogView, Region, SectionHead } from '@/ui';
import type { SourceDetail } from '../../../api/types';
import { SETTINGS, stateRows } from '../../../copy/sourceSettings';
import styles from './settings.module.css';

export function TabStatus({ detail }: { detail: SourceDetail }) {
  return (
    <div className={styles.stack}>
      <KeyValue variant="plain" items={stateRows(detail).map(([key, value]) => ({ key, value }))} />
      <Region as="div">
        <SectionHead as="h3" title={SETTINGS.logTitle} />
        {detail.log.length > 0 ? (
          <LogView variant="soft" lines={detail.log} />
        ) : (
          <EmptyState
            kind="nothing-yet"
            title={SETTINGS.logEmpty.title}
            body={SETTINGS.logEmpty.body}
          />
        )}
      </Region>
    </div>
  );
}

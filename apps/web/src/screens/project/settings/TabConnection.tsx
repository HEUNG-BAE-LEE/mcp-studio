// apps/web/src/screens/project/settings/TabConnection.tsx — 접속 정보 탭: 읽기 전용 값(CopyField, 키 96) + 금고 안내(Notice)
import { CopyField, Notice } from '@/ui';
import type { SourceDetail } from '../../../api/types';
import { SETTINGS, fieldLabel } from '../../../copy/sourceSettings';
import styles from './settings.module.css';

export function TabConnection({ detail }: { detail: SourceDetail }) {
  return (
    <div className={styles.stack}>
      <div className={styles.fields}>
        {detail.connection.map((c) => (
          <CopyField key={c.code} label={fieldLabel(c.code)} value={c.value} />
        ))}
      </div>
      <Notice tone="info" body={SETTINGS.connectionNote} />
    </div>
  );
}

// apps/web/src/screens/dashboard/Reserved.tsx — 빈 영역 자리의 예(샘플): `제목 미정` + 점선 상자. 채울 기능이 아니다
import { useId } from 'react';
import { Region, SectionHead } from '@/ui';
import { DASHBOARD } from '../../copy/dashboard';
import styles from './Reserved.module.css';

export function Reserved() {
  const titleId = useId();
  return (
    <Region aria-labelledby={titleId}>
      <SectionHead
        title={DASHBOARD.reservedTitle}
        titleId={titleId}
        note={DASHBOARD.reservedNote}
      />
      <div className={styles.box} />
    </Region>
  );
}

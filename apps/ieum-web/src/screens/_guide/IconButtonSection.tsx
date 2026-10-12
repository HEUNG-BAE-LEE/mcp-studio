// 카탈로그 IconButton 절 — 기본(아이콘 lg · xl · 비활성)과 파란 띠 위(on-band — 모달 머리). 포커스 링은 Tab으로 본다(on-band는 흰 링)
import { IconButton } from '../../ui';
import catalog from './catalog.module.css';
import styles from './IconButtonSection.module.css';

export function IconButtonSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        --h-sm-plus 정사각 하나. 이름(label)은 aria-label로 필수다. on-band는 파란 띠 위 — 흰 아이콘 · 흰 포커스 링.
      </p>
      <h3 className={catalog.heading}>default</h3>
      <div className={catalog.row}>
        <IconButton label="주소 복사" icon="copy" />
        <IconButton label="닫기" icon="close" iconSize="xl" />
        <IconButton label="주소 복사" icon="copy" disabled />
      </div>
      <h3 className={catalog.heading}>on-band</h3>
      <div className={styles.band}>
        <span>모달 머리</span>
        <IconButton label="닫기" icon="close" iconSize="xl" variant="on-band" />
      </div>
    </div>
  );
}

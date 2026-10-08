// 카탈로그 로고 절 — 절 제목(h2)은 GuideBody가 그린다. 크기 목록은 ui가 내보내는 LOGO_SIZES를 그대로 돈다
import { LOGO_SIZES, Logo } from '../../ui';
import catalog from './catalog.module.css';
import styles from './LogoSection.module.css';

export function LogoSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        크기 {LOGO_SIZES.join(' · ')}는 아이콘 단계 밖의 고유 치수다(GNB · 구조도 허브 · 파이프라인 허브). 색은 currentColor — 쓰는
        곳이 정한다(여기서는 주조).
      </p>
      <ul className={styles.logos}>
        {LOGO_SIZES.map((size) => (
          <li key={size}>
            <Logo size={size} />
            <code>{size}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

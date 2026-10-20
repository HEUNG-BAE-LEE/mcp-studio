// 서비스 레일 — 이음 index.html:14-22 · css/console.css:74-79. 이음(게이트웨이 관리)만 현재이고 나머지 버튼은 동작이 없다 —
// 버튼 그대로 둔다(포커스를 받는다 — 이음 그대로). 760 이하에서 숨긴다(css/console.css:451)
import { Icon, type IconName } from '@/ui';
import { RAIL } from '../../copy/shell';
import styles from './Rail.module.css';

type RailItem = Readonly<{ icon: IconName; label: string; isCurrent?: boolean }>;

// index.html 순서 그대로 — 전체 서비스 뒤에 간격 하나
const LEAD: RailItem = { icon: 'apps', label: RAIL.allServices };
const ITEMS: readonly RailItem[] = [
  { icon: 'plug', label: RAIL.gateway, isCurrent: true },
  { icon: 'doc', label: RAIL.docs },
  { icon: 'users', label: RAIL.team },
  { icon: 'chart', label: RAIL.usage },
  { icon: 'sliders', label: RAIL.settings },
];

function RailButton({ icon, label, isCurrent = false }: RailItem) {
  return (
    <button type="button" className={styles.button} aria-label={label} aria-current={isCurrent ? 'page' : undefined}>
      <Icon name={icon} size="shell" />
    </button>
  );
}

export function Rail() {
  return (
    <aside className={styles.rail} aria-label={RAIL.label}>
      <RailButton {...LEAD} />
      <span className={styles.gap} />
      {ITEMS.map((item) => (
        <RailButton key={item.icon} {...item} />
      ))}
    </aside>
  );
}

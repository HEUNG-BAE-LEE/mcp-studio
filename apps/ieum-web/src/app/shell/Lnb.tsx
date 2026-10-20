// LNB — 이음 index.html:35-38 · css/console.css:98-101,494-498 · 반응형 css/console.css:456-460,861-862,887-888.
// 메뉴는 버튼이 아니라 <a href>(Link) — 주소는 메뉴별 마지막 주소(useMenuHref). 현재 메뉴는 menuOf(pathname)(탐색 작업은 원본).
// 링크를 누르면 그 메뉴의 자료를 다시 받는다(refreshMenu — 옛 nav 동작 js/main.js:29, 같은 메뉴를 다시 눌러도 갱신된다).
// 좁은 폭에서 메뉴 줄은 가로 스크롤한다. 메뉴가 바뀌면 현재 메뉴가 보이게 줄만 옮긴다(옛 scrollIntoView inline nearest — js/main.js:15).
// scrollIntoView는 문서까지 세로로 움직일 수 있어 쓰지 않는다
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SCREEN_LABEL, LNB } from '../../copy/shell';
import { useMenuHref } from '../lastPath';
import { refreshMenu } from '../menuRefresh';
import { TOP_NAV, type ScreenId } from '../nav';
import styles from './Lnb.module.css';

export type LnbProps = {
  /** 현재 메뉴 — menuOf(pathname). LNB 메뉴가 아니면 null */
  current: ScreenId | null;
};

function MenuLink({ id, isCurrent }: { id: ScreenId; isCurrent: boolean }) {
  const href = useMenuHref(id);
  return (
    <Link
      to={href}
      className={styles.item}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => refreshMenu(id)}
    >
      {SCREEN_LABEL[id]}
    </Link>
  );
}

/** 줄(nav)의 가로 스크롤만 옮겨 item이 보이게 한다 — 이미 보이면 그대로. nav가 offsetParent라 offsetLeft는 스크롤과 무관한 줄 안 좌표다 */
function revealInline(nav: HTMLElement, item: HTMLElement): void {
  const start = item.offsetLeft;
  const end = start + item.offsetWidth;
  if (start < nav.scrollLeft) nav.scrollTo({ left: start });
  else if (end > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: end - nav.clientWidth });
}

export function Lnb({ current }: LnbProps) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && item) revealInline(nav, item);
  }, [current]);

  return (
    <div className={styles.lnb}>
      <h1 className={styles.title}>{LNB.title}</h1>
      <nav ref={navRef} className={styles.nav} aria-label={LNB.navLabel}>
        {TOP_NAV.map((id) => (
          <MenuLink key={id} id={id} isCurrent={id === current} />
        ))}
      </nav>
    </div>
  );
}

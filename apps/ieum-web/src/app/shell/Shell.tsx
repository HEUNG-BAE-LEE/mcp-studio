// Shell — 모든 메뉴 화면의 틀: 레일 · GNB · LNB · 본문 <main>(이음 index.html:13-40). app/RootLayout이 그린다.
// - 셸 조회는 useSources 하나(GNB workspace). 이 조회로 본문을 감싼다: 첫 로딩은 본문을 비우고 aria-busy,
//   실패는 본문 자리 실패 상자 — 레일 · GNB · LNB는 남는다(옛 부트 js/main.js:65-67는 메뉴까지 비웠다). 화면은 자기 조회를 다시 ScreenState로 감싼다
// - 현재 메뉴 = menuOf(pathname)(탐색 작업 주소는 원본). 메뉴가 바뀌면 열린 층을 모두 닫는다
// - 스크롤은 문서(window)가 한다 — 맨 위 스크롤은 RootLayout(첫 경로 조각이 바뀔 때만)
// - 본문 <main>은 tabIndex=-1 — 층 포커스 복귀의 마지막 대체 자리(화면 제목이 없을 때 — ui/layers useLayerDialog). Tab 순서에는 들지 않는다
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSources } from '../../api/hooks/useSources';
import { ScreenState, closeAllLayers } from '@/ui';
import { menuOf } from '../lastPath';
import { screenGate } from '../screenGate';
import { Gnb } from './Gnb';
import { Lnb } from './Lnb';
import { Rail } from './Rail';
import { ScopeModal } from './ScopeModal';
import styles from './Shell.module.css';

/** 메뉴가 바뀌면(처음 그릴 때는 빼고) 열린 층을 모두 닫는다 */
function useCloseLayersOnMenuChange(menu: string | null): void {
  const previous = useRef(menu);
  useEffect(() => {
    if (previous.current === menu) return;
    previous.current = menu;
    closeAllLayers();
  }, [menu]);
}

export function Shell() {
  const { pathname } = useLocation();
  const current = menuOf(pathname);
  useCloseLayersOnMenuChange(current);
  const sources = useSources();
  const gate = screenGate({ sources });
  const [isScopeOpen, setScopeOpen] = useState(false);

  return (
    <div className={styles.app}>
      <Rail />
      <div className={styles.main}>
        <Gnb workspace={sources.data?.workspace} onScopeOpen={() => setScopeOpen(true)} />
        <Lnb current={current} />
        <main className={styles.content} tabIndex={-1}>
          <ScreenState gate={gate}>{() => <Outlet />}</ScreenState>
        </main>
      </div>
      <ScopeModal open={isScopeOpen} onOpenChange={setScopeOpen} />
    </div>
  );
}

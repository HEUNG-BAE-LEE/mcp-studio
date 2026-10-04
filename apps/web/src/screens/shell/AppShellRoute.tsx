// apps/web/src/screens/shell/AppShellRoute.tsx — 레이아웃 라우트: 바깥 여백 + 프레임 + LNB(스토어 ↔ 제어 prop) + 층 3개 + Outlet · 샘플 IA(언제든 바뀐다 — DESIGN 용어집)
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AppShell, LNB, LNBPanel } from '@/ui';
import { useShallow } from 'zustand/react/shallow';
import { useNotifications } from '../../api/hooks/useNotifications';
import { useProjects } from '../../api/hooks/useProjects';
import { useRealtimeSync } from '../../api/realtime';
import { FrameProvider } from '../../app/frame';
import { isGroupExpanded, matchRoute } from '../../app/nav';
import { LNB_KEY_STEP, selectCollapsed, selectFloating, useAppStore } from '../../app/store';
import { useMediaQuery } from '../../app/useMediaQuery';
import { UserProvider } from '../../app/user/UserProvider';
import { usePermission } from '../../app/user/usePermission';
import { alertSummary } from '../../copy/notifications';
import { SHELL } from '../../copy/shell';
import { ShellAlerts } from './ShellAlerts';
import { ShellNewProject } from './ShellNewProject';
import { ShellSearch } from './ShellSearch';
import { activeIds, buildSections, buildTopItems } from './buildNav';
import { useInterceptLinks } from './useInterceptLinks';
import { useLnbDrag } from './useLnbDrag';
import styles from './AppShellRoute.module.css';

/**
 * 기준 폭(DESIGN Layout — tokens.css `--viewport-base`와 같은 값). CSS 변수는 미디어 쿼리 · JS에서 싸게 읽을 수 없어
 * 여기와 AppShellRoute.module.css `@media`에 같은 수를 둔다 — 기준 폭이 바뀌면 셋을 함께 고친다
 */
const VIEWPORT_BASE_PX = 1280;
/** 기준 폭 미만이면 1024 배치 — LNB 접힘 기본 · 바깥 여백 narrow */
const NARROW_QUERY = `(max-width: ${VIEWPORT_BASE_PX - 1}px)`;

export function AppShellRoute() {
  useRealtimeSync();
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const isNarrowViewport = useMediaQuery(NARROW_QUERY);
  const {
    setNarrow,
    setWidth,
    toggleCollapsed,
    collapseNarrow,
    setHovering,
    openOverlay,
    toggleGroup,
  } = useAppStore(
    useShallow((s) => ({
      setNarrow: s.setNarrow,
      setWidth: s.setWidth,
      toggleCollapsed: s.toggleCollapsed,
      collapseNarrow: s.collapseNarrow,
      setHovering: s.setHovering,
      openOverlay: s.openOverlay,
      toggleGroup: s.toggleGroup,
    })),
  );
  // 첫 페인트 전에 반영 — 좁은 화면에서 펼친 LNB가 한 프레임 보이지 않게
  useLayoutEffect(() => setNarrow(isNarrowViewport), [isNarrowViewport, setNarrow]);
  const width = useAppStore((s) => s.width);
  // LNB 배치는 접힘과 같은 스토어 값으로 판단한다(미디어 쿼리 값은 위 layout effect가 옮긴다)
  const isNarrow = useAppStore((s) => s.narrow);
  const collapsed = useAppStore(selectCollapsed);
  const floating = useAppStore(selectFloating);
  const groupToggles = useAppStore((s) => s.groupToggles);

  const location = useLocation();
  const match = useMemo(() => matchRoute(location.pathname), [location.pathname]);
  // 1024 펼침은 본문 위에 뜬 패널이라 항목으로 이동하면 닫는다(COMPONENTS LNB 1024) — LNB 링크는 아래 interceptLinks가
  // 같은 경로여도 닫고, 이 효과는 LNB 밖에서 일어난 이동(검색 · 알림 · 새 프로젝트 · 뒤로 가기)을 맡는다
  useEffect(() => {
    collapseNarrow();
  }, [location.pathname, collapseNarrow]);
  const projects = useProjects();
  const notifications = useNotifications();
  const newProject = usePermission('project:create');
  const projectList = projects.data ?? [];
  const active = activeIds(match, projectList);
  const context = {
    projects: projectList,
    groupToggles,
    onNewProject: () => openOverlay('new-project'),
    newProject,
  };
  const sections = buildSections(context, active);
  const isExpanded = (groupId: string) => isGroupExpanded(groupId, groupToggles, active.groupId);
  const alert = alertSummary(notifications.data);
  const openSearch = () => openOverlay('search');
  const openAlerts = () => openOverlay('alerts');

  const onResizeStart = useLnbDrag(width, setWidth);
  const interceptLinks = useInterceptLinks(collapseNarrow);

  const panel = (
    <LNBPanel
      topItems={buildTopItems(context, active)}
      sections={sections}
      onToggleGroup={(id) => toggleGroup(id, isExpanded(id))}
      alert={alert}
      onAlerts={openAlerts}
      onSearch={openSearch}
      onToggle={toggleCollapsed}
      toggleTitle={floating ? SHELL.nav.floatingToggle : undefined}
    />
  );
  return (
    <div className={styles.root}>
      <AppShell
        fill
        ref={setFrame}
        lnb={
          <LNB
            width={width}
            collapsed={collapsed}
            floating={floating}
            narrow={isNarrow}
            onToggle={toggleCollapsed}
            onResizeStart={onResizeStart}
            onResizeKey={(direction) => setWidth(width + direction * LNB_KEY_STEP)}
            onHoverChange={setHovering}
            onClick={interceptLinks}
            panel={panel}
            rail={{ onSearch: openSearch, alertCount: alert?.count ?? 0, onAlerts: openAlerts }}
          />
        }
      >
        <FrameProvider value={frame}>
          <UserProvider>
            <Outlet />
          </UserProvider>
        </FrameProvider>
        {/* 층은 프레임으로 포털된다. AppShell 안에 두어 Tooltip.Provider(중복 표식 툴팁)를 받는다 */}
        <ShellSearch container={frame} currentProjectId={match?.params.projectId ?? null} />
        <ShellNewProject container={frame} />
        <ShellAlerts container={frame} />
      </AppShell>
    </div>
  );
}

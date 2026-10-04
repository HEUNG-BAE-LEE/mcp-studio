// apps/web/src/screens/shell/ShellSearch.tsx — 검색 오버레이 내용: 항목 · 프로젝트 두 그룹, 준비 중 faint, 0건 문구, Enter → 라우트 있는 첫 결과
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { SearchOverlay, SearchOverlayEmpty, SearchOverlayGroup, SearchOverlayItem } from '@/ui';
import { useProjects } from '../../api/hooks/useProjects';
import { searchNav, searchProjects, searchableNavCount } from '../../app/nav';
import { useAppStore } from '../../app/store';
import { SHELL } from '../../copy/shell';
import { useInterceptLinks } from './useInterceptLinks';

export function ShellSearch({
  container,
  currentProjectId,
}: {
  container: HTMLElement | null;
  currentProjectId: string | null;
}) {
  const open = useAppStore((s) => s.overlay === 'search');
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const [query, setQuery] = useState('');
  const projects = useProjects();
  const navigate = useNavigate();
  const close = useCallback(() => {
    closeOverlay();
    setQuery(''); // 닫으면 질의를 비운다
  }, [closeOverlay]);
  const interceptLinks = useInterceptLinks(close);

  const projectList = projects.data ?? [];
  const navHits = searchNav(query);
  const projectHits = searchProjects(query, projectList, currentProjectId);
  const first =
    navHits.find((h) => h.path !== undefined)?.path ??
    projectHits.find((h) => h.path !== null)?.path ??
    null;
  const isEmpty = query.trim() !== '' && navHits.length === 0 && projectHits.length === 0;
  const submit = () => {
    if (!first) return;
    void navigate(first);
    close();
  };
  return (
    <SearchOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      value={query}
      onValueChange={setQuery}
      placeholder={SHELL.search.placeholder}
      container={container}
      onSubmit={submit}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 자식 <a>의 클릭을 위임받아 SPA 이동. 키보드는 <a> 자체가 처리한다 */}
      <div onClick={interceptLinks}>
        {navHits.length > 0 ? (
          <SearchOverlayGroup label={SHELL.nav.workSection}>
            {navHits.map((h) => (
              <SearchOverlayItem key={h.id} href={h.path} note={h.group} pending={h.pending}>
                {h.label}
              </SearchOverlayItem>
            ))}
          </SearchOverlayGroup>
        ) : null}
        {projectHits.length > 0 ? (
          <SearchOverlayGroup label={SHELL.nav.projectsSection}>
            {projectHits.map((h) => (
              <SearchOverlayItem key={h.id} href={h.path ?? undefined} icon="folder" note={h.group}>
                {h.label}
              </SearchOverlayItem>
            ))}
          </SearchOverlayGroup>
        ) : null}
        {isEmpty ? (
          <SearchOverlayEmpty>
            {SHELL.search.empty(searchableNavCount() + projectList.length)}
          </SearchOverlayEmpty>
        ) : null}
      </div>
    </SearchOverlay>
  );
}

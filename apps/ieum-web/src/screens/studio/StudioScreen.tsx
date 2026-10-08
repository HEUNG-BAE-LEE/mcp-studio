// StudioScreen — 원본 작업이 AI 도구로 어떻게 바뀌는지 보고, 설명 · 매핑 · 실행 정책을 다듬어 저장한다
// 진입: LNB "변환 스튜디오"(마지막 주소 — 검색어 유지) · 대시보드 알림 · 구조도 · 원본 목록 · 연결 마법사 완료 · 로그 상세 · 배포 도구 표 · 탐색 등록(도착 표지 — 검색어 비움) · 주소
// 주소: /studio/:toolId?(도구 → 원본) ?tf=review|done|off(목록 필터) ?src=<원본 id>(도구 id가 없을 때만 — 도구 0개 원본). 화면 안 선택은 모두 replace,
//       없는 도구 · 모르는 값은 고쳐서 replace(useStudioRoute). 검색어 · 미리보기 탭은 주소에 두지 않는다(app/studio/studioUi)
// 영역: 머리 = PageHead · 선택줄 = SourceBar(Toolbar) · 목록 + 상세 = SplitLayout(ToolListPanel = Panel · FilterChips · SearchInput · SelectableListItem /
//       <section 도구 상세> = ToolDetail — DetailHead · ToolNotice · ToolPipeline · TwoColumn(DescSection · ParamMapping · ResMapping / PolicySection) · PreviewSection)
// 조회: 화면 useToolsWithDrafts(초안을 덮은 도구) · useTools(저장본) · useSources — 다시 받지 않는다(부팅 자원 · 폴링 없음).
//       쓰기 useSaveTool · useRewriteTool(app/studio/useToolMutations) · useRereadSource(app/sources/useSourceMutations) — 토스트 · 캐시 · 초안은 훅 정의 쪽
// 상태: 첫 로딩 = 본문 비움 + aria-busy · 화면 실패 = 본문 자리 실패 상자 · 처음 빈 상태(도구가 있는 원본 0개) = 머리 + 점선 상자(원본 시스템 링크) ·
//       도구 0개 원본(?src=) = 선택줄에 그 원본 · 목록 "이 조건에 맞는 도구가 없습니다." · 상세 비움 · 조건 0개 = 목록 안 한 줄
// 저장 안 된 편집은 도구별 초안(app/studio/drafts)에 쌓여 도구 · 원본 · 메뉴를 옮겨도 남고 새로고침에 사라진다. 떠날 때 확인은 두지 않는다.
// 1100 이하에서 도구를 고르면 상세로 스크롤한다(동작 줄이기면 즉시). 요청 중 버튼 잠금은 그 도구 · 그 원본의 요청일 때만
// 옛 근거: apps/web/ieum/js/menu/studio.js
// 확인 필요: 처음 빈 상태의 "원본 시스템" 링크는 원본 메뉴의 마지막 주소로 간다(옛 nav — 원본 화면 상태를 그대로 열었다, js/menu/studio.js:120 · js/main.js:29)
import { useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import type { Source } from '../../api/types';
import { maxWidth } from '../../app/breakpoints';
import { useMenuHref } from '../../app/lastPath';
import { refreshMenu } from '../../app/menuRefresh';
import { screenGate } from '../../app/screenGate';
import { useRereadSource } from '../../app/sources/useSourceMutations';
import { saveBodyOf } from '../../app/studio/saveBody';
import { useToolsWithDrafts } from '../../app/studio/toolView';
import { useRewriteTool, useSaveTool } from '../../app/studio/useToolMutations';
import { useMediaQuery } from '../../app/useMediaQuery';
import { usePrefersReducedMotion } from '../../app/usePrefersReducedMotion';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { STUDIO } from '../../copy/studio';
import { EmptyState, LinkButton, PageHead, ScreenState, SplitLayout } from '@/ui';
import { SourceBar } from './SourceBar';
import { ToolDetail } from './ToolDetail';
import { ToolListPanel } from './ToolListPanel';
import { isStudioEmpty, STUDIO_PARAM, toolOf, useStudioRoute } from './useStudioRoute';
import styles from './StudioScreen.module.css';

const PAGE_HEAD = <PageHead title={SCREEN_LABEL.studio} description={PAGE_DESCRIPTION.studio} />;

/** 처음 빈 상태 — 도구가 있는 원본이 없다(옛 js/menu/studio.js:120) */
function StudioEmpty() {
  const sourcesHref = useMenuHref('sources');
  return (
    <>
      {PAGE_HEAD}
      <EmptyState kind="first" container="panel" className={styles.empty}>
        {STUDIO.empty.before}
        <LinkButton to={sourcesHref} onClick={() => refreshMenu('sources')}>
          {STUDIO.empty.link}
        </LinkButton>
        {STUDIO.empty.after}
      </EmptyState>
    </>
  );
}

type StudioBodyProps = Readonly<{
  sources: readonly Source[];
  /** 초안을 덮은 도구 */
  view: ToolIndex;
  /** 저장본 */
  saved: ToolIndex;
}>;

function StudioBody({ sources, view, saved }: StudioBodyProps) {
  const route = useStudioRoute(sources, view);
  const save = useSaveTool();
  const rewrite = useRewriteTool();
  const reread = useRereadSource();
  // 명세 다시 읽기가 성공하면 상세를 새로 그린다 — 칸 원문(코드표 · 한도)이 새 도구 값에서 다시 시작한다(옛은 화면 전체를 다시 그렸다)
  const [rereadCount, setRereadCount] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  const isSingleColumn = useMediaQuery(maxWidth(1100));
  const reducedMotion = usePrefersReducedMotion();

  if (route === null) return <StudioEmpty />;
  const { selection } = route;
  const { source, tool } = selection;
  // 저장본도 보이는 원본 기준으로 찾는다 — 같은 도구 id가 다른 원본에 있으면 그쪽 저장본을 바탕으로 편집하게 된다
  const savedTool = tool === undefined ? undefined : toolOf(saved, tool.id, source.id);

  const onPick = (toolId: string) => {
    route.pickTool(toolId);
    if (isSingleColumn) detailRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const onReread = () =>
    reread.mutate({ sourceId: source.id }, { onSuccess: () => setRereadCount((count) => count + 1) });

  const onSave = (toolId: string) => {
    const body = saveBodyOf(toolId);
    if (body !== undefined) save.mutate({ toolId, body });
  };

  return (
    <>
      {PAGE_HEAD}
      <SourceBar
        options={route.sourceOptions}
        source={source}
        onSource={route.pickSource}
        rereading={reread.isPending && reread.variables?.sourceId === source.id}
        onReread={onReread}
      />
      <SplitLayout variant="list" className={styles.split}>
        <ToolListPanel
          tools={selection.tools}
          selectedId={tool?.id}
          filter={route.filter}
          onFilter={route.setFilter}
          onPick={onPick}
        />
        <section ref={detailRef} aria-label={STUDIO.detail.region}>
          {tool !== undefined && savedTool !== undefined ? (
            <ToolDetail
              key={`${tool.id}:${rereadCount}`}
              tool={tool}
              saved={savedTool}
              source={source}
              saving={save.isPending && save.variables?.toolId === tool.id}
              onSave={() => onSave(tool.id)}
              rewriting={rewrite.isPending && rewrite.variables?.toolId === tool.id}
              onRewrite={(again) => rewrite.mutate({ toolId: tool.id, desc: tool.desc, again })}
            />
          ) : null}
        </section>
      </SplitLayout>
    </>
  );
}

export function StudioScreen() {
  const view = useToolsWithDrafts();
  const saved = useTools();
  const sources = useSources();
  const { toolId } = useParams();
  const [params] = useSearchParams();
  const src = params.get(STUDIO_PARAM.src);
  const gate = screenGate(
    { view, saved, sources },
    { isEmpty: (data) => isStudioEmpty(data.sources.sources, data.view, toolId, src) },
  );

  return (
    <ScreenState gate={gate} empty={() => <StudioEmpty />}>
      {(data) => <StudioBody sources={data.sources.sources} view={data.view} saved={data.saved} />}
    </ScreenState>
  );
}

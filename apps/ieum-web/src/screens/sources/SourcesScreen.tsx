// SourcesScreen — 연결한 원본 시스템을 한눈에 보고, 행을 눌러 도구를 열거나 연결 · 인증 다시 입력 · 삭제를 시작한다
// 진입: LNB "원본 시스템"(다른 메뉴에서 오면 마지막 주소, 이 화면에서 다시 누르면 지금 주소 그대로 — 다시 누르면 자동 탐색 개요를 새로 받는다) · 대시보드 · 주소
// 주소: /sources?q=<검색어 원문>&proto=soap|rest|gov|sample|disc — 전체 · 빈 값은 뺀다. 검색 · 필터는 replace.
//       모르는 proto는 전체로 보고 주소는 고치지 않는다. 층(마법사 · 재인증 · 삭제 확인)은 주소를 만들지 않는다
// 영역: 머리 = PageHead · 툴바 = Toolbar(SearchInput · Select 연결 방식 · ToolbarSpacer · Button 원본 시스템 연결) · 목록 = SourcesTable(Table 8열) ·
//       아래 = HelpText(AI 도구 수 안내) · 자동 탐색 작업 = DiscoveryJobsSlot(SectionTitle + Table 6열) · 2차 안내 = SectionTitle + LaterCards
// 조회: 화면 useSources · useTools, 영역 useDiscoveryOverview(region — 들어올 때마다, 화면 판정보다 먼저 부른다). 쓰기 없음(층이 한다)
// 상태: 첫 로딩 = 본문 비움 + aria-busy · 화면 실패 = 본문 자리 실패 상자 · 빈 상태 = 표 안 한 행(원본 0개 first · 조건 0개 filtered) ·
//       작업 자리 조회 실패 = 그 자리 안 실패 상자(목록은 그대로)
// 동작: 행 · "도구 보기" = useGoSource(인증 만료면 재인증 모달) · "다시 인증" = openReauth · "삭제" = openDeleteSource · "원본 시스템 연결" = openWizard
// 검색은 입력할 때마다 바로 거른다 — 한글 조합 중에도 기다리지 않는다. 입력값은 이 화면의 상태이고 주소 q는 따라 쓴다(useSourcesParams)
// 옛 근거: apps/web/ieum/js/menu/sources.js:1-42
// 확인 필요: 화면 머리(PageHead)도 화면 조회 안에 둔다 — 첫 로딩 · 실패 때 머리까지 비운다(옛 부트 대기 · 실패와 같은 모양, js/main.js:65-67)
import { useDiscoveryOverview } from '../../api/hooks/useDiscovery';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import type { DiscoveryResponse, Source } from '../../api/types';
import { openDeleteSource, openReauth, openWizard } from '../../app/layers';
import { regionGate, screenGate, type Gate } from '../../app/screenGate';
import { useGoSource } from '../../app/sources/useGoSource';
import { SOURCES } from '../../copy/sources';
import { PROTOCOL_LABEL } from '../../copy/protocol';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import {
  Button,
  HelpText,
  LaterCards,
  PageHead,
  ScreenState,
  SearchInput,
  SectionTitle,
  Select,
  Toolbar,
  ToolbarSpacer,
} from '@/ui';
import { DiscoveryJobsSlot } from './DiscoveryJobsSlot';
import { ALL, filterSources, PROTO_FILTER_VALUES, toSourceRow } from './sourceRows';
import { SourcesTable } from './SourcesTable';
import { useSourcesParams } from './useSourcesParams';
import styles from './SourcesScreen.module.css';

type SourcesBodyProps = Readonly<{
  sources: readonly Source[];
  tools: ToolIndex;
  jobsGate: Gate<DiscoveryResponse>;
}>;

function SourcesBody({ sources, tools, jobsGate }: SourcesBodyProps) {
  const { filter, setQuery, setProto } = useSourcesParams();
  const goSource = useGoSource();
  // 도구가 없는 원본(방금 연결해 도구 0개 · 삭제 직후)은 빈 목록이다
  const rows = filterSources(sources, filter).map((source) => toSourceRow(source, tools.bySource[source.id] ?? []));

  return (
    <>
      <PageHead title={SCREEN_LABEL.sources} description={PAGE_DESCRIPTION.sources} />
      <Toolbar className={styles.toolbar}>
        <SearchInput
          value={filter.q}
          onValueChange={setQuery}
          label={SOURCES.toolbar.searchLabel}
          placeholder={SOURCES.toolbar.searchPlaceholder}
        />
        <Select variant="toolbar" aria-label={SOURCES.toolbar.protoLabel} value={filter.proto} onValueChange={setProto}>
          <option value={ALL}>{SOURCES.toolbar.protoAll}</option>
          {PROTO_FILTER_VALUES.map((proto) => (
            <option key={proto} value={proto}>
              {PROTOCOL_LABEL[proto]}
            </option>
          ))}
        </Select>
        <ToolbarSpacer />
        <Button variant="primary" icon="plus" onClick={openWizard}>
          {SOURCES.toolbar.connect}
        </Button>
      </Toolbar>
      <SourcesTable total={sources.length} rows={rows} onOpen={goSource} onReauth={openReauth} onDelete={openDeleteSource} />
      <HelpText className={styles.hint}>
        {SOURCES.hint.countPre}
        <b>{SOURCES.hint.countStrong}</b>
        {SOURCES.hint.countPost}
        {SOURCES.hint.rereadPre}
        <b>{SOURCES.hint.rereadStrong}</b>
        {SOURCES.hint.rereadPost}
      </HelpText>
      <DiscoveryJobsSlot gate={jobsGate} />
      <SectionTitle title={SOURCES.later.title} description={SOURCES.later.note} />
      <LaterCards items={SOURCES.later.cards} badge={SOURCES.later.badge} />
    </>
  );
}

export function SourcesScreen() {
  // 자동 탐색 개요는 화면 판정보다 먼저 부른다 — 원본 · 도구 조회를 기다리지 않고 들어올 때 한 번 나가고,
  // 화면 조회가 실패해도 빠지지 않는다(옛 nav는 화면과 상관없이 불렀다 — js/main.js:29)
  const discovery = useDiscoveryOverview();
  const sources = useSources();
  const tools = useTools();
  const gate = screenGate({ sources, tools });
  const jobsGate = regionGate(discovery);

  return (
    <ScreenState gate={gate}>
      {(data) => <SourcesBody sources={data.sources.sources} tools={data.tools} jobsGate={jobsGate} />}
    </ScreenState>
  );
}

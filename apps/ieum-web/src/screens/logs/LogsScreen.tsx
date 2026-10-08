// LogsScreen — AI가 어떤 도구를 불렀고 이음이 어떻게 바꿨는지 호출 기록을 보고, 행을 눌러 변환 과정을 연다
// 진입: LNB "호출 로그"(다른 메뉴에서 오면 마지막 주소 — log는 빠진다, 이 화면에서 다시 누르면 지금 주소 그대로) · 대시보드 "호출 로그 보기" · 주소
// 주소: /logs?status=ok|err&client=<모델 키>&q=<검색어 원문>&log=<로그 id> — 전체 · 빈 값은 뺀다. 필터 · 검색 · 행 열기 · 닫기는 모두 replace.
//       모르는 status · client는 전체로 보고 주소는 고치지 않는다(모델 조회가 실패하면 어떤 client든 전체)
// 영역: 머리 = PageHead · 툴바 = LogsToolbar(Toolbar — FilterChips 상태 · ToolbarSpacer · Select 클라이언트 · SearchInput) · 목록 = LogTable(Table 8열) ·
//       아래 = HelpText(보관 안내) · 상세 = LogDetailDrawer
// 조회: 화면 useLogs(파라미터 없음 — 화면이 거른다, 들어올 때마다) · useTools · useSources, 영역 usePlayground({ region: true })(선택지 · 라벨),
//       층 useLogDetail(useLogDrawer). 쓰기 없음
// 상태: 첫 로딩 = 본문 비움 + aria-busy(모델 조회가 끝날 때까지 — 성공이든 실패든) · 화면 실패 = 본문 자리 실패 상자 ·
//       모델 조회 실패 = 선택지 "전체"뿐 · 클라이언트 칸 · 변환 과정 라벨은 값 그대로(표시 없음) ·
//       빈 상태 = 표 안 한 행(로그 0개 first · 조건 0개 filtered) · 상세 실패 = 경고 토스트 뒤 log 제거
// 검색은 입력할 때마다 바로 거른다 — 한글 조합 중에도 기다리지 않는다(옛 input 이벤트 — logs.js:59-61). 입력값은 이 화면의 상태이고
// 주소 q는 따라 쓴다(라우터 갱신이 늦어도 입력 글자가 흔들리지 않게)
// 옛 근거: apps/web/ieum/js/menu/logs.js
// 확인 필요: 화면 머리(PageHead)도 화면 조회 안에 둔다 — 첫 로딩 · 실패 때 머리까지 비운다(옛 부트 대기 · 실패와 같은 모양, js/main.js:65-67)
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLogs } from '../../api/hooks/useLogs';
import { usePlayground } from '../../api/hooks/usePlayground';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import type { LogRow, Source } from '../../api/types';
import { regionGate, screenGate, type Gate } from '../../app/screenGate';
import { LOGS } from '../../copy/dashboard-logs';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { HelpText, PageHead, ScreenState } from '@/ui';
import { LogDetailDrawer } from './LogDetailDrawer';
import { countLogs, filterLogs, LOG_PARAM, parseLogFilter, withParam } from './logFilter';
import { LogsToolbar } from './LogsToolbar';
import { LogTable } from './LogTable';
import { searchSourceName, type LogContext, type LogModels } from './logView';
import { useLogDrawer } from './useLogDrawer';
import styles from './LogsScreen.module.css';

type LogsBodyProps = Readonly<{
  rows: readonly LogRow[];
  tools: ToolIndex;
  sources: readonly Source[];
  /** 모델 조회가 실패했으면 null — 선택지는 "전체"뿐, 라벨은 클라이언트 값 그대로 */
  models: LogModels;
}>;

function LogsBody({ rows, tools, sources, models }: LogsBodyProps) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(() => params.get(LOG_PARAM.q) ?? '');
  const drawer = useLogDrawer();
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const context = useMemo<LogContext>(
    () => ({ models, toolById: tools.byId, sourceById }),
    [models, tools.byId, sourceById],
  );

  const modelKeys = useMemo(() => Object.keys(models ?? {}), [models]);
  const filter = { ...parseLogFilter(params, modelKeys), q: query };
  const counts = countLogs(rows);
  const visible = filterLogs(rows, filter, (toolId) => searchSourceName(toolId, context));

  // 화면 안 선택이라 히스토리를 쌓지 않는다. 요청은 없다 — 목록 쿼리 키가 주소와 상관없다
  const setParam = (key: string, value: string | null) =>
    setParams((prev) => withParam(prev, key, value), { replace: true });
  const onSearch = (value: string) => {
    setQuery(value);
    setParam(LOG_PARAM.q, value);
  };

  return (
    <>
      <PageHead title={SCREEN_LABEL.logs} description={PAGE_DESCRIPTION.logs} />
      <LogsToolbar
        className={styles.toolbar}
        counts={counts}
        filter={filter}
        models={models}
        onParam={setParam}
        onSearch={onSearch}
      />
      <LogTable total={rows.length} rows={visible} context={context} onOpen={drawer.openLog} />
      <HelpText className={styles.hint}>{LOGS.retentionHint}</HelpText>
      {drawer.shown ? (
        <LogDetailDrawer log={drawer.shown.log} open={drawer.shown.open} onClose={drawer.close} context={context} />
      ) : null}
    </>
  );
}

const PENDING = { kind: 'pending' } as const;

/**
 * 화면 조회가 다 와도 모델 조회가 끝날 때(성공 · 실패)까지 첫 로딩으로 둔다 — 받기 전에 그리면 클라이언트 칸 · ?client= 선택 ·
 * 변환 과정 1단계 라벨이 실패와 같은 원값이 된다(옛 부트는 모든 조회를 기다렸다 — js/main.js:65-66). 화면 실패는 기다리지 않는다
 */
const waitForModels = <D,>(gate: Gate<D>, modelsGate: Gate<unknown>): Gate<D> =>
  (gate.kind === 'ready' || gate.kind === 'empty') && modelsGate.kind === 'pending' ? PENDING : gate;

export function LogsScreen() {
  const logs = useLogs();
  const tools = useTools();
  const sources = useSources();
  const playground = usePlayground({ region: true });
  // 모델 목록은 영역 조회 — 받는 동안은 기다리지만 실패해도 화면을 막지 않고 선택지가 "전체"뿐이 된다
  const modelsGate = regionGate(playground);
  const gate = waitForModels(screenGate({ logs, tools, sources }), modelsGate);
  const models = modelsGate.kind === 'ready' ? modelsGate.data.models : null;

  return (
    <ScreenState gate={gate}>
      {(data) => <LogsBody rows={data.logs} tools={data.tools} sources={data.sources.sources} models={models} />}
    </ScreenState>
  );
}

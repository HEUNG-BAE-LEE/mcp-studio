// 호출 로그 표 칸 · 상세 요약의 글자(순수 함수) — 옛 logRows · openLog(apps/web/ieum/js/menu/logs.js:6,13,35-48)의 글자를 그대로.
// 화면(TSX)은 이 글자를 그리기만 한다. 고친 것: 변환 시간이 없으면 `—ms` 대신 `—`(logs.js:13,41), 사용자가 없는 상세 머리는
// 사용자 조각을 뺀다(logs.js:35), 모르는 프로토콜은 "undefined" 대신 값 그대로(logs.js:48),
// 도구는 있는데 원본을 찾지 못하면 표 원본 칸은 상세와 같은 `—`(옛은 이 경우 예외로 멈췄다 — logs.js:13)
import type { LogRow, ModelInfo, Source, Tool } from '../../api/types';
import { own } from '../../app/trace/own';
import { LOGS } from '../../copy/dashboard-logs';
import { fmtLogTs, fmtNum, NONE, NONE_REASON, orNone } from '../../copy/format';
import { protocolLabel } from '../../copy/protocol';

/** 테스트 실행 조회의 models. 실패했으면 null — 라벨은 클라이언트 값 그대로(화면은 조회가 끝난 뒤에 그린다) */
export type LogModels = Readonly<Record<string, ModelInfo>> | null;

export type LogContext = Readonly<{
  models: LogModels;
  toolById: Readonly<Record<string, Tool>>;
  sourceById: ReadonlyMap<string, Source>;
}>;

/** 클라이언트 라벨 — 모르는 클라이언트는 값 그대로(옛 clientLabel — logs.js:6) */
export const clientLabelOf = (client: string, models: LogModels): string =>
  (models ? own(models, client)?.label : undefined) ?? client;

/** 로그의 도구와 그 원본. 도구가 지워졌으면 둘 다 없다(옛 TOOL[l.tool] · SRC[t.src] — logs.js:13,32) */
export function toolSourceOf(
  toolId: string,
  context: LogContext,
): Readonly<{ tool: Tool | undefined; source: Source | undefined }> {
  const tool = own(context.toolById, toolId);
  return { tool, source: tool ? context.sourceById.get(tool.src) : undefined };
}

/** 검색 대상의 원본 이름 — 지워진 도구면 빈 문자열(logs.js:10) */
export const searchSourceName = (toolId: string, context: LogContext): string =>
  toolSourceOf(toolId, context).source?.name ?? '';

export type LogRowText = Readonly<{
  time: string;
  user: string;
  client: string;
  tool: string;
  source: string;
  convert: string;
  sourceMs: string;
}>;

/** 표 한 행의 글자(상태 칩 빼고) — logs.js:13. now는 "오늘" 판정 기준(epoch ms) */
export function logRowText(row: LogRow, context: LogContext, now: number): LogRowText {
  const { tool, source } = toolSourceOf(row.tool, context);
  return {
    time: fmtLogTs(row.ts, now),
    user: row.user || '',
    client: clientLabelOf(row.client, context.models),
    tool: row.tool,
    source: tool ? (source?.name ?? NONE) : NONE_REASON.deletedTool,
    convert: orNone(row.convertMs, LOGS.unitMs),
    sourceMs: orNone(row.sourceMs, LOGS.unitMs, fmtNum),
  };
}

export type LogDetailText = Readonly<{
  description: string;
  client: string;
  source: string;
  convert: string;
  sourceMs: string;
  reqId: string;
  /** 발 왼쪽 "{원본}, {프로토콜}" — 원본을 모르면 없다 */
  footInfo: string | undefined;
}>;

/** 상세 머리 설명 · 요약 칸 · 발 정보의 글자 — logs.js:35-44,48 */
export function logDetailText(log: LogRow, context: LogContext, now: number): LogDetailText {
  const { source } = toolSourceOf(log.tool, context);
  const client = clientLabelOf(log.client, context.models);
  return {
    description: LOGS.detail.desc(fmtLogTs(log.ts, now), log.user, client),
    client,
    source: source ? source.name : NONE,
    convert: orNone(log.convertMs, LOGS.unitMs),
    // 원본을 부르기 전에 끝난 호출은 사유 문구(logs.js:42) — 표의 같은 칸은 `—`(칸 성격대로 두 표기를 보존)
    sourceMs: log.sourceMs == null ? NONE_REASON.beforeCall : orNone(log.sourceMs, LOGS.unitMs, fmtNum),
    reqId: LOGS.detail.reqId(log.id),
    footInfo: source ? LOGS.detail.footInfo(source.name, protocolLabel(source.proto)) : undefined,
  };
}

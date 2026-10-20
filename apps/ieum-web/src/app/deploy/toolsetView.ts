// 묶음 하나에서 화면 값을 고르는 순수 함수들 — 옛 deploy.js의 rtOf · endpoint · tsChip · rtInfo · rtNotice 갈래와 배포 확인 창의 계산(:6-29,141-148).
// 입력은 화면이 읽는 Toolset(useToolsets select — startedAt ms)이다. 주소 · 상태만 보는 함수는 서버 모양(ToolsetWire — 쓰기 응답)도 받는다
import type { Tool, Toolset, ToolsetRuntime } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import type { Drafts } from '../studio/drafts';
import { own } from '../trace/own';

const DRAFT = 'draft';
const RUNNING = 'running';
/** 공개 상태 — 이 도구만 배포에 들어간다(서버 deployer.deploy와 같은 조건 중 상태 쪽) */
const PUBLISHED = 'done';
/** 처음 배포의 버전(옛 :145 — 서버 deployer.next_version도 같다) */
const FIRST_VERSION = 'v1.0';
const VERSION_STEP = 0.1;
const VERSION_DIGITS = 1;

type WithRuntime = Readonly<{ status: string; runtime: Readonly<{ state: string; url?: string }> }>;

/** 한 번이라도 배포했는가(초안이 아닌가) — 주소 · 서버 로그 · 알림 · "새 버전 배포"가 갈린다(옛 :54 deployed) */
export const isDeployed = (ts: Pick<WithRuntime, 'status'>): boolean => ts.status !== DRAFT;

/** MCP 서버 주소. 없으면 빈 글(옛 endpoint :7 — rtOf(ts).url || '') */
export const endpointOf = (ts: Pick<WithRuntime, 'runtime'>): string => ts.runtime.url || '';

/** 묶음 칩의 상태 값(copy/status toolset) — 초안이면 draft, 아니면 서버 상태 그대로(옛 tsChip :9-13). 버전은 초안이 아닐 때만 붙인다 */
export const chipValueOf = (ts: WithRuntime): string => (isDeployed(ts) ? ts.runtime.state : DRAFT);

/** 이번 배포의 버전 — 초안이면 v1.0, 아니면 지금 버전 + 0.1(옛 :145 그대로 — 소수 한 자리) */
export const nextVersion = (ts: Pick<Toolset, 'status' | 'ver'>): string =>
  isDeployed(ts) ? `v${(Number.parseFloat(ts.ver.slice(1)) + VERSION_STEP).toFixed(VERSION_DIGITS)}` : FIRST_VERSION;

/** 배포 확인 창 본문의 "어떻게 뜨는가" 문장 갈래(copy/deploy deployModal.how — 옛 :146-148) */
export type DeployHow = keyof typeof DEPLOY.deployModal.how;
export const deployHow = (ts: WithRuntime): DeployHow => {
  if (!isDeployed(ts)) return 'first';
  return ts.runtime.state === RUNNING ? 'running' : 'restart';
};

/**
 * 실행 방식 줄의 서버 정보 — "포트 8180 · PID 123 · 오후 03:12에 시작"(옛 rtInfo :14-20). 있는 조각만 잇고 하나도 없으면 빈 글.
 * 시작 시각은 running일 때만. 포트 · PID는 0이면 없는 것으로 본다(옛 if (rt.port) 그대로)
 */
export function runtimeInfo(runtime: ToolsetRuntime): string {
  const { port, pid, startedAt, state } = runtime;
  const bits = [
    port ? DEPLOY.detail.runPort(port) : null,
    pid ? DEPLOY.detail.runPid(pid) : null,
    startedAt && state === RUNNING ? DEPLOY.detail.runStartedAt(startedAt) : null,
  ];
  return bits.filter((bit): bit is string => bit !== null).join(DEPLOY.detail.infoSeparator);
}

/**
 * 서버 상태 알림의 갈래(옛 rtNotice :22-30): 초안은 알림 없음, crashed · stopped · starting은 그 알림, 그 밖(running · 모르는 값)은
 * 실행 중 안내 문단 — 모르는 상태 값도 옛처럼 실행 중 안내로 떨어진다(칩은 값 그대로 + 회색)
 */
export type ServerNotice = 'none' | 'crashed' | 'stopped' | 'starting' | 'running';
export function serverNoticeOf(ts: WithRuntime): ServerNotice {
  if (!isDeployed(ts)) return 'none';
  const { state } = ts.runtime;
  if (state === 'crashed' || state === 'stopped' || state === 'starting') return state;
  return 'running';
}

/** 묶음에 든 도구 — 묶음 순서대로, 도구 목록에 없는 id는 뺀다(옛 ts.tools.map(id => TOOL[id]).filter(Boolean) :55,142) */
export function toolsetTools(toolIds: readonly string[], byId: Readonly<Record<string, Tool>>): readonly Tool[] {
  return toolIds.flatMap((id) => {
    const tool = own(byId, id);
    return tool === undefined ? [] : [tool];
  });
}

export const isPublished = (tool: Pick<Tool, 'status'>): boolean => tool.status === PUBLISHED;

/** 배포 확인 창의 세 목록 — 공개(배포에 들어감) · 빠짐(검토가 끝나지 않음) · 먼저 저장(초안이 있음). 셋 다 묶음 순서 */
export type DeployPlan = Readonly<{ ready: readonly Tool[]; held: readonly Tool[]; dirty: readonly Tool[] }>;

/**
 * 배포 확인 창 계산(옛 :142-144). byId는 초안을 덮은 도구(app/studio/toolView useToolsWithDrafts)여야 한다 — 저장하지 않은 공개도 공개로 센다.
 * 먼저 저장할 도구는 이 묶음의 도구 중 초안이 있는 것뿐이다(다른 도구의 초안은 건드리지 않는다). 도구 표 요약 · 보안 정책 개수는 저장본으로 따로 센다
 */
export function deployPlan(toolIds: readonly string[], byId: Readonly<Record<string, Tool>>, drafts: Drafts): DeployPlan {
  const tools = toolsetTools(toolIds, byId);
  return {
    ready: tools.filter(isPublished),
    held: tools.filter((t) => !isPublished(t)),
    dirty: tools.filter((t) => Object.hasOwn(drafts, t.id)),
  };
}

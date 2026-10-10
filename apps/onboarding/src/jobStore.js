// 일괄변환 잡 추적.
// - 진행 중: projectId→jobId 매핑으로 카드 진행링을 유지한다.
// - 종료됨: 사용자 확인 전까지 별도 영속 스토어에 보존해 화면전환/폴링 경쟁에도 알림을 잃지 않는다.
import { useSyncExternalStore } from "react";

const KEY = "ktel.jobs";
const ENDED_KEY = "ktel.jobs.ended";
const SOURCES_KEY = "ktel.jobs.sources";
export const JOB_SOURCE = Object.freeze({ ONBOARDING: "onboarding", MIGRATION: "migration" });
const subs = new Set();
let map = load(KEY);
let ended = load(ENDED_KEY);
let sources = load(SOURCES_KEY);

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function commit(nextMap, nextEnded = ended, nextSources = sources) {
  map = nextMap;
  ended = nextEnded;
  sources = nextSources;
  localStorage.setItem(KEY, JSON.stringify(map));
  localStorage.setItem(ENDED_KEY, JSON.stringify(ended));
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
  subs.forEach((f) => f());
}

export function isTerminalJobStatus(status) {
  return status === "done" || status === "failed" || status === "error" || status === "missing";
}

export function setJob(projectId, jobId, source = JOB_SOURCE.MIGRATION) {
  const { [projectId]: _oldEnded, ...remainingEnded } = ended;
  commit(
    { ...map, [projectId]: jobId },
    remainingEnded,
    { ...sources, [projectId]: { jobId, source } },
  );
}
export function clearJob(projectId) {
  if (!(projectId in map)) return;
  const { [projectId]: _drop, ...rest } = map;
  const { [projectId]: _dropSource, ...remainingSources } = sources;
  commit(rest, ended, remainingSources);
}

/**
 * 진행 잡을 사용자 확인 대기 상태로 원자적으로 이관한다.
 * 오래된 폴러가 같은 프로젝트의 새 잡을 지우지 않도록 jobId까지 일치할 때만 처리한다.
 */
export function finishJob(projectId, jobId, status) {
  if (!isTerminalJobStatus(status)) return false;
  if (map[projectId] !== jobId) return ended[projectId]?.jobId === jobId;
  const { [projectId]: _drop, ...remainingJobs } = map;
  const sourceEntry = sources[projectId];
  const source = sourceEntry?.jobId === jobId ? sourceEntry.source : JOB_SOURCE.MIGRATION;
  const { [projectId]: _dropSource, ...remainingSources } = sources;
  const nextEnded = source === JOB_SOURCE.ONBOARDING
    ? { ...ended, [projectId]: { jobId, status, source, endedAt: Date.now() } }
    : ended;
  commit(remainingJobs, nextEnded, remainingSources);
  return true;
}

export function acknowledgeJob(projectId) {
  if (!(projectId in ended)) return;
  const { [projectId]: _drop, ...rest } = ended;
  commit(map, rest, sources);
}

function subscribe(f) { subs.add(f); return () => subs.delete(f); }

/** 해당 프로젝트의 진행중 jobId (없으면 undefined) */
export function useJob(projectId) {
  return useSyncExternalStore(subscribe, () => map[projectId]);
}

/** 전체 매핑(map 식별자는 commit 때만 교체 → 카드 map() 안에서 안전) */
export function useJobs() {
  return useSyncExternalStore(subscribe, () => map);
}

/** 진행 잡 출처. projectId→{jobId,source} */
export function useJobSources() {
  return useSyncExternalStore(subscribe, () => sources);
}

/** 사용자 확인을 기다리는 온보딩 종료 잡. projectId→{jobId,status,source,endedAt} */
export function useEndedJobs() {
  return useSyncExternalStore(subscribe, () => ended);
}

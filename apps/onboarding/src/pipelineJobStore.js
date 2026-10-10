import { useSyncExternalStore } from "react";
import { updateProjectPipelineRoutes } from "./lib/projectPipelineRoutes.js";

// Result navigation is lightweight browser preference state. Execution progress is
// never stored or inferred here; it comes from the durable BFF projection.
const LEGACY_JOBS_KEY = "ktel.pipeline-jobs";
const ROUTES_KEY = "ktel.project-pipeline-routes";
const EMPTY_JOBS = Object.freeze([]);
const subs = new Set();

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

let projectRoutes = load(ROUTES_KEY);
// Operational progress is projected by the BFF. Drop the legacy timer-backed
// cache instead of reviving it during a rolling frontend deployment.
localStorage.removeItem(LEGACY_JOBS_KEY);

function commitProjectRoutes(next) {
  projectRoutes = next;
  localStorage.setItem(ROUTES_KEY, JSON.stringify(projectRoutes));
  subs.forEach((notify) => notify());
}

function subscribe(notify) {
  subs.add(notify);
  return () => subs.delete(notify);
}

export function startPipelineJobs(projectId, projectName, assignments = []) {
  commitProjectRoutes(updateProjectPipelineRoutes(projectRoutes, {
    projectId, projectName, assignments,
  }));
}

// Compatibility exports for screens that may survive a rolling frontend deploy.
export function clearCompletedPipelineJobs() {}
export function usePipelineJobs() { return useSyncExternalStore(subscribe, () => EMPTY_JOBS); }
export function useProjectPipelineRoutes() {
  return useSyncExternalStore(subscribe, () => projectRoutes);
}

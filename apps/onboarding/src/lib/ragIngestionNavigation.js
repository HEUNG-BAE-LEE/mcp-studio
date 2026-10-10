export const RAG_EXECUTIONS_FOCUS = "ragExecutions";

export function dashboardNavForRagExecution(execution) {
  const executionId = String(execution?.id || "").trim();
  const ingestionWarning = String(execution?.ingestion_warning || "").trim();
  return {
    focus: RAG_EXECUTIONS_FOCUS,
    ...(executionId ? { executionId } : {}),
    ...(ingestionWarning ? { ingestionWarning } : {}),
  };
}

export function dashboardNavForRagExecutionList() {
  return { focus: RAG_EXECUTIONS_FOCUS, view: "detail" };
}

// 일반 진입과 온보딩은 관제다. 실행 상세에서 목록으로 이동할 때만 상세를 명시한다.
export function dashboardViewForNav(nav) {
  return nav?.view === "detail" ? "detail" : "deck";
}

export function projectIdForRagExecution(execution, fallbackProjectId) {
  return String(execution?.project_id || fallbackProjectId || "").trim() || null;
}

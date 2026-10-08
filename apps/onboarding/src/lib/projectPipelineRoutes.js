const PIPELINE_MODES = Object.freeze({
  "rag-ai-search": { pipelineMode: "rag", sourceMode: "rag" },
  "rag-graphrag": { pipelineMode: "graphrag", sourceMode: "rag" },
  "terms-ai-search": { pipelineMode: "rag", sourceMode: "terms" },
  "terms-graphrag": { pipelineMode: "graphrag", sourceMode: "terms" },
});

const validAssignments = (assignments = []) => assignments.flatMap((assignment) => {
  const { documentName, documentPath, pipelineId } = assignment || {};
  return documentName && documentPath && pipelineId ? [{ documentName, documentPath, pipelineId }] : [];
});

export function updateProjectPipelineRoutes(routes = [], {
  projectId,
  projectName = "",
  assignments = [],
  updatedAt = Date.now(),
} = {}) {
  if (!projectId) return routes;
  const nextAssignments = validAssignments(assignments);
  if (!nextAssignments.length) return routes;
  const next = routes.filter((route) => route?.projectId !== projectId);
  next.push({
    projectId,
    projectName,
    assignments: nextAssignments,
    updatedAt,
  });
  return next.slice(-50);
}

export function pipelineNavigation({ documentName, documentPath, pipelineId } = {}, projectId) {
  const modes = PIPELINE_MODES[pipelineId];
  if (!modes || !projectId) return null;
  return {
    pipelineId,
    ...modes,
    projectId,
    documentName,
    documentPath,
  };
}

export function projectPipelineNavigations(routes = [], projectId) {
  const route = [...routes].reverse().find((candidate) => candidate?.projectId === projectId);
  if (!route) return [];
  return validAssignments(route.assignments).map((assignment) => pipelineNavigation(assignment, projectId)).filter(Boolean);
}

export function projectTargetNavigation(routes, projectId, pipelineMode) {
  const matches = projectPipelineNavigations(routes, projectId).filter((nav) => nav.pipelineMode === pipelineMode);
  return matches.find((nav) => nav.sourceMode === "rag") || matches[0] || null;
}

export function projectRagNavigation(routes, projectId) {
  const matches = projectPipelineNavigations(routes, projectId).filter((nav) => nav.sourceMode === "rag");
  return matches.find((nav) => nav.pipelineId === "rag-ai-search") || matches[0] || null;
}

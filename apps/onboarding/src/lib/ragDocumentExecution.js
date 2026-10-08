export const RAG_DOCUMENT_PIPELINE_OPTIONS = Object.freeze([
  Object.freeze({ id: "rag-ai-search", label: "Adaptive → AI Search" }),
  Object.freeze({ id: "rag-graphrag", label: "Adaptive → GraphRAG" }),
  Object.freeze({ id: "terms-ai-search", label: "Terms → AI Search" }),
  Object.freeze({ id: "terms-graphrag", label: "Terms → GraphRAG" }),
]);

export const RAG_DOCUMENT_PIPELINE_PROFILES = Object.freeze({
  "rag-ai-search": Object.freeze({ projection: "adaptive", target: "ai_search" }),
  "rag-graphrag": Object.freeze({ projection: "adaptive", target: "graphrag" }),
  "terms-ai-search": Object.freeze({ projection: "terms", target: "ai_search" }),
  "terms-graphrag": Object.freeze({ projection: "terms", target: "graphrag" }),
});

const MIME_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

export function onboardingPipelineProfile(pipeline) {
  const pipelineId = typeof pipeline === "string" ? pipeline : pipeline?.id;
  const profile = RAG_DOCUMENT_PIPELINE_PROFILES[pipelineId];
  if (!profile) throw new Error("지원하지 않는 문서 처리 경로입니다.");
  return { ...profile };
}

export function ragDocumentsHavePipelineSelections(documents) {
  return !documents?.length || documents.every((document) => !!document?.pipelineId);
}

export function ragDocumentExecutionWarning(execution) {
  const warnings = [String(execution?.ingestion_warning || "").trim()].filter(Boolean);
  const startErrors = Array.isArray(execution?.start_errors) ? execution.start_errors : [];
  if (startErrors.length) {
    const details = [...new Set(startErrors.map((error) => String(error?.message || "").trim()).filter(Boolean))];
    const startWarning = `${startErrors.length}개 문서 처리를 시작하지 못했습니다.${details.length ? ` ${details.join(" ")}` : ""}`;
    if (!warnings.some((warning) => warning.includes(startWarning))) warnings.push(startWarning);
  }
  return warnings.join(" ");
}

function documentSourceUrl(document) {
  const blobUrl = String(document?.blob_url || "").trim();
  if (blobUrl) return blobUrl;
  const path = String(document?.path || "").trim();
  if (/^(?:https?:\/\/|blob:|\/[^/])/.test(path) && !path.startsWith("/mnt/")) return path;
  return "";
}

function mimeTypeFor(filename) {
  const extension = String(filename || "").split(".").pop()?.toLowerCase();
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

export async function onboardingDocumentFile(
  document,
  { fetcher = globalThis.fetch, FileClass = globalThis.File } = {},
) {
  const filename = String(document?.name || "").trim();
  if (!filename) throw new Error("문서 파일명이 없습니다.");
  if (document?.file?.size) return document.file;
  const sourceUrl = documentSourceUrl(document);
  if (!sourceUrl) throw new Error(`${filename}: 업로드할 원본 파일 URL이 없습니다.`);
  if (typeof fetcher !== "function" || typeof FileClass !== "function") {
    throw new Error(`${filename}: 브라우저 파일 업로드 기능을 사용할 수 없습니다.`);
  }

  const response = await fetcher(sourceUrl);
  if (!response?.ok) {
    throw new Error(`${filename}: 원본 파일을 불러오지 못했습니다. (HTTP ${response?.status || 0})`);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error(`${filename}: 원본 파일이 비어 있습니다.`);
  return new FileClass([blob], filename, { type: blob.type || mimeTypeFor(filename) });
}

function uploadFailureSummary(reason, document, requestedCount, uploadedCount) {
  const filename = String(document?.name || document?.file?.name || "문서").trim() || "문서";
  return {
    requested_document_count: requestedCount,
    accepted_document_count: uploadedCount,
    skipped_document_count: requestedCount - uploadedCount,
    failed_filename: filename,
    failure_message: reason?.message || "문서 업로드에 실패했습니다.",
  };
}

function uploadedDocumentsDisplayName(documents, projectName) {
  const firstName = String(documents[0]?.filename || "").replace(/\.[^.]+$/, "").trim();
  if (!firstName) return `${String(projectName || "").trim() || "프로젝트"} 문서 지식화`;
  return documents.length > 1
    ? `${firstName} 외 ${documents.length - 1}개 지식화`
    : `${firstName} 지식화`;
}

/**
 * Upload sources and create one durable PipelineExecution for the batch.
 *
 * Callers that can explain partial processing to the user may opt in to
 * attaching successful uploads to a partial execution on a later failure.
 */
export async function createRagDocumentExecution({
  apiClient,
  projectId,
  projectName,
  displayName,
  documents,
  pipeline,
  fileOptions,
  createPartialExecutionOnUploadFailure = false,
}) {
  if (!apiClient || !projectId) throw new Error("RAG 실행에 필요한 프로젝트 정보가 없습니다.");
  if (!documents?.length) throw new Error("RAG 실행에 필요한 문서가 없습니다.");
  const executionDocuments = [];
  let uploadFailure = null;

  for (const [index, document] of documents.entries()) {
    try {
      const profile = onboardingPipelineProfile(document?.pipelineId || pipeline);
      const file = await onboardingDocumentFile(document, fileOptions);
      const uploaded = await apiClient.uploadRagDocument(projectId, file, { target: profile.target });
      executionDocuments.push({
        document_id: uploaded.document_id,
        document_revision: uploaded.document_revision,
        filename: uploaded.filename,
        upload_id: uploaded.upload_id,
        profile: { ...profile },
      });
    } catch (reason) {
      if (!createPartialExecutionOnUploadFailure || !executionDocuments.length) throw reason;
      uploadFailure = uploadFailureSummary(
        reason,
        document,
        documents.length,
        index,
      );
      break;
    }
  }

  const execution = await apiClient.createRagPipelineExecution(projectId, {
    display_name: uploadFailure
      ? uploadedDocumentsDisplayName(executionDocuments, projectName)
      : String(displayName || "").trim()
        || `${String(projectName || "").trim() || "프로젝트"} 문서 지식화`,
    documents: executionDocuments,
  });
  const result = uploadFailure ? {
    ...execution,
    ingestion_warning: `${uploadFailure.accepted_document_count}개 문서는 처리를 시작했지만 `
      + `${uploadFailure.failed_filename} 업로드에 실패해 나머지 `
      + `${uploadFailure.skipped_document_count}개 문서는 시작하지 못했습니다. 다시 업로드해주세요.`,
    ingestion_summary: uploadFailure,
  } : execution;
  const warning = ragDocumentExecutionWarning(result);
  if ((result.start_errors?.length || 0) >= executionDocuments.length) {
    const error = new Error(`선택한 문서 모두 처리를 시작하지 못했습니다.${warning ? ` ${warning}` : ""}`);
    error.execution = { ...result, ingestion_warning: warning };
    throw error;
  }
  return warning ? { ...result, ingestion_warning: warning } : result;
}

// 엠버링크 api.js 자리 — 위자드가 부르는 메서드만 같은 이름 · 같은 모양으로 둔다.
// 뒤는 이음 백엔드(/api/ieum/onboarding/*)다. 이음 응답 봉투 {resultCode, resultMsg, resultData} 를 벗겨 넘긴다.
const BASE = "/api/ieum/onboarding";
export const JOB_EVENT = "ieum:jobs-changed";

export class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.status = status; this.url = url; this.body = body;
  }
}

async function j(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || (data.resultCode && data.resultCode >= 400)) {
    throw new ApiError(data.resultMsg || `요청이 실패했습니다 (HTTP ${r.status})`, { status: r.status, url: path, body: data });
  }
  return data.resultData;
}
const post = (path, body) => j(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
const q = (pid) => (pid ? `?project_id=${encodeURIComponent(pid)}` : "");

export const api = {
  runtime: () => j("/runtime"),
  scanOpenapi: (body) => post("/scan/openapi", body),
  // 클라우드 인벤토리 — preview(조달청 G-Cloud 재현). ARM 토큰은 받지만 쓰지 않는다
  azureSubscriptions: () => j("/inventory/azure/subscriptions"),
  azureVms: (_t, sub) => j(`/inventory/azure/vms?subscription=${encodeURIComponent(sub)}`),
  azurePostgres: (_t, sub) => j(`/inventory/azure/postgres?subscription=${encodeURIComponent(sub)}`),
  azureHosts: (_t, sub) => j(`/inventory/azure/hosts?subscription=${encodeURIComponent(sub)}`),
  azureApim: (_t, sub) => j(`/inventory/azure/apim?subscription=${encodeURIComponent(sub)}`),
  azureHostProbe: (host, port = 443) => post("/inventory/azure/host-probe", { host, port }),
  azureVmProbe: (_t, vmId, port, extraPorts) => post("/inventory/azure/vm-probe", {
    vm_id: vmId, ...(port ? { port: String(port) } : {}), ...(extraPorts?.length ? { extra_ports: extraPorts.map(String) } : {}),
  }),
  fsList: (path) => j(`/fs/list${path ? `?path=${encodeURIComponent(path)}` : ""}`),
  createProject: (payload) => post("/projects", payload),
  manifestApply: (manifest, projectId, publish = false) => post("/manifest/apply", { manifest, project_id: projectId, publish }),
  jobStatus: (id) => j(`/jobs/${id}`),
  compassContext: (pid) => j(`/compass/context${q(pid)}`),
  compassContextDraft: (pid) => j(`/compass/context/draft${q(pid)}`, { method: "POST" }),
  compassContextSave: (body, pid) => j(`/compass/context${q(pid)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }),
  uploadRagDocument: (projectId, file, options = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    return j(`/projects/${projectId}/rag-pipeline-uploads?target=${encodeURIComponent(options.target || "")}`, { method: "POST", body: fd });
  },
  createRagPipelineExecution: (projectId, payload) => post(`/projects/${projectId}/rag-pipeline-executions`, payload),
};

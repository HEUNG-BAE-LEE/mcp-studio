import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";

type ActionRow = {
  id: number;
  name: string;
  toolName: string;
  description: string;
  status: string;
  actionSpec: any;
};

function paramCount(spec: any): number {
  const request = spec?.request ?? {};
  const schema = request.bodySchema ?? request.querySchema ?? {};
  return Object.keys(schema).length;
}

export default function ActionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<ActionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/actions`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(() => {
    api.get("/api/projects")
      .then((list: { id: number; name: string }[]) => {
        const found = list.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));
    load();
  }, [projectId, load]);

  async function toggle(row: ActionRow) {
    const next = row.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    try {
      await api.put(`/api/actions/${row.id}`, { status: next });
      showToast(next === "ACTIVE" ? "액션을 활성화했습니다" : "액션을 초안으로 되돌렸습니다");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(actionId: number) {
    setConfirming(null);
    try {
      await api.delete(`/api/actions/${actionId}`);
      showToast("액션을 지웠습니다");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Shell breadcrumb={["Projects", projectName, "액션"]} projectId={projectId}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">TOOL DEFINITIONS</p>
          <h1>액션</h1>
          <p className="subtitle">
            테스트 콘솔에는 ACTIVE 상태인 액션만 노출됩니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <strong>만들어진 액션이 없습니다</strong>
          <p>기록 세션에서 API 후보를 골라 액션을 만들 수 있습니다.</p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table table-5col">
            <div className="table-head">
              <span>액션</span>
              <span>Tool 이름</span>
              <span>파라미터</span>
              <span>상태</span>
              <span />
            </div>
            {rows.map((row, i) => (
              <div className="table-row" key={row.id}>
                <span>
                  <i className={`project-icon icon-${i % 3}`}>{String(row.id).padStart(2, "0")}</i>
                  <Link to={`/actions/${row.id}`}><b>{row.name}</b></Link>
                  <small>{row.description}</small>
                </span>
                <span className="mono" title={row.toolName}>{row.toolName}</span>
                <span className="mono">{paramCount(row.actionSpec)}개</span>
                <span>
                  <button onClick={() => toggle(row)}>{row.status}</button>
                </span>
                <span>
                  {confirming === row.id ? (
                    <span className="confirm-inline">
                      정말 지울까요?
                      <button className="danger" onClick={() => remove(row.id)}>지우기</button>
                      <button onClick={() => setConfirming(null)}>취소</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirming(row.id)}>삭제</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}

      <Toast message={toast} />
    </Shell>
  );
}

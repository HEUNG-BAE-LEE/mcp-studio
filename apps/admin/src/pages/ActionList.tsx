import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import CollectionBadge from "../components/CollectionMark";
import Toast, { useToast } from "../components/Toast";

type ActionRow = {
  id: number;
  name: string;
  toolName: string;
  description: string;
  status: string;
  actionSpec: any;
  sourceKind?: string;
};

function paramCount(spec: any): number {
  const request = spec?.request ?? {};
  const schema = request.bodySchema ?? request.querySchema ?? {};
  return Object.keys(schema).length;
}

// 어느 수집 방식에서 왔는지는 서버가 알려준다(Action.source_kind).
// 예전에는 authMode 로 추론했지만 그 방식으로는 문서 기반을 구분할 수 없다.
function kindOf(row: ActionRow): string {
  return row.sourceKind || (row.actionSpec?.execution?.authMode === "CREDENTIAL" ? "portal" : "traffic");
}

export default function ActionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<ActionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  // null: 아직 /api/projects 응답을 못 받음, false: 목록에 없는 id
  const [projectExists, setProjectExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toasts, showToast, dismiss } = useToast();

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
        setProjectExists(Boolean(found));
      })
      .catch((err) => setError(errorMessage(err)));
    load();
  }, [projectId, load]);

  async function toggle(row: ActionRow) {
    const next = row.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    try {
      await api.put(`/api/actions/${row.id}`, { status: next });
      showToast(next === "ACTIVE" ? "MCP 를 활성화했습니다" : "MCP 를 초안으로 되돌렸습니다");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(actionId: number) {
    setConfirming(null);
    try {
      await api.delete(`/api/actions/${actionId}`);
      showToast("MCP 를 지웠습니다");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // SessionList와 같은 규칙: 존재하지 않는 프로젝트 id도 액션 목록
  // 엔드포인트는 404 대신 빈 배열을 돌려주므로, /api/projects 목록에
  // 없는 id는 "MCP 가 없습니다"가 아니라 "프로젝트를 찾을 수 없습니다"로
  // 구분해야 한다. 두 요청이 모두 끝나기 전에는 어느 빈 상태 문구도
  // 띄우지 않는다 — 먼저 도착한 문구가 잠깐 떴다가 바뀌는 것을 막는다.
  const settled = rows !== null && projectExists !== null;
  const notFound = settled && projectExists === false;

  return (
    <Shell breadcrumb={["Projects", projectName, "MCP 조회하기"]} projectId={projectId} projectName={projectName}>
      <section className="page-head">
        <div>
          <p className="eyebrow">MCP TOOLS</p>
          <h1>MCP 조회하기</h1>
          <p className="page-sub">
            수집한 API 를 변환한 MCP 도구 목록입니다. Playground 에서는 <b>사용 중</b>인 도구만 호출됩니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-box">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {notFound && (
        <div className="empty">
          <strong>프로젝트 #{projectId}를 찾을 수 없습니다</strong>
          <p>프로젝트 목록으로 돌아가 다시 선택해 주세요.</p>
        </div>
      )}

      {settled && !notFound && rows.length === 0 && (
        <div className="empty">
          <strong>만들어진 MCP 가 없습니다</strong>
          <p>기록 세션에서 API 후보를 골라 MCP 를 만들 수 있습니다.</p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table table-5col action-table">
            <div className="table-head">
              <span>MCP 도구</span>
              <span>수집 방식</span>
              <span>Tool 이름</span>
              <span>파라미터</span>
              <span>상태</span>
            </div>
            {rows.map((row, i) => (
              <div className="table-row" key={row.id}>
                <span>
                  <i className={`project-icon icon-${i % 3}`}>{String(row.id).padStart(2, "0")}</i>
                  <Link to={`/actions/${row.id}`}><b>{row.name}</b></Link>
                  <small>{row.description}</small>
                </span>
                <span><CollectionBadge kind={kindOf(row)} /></span>
                <span className="mono" title={row.toolName}>{row.toolName}</span>
                <span className="mono">{paramCount(row.actionSpec)}개</span>
                <span>
                  {/* 상태를 그대로(ACTIVE/DRAFT) 보여주면 무엇을 누르는 버튼인지
                      알 수 없다. 지금 상태와 누르면 될 일을 함께 적는다. */}
                  <button
                    className={`state-toggle ${row.status === "ACTIVE" ? "on" : "off"}`}
                    onClick={() => toggle(row)}
                    title={row.status === "ACTIVE" ? "누르면 사용 중지" : "누르면 사용 시작"}
                  >
                    <i />
                    {row.status === "ACTIVE" ? "사용 중" : "미사용"}
                  </button>
                </span>
                <span>
                  {confirming === row.id ? (
                    <span className="confirm-inline">
                      <b>삭제할까요?</b>
                      <button className="btn-danger" onClick={() => remove(row.id)}>삭제</button>
                      <button className="btn-quiet" onClick={() => setConfirming(null)}>취소</button>
                    </span>
                  ) : (
                    <button className="btn-icon" onClick={() => setConfirming(row.id)} title="이 도구를 지웁니다">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M2.6 4.4h10.8M6 4.4V2.9h4v1.5M4 4.4l.6 8.4a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.4"
                              strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import CollectionBadge from "../components/CollectionMark";
import Toast, { useToast } from "../components/Toast";
import ConfirmPopover from "../components/ConfirmPopover";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";

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

// 액션이 어느 수집 방식에서 왔는지는 스펙에 남아 있다. 포털 공개 수집은
// 인증키를 실행 시점에 주입하므로 authMode 를 CREDENTIAL 로 적어둔다.
// 별도 컬럼을 DB에 두지 않아도 되고, 기존 액션(트래픽)은 자동으로 traffic 이 된다.
function kindOf(spec: any): string {
  return spec?.execution?.authMode === "CREDENTIAL" ? "portal" : "traffic";
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
      showToast(next === "ACTIVE" ? "액션을 활성화했습니다" : "액션을 초안으로 되돌렸습니다");
      load();
    } catch (err) {
      showToast("상태를 바꾸지 못했습니다", "error", errorMessage(err));
    }
  }

  async function remove(actionId: number) {
    setConfirming(null);
    try {
      await api.delete(`/api/actions/${actionId}`);
      showToast("액션을 지웠습니다");
      load();
    } catch (err) {
      showToast("지우지 못했습니다", "error", errorMessage(err));
    }
  }

  // SessionList와 같은 규칙: 존재하지 않는 프로젝트 id도 액션 목록
  // 엔드포인트는 404 대신 빈 배열을 돌려주므로 구분이 필요하다.
  const settled = rows !== null && projectExists !== null;
  const notFound = settled && projectExists === false;

  return (
    <Shell breadcrumb={["프로젝트", projectName, "액션"]} projectId={projectId} projectName={projectName}>
      <div className="page-head">
        <div>
          <span className="eyebrow">tool definitions</span>
          <h1>액션</h1>
          <p className="page-sub">테스트 콘솔에는 활성 상태인 액션만 노출됩니다</p>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {!settled && !error && <SkeletonRows />}

      {notFound && (
        <EmptyState
          title={`프로젝트 #${projectId}를 찾을 수 없습니다`}
          description="프로젝트 목록으로 돌아가 다시 선택해 주세요"
          action={
            <Link className="btn btn-sm" to="/">
              프로젝트 목록
            </Link>
          }
        />
      )}

      {settled && !notFound && rows.length === 0 && (
        <EmptyState
          title="만들어진 액션이 없습니다"
          description="수집 세션에서 API 후보를 골라 액션을 만들 수 있습니다"
          action={
            <Link className="btn btn-sm" to={`/projects/${projectId}`}>
              수집 세션 보기
            </Link>
          }
        />
      )}

      {rows !== null && rows.length > 0 && (
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>액션</th>
                <th style={{ width: 120 }}>수집 방식</th>
                <th style={{ width: 100 }}>파라미터</th>
                <th style={{ width: 120 }}>상태</th>
                <th style={{ width: 64 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = row.status === "ACTIVE";
                return (
                  <tr key={row.id}>
                    <td data-label="액션">
                      <Link className="cell-name" to={`/actions/${row.id}`}>
                        {row.name}
                      </Link>
                      {/* 설명은 LLM 이 도구를 고르는 유일한 근거다. 비어 있으면
                          그 사실을 목록에서 바로 알려준다. */}
                      <span className={row.description ? "cell-sub" : "cell-sub warn"}>
                        {row.description || "설명 없음 — LLM 이 이 도구를 고르기 어렵습니다"}
                      </span>
                      <span className="param-key" style={{ marginTop: 6, display: "inline-block" }}>
                        {row.toolName}
                      </span>
                    </td>
                    <td data-label="방식">
                      <CollectionBadge kind={kindOf(row.actionSpec)} />
                    </td>
                    <td data-label="파라미터" className="num">
                      {paramCount(row.actionSpec)}
                    </td>
                    <td data-label="상태">
                      {/* 조작(스위치)과 상태(점+텍스트)를 나눈다. 라벨이 ACTIVE 인
                          버튼 하나는 지금 상태인지 누르면 될 상태인지 모호했다. */}
                      <span className="cluster">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active}
                          aria-label={`${row.name} ${active ? "비활성화" : "활성화"}`}
                          className="switch"
                          onClick={() => toggle(row)}
                        />
                        <span className={active ? "dot dot-ok" : "dot"}>{active ? "활성" : "초안"}</span>
                      </span>
                    </td>
                    <td className="right">
                      <ConfirmPopover
                        open={confirming === row.id}
                        title="액션을 지울까요?"
                        description="되돌릴 수 없습니다. 테스트 콘솔에서도 사라집니다."
                        onConfirm={() => remove(row.id)}
                        onCancel={() => setConfirming(null)}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          aria-label={`${row.name} 삭제`}
                          onClick={() => setConfirming(confirming === row.id ? null : row.id)}
                        >
                          삭제
                        </button>
                      </ConfirmPopover>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

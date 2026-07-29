import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import ConfirmPopover from "../components/ConfirmPopover";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";

type Project = { id: number; name: string };

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toasts, showToast, dismiss } = useToast();

  const load = useCallback(() => {
    api.get("/api/projects")
      .then(setProjects)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  async function remove(project: Project) {
    setConfirming(null);
    try {
      const r = await api.delete(`/api/projects/${project.id}`);
      // 무엇이 함께 사라졌는지 실제 건수로 알려준다. 되돌릴 수 없는 조작이라
      // "지웠습니다" 만으로는 무엇을 잃었는지 알 수 없다.
      const also = [
        r.deletedSessions ? `세션 ${r.deletedSessions}건` : "",
        r.deletedActions ? `액션 ${r.deletedActions}건` : "",
      ].filter(Boolean).join(", ");
      showToast(`${project.name}을(를) 지웠습니다`, "ok", also ? `${also} 함께 삭제` : undefined);
      load();
    } catch (err) {
      showToast("지우지 못했습니다", "error", errorMessage(err));
    }
  }

  return (
    <Shell breadcrumb={["프로젝트"]}>
      <div className="page-head">
        <div>
          <span className="eyebrow">projects</span>
          <h1>프로젝트</h1>
          <p className="page-sub">확장 프로그램에서 수집한 내용이 프로젝트별로 모입니다</p>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {projects === null && !error && <SkeletonRows />}

      {projects !== null && projects.length === 0 && (
        <EmptyState
          title="아직 프로젝트가 없습니다"
          description={
            <>
              확장 사이드패널에서 프로젝트 이름을 입력하고
              <br />
              기록을 시작하면 여기에 나타납니다
            </>
          }
          action={
            <Link className="btn btn-sm" to="/sources">
              수집 엔진 살펴보기
            </Link>
          }
        />
      )}

      {projects !== null && projects.length > 0 && (
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>프로젝트</th>
                <th style={{ width: 96 }}>ID</th>
                <th style={{ width: 64 }} />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td data-label="프로젝트">
                    <Link className="cell-name" to={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                  </td>
                  <td data-label="ID" className="num">#{project.id}</td>
                  <td className="right">
                    <ConfirmPopover
                      open={confirming === project.id}
                      title="프로젝트를 지울까요?"
                      description="되돌릴 수 없습니다. 이 프로젝트의 수집 세션과 액션도 함께 사라집니다."
                      onConfirm={() => remove(project)}
                      onCancel={() => setConfirming(null)}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`${project.name} 삭제`}
                        onClick={() => setConfirming(confirming === project.id ? null : project.id)}
                      >
                        삭제
                      </button>
                    </ConfirmPopover>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

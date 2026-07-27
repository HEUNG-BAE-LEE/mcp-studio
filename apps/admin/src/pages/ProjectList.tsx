import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";

type Project = { id: number; name: string };

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toast, showToast } = useToast();

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
      showToast(
        also
          ? `${project.name}을(를) 지웠습니다 (${also} 함께 삭제)`
          : `${project.name}을(를) 지웠습니다`,
      );
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Shell breadcrumb={["Projects"]}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">WEB ACTION MCP BUILDER</p>
          <h1>프로젝트</h1>
          <p className="subtitle">확장 프로그램에서 기록한 내용이 프로젝트별로 모입니다.</p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {projects !== null && projects.length === 0 && (
        <div className="empty-state">
          <strong>아직 프로젝트가 없습니다</strong>
          <p>
            확장 프로그램 사이드 패널에서 프로젝트 이름을 입력하고
            <br />
            기록을 시작하면 여기에 나타납니다.
          </p>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <article className="panel recent-projects">
          <div className="project-table table-3col">
            <div className="table-head">
              <span>프로젝트</span>
              <span>ID</span>
              <span />
            </div>
            {projects.map((project, i) => (
              <div className="table-row" key={project.id}>
                <span>
                  <i className={`project-icon icon-${i % 3}`}>{String(i + 1).padStart(2, "0")}</i>
                  <Link to={`/projects/${project.id}`}>
                    <b>{project.name}</b>
                  </Link>
                </span>
                <span className="mono">#{project.id}</span>
                <span>
                  {confirming === project.id ? (
                    <span className="confirm-inline">
                      세션·액션까지 지울까요?
                      <button className="danger" onClick={() => remove(project)}>지우기</button>
                      <button onClick={() => setConfirming(null)}>취소</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirming(project.id)}>삭제</button>
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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";

type Project = { id: number; name: string };

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/projects")
      .then(setProjects)
      .catch((err) => setError(errorMessage(err)));
  }, []);

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
          <strong>목록을 불러오지 못했습니다</strong>
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
          <div className="project-table table-2col">
            <div className="table-head">
              <span>프로젝트</span>
              <span>ID</span>
            </div>
            {projects.map((project, i) => (
              <Link className="table-row" to={`/projects/${project.id}`} key={project.id}>
                <span>
                  <i className={`project-icon icon-${i % 3}`}>{String(i + 1).padStart(2, "0")}</i>
                  <b>{project.name}</b>
                </span>
                <span className="mono">#{project.id}</span>
              </Link>
            ))}
          </div>
        </article>
      )}
    </Shell>
  );
}

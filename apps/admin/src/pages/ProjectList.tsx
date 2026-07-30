import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import { KindMark, KIND_LABEL, type CollectionKind } from "../components/CollectionMark";

type Project = {
  id: number;
  name: string;
  kinds: string[];
  sessions: number;
  actions: number;
  lastCollectedAt: string | null;
};

/** 이 프로젝트에 섞여 있는 수집 방식. 없으면 아무것도 그리지 않는다 —
 *  "없음" 배지는 자리만 차지하고 아무 것도 알려주지 않는다. */
function KindBadges({ kinds }: { kinds: string[] }) {
  if (!kinds.length) return null;
  return (
    <span className="kind-row">
      {kinds.map((kind) => (
        <span key={kind} className={`kind-chip kind-${kind}`}>
          <KindMark kind={kind} size={11} />
          {KIND_LABEL[kind as CollectionKind] ?? kind}
        </span>
      ))}
    </span>
  );
}

/** "2026-07-29 14:03" 까지만. 초는 목록에서 읽는 사람에게 쓸모가 없다. */
function formatCollected(value: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast, showToast } = useToast();
  const navigate = useNavigate();

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

  async function create() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      // get-or-create 다. 같은 이름이면 기존 프로젝트로 들어간다.
      const row = await api.post("/api/projects", { name });
      setNewName("");
      navigate(`/projects/${row.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Shell breadcrumb={["Projects"]}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">WEB ACTION MCP BUILDER</p>
          <h1>프로젝트</h1>
          <p className="subtitle">
            수집한 API 는 프로젝트로 모입니다. 어떤 방식으로 모았는지가 배지로 보입니다.
          </p>
        </div>
        <div className="new-project">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="새 프로젝트 이름"
            disabled={creating}
          />
          <button onClick={create} disabled={creating || !newName.trim()}>
            {creating ? "만드는 중…" : "만들기"}
          </button>
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
            위에서 프로젝트를 하나 만들고, 그 안에서 <strong>수집 시작</strong>을 누르세요.
            <br />
            확장 사이드 패널에서 기록을 시작해도 프로젝트가 자동으로 만들어집니다.
          </p>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <article className="panel recent-projects">
          <div className="project-table table-projects">
            <div className="table-head">
              <span>프로젝트</span>
              <span>수집 세션</span>
              <span>액션</span>
              <span>마지막 수집</span>
              <span />
            </div>
            {projects.map((project, i) => (
              <div className="table-row" key={project.id}>
                <span>
                  <i className={`project-icon icon-${i % 3}`}>{String(i + 1).padStart(2, "0")}</i>
                  <Link to={`/projects/${project.id}`}><b>{project.name}</b></Link>
                  <small className="mono">#{project.id}</small>
                  <KindBadges kinds={project.kinds} />
                </span>
                <span className="mono">{project.sessions}</span>
                <span className="mono">{project.actions}</span>
                <span className="mono">{formatCollected(project.lastCollectedAt)}</span>
                <span>
                  {/* 삭제 확인은 인라인이다. window.confirm 은 촬영 화면에서 튀고 자동화를 막는다 */}
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

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import ConfirmPopover from "../components/ConfirmPopover";
import CollectModal from "../components/CollectModal";
import ProjectEditModal from "../components/ProjectEditModal";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";
import { KindMark, KIND_LABEL, type CollectionKind } from "../components/CollectionMark";

type Project = {
  id: number;
  name: string;
  description: string;
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
    <span className="cluster" style={{ gap: 5, marginTop: 7 }}>
      {kinds.map((kind) => (
        <span key={kind} className={`kind-badge kind-${kind}`}>
          <KindMark kind={kind} size={11} />
          {KIND_LABEL[kind as CollectionKind] ?? kind}
        </span>
      ))}
    </span>
  );
}

/** "2026-07-29 14:03" 까지만. 초는 목록에서 읽는 사람에게 쓸모가 없다. */
function formatCollected(value: string | null): string {
  if (!value) return "아직 없음";
  return value.replace("T", " ").slice(0, 16);
}

/** 카드 머릿글자. 이름이 비어 있을 수는 없지만 방어해 둔다. */
function initial(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [collecting, setCollecting] = useState<Project | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toasts, showToast, dismiss } = useToast();
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/api/projects")
      .then(setProjects)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  // 바깥을 누르면 열려 있던 카드 메뉴를 닫는다. 메뉴가 켜진 채로 다른 카드를
  // 만지면 어느 프로젝트를 조작하는지 헷갈린다.
  useEffect(() => {
    if (menuFor === null) return;
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuFor]);

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
    <Shell breadcrumb={["프로젝트"]}>
      <div className="page-head">
        <div>
          <span className="eyebrow">projects</span>
          <h1>프로젝트</h1>
          <p className="page-sub">
            수집한 API 는 프로젝트로 모입니다. 카드에서 바로 수집을 시작할 수 있습니다.
          </p>
        </div>
        <div className="head-side">
          <input
            className="input"
            style={{ width: 200 }}
            value={newName}
            aria-label="새 프로젝트 이름"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="새 프로젝트 이름"
            disabled={creating}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={create}
            disabled={creating || !newName.trim()}
          >
            {creating ? "만드는 중…" : "만들기"}
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {projects === null && !error && <SkeletonRows />}

      {projects !== null && projects.length === 0 && (
        <EmptyState
          title="아직 프로젝트가 없습니다"
          description={
            <>
              위에서 프로젝트를 하나 만들고, 카드의 <strong>수집하기</strong>를 누르세요.
              <br />
              확장 사이드 패널에서 기록을 시작해도 프로젝트가 자동으로 만들어집니다.
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
        <div className="pj-grid">
          {projects.map((project) => (
            <article className="pj-card" key={project.id}>
              <div className="pj-card-top">
                <span className={`pj-mark tone-${project.id % 4}`} aria-hidden="true">
                  {initial(project.name)}
                </span>
                <div className="pj-card-name">
                  <Link className="cell-name" to={`/projects/${project.id}`}>{project.name}</Link>
                  {/* 설명이 없어도 두 줄을 비워 둔다. 길이에 따라 카드 높이가
                      흔들리면 그리드가 어긋나 보인다. */}
                  <p className={project.description ? "" : "t4"}>
                    {project.description || "설명이 없습니다"}
                  </p>
                </div>

                <div className="pop-anchor pj-menu-anchor">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={`${project.name} 메뉴`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuFor === project.id ? null : project.id);
                    }}
                  >⋯</button>

                  {menuFor === project.id && (
                    <div className="popover pj-menu" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => { setMenuFor(null); setEditing(project); }}>
                        이름·설명 수정
                      </button>
                      <button type="button" onClick={() => { setMenuFor(null); setCollecting(project); }}>
                        수집하기
                      </button>
                      <button type="button"
                              onClick={() => { setMenuFor(null); navigate(`/projects/${project.id}/console`); }}>
                        인증키 관리
                      </button>
                      <hr className="hair" />
                      <button type="button" className="is-danger"
                              onClick={() => { setMenuFor(null); setConfirming(project.id); }}>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <KindBadges kinds={project.kinds} />

              <div className="pj-metrics">
                <div><b className="num">{project.actions}</b><span>MCP 도구</span></div>
                <div><b className="num">{project.sessions}</b><span>수집 세션</span></div>
                <div><b className="num">{project.kinds.length}</b><span>수집 방식</span></div>
              </div>

              <p className="pj-when num">마지막 수집 · {formatCollected(project.lastCollectedAt)}</p>

              <div className="pj-card-foot">
                <button type="button" className="btn btn-primary btn-block"
                        onClick={() => setCollecting(project)}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                       strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M8 3.4v9.2M3.4 8h9.2" />
                  </svg>
                  수집하기
                </button>
                <Link className="btn btn-sm" to={`/projects/${project.id}`}>열기</Link>
              </div>

              {/* 삭제 확인은 팝오버다. window.confirm 은 촬영 화면에서 튀고
                  자동화를 막는다. */}
              <ConfirmPopover
                open={confirming === project.id}
                title="프로젝트를 지울까요?"
                description="되돌릴 수 없습니다. 함께 사라지는 것:"
                facts={[
                  { label: "수집 세션", value: String(project.sessions) },
                  { label: "액션", value: String(project.actions) },
                ]}
                onConfirm={() => remove(project)}
                onCancel={() => setConfirming(null)}
              >
                <span className="pj-confirm-anchor" />
              </ConfirmPopover>
            </article>
          ))}
        </div>
      )}

      {/* 목록이 짧으면 화면 아래가 통째로 빈다. 장식 대신 실제 작업 순서를
          적는다 — 이 도구를 처음 여는 사람이 가장 먼저 묻는 것이다. */}
      {projects !== null && projects.length > 0 && (
        <section className="flow" aria-label="작업 순서">
          <div>
            <i aria-hidden="true">1</i>
            <strong>프로젝트에서 수집 시작</strong>
            <p>카드의 <strong>수집하기</strong>를 누르고 트래픽·포털·문서 중 방식을 고릅니다.</p>
          </div>
          <div>
            <i aria-hidden="true">2</i>
            <strong>후보에서 액션 만들기</strong>
            <p>수집된 후보 중 쓸 것을 고르고, LLM 이 읽을 설명과 파라미터를 다듬습니다.</p>
          </div>
          <div>
            <i aria-hidden="true">3</i>
            <strong>콘솔에서 테스트</strong>
            <p>활성화한 액션을 질의로 호출해 도구 선택과 실행 결과를 확인합니다.</p>
          </div>
        </section>
      )}

      {editing && (
        <ProjectEditModal
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => { setEditing(null); showToast(`${name} 을(를) 저장했습니다`); load(); }}
        />
      )}

      {collecting && (
        <CollectModal
          projectId={collecting.id}
          projectName={collecting.name}
          onClose={() => { setCollecting(null); load(); }}
        />
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

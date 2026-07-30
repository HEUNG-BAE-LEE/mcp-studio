import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import CollectModal from "../components/CollectModal";
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
  const { toast, showToast } = useToast();
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
    function close() { setMenuFor(null); }
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
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
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
            수집한 API 는 프로젝트로 모입니다. 카드에서 바로 수집을 시작할 수 있습니다.
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
            위에서 프로젝트를 하나 만들고, 카드의 <strong>수집하기</strong>를 누르세요.
            <br />
            확장 사이드 패널에서 기록을 시작해도 프로젝트가 자동으로 만들어집니다.
          </p>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <div className="pj-grid">
          {projects.map((project) => (
            <article className="pj-card" key={project.id}>
              <div className="pj-top">
                <span className={`pj-avatar tone-${project.id % 4}`}>{initial(project.name)}</span>
                <div className="pj-title">
                  <Link to={`/projects/${project.id}`}>{project.name}</Link>
                  {/* 설명이 없어도 자리를 비워 둔다. 카드 높이가 들쭉날쭉하면
                      그리드가 어긋나 보인다. */}
                  <p className={project.description ? "" : "is-empty"}>
                    {project.description || "설명이 없습니다"}
                  </p>
                </div>

                <div className="pj-menu-wrap">
                  <button
                    className="pj-menu-btn"
                    aria-label="프로젝트 메뉴"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuFor === project.id ? null : project.id);
                    }}
                  >⋯</button>

                  {menuFor === project.id && (
                    <div className="pj-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setMenuFor(null); setEditing(project); }}>
                        이름·설명 수정
                      </button>
                      <button onClick={() => { setMenuFor(null); setCollecting(project); }}>
                        수집하기
                      </button>
                      <button onClick={() => { setMenuFor(null); navigate(`/projects/${project.id}/console`); }}>
                        인증키 관리
                      </button>
                      <hr />
                      <button className="danger" onClick={() => { setMenuFor(null); setConfirming(project.id); }}>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <KindBadges kinds={project.kinds} />

              <div className="pj-stats">
                <div><b>{project.actions}</b><span>MCP 도구</span></div>
                <div><b>{project.sessions}</b><span>수집 세션</span></div>
                <div><b>{project.kinds.length}</b><span>수집 방식</span></div>
              </div>

              <p className="pj-when">마지막 수집 · {formatCollected(project.lastCollectedAt)}</p>

              {confirming === project.id ? (
                <div className="pj-confirm">
                  <span>세션·액션까지 지울까요?</span>
                  <button className="btn-danger" onClick={() => remove(project)}>지우기</button>
                  <button className="btn-quiet" onClick={() => setConfirming(null)}>취소</button>
                </div>
              ) : (
                <div className="pj-foot">
                  <button className="pj-collect" onClick={() => setCollecting(project)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         strokeWidth="1.8" strokeLinecap="round">
                      <path d="M8 3.4v9.2M3.4 8h9.2" />
                    </svg>
                    수집하기
                  </button>
                  <Link className="pj-open" to={`/projects/${project.id}`}>열기</Link>
                </div>
              )}
            </article>
          ))}

          {/* 새로 만들기를 카드 자리에도 둔다. 목록이 길어지면 위쪽 입력란이
              화면 밖으로 나가 "어디서 만들지"를 다시 찾게 된다. */}
          <button className="pj-card pj-new" onClick={() => {
            const input = document.querySelector<HTMLInputElement>(".new-project input");
            input?.focus();
            input?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}>
            <span aria-hidden="true">＋</span>
            <b>새 프로젝트</b>
            <small>위 입력란에서 이름을 정합니다</small>
          </button>
        </div>
      )}

      {editing && (
        <EditDialog
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

      <Toast message={toast} />
    </Shell>
  );
}

/** 이름·설명 수정 창.
 *
 *  이름은 확장이 프로젝트를 찾는 열쇠이기도 해서(같은 이름이면 같은 프로젝트),
 *  바꾸면 확장 쪽 설정도 함께 고쳐야 한다. 그 사실을 창 안에서 알린다. */
function EditDialog({
  project, onClose, onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setLocal("프로젝트 이름을 입력해 주세요"); return; }
    setSaving(true);
    setLocal(null);
    try {
      await api.patch(`/api/projects/${project.id}`, { name: trimmed, description: description.trim() });
      onSaved(trimmed);
    } catch (err) {
      // 이름 중복(409)은 이 창 안에서 고칠 수 있는 문제다. 바깥 배너로 보내면
      // 창을 닫아야 읽을 수 있다.
      setLocal(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="dlg-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={onClose}>
      <div className="dlg edit-dlg" onClick={(e) => e.stopPropagation()}>
        <header className="dlg-head">
          <div>
            <h2 id="edit-title">이름·설명 수정</h2>
            <p>설명은 목록 카드에 두 줄까지 보입니다</p>
          </div>
          <button className="dlg-close" onClick={onClose} disabled={saving} aria-label="닫기">✕</button>
        </header>

        <div className="dlg-body">
          <label className="fld">
            <span>이름</span>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </label>
          <label className="fld">
            <span>설명</span>
            <textarea
              rows={3}
              value={description}
              placeholder="무엇을 모아 둔 프로젝트인지 한두 줄로"
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </label>
          <p className="fld-note">
            이름은 확장이 프로젝트를 찾는 열쇠이기도 합니다. 바꾸면 확장 사이드 패널의
            프로젝트 이름도 같이 고쳐 주세요.
          </p>
          {local && <p className="fld-error">{local}</p>}
        </div>

        <footer className="dlg-foot">
          <button className="btn-quiet" onClick={onClose} disabled={saving}>취소</button>
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </footer>
      </div>
    </div>
  );
}

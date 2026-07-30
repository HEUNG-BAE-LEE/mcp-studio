import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import ConfirmPopover from "../components/ConfirmPopover";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";
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
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
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
            수집한 API 는 프로젝트로 모입니다. 어떤 방식으로 모았는지가 배지로 보입니다.
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
              위에서 프로젝트를 하나 만들고, 그 안에서 <strong>수집 시작</strong>을 누르세요.
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
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>프로젝트</th>
                <th style={{ width: 110 }}>수집 세션</th>
                <th style={{ width: 90 }}>액션</th>
                <th style={{ width: 170 }}>마지막 수집</th>
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td data-label="프로젝트">
                    <Link className="cell-name" to={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                    <span className="cell-sub num">#{project.id}</span>
                    <KindBadges kinds={project.kinds} />
                  </td>
                  <td data-label="세션" className="num">{project.sessions}</td>
                  <td data-label="액션" className="num">{project.actions}</td>
                  <td data-label="마지막 수집" className="num t3">
                    {formatCollected(project.lastCollectedAt)}
                  </td>
                  <td className="right">
                    {/* 삭제 확인은 팝오버다. window.confirm 은 촬영 화면에서 튀고
                        자동화를 막는다. 셀 안에서 펼치면 열 폭이 밀린다. */}
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

      {/* 목록이 짧으면 화면 아래가 통째로 빈다. 장식 대신 실제 작업 순서를
          적는다 — 이 도구를 처음 여는 사람이 가장 먼저 묻는 것이다. */}
      {projects !== null && projects.length > 0 && (
        <section className="flow" aria-label="작업 순서">
          <div>
            <i aria-hidden="true">1</i>
            <strong>프로젝트에서 수집 시작</strong>
            <p>프로젝트에 들어가 <strong>수집 시작</strong>을 누르고 트래픽·포털 중 방식을 고릅니다.</p>
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

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

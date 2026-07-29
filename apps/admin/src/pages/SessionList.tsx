import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import CollectionBadge from "../components/CollectionMark";

type SessionRow = {
  id: number;
  kind: string;
  sourceLabel: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  // 후보의 정체는 수집 방식마다 다르다(트래픽=요청, 포털=오퍼레이션).
  // 표를 둘로 쪼개지 않도록 세는 단위를 한 필드로 통일한다.
  candidateCount: number;
  requestCount: number;
  topScore: number | null;
};

function formatTime(value: string | null): string {
  if (!value) return "-";
  // 백엔드는 naive UTC로 돌려준다. 화면에는 초까지만 보여준다.
  return value.replace("T", " ").slice(0, 19);
}

export default function SessionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  // null: 아직 /api/projects 응답을 못 받음, false: 목록에 없는 id
  const [projectExists, setProjectExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/recording-sessions`)
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

  async function remove(sessionId: number) {
    setConfirming(null);
    try {
      await api.delete(`/api/recording-sessions/${sessionId}`);
      showToast(`세션 #${sessionId}을 지웠습니다`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // 존재하지 않는 프로젝트 id는 세션 목록 엔드포인트가 404 대신 빈 배열을
  // 돌려준다. 그대로 두면 "기록된 세션이 없습니다"가 떠서 프로젝트가
  // 있는 것처럼 보이므로, /api/projects 목록에 없는 id는 따로 구분한다.
  //
  // 두 요청이 모두 끝나기 전에는 어느 빈 상태 문구도 띄우지 않는다.
  // 세션 목록은 없는 id에도 []를 즉시 돌려주므로, 먼저 도착하면
  // "기록된 세션이 없습니다"가 잠깐 떴다가 "찾을 수 없습니다"로 바뀐다.
  const settled = rows !== null && projectExists !== null;
  const notFound = settled && projectExists === false;

  return (
    <Shell breadcrumb={["Projects", projectName]} projectId={projectId} projectName={projectName}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">COLLECTION SESSIONS</p>
          <h1>수집 세션</h1>
          <p className="subtitle">트래픽 기반·포털 공개 기반 수집이 한 목록에 모입니다.</p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {notFound && (
        <div className="empty-state">
          <strong>프로젝트 #{projectId}를 찾을 수 없습니다</strong>
          <p>프로젝트 목록으로 돌아가 다시 선택해 주세요.</p>
        </div>
      )}

      {settled && !notFound && rows.length === 0 && (
        <div className="empty-state">
          <strong>수집된 세션이 없습니다</strong>
          <p>확장 사이드 패널에서 트래픽 기록을 시작하거나, 포털 명세 페이지에서 공개 명세를 수집해 보세요.</p>
        </div>
      )}

      {/* 삭제가 실패해도 표는 남긴다. 이미 불러온 목록은 여전히 유효하고,
          한 행의 삭제 실패로 목록 전체가 사라지면 오히려 혼란스럽다. */}
      {rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table table-5col">
            <div className="table-head">
              <span>세션</span>
              <span>수집 방식</span>
              <span>후보</span>
              <span>최고 점수</span>
              <span />
            </div>
            {rows.map((row, i) => (
              <div className="table-row" key={row.id}>
                <span>
                  {/* 아이콘을 앞에 둬 ProjectList와 같은 첫 칸 구조를 쓴다 */}
                  <i className={`project-icon icon-${i % 3}`}>{String(row.id).padStart(2, "0")}</i>
                  {/* 수집 방식마다 후보 화면이 다르다. 링크도 그에 맞춰 갈라진다. */}
                  <Link to={row.kind === "portal" ? `/spec-sessions/${row.id}` : `/sessions/${row.id}`}>
                    <b>세션 #{row.id}</b>
                  </Link>
                  <small>{row.sourceLabel || formatTime(row.startedAt)}</small>
                </span>
                <span><CollectionBadge kind={row.kind} /></span>
                <span className="mono">
                  {row.candidateCount ?? row.requestCount}
                  {row.kind === "portal" ? " op" : "건"}
                </span>
                <span className="mono">
                  {row.kind === "portal"
                    ? "—"
                    : row.topScore === null
                      ? "분석 전"
                      : `★ ${row.topScore}`}
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

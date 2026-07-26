import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";

type SessionRow = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
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
  const notFound = projectExists === false;

  return (
    <Shell breadcrumb={["Projects", projectName]} projectId={projectId}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">RECORDING SESSIONS</p>
          <h1>기록 세션</h1>
          <p className="subtitle">확장 프로그램에서 전송한 클릭과 API 호출입니다.</p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && notFound && (
        <div className="empty-state">
          <strong>프로젝트 #{projectId}를 찾을 수 없습니다</strong>
          <p>프로젝트 목록으로 돌아가 다시 선택해 주세요.</p>
        </div>
      )}

      {!error && !notFound && rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <strong>기록된 세션이 없습니다</strong>
          <p>확장 프로그램 사이드 패널에서 기록을 시작해 보세요.</p>
        </div>
      )}

      {!error && !notFound && rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table table-5col">
            <div className="table-head">
              <span>세션</span>
              <span>요청</span>
              <span>최고 점수</span>
              <span>상태</span>
              <span />
            </div>
            {rows.map((row) => (
              <div className="table-row" key={row.id}>
                <span>
                  <Link to={`/sessions/${row.id}`}>
                    <b>세션 #{row.id}</b>
                  </Link>
                  <small>{formatTime(row.startedAt)}</small>
                </span>
                <span className="mono">{row.requestCount}건</span>
                <span className="mono">
                  {row.topScore === null ? "분석 전" : `★ ${row.topScore}`}
                </span>
                <span>{row.status}</span>
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

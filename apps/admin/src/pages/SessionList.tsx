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

type Kind = "portal" | "traffic" | "document";

/** 탭마다 다른 것은 이름·빈 상태 문구뿐이다. 조건문을 세 군데 흩뿌리는 대신
 *  한 표로 두고 tab 으로 꺼내 쓴다. 방식이 늘면 여기 한 줄만 더한다. */
const TABS: { kind: Kind; label: string; emptyTitle: string; emptyHint: string }[] = [
  {
    kind: "portal",
    label: "게시 수집",
    emptyTitle: "게시 수집 결과가 없습니다",
    emptyHint: "API 수집하기에서 포털 주소를 등록해 수집을 시작하세요.",
  },
  {
    kind: "traffic",
    label: "트래픽 수집",
    emptyTitle: "트래픽 수집 결과가 없습니다",
    emptyHint: "확장 사이드 패널에서 트래픽 기록을 시작하세요.",
  },
  {
    kind: "document",
    label: "문서 수집",
    emptyTitle: "문서 수집 결과가 없습니다",
    emptyHint: "API 수집하기에서 활용가이드 문서를 올려 보세요.",
  },
];

// 트래픽 세션은 kind 가 비어 있는 옛 데이터가 있다. 그때는 트래픽으로 본다.
const kindOf = (raw: string | null | undefined): Kind =>
  raw === "portal" || raw === "document" ? raw : "traffic";

export default function SessionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  // null: 아직 /api/projects 응답을 못 받음, false: 목록에 없는 id
  const [projectExists, setProjectExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  // 두 수집 방식은 후보의 정체도 판단 기준도 다르다(트래픽은 점수, 게시는 명세).
  // 한 표에 섞으면 어느 열을 봐야 하는지가 매번 달라진다. 탭으로 나눈다.
  const [tab, setTab] = useState<Kind>("portal");
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
  const visible = (rows ?? []).filter((row) => kindOf(row.kind) === tab);
  const current = TABS.find((t) => t.kind === tab)!;
  const notFound = settled && projectExists === false;

  return (
    <Shell breadcrumb={["Projects", projectName]} projectId={projectId} projectName={projectName}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">COLLECTION</p>
          <h1>수집현황</h1>
          <p className="subtitle">수집 방식별로 무엇을 모았는지 확인하고, 액션으로 만들 후보를 고릅니다.</p>
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

      {settled && !notFound && rows.length > 0 && (
        <nav className="kind-tabs" aria-label="수집 방식">
          {TABS.map((t) => (
            <button key={t.kind} className={tab === t.kind ? "on" : ""} onClick={() => setTab(t.kind)}>
              {t.label}
              <em>{rows.filter((r) => kindOf(r.kind) === t.kind).length}</em>
            </button>
          ))}
        </nav>
      )}

      {settled && !notFound && rows.length === 0 && (
        <div className="empty-state">
          <strong>수집된 세션이 없습니다</strong>
          <p>확장 사이드 패널에서 트래픽 기록을 시작하거나, 포털 명세 페이지에서 공개 명세를 수집해 보세요.</p>
        </div>
      )}

      {/* 삭제가 실패해도 표는 남긴다. 이미 불러온 목록은 여전히 유효하고,
          한 행의 삭제 실패로 목록 전체가 사라지면 오히려 혼란스럽다. */}
      {rows !== null && rows.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          <strong>{current.emptyTitle}</strong>
          <p>{current.emptyHint}</p>
        </div>
      )}

      {rows !== null && visible.length > 0 && (
        <article className="panel">
          <div className="project-table table-5col">
            <div className="table-head">
              <span>세션</span>
              <span>수집 방식</span>
              <span>후보</span>
              <span>{tab === "traffic" ? "최고 점수" : "수집 시각"}</span>
              <span />
            </div>
            {visible.map((row, i) => (
              <div className="table-row" key={row.id}>
                <span>
                  {/* 아이콘을 앞에 둬 ProjectList와 같은 첫 칸 구조를 쓴다 */}
                  <i className={`project-icon icon-${i % 3}`}>{String(row.id).padStart(2, "0")}</i>
                  {/* 수집 방식마다 후보 화면이 다르다. 링크도 그에 맞춰 갈라진다. */}
                  <Link to={kindOf(row.kind) === "traffic" ? `/sessions/${row.id}` : `/spec-sessions/${row.id}`}>
                    <b>세션 #{row.id}</b>
                  </Link>
                  <small>{row.sourceLabel || formatTime(row.startedAt)}</small>
                </span>
                <span><CollectionBadge kind={row.kind} /></span>
                <span className="mono">
                  {row.candidateCount ?? row.requestCount}
                  {kindOf(row.kind) === "traffic" ? "건" : " op"}
                </span>
                <span className="mono">
                  {tab === "traffic"
                    ? row.topScore === null ? "분석 전" : `★ ${row.topScore}`
                    : formatTime(row.startedAt).slice(5, 16)}
                </span>
                <span>
                  {confirming === row.id ? (
                    <span className="confirm-inline">
                      정말 지울까요?
                      <button className="btn-danger" onClick={() => remove(row.id)}>지우기</button>
                      <button className="btn-quiet" onClick={() => setConfirming(null)}>취소</button>
                    </span>
                  ) : (
                    <button className="btn-icon" onClick={() => setConfirming(row.id)} title="이 세션을 지웁니다">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M2.6 4.4h10.8M6 4.4V2.9h4v1.5M4 4.4l.6 8.4a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.4"
                              strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
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

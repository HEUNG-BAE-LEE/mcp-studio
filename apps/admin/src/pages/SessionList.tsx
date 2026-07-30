import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import ConfirmPopover from "../components/ConfirmPopover";
import CollectionBadge from "../components/CollectionMark";
import CollectStartModal from "../components/CollectStartModal";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";

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
  // 백엔드는 naive UTC로 돌려준다. 화면에는 분까지만 보여준다.
  return value.replace("T", " ").slice(0, 16);
}

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "traffic", label: "트래픽" },
  { key: "portal", label: "포털" },
];

export default function SessionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  // null: 아직 /api/projects 응답을 못 받음, false: 목록에 없는 id
  const [projectExists, setProjectExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState("all");
  const { toasts, showToast, dismiss } = useToast();

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
      showToast("지우지 못했습니다", "error", errorMessage(err));
    }
  }

  // 존재하지 않는 프로젝트 id는 세션 목록 엔드포인트가 404 대신 빈 배열을
  // 돌려준다. 그대로 두면 "수집된 세션이 없습니다"가 떠서 프로젝트가
  // 있는 것처럼 보이므로, /api/projects 목록에 없는 id는 따로 구분한다.
  //
  // 두 요청이 모두 끝나기 전에는 어느 빈 상태 문구도 띄우지 않는다.
  const settled = rows !== null && projectExists !== null;
  const notFound = settled && projectExists === false;

  // 필터는 이미 받아온 배열을 거를 뿐이다. 추가 요청을 만들지 않는다.
  const counts = {
    all: rows?.length ?? 0,
    traffic: rows?.filter((r) => r.kind !== "portal").length ?? 0,
    portal: rows?.filter((r) => r.kind === "portal").length ?? 0,
  };
  const visible = (rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "portal" ? r.kind === "portal" : r.kind !== "portal",
  );

  return (
    <Shell breadcrumb={["프로젝트", projectName, "수집 세션"]} projectId={projectId} projectName={projectName}>
      <div className="page-head">
        <div>
          <span className="eyebrow">collection</span>
          <h1>수집 세션</h1>
          <p className="page-sub">트래픽·포털 공개 수집이 한 목록에 모입니다</p>
        </div>
        {!notFound && (
          <div className="head-side">
            <button type="button" className="btn btn-primary" onClick={() => setStarting(true)}>
              수집 시작
            </button>
          </div>
        )}
      </div>

      {/* 닫을 때 목록을 다시 읽는다. 팝업 안에서 일괄 수집이 끝났을 수 있고,
          "수집 결과 보기" 로 나가면 화면이 옮겨가지만 Esc·배경 클릭으로 닫으면
          목록이 낡은 채 남아 "수집된 세션이 없습니다" 가 그대로 보인다. */}
      {starting && projectId != null && (
        <CollectStartModal
          projectId={projectId}
          projectName={projectName}
          onClose={() => {
            setStarting(false);
            load();
          }}
        />
      )}

      {error && <ErrorBox message={error} />}

      {!settled && !error && <SkeletonRows />}

      {notFound && (
        <EmptyState
          title={`프로젝트 #${projectId}를 찾을 수 없습니다`}
          description="프로젝트 목록으로 돌아가 다시 선택해 주세요"
          action={
            <Link className="btn btn-sm" to="/">
              프로젝트 목록
            </Link>
          }
        />
      )}

      {settled && !notFound && rows.length === 0 && (
        <EmptyState
          title="수집된 세션이 없습니다"
          description={
            <>
              위의 <strong>수집 시작</strong>을 눌러 수집 방식을 고르세요
            </>
          }
          action={
            <button type="button" className="btn btn-sm" onClick={() => setStarting(true)}>
              수집 시작
            </button>
          }
        />
      )}

      {/* 삭제가 실패해도 표는 남긴다. 이미 불러온 목록은 여전히 유효하고,
          한 행의 삭제 실패로 목록 전체가 사라지면 오히려 혼란스럽다. */}
      {rows !== null && rows.length > 0 && (
        <div className="panel">
          <div className="tbl-toolbar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? "filter-chip active" : "filter-chip"}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <b>{counts[f.key as keyof typeof counts]}</b>
              </button>
            ))}
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>세션</th>
                <th style={{ width: 130 }}>수집 방식</th>
                <th style={{ width: 160 }}>후보</th>
                <th style={{ width: 140 }}>품질</th>
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td data-label="세션">
                    {/* 수집 방식마다 후보 화면이 다르다. 링크도 그에 맞춰 갈라진다. */}
                    <Link
                      className="cell-name"
                      to={row.kind === "portal" ? `/spec-sessions/${row.id}` : `/sessions/${row.id}`}
                    >
                      세션 #{row.id}
                    </Link>
                    <span className="cell-sub truncate">
                      {row.sourceLabel ? `${row.sourceLabel} · ` : ""}
                      {formatTime(row.startedAt)}
                    </span>
                  </td>
                  <td data-label="방식">
                    <CollectionBadge kind={row.kind} />
                  </td>
                  <td data-label="후보">
                    <span className="num">{row.candidateCount ?? row.requestCount}</span>{" "}
                    <span className="t3 xs">{row.kind === "portal" ? "오퍼레이션" : "요청"}</span>
                  </td>
                  <td data-label="품질">
                    {row.kind === "portal" ? (
                      <span className="t3 xs">해당 없음</span>
                    ) : row.topScore === null ? (
                      <span className="t3 xs">분석 전</span>
                    ) : (
                      <span className="cluster">
                        <span className="bar">
                          <span style={{ width: `${Math.min(100, Math.max(0, row.topScore))}%` }} />
                        </span>
                        <span className="num">{row.topScore}</span>
                      </span>
                    )}
                  </td>
                  <td className="right">
                    <ConfirmPopover
                      open={confirming === row.id}
                      title={`세션 #${row.id}을 지울까요?`}
                      description="되돌릴 수 없습니다. 이미 만든 액션은 값을 복사해 두므로 그대로 남습니다."
                      onConfirm={() => remove(row.id)}
                      onCancel={() => setConfirming(null)}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`세션 #${row.id} 삭제`}
                        onClick={() => setConfirming(confirming === row.id ? null : row.id)}
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

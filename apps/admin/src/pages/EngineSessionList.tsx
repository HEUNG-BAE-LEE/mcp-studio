import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import CollectionBadge from "../components/CollectionMark";

/**
 * 한 수집 방식으로 모은 세션 전부. 프로젝트 경계를 넘어 훑는다.
 *
 * 프로젝트는 주제("미세먼지", "실거래가")고 엔진은 그 주제를 어떻게 모았는지다.
 * 같은 주제를 두 방식으로 모을 수 있으므로 프로젝트를 엔진별로 쪼개지 않는다.
 * 대신 이 화면이 "이 방식으로 무엇을 모았나"를 답한다 — 그래서 어느 프로젝트
 * 것인지가 표의 핵심 열이다.
 */

const LABELS: Record<string, { title: string; unit: string; blurb: string }> = {
  traffic: {
    title: "트래픽 기반 수집",
    unit: "요청",
    blurb: "화면을 쓰는 동안 관측한 API 호출입니다.",
  },
  portal: {
    title: "포털 공개 기반 수집",
    unit: "오퍼레이션",
    blurb: "포털이 공개한 명세에서 읽은 오퍼레이션입니다.",
  },
  document: {
    title: "문서 기반 수집",
    unit: "오퍼레이션",
    blurb: "활용가이드 문서에서 구조화한 명세입니다.",
  },
};

type Row = {
  id: number;
  kind: string;
  projectId: number;
  projectName: string;
  sourceLabel: string;
  candidateCount: number;
  topScore: number | null;
  status: string;
  startedAt: string;
};

function formatTime(value: string | null): string {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 19);
}

export default function EngineSessionList() {
  const { kind = "traffic" } = useParams();
  const meta = LABELS[kind] ?? LABELS.traffic;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    api.get(`/api/collection-engines/${kind}/sessions`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [kind]);

  return (
    <Shell breadcrumb={["수집 엔진", meta.title]}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">수집 이력</p>
          <h1>{meta.title}</h1>
          <p className="subtitle">{meta.blurb}</p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>목록을 불러오지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <strong>아직 이 방식으로 수집한 것이 없습니다</strong>
          <p>
            <Link to="/sources">수집 엔진</Link> 화면에서 시작하는 방법을 볼 수 있습니다.
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table table-5col">
            <div className="table-head">
              <span>세션</span>
              <span>방식</span>
              <span>{meta.unit}</span>
              <span>프로젝트</span>
              <span>수집 시각</span>
            </div>
            {rows.map((row) => (
              <div className="table-row" key={row.id}>
                <span>
                  <i className={`project-icon icon-${row.id % 3}`}>
                    {String(row.id).padStart(2, "0")}
                  </i>
                  <Link to={row.kind === "portal" ? `/spec-sessions/${row.id}` : `/sessions/${row.id}`}>
                    <b>세션 #{row.id}</b>
                  </Link>
                  <small>{row.sourceLabel}</small>
                </span>
                <span><CollectionBadge kind={row.kind} /></span>
                <span className="mono">{row.candidateCount}</span>
                <span>
                  {/* 엔진별 목록에서 어느 프로젝트 것인지가 핵심이다 — 같은 방식으로
                      모은 것이 여러 프로젝트에 흩어져 있을 수 있다. */}
                  <Link to={`/projects/${row.projectId}`}>{row.projectName}</Link>
                </span>
                <span className="mono">{formatTime(row.startedAt)}</span>
              </div>
            ))}
          </div>
        </article>
      )}
    </Shell>
  );
}
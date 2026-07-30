import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CrawlPreviewDialog from "./CrawlPreviewDialog";

/**
 * 포털 목록 URL 하나를 등록해 API 를 일괄 수집한다.
 *
 * 진행 상황은 여기서 보여주지 않는다. 수집은 서버에서 돌기 때문에 화면 안에
 * 상태를 들고 있으면 다른 메뉴를 눌렀다 돌아왔을 때 사라진다 — 사용자는 수집이
 * 취소된 줄 안다. 시작하면 **수집 진행현황** 화면으로 넘겨, 상태를 서버에서
 * 읽게 한다.
 */

type Project = { id: number; name: string };

type RunningJob = { id: number; operations: number; limit: number };

const PRESETS = [
  { label: "대기·미세먼지", keyword: "미세먼지" },
  { label: "날씨", keyword: "기상" },
  { label: "교통", keyword: "교통" },
  { label: "관광", keyword: "관광" },
];

function listUrlFor(keyword: string): string {
  return (
    "https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&keyword=" +
    encodeURIComponent(keyword)
  );
}

export default function PortalCrawlPanel({
  projectId,
  onProjectChange,
  onStarted,
}: {
  projectId: number | null;
  onProjectChange?: (id: number) => void;
  /** 수집이 시작돼 진행현황으로 넘어갈 때. 팝업 안이면 스스로 닫는다. */
  onStarted?: () => void;
}) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [url, setUrl] = useState(listUrlFor("미세먼지"));
  const [limit, setLimit] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<RunningJob | null>(null);
  const [preview, setPreview] = useState(false);

  // 두 모드가 다 이 목록을 쓴다. 고를 수 있는 모드(onProjectChange 를 받은
  // 경우)에서는 드롭다운의 선택지가 되고, 프로젝트가 고정된 모드에서는
  // projectId 에 해당하는 **이름**을 찾는 데 쓴다. 어느 쪽이든 결과가 어느
  // 프로젝트로 들어가는지 화면에 드러나야 한다 — 조용히 첫 프로젝트에 넣으면
  // "대기 API 를 모았는데 실거래가 프로젝트에 들어간" 상황을 설명할 수 없다.
  useEffect(() => {
    api.get("/api/projects").then(setProjects).catch(() => {});
  }, []);

  // 이미 도는 수집이 있으면 알려준다. 모르고 또 시작하면 같은 API 를 두 번 긁는다.
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    function check() {
      api.get(`/api/projects/${projectId}/portal-crawls`)
        .then((jobs: any[]) => {
          if (!alive) return;
          const job = jobs.find((j) => j.status === "running");
          setRunning(job ? { id: job.id, operations: job.operations, limit: job.limit } : null);
        })
        .catch(() => {});
    }
    check();
    const timer = window.setInterval(check, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projectId]);

  function openPreview() {
    if (!projectId) {
      setError("수집 결과를 담을 프로젝트를 먼저 고르세요.");
      return;
    }
    if (!url.trim()) {
      setError("공공데이터포털 검색 결과 주소를 입력하세요.");
      return;
    }
    setError(null);
    setPreview(true);
  }

  // 무엇을 수집할지는 팝업에서 확정한다. 여기서 바로 시작하면 엉뚱한 API 가
  // 섞여 들어오고, 그걸 나중에 지우는 편이 더 번거롭다.
  async function startSelected(selected: string[], purpose: string) {
    await api.post(`/api/projects/${projectId}/portal-crawls`, {
      listUrl: url.trim(),
      limit,
      publicDataPks: selected,
      purpose,
    });
    setPreview(false);
    navigate(`/projects/${projectId}/crawls`);
      onStarted?.();
  }

  return (
    <div className="crawl-panel">
      <div className="crawl-head">
        <strong>목록 URL 하나로 일괄 수집</strong>
        <span>검색 결과 주소를 붙여넣으면 그 안의 API 를 자동으로 모읍니다.</span>
      </div>

      {running && (
        <div className="crawl-running">
          <span className="dot" />
          <div>
            <strong>수집이 진행 중입니다</strong>
            <small>지금까지 {running.operations} / {running.limit}개</small>
          </div>
          <Link className="crawl-running-link" to={`/projects/${projectId}/crawls`}>진행현황 보기</Link>
        </div>
      )}

      <div className="crawl-target">
        {/* 고정 모드에는 select 가 없다. htmlFor 를 그대로 두면 label 이
            존재하지 않는 요소를 가리킨다. */}
        {onProjectChange ? (
          <label htmlFor="crawl-project">수집 결과를 담을 프로젝트</label>
        ) : (
          <span className="crawl-target-label">수집 결과를 담을 프로젝트</span>
        )}
        {onProjectChange ? (
          <select
            id="crawl-project"
            value={projectId ?? ""}
            onChange={(e) => onProjectChange(Number(e.target.value))}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        ) : (
          <strong className="crawl-fixed-project">
            {projects.find((p) => p.id === projectId)?.name ?? `#${projectId}`}
          </strong>
        )}
      </div>

      <div className="crawl-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.keyword}
            type="button"
            className={url === listUrlFor(preset.keyword) ? "on" : ""}
            onClick={() => setUrl(listUrlFor(preset.keyword))}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="crawl-form">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&keyword=…"
        />
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={10}>10개</option>
          <option value={20}>20개</option>
          <option value={30}>30개</option>
          <option value={50}>50개</option>
        </select>
        <button className="btn btn-primary" onClick={openPreview}>
          수집 시작
        </button>
      </div>

      {error && (
        <div className="error-box" style={{ marginTop: 10 }}>
          <p>{error}</p>
        </div>
      )}

      {preview && (
        <CrawlPreviewDialog
          listUrl={url.trim()}
          limit={limit}
          projectName={projects.find((p) => p.id === projectId)?.name ?? ""}
          onClose={() => setPreview(false)}
          onStart={startSelected}
        />
      )}

      <p className="guide-note" style={{ marginTop: 12 }}>
        <strong>수집 시작을 누르면 무엇을 모을지 먼저 확인합니다</strong>
        용도를 적으면 목적에 맞는 API 만 골라 드립니다. 확정하면 진행현황 화면으로 넘어가며,
        수집은 서버에서 돌기 때문에 창을 닫아도 계속됩니다.
      </p>
    </div>
  );
}

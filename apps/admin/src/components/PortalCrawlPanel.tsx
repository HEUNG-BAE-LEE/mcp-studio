import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";

/**
 * 포털 목록 URL 하나를 등록해 API 를 일괄 수집한다.
 *
 * 상세페이지를 한 장씩 여는 방식은 "된다"를 보여주지만, 서비스 하나에 상세기능이
 * 다섯 개면 목록을 다섯 번 바꿔야 한다. 여기서는 검색 결과 주소 하나로 그 전부를 모은다.
 *
 * 수집은 수십 초가 걸린다. 요청을 붙잡지 않고 잡 id 를 받아 진행 상황을 물어본다 —
 * 진행 표시가 없으면 사용자는 멈춘 줄 알고 새로고침한다.
 */

type Job = {
  id: number;
  status: "running" | "completed" | "failed";
  phase: string;
  servicesFound: number;
  servicesDone: number;
  operations: number;
  current: string;
  message: string;
  sessionId: number | null;
  limit: number;
};

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

type Project = { id: number; name: string };

export default function PortalCrawlPanel({
  projectId,
  onProjectChange,
}: {
  projectId: number | null;
  onProjectChange?: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [url, setUrl] = useState(listUrlFor("미세먼지"));
  const [limit, setLimit] = useState(30);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<number | null>(null);

  const poll = useCallback((jobId: number) => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      api.get(`/api/crawl-jobs/${jobId}`)
        .then((next: Job) => {
          setJob(next);
          if (next.status !== "running" && timer.current) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
        })
        .catch((err) => setError(errorMessage(err)));
    }, 1500);
  }, []);

  // 수집 결과가 어느 프로젝트로 들어가는지 사용자가 고를 수 있어야 한다.
  // 첫 프로젝트를 조용히 쓰면 "대기 API 를 모았는데 실거래가 프로젝트에 들어간"
  // 상황이 생기고, 화면만 봐서는 이유를 알 수 없다.
  useEffect(() => {
    api.get("/api/projects").then(setProjects).catch(() => {});
  }, []);

  // 화면을 떠날 때 폴링을 멈춘다. 남겨두면 사라진 컴포넌트에 상태를 쓴다.
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  async function start() {
    if (!projectId) {
      setError("프로젝트를 먼저 선택하세요. 프로젝트 목록에서 하나를 열면 여기로 돌아옵니다.");
      return;
    }
    setStarting(true);
    setError(null);
    setJob(null);
    try {
      const started = await api.post(`/api/projects/${projectId}/portal-crawls`, {
        listUrl: url.trim(),
        limit,
      });
      const first: Job = await api.get(`/api/crawl-jobs/${started.jobId}`);
      setJob(first);
      poll(started.jobId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const done = job && job.status !== "running";
  const percent = job
    ? Math.min(100, Math.round((job.operations / Math.max(1, job.limit)) * 100))
    : 0;

  return (
    <div className="crawl-panel">
      <div className="crawl-head">
        <strong>목록 URL 하나로 일괄 수집</strong>
        <span>검색 결과 주소를 붙여넣으면 그 안의 API 를 자동으로 모읍니다.</span>
      </div>

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
            disabled={!!job && job.status === "running"}
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
          disabled={!!job && job.status === "running"}
        />
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          disabled={!!job && job.status === "running"}
        >
          <option value={10}>10개</option>
          <option value={20}>20개</option>
          <option value={30}>30개</option>
          <option value={50}>50개</option>
        </select>
        <button
          className="primary"
          onClick={start}
          disabled={starting || (!!job && job.status === "running")}
        >
          {job && job.status === "running" ? "수집 중…" : "수집 시작"}
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 10 }}>
          <p>{error}</p>
        </div>
      )}

      {job && (
        <div className={`crawl-progress ${done ? "is-done" : ""}`}>
          <div className="crawl-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="crawl-stat">
            <b>{job.operations}</b>
            <span>오퍼레이션</span>
            <b>{job.servicesDone}</b>
            <span>서비스 확인</span>
            <em>{job.phase}</em>
          </div>
          {job.status === "running" && job.current && (
            <div className="crawl-current" title={job.current}>{job.current}</div>
          )}
          {done && (
            <div className="crawl-done">
              <span>{job.message}</span>
              {job.sessionId && (
                <button className="primary" onClick={() => navigate(`/spec-sessions/${job.sessionId}`)}>
                  수집 결과 보기
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <p className="guide-note" style={{ marginTop: 12 }}>
        <strong>공공 서버를 배려해 요청 간 1초를 둡니다</strong>
        30개를 모으는 데 1~2분이 걸립니다. 창을 닫아도 수집은 서버에서 계속되며,
        다시 들어오면 결과를 수집 세션에서 확인할 수 있습니다.
      </p>
    </div>
  );
}

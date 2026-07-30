import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import ConfirmPopover from "../components/ConfirmPopover";
import { MarkPortal } from "../components/CollectionMark";

/**
 * 수집 진행현황.
 *
 * 수집은 서버에서 도므로 화면을 떠나도 계속된다. 그런데 진행 상태를 화면 안에만
 * 두면 다른 메뉴를 눌렀다 돌아왔을 때 아무것도 없다 — 사용자는 수집이 취소된
 * 줄 안다. 그래서 진행 상황을 이 화면에서 **서버에 물어** 보여준다.
 *
 * 수집 시작 화면(API 수집하기)과 분리한 이유도 같다. 시작하는 자리와 지켜보는
 * 자리가 같으면, 두 번째 수집을 시작하려는 사람과 첫 수집을 지켜보는 사람이
 * 같은 화면을 두고 다툰다.
 */

type Job = {
  id: number;
  listUrl: string;
  limit: number;
  status: "running" | "completed" | "failed";
  phase: string;
  servicesFound: number;
  servicesDone: number;
  operations: number;
  current: string;
  message: string;
  sessionId: number | null;
  startedAt: string | null;
  finishedAt: string | null;
};

function keywordOf(listUrl: string): string {
  try {
    return new URL(listUrl).searchParams.get("keyword") || "전체";
  } catch {
    return listUrl;
  }
}

function elapsed(job: Job): string {
  if (!job.startedAt) return "-";
  const end = job.finishedAt ? new Date(job.finishedAt) : new Date();
  const seconds = Math.max(0, Math.round((end.getTime() - new Date(job.startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export default function CrawlStatus() {
  const { id } = useParams();
  const projectId = Number(id);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/portal-crawls`)
      .then(setJobs)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(() => {
    api.get("/api/projects")
      .then((list: { id: number; name: string }[]) => {
        const found = list.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch(() => {});
    load();
  }, [projectId, load]);

  // 도는 잡이 있을 때만 폴링한다. 다 끝난 화면을 계속 두들길 이유가 없다.
  const running = (jobs ?? []).some((job) => job.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [running, load]);

  async function remove(job: Job) {
    setConfirming(null);
    try {
      await api.delete(`/api/crawl-jobs/${job.id}`);
      // 수집물은 그대로 두고 기록만 지운다. 목록만 다시 읽으면 된다.
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Shell breadcrumb={["Projects", projectName, "수집 진행현황"]} projectId={projectId} projectName={projectName}>
      <section className="page-head">
        <div>
          <p className="eyebrow">진행현황</p>
          <h1>수집 진행현황</h1>
          <p className="page-sub">
            이 프로젝트에서 실행한 일괄 수집입니다. 수집은 서버에서 돌기 때문에
            이 화면을 닫아도 계속 진행됩니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-box">
          <strong>불러오지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {jobs !== null && jobs.length === 0 && (
        <div className="empty">
          <strong>아직 실행한 수집이 없습니다</strong>
          <p>
            <Link to="/sources">API 수집하기</Link> 에서 포털 주소를 등록하고 수집을 시작하세요.
          </p>
        </div>
      )}

      {(jobs ?? []).map((job) => {
        const done = job.status !== "running";
        // 끝났는데 하나도 못 모은 것은 성공이 아니다. "완료" 에 100% 초록 막대까지
        // 채우면 잘 된 것처럼 보여, 왜 액션이 안 생겼는지 다른 데서 찾게 된다.
        const empty = done && job.status === "completed" && job.operations === 0;
        // 진행 중에는 목표 대비 비율을 쓴다. 끝났으면 100% 로 채운다 —
        // 선택 수집은 목표(limit)보다 적게 모으는 것이 정상인데, 비율을 그대로
        // 두면 "완료"인 잡의 막대가 4분의 1만 차서 멈춘 것처럼 보인다.
        const percent = empty
          ? 0
          : done
            ? 100
            : Math.min(100, Math.round((job.operations / Math.max(1, job.limit)) * 100));
        return (
          <article className={`job-card ${empty ? "is-empty" : done ? "is-done" : "is-running"}`} key={job.id}>
            <div className="job-head">
              <span className={`job-state ${empty ? "empty" : job.status}`}>
                {job.status === "running" ? "수집 중"
                  : empty ? "결과 없음"
                  : job.status === "completed" ? "완료" : "실패"}
              </span>
              <strong>
                <MarkPortal /> {keywordOf(job.listUrl)}
              </strong>
              <span className="job-meta">최대 {job.limit}개 · 경과 {elapsed(job)}</span>
              {done && (
                <ConfirmPopover
                  open={confirming === job.id}
                  title="이 기록을 지울까요?"
                  description="수집한 API 는 그대로 남고, 실행 기록만 사라집니다."
                  facts={[
                    { label: "수집한 API", value: String(job.operations) },
                    { label: "결과 세션", value: job.sessionId ? `#${job.sessionId}` : "없음" },
                  ]}
                  onConfirm={() => remove(job)}
                  onCancel={() => setConfirming(null)}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm job-remove"
                    aria-label="이 수집 기록 지우기"
                    onClick={() => setConfirming(confirming === job.id ? null : job.id)}
                  >지우기</button>
                </ConfirmPopover>
              )}

              {job.sessionId && (
                <Link className="job-link" to={`/spec-sessions/${job.sessionId}`}>수집 결과 보기</Link>
              )}
            </div>

            <div className="job-bar"><span style={{ width: `${percent}%` }} /></div>

            <div className="job-stat">
              <b>{job.operations}</b><span>수집한 API</span>
              <b>{job.servicesDone}</b><span>확인한 서비스</span>
              <b>{job.servicesFound}</b><span>발견한 서비스</span>
              {!done && <em>{job.phase}</em>}
            </div>

            {job.status === "running" && job.current && (
              <div className="job-current" title={job.current}>{job.current}</div>
            )}
            {done && job.message && <div className="job-message">{job.message}</div>}
          </article>
        );
      })}
    </Shell>
  );
}

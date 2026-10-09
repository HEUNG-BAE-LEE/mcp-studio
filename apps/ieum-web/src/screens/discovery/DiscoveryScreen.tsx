// DiscoveryScreen — 자동 탐색 작업 하나를 지켜보고(실시간) · 끝난 까닭을 보고(종료) · 찾은 API를 검토해 도구 후보로 등록한다(결과)
// 진입: 원본 시스템 화면 작업 표 행 · "열기" · "결과 검토", 연결 마법사 탐색 시작 성공, 이 화면 "같은 설정으로 다시 탐색", 주소 직접 · 새로고침
// 주소: /sources/discovery/:jobId — 작업마다 push. 필터 · 선택은 화면 안 상태(주소 아님). LNB는 "원본 시스템"이 현재이고 이 주소를 마지막 주소로 남기지 않는다
// 영역: 머리 = JobHead(PageHead 뒤로 · 상태 칩 · 동작) · 본문 = 상태별 LiveRun(running · scheduled · queued) · EndedView(failed · cancelled · interrupted) ·
//       ResultView(그 밖 — review · done · 모르는 값). 층(근거 드로어)은 앱 층의 층 호스트가 그린다
// 조회: 화면 useDiscoveryJob(작업 하나 — 처음은 이어 받아 한 번에, 그 뒤 running 700ms · 예약 · 대기 4초 · 그 밖 멈춤, 화면을 떠나면 멈추고 버린다).
//       쓰기: 중단 · 예약 취소 · 다시 탐색(JobHead) · 도구 후보 등록(SelectionDock)
// 상태: 첫 로딩 = 본문 비움 + aria-busy(머리까지) · 없는 작업(404) = 뒤로 링크 + 경고 상자(서버 문장 원문 — 새 문구 없음) ·
//       그 밖 실패 = 본문 자리 실패 상자 · 폴링 실패 = 표시 없이 이전 값
// 작업 id가 바뀌면 화면을 새로 만든다(key) — 쌓인 기록 · 필터 · 선택이 이전 작업과 섞이지 않는다(옛도 열 때마다 처음부터 — :141)
// 옛 근거: apps/web/ieum/js/menu/discovery.js:117-318,386-401
import { useParams } from 'react-router-dom';
import type { JobData } from '../../api/discoveryJob';
import { useDiscoveryJob } from '../../api/hooks/useDiscoveryJob';
import { viewOf } from '../../app/discovery/jobScreen';
import { screenGate } from '../../app/screenGate';
import { FailureBlock, ScreenState } from '@/ui';
import { EndedView } from './EndedView';
import { BackToSources, JobHead } from './JobHead';
import { LiveRun } from './LiveRun';
import { ResultView } from './ResultView';
import styles from './DiscoveryScreen.module.css';

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function JobBody({ job }: Readonly<{ job: JobData }>) {
  const view = viewOf(job.status);
  return (
    <>
      <JobHead job={job} />
      {view === 'live' ? <LiveRun job={job} /> : null}
      {view === 'ended' ? <EndedView job={job} /> : null}
      {view === 'result' ? <ResultView job={job} /> : null}
    </>
  );
}

/** 없는 작업 주소 — 머리와 같은 뒤로 링크 + 서버 404 문장(옛은 토스트만 띄우고 목록에 머물렀다 — 이식 기간 허용 차이) */
function MissingJob({ error }: Readonly<{ error: unknown }>) {
  return (
    <>
      <BackToSources />
      <FailureBlock tone="warn" message={messageOf(error)} className={styles.missing} />
    </>
  );
}

function JobScreen({ jobId }: Readonly<{ jobId: string }>) {
  const job = useDiscoveryJob(jobId);
  const gate = screenGate({ job }, { notFound: job });
  return (
    <ScreenState gate={gate} notFound={<MissingJob error={job.error} />}>
      {(data) => <JobBody job={data.job} />}
    </ScreenState>
  );
}

export function DiscoveryScreen() {
  const { jobId = '' } = useParams();
  return <JobScreen key={jobId} jobId={jobId} />;
}

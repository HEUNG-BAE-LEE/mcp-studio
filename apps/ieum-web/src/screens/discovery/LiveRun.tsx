// LiveRun — 실시간 화면(예약 · 대기 · 탐색 중 — 옛 discLiveHTML · discPatch, js/menu/discovery.js:227-248)
// 위에서 아래로: 단계 줄 → 지금 하는 일 줄(도는 원 · 예약 시계 · 체크 + 문장 + "경과 m:ss") → 수치 여섯 칸 →
// 두 열(운영 화면 탐색 · 네트워크 기록, 1100 이하 한 열) → Git 소스 분석
// - 폴링이 새 값을 줄 때마다 바뀐 칸만 다시 그린다(포커스 · 스크롤이 남는다 — 옛은 상태가 바뀌면 전체를 다시 그렸다, 이식 기간 허용 차이)
// - 경과는 서버 값 그대로다(브라우저가 세지 않는다). 예약이면 문장 대신 "{M월 D일 HH:MM 시작}합니다"
// - 쓰지 않은 쪽(화면 탐색 · Git)의 수치 칸은 값 없음 표기. 차단한 쓰기 요청이 하나라도 있으면 위험색, 발견한 API 후보는 주조색
import type { JobData } from '../../api/discoveryJob';
import { countersOf, liveModeOf } from '../../app/discovery/jobScreen';
import { DISCOVERY } from '../../copy/discovery';
import { orNone } from '../../copy/format';
import { Notice, StatStrip, TwoColumn, type StatItem } from '@/ui';
import { BrowserPane } from './BrowserPane';
import { GitPane } from './GitPane';
import { JobSteps } from './JobSteps';
import { NetLogPane } from './NetLogPane';
import styles from './LiveRun.module.css';

const K = DISCOVERY.counters;

function counterItemsOf(job: JobData): readonly StatItem[] {
  const c = countersOf(job.stats, job.opts);
  return [
    { label: K.pages, value: orNone(c.pages), unit: c.pages === null ? undefined : K.ofMax(c.maxPages) },
    { label: K.requests, value: orNone(c.requests) },
    { label: K.controllers, value: orNone(c.controllers) },
    { label: K.found, value: String(c.found), tone: 'primary' },
    { label: K.blocked, value: orNone(c.blocked), tone: c.isBlockedAlert ? 'danger' : undefined },
    { label: K.skipped, value: orNone(c.skipped) },
  ];
}

/** 지금 하는 일 줄(옛 discActHTML :227-229) */
function ActLine({ job }: Readonly<{ job: JobData }>) {
  const mode = liveModeOf(job.status);
  const isScheduled = mode === 'scheduled' && job.startAt !== null;
  const text = isScheduled && job.startAt !== null ? DISCOVERY.live.scheduledAct(job.startAt) : job.act;
  const trailing = DISCOVERY.live.elapsed(job.elapsed);
  // 앞자리: 탐색 중 도는 원 · 예약 시계(기본 굵기) · 그 밖 굵은 체크(옛 :227-229)
  if (mode === 'running') {
    return (
      <Notice tone="info" variant="line" spinner trailing={trailing} className={styles.act}>
        {text}
      </Notice>
    );
  }
  return (
    <Notice
      tone="info"
      variant="line"
      {...(mode === 'scheduled' ? { icon: 'history' } : { icon: 'check', iconStroke: 'bold' })}
      trailing={trailing}
      className={styles.act}
    >
      {text}
    </Notice>
  );
}

export function LiveRun({ job }: Readonly<{ job: JobData }>) {
  return (
    <>
      <JobSteps stage={job.stage} />
      <ActLine job={job} />
      <StatStrip columns={6} items={counterItemsOf(job)} className={styles.counters} />
      <TwoColumn layout="live" className={styles.grid}>
        <BrowserPane job={job} />
        <NetLogPane job={job} isLive />
      </TwoColumn>
      <GitPane job={job} isLive className={styles.git} />
    </>
  );
}

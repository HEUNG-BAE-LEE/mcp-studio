// EndedView — 종료 화면(실패 · 취소됨 · 중단됨 — 옛 discEndedHTML, js/menu/discovery.js:266-270)
// 단계 줄 → 경고 상자(굵은 사유 한 줄 + 줄바꿈 + 서버 오류 문장, 없으면 "찾은 결과가 없습니다.") →
// 기록이나 파일이 하나라도 있으면 두 열(네트워크 기록 · Git 소스 분석 — 머리 보조 글 없이, 브라우저 칸 없음). 폴링은 멈춰 있다
import type { JobData } from '../../api/discoveryJob';
import { DISCOVERY } from '../../copy/discovery';
import { Notice, TwoColumn } from '@/ui';
import { GitPane } from './GitPane';
import { JobSteps } from './JobSteps';
import { NetLogPane } from './NetLogPane';
import styles from './EndedView.module.css';

const K = DISCOVERY.ended;
const WHY: Readonly<Record<string, string>> = K.why;

export function EndedView({ job }: Readonly<{ job: JobData }>) {
  const hasTrail = job.log.length > 0 || job.files.length > 0;
  return (
    <>
      <JobSteps stage={job.stage} />
      <Notice tone="warn" className={styles.notice}>
        <b>{WHY[job.status] ?? ''}</b>
        <br />
        {job.error || K.noError}
      </Notice>
      {hasTrail ? (
        <TwoColumn layout="live" className={styles.grid}>
          <NetLogPane job={job} isLive={false} />
          <GitPane job={job} isLive={false} />
        </TwoColumn>
      ) : null}
    </>
  );
}

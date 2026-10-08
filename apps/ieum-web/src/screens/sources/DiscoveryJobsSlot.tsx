// 자동 탐색 작업 표 — 원본 시스템 화면 아래(옛 discJobsHTML — apps/web/ieum/js/menu/discovery.js:16-30). 절 제목 "자동 탐색 작업" + 6열 표(최소 820)
// 조회는 화면이 맨 위에서 한 번 받아 넘긴다(useDiscoveryOverview — 화면 조회와 따로 나가고 실패해도 목록을 막지 않는다). 폴링은 없다 —
// 들어올 때 · 같은 메뉴를 다시 누를 때 · 탐색 시작 · 다시 탐색 · 등록 · 기록 삭제 뒤에 다시 받는다(app/discovery/useDiscoveryMutations)
// - 작업이 0개면 절 전체를 그리지 않는다(빈 상태가 아니다 — 옛 :17). 받는 동안은 비어 있다(aria-busy)
// - 첫 조회가 실패하면 절 제목 아래 그 자리에만 실패 상자(원문만 · 머리 문장 없음) — 목록 · 2차 안내는 그대로다. 다시 받기 실패는 이전 값 그대로
// - 서버 순서 그대로(생성 내림차순)다. 원본 검색 · 연결 방식 필터와 상관없다(옛 :16-29)
// - 행 전체(클릭 · Enter · Space)와 "열기" · "결과 검토"는 작업 화면으로(push), "삭제"는 기록 삭제 확인 모달. 칸 안 버튼은 자기 동작만 한다
//   (행 동작으로 올라가지 않게 끊는다 — 옛은 가장 가까운 data-act가 이겼다, js/main.js:48)
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscoveryResponse, JobSummary } from '../../api/types';
import { foundOf } from '../../app/discovery/jobScreen';
import { jobPath } from '../../app/discovery/links';
import { openDeleteJob } from '../../app/layers';
import type { Gate } from '../../app/screenGate';
import { DISCOVERY } from '../../copy/discovery';
import { NONE } from '../../copy/format';
import {
  Button,
  JobStatusChip,
  ScreenState,
  SectionTitle,
  Table,
  TableCell,
  TableHeadCell,
  TableRow,
} from '@/ui';
import styles from './DiscoveryJobsSlot.module.css';

const K = DISCOVERY.jobs;

type DiscoveryJobsSlotProps = Readonly<{
  /** regionGate(useDiscoveryOverview())의 판정 */
  gate: Gate<DiscoveryResponse>;
}>;

/** 칸 안 버튼의 누름이 행 동작으로 올라가지 않게 */
const withoutRowClick =
  (action: () => void) =>
  (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    action();
  };

type JobRowProps = Readonly<{ job: JobSummary; onOpen: (jobId: string) => void }>;

function JobRow({ job, onOpen }: JobRowProps) {
  const found = foundOf(job);
  const count = found === null ? null : K.count(found);
  return (
    <TableRow onActivate={() => onOpen(job.id)}>
      <TableCell align="start">
        <b className={styles.name}>{job.name}</b>
        <span className={styles.target}>{job.opts.base || job.opts.repo || ''}</span>
      </TableCell>
      <TableCell>
        <span className={styles.how}>{K.how(job.opts)}</span>
      </TableCell>
      <TableCell>
        <JobStatusChip status={job.status} />
        {job.status === 'scheduled' && job.startAt !== null ? (
          <div className={styles.startsAt}>{K.startsAt(job.startAt)}</div>
        ) : null}
      </TableCell>
      <TableCell>
        {count === null ? (
          NONE
        ) : (
          <>
            <span className={styles.count}>{count.strong}</span>
            {count.post}
          </>
        )}
      </TableCell>
      <TableCell>{job.registered ? K.registered(job.registered) : NONE}</TableCell>
      <TableCell>
        <Button size="sm" onClick={withoutRowClick(() => onOpen(job.id))}>
          {job.status === 'review' ? K.review : K.open}
        </Button>{' '}
        <Button size="sm" aria-label={K.deleteAria(job.name)} onClick={withoutRowClick(() => openDeleteJob(job.id))}>
          {K.delete}
        </Button>
      </TableCell>
    </TableRow>
  );
}

const COLUMNS = K.columns;
const HEAD = (
  <>
    <TableHeadCell align="start">{COLUMNS.target}</TableHeadCell>
    <TableHeadCell>{COLUMNS.how}</TableHeadCell>
    <TableHeadCell>{COLUMNS.status}</TableHeadCell>
    <TableHeadCell>{COLUMNS.found}</TableHeadCell>
    <TableHeadCell>{COLUMNS.registered}</TableHeadCell>
    <TableHeadCell>{COLUMNS.manage}</TableHeadCell>
  </>
);

function JobsTable({ jobs }: Readonly<{ jobs: readonly JobSummary[] }>) {
  const navigate = useNavigate();
  const open = (jobId: string) => void navigate(jobPath(jobId));
  return (
    <>
      <SectionTitle title={K.title} />
      <Table minWidth={820} head={HEAD}>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} onOpen={open} />
        ))}
      </Table>
    </>
  );
}

export function DiscoveryJobsSlot({ gate }: DiscoveryJobsSlotProps) {
  if (gate.kind === 'ready' || gate.kind === 'empty') {
    return gate.data.jobs.length === 0 ? null : <JobsTable jobs={gate.data.jobs} />;
  }
  // 받는 동안은 제목 없이 비우고, 받지 못했으면 제목 아래 그 자리에 실패 상자
  return (
    <>
      {gate.kind === 'pending' ? null : <SectionTitle title={K.title} />}
      <ScreenState gate={gate} scope="region">
        {() => null}
      </ScreenState>
    </>
  );
}

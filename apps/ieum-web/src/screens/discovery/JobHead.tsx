// JobHead — 탐색 작업 화면 머리(옛 discHead — js/menu/discovery.js:251-258)
// 위 "← 원본 시스템"(메뉴의 마지막 주소 — 원본 검색 · 필터가 남는다, 누르면 원본 메뉴 자료를 다시 받는다) · 제목 "{이름} 자동 탐색" · 상태 칩 ·
// 설명 "{방식}, 운영 {주소}" · 오른쪽 버튼 하나 — 탐색 중 "탐색 중단" · 예약됨 "예약 취소" · 그 밖 "같은 설정으로 다시 탐색"(queued 포함 — 옛 그대로)
// - 중단 · 예약 취소는 확인 없이 보낸다(옛 그대로 — 같은 설정으로 다시 탐색할 수 있다). 성공하면 안내 토스트, 상태는 폴링이 받는다
// - 다시 탐색은 성공하면 새 작업 화면으로(push). 요청 중 화면을 떠났거나 다른 작업으로 옮겼으면 이동하지 않는다(app/discovery/useDiscoveryMutations)
// - 요청 중에는 버튼이 결과를 기다리는 잠금이다(포커스가 남는다). 실패는 경고 토스트(서버 문장)
import type { JobData } from '../../api/discoveryJob';
import { headActionOf } from '../../app/discovery/jobScreen';
import { useCancelDiscovery, useRerunDiscovery } from '../../app/discovery/useDiscoveryMutations';
import { useMenuHref } from '../../app/lastPath';
import { refreshMenu } from '../../app/menuRefresh';
import { DISCOVERY } from '../../copy/discovery';
import { SCREEN_LABEL } from '../../copy/shell';
import { Button, JobStatusChip, LinkButton, PageHead } from '@/ui';

const K = DISCOVERY.head;

/** 머리 위 뒤로 링크 — 없는 작업 주소 화면도 같은 링크를 쓴다 */
export function BackToSources() {
  const href = useMenuHref('sources');
  return (
    <LinkButton variant="back" to={href} onClick={() => refreshMenu('sources')}>
      {SCREEN_LABEL.sources}
    </LinkButton>
  );
}

/** 오른쪽 버튼 — 지금 상태의 동작 하나 */
function HeadAction({ job }: Readonly<{ job: JobData }>) {
  const cancel = useCancelDiscovery();
  const rerun = useRerunDiscovery(job.id);
  const action = headActionOf(job.status);
  if (action === 'rerun') {
    return (
      <Button icon="refresh" pending={rerun.isPending} onClick={() => rerun.mutate({ jobId: job.id })}>
        {K.rerun}
      </Button>
    );
  }
  return (
    <Button pending={cancel.isPending} onClick={() => cancel.mutate({ jobId: job.id })}>
      {action === 'cancelScheduled' ? K.cancelScheduled : K.cancel}
    </Button>
  );
}

export function JobHead({ job }: Readonly<{ job: JobData }>) {
  return (
    <PageHead
      back={<BackToSources />}
      title={K.title(job.name)}
      status={<JobStatusChip status={job.status} />}
      description={K.desc(K.how(job.opts), job.opts.base)}
      actions={<HeadAction job={job} />}
    />
  );
}

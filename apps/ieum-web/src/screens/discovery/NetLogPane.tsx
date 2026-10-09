// NetLogPane — "네트워크 기록" 상자(옛 :236 실시간 · :269 종료). 머리 제목(실시간은 보조 글 "이음이 캡처하고 보낸 요청")과 기록 상자
// 기록 상자는 Tab으로 닿는 이름 붙은 스크롤 상자다(이름 = 상자 제목). 탐색 중에는 맨 아래를 따라간다 — 위로 올려 보고 있으면 두고,
// 맨 아래 24 안이면 새 줄을 따라 내려간다(NetLog follow). 종료 화면은 따라가지 않는다
import { useMemo } from 'react';
import type { JobData } from '../../api/discoveryJob';
import { DISCOVERY } from '../../copy/discovery';
import { Box, NetLog } from '@/ui';
import { netLogLinesOf } from './netLogLines';

const K = DISCOVERY.live;

type NetLogPaneProps = Readonly<{
  job: JobData;
  /** 실시간 화면이면 머리 보조 글 · 따라가기 */
  isLive: boolean;
}>;

export function NetLogPane({ job, isLive }: NetLogPaneProps) {
  const lines = useMemo(() => netLogLinesOf(job.log), [job.log]);
  return (
    <Box title={K.netTitle} description={isLive ? K.netSub : undefined}>
      <NetLog lines={lines} label={K.netTitle} follow={isLive && job.status === 'running'} empty={K.netEmpty} />
    </Box>
  );
}

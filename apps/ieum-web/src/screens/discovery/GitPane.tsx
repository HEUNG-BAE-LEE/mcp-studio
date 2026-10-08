// GitPane — "Git 소스 분석" 상자(옛 dGit — js/menu/discovery.js:202-208,238 실시간 · :269 종료)
// 머리 보조 글 "{저장소(스킴 뗌)} · {프레임워크}"(실시간만 — 서버가 탐색 중에 프레임워크를 채운다, 이식 기간 허용 차이)
// 본문: Git 분석을 쓴 작업은 끝난 단계(서버 문장) + 파일 줄(…/파일 · API · @Deprecated · 메모), 아직 단계가 없으면 "저장소를 읽는 중".
// 안 쓴 작업은 빈 문구. 탐색 중에는 마지막 파일 줄이 나타날 때 한 번 등장 모션
import { useMemo } from 'react';
import type { JobData } from '../../api/discoveryJob';
import { withoutScheme } from '../../app/convert/url';
import { DISCOVERY } from '../../copy/discovery';
import { Box, EmptyState, GitFileList, type GitFileItem, type GitStageItem } from '@/ui';

const K = DISCOVERY.live;
const ANY_METHOD = '*';

const stagesOf = (job: JobData): readonly GitStageItem[] =>
  job.gitStages.map((stage) => ({ key: String(stage.seq), title: stage.msg, detail: stage.det }));

const filesOf = (job: JobData): readonly GitFileItem[] =>
  job.files.map((file) => ({
    key: String(file.seq),
    name: K.fileName(file.f),
    title: file.dir || file.f,
    apis: file.apis.map((api) => ({ method: api.m || ANY_METHOD, path: api.path, deprecated: api.dep })),
    note: file.note || undefined,
  }));

type GitPaneProps = Readonly<{
  job: JobData;
  /** 실시간 화면이면 머리 보조 글 · 마지막 줄 모션 */
  isLive: boolean;
  className?: string;
}>;

export function GitPane({ job, isLive, className }: GitPaneProps) {
  const stages = useMemo(() => stagesOf(job), [job]);
  const files = useMemo(() => filesOf(job), [job]);
  const sub = K.gitSub(withoutScheme(job.opts.repo ?? ''), job.framework);
  return (
    <Box title={K.gitTitle} description={isLive && sub ? sub : undefined} padded className={className}>
      {job.opts.git ? (
        <GitFileList
          stages={stages}
          pending={K.gitReading}
          files={files}
          enterLast={isLive && job.status === 'running'}
        />
      ) : (
        <EmptyState kind="section" container="inline">
          {K.noGit}
        </EmptyState>
      )}
    </Box>
  );
}

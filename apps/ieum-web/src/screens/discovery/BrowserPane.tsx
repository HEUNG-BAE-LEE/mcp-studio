// BrowserPane — 실시간 화면 "운영 화면 탐색" 상자(옛 dBrowser · discBrowserPatch — js/menu/discovery.js:210-226,235)
// 머리: 제목 + "헤드리스 브라우저, {브라우저}"(서버가 탐색 중에 채운다 — 이식 기간 허용 차이) · 오른쪽 "탐색 중" 점멸(탐색 중이고 화면 탐색 단계가 진행 중일 때만)
// 본문: 화면 탐색을 쓴 작업은 BrowserView(주소 줄 · 캡처 · 강조 상자), 안 쓴 작업은 빈 문구
// - 캡처 주소는 캡처 번호를 가진 화면 탐색 이벤트가 올 때만 바뀐다(같은 <img>의 주소만 바꿔 깜빡이지 않는다 — 옛 :219).
//   강조 상자도 같은 이벤트가 정하므로 이미지와 늘 짝이다(app/discovery/jobScreen highlightOf)
// - 캡처를 불러오지 못하면 그 번호의 캡처는 자리 문구 "캡처한 화면이 없습니다"로 둔다 — 다음 번호가 오면 다시 시도한다
//   (옛은 깨진 이미지였다 — 이식 기간 허용 차이)
import { useState } from 'react';
import type { JobData } from '../../api/discoveryJob';
import { highlightOf, isCrawlingNow, liveModeOf, shownUrl } from '../../app/discovery/jobScreen';
import { shotUrl } from '../../app/discovery/shotUrl';
import { DISCOVERY } from '../../copy/discovery';
import { Box, BrowserView, EmptyState, LiveIndicator, type BrowserHighlight } from '@/ui';

const K = DISCOVERY.live;

/** 캡처 전 자리 문구 — 탐색 중 · 예약 · 그 밖(옛 :213) */
const placeholderOf = (job: JobData, hasFailed: boolean): string => {
  if (hasFailed) return K.blank.none;
  const mode = liveModeOf(job.status);
  if (mode === 'running') return K.blank.running;
  return mode === 'scheduled' ? K.blank.scheduled : K.blank.none;
};

function highlightFor(job: JobData): BrowserHighlight | null {
  const hl = highlightOf(job);
  if (hl === null) return null;
  return { kind: hl.kind, label: K.hl[hl.kind], x: hl.left, y: hl.top, w: hl.width, h: hl.height };
}

function Capture({ job }: Readonly<{ job: JobData }>) {
  // 불러오지 못한 캡처 번호 — 그 번호인 동안은 자리 문구
  const [failedShot, setFailedShot] = useState<number | null>(null);
  const hasFailed = failedShot !== null && failedShot === job.shot;
  return (
    <BrowserView
      url={shownUrl(job.opts.base, job.pageUrl)}
      src={hasFailed ? null : shotUrl(job.id, job.shot)}
      alt={K.shotAlt}
      placeholder={placeholderOf(job, hasFailed)}
      highlight={hasFailed ? null : highlightFor(job)}
      onImageError={() => setFailedShot(job.shot)}
    />
  );
}

export function BrowserPane({ job }: Readonly<{ job: JobData }>) {
  return (
    <Box
      title={K.browserTitle}
      description={K.browserSub(job.browser)}
      actions={isCrawlingNow(job) ? <LiveIndicator>{K.liveBadge}</LiveIndicator> : undefined}
    >
      {job.opts.crawl ? (
        <Capture job={job} />
      ) : (
        <EmptyState kind="section" container="inline">
          {K.noCrawl}
        </EmptyState>
      )}
    </Box>
  );
}

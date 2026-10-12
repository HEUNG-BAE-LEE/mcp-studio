// SafetyList — 결과 요약 오른쪽 상자 "안전하게 탐색했습니다"(옛 :296-302,311). 서버가 센 숫자로 만든 문장 목록 + 서버 메모
// 줄: 화면 탐색을 쓴 작업만 쓰기 차단 · 건너뜀 · 마스킹(꺼 두었으면 그 사실), 늘 쓰기 API 검증(스테이징 호스트 · 미검증) · 승인한 담당자.
// 숫자 조각은 굵게, 아이콘은 초록 장식. 서버 메모(notes)는 아래 목록으로 그대로(옛 .vleg 모양 — 점 없음)
import type { ReactNode } from 'react';
import type { JobData } from '../../api/discoveryJob';
import { hostOf } from '../../app/convert/url';
import { EmphasisText } from '../../app/discovery/CopyParts';
import { DISCOVERY } from '../../copy/discovery';
import { Box, Icon, type IconName } from '@/ui';
import styles from './SafetyList.module.css';

const K = DISCOVERY.result.safe;

type SafetyLine = Readonly<{ key: string; icon: IconName; text: ReactNode }>;

function linesOf({ stats, opts }: JobData): readonly SafetyLine[] {
  const crawlLines: readonly SafetyLine[] = opts.crawl
    ? [
        { key: 'blocked', icon: 'shield', text: <EmphasisText parts={K.blocked(stats.blocked ?? 0)} /> },
        { key: 'skipped', icon: 'alert', text: <EmphasisText parts={K.skipped(stats.skipped ?? 0)} /> },
        {
          key: 'mask',
          icon: 'lock',
          text: opts.mask ? <EmphasisText parts={K.masked(stats.masked ?? 0)} /> : K.maskOff,
        },
      ]
    : [];
  return [
    ...crawlLines,
    {
      key: 'stg',
      icon: 'server',
      text: opts.stg ? <EmphasisText parts={K.stg(stats.stgVerified ?? 0, hostOf(opts.stgUrl ?? ''))} /> : K.noStg,
    },
    { key: 'owner', icon: 'user', text: K.owner(opts.owner ?? '') },
  ];
}

export function SafetyList({ job }: Readonly<{ job: JobData }>) {
  return (
    <Box title={DISCOVERY.result.safeTitle}>
      <ul className={styles.list}>
        {linesOf(job).map((line) => (
          <li key={line.key} className={styles.line}>
            <Icon name={line.icon} size="md" className={styles.icon} />
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {job.notes.length > 0 ? (
        <ul className={styles.notes}>
          {job.notes.map((note, index) => (
            // 서버 메모는 같은 문장이 겹칠 수 있다 — 서버 순서 그대로라 자리를 키로 쓴다
            <li key={index}>{note}</li>
          ))}
        </ul>
      ) : null}
    </Box>
  );
}

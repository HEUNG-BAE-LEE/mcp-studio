// NetLog — 탐색 네트워크 기록. 이음 .netlog · .nl · .ntag(css/console.css:984-1000, 760 :1067-1068) · 쓰는 곳 js/menu/discovery.js:192-200,236,245,269
// 줄은 데이터다 — 요청 줄(시각 · 메서드 · 경로 · 응답 코드 · 태그)과 건너뜀 줄(시각 · 경고 아이콘 + 서버 문장). 상자 머리는 쓰는 곳의 Box다.
// 스크롤 상자는 tabindex=0 + 이름 + 안쪽 링이다(옛은 tabindex가 없었다 — DESIGN 이식 기간 고침). 이름이 붙도록 role="region"(보이지 않는 ARIA 보강).
// 마지막 줄 등장 모션은 그 줄이 처음 그려질 때 한 번만 돈다 — 같은 key의 요소를 React가 그대로 두므로 갱신마다 다시 돌지 않는다(옛은 700ms마다 innerHTML로 다시 돌았다)
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { NetTagTone } from '../../copy/status';
import { EmptyState } from '../EmptyState';
import { Icon } from '../icons/Icon';
import { MethodChip } from '../MethodChip';
import { Tag } from '../Tag';
import styles from './NetLog.module.css';

/** 맨 아래에서 이만큼 안쪽이면 맨 아래에 있는 것으로 본다(옛 js/menu/discovery.js:245의 24) */
const FOLLOW_SLACK_PX = 24;

/** 태그 — 쓰는 곳이 copy/status의 netTagOf(값)로 만든다. flag는 네트워크 기록 표식 색(이 부품에서만) */
type NetLogTag = Readonly<{ label: string; tone: NetTagTone }>;

type NetLogRequestLine = Readonly<{
  kind: 'request';
  /** 줄 키 — 같은 키면 같은 줄이다(등장 모션이 다시 돌지 않는다) */
  key: string;
  /** 시각 글자(m:ss — 쓰는 곳 서식) */
  time: string;
  /** HTTP 메서드 — MethodChip이 칸 폭을 채운다 */
  method: string;
  /** 경로 — 고정폭 · 말줄임, 전체는 title 툴팁 */
  path: string;
  /** 경로 앞 표식 글자(스테이징 호출 — 쓰는 곳 copy/). 없으면 그리지 않는다 */
  env?: string;
  /** 응답 코드 — 값이 없으면 쓰는 곳이 NONE을 넘긴다 */
  code: string | number;
  tag: NetLogTag;
}>;

type NetLogSkipLine = Readonly<{
  kind: 'skip';
  key: string;
  time: string;
  /** 서버 문장 — 앞에 경고 아이콘 */
  note: string;
}>;

export type NetLogLine = NetLogRequestLine | NetLogSkipLine;

export type NetLogProps = {
  /** 줄 — 위에서 아래로. 최근 250개로 자르는 것은 쓰는 곳이다(js/menu/discovery.js:194) */
  lines: readonly NetLogLine[];
  /** 스크롤 상자 이름(aria-label) — 상자 제목과 같은 글자 */
  label: string;
  /**
   * 아래 따라가기 — true가 되는 순간(처음 그림 포함) 맨 아래로 내리고, 그 뒤로는 줄이 바뀌기 직전 맨 아래에서
   * 24 안쪽이었을 때만 다시 맨 아래로 간다(옛 js/main.js:13 · js/menu/discovery.js:245). 쓰는 곳은 탐색 중일 때 true
   */
  follow: boolean;
  /** 줄이 없을 때 상자 안 글 — EmptyState(section · inline)로 그린다 */
  empty: ReactNode;
};

const isNearBottom = (box: HTMLElement): boolean =>
  box.scrollTop + box.clientHeight >= box.scrollHeight - FOLLOW_SLACK_PX;

function NetTag({ tag }: { tag: NetLogTag }) {
  if (tag.tone === 'flag') return <span className={styles.flag}>{tag.label}</span>;
  return (
    <Tag tone={tag.tone} shape="round" size="sm">
      {tag.label}
    </Tag>
  );
}

function NetLogRow({ line, isLast }: { line: NetLogLine; isLast: boolean }) {
  const enter = isLast || undefined;
  if (line.kind === 'skip') {
    return (
      <div className={styles.row} data-kind="skip" data-enter={enter}>
        <span className={styles.time}>{line.time}</span>
        <span className={styles.note}>
          <Icon name="alert" size="sm" className={styles.noteIcon} />
          {line.note}
        </span>
      </div>
    );
  }
  return (
    <div className={styles.row} data-kind="request" data-enter={enter}>
      <span className={styles.time}>{line.time}</span>
      <MethodChip method={line.method} />
      <span className={styles.path} title={line.path}>
        {line.env !== undefined ? (
          <>
            <i className={styles.env}>{line.env}</i>{' '}
          </>
        ) : null}
        {line.path}
      </span>
      <span className={styles.code}>{line.code}</span>
      <NetTag tag={line.tag} />
    </div>
  );
}

export function NetLog({ lines, label, follow, empty }: NetLogProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // 줄이 바뀌기 직전 맨 아래였는지 — 스크롤할 때마다 적어 둔다. 줄을 더해도 scrollTop은 그대로라 마지막 스크롤 위치가 곧 갱신 직전 위치다
  const wasAtBottomRef = useRef(true);
  // 직전 그림의 follow — false → true(처음 그림 포함)를 알아보려고 둔다
  const prevFollowRef = useRef(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const turnedOn = follow && !prevFollowRef.current;
    prevFollowRef.current = follow;
    if (box === null || !follow) return;
    if (!turnedOn && !wasAtBottomRef.current) return;
    box.scrollTop = box.scrollHeight;
    wasAtBottomRef.current = true;
  }, [follow, lines]);

  const handleScroll = () => {
    const box = boxRef.current;
    if (box !== null) wasAtBottomRef.current = isNearBottom(box);
  };

  return (
    <div
      ref={boxRef}
      className={styles.root}
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 스크롤 상자는 키보드로 스크롤하도록 tabindex=0 + 이름(DESIGN 핵심 규칙 12 · 접근성 키보드)
      tabIndex={0}
      aria-label={label}
      onScroll={handleScroll}
    >
      {lines.length === 0 ? (
        <EmptyState kind="section" container="inline">
          {empty}
        </EmptyState>
      ) : (
        lines.map((line, index) => <NetLogRow key={line.key} line={line} isLast={index === lines.length - 1} />)
      )}
    </div>
  );
}

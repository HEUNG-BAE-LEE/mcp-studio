// 카탈로그 NetLog 절 — 요청 줄 × 태그 9종(+ 모르는 값) · 스테이징 표식 · 건너뜀 · 빈 상자 · 긴 경로 말줄임 · 줄 300개 따라가기.
// 따라가기는 이 절의 지역 상태로 재현한다 — "줄 더하기" · "자동 더하기"(옛 폴링 간격 700ms)로 줄을 늘리고 follow를 켜고 끈다.
// 쓰는 곳처럼 최근 250개로 잘라 넘겨 위쪽 줄이 빠지는 동안에도 따라가는지 본다. 760 접힘은 폭 전환으로 본다
import { useEffect, useState } from 'react';
import { NET_TAG_VALUES, netTagOf } from '@/copy/status';
import { NONE } from '@/copy/format';
import { Box, Button, NetLog, type NetLogLine } from '../../ui';
import catalog from './catalog.module.css';

/** 쓰는 곳이 자르는 개수(js/menu/discovery.js:194) */
const RECENT_LIMIT = 250;
/** 따라가기 예의 처음 줄 수 */
const SEED_COUNT = 300;
/** 자동 더하기 간격 — 옛 탐색 폴링 간격 */
const AUTO_INTERVAL_MS = 700;
/** 이 번호마다 건너뜀 줄 */
const SKIP_EVERY = 7;
const SECONDS_PER_MINUTE = 60;

const LABEL = '네트워크 기록';
const DESCRIPTION = '이음이 캡처하고 보낸 요청';
const EMPTY = '아직 기록된 요청이 없습니다.';
const STAGING = '스테이징';
const UNKNOWN_TAG = 'legacy';

const mmss = (seconds: number): string =>
  `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;

const PATHS = ['/api/orders', '/api/orders/1024', '/purchase/list.do', '/api/vendors?page=2', '/login.do'];
const METHODS = ['GET', 'POST', 'GET', 'PUT', 'DELETE'];
const CODES: readonly (string | number)[] = [200, 201, NONE, 403, 404];

/** 태그 9종 + 모르는 값 한 줄 — 값마다 메서드 · 경로 · 코드를 돌려 쓴다 */
const TAG_LINES: readonly NetLogLine[] = [...NET_TAG_VALUES, UNKNOWN_TAG].map((value, index) => ({
  kind: 'request',
  key: `tag-${value}`,
  time: mmss(index * 3),
  method: METHODS[index % METHODS.length] ?? 'GET',
  path: PATHS[index % PATHS.length] ?? '/',
  env: value === 'stg' ? STAGING : undefined,
  code: CODES[index % CODES.length] ?? NONE,
  tag: netTagOf(value),
}));

const MIXED_LINES: readonly NetLogLine[] = [
  { kind: 'request', key: 'm1', time: '0:04', method: 'GET', path: '/purchase/list.do', code: 200, tag: netTagOf('cap') },
  { kind: 'skip', key: 'm2', time: '0:07', note: '"삭제" 은(는) 쓰기로 보이는 버튼이라 건너뜀' },
  {
    kind: 'request',
    key: 'm3',
    time: '0:09',
    method: 'POST',
    path: '/purchase/order/save.do',
    env: STAGING,
    code: 200,
    tag: netTagOf('stg'),
  },
  {
    kind: 'request',
    key: 'm4',
    time: '0:12',
    method: 'GET',
    path: '/api/v2/purchase/orders/2026/10/09/vendors/ACME-KOREA-0001/items?include=price,stock,history&sort=desc&page=12',
    code: 200,
    tag: netTagOf('ok'),
  },
  { kind: 'request', key: 'm5', time: '0:13', method: 'DELETE', path: '/api/orders/7', code: NONE, tag: netTagOf('block') },
];

const makeLine = (seq: number): NetLogLine => {
  const time = mmss(seq);
  if (seq % SKIP_EVERY === 0) return { kind: 'skip', key: String(seq), time, note: `화면 ${seq}의 "저장" 은(는) 쓰기로 보이는 버튼이라 건너뜀` };
  const value = NET_TAG_VALUES[seq % NET_TAG_VALUES.length] ?? 'cap';
  return {
    kind: 'request',
    key: String(seq),
    time,
    method: METHODS[seq % METHODS.length] ?? 'GET',
    path: `${PATHS[seq % PATHS.length] ?? '/'}#${seq}`,
    code: CODES[seq % CODES.length] ?? NONE,
    tag: netTagOf(value),
  };
};

const SEED: readonly NetLogLine[] = Array.from({ length: SEED_COUNT }, (_, index) => makeLine(index + 1));

/** 줄 하나를 끝에 더한 새 목록 — 번호는 지금 줄 수 + 1 */
const appendLine = (current: readonly NetLogLine[]): readonly NetLogLine[] => [...current, makeLine(current.length + 1)];

function FollowDemo() {
  const [lines, setLines] = useState<readonly NetLogLine[]>(SEED);
  const [follow, setFollow] = useState(true);
  const [isAuto, setIsAuto] = useState(false);
  const addLine = () => setLines(appendLine);

  useEffect(() => {
    if (!isAuto) return undefined;
    const timer = window.setInterval(() => setLines(appendLine), AUTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isAuto]);

  const shown = lines.slice(-RECENT_LIMIT);
  return (
    <div className={catalog.stack}>
      <p className={catalog.note}>
        전체 {lines.length}줄 · 넘기는 줄 {shown.length}개(최근 {RECENT_LIMIT}개) · follow {String(follow)}. follow가 켜지는 순간 맨 아래로 가고, 그
        뒤로는 줄이 바뀌기 직전 맨 아래(24 안쪽)였을 때만 따라간다 — 위로 올려 두고 줄을 더하면 제자리에 머문다. 새 줄만 한 번 떠오른다.
      </p>
      <div className={catalog.row}>
        <Button size="sm" onClick={addLine}>
          줄 더하기
        </Button>
        <Button size="sm" aria-pressed={isAuto} onClick={() => setIsAuto((value) => !value)}>
          {isAuto ? '자동 더하기 멈춤' : `자동 더하기(${AUTO_INTERVAL_MS}ms)`}
        </Button>
        <Button size="sm" aria-pressed={follow} onClick={() => setFollow((value) => !value)}>
          {follow ? 'follow 끄기' : 'follow 켜기'}
        </Button>
        <Button size="sm" onClick={() => setLines(SEED)}>
          처음으로
        </Button>
      </div>
      <Box title={LABEL} description={DESCRIPTION}>
        <NetLog lines={shown} label={`${LABEL} — 따라가기`} follow={follow} empty={EMPTY} />
      </Box>
    </div>
  );
}

export function NetLogSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        탐색 네트워크 기록. 상자는 칸의 남은 높이를 채우고 높이 300 ~ 392, 넘치면 상자 안 스크롤이다. 줄 격자는 시각 40 · 메서드 42 · 경로 · 코드
        34 · 태그. 태그 라벨 · 색은 쓰는 곳이 netTagOf(값)로 찾는다 — 모르는 값은 값 그대로 + mute. 마지막 줄은 바탕 --surface-hover이고 처음
        그려질 때 --m-enter로 한 번 떠오른다. 스크롤 상자는 tabindex=0 + 이름이라 Tab으로 닿으면 안쪽 링이 보인다. 760에서 코드 칸을 숨긴다.
      </p>
      <h3 className={catalog.heading}>요청 줄 × 태그 9종 + 모르는 값</h3>
      <Box title={LABEL} description={DESCRIPTION}>
        <NetLog lines={TAG_LINES} label={`${LABEL} — 태그`} follow={false} empty={EMPTY} />
      </Box>
      <h3 className={catalog.heading}>스테이징 표식 · 건너뜀 줄 · 긴 경로 말줄임</h3>
      <Box title={LABEL} description={DESCRIPTION}>
        <NetLog lines={MIXED_LINES} label={`${LABEL} — 섞인 줄`} follow={false} empty={EMPTY} />
      </Box>
      <h3 className={catalog.heading}>빈 상자</h3>
      <Box title={LABEL} description={DESCRIPTION}>
        <NetLog lines={[]} label={`${LABEL} — 빈 상자`} follow={false} empty={EMPTY} />
      </Box>
      <h3 className={catalog.heading}>줄 300개 — 스크롤 · 따라가기</h3>
      <FollowDemo />
    </div>
  );
}

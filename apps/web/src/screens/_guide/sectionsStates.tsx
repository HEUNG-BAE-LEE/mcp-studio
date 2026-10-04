// 상태 표현 절(EmptyState · ErrorBlock · LogView · InlineConfirm · Notice) — sections.tsx가 BASE_SECTIONS에 순서대로 잇는다
import { useState } from 'react';
import { Button, EmptyState, ErrorBlock, InlineConfirm, LogView, Notice } from '@/ui';
import { noop } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

const GUIDE_LOG_SHORT: readonly string[] = [
  '2026-09-10T13:36:48+09:00 collect start source=policy_core tables=3',
  '2026-09-10T13:41:00+09:00 collect done elapsed=4m12s',
];
const GUIDE_LOG_LONG: readonly string[] = Array.from(
  { length: 14 },
  (_, i) =>
    `2026-09-10T13:40:${String(10 + i).padStart(2, '0')}+09:00 read  public.TB_SAMPLE_${i + 1}`,
);

/** 줄 추가 버튼으로 바닥 따라가기를 눈으로 확인한다. 위로 올려 두면 따라가지 않는다 */
function GuideLogView() {
  const [lines, setLines] = useState<readonly string[]>(GUIDE_LOG_LONG);
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      `2026-09-10T13:41:${String(prev.length).padStart(2, '0')}+09:00 append line ${prev.length + 1}`,
    ]);
  return (
    <>
      <Button size="sm" onClick={addLine}>
        줄 추가
      </Button>
      <LogView maxHeight={200} lines={lines} />
    </>
  );
}

/** 셋째 줄은 접히는 긴 줄 — 줄마다 첫 줄 0 · 접힌 줄 2ch 내어쓰기 */
const GUIDE_ERROR_RAW =
  'FATAL: password authentication failed for user "svc_reader"\n2026-09-10T13:58:02+09:00 host=10.42.3.18 db=policy_core sslmode=require\nDETAIL: Connection matched pg_hba.conf line 94: "hostssl policy_core svc_reader 10.42.0.0/16 scram-sha-256" — role password expired at 2026-09-01T00:00:00+09:00';

export const STATE_SECTIONS: readonly GuideSection[] = [
  {
    group: '상태 표현',
    name: 'EmptyState',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>not-created</span>
        <EmptyState
          kind="not-created"
          title="연결된 소스가 없다"
          body="소스를 연결하면 수집이 시작되고, 수집이 끝나면 산출물이 생긴다."
          action={<Button variant="primary">소스 고르기</Button>}
          hint="연결 가능한 타입 · DB · 문서 · Git 저장소"
        />
        <span className={styles.caption}>filtered</span>
        <EmptyState
          kind="filtered"
          body="조건에 맞는 소스가 없다 · 3건 가운데 0건"
          onClear={() => {}}
        />
        <span className={styles.caption}>nothing-yet</span>
        <EmptyState
          kind="nothing-yet"
          title="확인할 알림이 없다"
          body="알림은 상태에서 자동으로 만들어진다. 조건이 해제되면 목록에서 사라진다."
        />
      </div>
    ),
  },
  {
    group: '상태 표현',
    name: 'ErrorBlock',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>머리 줄 있음</span>
        <ErrorBlock
          raw={GUIDE_ERROR_RAW}
          meta="2026-09-10 13:58 · psql · 3회"
          onCopy={() => Promise.resolve()}
        />
        <span className={styles.caption}>
          복사 실패(onCopy → false) — 2초 동안 복사 안 됨 · status 안내
        </span>
        <ErrorBlock
          raw={GUIDE_ERROR_RAW}
          meta="2026-09-10 13:58 · psql · 3회"
          onCopy={() => false}
        />
        <span className={styles.caption}>메타 없음 — 복사만(onCopy는 필수)</span>
        <ErrorBlock raw={GUIDE_ERROR_RAW} onCopy={() => true} />
      </div>
    ),
  },
  {
    group: '상태 표현',
    name: 'LogView',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>짧은 로그 (높이 160)</span>
        <LogView maxHeight={160} lines={GUIDE_LOG_SHORT} />
        <span className={styles.caption}>긴 로그 (높이 200) — 바닥에 있을 때만 따라간다</span>
        <GuideLogView />
      </div>
    ),
  },
  {
    group: '상태 표현',
    name: 'InlineConfirm',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>기본 (열리면 확인 버튼에 포커스 · Esc = 취소)</span>
        <div style={{ width: 520 }}>
          <InlineConfirm
            // 정적 예시 — 포커스를 훔치지 않는다
            focusOnMount={false}
            message="이 소스의 연결을 해제합니다. 산출물과 커넥터도 함께 사라집니다."
            confirmLabel="연결 해제"
            cancelLabel="취소"
            onConfirm={() => undefined}
            onCancel={() => undefined}
          />
        </div>
        <span className={styles.caption}>busy (확인 loading · 취소 disabled)</span>
        <div style={{ width: 520 }}>
          <InlineConfirm
            // 정적 예시 — 포커스를 훔치지 않는다
            focusOnMount={false}
            busy
            message="이 소스의 연결을 해제합니다. 산출물과 커넥터도 함께 사라집니다."
            confirmLabel="해제하는 중…"
            cancelLabel="취소"
            onConfirm={() => undefined}
            onCancel={() => undefined}
          />
        </div>
      </div>
    ),
  },
  {
    group: '상태 표현',
    name: 'Notice',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          risk · warn · going · info · done (마지막 줄은 href — a 형태) · 카드는 구분선을 긋지
          않는다(목록 구분선은 AlertPanel)
        </span>
        <div style={{ width: 422, display: 'grid', gap: 'var(--s-2)' }}>
          <Notice
            tone="risk"
            title="인증 실패 소스 1건"
            body="코어뱅킹 API. 인증이 거절돼 11:20 이후 멈춰 있다."
            link={{ label: '접속 정보 열기 →', onClick: noop }}
          />
          <Notice
            tone="warn"
            title="확인이 필요한 소스 1건"
            body="청구 이력 DB. 스키마가 바뀌어 매핑을 다시 봐야 한다."
            link={{ label: '매핑 열기 →', onClick: noop }}
          />
          <Notice
            tone="going"
            title="수집 중인 소스 1건"
            body="인수지침 문서 · 임베딩 62%. 약 4분 남았다."
            link={{ label: '상태 · 수집 열기 →', onClick: noop }}
          />
          <Notice
            tone="info"
            title="새 소스를 연결할 수 있다"
            body="연결하면 수집이 바로 시작된다."
          />
          <Notice
            tone="done"
            title="수집 끝난 소스 1건"
            body="약관 PDF. 문서 128건을 읽었다."
            link={{ label: '소스 열기 →', href: '#' }}
          />
        </div>
        <span className={styles.caption}>본문만(한 문장 안내)</span>
        <div style={{ width: 422 }}>
          <Notice
            tone="info"
            body="아직 발행되지 않은 커넥터입니다. 발행하면 엔드포인트와 인증 키가 생성됩니다."
          />
        </div>
      </div>
    ),
  },
];

// 폼 칸 밖 한 줄 · 잠긴 액션 사유 줄 · 묶음 칸 · 시각 숨김 · 행 메뉴 · 단계 머리 · 단계 목록 · 확인 줄 거부 — sections.tsx가 관련 절 뒤에 끼워 넣는다
import { useId, useState } from 'react';
import {
  Button,
  Checkbox,
  Field,
  FlowStepHead,
  HelperPanel,
  InlineConfirm,
  InlineMessage,
  Input,
  ReasonLine,
  RowMenu,
  SegmentedControl,
  StepList,
  Table,
  TableCellLines,
  type TableColumn,
  VisuallyHidden,
} from '@/ui';
import { GUIDE_MODE_ITEMS, noop } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

/** 예시 폭(모달 form 몸통 472 · 확인 줄 520) — 레이아웃 고정폭 */
const GUIDE_FORM_WIDTH = 472;
const GUIDE_CONFIRM_WIDTH = 520;
const GUIDE_TABLE_WIDTH = 640;
const GUIDE_HELPER_BOX = {
  display: 'flex',
  height: 320,
  border: '1px solid var(--hairline)',
} as const;
const GUIDE_STEPS = [
  {
    id: 'type',
    label: '소스 고르기',
    description: '코드 · 데이터베이스 · 문서 중 하나를 고릅니다',
  },
  { id: 'connect', label: '연결', description: '접속 정보를 넣어 담고, 담은 목록에서 확인합니다' },
  { id: 'run', label: '읽어오기', description: '담은 순서대로 구조를 읽어 결과물로 바꿉니다' },
];
const GUIDE_STEP_NOTE = {
  title: '담은 만큼 한 번에 읽어옵니다',
  body: '접속 키는 저장하지 않고 금고 값을 참조합니다.',
};

const GUIDE_HIDDEN_STATUS = '연결 주소 복사됨';
const GUIDE_HIDDEN_REASON = '권한이 없다 · 소유자에게 요청';

/** 시각 숨김 — 화면에는 없고 보조기기에만 읽히는 글. 캡션이 숨은 글을 그대로 찍어 보인다 */
function GuideVisuallyHidden() {
  const reasonId = useId();
  const [isAnnounced, setIsAnnounced] = useState(false);
  const status = isAnnounced ? GUIDE_HIDDEN_STATUS : '';
  return (
    <div className={styles.row} style={{ alignItems: 'flex-start', gap: 'var(--s-6)' }}>
      <div className={styles.cell}>
        <span className={styles.caption}>
          role=status — 누르면 결과를 읽어 준다(한 번 더 누르면 비운다)
        </span>
        <Button onClick={() => setIsAnnounced((v) => !v)}>복사</Button>
        <VisuallyHidden role="status">{status}</VisuallyHidden>
        <span className={styles.caption}>숨은 글 · {status === '' ? '(비어 있음)' : status}</span>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>aria-describedby 대상 — 보일 자리가 없는 비활성 사유</span>
        <Button variant="danger" disabled aria-describedby={reasonId}>
          연결 해제
        </Button>
        <VisuallyHidden id={reasonId}>{GUIDE_HIDDEN_REASON}</VisuallyHidden>
        <span className={styles.caption}>숨은 글 · {GUIDE_HIDDEN_REASON}</span>
      </div>
    </div>
  );
}

export const VISUALLY_HIDDEN_SECTION: GuideSection = {
  group: '기본',
  name: 'VisuallyHidden',
  render: () => <GuideVisuallyHidden />,
};

export const INLINE_MESSAGE_SECTION: GuideSection = {
  group: '기본',
  name: 'InlineMessage',
  render: () => (
    <div className={styles.cell} style={{ width: GUIDE_FORM_WIDTH }}>
      <span className={styles.caption}>
        폼 칸 밖 한 줄 — label 500 12 fix-fg · role=alert · id → aria-describedby. Notice로 대신하지
        않는다
      </span>
      <InlineMessage>역할을 바꾸지 못했다 · 소유자가 한 명 이상 있어야 한다</InlineMessage>
    </div>
  ),
};

const GUIDE_REASON_MISSING = '필수 칸을 채워야 담을 수 있다 · 접속 주소';

/** 사유 줄 — 칸을 채우면 사유가 사라지고 담기가 켜진다. live라 바뀐 사유가 읽힌다. reserve면 빈 한 줄 자리를 지켜 아래 칸이 뛰지 않는다 */
function GuideReasonLineExample({ reserve = false }: { reserve?: boolean }) {
  const reasonId = useId();
  const [host, setHost] = useState('');
  const reason = host.trim() === '' ? GUIDE_REASON_MISSING : undefined;
  return (
    <div className={styles.cell} style={{ width: GUIDE_FORM_WIDTH }}>
      <span className={styles.caption}>
        {reserve
          ? 'live reserve — 사유가 사라져도 한 줄 자리를 지켜 아래 칸이 뛰지 않는다'
          : 'live — 칸을 채우면 사유가 사라지고 자리를 차지하지 않는다 · 버튼 aria-describedby'}
      </span>
      <div style={{ display: 'grid', gap: 'var(--s-1)' }}>
        <div className={styles.row}>
          <Button
            variant="primary"
            disabled={reason !== undefined}
            aria-describedby={reason ? reasonId : undefined}
          >
            + 담기
          </Button>
        </div>
        <ReasonLine id={reasonId} live reserve={reserve}>
          {reason}
        </ReasonLine>
      </div>
      <Field label="접속 주소" requirement="required">
        <Input size="2xl" mono value={host} onChange={(e) => setHost(e.target.value)} />
      </Field>
    </div>
  );
}

function GuideReasonLine() {
  return (
    // 윗변을 맞춰 두 예의 아래 칸 위치를 비교한다
    <div className={styles.row} style={{ alignItems: 'flex-start' }}>
      <GuideReasonLineExample />
      <GuideReasonLineExample reserve />
    </div>
  );
}

export const REASON_LINE_SECTION: GuideSection = {
  group: '기본',
  name: 'ReasonLine',
  render: () => <GuideReasonLine />,
};

function GuideFieldGroup({ invalid }: { invalid?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <Field
      group
      label="알림 받을 일"
      requirement="required"
      message={invalid ? '하나 이상 고른다' : undefined}
    >
      <Checkbox
        label="수집 실패"
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
      />
    </Field>
  );
}

export const FIELD_GROUP_SECTION: GuideSection = {
  group: '기본',
  name: 'Field group',
  render: () => (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <span className={styles.caption}>group — fieldset + legend · SegmentedControl 묶음</span>
        <Field group label="입력 방식" hint="고른 방식의 칸만 보인다">
          <SegmentedControl aria-label="입력 방식" items={GUIDE_MODE_ITEMS} />
        </Field>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>
          group + message — 검증 문구 InlineMessage · fieldset aria-describedby
        </span>
        <GuideFieldGroup invalid />
      </div>
    </div>
  ),
};

export const INLINE_CONFIRM_REJECTION_SECTION: GuideSection = {
  group: '상태 표현',
  name: 'InlineConfirm rejection',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        rejection — 아는 code로 거부된 한 줄(줄 안 아래 InlineMessage · 확인 버튼 describedby)
      </span>
      <div style={{ width: GUIDE_CONFIRM_WIDTH }}>
        <InlineConfirm
          // 정적 예시 — 포커스를 훔치지 않는다
          focusOnMount={false}
          message="멤버에서 뺍니다: 이도윤"
          confirmLabel="빼기"
          cancelLabel="취소"
          rejection="소유자가 한 명 이상 있어야 한다"
          onConfirm={noop}
          onCancel={noop}
        />
      </div>
      <span className={styles.caption}>확인 라벨에 `취소`가 들어가면 취소 버튼은 `닫기`</span>
      <div style={{ width: GUIDE_CONFIRM_WIDTH }}>
        <InlineConfirm
          focusOnMount={false}
          message="초대를 취소합니다: 한서연"
          confirmLabel="초대 취소"
          cancelLabel="닫기"
          onConfirm={noop}
          onCancel={noop}
        />
      </div>
    </div>
  ),
};

type GuideMemberRow = { id: string; name: string; email: string; owner: boolean };
const GUIDE_MEMBERS: readonly GuideMemberRow[] = [
  { id: 'm1', name: '김하린', email: 'harin@example.com', owner: true },
  { id: 'm2', name: '이도윤', email: 'doyun@example.com', owner: false },
];
const OWNER_REASON = '마지막 소유자는 뺄 수 없다';

function GuideSelectTable() {
  const reasonPrefix = useId();
  const [picked, setPicked] = useState<readonly string[]>([]);
  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const columns: readonly TableColumn<GuideMemberRow>[] = [
    {
      key: 'pick',
      header: null,
      width: '16px',
      priority: 'high',
      cell: (r) => (
        <Checkbox
          aria-label={r.name}
          disabled={r.owner}
          aria-describedby={r.owner ? `${reasonPrefix}-${r.id}` : undefined}
          checked={picked.includes(r.id)}
          onCheckedChange={() => toggle(r.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'name',
      header: '이름',
      width: 'minmax(0,1fr)',
      priority: 'high',
      cell: (r) => (
        <TableCellLines
          main={r.name}
          sub={<span id={`${reasonPrefix}-${r.id}`}>{r.owner ? OWNER_REASON : r.email}</span>}
        />
      ),
    },
    {
      key: 'actions',
      header: null,
      width: '26px',
      priority: 'high',
      cell: (r) => (
        <RowMenu
          rowLabel={r.name}
          items={[
            { label: '역할 바꾸기', onSelect: noop },
            {
              label: '멤버에서 빼기',
              tone: 'danger',
              onSelect: noop,
              disabled: r.owner,
              reason: OWNER_REASON,
            },
          ]}
        />
      ),
    },
  ];
  return (
    <Table aria-label="멤버" columns={columns} rows={[...GUIDE_MEMBERS]} rowKey={(r) => r.id} />
  );
}

export const ROW_MENU_SECTION: GuideSection = {
  group: '데이터',
  name: 'RowMenu · 선택 열',
  render: () => (
    <div className={styles.cell} style={{ width: GUIDE_TABLE_WIDTH }}>
      <span className={styles.caption}>
        행 액션이 둘 이상이면 RowMenu(⋯ · `{'{행 이름}'} 작업`) 하나 · danger 항목 · 비활성 사유
        둘째 줄. 선택 열 16 — 고를 수 없는 행은 사유를 sub에 두고 aria-describedby
      </span>
      <GuideSelectTable />
      <span className={styles.caption}>disabled 트리거</span>
      <RowMenu rowLabel="김하린" disabled items={[]} />
    </div>
  ),
};

export const STEP_LIST_SECTION: GuideSection = {
  group: '층',
  name: 'StepList',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        HelperPanel 단계 목록 — done · current · upcoming(점 ink 필 / 테두리) + note(현재 안내)
      </span>
      <div style={GUIDE_HELPER_BOX}>
        <HelperPanel title="소스 연결 과정">
          <StepList items={GUIDE_STEPS} current={1} note={GUIDE_STEP_NOTE} />
        </HelperPanel>
      </div>
    </div>
  ),
};

export const FLOW_STEP_HEAD_SECTION: GuideSection = {
  group: '층',
  name: 'FlowStepHead',
  render: () => (
    <div className={styles.cell} style={{ width: GUIDE_TABLE_WIDTH }}>
      <span className={styles.caption}>
        단계 머리 — 제목 --t-h2 + 설명 prose muted · FlowOverlay heading(고정)
      </span>
      <FlowStepHead
        title="어떤 소스를 연결할까요?"
        description="이 프로젝트에 붙일 소스를 고릅니다."
      />
    </div>
  ),
};

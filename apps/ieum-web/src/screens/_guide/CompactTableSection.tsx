// 카탈로그 CompactTable 절 — 최소 폭 셋(640 편집 · 560 읽기 전용 · 420 읽기 전용), 행 tone warn(명세 변경), 빈 표(평문 한 칸), 좁은 폭 가로 스크롤.
// 칸 글자(고정폭 필드 · 타입 줄 · 흐린 사유 · 예시 값)는 쓰는 곳이 토큰으로 주는 것이라 이 절의 css가 흉내 낸다.
// 칸 안 입력 · 선택은 Input · Select의 cell 변형이고, 관찰 값 칩은 Tag value(고정폭 --text 글자)다
import { useState } from 'react';
import {
  Button,
  CompactTable,
  CompactTableCell,
  CompactTableHeadCell,
  CompactTableRow,
  Icon,
  Input,
  LinkButton,
  ModeTag,
  RuleChip,
  Select,
  StatusChip,
  Tag,
  type ModeKind,
} from '../../ui';
import catalog from './catalog.module.css';
import styles from './CompactTableSection.module.css';

const RULES = ['이름 정리', '값 변환', '고정값 주입', '날짜 형식', '코드표'] as const;
const MODE_LABEL: Readonly<Record<ModeKind, string>> = { read: '읽기', write: '쓰기' };

// ── 칸 안 입력 · 선택 — 값은 절 안에서만 바뀐다 ──
function CellInput({ label, initial, mono = false }: { label: string; initial: string; mono?: boolean }) {
  const [value, setValue] = useState(initial);
  return <Input variant="cell" mono={mono} value={value} onValueChange={setValue} aria-label={label} />;
}

function CellSelect({ label, initial }: { label: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Select variant="cell" value={value} onValueChange={setValue} aria-label={label}>
      {RULES.map((rule) => (
        <option key={rule}>{rule}</option>
      ))}
    </Select>
  );
}

const arrowHead = <CompactTableHeadCell className={styles.arrow} />;
const arrowCell = (
  <CompactTableCell className={styles.arrow}>
    <Icon name="arrow" size="sm" />
  </CompactTableCell>
);

// ── 640 편집 — 입력 매핑 ──
function ParamMapping() {
  return (
    <CompactTable
      minWidth={640}
      head={
        <>
          <CompactTableHeadCell>원본 필드</CompactTableHeadCell>
          {arrowHead}
          <CompactTableHeadCell>AI 파라미터</CompactTableHeadCell>
          <CompactTableHeadCell>변환 규칙</CompactTableHeadCell>
          <CompactTableHeadCell>설명</CompactTableHeadCell>
        </>
      }
    >
      <CompactTableRow>
        <CompactTableCell>
          <div className={styles.field}>ORD_NO</div>
          <div className={styles.type}>query, string</div>
        </CompactTableCell>
        {arrowCell}
        <CompactTableCell>
          <CellInput label="AI 파라미터 이름" initial="orderNo" mono />
          <div className={styles.type}>
            string<span className={styles.required}>*</span>
          </div>
        </CompactTableCell>
        <CompactTableCell>
          <CellSelect label="변환 규칙" initial="이름 정리" />
        </CompactTableCell>
        <CompactTableCell className={styles.description}>
          <CellInput label="파라미터 설명" initial="조회할 주문 번호" />
        </CompactTableCell>
      </CompactTableRow>
      <CompactTableRow>
        <CompactTableCell>
          <div className={styles.field}>AUTH_KEY</div>
          <div className={styles.type}>header, string</div>
        </CompactTableCell>
        {arrowCell}
        <CompactTableCell>
          <span className={styles.hidden}>AI에 노출 안 함</span>
        </CompactTableCell>
        <CompactTableCell>
          <CellSelect label="변환 규칙" initial="고정값 주입" />
          <div className={styles.below}>
            <CellInput label="자동 주입 값" initial="vault://hr/auth" mono />
          </div>
        </CompactTableCell>
        <CompactTableCell className={styles.description}>
          <CellInput label="파라미터 설명" initial="" />
        </CompactTableCell>
      </CompactTableRow>
    </CompactTable>
  );
}

// ── 640 — 응답 매핑: 추정 태그 · 명세 변경 행(tone warn) ──
function ResponseMapping() {
  const head = (
    <>
      <CompactTableHeadCell>원본 응답 필드</CompactTableHeadCell>
      {arrowHead}
      <CompactTableHeadCell>AI 결과 필드</CompactTableHeadCell>
      <CompactTableHeadCell>변환 규칙</CompactTableHeadCell>
      <CompactTableHeadCell>예시</CompactTableHeadCell>
    </>
  );
  return (
    <CompactTable minWidth={640} head={head}>
      <CompactTableRow>
        <CompactTableCell>
          <span className={styles.field}>ORD_STS</span>
          <Tag tone="warn" size="sm" className={styles.tagGap}>
            추정
          </Tag>
        </CompactTableCell>
        {arrowCell}
        <CompactTableCell>
          <CellInput label="AI 결과 필드 이름" initial="status" mono />
          <div className={styles.type}>string</div>
        </CompactTableCell>
        <CompactTableCell>
          <CellSelect label="변환 규칙" initial="코드표" />
        </CompactTableCell>
        <CompactTableCell>
          <span className={styles.example}>02</span>
        </CompactTableCell>
      </CompactTableRow>
      <CompactTableRow tone="warn">
        <CompactTableCell>
          <div className={`${styles.field} ${styles.old}`}>ORD_DT</div>
          <div className={styles.field}>
            ORDER_DATE
            <Tag tone="warn" size="sm" className={styles.tagGap}>
              새 필드
            </Tag>
          </div>
        </CompactTableCell>
        {arrowCell}
        <CompactTableCell>
          <CellInput label="AI 결과 필드 이름" initial="orderedAt" mono />
          <div className={styles.type}>string</div>
        </CompactTableCell>
        <CompactTableCell>
          <CellSelect label="변환 규칙" initial="날짜 형식" />
        </CompactTableCell>
        <CompactTableCell>
          <span className={styles.example}>
            <span className={styles.missing}>값 없음 (null)</span>
          </span>
        </CompactTableCell>
      </CompactTableRow>
    </CompactTable>
  );
}

// ── 560 읽기 전용 — 파라미터 추론(칸 안 RuleChip · 관찰 값 칩 · 흐린 사유 글) ──
function ParamInference() {
  return (
    <CompactTable
      minWidth={560}
      head={
        <>
          <CompactTableHeadCell>원본 파라미터</CompactTableHeadCell>
          <CompactTableHeadCell>소스 타입</CompactTableHeadCell>
          <CompactTableHeadCell>관찰한 값</CompactTableHeadCell>
          <CompactTableHeadCell>추론 결과</CompactTableHeadCell>
        </>
      }
    >
      <CompactTableRow>
        <CompactTableCell>
          <div className={styles.field}>DEPT_CD</div>
        </CompactTableCell>
        <CompactTableCell className={styles.description}>String</CompactTableCell>
        <CompactTableCell>
          <div className={styles.chips}>
            <Tag tone="mute" variant="value" size="md">
              HR
            </Tag>
            <Tag tone="mute" variant="value" size="md">
              FIN
            </Tag>
          </div>
        </CompactTableCell>
        <CompactTableCell>
          <div className={styles.field}>department</div>
          <div className={styles.type}>string</div>
          <RuleChip label="이름 정리" category="name" />
        </CompactTableCell>
      </CompactTableRow>
      <CompactTableRow>
        <CompactTableCell>
          <div className={styles.field}>AUTH_KEY</div>
        </CompactTableCell>
        <CompactTableCell className={styles.description}>
          <span className={styles.reason}>소스 없음</span>
        </CompactTableCell>
        <CompactTableCell>
          <span className={styles.reason}>관찰 없음</span>
        </CompactTableCell>
        <CompactTableCell>
          <div className={styles.type}>AI 에게 보이지 않음</div>
          <RuleChip label="인증 정보 주입" category="inject" description="실행할 때 이음 보관소에서 꺼내 넣습니다" />
        </CompactTableCell>
      </CompactTableRow>
    </CompactTable>
  );
}

// ── 560 — 액세스 키: 데이터 행 · 빈 표(평문 한 칸) ──
const KEY_HEAD = (
  <>
    <CompactTableHeadCell>이름</CompactTableHeadCell>
    <CompactTableHeadCell>키</CompactTableHeadCell>
    <CompactTableHeadCell>발급일</CompactTableHeadCell>
    <CompactTableHeadCell>마지막 사용</CompactTableHeadCell>
    <CompactTableHeadCell>상태</CompactTableHeadCell>
    <CompactTableHeadCell />
  </>
);

const KEYS = [
  { id: 'k1', name: 'claude-desktop', key: 'ieum_sk_****a91f', created: '2026-10-01', last: '2026-10-08 14:32', active: true },
  { id: 'k2', name: 'ops-test', key: 'ieum_sk_****03bc', created: '2026-09-18', last: '2026-09-30 09:12', active: false },
] as const;

function KeysTable({ empty = false }: { empty?: boolean }) {
  return (
    <CompactTable minWidth={560} head={KEY_HEAD}>
      {empty ? (
        <CompactTableRow>
          <CompactTableCell colSpan={6}>발급한 키가 없습니다. 키를 발급해 AI 앱에 연결하세요.</CompactTableCell>
        </CompactTableRow>
      ) : (
        KEYS.map((key) => (
          <CompactTableRow key={key.id}>
            <CompactTableCell>{key.name}</CompactTableCell>
            <CompactTableCell>
              <span className={styles.field}>{key.key}</span>
            </CompactTableCell>
            <CompactTableCell className={styles.description}>{key.created}</CompactTableCell>
            <CompactTableCell className={styles.description}>{key.last}</CompactTableCell>
            <CompactTableCell>
              <StatusChip tone={key.active ? 'ok' : 'mute'}>{key.active ? '사용 중' : '폐기됨'}</StatusChip>
            </CompactTableCell>
            <CompactTableCell>{key.active ? <Button size="sm">폐기</Button> : null}</CompactTableCell>
          </CompactTableRow>
        ))
      )}
    </CompactTable>
  );
}

// ── 420 읽기 전용 — 배포 포함된 도구(링크 · 모드 표지 · 상태 칩) ──
const TOOLS = [
  { id: 'orders.search', source: '구매관리 REST', mode: 'read' },
  { id: 'orders.create', source: '구매관리 REST', mode: 'write' },
  { id: 'hr.leave.balance', source: '인사 SOAP', mode: 'read' },
] as const;

function IncludedTools() {
  const [opened, setOpened] = useState('');
  return (
    <>
      <p className={catalog.note}>도구 링크를 누르면 — 연 도구: {opened || '없음'}</p>
      <CompactTable
        minWidth={420}
        head={
          <>
            <CompactTableHeadCell>도구</CompactTableHeadCell>
            <CompactTableHeadCell>원본 시스템</CompactTableHeadCell>
            <CompactTableHeadCell>방식</CompactTableHeadCell>
            <CompactTableHeadCell>상태</CompactTableHeadCell>
          </>
        }
      >
        {TOOLS.map((tool) => (
          <CompactTableRow key={tool.id}>
            <CompactTableCell>
              <LinkButton variant="mono" onClick={() => setOpened(tool.id)}>
                {tool.id}
              </LinkButton>
            </CompactTableCell>
            <CompactTableCell className={styles.description}>{tool.source}</CompactTableCell>
            <CompactTableCell>
              <ModeTag kind={tool.mode} label={MODE_LABEL[tool.mode]} />
            </CompactTableCell>
            <CompactTableCell>
              <StatusChip tone="ok">공개 중</StatusChip>
            </CompactTableCell>
          </CompactTableRow>
        ))}
      </CompactTable>
    </>
  );
}

export function CompactTableSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        테두리를 두른 작은 표 — 목록 표(Table)와 모양이 달라 합치지 않는다. 표는 자기 상자 안에서 가로 스크롤하고(최소 폭 420 · 560 ·
        640), 행은 누르지 않으며 hover 모양도 없다. 칸 폭 · 좌우 여백 0(화살표 칸 28 · 설명 최소 130)은 쓰는 곳 className이 준다.
      </p>

      <h3 className={catalog.heading}>640 편집 — 칸 안 입력 · 선택 · 화살표 칸 · 타입 줄</h3>
      <ParamMapping />

      <h3 className={catalog.heading}>640 편집 — 추정 태그 · 행 tone warn(명세 변경: 옛 필드 취소선 + 새 필드)</h3>
      <ResponseMapping />

      <h3 className={catalog.heading}>560 읽기 전용 — 고정폭 필드 · 흐린 사유 글 · 관찰 값 칩 · 칸 안 RuleChip</h3>
      <ParamInference />

      <h3 className={catalog.heading}>560 — 액세스 키 · 빈 표는 평문 한 칸(colSpan)</h3>
      <div className={catalog.stack}>
        <KeysTable />
        <KeysTable empty />
      </div>

      <h3 className={catalog.heading}>420 읽기 전용 — 링크 · 모드 표지 · 상태 칩</h3>
      <IncludedTools />

      <h3 className={catalog.heading}>좁은 폭 — 상자 안 가로 스크롤</h3>
      <div className={styles.narrow}>
        <ResponseMapping />
      </div>
    </div>
  );
}

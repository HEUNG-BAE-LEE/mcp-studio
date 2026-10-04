// 화면 틀 · 상태 골격 · 그 자리 편집 · 여러 값 입력 예시(DESIGN Patterns 화면 틀) — sections.tsx가 관련 절 뒤에 끼워 넣는다. 눈으로 확인한다
import { useId, useState } from 'react';
import {
  Button,
  ErrorBlock,
  EmptyState,
  InlineEdit,
  PageBody,
  PageColumns,
  PageHeader,
  ScreenState,
  SectionHead,
  SectionSearch,
  TagInput,
  useSearchFilter,
} from '@/ui';
import { GUIDE_FRAME_WIDTH, GUIDE_NARROW_FRAME_WIDTH, guideFrameStyle } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

/** 예시 프레임 높이(본문 스크롤 확인용) — 카탈로그 상자 치수 */
const FRAME_HEIGHT = 360;
const SAVE_DELAY_MS = 600;
const MEMBERS = ['김하늘 · 소유자', '이도윤 · 편집자', '박서연 · 보기'];

function GuideBackLink() {
  return (
    <Button variant="link" asChild>
      <a href="#PageBody">← 보험 인수심사</a>
    </Button>
  );
}

function GuideFrame({ narrow }: { narrow: boolean }) {
  const settingsId = useId();
  const logId = useId();
  return (
    <div
      style={guideFrameStyle(narrow ? GUIDE_NARROW_FRAME_WIDTH : GUIDE_FRAME_WIDTH, FRAME_HEIGHT)}
    >
      <PageBody narrow={narrow} scroll="regions">
        <PageHeader
          back={<GuideBackLink />}
          title="계약 원장 DB"
          description="데이터베이스 · 수집 완료"
        />
        <PageColumns narrow={narrow}>
          <section aria-labelledby={settingsId}>
            <SectionHead title="연결 설정" titleId={settingsId} />
          </section>
          <section aria-labelledby={logId}>
            <SectionHead title="실행 로그" titleId={logId} count="12" />
          </section>
        </PageColumns>
      </PageBody>
    </div>
  );
}

export const PAGE_BODY_SECTION: GuideSection = {
  group: '레이아웃',
  name: 'PageBody',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        하위 화면형 — 여백 body-* 24 32 24 · 영역 사이 gap-section 20 · 두 열 gap-column 32 ·
        scroll=regions
      </span>
      <div className={styles.stage}>
        <GuideFrame narrow={false} />
      </div>
      <span className={styles.caption}>
        1024(narrow) — 좌우 body-x-narrow 24 · 열 사이 gap-column-narrow 24
      </span>
      <div className={styles.stage}>
        <GuideFrame narrow />
      </div>
    </div>
  ),
};

export const SCREEN_STATE_SECTION: GuideSection = {
  group: '상태 표현',
  name: 'ScreenState',
  render: () => (
    <div className={styles.row} style={{ alignItems: 'flex-start' }}>
      <div className={styles.cell}>
        <span className={styles.caption}>loading — 진행형 한 줄</span>
        <ScreenState kind="loading" label="소스를 불러오는 중…" />
        <span className={styles.caption}>loading inline — 영역 안(목록 · 표 자리) 한 줄</span>
        <ScreenState kind="loading" inline label="결과를 불러오는 중…" />
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>failed — ErrorBlock 원문 + 다시 시도</span>
        <ScreenState
          kind="failed"
          raw={'INTERNAL (500)\nupstream timeout after 30s'}
          retryLabel="다시 시도"
          onRetry={() => {}}
          onCopy={() => true}
        />
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>not-found — 찾을 수 없음 + 돌아갈 곳</span>
        <ScreenState
          kind="not-found"
          message="찾을 수 없음"
          action={
            <Button variant="link" asChild>
              <a href="#ScreenState">프로젝트로</a>
            </Button>
          }
        />
      </div>
    </div>
  ),
};

function GuideSectionSearch({ narrow }: { narrow: boolean }) {
  const filter = useSearchFilter(MEMBERS, (m) => m);
  const shown = filter.shown.length;
  return (
    <div className={styles.cell} style={{ width: 474 }}>
      <SectionHead
        divider
        title="멤버"
        count={shown === filter.total ? String(filter.total) : `${shown} / ${filter.total}`}
        tools={
          <SectionSearch
            narrow={narrow}
            placeholder="이름 · 역할 검색"
            value={filter.query}
            onValueChange={filter.setQuery}
          />
        }
      />
      {filter.isNoMatch ? (
        <EmptyState
          kind="filtered"
          body={`조건에 맞는 멤버가 없다 · ${filter.total}건 가운데 0건`}
          onClear={filter.clear}
        />
      ) : (
        filter.shown.map((m) => (
          <span key={m} className={styles.caption}>
            {m}
          </span>
        ))
      )}
    </div>
  );
}

export const SECTION_SEARCH_SECTION: GuideSection = {
  group: '데이터',
  name: 'SectionSearch',
  render: () => (
    <div className={styles.row} style={{ alignItems: 'flex-start' }}>
      <div className={styles.cell}>
        <span className={styles.caption}>150 · useSearchFilter · 0건이면 EmptyState filtered</span>
        <GuideSectionSearch narrow={false} />
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>1024 — 110</span>
        <GuideSectionSearch narrow />
      </div>
    </div>
  ),
};

/** 진입(이름 수정) · 저장(가짜 지연) · Esc · 빈 값 검증 · 충돌 실패 */
function GuideTitleEdit() {
  const [title, setTitle] = useState('계약 원장 DB');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const close = () => {
    setEditing(false);
    setMessage('');
    setConflict(false);
  };
  const save = (next: string) => {
    if (next === '') {
      setMessage('필수 항목이다');
      return;
    }
    if (next === '충돌') {
      setConflict(true);
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setTitle(next);
      close();
    }, SAVE_DELAY_MS);
  };
  return (
    <div style={{ width: 720 }}>
      <PageHeader
        back={<GuideBackLink />}
        title={title}
        titleAction={
          <Button size="sm" onClick={() => setEditing(true)}>
            이름 수정
          </Button>
        }
        editor={
          editing ? (
            <InlineEdit
              textStyle="heading"
              label="소스 이름"
              defaultValue={title}
              saving={saving}
              invalid={message !== ''}
              message={message}
              error={
                conflict ? (
                  <ErrorBlock
                    raw={'SOURCE_NAME_DUPLICATE (409)\nname already exists'}
                    onCopy={() => true}
                  />
                ) : undefined
              }
              onSave={save}
              onCancel={close}
            />
          ) : null
        }
        description="데이터베이스 · 수집 완료"
      />
    </div>
  );
}

export const PAGE_HEADER_BACK_SECTION: GuideSection = {
  group: '레이아웃',
  name: 'PageHeader back · 그 자리 편집',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        뒤로 링크(제목 위 · 아래 8) · 이름 수정 → InlineEdit heading · Enter 저장 · Esc 취소 · 빈
        값은 검증 문구 · `충돌`은 ErrorBlock(h1 밖)
      </span>
      <GuideTitleEdit />
    </div>
  ),
};

export const INLINE_EDIT_SECTION: GuideSection = {
  group: '기본',
  name: 'InlineEdit',
  render: () => (
    <div className={styles.cell} style={{ width: 520 }}>
      <span className={styles.caption}>ui(기본) · lg 34 줄</span>
      <InlineEdit
        label="표시 이름"
        defaultValue="계약 원장"
        onSave={() => {}}
        onCancel={() => {}}
      />
      <span className={styles.caption}>검증 문구(invalid)</span>
      <InlineEdit
        label="표시 이름 검증"
        defaultValue=""
        invalid
        message="필수 항목이다"
        onSave={() => {}}
        onCancel={() => {}}
      />
      <span className={styles.caption}>저장 중 — 진행형 라벨 · 취소 비활성</span>
      <InlineEdit
        label="표시 이름 저장 중"
        defaultValue="계약 원장"
        saving
        onSave={() => {}}
        onCancel={() => {}}
      />
    </div>
  ),
};

function GuideTagInput() {
  const [values, setValues] = useState<readonly string[]>(['ops@corp.example']);
  const [text, setText] = useState('');
  return (
    <div className={styles.cell} style={{ width: 472 }}>
      <TagInput
        aria-label="초대할 이메일"
        placeholder="이메일 입력 후 Enter"
        values={values}
        inputValue={text}
        onInputValueChange={setText}
        onAdd={(v) => {
          setValues((vs) => (vs.includes(v) ? vs : [...vs, v]));
          setText('');
        }}
        onRemove={(v) => setValues((vs) => vs.filter((x) => x !== v))}
      />
    </div>
  );
}

export const TAG_INPUT_SECTION: GuideSection = {
  group: '기본',
  name: 'TagInput',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        Input xl · Enter(IME 조합 제외)로 더함 · Tag ✕ 삭제 · 값 줄 gap 6
      </span>
      <GuideTagInput />
    </div>
  ),
};

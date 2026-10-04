// 설정 · 읽기 전용 · 요약 증감 · 영역 머리 메모 — sections.tsx가 관련 절 뒤에 끼워 넣는다
import { useId, useState } from 'react';
import {
  Button,
  Field,
  Input,
  SectionHead,
  SettingRow,
  SegmentBar,
  SummaryBand,
  SummaryCard,
  Switch,
  TagInput,
  Tabs,
  Textarea,
} from '@/ui';
import { GUIDE_HEAD_WIDTH } from './fixtureData';
import { GUIDE_RAIL_ITEMS } from './fixturesFlow';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

/** 설정 행 예시 폭(설정 모달 내용 열 ≈ 584) */
const GUIDE_PANEL_WIDTH = 584;
const GUIDE_DENIED = '권한이 없다 · 소유자에게 요청';

function GuideSettingRows() {
  const reasonId = useId();
  const [isOn, setIsOn] = useState(true);
  return (
    <div className={styles.cell} style={{ width: GUIDE_PANEL_WIDTH, justifyItems: 'stretch' }}>
      <SettingRow
        title="자동 수집"
        description="매일 03:00에 다시 수집한다"
        control={<Switch aria-label="자동 수집" checked={isOn} onCheckedChange={setIsOn} />}
      />
      <SettingRow
        title="알림 받기"
        description="권한이 없으면 disabled(Switch는 readOnly가 없다)"
        control={<Switch aria-label="알림 받기" disabled aria-describedby={reasonId} />}
      />
      <SettingRow
        title="연결 해제"
        description="산출물과 커넥터도 함께 사라집니다"
        control={<Button variant="danger">연결 해제</Button>}
      />
      <SettingRow
        title="연결 해제 · 권한 없음"
        description="사유는 발 메모 · aria-describedby"
        control={
          <Button variant="danger" disabled aria-describedby={reasonId}>
            연결 해제
          </Button>
        }
      />
      <span id={reasonId} className={styles.caption}>
        {GUIDE_DENIED}
      </span>
    </div>
  );
}

export const SETTING_ROW_SECTION: GuideSection = {
  group: '데이터',
  name: 'SettingRow',
  render: () => <GuideSettingRows />,
};

export const READ_ONLY_SECTION: GuideSection = {
  group: '기본',
  name: 'Input · Textarea readOnly',
  render: () => (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <span className={styles.caption}>편집 가능</span>
        <Field label="소스 이름">
          <Input defaultValue="계약 원장 DB" />
        </Field>
        <Field label="설명">
          <Textarea defaultValue="보험 계약 원장" />
        </Field>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>
          readOnly — 권한 없음(같은 폼) · surface-subtle · ink-soft
        </span>
        <Field label="소스 이름">
          <Input readOnly defaultValue="계약 원장 DB" />
        </Field>
        <Field label="설명">
          <Textarea readOnly defaultValue="보험 계약 원장" />
        </Field>
      </div>
    </div>
  ),
};

function GuideFieldTagInput() {
  const [values, setValues] = useState<readonly string[]>(['보험', '계약']);
  const [text, setText] = useState('');
  return (
    <div className={styles.cell} style={{ width: 472, justifyItems: 'stretch' }}>
      <Field label="태그" message={values.length > 3 ? '태그는 셋까지' : undefined}>
        <TagInput
          placeholder="태그 입력"
          values={values}
          inputValue={text}
          onInputValueChange={setText}
          onAdd={(v) => {
            setValues((vs) => (vs.includes(v) ? vs : [...vs, v]));
            setText('');
          }}
          onRemove={(v) => setValues((vs) => vs.filter((x) => x !== v))}
        />
      </Field>
    </div>
  );
}

export const FIELD_TAG_INPUT_SECTION: GuideSection = {
  group: '기본',
  name: 'Field + TagInput',
  render: () => (
    <div className={styles.cell}>
      <span className={styles.caption}>
        라벨 · 입력 · 값 줄 · 검증 문구 모두 Field gap 6(넷 이상이면 검증 문구)
      </span>
      <GuideFieldTagInput />
    </div>
  ),
};

export const SUMMARY_DELTA_SECTION: GuideSection = {
  group: '데이터',
  name: 'SummaryCard delta',
  render: () => (
    <div className={styles.wide}>
      <span className={styles.caption}>값 아래 caption muted 한 줄 — 색 없음</span>
      <SummaryBand>
        <SummaryCard title="호출" value="12,340" delta="이전 7일 대비 +8.2%">
          <SegmentBar
            segments={[{ label: '성공', value: 1, tone: 'ink-soft' }]}
            aria-label="호출 구성"
          />
        </SummaryCard>
        <SummaryCard title="오류율" value="1.2%" delta="이전 7일 대비 −0.4%p" />
        <SummaryCard title="지연(p95)" value="412ms" delta="이전 기간 없음" />
        <SummaryCard title="점검 필요" value="0" valueTone="faint" />
      </SummaryBand>
    </div>
  ),
};

export const SECTION_HEAD_NOTE_SECTION: GuideSection = {
  group: '데이터',
  name: 'SectionHead note',
  render: () => (
    <div className={styles.cell} style={{ width: GUIDE_HEAD_WIDTH, justifyItems: 'stretch' }}>
      <SectionHead title="호출 순위" note="호출 많은 순 · 최근 7일" />
      <SectionHead title="실시간 호출" note="실시간" />
      <SectionHead
        title="커넥터"
        count="3"
        note="이름순"
        tools={
          <Button variant="primary" size="sm-plus" textStyle="label">
            + 커넥터 만들기
          </Button>
        }
      />
    </div>
  ),
};

/** 설정 모달 몸통 예 — Tabs rail 내용 열(ModalPanel 상자)이 여백 · 간격 · 스크롤 · 칸 최대 --w-field를 갖는다 */
export function GuideSettingsBody() {
  const [tab, setTab] = useState('info');
  return (
    <Tabs variant="rail" value={tab} onValueChange={setTab} items={GUIDE_RAIL_ITEMS}>
      {GUIDE_RAIL_ITEMS.map((item) => (
        <Tabs.Content key={item.value} value={item.value}>
          <Field label="소스 이름">
            <Input defaultValue="계약 원장 DB" readOnly={item.value === 'connection'} />
          </Field>
          <SettingRow
            title="연결 해제"
            description="산출물과 커넥터도 함께 사라집니다"
            control={<Button variant="danger">연결 해제</Button>}
          />
        </Tabs.Content>
      ))}
    </Tabs>
  );
}

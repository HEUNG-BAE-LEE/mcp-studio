// 폼 칸(라벨 · 설명 · 검증 문구) · 전환 크기 — sections.tsx가 관련 절 뒤에 끼워 넣는다
import { useState } from 'react';
import { Field, Input, SectionHead, SegmentedControl, Select, Textarea } from '@/ui';
import { GUIDE_HEAD_WIDTH, GUIDE_MODE_ITEMS } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

const GUIDE_IMPORT_OPTIONS = [{ value: 'none', label: '가져오지 않음' }];
const GUIDE_RANGE_ITEMS = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
];

export const FIELD_SECTION: GuideSection = {
  group: '기본',
  name: 'Field',
  render: () => (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <span className={styles.caption}>기본 · requirement · hint(Label 칩 뒤)</span>
        <Field label="이름" requirement="required">
          <Input placeholder="예: 계약 조회" />
        </Field>
        <Field label="접속 주소" requirement="required" hint="호스트와 포트">
          <Input size="2xl" mono placeholder="db.internal:5432" />
        </Field>
        <Field label="설명" requirement="optional">
          <Textarea placeholder="설명을 적는다" />
        </Field>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>
          message — 컨트롤 invalid + aria-describedby · 아래 label 500 12 fix-fg
        </span>
        <Field label="프로젝트 이름" message="중복된 이름이 있다">
          <Input defaultValue="보험 인수심사" />
        </Field>
        <Field label="가져올 프로젝트" message="고를 수 있는 프로젝트가 없다">
          <Select options={GUIDE_IMPORT_OPTIONS} defaultValue="none" />
        </Field>
      </div>
      <div className={styles.cell}>
        <span className={styles.caption}>
          description — 컨트롤 아래 한 줄(caption muted) · 검증 문구 위 · aria-describedby
        </span>
        <Field
          label="기존 프로젝트에서 가져오기"
          description="이름 · 설명 · 태그를 가져왔습니다: 보험 인수심사"
        >
          <Select options={GUIDE_IMPORT_OPTIONS} defaultValue="none" />
        </Field>
        <Field
          label="커넥터 이름"
          description="목록 · 알림에 보이는 이름"
          message="중복된 이름이 있다"
        >
          <Input defaultValue="계약 조회" />
        </Field>
      </div>
    </div>
  ),
};

function GuideRangeFilter() {
  const [range, setRange] = useState('7d');
  return (
    <SectionHead
      title="호출 순위"
      tools={
        <SegmentedControl
          size="sm-plus"
          aria-label="기간"
          items={GUIDE_RANGE_ITEMS}
          value={range}
          onValueChange={setRange}
        />
      }
    />
  );
}

export const SEGMENTED_SIZE_SECTION: GuideSection = {
  group: '기본',
  name: 'SegmentedControl size',
  render: () => (
    <div className={styles.cell} style={{ width: GUIDE_HEAD_WIDTH }}>
      <span className={styles.caption}>
        lg(34, 기본) — 폼 · 흐름 안 전환 · 내용 폭(inline-flex)
      </span>
      <SegmentedControl aria-label="입력 방식" items={GUIDE_MODE_ITEMS} />
      <span className={styles.caption}>sm-plus(28) — 영역 머리 도구 필터(SectionHead tools)</span>
      <GuideRangeFilter />
    </div>
  ),
};

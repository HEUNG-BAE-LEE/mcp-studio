// '기본' 그룹 절(Button · IconButton · Tabs · Input · Checkbox · Switch · Select · SegmentedControl · Tooltip) — sections.tsx가 BASE_SECTIONS 맨 앞에 잇는다
import {
  Button,
  type ButtonSize,
  type ButtonTextStyle,
  type ButtonVariant,
  Checkbox,
  ICON_NAMES,
  IconButton,
  Input,
  Label,
  SegmentedControl,
  Select,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
} from '@/ui';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

const GUIDE_ROLE_OPTIONS = [
  { value: 'owner', label: '소유자' },
  { value: 'editor', label: '편집자' },
  { value: 'viewer', label: '보기' },
];

/** COMPONENTS Button `허용 조합` 표의 행 그대로 — 이 밖의 조합은 카탈로그에도 그리지 않는다 */
type ButtonCombo = Readonly<{
  sizes: readonly ButtonSize[];
  variants: readonly ButtonVariant[];
  textStyle?: ButtonTextStyle;
  place: string;
}>;
const BUTTON_COMBOS: readonly ButtonCombo[] = [
  {
    sizes: ['sm'],
    variants: ['secondary', 'danger'],
    place: 'Table 액션 열 · InlineConfirm · ErrorBlock 복사 · PageHeader actions 층 열기',
  },
  { sizes: ['sm'], variants: ['secondary'], textStyle: 'label', place: '카드 안 액션' },
  {
    sizes: ['sm-plus'],
    variants: ['primary', 'secondary'],
    textStyle: 'label',
    place: 'SectionHead tools',
  },
  { sizes: ['md'], variants: ['primary', 'secondary', 'quiet'], place: '기본' },
  { sizes: ['md'], variants: ['danger'], place: 'Dialog 확인 · 위험 작업 SettingRow' },
  { sizes: ['lg'], variants: ['outline', 'danger'], place: 'FlowOverlay footer' },
  { sizes: ['lg'], variants: ['primary'], place: 'FlowOverlay footer 주 액션' },
  { sizes: ['lg'], variants: ['primary', 'secondary'], place: 'InlineEdit 저장 · 취소' },
  { sizes: ['md', 'sm'], variants: ['link'], place: '화면 이동' },
];

function ButtonComboCell({ combo }: { combo: ButtonCombo }) {
  const { sizes, variants, textStyle, place } = combo;
  const label = textStyle === 'label' ? ' · label' : '';
  return (
    <div className={styles.cell}>
      <span className={styles.caption}>
        {`${sizes.join(' · ')} × ${variants.join(' · ')}${label} — ${place}`}
      </span>
      {sizes.flatMap((size) =>
        variants.map((variant) => (
          <div key={`${size}-${variant}`} className={styles.row}>
            <Button variant={variant} size={size} textStyle={textStyle}>
              {variant}
            </Button>
            <Button variant={variant} size={size} textStyle={textStyle} disabled>
              disabled
            </Button>
            {variant === 'link' ? null : (
              <Button variant={variant} size={size} textStyle={textStyle} loading>
                확인 중…
              </Button>
            )}
          </div>
        )),
      )}
    </div>
  );
}

export const BASIC_SECTIONS: readonly GuideSection[] = [
  {
    group: '기본',
    name: 'Button',
    render: () => (
      <div className={styles.list}>
        {BUTTON_COMBOS.map((combo) => (
          <ButtonComboCell
            key={`${combo.sizes.join()}-${combo.variants.join()}-${combo.textStyle ?? 'ui'}`}
            combo={combo}
          />
        ))}
      </div>
    ),
  },
  {
    group: '기본',
    name: 'IconButton',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.row}>
          {ICON_NAMES.map((name) => (
            <IconButton key={name} icon={name} title={name} />
          ))}
          <IconButton icon="search" title="disabled" disabled />
        </div>
        <div className={styles.row}>
          <span className={styles.caption}>sm(기본) · sm-plus</span>
          <IconButton icon="search" title="sm" />
          <IconButton icon="search" title="sm-plus" size="sm-plus" />
        </div>
      </div>
    ),
  },
  {
    group: '기본',
    name: 'Tabs',
    render: () => (
      <Tabs
        defaultValue="status"
        items={[
          { value: 'status', label: '상태 · 수집' },
          { value: 'conn', label: '접속 정보' },
          {
            value: 'connector',
            label: '커넥터 만들기',
            disabled: true,
            reason: '수집이 끝난 뒤 열립니다',
          },
        ]}
      >
        <Tabs.Content value="status">상태 · 수집 내용</Tabs.Content>
        <Tabs.Content value="conn">접속 정보 내용</Tabs.Content>
      </Tabs>
    ),
  },
  {
    group: '기본',
    name: 'Input',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <Label htmlFor="g-in-md" requirement="required">
            이름
          </Label>
          <Input id="g-in-md" placeholder="xl (36, 기본)" />
          <Input size="2xl" placeholder="2xl (38)" />
          <Input size="2xl" mono defaultValue="https://git.internal/repo.git" aria-label="mono" />
          <Input invalid defaultValue="invalid" aria-label="invalid" />
          <Input disabled defaultValue="disabled" aria-label="disabled" />
          <Label requirement="optional">설명</Label>
          <Textarea placeholder="설명을 입력한다" />
          <Textarea invalid aria-label="invalid textarea" defaultValue="invalid" />
        </div>
        <div className={styles.cell}>
          <span className={styles.caption}>lg(34) — Field 밖 한 줄 · 그 자리 편집</span>
          <Input size="lg" placeholder="lg (34)" aria-label="lg" />
        </div>
      </div>
    ),
  },
  {
    group: '기본',
    name: 'Checkbox · Switch',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <span className={styles.caption}>Checkbox</span>
          <Checkbox aria-label="선택됨" defaultChecked />
          <Checkbox aria-label="선택 안 됨" />
          <Checkbox aria-label="비활성" disabled />
          <Checkbox aria-label="비활성 선택됨" disabled defaultChecked />
        </div>
        <div className={styles.cell}>
          <span className={styles.caption}>
            Checkbox label — 상자 + 라벨 한 줄(ui 400 ink · 비활성 disabled)
          </span>
          <Checkbox label="조회 12" defaultChecked />
          <Checkbox label="쓰기 0" />
          <Checkbox label="집계 3 · 비활성" disabled defaultChecked />
        </div>
        <div className={styles.cell}>
          <span className={styles.caption}>Switch</span>
          <Switch aria-label="켜짐" defaultChecked />
          <Switch aria-label="꺼짐" />
          <Switch aria-label="비활성" disabled />
        </div>
      </div>
    ),
  },
  {
    group: '기본',
    name: 'Select',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <Select
            aria-label="원본 프로젝트"
            defaultValue="none"
            options={[
              { value: 'none', label: '가져오지 않고 새로 입력' },
              { value: 'p1', label: '코드 검색', group: '공유받은 프로젝트' },
              { value: 'p2', label: '민원 응대 지원', group: '공유받은 프로젝트' },
            ]}
          />
          <Select
            aria-label="placeholder"
            placeholder="선택"
            options={[{ value: 'a', label: 'A' }]}
          />
          <Select
            aria-label="invalid"
            invalid
            placeholder="invalid"
            options={[{ value: 'a', label: 'A' }]}
          />
          <Select
            aria-label="disabled"
            disabled
            placeholder="disabled"
            options={[{ value: 'a', label: 'A' }]}
          />
        </div>
        <div className={styles.cell}>
          <span className={styles.caption}>sm 26 — 표 행 · 툴바 안 (Button sm과 같은 높이)</span>
          <div className={styles.row}>
            <Select
              size="sm"
              aria-label="역할"
              defaultValue="editor"
              options={GUIDE_ROLE_OPTIONS}
            />
            <Button variant="danger" size="sm">
              삭제
            </Button>
          </div>
          <Select
            size="sm"
            aria-label="역할 placeholder"
            placeholder="역할"
            options={GUIDE_ROLE_OPTIONS}
          />
          <Select
            size="sm"
            aria-label="역할 disabled"
            disabled
            defaultValue="viewer"
            options={GUIDE_ROLE_OPTIONS}
          />
        </div>
      </div>
    ),
  },
  {
    group: '기본',
    name: 'SegmentedControl',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <SegmentedControl
            aria-label="접속 방식"
            defaultValue="info"
            items={[
              { value: 'info', label: '접속 정보' },
              { value: 'string', label: '연결 문자열' },
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    group: '기본',
    name: 'Tooltip',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <Tooltip.Provider delayDuration={0}>
            <Tooltip content="호버하거나 포커스하면 뜬다">
              <Button>툴팁</Button>
            </Tooltip>
          </Tooltip.Provider>
        </div>
      </div>
    ),
  },
];

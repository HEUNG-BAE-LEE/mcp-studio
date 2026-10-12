// 카탈로그 Switch 절 — standalone · inline · heading × 켜짐 · 꺼짐 · 비활성(사유 숨김 글자 disabledReason · 보이는 사유 글) + 바깥 <label> 안의 standalone.
// 누르면 바뀐다. 키보드 포커스 링은 Tab으로 닿아 본다(스위치 표시에 그린다). 760 이하에서 heading 설명 들여쓰기가 없어지는 것은 폭 전환으로 본다
import { useId, useState } from 'react';
import { HelpText, Icon, Switch } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SwitchSection.module.css';

const NOOP = () => undefined;

/** 켜고 끌 수 있는 예 — 처음 값만 받는다 */
type ToggleProps = { label: string; initial: boolean } & (
  | { variant?: 'standalone' | 'inline' }
  | { variant: 'heading'; description: string }
);

function Toggle(props: ToggleProps) {
  const [checked, setChecked] = useState(props.initial);
  return props.variant === 'heading' ? (
    <Switch variant="heading" label={props.label} description={props.description} checked={checked} onCheckedChange={setChecked} />
  ) : (
    <Switch variant={props.variant} label={props.label} checked={checked} onCheckedChange={setChecked} />
  );
}

/** 운영 화면 탐색 — 쓸 수 있는 브라우저가 없어 잠긴 제목줄 + 화면에 보이는 사유 글(aria-describedby) */
function LockedHeading() {
  const reasonId = useId();
  return (
    <div className={catalog.frame}>
      <Switch
        variant="heading"
        label="운영 화면 탐색"
        description="헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다"
        checked={false}
        onCheckedChange={NOOP}
        disabled
        aria-describedby={reasonId}
      />
      <div id={reasonId} className={styles.reason}>
        <HelpText>
          <Icon name="alert" size="sm" /> 이 서버에서 쓸 수 있는 브라우저가 없습니다.
        </HelpText>
      </div>
    </div>
  );
}

/** 바깥 <label htmlFor>가 줄 전체를 누르는 곳으로 쓰는 자리 — standalone은 자기 <label>을 만들지 않는다 */
function OuterLabel() {
  const [checked, setChecked] = useState(true);
  const inputId = useId();
  return (
    <label htmlFor={inputId} className={styles.outer}>
      <Switch id={inputId} label="캡처 데이터 개인정보 마스킹" checked={checked} onCheckedChange={setChecked} />
      <span>줄 어디를 눌러도 바뀐다 — 이름은 스위치의 aria-label</span>
    </label>
  );
}

export function SwitchSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        38 × 22 알약 · 점 16. 꺼짐 --line-control · 켜짐 --primary. 숨긴 체크박스가 표시를 덮고(역할은 체크박스 그대로), 포커스 링은 표시에 그린다.
        비활성은 inline(공개 스위치 묶음)만 흐려진다 — standalone · heading은 모양이 그대로이고 스위치 위 커서만 not-allowed다(끌 수 없는 차단이 진하게 보여야 한다).
        disabledReason은 시각 숨김 글자(aria-describedby) + 마우스 툴팁이고, 사유가 화면에 보이는 글이면 그 id를 aria-describedby로 준다.
      </p>

      <h3 className={catalog.heading}>standalone — 꺼짐 · 켜짐 · 비활성 꺼짐 · 비활성 켜짐 · 비활성 + disabledReason</h3>
      <div className={catalog.row}>
        <span className={styles.item}>
          <Toggle label="개인정보 마스킹" initial={false} />
          꺼짐
        </span>
        <span className={styles.item}>
          <Toggle label="응답 캐시" initial />
          켜짐
        </span>
        <span className={styles.item}>
          <Switch label="응답 캐시" checked={false} onCheckedChange={NOOP} disabled />
          비활성 꺼짐(쓰기 도구)
        </span>
        <span className={styles.item}>
          <Switch label="쓰기 요청 차단" checked onCheckedChange={NOOP} disabled />
          비활성 켜짐(끌 수 없는 차단)
        </span>
        <span className={styles.item}>
          <Switch label="쓰기 요청 차단" checked onCheckedChange={NOOP} disabled disabledReason="안전을 위해 끌 수 없습니다" />
          비활성 + disabledReason(숨김 글자 · 마우스 툴팁)
        </span>
      </div>

      <h3 className={catalog.heading}>inline — 켜짐 · 꺼짐 · 비활성 + disabledReason(마우스 툴팁)</h3>
      <div className={catalog.row}>
        <Toggle variant="inline" label="AI에게 공개" initial />
        <Toggle variant="inline" label="AI에게 공개" initial={false} />
        <Switch
          variant="inline"
          label="AI에게 공개"
          checked={false}
          onCheckedChange={NOOP}
          disabled
          disabledReason="검토를 마쳐야 공개할 수 있습니다"
        />
      </div>

      <h3 className={catalog.heading}>heading — 켜짐 · 꺼짐 + description · 비활성 + 보이는 사유 글 · 비활성 + disabledReason</h3>
      <div className={catalog.stack}>
        <div className={catalog.frame}>
          <Toggle
            variant="heading"
            label="Git 소스 분석"
            description="컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다"
            initial
          />
        </div>
        <div className={catalog.frame}>
          <Toggle
            variant="heading"
            label="운영 화면 탐색"
            description="헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다"
            initial={false}
          />
        </div>
        <LockedHeading />
        <div className={catalog.frame}>
          <Switch
            variant="heading"
            label="Git 소스 분석"
            description="컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다"
            checked={false}
            onCheckedChange={NOOP}
            disabled
            disabledReason="이 서버에서는 저장소를 읽을 수 없습니다"
          />
        </div>
      </div>

      <h3 className={catalog.heading}>바깥 &lt;label&gt; 안의 standalone</h3>
      <OuterLabel />
    </div>
  );
}

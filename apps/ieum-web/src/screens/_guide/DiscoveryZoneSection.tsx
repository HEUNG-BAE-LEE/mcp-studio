// 카탈로그 DiscoveryZone 절 — 고정 묶음(칸 셋 + FieldPair half) · 켜고 끄는 묶음(켜짐 · 꺼짐) · 스위치 잠김(보이는 사유 글 · 숨김 사유) · 잠긴 켜짐(흐리지 않음).
// 스위치를 누르면 바뀐다 — 꺼졌을 때 칸을 남길지는 쓰는 곳 몫이라 이 절은 칸을 빼고 안내만 남기는 옛 모양을 따른다. 칸 묶음 아래 안내는 FieldNote,
// 잠긴 사유 안내는 HelpText note(위 0 · 아래 8 — 옛 인라인 js/menu/discovery.js:60)다. 760 이하는 폭 전환으로 본다
import { useId, useState } from 'react';
import { DiscoveryZone, Field, FieldNote, FieldPair, HelpText, Icon, InlineCode, Input, Select } from '../../ui';
import catalog from './catalog.module.css';
import styles from './DiscoveryZoneSection.module.css';

const NOOP = () => undefined;
const FRAMEWORKS = ['자동 감지', 'Spring', 'Express'] as const;

/** 입력 한 줄 — 값은 카탈로그 안에서만 바뀐다 */
function TextField({ label, placeholder, mono = false, secret = false }: { label: string; placeholder: string; mono?: boolean; secret?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <Field label={label}>
      {({ id }) => (
        <Input id={id} type={secret ? 'password' : 'text'} mono={mono} placeholder={placeholder} value={value} onValueChange={setValue} />
      )}
    </Field>
  );
}

function AccountField() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  return (
    <Field label="테스트 계정">
      {({ id }) => (
        <FieldPair variant="half">
          <Input id={id} aria-label="아이디" placeholder="아이디" value={account} onValueChange={setAccount} />
          <Input type="password" aria-label="비밀번호" placeholder="비밀번호" value={password} onValueChange={setPassword} />
        </FieldPair>
      )}
    </Field>
  );
}

function FrameworkField() {
  const [value, setValue] = useState<string>(FRAMEWORKS[0]);
  return (
    <Field label="프레임워크">
      {({ id }) => (
        <Select id={id} variant="form" value={value} onValueChange={setValue}>
          {FRAMEWORKS.map((framework) => (
            <option key={framework} value={framework}>
              {framework}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function FixedZone() {
  return (
    <DiscoveryZone title="운영 접속 정보" description="화면 탐색에 쓰고, Git에서 찾은 읽기 API를 실제로 호출해 검증할 때도 씁니다">
      <TextField label="운영 주소" placeholder="http://10.20.4.30:8080/po" mono />
      <TextField label="로그인 페이지" placeholder="/login.do" mono />
      <AccountField />
    </DiscoveryZone>
  );
}

/** Git 소스 분석 — 켜면 칸 넷 + 안내, 끄면 머리만 남는다 */
function GitZone({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <DiscoveryZone
      title="Git 소스 분석"
      description="컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다"
      toggle={{ checked, onCheckedChange: setChecked }}
    >
      {checked ? (
        <>
          <TextField label="저장소" placeholder="https://git.example.com/legacy/po-web.git" mono />
          <TextField label="브랜치" placeholder="비우면 기본 브랜치" mono />
          <TextField label="접근 토큰" placeholder="비공개 저장소일 때만" secret />
          <FrameworkField />
          <FieldNote>읽기 전용 토큰만 쓰고, 분석이 끝나면 내려받은 소스를 지웁니다. 이 서버에 허용된 폴더는 경로로 바로 읽을 수 있습니다.</FieldNote>
        </>
      ) : null}
    </DiscoveryZone>
  );
}

/** 운영 화면 탐색 — 켜면 칸 셋 + 안내 */
function CrawlZone({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <DiscoveryZone
      title="운영 화면 탐색"
      description="헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다"
      toggle={{ checked, onCheckedChange: setChecked }}
    >
      {checked ? (
        <>
          <TextField label="탐색 범위" placeholder="비우면 운영 주소 아래 전부 (예: /po/*)" mono />
          <TextField label="제외 경로" placeholder="/logout.do, /admin/*" mono />
          <TextField label="조회용 POST" placeholder="비움 (예: /po/*List.do)" mono />
          <FieldNote>
            경로는 <InlineCode>/po/*</InlineCode> 처럼 서버 기준으로도, <InlineCode>/logout.do</InlineCode> 처럼 운영 주소 기준으로도 쓸 수 있습니다.
          </FieldNote>
        </>
      ) : null}
    </DiscoveryZone>
  );
}

/** 쓸 수 있는 브라우저가 없어 잠긴 묶음 — 사유가 화면에 보이는 안내라 그 id를 describedBy로 잇는다. 칸은 없고 안내만 남는다 */
function LockedByNoBrowser() {
  const reasonId = useId();
  return (
    <DiscoveryZone
      title="운영 화면 탐색"
      description="헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다"
      toggle={{ checked: false, onCheckedChange: NOOP, disabled: true, describedBy: reasonId }}
    >
      <HelpText variant="note" className={styles.reason}>
        <span id={reasonId}>
          <Icon name="alert" size="sm" /> 이 서버에서 쓸 수 있는 브라우저가 없습니다. Chrome 을 설치하거나 서버에서{' '}
          <InlineCode>python -m playwright install chromium</InlineCode> 을 실행해 주세요.
        </span>
      </HelpText>
    </DiscoveryZone>
  );
}

/** 켜진 채 잠긴 묶음 — 흐리지 않는다. 사유는 시각 숨김 글자 + 마우스 툴팁(disabledReason) */
function LockedOn() {
  return (
    <DiscoveryZone
      title="Git 소스 분석"
      description="컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다"
      toggle={{ checked: true, onCheckedChange: NOOP, disabled: true, disabledReason: '이 묶음은 끌 수 없습니다' }}
    >
      <TextField label="저장소" placeholder="https://git.example.com/legacy/po-web.git" mono />
    </DiscoveryZone>
  );
}

export function DiscoveryZoneSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        입력 묶음 한 칸 — 1px 테두리 · --r-md · --surface 바탕. 스위치가 있으면 머리 줄 전체가 스위치 라벨이고(Switch heading) 설명은 스위치 폭만큼 들어간다 —
        760 이하의 들여쓰기 해제도 Switch가 맡는다. 꺼지면 바탕만 --surface-sub로 바뀌고 머리 아래 여백이 없어진다 — 흐리게 하지 않는다. 꺼졌을 때 칸을 남길지는
        쓰는 곳이 children으로 정한다. 스위치가 잠겨도 묶음 모양은 그대로다.
      </p>

      <h3 className={catalog.heading}>고정 묶음 — 스위치 없음(칸 셋 + FieldPair half)</h3>
      <FixedZone />

      <h3 className={catalog.heading}>켜고 끄는 묶음 — 켜짐(칸 + 안내)</h3>
      <GitZone initial />

      <h3 className={catalog.heading}>켜고 끄는 묶음 — 꺼짐(머리만)</h3>
      <CrawlZone initial={false} />

      <h3 className={catalog.heading}>스위치 잠김 — 보이는 사유 글(describedBy). 칸은 없고 안내만 남는다</h3>
      <LockedByNoBrowser />

      <h3 className={catalog.heading}>스위치 잠김 — 켜진 채 · 숨김 사유(disabledReason). 흐리지 않는다</h3>
      <LockedOn />
    </div>
  );
}

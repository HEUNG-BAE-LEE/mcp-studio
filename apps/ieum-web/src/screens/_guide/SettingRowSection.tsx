// 카탈로그 SettingRow 절 — 편집(선택 카드 · 스위치 · 잠긴 스위치 · 숫자 칸) · 읽기 전용 값(<b>) · 컨트롤 없는 줄 + 설명 아래 칸(단어 칩 ·
// 선택 카드 묶음 — 고르면 설명 자리에 입력) · 두 컨트롤(시각 + 선택). 첫 줄은 앞 형제로 정해진다 — 라벨 · 카드 다음의 첫 줄도 선이 없다
import { useId, useState } from 'react';
import { GroupLabel, Input, RadioCard, Select, SettingRow, Switch, TagInput } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SettingRowSection.module.css';

const NOOP = () => undefined;
const BANNED = ['삭제', '승인', '결재', '확정'] as const;

function EditPolicy() {
  const [mask, setMask] = useState(true);
  const [confirm, setConfirm] = useState(true);
  const [limit, setLimit] = useState('60');
  const labelId = useId();
  return (
    <div className={catalog.frame}>
      <GroupLabel id={labelId} size="sm" className={styles.label}>
        실행 방식
      </GroupLabel>
      <div role="group" aria-labelledby={labelId} className={styles.options}>
        <RadioCard
          variant="option"
          title="바로 실행"
          description="조회처럼 결과만 읽는 작업에 권장합니다"
          selected={!confirm}
          onSelect={() => setConfirm(false)}
        />
        <RadioCard
          variant="option"
          title="사용자 확인 후 실행"
          description="AI가 호출하기 전에 사용자에게 내용을 보여 줍니다"
          selected={confirm}
          onSelect={() => setConfirm(true)}
        />
      </div>
      <SettingRow
        title="개인정보 마스킹"
        description="전화번호, 이메일, 주민등록번호 일부를 가려서 전달"
        control={<Switch label="개인정보 마스킹" checked={mask} onCheckedChange={setMask} />}
      />
      <SettingRow
        title="응답 캐시"
        description="같은 요청은 10분 동안 원본을 다시 부르지 않음"
        control={<Switch label="응답 캐시" checked={false} onCheckedChange={NOOP} disabled />}
      />
      <SettingRow
        title="사용자당 호출 한도"
        description="1분 기준, 넘으면 AI에게 잠시 후 다시 시도하라고 알림"
        control={
          <Input variant="setting" type="number" min={1} max={600} value={limit} onValueChange={setLimit} aria-label="분당 호출 한도" />
        }
      />
    </div>
  );
}

function ReadOnlySummary() {
  return (
    <div className={catalog.frame}>
      <SettingRow title="사용자 확인 후 실행" description="쓰기 도구는 연결한 AI 앱이 사용자에게 먼저 묻습니다" control={<b>3개</b>} />
      <SettingRow title="개인정보 마스킹" description="전화번호, 이메일 등을 가려서 전달" control={<b>5개</b>} />
      <SettingRow title="호출 기록" description="모든 호출은 호출 로그에 남습니다" control={<b>항상</b>} />
      <SettingRow title="호출 한도" description="도구별 분당 한도를 액세스 키 단위로 적용" control={<b>도구별</b>} />
    </div>
  );
}

function StagingChoice() {
  const [staging, setStaging] = useState(true);
  const [stagingUrl, setStagingUrl] = useState('http://10.20.9.30:8080/po');
  const titleId = useId();
  return (
    <SettingRow
      title={<span id={titleId}>Git에서 찾은 쓰기 API 검증</span>}
      description="운영에서는 쓰기 API를 부르지 않습니다. 스테이징에서만 시험 값으로 호출합니다"
    >
      <div role="group" aria-labelledby={titleId}>
        <RadioCard
          variant="option"
          title="스테이징에서 검증"
          description="스테이징에 시험 데이터가 생길 수 있습니다"
          slot={<Input variant="setting" mono value={stagingUrl} onValueChange={setStagingUrl} aria-label="스테이징 주소" />}
          selected={staging}
          onSelect={() => setStaging(true)}
        />
        <RadioCard
          variant="option"
          title="검증하지 않음"
          description="미검증으로 표시하고 검토 때 직접 확인합니다"
          selected={!staging}
          onSelect={() => setStaging(false)}
        />
      </div>
    </SettingRow>
  );
}

function StartTime() {
  const [when, setWhen] = useState('at');
  const [time, setTime] = useState('02:00');
  return (
    <SettingRow
      title="탐색 시작 시각"
      description="운영 부하를 줄이려면 사용자가 적은 시간에 예약하세요. 서버가 켜져 있어야 시작합니다"
      control={
        <>
          {when === 'at' ? (
            <Input variant="setting" type="time" width="auto" value={time} onValueChange={setTime} aria-label="예약 시각" />
          ) : null}
          <Select variant="setting" value={when} onValueChange={setWhen} aria-label="탐색 시작 시각">
            <option value="now">지금 바로</option>
            <option value="at">시각 예약</option>
          </Select>
        </>
      }
    />
  );
}

function DiscoverySafety() {
  const [mask, setMask] = useState(true);
  const [banned, setBanned] = useState<readonly string[]>(BANNED);
  return (
    <div className={catalog.frame}>
      <SettingRow
        title="쓰기 요청 차단"
        description="화면 탐색 중 생기는 POST, PUT, DELETE 요청은 가로채서 형식만 기록하고 운영에 보내지 않습니다."
        control={<Switch label="쓰기 요청 차단" checked onCheckedChange={NOOP} disabled />}
      />
      <SettingRow title="누르지 않을 버튼" description="버튼 글자에 아래 단어가 들어 있으면 누르지 않고 건너뜁니다">
        <TagInput
          values={banned}
          onAdd={(word) => setBanned((list) => [...list, word])}
          onRemove={(word) => setBanned((list) => list.filter((item) => item !== word))}
          removeLabel={(word) => `${word} 빼기`}
          inputLabel="누르지 않을 단어 추가"
          placeholder="단어 추가"
        />
      </SettingRow>
      <StagingChoice />
      <SettingRow
        title="캡처 데이터 개인정보 마스킹"
        description="전화번호, 사업자번호, 주민번호, 카드번호, 이메일은 저장 전에 가립니다"
        control={<Switch label="개인정보 마스킹" checked={mask} onCheckedChange={setMask} />}
      />
      <StartTime />
    </div>
  );
}

export function SettingRowSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        글 열(제목 --fs-label · --fw-medium, 설명 --fs-caption · --text-faint)이 남은 폭을 차지하고 컨트롤은 위에 맞춘다. 이어진 줄 사이는 위 1px --line-divider,
        묶음의 첫 줄(앞 형제가 SettingRow가 아닌 줄)은 선이 없고 위 여백이 작다. control이 없으면 글 열만, children은 설명 아래 글 열 안에 놓인다.
        컨트롤이 둘이면(예약 시각 + 선택) 사이 --s-4-5다.
      </p>
      <h3 className={catalog.heading}>편집 — 라벨 · 선택 카드 다음 첫 줄 · 스위치 · 잠긴 스위치 · 숫자 칸</h3>
      <EditPolicy />
      <h3 className={catalog.heading}>읽기 전용 값</h3>
      <ReadOnlySummary />
      <h3 className={catalog.heading}>컨트롤 없는 줄 + 설명 아래 칸(단어 칩 · 선택 카드) · 두 컨트롤 — 묶음 이름은 제목(aria-labelledby)</h3>
      <DiscoverySafety />
    </div>
  );
}

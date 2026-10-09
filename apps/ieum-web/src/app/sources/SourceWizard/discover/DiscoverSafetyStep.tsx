// DiscoverSafetyStep — 탐색 모드 3단계 안전 설정(옛 wzDiscBody step 3 — js/menu/discovery.js:67-78)
// 위에서 아래로 설정 줄: 쓰기 요청 차단(늘 켜짐 · 못 바꿈) · 누르지 않을 버튼(단어 칩) · Git에서 찾은 쓰기 API 검증(선택 카드 둘 —
// 스테이징을 고르면 카드 안에 주소 칸) · 개인정보 마스킹 · 탐색 시작 시각(예약이면 시각 칸 + 선택) → 승인해 준 담당자 → 승인 상자
// - Git 소스 분석을 꺼 두면 "스테이징에서 검증" 카드를 잠근다(Git을 끄는 순간 스테이징 검증도 꺼진다 — discoverState toggleSource)
// - 스테이징 주소 칸은 누르는 버튼 밖이다(옛은 버튼 안 — 이식 기간 고침). 카드 묶음의 이름은 줄 제목이다(role="group" — 보이지 않는 보강)
// - 시작 시각 선택의 이름은 줄 제목 글자다(옛 select에는 이름이 없었다 — 보이지 않는 보강, 새 문구 없음)
// - 검증은 시작 버튼을 누를 때 경고 토스트로만(옛 :96-101)
import { useId } from 'react';
import { DISCOVERY } from '../../../../copy/discovery';
import { Field, Input, RadioCard, Select, SettingRow, Switch, TagInput } from '@/ui';
import { ApprovalCheck } from './ApprovalCheck';
import type { DiscoverState } from './discoverState';
import type { DiscoverActions } from './useDiscoverSlot';
import styles from './DiscoverSafetyStep.module.css';

const S = DISCOVERY.safety;

export type DiscoverSafetyStepProps = Readonly<{
  discover: DiscoverState;
  actions: DiscoverActions;
}>;

type PartProps = DiscoverSafetyStepProps;

/** 쓰기 API 검증 — 스테이징 · 검증하지 않음(옛 :71-73) */
function StagingRow({ discover, actions }: PartProps) {
  const titleId = useId();
  return (
    <SettingRow title={<span id={titleId}>{S.stg.title}</span>} description={S.stg.desc}>
      <div role="group" aria-labelledby={titleId}>
        <RadioCard
          variant="option"
          title={S.stg.on}
          description={S.stg.onHint}
          selected={discover.stg}
          onSelect={() => actions.setFlag('stg', true)}
          disabled={!discover.git}
          slot={
            <Input
              variant="setting"
              mono
              placeholder={S.stg.urlPlaceholder}
              aria-label={S.stg.urlAria}
              value={discover.stgUrl}
              onValueChange={(value) => actions.changeText('stgUrl', value)}
            />
          }
        />
        <RadioCard
          variant="option"
          title={S.stg.off}
          description={S.stg.offHint}
          selected={!discover.stg}
          onSelect={() => actions.setFlag('stg', false)}
        />
      </div>
    </SettingRow>
  );
}

/** 탐색 시작 시각 — 예약이면 시각 칸이 선택 앞에 온다(옛 :75-76) */
function WhenRow({ discover, actions }: PartProps) {
  const W = S.when;
  return (
    <SettingRow
      title={W.title}
      description={W.desc}
      control={
        <>
          {discover.when === 'at' ? (
            <Input
              variant="setting"
              type="time"
              width="auto"
              aria-label={W.timeAria}
              value={discover.startTime}
              onValueChange={(value) => actions.changeText('startTime', value)}
            />
          ) : null}
          <Select variant="setting" aria-label={W.title} value={discover.when} onValueChange={actions.selectWhen}>
            <option value="now">{W.now}</option>
            <option value="at">{W.at}</option>
          </Select>
        </>
      }
    />
  );
}

export function DiscoverSafetyStep({ discover, actions }: DiscoverSafetyStepProps) {
  return (
    <>
      <SettingRow
        title={S.block.title}
        description={S.block.desc}
        control={<Switch label={S.block.title} checked disabled onCheckedChange={() => undefined} />}
      />
      <SettingRow title={S.ban.title} description={S.ban.desc}>
        <TagInput
          values={discover.ban}
          onAdd={actions.addBan}
          onRemove={actions.removeBan}
          removeLabel={S.ban.removeAria}
          inputLabel={S.ban.addAria}
          placeholder={S.ban.addPlaceholder}
        />
      </SettingRow>
      <StagingRow discover={discover} actions={actions} />
      <SettingRow
        title={S.mask.title}
        description={S.mask.desc}
        control={<Switch label={S.mask.aria} checked={discover.mask} onCheckedChange={(on) => actions.setFlag('mask', on)} />}
      />
      <WhenRow discover={discover} actions={actions} />
      <Field label={S.owner.label} className={styles.owner}>
        {({ id }) => (
          <Input
            id={id}
            placeholder={S.owner.placeholder}
            value={discover.owner}
            onValueChange={(value) => actions.changeText('owner', value)}
          />
        )}
      </Field>
      <ApprovalCheck checked={discover.ok} onCheckedChange={(on) => actions.setFlag('ok', on)} />
    </>
  );
}

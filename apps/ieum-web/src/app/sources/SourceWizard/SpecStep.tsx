// SpecStep — 2단계 명세 불러오기(옛 wzBody step 2 — js/menu/sources.js:57-70). 모드마다 칸이 다르다:
// - 공공데이터(gov): 포털 API 라디오 목록 + 안내. 시스템 이름 칸이 없다(앞 모드에서 넣은 이름은 상태에 남아 그대로 간다 — 옛 그대로)
// - 호출 샘플(sample): 시스템 이름 · 요청 샘플(3줄) · 응답 샘플(6줄) · 안내
// - 그 밖(REST · SOAP): 시스템 이름 · 명세 URL · "또는" · 파일 상자 · 서버 주소. 자리표시 · 파일 안내는 SOAP만 다르고 나머지는 REST 글자
// 검증은 다음을 누를 때 한 번(wizardSteps validateStep) — 칸에 오류 표시를 두지 않는다
import type { GovApi } from '../../../api/types';
import { SOURCES } from '../../../copy/sources';
import { Field, FileDrop, HelpText, Input, RadioList, Textarea } from '@/ui';
import type { WizardActions } from './useWizardSession';
import type { WizardState } from './wizardState';
import shared from './wizard.module.css';
import styles from './SpecStep.module.css';

const SAMPLE_REQUEST_ROWS = 3;
const SAMPLE_RESPONSE_ROWS = 6;

type SpecActions = Pick<WizardActions, 'changeText' | 'selectGov' | 'selectFile'>;

export type SpecStepProps = Readonly<{
  state: WizardState;
  govApis: readonly GovApi[];
  actions: SpecActions;
}>;

type PartProps = Readonly<{ state: WizardState; actions: SpecActions }>;

/** 시스템 이름(옛 :57) */
function NameField({ state, actions }: PartProps) {
  return (
    <Field label={SOURCES.spec.name}>
      {({ id }) => (
        <Input
          id={id}
          placeholder={SOURCES.spec.namePlaceholder}
          value={state.name}
          onValueChange={(value) => actions.changeText('name', value)}
        />
      )}
    </Field>
  );
}

/** 공공데이터 — 포털 API 목록 + 안내(옛 :59-61) */
function GovSpec({ state, govApis, actions }: PartProps & Readonly<{ govApis: readonly GovApi[] }>) {
  return (
    <>
      <RadioList
        label={SOURCES.spec.govLabel}
        items={govApis.map(([value, title, description]) => ({ value, title, description }))}
        value={state.gov ?? ''}
        onValueChange={actions.selectGov}
      />
      <HelpText className={shared.hint}>{SOURCES.spec.govHint}</HelpText>
    </>
  );
}

/** 호출 샘플 — 이름 · 요청 · 응답 · 안내(옛 :62-64) */
function SampleSpec({ state, actions }: PartProps) {
  return (
    <>
      <NameField state={state} actions={actions} />
      <Field label={SOURCES.spec.sampleReq} align="top">
        {({ id }) => (
          <Textarea
            id={id}
            rows={SAMPLE_REQUEST_ROWS}
            placeholder={SOURCES.spec.sampleReqPlaceholder}
            value={state.sampleRequest}
            onValueChange={(value) => actions.changeText('sampleRequest', value)}
          />
        )}
      </Field>
      <Field label={SOURCES.spec.sampleRes} align="top">
        {({ id }) => (
          <Textarea
            id={id}
            rows={SAMPLE_RESPONSE_ROWS}
            placeholder={SOURCES.spec.sampleResPlaceholder}
            value={state.sampleResponse}
            onValueChange={(value) => actions.changeText('sampleResponse', value)}
          />
        )}
      </Field>
      <HelpText className={shared.hint}>{SOURCES.spec.sampleHint}</HelpText>
    </>
  );
}

/** REST · SOAP — 이름 · 명세 URL · 또는 · 파일 · 서버 주소(옛 :65-69) */
function FileSpec({ state, actions }: PartProps) {
  const kind = state.mode === 'soap' ? 'soap' : 'rest';
  return (
    <>
      <NameField state={state} actions={actions} />
      <Field label={SOURCES.spec.url}>
        {({ id }) => (
          <Input
            id={id}
            placeholder={SOURCES.spec.urlPlaceholder[kind]}
            value={state.url}
            onValueChange={(value) => actions.changeText('url', value)}
          />
        )}
      </Field>
      <div className={styles.or}>{SOURCES.spec.or}</div>
      <FileDrop
        label={SOURCES.spec.fileLabel}
        title={state.fileName ? SOURCES.spec.dropDone(state.fileName) : SOURCES.spec.drop}
        description={SOURCES.spec.dropHint[kind]}
        onSelect={actions.selectFile}
        resetKey={state.fileReads}
      />
      <Field label={SOURCES.spec.base} className={styles.base}>
        {({ id }) => (
          <Input
            id={id}
            mono
            placeholder={SOURCES.spec.basePlaceholder[kind]}
            value={state.base}
            onValueChange={(value) => actions.changeText('base', value)}
          />
        )}
      </Field>
    </>
  );
}

export function SpecStep({ state, govApis, actions }: SpecStepProps) {
  if (state.mode === 'gov') return <GovSpec state={state} govApis={govApis} actions={actions} />;
  if (state.mode === 'sample') return <SampleSpec state={state} actions={actions} />;
  return <FileSpec state={state} actions={actions} />;
}

// DiscoverTargetStep — 탐색 모드 2단계 탐색 대상(옛 wzDiscBody step 2 — js/menu/discovery.js:41-66)
// 위에서 아래로: 시연 안내(서버에 시연 값이 있을 때만 — "시연용 값 채우기") · 시스템 이름 · 운영 접속 정보 묶음(주소 · 로그인 페이지 · 계정 두 칸) ·
// Git 소스 분석 묶음(스위치 — 켜면 저장소 · 브랜치 · 토큰 · 프레임워크 · 안내) · 운영 화면 탐색 묶음(스위치 — 켜면 범위 · 제외 · 조회용 POST · 최대 화면 수 · 안내)
// - 브라우저가 없는 서버는 화면 탐색 스위치를 잠그고 설치 안내를 늘 보인다 — 잠긴 사유는 그 안내다(aria-describedby, 보이는 차이 0)
// - 서버에 git이 없으면 Git 안내 뒤에 굵은 문장을 붙인다
// - 꺼진 묶음은 칸을 그리지 않는다(옛 그대로 — 입력 값은 상태에 남는다)
// - 칸에 오류 모양을 두지 않는다 — 검증은 "다음"을 누를 때 경고 토스트로만(옛 :91-95)
// - 입력은 글자마다 상태에 쌓는다(다시 그리지 않아 한글 조합 · 포커스가 이어진다). 최대 화면 수는 입력 그대로 문자열로 둔다
import { useId } from 'react';
import type { DiscoveryResponse } from '../../../../api/types';
import { DISCOVERY } from '../../../../copy/discovery';
import {
  DiscoveryZone,
  Field,
  FieldNote,
  FieldPair,
  HelpText,
  Icon,
  Input,
  LinkButton,
  Notice,
  Select,
} from '@/ui';
import { CodeText, EmphasisText } from '../../../discovery/CopyParts';
import type { DiscoverState, DiscoverTextField } from './discoverState';
import type { DiscoverActions } from './useDiscoverSlot';
import styles from './DiscoverTargetStep.module.css';

const W = DISCOVERY.wizard;

export type DiscoverTargetStepProps = Readonly<{
  discover: DiscoverState;
  overview: DiscoveryResponse;
  actions: DiscoverActions;
}>;

type TextFieldProps = Readonly<{
  label: string;
  field: DiscoverTextField;
  discover: DiscoverState;
  actions: DiscoverActions;
  placeholder?: string;
  mono?: boolean;
}>;

/** 라벨 + 글자 칸 하나 */
function TextField({ label, field, discover, actions, placeholder, mono = false }: TextFieldProps) {
  return (
    <Field label={label}>
      {({ id }) => (
        <Input
          id={id}
          mono={mono}
          placeholder={placeholder}
          value={discover[field]}
          onValueChange={(value) => actions.changeText(field, value)}
        />
      )}
    </Field>
  );
}

type PartProps = Readonly<{ discover: DiscoverState; overview: DiscoveryResponse; actions: DiscoverActions }>;

/** 운영 접속 정보(옛 :44-49) — 늘 켜진 묶음 */
function ProdZone({ discover, actions }: PartProps) {
  const P = W.prod;
  return (
    <DiscoveryZone title={P.title} description={P.desc}>
      <TextField label={P.base} field="base" mono placeholder={P.basePlaceholder} discover={discover} actions={actions} />
      <TextField label={P.start} field="start" mono placeholder={P.startPlaceholder} discover={discover} actions={actions} />
      <Field label={P.account}>
        {({ id }) => (
          <FieldPair variant="half">
            {[
              <Input
                key="account"
                id={id}
                placeholder={P.accountPlaceholder}
                aria-label={P.accountPlaceholder}
                value={discover.account}
                onValueChange={(value) => actions.changeText('account', value)}
              />,
              <Input
                key="password"
                type="password"
                placeholder={P.passwordPlaceholder}
                aria-label={P.passwordPlaceholder}
                value={discover.password}
                onValueChange={(value) => actions.changeText('password', value)}
              />,
            ]}
          </FieldPair>
        )}
      </Field>
    </DiscoveryZone>
  );
}

/** Git 소스 분석(옛 :50-57) */
function GitZone({ discover, overview, actions }: PartProps) {
  const G = W.git;
  const frameworks = overview.defaults.frameworks.length > 0 ? overview.defaults.frameworks : ['auto'];
  return (
    <DiscoveryZone
      title={G.title}
      description={G.desc}
      toggle={{ checked: discover.git, onCheckedChange: (on) => actions.toggleSource('git', on) }}
    >
      {discover.git ? (
        <>
          <TextField label={G.repo} field="repo" mono placeholder={G.repoPlaceholder} discover={discover} actions={actions} />
          <TextField label={G.branch} field="branch" mono placeholder={G.branchPlaceholder} discover={discover} actions={actions} />
          <Field label={G.token}>
            {({ id }) => (
              <Input
                id={id}
                type="password"
                placeholder={G.tokenPlaceholder}
                aria-label={G.tokenAria}
                value={discover.token}
                onValueChange={(value) => actions.changeText('token', value)}
              />
            )}
          </Field>
          <Field label={G.framework}>
            {({ id }) => (
              <Select id={id} variant="form" value={discover.framework} onValueChange={actions.selectFramework}>
                {frameworks.map((framework) => (
                  <option key={framework} value={framework}>
                    {DISCOVERY.frameworkLabel(framework)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <FieldNote>
            {G.note}
            {overview.capabilities.git === false ? <EmphasisText parts={G.noGit} /> : null}
          </FieldNote>
        </>
      ) : null}
    </DiscoveryZone>
  );
}

/** 운영 화면 탐색(옛 :58-66) — 브라우저가 없으면 스위치를 잠그고 설치 안내 */
function CrawlZone({ discover, overview, actions }: PartProps) {
  const C = W.crawl;
  const noBrowserId = useId();
  const hasBrowser = Boolean(overview.capabilities.browser);
  return (
    <DiscoveryZone
      title={C.title}
      description={C.desc}
      toggle={{
        checked: discover.crawl,
        onCheckedChange: (on) => actions.toggleSource('crawl', on),
        disabled: !hasBrowser,
        describedBy: hasBrowser ? undefined : noBrowserId,
      }}
    >
      {hasBrowser ? null : (
        <HelpText variant="note" className={styles.noBrowser}>
          <span id={noBrowserId}>
            <Icon name="alert" size="sm" /> <CodeText parts={C.noBrowser} />
          </span>
        </HelpText>
      )}
      {discover.crawl ? (
        <>
          <TextField label={C.scope} field="scope" mono placeholder={C.scopePlaceholder} discover={discover} actions={actions} />
          <TextField label={C.exclude} field="exclude" mono placeholder={C.excludePlaceholder} discover={discover} actions={actions} />
          <TextField label={C.readPost} field="readPost" mono placeholder={C.readPostPlaceholder} discover={discover} actions={actions} />
          <Field label={C.maxPages}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                width="narrow"
                value={discover.maxPages}
                onValueChange={(value) => actions.changeText('maxPages', value)}
              />
            )}
          </Field>
          <FieldNote>
            <CodeText parts={C.note} />
          </FieldNote>
        </>
      ) : null}
    </DiscoveryZone>
  );
}

export function DiscoverTargetStep({ discover, overview, actions }: DiscoverTargetStepProps) {
  return (
    <>
      {overview.demo !== null ? (
        <Notice className={styles.demo}>
          {W.demoNotice}{' '}
          <LinkButton onClick={actions.fillDemo}>{W.demoFill}</LinkButton>
        </Notice>
      ) : null}
      <TextField label={W.name.label} field="name" placeholder={W.name.placeholder} discover={discover} actions={actions} />
      <ProdZone discover={discover} overview={overview} actions={actions} />
      <GitZone discover={discover} overview={overview} actions={actions} />
      <CrawlZone discover={discover} overview={overview} actions={actions} />
    </>
  );
}

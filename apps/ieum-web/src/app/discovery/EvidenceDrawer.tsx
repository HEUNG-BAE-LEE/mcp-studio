// EvidenceDrawer — 탐색 근거 드로어의 내용(옛 discEvidenceOpen — js/menu/discovery.js:326-356). Drawer는 드로어 칸(app/LayerHost)이 하나만 그리고
// 이 파일은 그 Drawer에 넣을 머리 · 본문 · 발을 만든다. 여는 길은 둘 — 결과 표 행(app/layers openEvidenceDrawer — 선택 토글 있음),
// 변환 스튜디오 "탐색 근거 보기"(app/discovery/openEvidence — 받고 나서 엶, 토글 없음)
//
// ── 쓰는 곳 계약 ──
// evidenceDrawerOf(layer, close) → Drawer prop(open · onOpenChange 빼고)
//   layer — 드로어 칸의 근거 층(연 순간의 API 값 · 작업 설정 · 선택). 열린 동안 바뀌지 않는다
//   close — 드로어 칸 비우기. 발 "닫기"와 선택 토글 뒤에 부른다
// - 머리: 위 "탐색 근거" · 제목 "{메서드} {경로}"(고정폭) · 설명 "{제목}, 도구 이름 제안 {도구}"(도구가 있을 때만, 도구 이름은 고정폭)
// - 본문(위에서 아래로): 요약 여섯 칸 → 추천 이유(색은 추천 — 등록 추천 기본 · 확인 필요 경고 · 그 밖 흐림, 아이콘은 늘 info) → 검증 설명(server) →
//   소스 근거(파일:줄 · 코드 · 매퍼 문장, 없으면 빈 상자) → 트래픽 근거(캡처한 요청 · 응답 · 마스킹 안내 / 차단 / 파일 응답, 없으면 빈 상자) →
//   파라미터 추론(있을 때만)
// - 코드 상자의 이름은 그 위 소절 제목 · 캡션이다(aria-labelledby — 새 문구 없음). 근거 조각은 java만 강조하고 나머지는 글자 그대로(codeLangOf)
// - 발: 왼쪽 "근거가 두 가지라…" · "한 가지라…"(범위 밖도 "한 가지라" — 이식 기간 보존), 오른쪽 선택 토글(연 쪽이 허락했을 때만) · "닫기"
// - 선택 토글은 층의 onToggle(결과 화면의 선택 바꾸기)을 부르고 드로어를 닫는다 — 포커스는 연 행으로 돌아간다(Drawer 계약 · 옛 :399)
// - 열린 채 다른 근거를 열면 contentKey가 바뀌어 다시 연 것으로 친다(첫 포커스 ✕ · 본문 맨 위 — 옛 openDrawer 재호출)
import { useId } from 'react';
import type { ApiParam, DiscoveryApi, JobOpts } from '../../api/types';
import { DISCOVERY } from '../../copy/discovery';
import { NONE } from '../../copy/format';
import {
  Button,
  CodeBlock,
  CompactTable,
  CompactTableCell,
  CompactTableHeadCell,
  CompactTableRow,
  CompareCaption,
  EmptyState,
  HelpText,
  KeyValueGrid,
  Notice,
  RuleChip,
  SectionTitle,
  Tag,
  type DrawerProps,
  type KeyValueItem,
} from '@/ui';
import type { EvidenceLayer } from '../layers';
import { httpCode } from '../trace/httpText';
import { ruleChip } from '../trace/ruleChip';
import { CodeText } from './CopyParts';
import { RecommendChip, VerifyChip } from './DiscoveryChips';
import { codeLangOf, isBothEvidence, observedOf, recommendNoticeToneOf, sourceTypeOf } from './evidence';
import styles from './EvidenceDrawer.module.css';

const K = DISCOVERY.evidence;

export type EvidenceDrawerContent = Omit<DrawerProps, 'open' | 'onOpenChange'>;

/** 머리 설명 — 제목 + 도구 이름 제안(옛 :329) */
function EvidenceDescription({ api }: Readonly<{ api: DiscoveryApi }>) {
  return (
    <>
      {api.title}
      {api.tool ? (
        <>
          {K.toolPrefix}
          <span className={styles.mono}>{api.tool}</span>
        </>
      ) : null}
    </>
  );
}

/** 요약 여섯 칸(옛 :331-338) */
const summaryOf = (api: DiscoveryApi): readonly KeyValueItem[] => [
  { label: K.sum.ev, value: K.evLabel(api.ev) },
  { label: K.sum.verify, value: <VerifyChip verify={api.verify} /> },
  { label: K.sum.rec, value: <RecommendChip rec={api.rec} /> },
  { label: K.sum.mode, value: K.mode(api.mode, api.src?.sql ?? null) },
  { label: K.sum.samples, value: api.tr ? K.samples(api.tr.samples) : K.noSamples },
  { label: K.sum.screen, value: api.tr ? api.tr.screen : NONE, small: true },
];

/** 소스 근거(옛 :341-343) */
function SourceSection({ api, opts }: Readonly<{ api: DiscoveryApi; opts: JobOpts }>) {
  const titleId = useId();
  const { src } = api;
  return (
    <>
      <SectionTitle
        level="sub"
        icon="code"
        title={<span id={titleId}>{K.srcTitle}</span>}
        description={src ? K.location(src.file, src.line) : undefined}
        descriptionMono
      />
      {src ? (
        <>
          <CodeBlock code={{ text: src.snippet, lang: codeLangOf(src.lang) }} labelledBy={titleId} />
          <HelpText variant="note">
            {src.mapper ? <CodeText parts={K.mapperNote(src.mapper, src.sql, api.mode)} /> : K.noMapper}
          </HelpText>
        </>
      ) : (
        <EmptyState kind="section" container="panel" size="sm">
          {opts.git ? K.noSrc : K.noGit}
        </EmptyState>
      )}
    </>
  );
}

/** 캡처한 요청 아래 — 응답(+ 마스킹 안내) · 차단 · 파일 응답 중 하나(옛 :346-348) */
function TrafficResult({ tr, opts }: Readonly<{ tr: NonNullable<DiscoveryApi['tr']>; opts: JobOpts }>) {
  const resId = useId();
  if (tr.res) {
    return (
      <>
        <CompareCaption tone="traffic" id={resId} className={styles.secondCaption}>
          {K.tr.res}
        </CompareCaption>
        <CodeBlock code={httpCode(tr.res)} labelledBy={resId} />
        {opts.mask ? <HelpText variant="note">{K.tr.masked}</HelpText> : null}
      </>
    );
  }
  if (tr.blocked) {
    return (
      <Notice tone="danger" icon="shield" className={styles.trafficNotice}>
        {K.tr.blocked}
      </Notice>
    );
  }
  if (tr.file) {
    return (
      <Notice tone="warn" icon="alert" className={styles.trafficNotice}>
        {K.tr.file}
      </Notice>
    );
  }
  return null;
}

/** 트래픽 근거(옛 :344-349) */
function TrafficSection({ api, opts }: Readonly<{ api: DiscoveryApi; opts: JobOpts }>) {
  const reqId = useId();
  const { tr } = api;
  return (
    <>
      <SectionTitle level="sub" icon="globe" title={K.trTitle} />
      {tr ? (
        <>
          <CompareCaption tone="traffic" id={reqId} description={K.tr.reqSample(tr.samples)}>
            {K.tr.req}
          </CompareCaption>
          <CodeBlock code={httpCode(tr.req)} labelledBy={reqId} />
          <TrafficResult tr={tr} opts={opts} />
        </>
      ) : (
        <EmptyState kind="section" container="panel" size="sm">
          {opts.crawl ? K.noTr : K.noCrawl}
        </EmptyState>
      )}
    </>
  );
}

/** 파라미터 추론 한 줄(옛 :351) — 관찰 값 칩은 값만, 규칙 칩은 아는 규칙만 */
function ParamRow({ param, hasSource }: Readonly<{ param: ApiParam; hasSource: boolean }>) {
  const sourceType = sourceTypeOf(param, hasSource);
  const observed = observedOf(param);
  const chip = ruleChip(param.rule);
  return (
    <CompactTableRow>
      <CompactTableCell>
        <div className={styles.field}>{param.o}</div>
      </CompactTableCell>
      <CompactTableCell className={styles.description}>
        {sourceType ?? <span className={styles.faint}>{K.params.noSrc}</span>}
      </CompactTableCell>
      <CompactTableCell>
        <div className={styles.chips}>
          {observed.length > 0 ? (
            observed.map((value, index) => (
              // 관찰 값은 같은 값이 겹칠 수 있다 — 서버 순서 그대로라 자리를 키로 쓴다
              <Tag key={index} tone="mute" variant="value" size="md">
                {String(value ?? '')}
              </Tag>
            ))
          ) : (
            <Tag tone="mute" variant="value-empty" size="md">
              {K.params.noObs}
            </Tag>
          )}
        </div>
      </CompactTableCell>
      <CompactTableCell>
        {param.a ? (
          <>
            <div className={styles.field}>{param.a}</div>
            <div className={styles.type}>{param.at}</div>
          </>
        ) : (
          <div className={styles.type}>{K.params.hidden}</div>
        )}
        {chip ? <RuleChip label={chip.label} category={chip.category} description={chip.description} /> : null}
      </CompactTableCell>
    </CompactTableRow>
  );
}

const PARAM_HEAD = (
  <>
    <CompactTableHeadCell>{K.params.columns.origin}</CompactTableHeadCell>
    <CompactTableHeadCell>{K.params.columns.sourceType}</CompactTableHeadCell>
    <CompactTableHeadCell>{K.params.columns.observed}</CompactTableHeadCell>
    <CompactTableHeadCell>{K.params.columns.inferred}</CompactTableHeadCell>
  </>
);

/** 파라미터 추론(옛 :350-352) — 있을 때만 */
function ParamsSection({ api }: Readonly<{ api: DiscoveryApi }>) {
  if (api.params.length === 0) return null;
  return (
    <>
      <SectionTitle level="sub" title={K.params.title} />
      <CompactTable minWidth={560} head={PARAM_HEAD}>
        {api.params.map((param, index) => (
          <ParamRow key={`${index}:${param.o}`} param={param} hasSource={api.src !== null} />
        ))}
      </CompactTable>
    </>
  );
}

/** 본문 — 근거 층마다 새로 마운트된다(쓰는 곳이 key = attemptId) */
function EvidenceBody({ api, opts }: Readonly<{ api: DiscoveryApi; opts: JobOpts }>) {
  return (
    <>
      <KeyValueGrid items={summaryOf(api)} className={styles.summary} />
      {api.recNote ? (
        <Notice tone={recommendNoticeToneOf(api.rec)} icon="info" className={styles.note}>
          {api.recNote}
        </Notice>
      ) : null}
      {api.verify.note ? (
        <Notice icon="server" className={styles.note}>
          {api.verify.note}
        </Notice>
      ) : null}
      <SourceSection api={api} opts={opts} />
      <TrafficSection api={api} opts={opts} />
      <ParamsSection api={api} />
    </>
  );
}

/** 발 오른쪽 — 선택 토글(허락했을 때만) · 닫기(옛 :355) */
function EvidenceFooter({ layer, close }: Readonly<{ layer: EvidenceLayer; close: () => void }>) {
  const toggle = () => {
    layer.onToggle?.();
    close();
  };
  return (
    <>
      {layer.canSelect ? <Button onClick={toggle}>{layer.isSelected ? K.foot.remove : K.foot.add}</Button> : null}
      <Button variant="primary" onClick={close}>
        {K.foot.close}
      </Button>
    </>
  );
}

export function evidenceDrawerOf(layer: EvidenceLayer, close: () => void): EvidenceDrawerContent {
  const { api } = layer;
  return {
    overline: K.eyebrow,
    title: K.title(api.m, api.path),
    titleMono: true,
    description: <EvidenceDescription api={api} />,
    contentKey: `evidence:${layer.attemptId}`,
    footerInfo: isBothEvidence(api.ev) ? K.foot.both : K.foot.one,
    footer: <EvidenceFooter layer={layer} close={close} />,
    children: <EvidenceBody key={layer.attemptId} api={api} opts={layer.opts} />,
  };
}

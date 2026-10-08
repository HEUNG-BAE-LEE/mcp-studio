// 대시보드 "확인이 필요한 항목"을 만드는 순수 함수 — 옛 js/menu/dashboard.js:50-56 순서 그대로
// 인증 만료 원본별 → 명세 변경 도구별 → 쓰기 검토 대기(한 건) → 샘플 추론(한 건). 그리는 일은 AlertsBox가 한다
// 옛은 본문을 HTML 문자열로 이었다 — 여기서는 글자와 코드 조각의 배열로 둔다(React가 이스케이프한다)
import type { Source, Tool } from '../../api/types';
import { DASH } from '../../copy/dashboard-logs';
import { sourceNameOf } from './sourceName';

export type AlertTone = 'danger' | 'warn' | 'info';

/** 본문 조각 — 글자 또는 코드 서식으로 보일 식별자 */
export type AlertPart = string | Readonly<{ code: string }>;

/** 줄 오른쪽 버튼이 하는 일 — reauth는 재인증 층, tool은 그 도구를 연 스튜디오(filter가 있으면 도구 필터를 건다) */
export type AlertTarget =
  | Readonly<{ kind: 'reauth'; sourceId: string }>
  | Readonly<{ kind: 'tool'; toolId: string; filter?: 'review' }>;

export type DashboardAlert = Readonly<{
  key: string;
  tone: AlertTone;
  title: string;
  body: readonly AlertPart[];
  actionLabel: string;
  target: AlertTarget;
}>;

const CODE_SEPARATOR = ' ';

const authAlerts = (sources: readonly Source[]): readonly DashboardAlert[] =>
  sources
    .filter((s) => s.err)
    .map((s) => ({
      key: `auth:${s.id}`,
      tone: 'danger',
      title: DASH.alerts.auth.title(s.name),
      body: [DASH.alerts.auth.body],
      actionLabel: DASH.alerts.auth.action,
      target: { kind: 'reauth', sourceId: s.id },
    }));

/** 풀리지 않은 응답 필드 변경이 있으면 그 필드를, 없으면 서버가 남긴 문장을 그대로 보인다 */
function driftBody(tool: Tool): readonly AlertPart[] {
  const field = tool.res.find((r) => r.drift && !r.fixed);
  if (!field) return [{ code: tool.id }, `${CODE_SEPARATOR}${tool.driftMsg ?? ''}`];
  const { fieldPre, fieldArrow, fieldPost } = DASH.alerts.drift;
  return [{ code: tool.id }, fieldPre, { code: field.o }, fieldArrow, { code: field.newO ?? '' }, fieldPost];
}

const driftAlerts = (sources: readonly Source[], tools: readonly Tool[]): readonly DashboardAlert[] =>
  tools
    .filter((t) => t.status === 'drift')
    .map((t) => ({
      key: `drift:${t.id}`,
      tone: 'warn',
      title: DASH.alerts.drift.title(sourceNameOf(sources, t.src)),
      body: driftBody(t),
      actionLabel: DASH.alerts.drift.action,
      target: { kind: 'tool', toolId: t.id },
    }));

const writeReviewAlerts = (tools: readonly Tool[]): readonly DashboardAlert[] => {
  const pending = tools.filter((t) => t.status === 'review' && t.mode === 'write');
  const [first] = pending;
  if (!first) return [];
  return [
    {
      key: 'write-review',
      tone: 'warn',
      title: DASH.alerts.writeReview.title(pending.length),
      body: pending.flatMap((t, index): readonly AlertPart[] =>
        index === 0 ? [{ code: t.id }] : [CODE_SEPARATOR, { code: t.id }],
      ),
      actionLabel: DASH.alerts.writeReview.action,
      target: { kind: 'tool', toolId: first.id, filter: 'review' },
    },
  ];
};

const guessAlerts = (sources: readonly Source[], tools: readonly Tool[]): readonly DashboardAlert[] => {
  const guessed = tools.filter((t) => t.status === 'review' && t.guess);
  const [first] = guessed;
  if (!first) return [];
  return [
    {
      key: 'guess',
      tone: 'info',
      title: DASH.alerts.guess.title(sourceNameOf(sources, first.src)),
      body: [DASH.alerts.guess.body(guessed.length)],
      actionLabel: DASH.alerts.guess.action,
      target: { kind: 'tool', toolId: first.id },
    },
  ];
};

/** tools는 도구 전체(원본 순서 그대로). 알림이 없으면 빈 배열 */
export const buildDashboardAlerts = (sources: readonly Source[], tools: readonly Tool[]): readonly DashboardAlert[] => [
  ...authAlerts(sources),
  ...driftAlerts(sources, tools),
  ...writeReviewAlerts(tools),
  ...guessAlerts(sources, tools),
];

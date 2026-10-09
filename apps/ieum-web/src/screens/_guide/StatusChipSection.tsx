// 카탈로그 StatusChip 절 — 톤 다섯 × 크기 둘, 자원별 전 값(statusOf)과 그리는 곳, 모르는 값 폴백(값 그대로 · mute)
import { STATUS_VALUES, statusOf, type StatusResource } from '../../copy/status';
import { StatusChip, type StatusChipSize, type StatusTone } from '../../ui';
import catalog from './catalog.module.css';

const TONES: readonly StatusTone[] = ['ok', 'warn', 'danger', 'info', 'mute'];
const SIZES: readonly StatusChipSize[] = ['md', 'sm'];
const RESOURCES = Object.keys(STATUS_VALUES) as StatusResource[];
const WIRED_BY_SCREEN = '쓰는 화면이 statusOf + StatusChip으로 잇는다';
/** 자원마다 칩을 그리는 곳 — 자원이 늘면 이 표도 늘려야 타입 검사가 잡는다 */
const DRAWN_BY: Readonly<Record<StatusResource, string>> = {
  log: WIRED_BY_SCREEN,
  source: 'SourceStatus',
  tool: 'ToolStatusChip',
  job: 'JobStatusChip',
  recommend: WIRED_BY_SCREEN,
  toolset: WIRED_BY_SCREEN,
  key: WIRED_BY_SCREEN,
};
/** 목록에 두지 않는 값 — 서버가 내지 않거나(wait · busy · queued), 서버가 초안에 주는 none처럼 쓰는 곳이 draft로 바꿔 찾는 값. 오면 모르는 값 폴백이 맡는다(DESIGN Copy `상태 값`) */
const UNKNOWN_VALUES: readonly (readonly [StatusResource, string])[] = [
  ['log', 'wait'],
  ['source', 'busy'],
  ['job', 'queued'],
  ['toolset', 'none'],
];

export function StatusChipSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        점 + 글자. 뜻은 글자가 전하고 점은 장식이다. 라벨 · tone은 statusOf(resource, value)가 찾는다 — 모르는 값은 값 그대로
        + mute이고 개발 콘솔에 한 번 경고한다. 네트워크 기록 태그는 flag 색이 더해져 StatusTone 밖이라 statusOf가 아니라 netTagOf가
        찾고, 이 부품이 그리지 않는다. 배포 묶음(toolset)의 값은 초안이면 draft, 아니면 서버 상태이고 고르는 것은 쓰는 곳이다.
      </p>
      <h3 className={catalog.heading}>tone × size</h3>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th />
              {TONES.map((tone) => (
                <th key={tone}>{tone}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size}>
                <th>{size}</th>
                {TONES.map((tone) => (
                  <td key={tone}>
                    <StatusChip tone={tone} size={size}>
                      {tone}
                    </StatusChip>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className={catalog.heading}>자원별 전 값</h3>
      {RESOURCES.map((resource) => (
        <div key={resource} className={catalog.row}>
          <code className={catalog.token}>{resource}</code>
          {STATUS_VALUES[resource].map((value) => {
            const { label, tone } = statusOf(resource, value);
            return (
              <StatusChip key={value} tone={tone}>
                {label}
              </StatusChip>
            );
          })}
          <span className={catalog.note}>{DRAWN_BY[resource]}</span>
        </div>
      ))}
      <h3 className={catalog.heading}>모르는 값</h3>
      {UNKNOWN_VALUES.map(([resource, value]) => {
        const { label, tone } = statusOf(resource, value);
        return (
          <div key={`${resource}:${value}`} className={catalog.row}>
            <code className={catalog.token}>{resource}</code>
            <StatusChip tone={tone}>{label}</StatusChip>
          </div>
        );
      })}
    </div>
  );
}

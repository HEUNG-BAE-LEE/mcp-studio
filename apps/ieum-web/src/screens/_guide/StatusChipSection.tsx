// 카탈로그 StatusChip 절 — 톤 다섯 × 크기 둘, 자원별 전 값(statusOf), 모르는 값 폴백(값 그대로 · mute)
import { STATUS_VALUES, statusOf, type StatusResource } from '../../copy/status';
import { StatusChip, type StatusChipSize, type StatusTone } from '../../ui';
import catalog from './catalog.module.css';

const TONES: readonly StatusTone[] = ['ok', 'warn', 'danger', 'info', 'mute'];
const SIZES: readonly StatusChipSize[] = ['md', 'sm'];
const RESOURCES = Object.keys(STATUS_VALUES) as StatusResource[];
const UNKNOWN_VALUE = 'busy';

export function StatusChipSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        점 + 글자. 뜻은 글자가 전하고 점은 장식이다. 라벨 · tone은 statusOf(resource, value)가 찾는다 — 모르는 값은 값 그대로
        + mute이고 개발 콘솔에 한 번 경고한다.
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
        </div>
      ))}
      <h3 className={catalog.heading}>모르는 값</h3>
      <div className={catalog.row}>
        <StatusChip tone={statusOf('source', UNKNOWN_VALUE).tone}>{statusOf('source', UNKNOWN_VALUE).label}</StatusChip>
      </div>
    </div>
  );
}

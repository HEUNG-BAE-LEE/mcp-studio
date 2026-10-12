// 카탈로그 SourceStatus 절 — 상태 값 넷 + 모르는 값(busy) × variant(dot · chip)
import { STATUS_VALUES } from '../../copy/status';
import { SourceStatus, type SourceStatusVariant } from '../../ui';
import catalog from './catalog.module.css';

const VARIANTS: readonly SourceStatusVariant[] = ['dot', 'chip'];
const UNKNOWN_VALUE = 'busy';
const VALUES: readonly string[] = [...STATUS_VALUES.source, UNKNOWN_VALUE];

export function SourceStatusSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        statusOf('source', status)로 라벨 · tone을 찾는다. dot은 구조도 노드의 점(글자는 시각 숨김), chip은 원본 목록의
        칩이다. 서버가 내지 않는 busy는 모르는 값 폴백이다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th>status</th>
              {VARIANTS.map((variant) => (
                <th key={variant}>{variant}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VALUES.map((value) => (
              <tr key={value}>
                <th>{value}</th>
                {VARIANTS.map((variant) => (
                  <td key={variant}>
                    <SourceStatus status={value} variant={variant} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

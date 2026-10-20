// 카탈로그 JobStatusChip 절 — 상태 값 일곱 + 모르는 값(queued) × size(md · sm)
import { STATUS_VALUES } from '../../copy/status';
import { JobStatusChip, type StatusChipSize } from '../../ui';
import catalog from './catalog.module.css';

const SIZES: readonly StatusChipSize[] = ['md', 'sm'];
const UNKNOWN_VALUE = 'queued';
const VALUES: readonly string[] = [...STATUS_VALUES.job, UNKNOWN_VALUE];

export function JobStatusChipSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        statusOf('job', status)로 라벨 · tone을 찾는다. md는 작업 표 칸 · 작업 화면 머리, sm은 목록 항목 안 축소다. 서버가 내지 않는
        queued는 모르는 값 폴백(값 그대로 · mute)이다. 예약 시각 같은 칩 곁 글은 쓰는 곳이 붙인다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th>status</th>
              {SIZES.map((size) => (
                <th key={size}>{size}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VALUES.map((value) => (
              <tr key={value}>
                <th>{value}</th>
                {SIZES.map((size) => (
                  <td key={size}>
                    <JobStatusChip status={value} size={size} />
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

// 카탈로그 ToolStatusChip 절 — 상태 값 넷 + 모르는 값 × size(md · sm)
import { STATUS_VALUES } from '../../copy/status';
import { ToolStatusChip, type StatusChipSize } from '../../ui';
import catalog from './catalog.module.css';

const SIZES: readonly StatusChipSize[] = ['md', 'sm'];
const UNKNOWN_VALUE = 'retired';
const VALUES: readonly string[] = [...STATUS_VALUES.tool, UNKNOWN_VALUE];

export function ToolStatusChipSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        statusOf('tool', status)로 라벨 · tone을 찾는다. md는 상세 머리 · 표 칸, sm은 목록 항목 안 축소다. 목록에 없는 값은 값 그대로
        + mute이고 개발 콘솔에 한 번 경고한다.
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
                    <ToolStatusChip status={value} size={size} />
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

// 카탈로그 Checkbox 절 — size 셋(sm · md · lg) × (꺼짐 · 켬 · disabled · disabled + disabledReason) · sm + label(고정폭 id + StatusChip) · lg를 감싼 <label>. 포커스 링 · 키보드(Tab · Space)는 직접 눌러 본다
import { useId, useState } from 'react';
import { Checkbox, StatusChip, type CheckboxSize } from '../../ui';
import catalog from './catalog.module.css';
import styles from './CheckboxSection.module.css';

const SIZES: readonly CheckboxSize[] = ['sm', 'md', 'lg'];

type StateCase = { key: string; initial: boolean; disabled: boolean; reason?: string };

const STATES: readonly StateCase[] = [
  { key: '꺼짐', initial: false, disabled: false },
  { key: '켬', initial: true, disabled: false },
  { key: 'disabled', initial: false, disabled: true },
  { key: 'disabled 켬', initial: true, disabled: true },
  { key: 'disabled + disabledReason', initial: false, disabled: true, reason: 'AI 도구로 만들 수 없는 API입니다' },
];

function StateCell({ size, item }: { size: CheckboxSize; item: StateCase }) {
  const [checked, setChecked] = useState(item.initial);
  return (
    <Checkbox
      size={size}
      checked={checked}
      onCheckedChange={setChecked}
      disabled={item.disabled}
      disabledReason={item.reason}
      aria-label={`${size} ${item.key}`}
    />
  );
}

type ToolRow = { id: string; tone: 'ok' | 'mute'; status: string; initial: boolean };

const TOOLS: readonly ToolRow[] = [
  { id: 'orders.search', tone: 'ok', status: '공개 중', initial: true },
  { id: 'orders.create', tone: 'mute', status: '검토 중', initial: false },
];

function ToolLine({ tool }: { tool: ToolRow }) {
  const [checked, setChecked] = useState(tool.initial);
  return (
    <Checkbox
      size="sm"
      checked={checked}
      onCheckedChange={setChecked}
      label={
        <>
          <span className={styles.mono}>{tool.id}</span>
          <StatusChip tone={tool.tone} size="sm">
            {tool.status}
          </StatusChip>
        </>
      }
    />
  );
}

function ApprovalBox() {
  const id = useId();
  const [checked, setChecked] = useState(false);
  // 상자를 감싼 <label> — 린트가 감싼 부품 안의 입력을 보지 못해 htmlFor도 함께 둔다(상자 id)
  return (
    <label className={styles.own} htmlFor={id}>
      <Checkbox id={id} size="lg" checked={checked} onCheckedChange={setChecked} />
      <span>
        <b className={styles.ownTitle}>운영 시스템 담당자에게 탐색 승인을 받았습니다</b>
        <span className={styles.ownNote}>탐색 기록은 담당자에게도 공유할 수 있게 남습니다</span>
      </span>
    </label>
  );
}

export function CheckboxSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        브라우저 체크 상자 그대로다. sm은 크기 · 색을 적지 않은 브라우저 기본, md는 17(표 칸), lg는 18(승인 상자)이고 md · lg는 accent-color가 주조색이다.
        disabled는 투명도를 더하지 않고 브라우저 기본 비활성 모양에 커서 not-allowed다. 비활성 사유(disabledReason)는 마우스 툴팁(title)과 시각 숨김 aria-describedby로
        전해진다 — 비활성 칸에 마우스를 올려 툴팁을 본다. 상자를 누르면 바뀌고 포커스는 상자에 남는다.
      </p>

      <h3 className={catalog.heading}>size × 상태 — 이름 없이 상자만(aria-label)</h3>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">size</th>
              {STATES.map((item) => (
                <th key={item.key} scope="col">
                  {item.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size}>
                <th scope="row">{size}</th>
                {STATES.map((item) => (
                  <td key={item.key}>
                    <StateCell size={size} item={item} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={catalog.heading}>sm + label — 도구 목록 줄(줄 어디를 눌러도 바뀐다)</h3>
      <div className={styles.list}>
        {TOOLS.map((tool) => (
          <ToolLine key={tool.id} tool={tool} />
        ))}
        <Checkbox
          size="sm"
          checked={false}
          onCheckedChange={() => undefined}
          disabled
          disabledReason="이미 다른 묶음에 들어 있는 도구입니다"
          label={<span className={styles.mono}>orders.cancel</span>}
        />
      </div>

      <h3 className={catalog.heading}>lg — 감싼 label(승인 상자 모양은 화면 조각이라 테두리 없이)</h3>
      <ApprovalBox />
    </div>
  );
}

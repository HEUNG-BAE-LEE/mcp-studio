// 카탈로그 ScrollList 절 — GroupLabel id로 이름을 이은 상자 · 소제목 셋(하나는 줄 없음) + Checkbox sm label(고정폭 id + ToolStatusChip) 줄이 240을 넘어 스크롤이 보이게.
// 줄을 눌러 고르면 체크가 바뀐다
import { Fragment, useId, useState } from 'react';
import { Checkbox, GroupLabel, ScrollList, ScrollListHeading, ToolStatusChip } from '../../ui';
import type { ToolStatusValue } from '../../copy/status';
import catalog from './catalog.module.css';
import styles from './ScrollListSection.module.css';

type ToolRow = { id: string; status: ToolStatusValue };
type SourceRows = { name: string; tools: readonly ToolRow[] };

const SOURCES: readonly SourceRows[] = [
  {
    name: '인사 시스템',
    tools: [
      { id: 'hr.employee.search', status: 'done' },
      { id: 'hr.employee.get', status: 'done' },
      { id: 'hr.leave.request', status: 'review' },
      { id: 'hr.leave.cancel', status: 'review' },
      { id: 'hr.payroll.summary', status: 'drift' },
      { id: 'hr.attendance.list', status: 'done' },
    ],
  },
  { name: '구매관리 (줄 없음)', tools: [] },
  {
    name: '전자결재',
    tools: [
      { id: 'approval.doc.list', status: 'done' },
      { id: 'approval.doc.get', status: 'done' },
      { id: 'approval.doc.submit', status: 'off' },
      { id: 'approval.line.get', status: 'done' },
      { id: 'approval.doc.withdraw', status: 'review' },
      { id: 'approval.archive.search', status: 'done' },
    ],
  },
];

const INITIAL_CHECKED: readonly string[] = ['hr.employee.search', 'approval.doc.list'];

export function ScrollListSection() {
  const labelId = useId();
  const [checked, setChecked] = useState<readonly string[]>(INITIAL_CHECKED);
  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => (on ? [...prev.filter((item) => item !== id), id] : prev.filter((item) => item !== id)));
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        최대 높이 240 · 1px --line-divider · 안쪽 6/10 · 반지름 없음. 줄이 넘치면 상자 안에서 세로 스크롤한다. role=&quot;group&quot; +
        aria-labelledby로 위 GroupLabel이 이름을 준다. 상자에는 tabindex를 두지 않는다 — 안의 체크 상자가 포커스를 받고, 포커스가 옮겨 가면
        브라우저가 상자를 스크롤한다. 소제목은 제목 요소가 아니고 줄이 없어도 그린다.
      </p>
      <h3 className={catalog.heading}>소제목 셋 + 도구 체크 줄(Tab · Space로 고른다)</h3>
      <div>
        <GroupLabel id={labelId} className={styles.label}>
          포함할 도구
        </GroupLabel>
        <ScrollList labelledBy={labelId}>
          {SOURCES.map((source) => (
            <Fragment key={source.name}>
              <ScrollListHeading>{source.name}</ScrollListHeading>
              {source.tools.map((tool) => (
                <Checkbox
                  key={tool.id}
                  size="sm"
                  checked={checked.includes(tool.id)}
                  onCheckedChange={(on) => toggle(tool.id, on)}
                  label={
                    <>
                      <span className={styles.mono}>{tool.id}</span>
                      <ToolStatusChip status={tool.status} />
                    </>
                  }
                />
              ))}
            </Fragment>
          ))}
        </ScrollList>
      </div>
    </div>
  );
}

// 응답 매핑 — 소절 제목 · 다섯 열 표(최소 640)(옛 mapResHTML — js/menu/studio.js:38-51,99). 응답 필드가 없으면 점선 빈 상태.
// 명세가 바뀌고 아직 고치지 않은 행은 경고 바탕 · 옛 필드 취소선 · 새 필드 + "새 필드" 태그 · 예시 자리 "값 없음 (null)"(위험색),
// 고친 행은 새 필드 이름, 샘플로 추론한 행은 "추정" 태그. 예시는 원본 예시 값을 30자까지(넘으면 "…") — 규칙을 바꿔도 그대로다
import type { CodeEntry, ToolResField } from '../../api/types';
import { STUDIO } from '../../copy/studio';
import {
  CompactTable,
  CompactTableCell,
  CompactTableHeadCell,
  CompactTableRow,
  EmptyState,
  Icon,
  Input,
  SectionTitle,
  Tag,
} from '@/ui';
import { RuleCell } from './RuleCell';
import styles from './StudioScreen.module.css';

const R = STUDIO.res;

type ResMappingProps = Readonly<{
  /** 초안을 덮은 응답 매핑 */
  res: readonly ToolResField[];
  /** 저장본 응답 매핑 — 코드표 읽기의 기준 */
  savedRes: readonly ToolResField[];
  /** index번째 행을 바꾼다 */
  onEditRow: (index: number, update: (row: ToolResField) => ToolResField) => void;
}>;

type ResRowProps = Readonly<{
  field: ToolResField;
  savedCodes: readonly CodeEntry[] | undefined;
  onEdit: (update: (row: ToolResField) => ToolResField) => void;
}>;

function OriginCell({ field }: Readonly<{ field: ToolResField }>) {
  if (field.drift && !field.fixed) {
    return (
      <>
        <div className={`${styles.field} ${styles.old}`}>{field.o}</div>
        <div className={styles.field}>
          {field.newO}{' '}
          <Tag tone="warn" size="sm" className={styles.tagGap}>
            {R.newField}
          </Tag>
        </div>
      </>
    );
  }
  return (
    <div className={styles.field}>
      {field.fixed ? field.newO : field.o}
      {field.guess ? (
        <Tag tone="warn" size="sm" className={styles.tagGap}>
          {R.guess}
        </Tag>
      ) : null}
    </div>
  );
}

function ResRow({ field, savedCodes, onEdit }: ResRowProps) {
  const isDrift = Boolean(field.drift) && !field.fixed;
  return (
    <CompactTableRow tone={isDrift ? 'warn' : undefined}>
      <CompactTableCell>
        <OriginCell field={field} />
      </CompactTableCell>
      <CompactTableCell className={styles.arrow}>
        <Icon name="arrow" size="sm" />
      </CompactTableCell>
      <CompactTableCell>
        <Input
          variant="cell"
          mono
          value={field.a}
          aria-label={R.nameLabel}
          onValueChange={(a) => onEdit((row) => ({ ...row, a }))}
        />
        <div className={styles.type}>{field.at}</div>
      </CompactTableCell>
      <CompactTableCell>
        <RuleCell kind="res" row={field} savedCodes={savedCodes} onEdit={onEdit} />
      </CompactTableCell>
      <CompactTableCell>
        <span className={styles.example}>
          {isDrift ? <span className={styles.missing}>{R.nullValue}</span> : R.example(field.ov)}
        </span>
      </CompactTableCell>
    </CompactTableRow>
  );
}

export function ResMapping({ res, savedRes, onEditRow }: ResMappingProps) {
  return (
    <div>
      <SectionTitle level="sub" title={R.title} />
      {res.length === 0 ? (
        <EmptyState kind="section" container="panel">
          {R.empty}
        </EmptyState>
      ) : (
        <CompactTable
          minWidth={640}
          head={
            <>
              <CompactTableHeadCell>{R.cols.origin}</CompactTableHeadCell>
              <CompactTableHeadCell className={styles.arrow} />
              <CompactTableHeadCell>{R.cols.ai}</CompactTableHeadCell>
              <CompactTableHeadCell>{R.cols.rule}</CompactTableHeadCell>
              <CompactTableHeadCell>{R.cols.example}</CompactTableHeadCell>
            </>
          }
        >
          {res.map((field, index) => (
            <ResRow
              // 행은 서버 순서 그대로 — 더하거나 지우거나 순서를 바꾸지 않아 자리 번호가 행을 가리킨다
              key={index}
              field={field}
              savedCodes={savedRes[index]?.codes}
              onEdit={(update) => onEditRow(index, update)}
            />
          ))}
        </CompactTable>
      )}
    </div>
  );
}

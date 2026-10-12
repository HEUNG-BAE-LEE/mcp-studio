// 입력 파라미터 매핑 — 소절 제목 + 보조("* 필수, 보라색 규칙은…" — 표에 보라색이 없지만 옛 문구 그대로) · 다섯 열 표(최소 640, 좁으면 상자 안 가로 스크롤)
// (옛 mapParamsHTML — js/menu/studio.js:25-37,98). 칸: 원본 필드 + "위치, 타입"(없으면 "원본 필드 없음") · 화살표 · AI 이름 입력 + 타입 + 필수 *
// (숨김 규칙이면 "AI에 노출 안 함") · 규칙(RuleCell) · 설명 입력. 입력마다 초안에 쓰고 검증하지 않는다(이름 비움 · 겹침 — 옛 그대로).
// 필수 *는 보이는 표지이고 이름 입력이 시각 숨김 "필수"를 설명으로 읽는다(옛은 title뿐 — 이식 기간 고침). 파라미터 0개면 머리줄만 있는 표다
import { useId } from 'react';
import type { CodeEntry, ToolParam } from '../../api/types';
import { isHiddenRule } from '../../app/convert/visibleParams';
import { STUDIO } from '../../copy/studio';
import {
  CompactTable,
  CompactTableCell,
  CompactTableHeadCell,
  CompactTableRow,
  Icon,
  Input,
  SectionTitle,
  VisuallyHidden,
} from '@/ui';
import { RuleCell } from './RuleCell';
import styles from './StudioScreen.module.css';

const P = STUDIO.params;

type ParamMappingProps = Readonly<{
  /** 초안을 덮은 입력 매핑 */
  params: readonly ToolParam[];
  /** 저장본 입력 매핑 — 코드표 읽기의 기준 */
  savedParams: readonly ToolParam[];
  /** index번째 행을 바꾼다 */
  onEditRow: (index: number, update: (row: ToolParam) => ToolParam) => void;
}>;

type ParamRowProps = Readonly<{
  param: ToolParam;
  savedCodes: readonly CodeEntry[] | undefined;
  onEdit: (update: (row: ToolParam) => ToolParam) => void;
}>;

function ParamRow({ param, savedCodes, onEdit }: ParamRowProps) {
  const requiredId = useId();
  const isRequired = Boolean(param.req);
  return (
    <CompactTableRow>
      <CompactTableCell>
        {param.o ? (
          <>
            <div className={styles.field}>{param.o}</div>
            <div className={styles.type}>{P.locType(param.loc, param.ot)}</div>
          </>
        ) : (
          <span className={styles.hidden}>{P.noOrigin}</span>
        )}
      </CompactTableCell>
      <CompactTableCell className={styles.arrow}>
        <Icon name="arrow" size="sm" />
      </CompactTableCell>
      <CompactTableCell>
        {isHiddenRule(param.rule) ? (
          <span className={styles.hidden}>{P.hidden}</span>
        ) : (
          <>
            <Input
              variant="cell"
              mono
              value={param.a}
              aria-label={P.nameLabel}
              aria-describedby={isRequired ? requiredId : undefined}
              onValueChange={(a) => onEdit((row) => ({ ...row, a }))}
            />
            <div className={styles.type}>
              {param.at}
              {isRequired ? (
                <>
                  <span className={styles.required} title={P.required} aria-hidden="true">
                    {P.hintMark}
                  </span>
                  <VisuallyHidden id={requiredId}>{P.required}</VisuallyHidden>
                </>
              ) : null}
            </div>
          </>
        )}
      </CompactTableCell>
      <CompactTableCell>
        <RuleCell kind="params" row={param} savedCodes={savedCodes} onEdit={onEdit} />
      </CompactTableCell>
      <CompactTableCell className={styles.description}>
        <Input
          variant="cell"
          value={param.d || ''}
          aria-label={P.descLabel}
          onValueChange={(d) => onEdit((row) => ({ ...row, d }))}
        />
      </CompactTableCell>
    </CompactTableRow>
  );
}

export function ParamMapping({ params, savedParams, onEditRow }: ParamMappingProps) {
  return (
    <div>
      <SectionTitle
        level="sub"
        title={P.title}
        description={
          <>
            <span className={styles.mark}>{P.hintMark}</span>
            {P.hint}
          </>
        }
      />
      <CompactTable
        minWidth={640}
        head={
          <>
            <CompactTableHeadCell>{P.cols.origin}</CompactTableHeadCell>
            <CompactTableHeadCell className={styles.arrow} />
            <CompactTableHeadCell>{P.cols.ai}</CompactTableHeadCell>
            <CompactTableHeadCell>{P.cols.rule}</CompactTableHeadCell>
            <CompactTableHeadCell>{P.cols.desc}</CompactTableHeadCell>
          </>
        }
      >
        {params.map((param, index) => (
          <ParamRow
            // 행은 서버 순서 그대로 — 더하거나 지우거나 순서를 바꾸지 않아 자리 번호가 행을 가리킨다
            key={index}
            param={param}
            savedCodes={savedParams[index]?.codes}
            onEdit={(update) => onEditRow(index, update)}
          />
        ))}
      </CompactTable>
    </div>
  );
}

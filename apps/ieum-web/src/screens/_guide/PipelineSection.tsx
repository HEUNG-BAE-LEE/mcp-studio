// 카탈로그 Pipeline 절 — 기본(허브 칩 셋) · 칩 많음(줄바꿈) · 긴 이름(말줄임) · 칩 없음. 760 이하 세로는 뷰어 폭을 바꿔 본다
import { Pipeline, type PipelineNode } from '../../ui';
import catalog from './catalog.module.css';

const SOURCE: PipelineNode = {
  overline: '원본 작업',
  title: 'GET /api/v1/orders/{orderNo}',
  lines: ['REST', '입력 3개, 응답 12개'],
};

const TOOL: PipelineNode = {
  overline: 'AI 도구',
  title: 'orders_get',
  lines: ['MCP 도구, JSON Schema', 'AI에 입력 2개 노출'],
};

const LONG_SOURCE: PipelineNode = {
  overline: '원본 작업',
  title: 'POST /legacy/hr/employee/annualLeave/balanceByDepartmentAndYear.do',
  lines: ['SOAP', '입력 7개, 응답 31개'],
};

const LONG_TOOL: PipelineNode = {
  overline: 'AI 도구',
  title: 'hr_employee_annual_leave_balance_by_department_and_year',
  lines: ['MCP 도구, JSON Schema', 'AI에 입력 5개 노출'],
};

const FEW_CHIPS = ['이름 정리 2', '값 변환 1', '인증 정보 주입 1'];
const MANY_CHIPS = [
  '이름 정리 6',
  '값 변환 4',
  '날짜 형식 3',
  '코드표 2',
  '인증 정보 주입 1',
  '고정값 2',
  '숨김 3',
  '마스킹 2',
];

export function PipelineSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        도구 상세의 변환 흐름 띠 — 원본 작업 칸 · 이음 허브 칸 · AI 도구 칸을 흐름선(FlowLine)으로 잇는다. 이름 붙은 묶음(role=group)이고
        로고 · 흐름선은 장식이다. 글자는 모두 쓰는 곳이 준다. 760 이하에서는 칸 · 연결이 위에서 아래로 서고 흐름선도 세로가 된다.
      </p>

      <h3 className={catalog.heading}>기본 — 허브 칩 셋</h3>
      <Pipeline label="변환 흐름" source={SOURCE} hubTitle="이음 변압기" hubChips={FEW_CHIPS} tool={TOOL} />

      <h3 className={catalog.heading}>칩 많음 — 허브 안에서 줄을 바꾼다</h3>
      <Pipeline label="변환 흐름" source={SOURCE} hubTitle="이음 변압기" hubChips={MANY_CHIPS} tool={TOOL} />

      <h3 className={catalog.heading}>긴 이름 — 한 줄 말줄임</h3>
      <Pipeline label="변환 흐름" source={LONG_SOURCE} hubTitle="이음 변압기" hubChips={FEW_CHIPS} tool={LONG_TOOL} />

      <h3 className={catalog.heading}>허브 칩 없음 — 칩 줄을 그리지 않는다</h3>
      <Pipeline label="변환 흐름" source={SOURCE} hubTitle="이음 변압기" hubChips={[]} tool={TOOL} />
    </div>
  );
}

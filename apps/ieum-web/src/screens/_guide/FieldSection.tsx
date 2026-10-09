// 카탈로그 Field 절 — 라벨 위치(center · top) × 입력 종류, 필수 칸(requiredLabel) · 라벨 툴팁(labelTitle) — 테스트 실행 인자 칸,
// FieldNote(칸 묶음 아래 안내). 라벨을 누르면 입력에 포커스가 간다. 760 이하는 한 열 · 안내 들여쓰기 없음
import { useState } from 'react';
import { Field, FieldNote, InlineCode, Input, Select, Textarea } from '../../ui';
import catalog from './catalog.module.css';

export function FieldSection() {
  const [name, setName] = useState('');
  const [sample, setSample] = useState('');
  const [scope, setScope] = useState('');
  const [pages, setPages] = useState('40');
  const [empNo, setEmpNo] = useState('');
  const [dept, setDept] = useState('');
  const [retired, setRetired] = useState('');
  const [filter, setFilter] = useState('');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .field — 라벨 열 --w-field-label + 입력 열. 라벨은 label for로 입력과 이어져 라벨을 누르면 입력에 포커스가 간다.
        760 이하에서는 라벨 위 · 입력 아래 한 열이다. FieldNote는 라벨 열만큼 들여 입력 열에 맞춘 흐린 안내(아래 4)이고 760 이하에서 들여쓰지 않는다.
      </p>
      <h3 className={catalog.heading}>center</h3>
      <Field label="시스템 이름">
        {({ id }) => <Input id={id} value={name} onValueChange={setName} placeholder="비우면 명세의 이름을 씁니다" />}
      </Field>
      <h3 className={catalog.heading}>top</h3>
      <Field label="요청 샘플" align="top">
        {({ id }) => <Textarea id={id} rows={3} value={sample} onValueChange={setSample} />}
      </Field>
      <h3 className={catalog.heading}>requiredLabel · labelTitle — 테스트 실행 인자 칸</h3>
      <p className={catalog.note}>
        requiredLabel이 있으면 라벨 뒤 위험색 * (장식 — 읽히지 않음)를 그리고, 그 글자("필수")를 라벨 밖 시각 숨김으로 두어
        control.describedBy로 입력의 설명에 잇는다 — 입력 이름은 라벨 글자 그대로다. labelTitle은 라벨 마우스 툴팁(title)뿐이다.
        코드표 · 열거 · 참거짓 인자는 Select form + 빈 첫 옵션.
      </p>
      <div>
        <Field label="emp_no" requiredLabel="필수" labelTitle="조회할 직원의 사번">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={empNo} onValueChange={setEmpNo} />}
        </Field>
        <Field label="dept_code" requiredLabel="필수" labelTitle="부서 코드">
          {({ id, describedBy }) => (
            <Select id={id} variant="form" aria-describedby={describedBy} value={dept} onValueChange={setDept}>
              <option value="" />
              <option>인사팀</option>
              <option>재무팀</option>
              <option>영업팀</option>
            </Select>
          )}
        </Field>
        <Field label="include_retired" labelTitle="퇴직자 포함 여부">
          {({ id, describedBy }) => (
            <Select id={id} variant="form" aria-describedby={describedBy} value={retired} onValueChange={setRetired}>
              <option value="" />
              <option>true</option>
              <option>false</option>
            </Select>
          )}
        </Field>
        <Field label="filter">
          {({ id, describedBy }) => <Input id={id} mono aria-describedby={describedBy} value={filter} onValueChange={setFilter} />}
        </Field>
      </div>
      <h3 className={catalog.heading}>FieldNote — 칸 묶음 아래 안내</h3>
      <div>
        <Field label="탐색 범위">
          {({ id }) => <Input id={id} mono value={scope} onValueChange={setScope} placeholder="비우면 운영 주소 아래 전부 (예: /po/*)" />}
        </Field>
        <Field label="최대 화면 수">
          {({ id }) => <Input id={id} type="number" width="narrow" value={pages} onValueChange={setPages} />}
        </Field>
        <FieldNote>
          경로는 <InlineCode>/po/*</InlineCode> 처럼 서버 기준으로도 쓸 수 있습니다. <b>이 서버에는 git 이 없어 경로만 쓸 수 있습니다.</b>
        </FieldNote>
      </div>
    </div>
  );
}

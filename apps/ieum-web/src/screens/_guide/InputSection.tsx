// 카탈로그 Input 절 — form(종류 text · password · number × 고정폭 × 폭 full · narrow × 기본 · 비활성) · cell(본문 · 고정폭 · 비활성) · setting(number 78 · time auto · 고정폭 · 읽기 전용 · 비활성)
// 포커스에 form · setting은 테두리가 --primary가 되고, cell은 전역 링만이다
import { useState, type ReactNode } from 'react';
import { Field, Input } from '../../ui';
import catalog from './catalog.module.css';
import styles from './InputSection.module.css';

type DemoProps = { initial: string; children: (value: string, setValue: (value: string) => void) => ReactNode };

/** 값만 들고 있는 칸 — 예시마다 따로 바뀐다 */
function Demo({ initial, children }: DemoProps) {
  const [value, setValue] = useState(initial);
  return <>{children(value, setValue)}</>;
}

function FormExamples() {
  return (
    <>
      <h3 className={catalog.heading}>form — 폼 칸(--h-md · 칸 전체 폭)</h3>
      <div className={catalog.stack}>
        <Demo initial="">
          {(value, setValue) => (
            <Field label="text">{({ id }) => <Input id={id} value={value} onValueChange={setValue} placeholder="비우면 명세의 이름을 씁니다" />}</Field>
          )}
        </Demo>
        <Demo initial="https://erp.example.com">
          {(value, setValue) => <Field label="mono">{({ id }) => <Input id={id} mono value={value} onValueChange={setValue} />}</Field>}
        </Demo>
        <Demo initial="secret">
          {(value, setValue) => (
            <Field label="password">{({ id }) => <Input id={id} type="password" value={value} onValueChange={setValue} />}</Field>
          )}
        </Demo>
        <Demo initial="40">
          {(value, setValue) => (
            <Field label="최대 화면 수">{({ id }) => <Input id={id} type="number" width="narrow" value={value} onValueChange={setValue} />}</Field>
          )}
        </Demo>
        <Demo initial="잠긴 칸">
          {(value, setValue) => <Field label="disabled">{({ id }) => <Input id={id} disabled value={value} onValueChange={setValue} />}</Field>}
        </Demo>
      </div>
      <p className={catalog.note}>
        password는 autocomplete=&quot;new-password&quot;가 함께 들어간다. width=&quot;narrow&quot;는 120(탐색 최대 화면 수). 자리표시는 브라우저 기본
        색, 비활성은 --opacity-disabled.
      </p>
    </>
  );
}

function CellExamples() {
  return (
    <>
      <h3 className={catalog.heading}>cell — 표 안 작은 칸(--h-xs · 칸 전체 폭 · 최소 90)</h3>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <tbody>
            <tr>
              <td className={styles.cell}>
                <Demo initial="po_no">{(value, setValue) => <Input variant="cell" mono value={value} onValueChange={setValue} aria-label="AI 파라미터 이름" />}</Demo>
              </td>
              <td className={styles.cell}>
                <Demo initial="발주 번호">{(value, setValue) => <Input variant="cell" value={value} onValueChange={setValue} aria-label="파라미터 설명" />}</Demo>
              </td>
              <td className={styles.narrowCell}>
                <Demo initial="최소 폭">{(value, setValue) => <Input variant="cell" value={value} onValueChange={setValue} aria-label="최소 폭 예시" />}</Demo>
              </td>
              <td className={styles.cell}>
                <Demo initial="잠긴 칸">{(value, setValue) => <Input variant="cell" disabled value={value} onValueChange={setValue} aria-label="비활성 예시" />}</Demo>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={catalog.note}>매핑 표의 이름 · 고정값 · 코드표는 mono. 보이는 라벨이 없어 aria-label을 준다. 칸이 좁아도 90 아래로 줄지 않는다(셋째 칸).</p>
    </>
  );
}

function SettingExamples() {
  return (
    <>
      <h3 className={catalog.heading}>setting — 정책 · 설정 줄 오른쪽 칸(--h-sm · 오른쪽 정렬 · 숫자 고른 폭)</h3>
      <div className={catalog.row}>
        <Demo initial="60">
          {(value, setValue) => <Input variant="setting" type="number" min={1} max={600} value={value} onValueChange={setValue} aria-label="분당 호출 한도" />}
        </Demo>
        <Demo initial="02:00">
          {(value, setValue) => <Input variant="setting" type="time" width="auto" value={value} onValueChange={setValue} aria-label="예약 시각" />}
        </Demo>
        <Demo initial="http://10.20.9.30:8080/po">
          {(value, setValue) => <Input variant="setting" mono value={value} onValueChange={setValue} aria-label="스테이징 주소" />}
        </Demo>
        <Demo initial="60">
          {(value, setValue) => <Input variant="setting" type="number" readOnly value={value} onValueChange={setValue} aria-label="읽기 전용 예시" />}
        </Demo>
        <Demo initial="60">
          {(value, setValue) => <Input variant="setting" type="number" disabled value={value} onValueChange={setValue} aria-label="비활성 예시" />}
        </Demo>
      </div>
      <p className={catalog.note}>
        기본 폭 78(정책 숫자 칸), width=&quot;auto&quot;는 내용 폭(탐색 예약 시각). number · time의 조절 단추 · 펼침은 브라우저 기본이다. mono는
        스테이징 주소(옛 칸 그대로 78 · 오른쪽 정렬 — 긴 주소는 칸 안에서 밀린다), readOnly는 모양이 바뀌지 않는다.
      </p>
    </>
  );
}

export function InputSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .inp · .map .mini · .tg .inp — 모양은 variant, 폭은 width 하나다. 입력할 때마다 바로 값이 바뀐다. form의 이름은 Field의 라벨(id 연결)이고,
        보이는 라벨이 없는 칸은 aria-label을 준다.
      </p>
      <FormExamples />
      <CellExamples />
      <SettingExamples />
    </div>
  );
}

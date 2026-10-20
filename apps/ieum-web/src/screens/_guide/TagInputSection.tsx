// 카탈로그 TagInput 절 — 단어 셋 · 빈 목록 · 긴 단어 여럿(접힘). 절 안 상태로 더하기 · 빼기가 실제로 돈다
// 확인: 한글 조합 중 Enter는 더하지 않는다(조합을 끝내는 키) · 빈 값 · 중복은 무시하고 입력칸만 비운다 · 빼면 포커스가 입력칸으로 간다 · 입력 포커스 · 빼기 hover는 직접 눌러 본다
import { useState } from 'react';
import { TagInput } from '../../ui';
import catalog from './catalog.module.css';

const removeLabel = (value: string) => `${value} 빼기`;

type DemoProps = { title: string; initial: readonly string[]; placeholder?: string };

function Demo({ title, initial, placeholder }: DemoProps) {
  const [values, setValues] = useState<readonly string[]>(initial);
  return (
    <>
      <h3 className={catalog.heading}>{title}</h3>
      <TagInput
        values={values}
        onAdd={(value) => setValues((prev) => [...prev, value])}
        onRemove={(value) => setValues((prev) => prev.filter((item) => item !== value))}
        removeLabel={removeLabel}
        inputLabel="누르지 않을 단어 추가"
        placeholder={placeholder}
      />
    </>
  );
}

const LONG_WORDS = [
  '결재상신',
  '품의서 삭제',
  '일괄 승인 처리',
  '재고 실사 결과 반영',
  '월마감 확정',
  '거래처 정보 일괄 변경',
  'averyveryverylongsinglewordthatdoesnotbreakanywhereatall-0123456789-abcdefghijklmnopqrstuvwxyz',
];

export function TagInputSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        단어를 위험색 알약 칩으로 늘어놓고 끝 입력칸에서 Enter로 더한다. 칩마다 빼기 버튼이 있다. Enter는 앞뒤 공백을 지운 단어를 더하고 — 빈 값 · 이미 있는 값은 더하지 않고 —
        어느 쪽이든 입력칸을 비운 채 포커스를 입력칸에 둔다. 한글 조합 중 Enter는 무시한다. 칩을 빼도 포커스는 입력칸으로 간다. 칩과 입력칸은 한 줄에 놓이고 좁으면 접힌다.
      </p>
      <Demo title="단어 셋" initial={['삭제', '취소', '전송']} placeholder="단어 추가" />
      <Demo title="빈 목록" initial={[]} placeholder="단어 추가" />
      <Demo title="긴 단어 여럿 — 줄이 접히고, 한 줄보다 긴 낱말은 칩 안에서 말줄임" initial={LONG_WORDS} placeholder="단어 추가" />
    </div>
  );
}

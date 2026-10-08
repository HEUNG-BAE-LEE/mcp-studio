// copy/discovery의 조각 문장을 요소로 — 굵은 조각(Emphasis)은 <b>, 인라인 코드 조각(CodeParts 홀수 칸)은 InlineCode.
// 옛은 HTML 문자열에 <b> · <span class="inline-code">를 섞어 그렸다(js/menu/discovery.js:56,60,65,297-304,342 — 이식 기간 허용 차이 · 렌더).
// 탐색 마법사(app/sources/SourceWizard/discover) · 결과 화면(screens/discovery) · 근거 드로어가 같이 쓴다
import { Fragment } from 'react';
import type { CodeParts, Emphasis } from '../../copy/discovery';
import { InlineCode } from '@/ui';

/** 앞 · 굵게 · 뒤 */
export function EmphasisText({ parts }: Readonly<{ parts: Emphasis }>) {
  return (
    <>
      {parts.pre}
      <b>{parts.strong}</b>
      {parts.post}
    </>
  );
}

/** 짝수 칸은 글, 홀수 칸은 인라인 코드 */
export function CodeText({ parts }: Readonly<{ parts: CodeParts }>) {
  return (
    <>
      {parts.map((part, index) => (
        // 조각 순서는 문구 원문이 정한다 — 바뀌지 않는 목록이라 자리를 키로 쓴다
        <Fragment key={index}>{index % 2 === 1 ? <InlineCode>{part}</InlineCode> : part}</Fragment>
      ))}
    </>
  );
}

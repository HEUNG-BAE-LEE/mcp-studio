// 미리보기 "응답 변환"의 AI에게 전달하는 결과 — 옛 aiResult(js/common/convert.js:118-123).
// aiOut이 있으면 그대로, 없으면 응답 매핑의 AI 이름(a) 경로로 조립한다. 명세가 바뀌고 아직 고치지 않은 행은 null,
// 아니면 변환한 값(av)이 있으면 그것, 없으면 원본 예시 값(ov)
import type { ToolRecord, ToolResField } from '../../api/types';
import { setPath } from './setPath';

type ResultSource = Pick<ToolRecord, 'res' | 'aiOut'>;

const aiValueOf = (r: ToolResField): unknown => {
  if (r.drift && !r.fixed) return null;
  return r.av !== undefined ? r.av : r.ov;
};

/** 문자열 aiOut은 글 그대로 보인다 — 코드 상자 글자는 jsonText로 만든다 */
export function aiResult(tool: ResultSource): unknown {
  if (tool.aiOut) return tool.aiOut;
  return tool.res.reduce((acc, r) => setPath(acc, r.a, aiValueOf(r)), {});
}

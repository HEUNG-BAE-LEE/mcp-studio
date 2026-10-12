// 원본 작업 표시 — REST · 공공데이터 · 샘플 · 탐색은 "메서드 경로", SOAP은 오퍼레이션 이름(옛 opLabel — js/common/state.js:35)
import type { ToolRecord } from '../../api/types';

/**
 * 메서드가 있으면 "메서드 경로", 없으면 op. 옛 출력 그대로다 — 경로가 없으면 "undefined" 글자가 들어가고, 둘 다 없으면 undefined다
 * (목록 검색은 이 값을 id · 제목과 이어 붙여 찾는다 — js/menu/studio.js:6)
 */
export const opLabel = (tool: Pick<ToolRecord, 'method' | 'path' | 'op'>): string | undefined =>
  tool.method ? `${tool.method} ${tool.path}` : tool.op;

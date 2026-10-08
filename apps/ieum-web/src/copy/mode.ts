// 도구 읽기 · 쓰기 표시 — 옛 modeTag(js/common/state.js:38) 문구 그대로. 스튜디오 · 배포 · 자동 탐색이 같이 쓴다
// 모드는 상태 값이 아니라 copy/status 폴백(값 그대로 + mute)을 쓰지 않는다 — 옛은 write가 아니면 모두 "읽기"였다
import type { ToolMode } from '../api/types';

export type ModeKind = 'read' | 'write';

export const MODE_LABEL: Readonly<Record<ModeKind, string>> = Object.freeze({ read: '읽기', write: '쓰기' });

/** write만 쓰기, 그 밖(모르는 값 포함)은 읽기 */
export const modeKindOf = (mode: ToolMode): ModeKind => (mode === 'write' ? 'write' : 'read');

export const modeLabel = (mode: ToolMode): string => MODE_LABEL[modeKindOf(mode)];

// 도구 저장 본문(PUT /studio/{id}/) — 받은 도구 레코드(타입 밖 키 포함 — soapAction · resXml · disc의 rec 등)에 기본값을 채우고
// 초안을 덮은 것에서 원본 id(src)와 호출 수(calls)를 뺀다. 옛은 메모리의 도구 객체를 통째로 보냈다(js/menu/studio.js:165 — src · calls ·
// _dirty 포함, 서버가 src와 _ 필드를 버림). 호출 수는 서버 목록 조회가 매번 덮는 값이라 화면이 들고 있던 값으로 서버 값을 덮지 않는다
import type { SourcesResponse, StudioResponse, Tool } from '../../api/types';
import { keys } from '../../api/hooks/keys';
import { indexTools } from '../../api/hooks/useTools';
import { queryClient } from '../queryClient';
import { applyDraft, draftOf } from './drafts';

export type SaveBody = Readonly<Omit<Tool, 'src' | 'calls'>>;

/** 초안을 덮은 도구에서 저장 본문으로 */
function saveBodyOfView(view: Tool): SaveBody {
  const { src: _src, calls: _calls, ...body } = view;
  return body;
}

/** 캐시의 서버 도구(기본값 채움) — 도구 · 원본 조회가 아직 없거나 그 id가 없으면 undefined */
function cachedTool(toolId: string): Tool | undefined {
  const studio = queryClient.getQueryData<StudioResponse>(keys.tools());
  const sources = queryClient.getQueryData<SourcesResponse>(keys.sources());
  if (studio === undefined || sources === undefined) return undefined;
  const { byId } = indexTools(studio, sources.sources);
  return Object.hasOwn(byId, toolId) ? byId[toolId] : undefined;
}

/**
 * 지금 그 도구의 저장 본문(서버 도구 + 지금 초안). 스튜디오 저장 버튼은 useSaveTool에, 배포 창은 자기 요청 안에서 saveTool에 넘긴다
 * (app/studio/useToolMutations). 도구를 모르면 undefined
 */
export function saveBodyOf(toolId: string): SaveBody | undefined {
  const tool = cachedTool(toolId);
  return tool === undefined ? undefined : saveBodyOfView(applyDraft(tool, draftOf(toolId)));
}

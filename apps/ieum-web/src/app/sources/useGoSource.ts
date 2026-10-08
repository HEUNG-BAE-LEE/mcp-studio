// 원본 시스템 하나를 "연다" — 대시보드 구조도 원본 노드와 원본 목록 행이 같이 쓴다(옛 js/menu/sources.js:132 goSrc)
// 인증이 만료(err)된 원본은 이동 없이 재인증 모달, 아니면 그 원본의 첫 도구를 연 스튜디오, 도구가 0개면 그 원본의 빈 스튜디오로 간다
// (옛은 도구가 0개면 예외로 멈췄다 — 이식 기간 허용 차이). 연결 마법사 완료 이동은 연결 응답을 쓰므로 이 훅을 쓰지 않는다
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSources } from '../../api/hooks/useSources';
import { useTools } from '../../api/hooks/useTools';
import { openReauth } from '../layers';
import { sourceStatusOf } from '../status/sourceStatus';
import { studioSrcLink, toolLink } from '../studio/links';

/** 돌려주는 함수는 원본 id를 받는다. 목록에 없는 id는 아무것도 하지 않는다 */
export function useGoSource(): (sourceId: string) => void {
  const navigate = useNavigate();
  const sourceList = useSources().data?.sources;
  const bySource = useTools().data?.bySource;

  return useCallback(
    (sourceId: string) => {
      const source = sourceList?.find((s) => s.id === sourceId);
      if (!source || !bySource) return;
      const tools = bySource[sourceId] ?? [];
      if (sourceStatusOf(source, tools) === 'err') {
        openReauth(sourceId);
        return;
      }
      const [first] = tools;
      const { to, state } = first ? toolLink(first.id) : studioSrcLink(sourceId);
      void navigate(to, { state });
    },
    [navigate, sourceList, bySource],
  );
}

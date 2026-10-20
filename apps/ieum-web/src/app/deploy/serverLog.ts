// 서버 로그 받기 — "서버 로그" 버튼과 로그 창의 "새로 읽기"가 같이 쓴다(옛 tsLog — js/menu/deploy.js:165-171). 받고 나서 창을 연다(받는 동안은
// 아무것도 열지 않는다). 실패는 경고 토스트(서버 문장 그대로)이고 null을 돌려준다 — 창은 열지 않고, 열려 있던 창(새로 읽기)은 그대로 둔다.
// 영역 조회라 ?mock=region-failed로 실패한다. 받은 줄을 줄바꿈으로 이은 글이 비면(줄 0개 · 빈 줄 하나뿐) 창이 copy/deploy logs.empty를
// 상자 안에 그린다(옛 r.lines.join('\n') || '아직 남은 로그가 없습니다.' :167)
import { fetchToolsetLogs } from '../../api/hooks/toolsetLogs';
import { queryClient } from '../queryClient';
import { toast } from '../toast';

export async function loadServerLog(toolsetId: string): Promise<readonly string[] | null> {
  try {
    const { lines } = await fetchToolsetLogs(queryClient, toolsetId);
    return lines;
  } catch (error) {
    console.warn('[deploy] server log fetch failed', error);
    toast.warn(error instanceof Error ? error.message : String(error));
    return null;
  }
}

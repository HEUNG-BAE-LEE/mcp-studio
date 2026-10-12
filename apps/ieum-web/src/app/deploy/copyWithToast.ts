// 배포 화면의 복사 버튼 셋(MCP 서버 주소 · 연결 예시 · 발급한 키)이 같이 쓴다 — 복사하고 결과를 토스트로 알린다
// (옛 copyText — js/common/overlay.js:34-37). ui CopyField는 onCopy만 받으므로 그 자리에서 이 함수를 부른다
import { DEPLOY } from '../../copy/deploy';
import { copyText } from '../clipboard';
import { toast } from '../toast';

export async function copyWithToast(text: string): Promise<void> {
  if (await copyText(text)) toast(DEPLOY.copy.done);
  else toast.warn(DEPLOY.copy.blocked);
}

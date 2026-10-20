// 배포 쓰기 실패의 경고 토스트 — 서버 문장 그대로(줄바꿈은 토스트가 지킨다). 묶음 · 키 쓰기 훅이 같이 쓴다(옛 .catch(e => toast(e.message, 'warn')) — js/menu/deploy.js:163,170,178,181,201,206,211)
import { toast } from '../toast';

export function warnFailure(error: Error): void {
  toast.warn(error.message);
}

// 카탈로그 FailureBlock 절 — tone(warn · danger) × 머리 유무, 여러 줄 원문(pre-wrap). 문구는 이음 자리 예시
import { FailureBlock } from '../../ui';
import catalog from './catalog.module.css';

const MULTILINE = '배포 서버를 시작하지 못했습니다.\nport 8101 is already in use\n  at uvicorn.run (server.py:42)';

export function FailureBlockSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 알림 상자 — 경고 아이콘 + 굵은 머리 한 줄(있는 자리만) + 원문. tone은 자리마다 이음 그대로이고 원문은 줄바꿈을
        지킨다. 복사 · 재시도 버튼은 없다.
      </p>
      <div className={catalog.stack}>
        <FailureBlock tone="warn" title="연결하지 못했습니다." message="인증 정보가 올바르지 않습니다." />
        <FailureBlock tone="warn" title="탐색하지 못했습니다." message="찾은 결과가 없습니다." />
        <FailureBlock tone="danger" message={MULTILINE} />
        <FailureBlock tone="danger" title="서버가 종료됐습니다." message="프로세스가 코드 1로 끝났습니다." />
        <FailureBlock
          tone="warn"
          message="https://example.internal/api/v1/very/long/path/that/does/not/break/naturally/and/must/wrap/inside/the/box?query=1"
        />
      </div>
    </div>
  );
}

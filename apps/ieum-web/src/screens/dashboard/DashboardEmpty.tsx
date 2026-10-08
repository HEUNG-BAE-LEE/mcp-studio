// DashboardEmpty — 연결된 원본 시스템이 없을 때 머리 아래에 놓는 큰 빈 상태 상자. 옛 js/menu/dashboard.js:61
// 시연용 원본 주소 안내는 늘 보인다(옛 그대로). 주소는 백엔드 주소다 — 개발 서버의 location.origin(:5174)은 백엔드가 아니라서 개발 중에는 vite가 정의한 백엔드 주소를 쓴다
import { openWizard } from '../../app/layers';
import { DASH } from '../../copy/dashboard-logs';
import { Button, EmptyState, InlineCode } from '@/ui';

const DEMO_SPEC_PATH = '/demo-origin/openapi.json';

const demoSpecUrl = (): string => `${import.meta.env.DEV ? __IEUM_BACKEND__ : location.origin}${DEMO_SPEC_PATH}`;

export function DashboardEmpty() {
  return (
    <EmptyState
      kind="first"
      container="panel"
      size="hero"
      title={DASH.empty.title}
      action={
        // 연결 마법사 층을 그리는 곳은 원본 시스템 메뉴다 — 그 전에는 눌러도 층이 뜨지 않는다
        <Button variant="primary" onClick={() => openWizard()}>
          {DASH.empty.action}
        </Button>
      }
    >
      {DASH.empty.body}
      <br />
      {DASH.empty.demoPre}
      <InlineCode>{demoSpecUrl()}</InlineCode>
      {DASH.empty.demoPost}
    </EmptyState>
  );
}

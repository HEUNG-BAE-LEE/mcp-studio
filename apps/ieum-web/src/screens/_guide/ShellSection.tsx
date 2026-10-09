// 카탈로그 셸 절 — 셸 조각(app/shell의 Rail · Gnb · Lnb · ScopeModal)을 예시 값으로 그린다. Shell 자체는 라우트 · 셸 조회(useSources)를
// 쥐므로 여기서는 조각만 늘어놓는다. 폭 전환으로 1500 · 1100 · 760 동작(메뉴 글자 · 회사 버튼 · 두 줄 LNB · 레일 숨김)을 본다.
// 메뉴 링크를 누르면 카탈로그 틀 안에서 그 주소로 간다(링크는 실제 useMenuHref)
import { useState } from 'react';
import { Gnb } from '../../app/shell/Gnb';
import { Lnb } from '../../app/shell/Lnb';
import { Rail } from '../../app/shell/Rail';
import { ScopeModal } from '../../app/shell/ScopeModal';
import type { ScreenId } from '../../app/nav';
import type { Workspace } from '../../api/types';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { PageHead } from '../../ui';
import catalog from './catalog.module.css';
import styles from './ShellSection.module.css';

// 예시 값 — 시드 workspace와 같은 모양(실제 값은 셸이 useSources로 받는다)
const SAMPLE_WORKSPACE: Workspace = { company: '내 워크스페이스', user: '관리자' };

type Example = Readonly<{ label: string; current: ScreenId; workspace?: Workspace }>;
const EXAMPLES: readonly Example[] = [
  { label: '현재 대시보드 · workspace 받음', current: 'dashboard', workspace: SAMPLE_WORKSPACE },
  { label: '현재 호출 로그 · workspace 받기 전 · 실패(회사 · 사용자 비움)', current: 'logs' },
];

export function ShellSection() {
  const [isScopeOpen, setScopeOpen] = useState(false);
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        레일(현재 = 게이트웨이 관리, 나머지는 동작 없는 버튼) · GNB(회사 · 사용자는 workspace) · LNB(메뉴별 마지막 주소 링크) ·
        본문. &quot;1차 개발 범위&quot;를 누르면 범위 모달이 열린다.
      </p>
      {EXAMPLES.map(({ label, current, workspace }) => (
        <div key={label} className={styles.example}>
          <p className={catalog.frameLabel}>{label}</p>
          <div className={styles.frame}>
            <Rail />
            <div className={styles.main}>
              <Gnb workspace={workspace} onScopeOpen={() => setScopeOpen(true)} />
              <Lnb current={current} />
              <div className={styles.content}>
                <PageHead
                  title={SCREEN_LABEL[current]}
                  description={current === 'logs' ? PAGE_DESCRIPTION.logs : PAGE_DESCRIPTION.dashboard}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <ScopeModal open={isScopeOpen} onOpenChange={setScopeOpen} />
    </div>
  );
}

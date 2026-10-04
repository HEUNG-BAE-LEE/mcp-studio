// PendingScreen — 준비 중 화면 자리(PageHeader + 준비 중) · 샘플 IA의 빈 자리(언제든 바뀌고, 채울 차례를 뜻하지 않는다 — DESIGN 용어집)
// 진입: LNB 항목 · 라우트(app/routes — 만든 화면이 없는 id)
// 틀: 없음 — 이 자리에 새 화면을 만들 때는 new-screen 스킬을 따른다 · 스크롤 page
// 영역: 머리 = PageHeader(화면 이름) · 본문 = EmptyState
// 상태: 로딩 · 실패 · 권한 없음(데이터를 받지 않는다) · 빈 상태 nothing-yet 고정
import { EmptyState, PageBody, PageHeader } from '@/ui';
import { screenTitle, type ScreenId } from '../../app/nav';
import { useAppStore } from '../../app/store';
import { PENDING } from '../../copy/pending';

export function PendingScreen({ screen }: { screen: ScreenId }) {
  const narrow = useAppStore((s) => s.narrow);
  return (
    <PageBody narrow={narrow}>
      <PageHeader title={screenTitle(screen)} />
      <EmptyState kind="nothing-yet" title={PENDING.title} body={PENDING.body} />
    </PageBody>
  );
}

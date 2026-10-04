// apps/web/src/screens/shell/AlertList.tsx — 알림 카드 목록(표시만, ShellAlerts가 쓴다). 그룹 헤더 없이 Notice를 카드마다 감싸 잇는다(구분선은 AlertPanel 목록), 0건은 EmptyState nothing-yet
import { EmptyState, Notice } from '@/ui';
import type { Notification, NotificationGroups } from '../../api/types';
import { entranceHref } from '../../app/nav';
import {
  flattenNotifications,
  formatNotification,
  type FormattedNotification,
} from '../../copy/notifications';
import { SHELL } from '../../copy/shell';
import { useInterceptLinks } from './useInterceptLinks';

/** `id` — 목록 React key. 알림에는 id가 없어 code + 이동 대상(화면 · 프로젝트 · 대상 id · 탭)으로 만든다(순서가 바뀌어도 같은 카드) */
type AlertItem = FormattedNotification & { id: string; href: string };

const alertIdOf = ({ code, actionTarget: t }: Notification) =>
  [code, t.screen, t.projectId ?? '', t.id, t.tab ?? ''].join(':');

export const toAlertItems = (groups: NotificationGroups, now: Date): AlertItem[] =>
  flattenNotifications(groups).map((n) => ({
    ...formatNotification(n, { now }),
    id: alertIdOf(n),
    href: entranceHref(n.actionTarget),
  }));

export function AlertList({
  items,
  onNavigate,
}: {
  items: readonly AlertItem[];
  onNavigate?: () => void;
}) {
  const interceptLinks = useInterceptLinks(onNavigate);
  if (items.length === 0)
    return (
      <EmptyState
        kind="nothing-yet"
        title={SHELL.alerts.emptyTitle}
        body={SHELL.alerts.emptyBody}
      />
    );
  // 카드마다 감싼다 — 목록 상자(AlertPanel)가 바로 아래 자식 사이에 구분선을 긋는다(목록 전체를 한 요소로 감싸지 않는다).
  // 카드는 live 영역이 아니다(Notice 기본) — 목록(AlertPanel)이 live 영역 하나를 가진다
  return items.map((it) => (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 자식 <a>(입구 링크)의 클릭을 위임받아 SPA 이동 + 닫기
    <div key={it.id} onClick={interceptLinks}>
      <Notice
        tone={it.tone}
        title={it.title}
        body={it.body}
        link={it.link ? { label: it.link, href: it.href } : undefined}
      />
    </div>
  ));
}

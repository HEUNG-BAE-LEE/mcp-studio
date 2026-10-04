// apps/web/src/screens/project/settings/useSettingsParam.ts — 설정 모달 URL 상태 ?source=&tab=. 다른 파라미터(?mock=)는 그대로 둔다
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { SETTINGS_TABS, warnUnknownTab, type SettingsTab } from '../../../copy/sourceSettings';

const TABS: readonly string[] = SETTINGS_TABS;
const SOURCE = 'source';
const TAB = 'tab';
function parseTab(raw: string | null): SettingsTab {
  if (raw === null) return 'status';
  if (TABS.includes(raw)) return raw as SettingsTab;
  // 모르는 값은 기본으로 그리고 경고한다(렌더마다 반복하지 않게 1회)
  warnUnknownTab(raw);
  return 'status';
}
export function useSettingsParam() {
  const [params, setParams] = useSearchParams();
  const edit = useCallback(
    (fn: (next: URLSearchParams) => void, replace: boolean) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          fn(next);
          return next;
        },
        { replace },
      ),
    [setParams],
  );
  const open = useCallback(
    (sourceId: string, tab: SettingsTab) =>
      edit((n) => {
        n.set(SOURCE, sourceId);
        n.set(TAB, tab);
      }, false),
    [edit],
  );
  const setTab = useCallback((tab: SettingsTab) => edit((n) => n.set(TAB, tab), true), [edit]);
  const close = useCallback(
    () =>
      edit((n) => {
        n.delete(SOURCE);
        n.delete(TAB);
      }, true),
    [edit],
  );
  return { sourceId: params.get(SOURCE), tab: parseTab(params.get(TAB)), open, setTab, close };
}

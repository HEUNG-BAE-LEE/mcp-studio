// 엠버링크 ProjectContext 자리 — 위자드가 쓰는 것은 switchTo · refresh 둘뿐이다.
// 이음에서는 위자드가 콘솔 위 iframe 으로 뜨므로, 둘 다 콘솔(부모 창)에 알린다.
import { notifyConsole } from "./bridge";

export function useProjects() {
  return {
    switchTo: (projectId) => notifyConsole("switch", { projectId }),
    refresh: async () => notifyConsole("refresh"),
  };
}

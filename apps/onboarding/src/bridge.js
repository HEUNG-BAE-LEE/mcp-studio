// 콘솔(부모 창)과 주고받는 메시지. 같은 출처일 때만 보낸다.
export function notifyConsole(action, detail = {}) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "ieum-onboarding", action, ...detail }, window.location.origin);
  }
}

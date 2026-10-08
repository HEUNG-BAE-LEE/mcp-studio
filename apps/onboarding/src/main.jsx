// 이음 콘솔의 '한 번에 연결' iframe 페이지. 엠버링크 온보딩 위자드(OnboardingV2)를 그대로 띄운다.
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./compass.css";
import OnboardingV2 from "./screens/OnboardingV2";
import { activeDraftId } from "./onboardingDrafts";
import { notifyConsole } from "./bridge";

// 콘솔과 같은 테마 — 콘솔은 data-theme 이 있으면 그것을, 없으면 OS 설정을 따른다
function syncTheme() {
  let t = null;
  try { t = window.parent.document.documentElement.getAttribute("data-theme"); } catch { /* 다른 출처면 OS 설정 */ }
  if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
}
syncTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);
try {
  new MutationObserver(syncTheme).observe(window.parent.document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
} catch { /* 단독으로 열었을 때 */ }

const go = (screen, nav) => notifyConsole("enter", { screen, nav });
const onClose = () => notifyConsole("close");

createRoot(document.getElementById("root")).render(
  <OnboardingV2 go={go} draftId={activeDraftId() || undefined} onClose={onClose} />,
);

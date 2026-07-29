/**
 * 툴바 아이콘을 눌렀을 때 열리는 팝업.
 *
 * 이 파일은 오랫동안 WXT 스캐폴드(React 로고와 카운터, "Edit App.tsx to test
 * HMR")로 남아 있었다. 제품 어디에도 연결되지 않은 화면이 툴바 클릭이라는
 * 가장 흔한 입구에 놓여 있던 셈이다.
 *
 * 팝업은 **입구만** 담당한다. 수집·기록은 전부 사이드패널에 있고, 여기서
 * 같은 UI 를 한 벌 더 만들면 두 벌을 계속 맞춰야 한다.
 */

// 데모 전용. background.ts 의 API_BASE 와 같은 방식으로 상수에 둔다.
const ADMIN_BASE = "http://localhost:5173";

export default function App() {
  async function openSidePanel() {
    // sidePanel.open 은 사용자 제스처 안에서만 허용된다. 클릭 핸들러에서
    // 곧바로 부르고, 연 뒤에는 팝업을 닫아 준다.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    window.close();
  }

  return (
    <div className="popup">
      <div className="popup-brand">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <strong>MCP Studio</strong>
      </div>

      <button type="button" className="btn btn-primary" onClick={openSidePanel}>
        사이드패널 열기
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          chrome.tabs.create({ url: ADMIN_BASE });
          window.close();
        }}
      >
        관리자 화면 열기
      </button>

      <div className="popup-foot">
        <p className="help">API 수집과 기록은 사이드패널에서 진행합니다</p>
      </div>
    </div>
  );
}

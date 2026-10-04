import { useCallback, useEffect, useState } from "react";

/**
 * 브라우저 확장이 깔렸는지 알아내고, 사이드패널을 연다.
 *
 * 트래픽 수집은 확장에서 시작하는데, 화면은 확장이 있는지조차 몰랐다.
 * 그래서 "확장을 여세요"라는 안내문만 띄우고 아무 버튼도 없었다 —
 * 사용자는 여기서 시작하는 줄 알고 들어왔다가 할 수 있는 게 없다.
 *
 * 확장의 content script 가 우리 화면에서만 <html> 에 표식을 남긴다.
 * 그 표식을 읽어 화면을 세 갈래로 나눈다: 확인 중 · 없음 · 있음.
 */

const MARK = "data-mcp-studio-ext";

/** 확장이 들고 있는 기록 상태. 서버에는 아직 없는 값이다 —
 *  확장은 종료 시점에 한 번에 올리기 때문이다. */
export type LiveState = {
  recording: boolean;
  sessionId: number | null;
  interactionCount: number;
  networkCount: number;
  lastError: string | null;
  canRetry: boolean;
};

export type ExtState =
  | { status: "checking" }
  | { status: "missing" }
  | { status: "ready"; version: string };

export function useExtension() {
  const [state, setState] = useState<ExtState>({ status: "checking" });
  const [live, setLive] = useState<LiveState | null>(null);
  const [panelHint, setPanelHint] = useState<string | null>(null);

  useEffect(() => {
    function read(): string | null {
      return document.documentElement.getAttribute(MARK);
    }

    const found = read();
    if (found) {
      setState({ status: "ready", version: found });
      return;
    }

    // content script 는 document_start 에 돌지만, 확장을 방금 설치했거나
    // 서비스 워커가 자다 깨는 경우 우리 렌더보다 늦을 수 있다. 곧장
    // "없음"으로 단정하면 멀쩡한 확장을 두고 설치 안내를 띄우게 된다.
    const observer = new MutationObserver(() => {
      const v = read();
      if (v) {
        setState({ status: "ready", version: v });
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [MARK] });

    // 1.2초는 사람이 "안 뜨네" 하고 느끼기 직전이다. 그때까지 안 오면 없다.
    const timer = window.setTimeout(() => {
      observer.disconnect();
      setState((cur) => (cur.status === "checking" ? { status: "missing" } : cur));
    }, 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // 기록 중 건수를 확장에서 가져온다. 2초는 숫자가 오르는 게 보이면서
  // 메시지가 과하지 않은 간격이다. 탭이 숨으면 묻지 않는다.
  useEffect(() => {
    if (state.status !== "ready") return;

    function onState(event: MessageEvent) {
      if (event.source !== window) return;
      const d = event.data as { source?: string; type?: string; ok?: boolean; state?: LiveState };
      if (d?.source !== "mcp-studio-ext" || d.type !== "state") return;
      setLive(d.ok && d.state ? d.state : null);
    }

    function ask() {
      if (document.hidden) return;
      window.postMessage({ source: "mcp-studio-web", type: "get-state" }, window.location.origin);
    }

    window.addEventListener("message", onState);
    ask();
    const timer = window.setInterval(ask, 2000);
    return () => {
      window.removeEventListener("message", onState);
      window.clearInterval(timer);
    };
  }, [state.status]);

  /** 사이드패널 열기. 반드시 클릭 핸들러 안에서 불러야 한다 —
   *  Chrome 은 사용자 제스처 직후에만 사이드패널을 열어 준다. */
  const openPanel = useCallback(() => {
    setPanelHint(null);

    function onReply(event: MessageEvent) {
      if (event.source !== window) return;
      const d = event.data as { source?: string; type?: string; ok?: boolean };
      if (d?.source !== "mcp-studio-ext" || d.type !== "open-panel-result") return;
      window.removeEventListener("message", onReply);
      if (!d.ok) {
        // 제스처 판정에 걸리거나 브라우저가 막으면 여기로 온다. 실패를
        // 숨기지 않고 사람이 할 수 있는 다음 행동을 알려준다.
        setPanelHint("브라우저가 자동 열기를 막았습니다. 주소창 옆 확장 아이콘을 눌러 주세요.");
      }
    }

    window.addEventListener("message", onReply);
    window.postMessage({ source: "mcp-studio-web", type: "open-panel" }, window.location.origin);

    // 응답이 아예 안 오는 경우(확장이 자는 중)도 안내한다.
    window.setTimeout(() => {
      window.removeEventListener("message", onReply);
      setPanelHint((cur) =>
        cur ?? "응답이 없습니다. 주소창 옆 확장 아이콘을 눌러 사이드패널을 열어 주세요.");
    }, 1500);
  }, []);

  return { state, live, openPanel, panelHint };
}

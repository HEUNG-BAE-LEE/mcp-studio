import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useExtension } from "../hooks/useExtension";
import AutoCrawlPanel from "./AutoCrawlPanel";

/**
 * 트래픽 기반 수집 — 확장으로 관측하는 방식.
 *
 * 전에는 이 탭에 안내문 네 줄만 있었다. 화면은 확장이 깔렸는지도, 지금
 * 기록 중인지도 몰랐고, 누를 것도 없었다. 사용자가 여기서 시작하는 줄 알고
 * 들어왔다가 빈손으로 나가는 자리였다.
 *
 * 이제 두 갈래를 준다.
 *   자동 — 로그인만 사람이 하고, 화면 탐색은 기계가 한다
 *   확장 — 사람이 직접 돌아다니며 관측한다 (문서도 자동도 안 되는 곳)
 *
 * 자동이 기본값이다. 고객이 화면을 하나씩 눌러 줄 이유가 없기 때문이다.
 * 다만 자동이 막히는 곳(SPA 동적 렌더, 다단계 폼)이 실제로 있어서
 * 확장을 탈출구로 항상 남긴다 — 자동이 실패해도 제품이 실패하지 않는다.
 */

type Active = {
  id: number; projectId: number; projectName: string; kind: string;
  sourceLabel: string; startedAt: string | null; clicks: number; calls: number;
};

/** 확장 설치 경로. 개발 빌드 산출물을 그대로 로드한다. */
const LOAD_PATH = "apps/extension/.output/chrome-mv3";

function elapsed(iso: string | null): string {
  if (!iso) return "–";
  const sec = Math.max(0, Math.round((Date.now() - new Date(`${iso}Z`).getTime()) / 1000));
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

export default function TrafficPanel({
  projectId, projectName,
}: {
  projectId: number | null;
  projectName: string;
}) {
  const { state, live, openPanel, panelHint } = useExtension();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [active, setActive] = useState<Active[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.get("/api/recording-sessions/active")
      .then(setActive)
      .catch(() => setActive([]));
  }, []);

  useEffect(() => {
    load();
    // 기록 중에는 건수가 계속 오른다. 3초면 사람이 "잡히고 있구나"를
    // 느끼기에 충분하고, 서버에 부담도 없다. 탭이 숨으면 멈춘다.
    const t = window.setInterval(() => {
      if (!document.hidden) load();
    }, 3000);
    return () => window.clearInterval(t);
  }, [load]);

  const mine = active.filter((a) => a.projectId === projectId);
  const others = active.filter((a) => a.projectId !== projectId);

  return (
    <div className="tf">
      <div className="tf-modes" role="tablist" aria-label="트래픽 수집 방식">
        <button type="button" role="tab" aria-selected={mode === "auto"}
                className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>
          <b>자동 탐색</b>
          <span>로그인만 하면 기계가 돌아다닙니다</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === "manual"}
                className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>
          <b>직접 관측</b>
          <span>확장을 켜고 사람이 화면을 조작합니다</span>
        </button>
      </div>

      {mode === "auto" && (
        <AutoCrawlPanel projectId={projectId} projectName={projectName} />
      )}

      {mode === "manual" && (<>
      {/* ── 확장 상태 ── */}
      {state.status === "checking" && (
        <div className="tf-bar is-checking">
          <span className="tf-dot" aria-hidden="true" />
          <span>브라우저 확장을 확인하는 중…</span>
        </div>
      )}

      {state.status === "missing" && (
        <div className="tf-bar is-missing">
          <div className="tf-bar-head">
            <span className="tf-dot" aria-hidden="true" />
            <strong>브라우저 확장이 필요합니다</strong>
          </div>
          <p>
            트래픽 기반 수집은 화면 뒤에서 오간 API 호출을 관측합니다.
            그 관측은 브라우저 안에서 일어나므로 확장을 먼저 설치해야 합니다.
          </p>
          <ol className="steps">
            <li>주소창에 <code>chrome://extensions</code> 를 열고 <strong>개발자 모드</strong>를 켭니다</li>
            <li><strong>압축해제된 확장 프로그램을 로드</strong>를 누릅니다</li>
            <li>
              아래 폴더를 고릅니다
              <span className="tf-path">
                <code>{LOAD_PATH}</code>
                <button type="button" className="btn btn-sm"
                        onClick={() => {
                          navigator.clipboard?.writeText(LOAD_PATH);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1800);
                        }}>
                  {copied ? "복사됨" : "경로 복사"}
                </button>
              </span>
            </li>
            <li>설치가 끝나면 <strong>이 페이지를 새로고침</strong>합니다</li>
          </ol>
        </div>
      )}

      {state.status === "ready" && (
        <div className="tf-bar is-ready">
          <div className="tf-bar-head">
            <span className="tf-dot" aria-hidden="true" />
            <strong>확장이 연결됐습니다</strong>
            <span className="mono t3">v{state.version}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={openPanel}>
              사이드패널 열기
            </button>
          </div>
          {panelHint && <p className="tf-hint">{panelHint}</p>}
        </div>
      )}

      {/* ── 기록 중 ──
          건수는 확장에서 온다. 서버는 아직 모른다 — 확장이 종료 시점에
          한 번에 올리기 때문이다(중간에 그만두면 아무것도 남기지 않는
          의도된 설계). 그래서 "아직 전송 전"임을 화면이 분명히 말한다. */}
      {live?.recording && (
        <div className="tf-live">
          <div className="tf-live-head">
            <span className="tf-pulse" aria-hidden="true" />
            <strong>지금 기록 중</strong>
            <span className="mono t3">세션 #{live.sessionId ?? "–"}</span>
          </div>
          <div className="tf-live-row">
            <span className="tf-live-nm">
              <b>브라우저에서 모으는 중</b>
              <span className="mono">아직 서버로 보내지 않았습니다</span>
            </span>
            <span className="tf-live-kv"><b className="num">{live.interactionCount}</b><span>클릭</span></span>
            <span className="tf-live-kv"><b className="num">{live.networkCount}</b><span>호출</span></span>
          </div>
          <p className="tf-hint">
            확장 사이드패널에서 <strong>기록 종료 및 전송</strong>을 누르면 후보가 정리됩니다.
          </p>
        </div>
      )}

      {/* 전송이 실패해 기록이 확장에 남아 있는 상태. 이걸 안 보여주면
          사용자는 수집이 끝난 줄 알고 브라우저를 닫아 기록을 잃는다. */}
      {live && !live.recording && live.canRetry && (
        <div className="tf-bar is-missing">
          <div className="tf-bar-head">
            <span className="tf-dot" aria-hidden="true" />
            <strong>전송하지 못한 기록이 남아 있습니다</strong>
          </div>
          <p>
            클릭 {live.interactionCount}건 · 호출 {live.networkCount}건이 확장에 그대로 있습니다.
            사이드패널에서 <strong>다시 보내기</strong>를 누르세요.
            {live.lastError && <> 마지막 오류: {live.lastError}</>}
          </p>
        </div>
      )}

      {/* 서버가 아는 '시작된 세션'. 확장이 다른 탭·다른 창에 있어도 잡힌다. */}
      {mine.length > 0 && !live?.recording && (
        <div className="tf-live">
          <div className="tf-live-head">
            <span className="tf-pulse" aria-hidden="true" />
            <strong>시작된 세션이 있습니다</strong>
          </div>
          {mine.map((a) => (
            <div key={a.id} className="tf-live-row">
              <span className="tf-live-nm">
                <b>{a.sourceLabel || "대상 사이트"}</b>
                <span className="mono">{elapsed(a.startedAt)} 경과 · 다른 탭에서 기록 중</span>
              </span>
              <Link className="btn btn-sm" to={`/sessions/${a.id}`}>보기</Link>
            </div>
          ))}
        </div>
      )}

      {/* 다른 프로젝트에서 기록 중이면 알려준다. 안 알려주면 사용자가
          엉뚱한 프로젝트에 담고 나서야 알아챈다. */}
      {others.length > 0 && (
        <p className="tf-other mono">
          다른 프로젝트에서 {others.length}건 기록 중 —{" "}
          {others.map((o) => o.projectName).join(", ")}
        </p>
      )}

      {/* ── 사용 순서 ── */}
      <div className="tf-how">
        <div className="skl-lbl" style={{ marginTop: 0 }}>이렇게 씁니다</div>
        <ol className="steps">
          <li>수집하려는 <strong>대상 사이트를 새 탭에서 엽니다</strong></li>
          <li>그 탭에서 확장 아이콘을 눌러 사이드패널을 엽니다</li>
          <li>
            프로젝트 이름에 <strong>{projectName || `#${projectId}`}</strong> 을 그대로 넣습니다 —
            같은 이름이면 이 프로젝트에 담깁니다
          </li>
          <li>버튼·필터처럼 <strong>페이지가 넘어가지 않는 조작</strong>을 클릭합니다</li>
          <li>
            <strong>기록 종료 및 전송</strong> 후{" "}
            {projectId
              ? <Link to={`/projects/${projectId}`}>수집현황</Link>
              : "수집현황"}에서 후보를 고릅니다
          </li>
        </ol>

        <p className="guide-note">
          <strong>확장을 새로고침했다면 대상 페이지도 새로고침하세요</strong>
          이미 열려 있던 탭의 스크립트는 고아가 되어 클릭이 하나도 잡히지 않습니다.
          화면에는 오류 없이 “0 클릭”만 보여 알아채기 어렵습니다.
        </p>
      </div>
      </>)}
    </div>
  );
}

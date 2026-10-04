import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

/**
 * 실시간 MCP 호출 모니터.
 *
 * "지금 잘 돌고 있나"를 숫자 하나가 아니라 흐름으로 답한다. 이 제품에서
 * 사용자가 가장 자주 하는 질문이 "내 에이전트가 지금 제대로 도구를 부르고
 * 있나"인데, 그 답이 별도 메뉴 안에 있으면 문제가 생겨도 늦게 안다.
 *
 * 본문(파라미터·응답)은 서버에서부터 남기지 않으므로 여기에도 오지 않는다.
 * 나중에 빼는 것보다 처음부터 안 넣는 편이 쉽다.
 *
 * 갱신은 5초 간격이다. 1초 폴링은 사용자 100명이면 초당 100요청이라,
 * 사람이 변화를 느끼는 최소 간격까지만 좁힌다. 탭이 보이지 않으면 멈춘다 —
 * 안 보는 화면에 트래픽을 쓰지 않는다.
 */

type Bar = { n: number; fail: number; skill: number };
type Stream = { tool: string; kind: string; status: number; ms: number; project: string };
type Live = {
  rps: number; series: number[]; bars: Bar[]; today: number;
  successRate: number; p95: number; stream: Stream[];
};

/** 꺾은선을 SVG path 로. 값이 모두 0 이어도 바닥선이 그려지도록 최솟값을 둔다. */
function toPath(series: number[], w: number, h: number): { line: string; area: string } {
  if (!series.length) return { line: "", area: "" };
  const max = Math.max(...series, 1);
  const step = w / Math.max(1, series.length - 1);
  const pts = series.map((v, i) => [i * step, h - (v / max) * (h - 12) - 6] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
}

export default function LiveMonitor() {
  const [live, setLive] = useState<Live | null>(null);
  const [tick, setTick] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    function pull() {
      // 탭이 뒤에 있으면 건너뛴다. 요청 자체를 안 보내는 것이 핵심이다.
      if (document.hidden) return;
      api.get("/api/metrics/live")
        .then((r) => {
          if (!alive) return;
          setLive(r);
          setTick(new Date().toTimeString().slice(0, 8));
        })
        .catch(() => { /* 모니터가 죽어도 화면 전체는 살아 있어야 한다 */ });
    }

    pull();
    timer.current = window.setInterval(pull, 5000);
    document.addEventListener("visibilitychange", pull);
    return () => {
      alive = false;
      if (timer.current) window.clearInterval(timer.current);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  const { line, area } = toPath(live?.series ?? [], 600, 108);
  const maxBar = Math.max(1, ...(live?.bars ?? []).map((b) => b.n));

  return (
    <section className="live" aria-label="실시간 호출">
      <header className="live-h">
        <span className="live-dot" aria-hidden="true" />
        <strong>실시간 MCP 호출</strong>
        <span className="chip-soft">최근 5분</span>
        <span className="live-tick mono">{tick ? `${tick} 갱신` : "연결 중"}</span>
      </header>

      <div className="live-rps">
        <b className="mono">{live ? live.rps.toFixed(1) : "–"}</b>
        <span className="mono">호출 / 초</span>
      </div>

      <div className="live-chart">
        <svg viewBox="0 0 600 108" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="lm-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--kind-portal)" stopOpacity=".3" />
              <stop offset="100%" stopColor="var(--kind-portal)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lm-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--kind-portal)" stopOpacity=".45" />
              <stop offset="60%" stopColor="var(--kind-portal)" />
              <stop offset="100%" stopColor="var(--brand)" />
            </linearGradient>
          </defs>
          <g className="live-grid">
            <line x1="0" y1="20" x2="600" y2="20" /><line x1="0" y1="54" x2="600" y2="54" />
            <line x1="0" y1="88" x2="600" y2="88" />
          </g>
          {area && <path d={area} fill="url(#lm-area)" />}
          {line && (
            <path d={line} fill="none" stroke="url(#lm-line)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>

      {/* 최근 60초. 실패를 따로 세야 붉게 튀어 평균에 묻히지 않는다. */}
      <div className="live-bars" aria-hidden="true">
        {(live?.bars ?? Array.from({ length: 24 }, () => ({ n: 0, fail: 0, skill: 0 }))).map((b, i) => (
          <i
            key={i}
            className={b.fail > 0 ? "is-fail" : b.skill > b.n / 2 ? "is-skill" : ""}
            style={{ height: `${Math.max(6, (b.n / maxBar) * 100)}%` }}
          />
        ))}
      </div>
      <div className="live-legend mono">
        <span><i className="dot-portal" />MCP 호출</span>
        <span><i className="dot-document" />스킬 실행</span>
        <span><i className="dot-fail" />실패</span>
        <span className="sp">최근 60초 · 막대 하나 = 2.5초</span>
      </div>

      <div className="live-stream">
        {(live?.stream ?? []).map((s, i) => (
          <div key={`${s.tool}-${i}`} className="live-row mono">
            <span className={`st ${s.status >= 400 ? "is-fail" : s.kind === "skill" ? "is-skill" : "is-ok"}`} />
            <span className="id">{s.tool}</span>
            <span className="pj">{s.project}</span>
            <span className="ms">{s.status >= 400 ? s.status : `${s.ms}ms`}</span>
          </div>
        ))}
        {!live?.stream.length && <p className="t4 mono">아직 호출이 없습니다</p>}
      </div>

      <div className="live-gauge">
        <div><b className="num">{live ? live.today.toLocaleString() : "–"}</b><span>오늘 호출</span></div>
        <div><b className="num">{live ? `${live.successRate}%` : "–"}</b><span>성공률</span></div>
        <div><b className="num">{live ? `${live.p95}ms` : "–"}</b><span>P95 응답</span></div>
      </div>
    </section>
  );
}

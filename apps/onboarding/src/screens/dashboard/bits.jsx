import { useEffect, useRef, useState } from "react";
import TrailingDots from "../../ui/TrailingDots";

/* 대시보드 공용 조각 — 스타일 토큰(sx)·연출형 empty state·KPI 카드·헤더류.
   Dashboard.jsx(조립)·panels.jsx(패널)·ActivityHero.jsx(진행 히어로)가 공유한다. */

export const REDUCED = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

export const METHOD_COLOR = { GET: "var(--green)", POST: "var(--blue)", PUT: "var(--amber)", PATCH: "var(--purple)", DELETE: "var(--red)" };

export const STATE_COLOR = { healthy: "var(--green)", degraded: "var(--amber)", broken: "var(--red)", unverified: "var(--muted)",
  pending: "var(--muted)", running: "var(--blue)", done: "var(--green)", warn: "var(--amber)", fail: "var(--red)" };

/* health 리소스 → 대시보드 상태 (기획 §5: failed>0→broken, warning/warned>0→degraded, smoke없음→unverified) */
export function deriveState(r) {
  const c = r.classify || {}, s = r.smoke || {};
  if ((c.failed || 0) > 0 || (s.failed || 0) > 0) return "broken";
  if ((c.warning || 0) > 0 || (s.warned || 0) > 0) return "degraded";
  if ((s.total || 0) === 0) return "unverified";
  return "healthy";
}

export function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return "—"; }
}

/* requestAnimationFrame 카운트업 (reduced-motion이면 즉시 확정) */
export function useCountUp(target, dur = 900) {
  const [v, setV] = useState(REDUCED ? target : 0);
  const ref = useRef(0);
  useEffect(() => {
    if (target == null) { setV(0); return; }
    if (REDUCED) { setV(target); return; }
    const from = ref.current || 0; ref.current = target;
    let raf, t0;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

export function Num({ value, dec = 0, comma }) {
  const v = useCountUp(typeof value === "number" ? value : null);
  if (typeof value !== "number") return <>—</>;
  const s = v.toFixed(dec);
  return <>{comma ? Number(s).toLocaleString() : s}</>;
}

/* 실제 렌더 폭을 재서 SVG 좌표계를 화면과 1:1 로 맞춘다.
   viewBox 를 고정해두고 preserveAspectRatio="none" 로 늘리면 x 축만 크게 확대돼
   <circle> 이 가로로 늘어난 타원이 된다(#503). 선은 non-scaling-stroke 로 버티지만
   fill 도형은 방법이 없다. 폭을 재서 그대로 viewBox 에 쓰면 배율이 1:1 이라 안 찌그러진다. */
export function useChartWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof ResizeObserver === "undefined") {   // 구형 브라우저 — 한 번만 재고 만다
      setWidth(Math.round(node.getBoundingClientRect().width));
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/* ── 소형 아이콘 — 유니코드 글리프(⟳ ● ■ ⚠) 대체 ── */
/* 로딩 표시는 앱 전체가 TrailingDots 하나를 쓴다(#496). 호출부가 많아 이름만 남겨 재수출한다. */
export const Spinner = ({ size = 12, color = "currentColor" }) => (
  <TrailingDots size={size} color={color} />
);
export const Dot = ({ color, size = 7 }) => (
  <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
);
export const Sq = ({ color }) => <span style={{ ...sx.sq, background: color }} />;
export const CheckIco = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
export const WarnIco = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" />
  </svg>
);
export const JumpIco = ({ size = 9 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
);
/* KPI 지표별 아이콘 — 라벨만으로 구분되던 5칸에 시각 앵커 부여 */
const kico = (path) => ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const CubeIco = kico(<><path d="m21 8-9-5-9 5v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v9" /></>);
export const PulseIco = kico(<path d="M22 12h-4l-3 8-6-16-3 8H2" />);
export const CheckCircleIco = kico(<><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m9 11 3 3L22 4" /></>);
export const GaugeIco = kico(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const ShieldIco = kico(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);

/* ── 패널 헤더 — 액센트 틱 + 제목 + "이 패널이 주는 정보" 부제 상시 노출, 하단 헤어라인으로 본문과 구분 ── */
export function PanelHead({ title, sub, right }) {
  return (
    <div style={sx.phead}>
      <span style={sx.ptick} />
      <div style={sx.lbl}>{title}</div>
      {sub && <div style={sx.lblSub}>{sub}</div>}
      {right}
    </div>
  );
}

/* ── 연출형 empty state 공용 ── */
export const CTA = ({ onClick, children }) => (
  <span role="button" tabIndex={0} onClick={onClick}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
    style={sx.cta}>{children} →</span>
);
export function EmptyState({ visual, title, hint, cta, onCta }) {
  return (
    <div style={sx.es}>
      {visual}
      <div style={sx.esTitle}>{title}</div>
      {hint && <div style={sx.esHint}>{hint}</div>}
      {cta && <CTA onClick={onCta}>{cta}</CTA>}
    </div>
  );
}
export const Breathe = ({ size = 52 }) => (
  <div className="dash-breathe" style={size !== 52 ? { width: size, height: size } : undefined}>
    <span className="ring" /><span className="ring" style={{ animationDelay: "1.2s" }} /><span className="core" />
  </div>
);
export const Equalizer = () => (
  <div className="dash-eq">{[0, .15, .3, .45, .6, .35, .2].map((d, i) => <i key={i} style={{ animationDelay: `${d}s` }} />)}</div>
);
export const GhostLine = ({ tall }) => (
  <div className={tall ? "dash-ghost dash-ghost--chart" : "dash-ghost"}><span className="sweep" />
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
      <polyline points="0,15 20,13 40,15 60,11 80,14 100,12" fill="none" stroke="var(--line2)" strokeWidth="1.4" strokeDasharray="3 4" />
    </svg>
  </div>
);

/* ── 로딩 스켈레톤 행 — booted 전·이력 empty 공용 ── */
export function SkelRows({ n = 3 }) {
  return (
    <div style={{ marginTop: 10 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={sx.skelRow}>
          <span className="dash-skel" style={{ width: 44, height: 14 }} />
          <span className="dash-skel" style={{ width: 34, height: 12 }} />
          <span className="dash-skel" style={{ flex: 1, height: 10 }} />
          <span className="dash-skel" style={{ width: 32, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

/* ── 빈 값 캡슐 — 사선 해치 + 대기 문구 + 셔머 스윕(.dash-vacant)으로 '의도된 대기 상태'를 표현 ── */
export const Vacant = ({ label }) => (
  <span className="dash-vacant" style={sx.vacant}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", flexShrink: 0,
      animation: REDUCED ? "none" : "dashBlink 1.8s ease-in-out infinite" }} />
    {label}
  </span>
);

/* ── 계기판 메트릭 — 카드가 아닌 디바이더로 구분되는 인라인 계기(.dash-instr 안에서 사용) ── */
export function Metric({ label, value, sub, onClick, alert, idle, accent = "var(--blue)", icon, vacantLabel, spark }) {
  const Tag = onClick ? "button" : "div";
  const pts = !idle && spark && spark.length > 1
    ? spark.map((v, i) => {
        const max = Math.max(1, ...spark);
        return `${(i / (spark.length - 1)) * 56},${18 - (v / max) * 16}`;
      }).join(" ")
    : null;
  return (
    <button type="button" className="dash-metric" onClick={onClick} style={{ ...sx.metric, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ color: idle ? "var(--muted)" : accent, display: "inline-flex" }}>{icon}</span>}
        <span style={sx.metricLabel}>{label}</span>
        {onClick && <span style={{ color: "var(--muted)", display: "inline-flex" }}><JumpIco /></span>}
      </div>
      {idle
        ? <Vacant label={vacantLabel} />
        : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <div className="mono" style={{ ...sx.metricValue, color: alert ? "var(--amber)" : "var(--navy)" }}>{value}</div>
            {pts && (
              <svg viewBox="0 0 56 18" preserveAspectRatio="none" style={{ width: 56, height: 18, flexShrink: 0 }}>
                <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        )}
      {!idle && sub && <div style={sx.metricSub}>{sub}</div>}
    </button>
  );
}

/* ── HEALTH 링 — 성공률·스모크·실패 리소스에서 종합한 0~100 게이지.
   신호 없으면 standby: 회전 점선 트랙 + 레이더 스윕 + 블립으로 '신호 탐색 중'을 연출 ── */
export function HealthRing({ score, standby, label, size = 118 }) {
  const R = 44, C = 2 * Math.PI * R;
  /* 좌표계는 118 기준 viewBox 그대로 두고 표시 크기만 키운다 — 오버레이는 비례 보정 */
  const f = size / 118;
  const color = score == null ? "var(--muted)" : score >= 90 ? "var(--blue)" : score >= 70 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 118 118">
        {standby ? (
          <g>
            <g style={{ transformBox: "view-box", transformOrigin: "59px 59px", animation: REDUCED ? "none" : "spin 14s linear infinite" }}>
              <circle cx="59" cy="59" r={R} fill="none" stroke="var(--line2)" strokeWidth="9" strokeDasharray="3 7" />
            </g>
            <g style={{ transformBox: "view-box", transformOrigin: "59px 59px", animation: REDUCED ? "none" : "spin 3.6s linear infinite" }}>
              <path d="M59 59 L103 59 A44 44 0 0 1 92.71 87.29 Z" fill="var(--hud)" opacity=".13" />
              <line x1="59" y1="59" x2="103" y2="59" stroke="var(--hud)" strokeWidth="1.6" opacity=".7" />
            </g>
            {/* 블립 좌표는 중앙 점(44~74)과 SCANNING 라벨 밴드(y 76~86)를 피해 배치한다 */}
            {[[38, 42], [76, 34], [72, 90], [48, 92]].map(([bx, by], i) => (
              <circle key={i} cx={bx} cy={by} r="2.2" fill="var(--hud)"
                style={{ animation: REDUCED ? "none" : `dashBlink ${(1.6 + i * 0.5).toFixed(1)}s ease-in-out infinite`, animationDelay: `${i * 0.4}s` }} />
            ))}
          </g>
        ) : (
          <>
            <circle cx="59" cy="59" r={R} fill="none" stroke="var(--line2)" strokeWidth="9" />
            {score != null && (
              <circle cx="59" cy="59" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${(C * score) / 100} ${C}`} transform="rotate(-90 59 59)"
                style={{ transition: "stroke-dasharray .9s ease" }} />
            )}
          </>
        )}
      </svg>
      {/* 점(점수)은 회전축(59,59)과 정확히 일치해야 스윕 바늘이 중심을 도는 것으로
          읽힌다 — 라벨을 flex 흐름에 넣으면 점이 위로 밀리므로 절대 위치로 분리한다 */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {standby ? <Breathe size={Math.round(30 * f)} /> : <b style={{ fontFamily: "var(--disp)", fontSize: Math.round(30 * f), lineHeight: 1, color }}>{score}</b>}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 76 * f, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: Math.min(12, 9.5 * f), letterSpacing: ".2em", color: "var(--muted)" }}>{standby ? "SCANNING" : label}</span>
      </div>
    </div>
  );
}

/* ── 레일 블록 — 사이드 컬럼을 구성하는 HUD 프레임 패널 단위 (panel과 동일 크롬).
   subgrid 행에 맞춰 늘어난 높이를 본문이 고르게 나눠 채운다 (허전한 하단 여백 방지).
   className으로 그리드 배치 클래스(.hud-row2 등)를 덧붙일 수 있다 ── */
export function RailBlock({ title, sub, right, children, className }) {
  return (
    <section className={className ? `hud-panel ${className}` : "hud-panel"} style={sx.panelCol}>
      <PanelHead title={title} sub={sub} right={right} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>{children}</div>
    </section>
  );
}

/* ── styles — Neural HUD(관제 데크) 문법. 토큰은 .dashv2 스코프가 재정의한다(--hud-* = 데크 크롬).
   가독성 원칙: 본문·데이터 ≥10.5px, 라벨·칩 ≥10px — 8px대 금지.
   레이아웃(hudgrid/side/core)은 반응형을 위해 styles.css의 hud-* · dash-* 클래스 사용. */
const card = {
  background: "linear-gradient(180deg,var(--hud-tint),transparent 38%), var(--hud-panel-bg)",
  border: "1px solid var(--hud-line)", borderRadius: 10, boxShadow: "var(--dash-card-shadow)",
};
export const sx = {
  /* 데크 상단 테두리의 시계 배지 (.hud-clock) 내부 숫자 */
  clock: { fontFamily: "var(--disp)", fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--hud)", letterSpacing: ".04em" },
  pulseDot: { width: 10, height: 10, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 10px var(--green)", animation: REDUCED ? "none" : "dashBlink 2s ease-in-out infinite", flexShrink: 0 },

  /* 계기 항목 (.dash-instr가 디바이더·간격 담당) */
  metric: { background: "transparent", border: 0, textAlign: "left", minWidth: 0, padding: 0 },
  metricLabel: { fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", letterSpacing: ".12em", color: "var(--muted)", textTransform: "uppercase" },
  metricValue: { fontFamily: "var(--disp)", fontSize: "var(--fs-metric)", fontWeight: 600, lineHeight: 1, margin: "8px 0 3px" },
  metricSub: { fontSize: "var(--fs-caption)", color: "var(--muted)", marginTop: 2 },
  vacant: { display: "flex", width: "100%", boxSizing: "border-box", alignItems: "center", gap: 7,
    fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", color: "var(--muted)",
    padding: "8px 12px", margin: "6px 0 2px", borderRadius: 8, border: "1px dashed var(--line2)",
    background: "repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 8px)" },
  unit: { fontStyle: "normal", fontSize: "var(--fs-caption)", color: "var(--muted)", fontWeight: 400 },

  hatchCell: { display: "inline-block", width: 30, height: 9, borderRadius: 3, verticalAlign: "middle",
    background: "repeating-linear-gradient(45deg,var(--line2) 0 3px,transparent 3px 7px)", opacity: .85 },

  /* 온보딩 백그라운드 배너 — 데크 최상단 슬림 스트립 (실행중=teal, 완료=green, 실패=amber 오버라이드) */
  onbBand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    background: "var(--blue-soft)", border: "1px solid rgba(47,134,246,.28)", borderLeft: "3px solid var(--blue)",
    borderRadius: 12, padding: "9px 14px", animation: "fadeUp .3s ease-out" },
  bgBadge: { fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", fontWeight: 600, letterSpacing: ".08em", color: "var(--blue)",
    border: "1px solid rgba(47,134,246,.4)", borderRadius: 99, padding: "2px 8px", textTransform: "uppercase" },

  panel: { ...card, padding: "14px 16px", minWidth: 0 },
  phead: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", paddingBottom: 9, borderBottom: "1px solid var(--line)" },
  ptick: { width: 3, height: 12, borderRadius: 2, background: "var(--hud)", alignSelf: "center", flexShrink: 0 },
  lbl: { fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", letterSpacing: ".1em", color: "var(--navy)", textTransform: "uppercase", fontWeight: 600 },
  lblSub: { fontSize: "var(--fs-caption)", color: "var(--muted)" },
  empty: { fontSize: "var(--fs-caption)", color: "var(--muted)", padding: "18px 0", textAlign: "center" },
  es: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, textAlign: "center", padding: "22px 0" },
  esTitle: { color: "var(--text)", fontSize: "var(--fs-caption)", fontWeight: 600 },
  esHint: { fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", color: "var(--muted)", letterSpacing: ".03em" },
  cta: { marginTop: 2, fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", letterSpacing: ".04em", color: "var(--blue)", cursor: "pointer",
    border: "1px solid rgba(47,134,246,.4)", background: "rgba(47,134,246,.07)", borderRadius: 99, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 5 },
  skelRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)", opacity: .55 },

  runBadge: { fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", letterSpacing: ".08em", color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 4, padding: "2px 8px", background: "var(--amber-bg)" },
  convPct: { fontFamily: "var(--disp)", fontSize: "var(--fs-metric)", fontWeight: 600, color: "var(--blue)", minWidth: 78, textShadow: "var(--dash-glow)" },
  convBarWrap: { flex: 1, height: 10, background: "var(--main)", borderRadius: 5, overflow: "hidden" },
  convBarFill: { display: "block", height: "100%", borderRadius: 5, background: "linear-gradient(90deg,var(--blue-d),var(--blue))", boxShadow: "0 0 12px rgba(47,134,246,.4)", transition: "width .9s ease" },
  convRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: "var(--fs-caption)" },
  convName: { width: 150, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chip: { fontSize: "var(--fs-caption)", letterSpacing: ".06em", padding: "2px 8px", borderRadius: 3, border: "1px solid var(--line2)", display: "inline-flex", alignItems: "center", gap: 4 },
  convCt: { marginLeft: "auto", color: "var(--muted)", fontSize: "var(--fs-caption)" },
  logLine: { marginTop: 10, padding: "7px 10px", background: "var(--code)", color: "var(--code-text)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, fontSize: "var(--fs-caption)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

  runRow: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)" },
  runKind: { fontSize: "var(--fs-caption)", letterSpacing: ".06em", border: "1px solid var(--line2)", borderRadius: 3, padding: "1px 6px", minWidth: 46, textAlign: "center" },

  mth: { fontSize: "var(--fs-caption)", letterSpacing: ".08em", color: "var(--muted)", textAlign: "left", padding: "5px 6px", borderBottom: "1px solid var(--line2)" },
  mtr: { cursor: "pointer", borderBottom: "1px solid var(--line)" },
  mtd: { padding: "8px 6px", color: "var(--text)", whiteSpace: "nowrap" },
  sq: { display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 3, verticalAlign: -1 },
  scanline: { position: "absolute", left: 0, right: 0, height: 44, top: -44, pointerEvents: "none",
    background: "linear-gradient(180deg,transparent,rgba(47,134,246,.06) 50%,transparent)", animation: "dashScan 5.5s ease-in-out infinite" },

  liveTag: { marginLeft: "auto", fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", letterSpacing: ".1em", color: "var(--kt-red)", display: "flex", alignItems: "center", gap: 5 },
  feedRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: "var(--fs-caption)", whiteSpace: "nowrap" },

  compBar: { display: "flex", alignItems: "center", gap: 9, padding: "4px 0" },
  compTag: { width: 62, fontSize: "var(--fs-caption)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  compCt: { fontSize: "var(--fs-caption)", color: "var(--text)", minWidth: 28, textAlign: "right" },

  resultBtn: { border: 0, borderRadius: 9, padding: "9px 14px", background: "var(--blue)", color: "#fff", fontSize: "var(--fs-caption)", fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 18px rgba(47,134,246,.28)" },
  tbar: { display: "flex", alignItems: "center", gap: 9, padding: "5px 0", cursor: "pointer", fontFamily: "var(--mono)" },
  tbarName: { width: 110, fontSize: "var(--fs-caption)", color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tbarTrack: { flex: 1, height: 9, background: "var(--main)", borderRadius: 3, overflow: "hidden" },
  tbarFill: { display: "block", height: "100%", borderRadius: 3, background: "linear-gradient(90deg,var(--blue-d),var(--blue))", boxShadow: "0 0 10px rgba(47,134,246,.35)" },

  /* ── ActivityHero — 진행 중 작업 전용 히어로 (일반 패널과 시각 구분: radius 16 + 틴트 + 좌측 액센트 + 글로우) ── */
  hero: { background: "linear-gradient(180deg,rgba(47,134,246,.06),rgba(47,134,246,0) 60%), var(--blue-soft)", border: "1px solid rgba(47,134,246,.28)", borderLeft: "3px solid var(--blue)",
    borderRadius: 16, padding: "14px 17px", display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp .3s ease-out", boxShadow: "0 10px 26px rgba(4,8,16,.3)" },
  heroTitle: { display: "flex", alignItems: "center", gap: 9, color: "var(--navy)", fontSize: "var(--fs-body)", fontWeight: 600 },
  heroBtn: { border: 0, borderRadius: 8, padding: "7px 13px", background: "var(--blue)", color: "#fff", fontSize: "var(--fs-caption)", fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 18px rgba(47,134,246,.28)" },
  heroBtnGhost: { border: "1px solid var(--line2)", borderRadius: 8, padding: "6px 12px", background: "transparent", color: "var(--muted)", fontSize: "var(--fs-caption)", fontWeight: 600, cursor: "pointer" },
  heroChips: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroChip: { display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", color: "var(--text)",
    background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 99, padding: "5px 12px" },

  /* 에러 배너 — stale 데이터 유지 + 재시도 (패널별 분산 대신 한 곳) */
  errBanner: { display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", borderRadius: 10,
    border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontSize: "var(--fs-caption)", fontWeight: 600 },
  errRetry: { marginLeft: "auto", border: "1px solid var(--amber)", borderRadius: 7, padding: "4px 11px",
    background: "transparent", color: "var(--amber)", fontSize: "var(--fs-caption)", fontWeight: 600, cursor: "pointer" },
};
/* 패널 크롬 + 세로 flex — subgrid 행에 맞춰 늘어난 높이를 본문이 채우는 패널의 공통 셸.
   본문 채움은 styles.css의 .hud-fill(중앙 정렬)과 짝으로 쓴다 */
sx.panelCol = { ...sx.panel, display: "flex", flexDirection: "column" };

// 온보딩 위자드 뼈대 — 상단 스텝바 · 서브스텝 · 전폭 셸.
//
// 이전 위자드는 좌측에 180px 스텝 레일을 두어 본문이 좁았다. 스텝을 상단 가로로 올리면
// 그 폭이 그대로 본문으로 돌아온다. 상단 스텝은 채워진 알약·글로우 없이 **헤어라인 레일 +
// 소형 도트**로 그린다 — 배경을 덮는 음영은 관리 도구 화면에서 값싸 보인다.
import { useEffect, useRef, useState } from "react";
import BrandLogo from "../../components/BrandLogo";

/** 상단 큰 스텝바. 진행선은 하나의 레일이고, 지나온 구간만 색이 찬다. */
export function StepBar({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, justifyContent: "center" }}>
      {steps.map((label, i) => {
        const done = i < current, now = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {i > 0 && (
              <span style={{
                width: 34, height: 1, margin: "0 12px", borderRadius: 1,
                background: done || now ? "var(--blue)" : "var(--line2)",
                opacity: done || now ? 0.55 : 1, transition: "background .2s",
              }} />
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: done ? "var(--blue)" : now ? "var(--blue)" : "var(--line2)",
                // 현재 스텝만 얇은 링. box-shadow 글로우 대신 outline 이라 배경을 물들이지 않는다.
                outline: now ? "3px solid color-mix(in srgb,var(--blue) 22%,transparent)" : "none",
                transition: "background .2s",
              }} />
              <span style={{
                fontSize: 12.5, whiteSpace: "nowrap",
                color: now ? "var(--navy)" : done ? "var(--text)" : "var(--faint)",
                fontWeight: now ? 750 : 500,
              }}>{label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 서브스텝 점. total 이 유동적이라(선택 개수에 따라) 확정 안 된 자리는 점선으로 비워 둔다. */
export function SubDots({ index, total, pending = 0, label }) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    const done = i < index, now = i === index;
    dots.push(<span key={i} style={{
      width: 7, height: 7, borderRadius: "50%",
      background: done ? "var(--blue-d)" : now ? "var(--blue)" : "var(--line2)",
      outline: now ? "3px solid color-mix(in srgb,var(--blue) 20%,transparent)" : "none",
    }} />);
  }
  for (let i = 0; i < pending; i++) {
    dots.push(<span key={`g${i}`} style={{
      width: 7, height: 7, borderRadius: "50%", background: "transparent",
      border: "1px dashed var(--line2)", boxSizing: "border-box",
    }} />);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>{dots}</div>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".06em" }}>{label}</span>
    </div>
  );
}

/** 입력이 적은 화면용 — 가운데로 모은다. 좌측 정렬이면 오른쪽이 통째로 빈다. */
export function AskCentered({ q, why, children, width = 640 }) {
  return (
    <div style={{ maxWidth: width, margin: "0 auto", width: "100%", animation: "fadeUp .3s ease-out" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ fontSize: 25, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.03em" }}>{q}</div>
        {why && <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>{why}</div>}
      </div>
      {children}
    </div>
  );
}

/** 질문 + 이유. 화면당 질문 하나가 원칙이라 크게 묻고 이유를 바로 밑에 둔다. */
export function Ask({ q, why, badge }) {
  return (
    <div style={{ marginBottom: 16, maxWidth: 980, flexShrink: 0, animation: "fadeUp .3s ease-out" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.03em", lineHeight: 1.28 }}>{q}</div>
      {why && <div style={{ fontSize: 12.8, color: "var(--text)", marginTop: 6, lineHeight: 1.65 }}>{why}</div>}
      {badge}
    </div>
  );
}

/** 위자드 셸 — 상단바(브랜드+스텝) / 서브바 / 본문+도우미 / 하단바. */
/** @param overlay  카드 전체를 덮는 층. 본문(children)이 아니라 헤더·푸터까지 함께 덮어야
 *                  "지금은 조작할 수 없다" 가 전해진다 — 본문 안에 두면 푸터 버튼이 살아 보인다. */
export function Shell({ steps, step, sub, agent, footer, overlay, children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000, background: "rgba(5,7,11,.72)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 1640, height: "100%", maxHeight: 940, display: "flex", flexDirection: "column",
        background: "var(--app)", border: "1px solid var(--line2)", borderRadius: 18, overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,.55)", position: "relative",
      }}>
        {/* 아주 옅은 배경 메시 — 카드가 바닥에서 떠 보이게 하는 최소한. 눈에 띄면 실패다. */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(680px 320px at 22% 0%,rgba(47,134,246,.05),transparent 62%),"
                    + "radial-gradient(520px 280px at 88% 6%,rgba(122,92,255,.045),transparent 62%)",
        }} />

        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 20, padding: "0 24px",
          height: 60, borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>
          {/* 제품 로고 — 앱 사이드바와 같은 자산·같은 테마 전환 규칙을 쓴다.
              위자드만 다른 마크를 쓰면 같은 제품이 아닌 것처럼 보인다. */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <BrandLogo height={24} />
          </div>
          <StepBar steps={steps} current={step} />
          <button onClick={onClose} style={{
            flexShrink: 0, fontSize: 11.5, color: "var(--muted)", padding: "6px 12px",
            border: "1px solid var(--line2)", borderRadius: 9, background: "transparent", cursor: "pointer",
          }}>그만두기</button>
        </div>

        {/* 서브바 — 배경 톤을 깔지 않는다. 상단에 음영 띠가 겹치면 화면이 무겁고 값싸 보인다.
            구분은 헤어라인 하나로 충분하다. */}
        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "11px 24px",
          borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>{sub}</div>

        <div style={{ position: "relative", flex: 1, display: "flex", minHeight: 0 }}>
          {/* 본문은 스크롤하지 않는다 — 스크롤이 나는 곳을 목록 박스 한 곳으로 못박는다.
              스크롤 막대가 둘 보이면 사용자는 어느 쪽을 굴려야 할지 모른다. */}
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", padding: "22px 32px 18px",
                        display: "flex", flexDirection: "column" }}>{children}</div>
          {agent && (
            <div style={{
              width: 320, flexShrink: 0, borderLeft: "1px solid var(--line)",
              background: "color-mix(in srgb,var(--app) 55%,transparent)",
              display: "flex", flexDirection: "column",
            }}>{agent}</div>
          )}
        </div>

        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "14px 24px",
          borderTop: "1px solid var(--line)", flexShrink: 0,
        }}>{footer}</div>

        {overlay}
      </div>
    </div>
  );
}

/** 도우미 패널 — 일러스트 → 헤드라인 → 사실 최대 3개 → 액션. 분량 상한을 컴포넌트가 강제한다. */
export function Agent({ status = "대기중", illust, headline, facts = [], note, extra, actions = [] }) {
  return (
    <>
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--purple)" }}>
          온보딩 도우미
        </span>
        <span className="mono" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--green)" }}>
          <i style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "block" }} />{status}
        </span>
      </div>
      {illust && <div style={{ padding: "10px 20px 4px" }}>{illust}</div>}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.02em", lineHeight: 1.44, marginBottom: 12 }}>
          {headline}
        </div>
        {facts.slice(0, 3).map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 0",
            borderTop: i ? "1px solid var(--line)" : "none",
            animation: "stepIn .3s ease-out both", animationDelay: `${i * 0.06}s`,
          }}>
            <span style={{ width: 15, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
            <span style={{ fontSize: 12.8, color: "var(--text)", lineHeight: 1.56 }}>{f.text}</span>
          </div>
        ))}
        {note && (
          <div style={{
            marginTop: 13, padding: "11px 13px", borderRadius: 10, background: "var(--main)",
            borderLeft: "2px solid var(--purple)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
          }}>{note}</div>
        )}
        {extra}
        {!!actions.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {actions.map((a, i) => (
              <button key={i} onClick={a.onClick} style={{
                borderRadius: 10, padding: "10px 13px", fontSize: 12.5, fontWeight: a.ghost ? 600 : 700,
                textAlign: "center", cursor: "pointer", fontFamily: "var(--sans)",
                background: a.ghost ? "transparent" : "var(--purple)",
                border: a.ghost ? "1px solid var(--line2)" : "none",
                color: a.ghost ? "var(--muted)" : "#fff",
              }}>{a.label}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export const ICO = {
  ok: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f86f6" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>,
  info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#767d92" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>,
  warn: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8841e" strokeWidth="2" strokeLinecap="round"><path d="M12 9v5M12 17h.01" /><path d="M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>,
  no: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
};

/** 버튼 — 위자드 안에서만 쓰는 최소 세트. */
export function Btn({ children, onClick, kind = "primary", disabled, style }) {
  const base = {
    borderRadius: 11, padding: "12px 22px", fontSize: 13.5, fontWeight: 700,
    fontFamily: "var(--sans)", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1, border: "none", ...style,
  };
  // 못 누르는 버튼은 색까지 빠져야 한다. 투명도만 낮추면 여전히 주 버튼 색이라
  // "왜 안 눌리지" 를 몇 번 눌러본 뒤에야 알게 된다.
  const skin = disabled
    ? { background: "var(--main)", border: "1px solid var(--line2)", color: "var(--faint)" }
    : kind === "ghost"
      ? { background: "transparent", border: "1px solid var(--line2)", color: "var(--text)" }
      : { background: "var(--blue)", color: "#fff", boxShadow: "0 10px 24px rgba(47,134,246,.20)" };
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...skin }}>{children}</button>;
}

/** 라벨 + 입력 + 도움말. 도움말이 있어야 담당자가 인프라 팀에 되묻지 않는다. */
/** 필수·선택 배지. 화면에 칸이 예닐곱 개 놓이면 "무엇을 꼭 채워야 하나" 가 가장 먼저
 *  막히는 지점이다. 별표(*) 는 관례를 아는 사람에게만 읽히므로 글자로 적는다. */
export function ReqTag({ req }) {
  const c = req
    ? { bg: "var(--blue-bg)", fg: "var(--blue)", bd: "color-mix(in srgb,var(--blue) 34%,transparent)", t: "필수" }
    : { bg: "transparent", fg: "var(--faint)", bd: "var(--line2)", t: "선택" };
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 750, padding: "1.5px 6px", borderRadius: 6,
      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, flexShrink: 0,
    }}>{c.t}</span>
  );
}

export function Field({ label, hint, help, value, onChange, placeholder, mono = true, compact = false, req = false }) {
  return (
    <div style={{ marginBottom: compact ? 13 : 20 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: compact ? 12 : 12.5, color: "var(--text)", marginBottom: compact ? 5 : 7, fontWeight: 650 }}>
        {label}
        <ReqTag req={req} />
        {hint && <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 400 }}>{hint}</span>}
      </label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{
        background: "var(--main)", borderRadius: compact ? 10 : 11,
        // 필수 칸은 채워진 뒤에도 라인으로 계속 구분된다. 비었을 때만 강조하면, 다 채운
        // 화면을 되돌아봤을 때 무엇이 필수였는지 다시 찾아야 한다.
        border: `1px solid ${req ? "color-mix(in srgb,var(--blue) 34%,var(--line2))" : "var(--line2)"}`,
        borderLeft: req ? "2.5px solid var(--blue)" : undefined,
        padding: compact ? "10px 13px" : "12px 15px",
        fontFamily: mono ? "var(--mono)" : "var(--sans)", fontSize: compact ? 12.5 : 13.5,
        color: "var(--navy)", width: "100%", outline: "none",
      }} />
      {help && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>{help}</div>}
    </div>
  );
}

/** 확인 결과 줄 — "저장됨" 이 아니라 "실제로 해봤다" 를 말하는 자리. */
export function OkLine({ children, tone = "ok" }) {
  const c = tone === "ok"
    ? { bg: "var(--green-bg)", bd: "#1c4a30", dot: "var(--green)" }
    : { bg: "var(--amber-bg)", bd: "#4a3a12", dot: "var(--amber)" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 12,
      background: c.bg, border: `1px solid ${c.bd}`, fontSize: 13, maxWidth: 980, color: "var(--text)",
    }}>
      <span style={{
        width: 24, height: 24, borderRadius: "50%", background: c.dot, display: "grid",
        placeItems: "center", flexShrink: 0, color: "#fff", fontSize: 12,
      }}>{tone === "ok" ? "✓" : "!"}</span>
      <span>{children}</span>
    </div>
  );
}

/** 진행 애니메이션용 이퀄라이저 — "지금 돌고 있다"를 말하는 최소 장치. */
export function Eq({ color = "var(--blue)" }) {
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 14 }}>
      {[0, 0.15, 0.3].map((d) => (
        <i key={d} style={{
          width: 3, height: "100%", borderRadius: 2, background: color, display: "block",
          transformOrigin: "bottom", animation: `dashEq 1.1s ease-in-out ${d}s infinite`,
        }} />
      ))}
    </span>
  );
}

/** 값이 바뀔 때만 부드럽게 올라오는 카운터 — 계기판 폰트를 쓰는 자리. */
export function Num({ value, size = 26, color = "var(--navy)" }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setShown(value);
  }, [value]);
  return (
    <span key={shown} style={{
      fontFamily: "var(--disp)", fontSize: size, fontWeight: 700, color, lineHeight: 1,
      display: "inline-block", animation: "popIn .28s ease-out",
    }}>{shown}</span>
  );
}

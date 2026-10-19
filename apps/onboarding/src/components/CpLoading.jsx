import "../compass.css";

/* 기다리는 자리 하나 — 궤도 스피너 + "무엇을 하는 중인지" 한 줄 + 단계.
   LLM 이 도는 구간(컨텍스트 초안 · 추천 스킬)은 회색 스켈레톤 대신 이걸 쓴다. 스켈레톤은
   "곧 이 모양이 온다" 는 뜻이라 10~90초 걸리는 생성 구간에는 거짓말이 된다. */
export default function CpLoading({ title, note = "", steps = [], now = -1, pad = 40 }) {
  return (
    <div className="cp-load" style={{ padding: `${pad}px 0` }} role="status" aria-live="polite">
      <div className="orb"><i /><i /><i /></div>
      <b>{title}</b>
      {!!note && <small>{note}</small>}
      {!!steps.length && (
        <div className="steps">
          {steps.map((s, k) => (
            <em key={s} className={k < now ? "done" : k === now ? "now" : ""}>{s}</em>
          ))}
        </div>
      )}
    </div>
  );
}

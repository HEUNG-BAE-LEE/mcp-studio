// 이음 로고 — 콘솔(apps/web/ieum/js/common/util.js MARK)과 같은 마크 + 워드마크.
// 엠버링크 위자드의 BrandLogo 자리를 그대로 쓴다(같은 이름 · 같은 props).

export function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--blue)", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="8.7" cy="12" r="1.9" fill="currentColor" />
      <circle cx="15.3" cy="12" r="1.9" fill="currentColor" />
    </svg>
  );
}

export default function BrandLogo({ height = 24, tagline = false }) {
  return (
    <span role="img" aria-label="이음 AI 프로토콜 변압기"
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(height * 0.35), height }}>
      <BrandMark size={height} />
      <span style={{ fontSize: Math.round(height * 0.82), fontWeight: 700, letterSpacing: "-.02em", color: "var(--navy)" }}>이음</span>
      {tagline && (
        <span style={{ fontSize: Math.round(height * 0.46), fontWeight: 500, color: "#fff", background: "var(--blue)",
                       padding: "1px 7px", borderRadius: 3 }}>AI 프로토콜 변압기</span>
      )}
    </span>
  );
}

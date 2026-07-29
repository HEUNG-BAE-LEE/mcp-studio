// 수집 방식 표식. 이모지는 OS마다 모양이 달라 촬영 화면에서 튀므로 라인 아이콘을 쓴다.
// 확장 사이드패널(entrypoints/sidepanel/App.tsx)과 같은 도형·같은 색 계열을 유지한다.

export type CollectionKind = "traffic" | "portal" | "document";

export const KIND_LABEL: Record<CollectionKind, string> = {
  traffic: "트래픽",
  portal: "포털 공개",
  document: "문서",
};

export function MarkTraffic({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3.5" width="11" height="9" rx="1.6" />
      <path d="M2 6.4h11" />
      <path d="M6.4 9v6l1.9-1.9 1.3 2.6 1.4-.7-1.3-2.5 2.4-.3z" fill="currentColor" stroke="none" />
      <path d="M14.6 8.6c2 0 1.7 2.4 3.6 2.4" strokeDasharray="1.8 1.8" />
    </svg>
  );
}

export function MarkPortal({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7.6 L7.6 4 L13.2 7.6" strokeLinejoin="round" />
      <path d="M4 8.6v5.8M7.6 8.6v5.8M11.2 8.6v5.8" />
      <path d="M2.4 15.4h10.4" strokeLinecap="round" />
      <rect x="14.4" y="6.4" width="4.2" height="8" rx="1" />
      <path d="M14.4 9h4.2" />
    </svg>
  );
}

export function MarkDocument({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 2.6h6.4L15 6.7v10.2a.9.9 0 0 1-.9.9H4.5a.9.9 0 0 1-.9-.9V3.5a.9.9 0 0 1 .9-.9z" strokeLinejoin="round" />
      <path d="M10.8 2.7v4h4" strokeLinejoin="round" />
      <path d="M6.2 10.6h5.8M6.2 13.6h4.2" strokeLinecap="round" opacity="0.55" />
      <path d="M3.4 12.1h11.8" strokeLinecap="round" />
    </svg>
  );
}

export function KindMark({ kind, size = 14 }: { kind: string; size?: number }) {
  if (kind === "portal") return <MarkPortal size={size} />;
  if (kind === "document") return <MarkDocument size={size} />;
  return <MarkTraffic size={size} />;
}

/** 세션·액션 목록에서 수집 방식을 한눈에 구분하는 배지 */
export default function CollectionBadge({ kind }: { kind: string }) {
  const key = (kind in KIND_LABEL ? kind : "traffic") as CollectionKind;
  return (
    <span className={`kind-badge kind-${key}`}>
      <KindMark kind={key} />
      {KIND_LABEL[key]}
    </span>
  );
}

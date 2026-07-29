// 지금 보고 있는 페이지가 "포털이 공개한 API 명세 페이지"인지 판정한다.
//
// 백엔드(services/spec_parser.py)와 같은 기준을 써야 한다. 확장이 수집 버튼을
// 켰는데 백엔드가 422를 내면 사용자는 이유를 알 수 없다.

export type SpecDetection = {
  supported: boolean;      // 지원 포털인가
  isSpecPage: boolean;     // 명세 표가 실제로 있는가
  portalLabel: string;
  serviceName: string;
  operationCount: number;  // 이 서비스의 상세기능 수 (select 항목)
  paramCount: number;      // 지금 화면에 실린 요청변수 수
};

const PORTALS: Record<string, string> = {
  "www.data.go.kr": "공공데이터포털",
  "data.go.kr": "공공데이터포털",
};

export function detectPortal(href: string): string | null {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return host in PORTALS ? host : null;
  } catch {
    return null;
  }
}

export function detectSpecPage(doc: Document, href: string): SpecDetection {
  const portal = detectPortal(href);
  const empty: SpecDetection = {
    supported: false,
    isSpecPage: false,
    portalLabel: "",
    serviceName: "",
    operationCount: 0,
    paramCount: 0,
  };
  if (!portal) return empty;

  // 명세 페이지의 표식: '요청주소'와 요청변수 표가 함께 있어야 한다.
  // 목록·검색 화면에도 '요청변수'라는 낱말이 스치듯 등장할 수 있어서 둘 다 본다.
  const hasEndpoint = /요청주소/.test(doc.body?.innerText ?? "");
  const requestHeading = Array.from(doc.querySelectorAll("h4")).find((el) =>
    (el.textContent ?? "").includes("요청변수"),
  );
  const requestTable = requestHeading?.parentElement?.querySelector("table")
    ?? requestHeading?.nextElementSibling?.querySelector("table");
  const paramCount = requestTable ? requestTable.querySelectorAll("tbody tr").length : 0;

  const select = doc.querySelector<HTMLSelectElement>("#open_api_detail_select");
  const serviceName =
    doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim() ?? "";

  return {
    supported: true,
    isSpecPage: hasEndpoint && paramCount > 0,
    portalLabel: PORTALS[portal],
    serviceName,
    operationCount: select ? select.options.length : 0,
    paramCount,
  };
}

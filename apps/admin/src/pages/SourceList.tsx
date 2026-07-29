import Shell from "../components/Shell";

/**
 * 수집 엔진 화면.
 *
 * 수집 방식은 셋이고 같은 위계다 — 트래픽 기반 / 포털 공개 기반 / 문서 기반.
 * "기관 포털"은 그중 포털 공개 기반 수집의 **대상 목록**이라 하위에만 붙는다.
 * 트래픽 기반은 대상이 특정 사이트가 아니므로 하위 목록을 갖지 않는다.
 *
 * 아직 안 되는 것은 **점선 테두리**로 구분한다. 이전처럼 opacity 로 흐리면
 * 로딩 중인 카드로 읽힌다.
 *
 * 일러스트는 도형을 그대로 두고 stroke 만 currentColor 로 바꿨다. 색은 카드가
 * 정하므로 테마를 바꿔도 따라온다.
 */

type Source = { name: string; host?: string; live: boolean; state: string };

const PORTAL_SOURCES: Source[] = [
  { name: "공공데이터포털", host: "data.go.kr", live: true, state: "동작" },
  { name: "국가통계포털 KOSIS", host: "kosis.kr", live: false, state: "준비중" },
  { name: "서울 열린데이터광장", host: "data.seoul.go.kr", live: false, state: "준비중" },
  { name: "기상청 API허브", host: "apihub.kma.go.kr", live: false, state: "준비중" },
];

function SourceRow({ source }: { source: Source }) {
  return (
    <div className={source.live ? "source-row" : "source-row is-soon"}>
      <span className="source-name">
        {source.name}
        {source.host && <span className="source-host">{source.host}</span>}
      </span>
      {source.live ? (
        <span className="dot dot-ok">{source.state}</span>
      ) : (
        <span className="dot">{source.state}</span>
      )}
    </div>
  );
}

function TrafficIllustration() {
  return (
    <svg viewBox="0 0 172 104" role="img" aria-label="트래픽 기반 수집" fill="none" stroke="currentColor">
      <rect x="10" y="18" width="84" height="66" rx="7" strokeWidth="2.2" />
      <path d="M10 31h84" strokeWidth="2" />
      <circle cx="19" cy="24.5" r="2" fill="currentColor" stroke="none" />
      <circle cx="27" cy="24.5" r="2" fill="currentColor" stroke="none" opacity=".5" />
      <rect x="19" y="40" width="32" height="4" rx="2" fill="currentColor" stroke="none" opacity=".38" />
      <rect x="19" y="49" width="46" height="4" rx="2" fill="currentColor" stroke="none" opacity=".2" />
      <circle cx="60" cy="62" r="13" strokeWidth="1.5" opacity=".4" />
      <path d="M60 62v20l5.4-5.4 3.9 7.6 4.2-2.1-3.8-7.4 7.3-.9z" fill="currentColor" stroke="none" opacity=".8" />
      <path d="M96 44C118 44 118 32 140 32" strokeWidth="2.2" strokeDasharray="4 4" strokeLinecap="round" />
      <path d="M96 52C118 52 118 64 140 64" strokeWidth="2.2" strokeDasharray="4 4" strokeLinecap="round" opacity=".5" />
      <rect x="143" y="25" width="20" height="14" rx="3" fill="currentColor" stroke="none" />
      <rect x="143" y="57" width="20" height="14" rx="3" fill="currentColor" stroke="none" opacity=".5" />
    </svg>
  );
}

function PortalIllustration() {
  return (
    <svg viewBox="0 0 172 104" role="img" aria-label="포털 공개 기반 수집" fill="none" stroke="currentColor">
      <path d="M8 40 L44 20 L80 40" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M16 43v33M30 43v33M44 43v33M58 43v33M72 43v33" strokeWidth="2.2" />
      <path d="M6 79h76" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="44" cy="31" r="3" fill="currentColor" stroke="none" />
      <path d="M90 52h16" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M101 46.5l5.5 5.5-5.5 5.5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="114" y="22" width="50" height="60" rx="5" strokeWidth="2.2" />
      <path d="M114 36h50M139 36v46" strokeWidth="1.5" opacity=".5" />
      <path d="M114 48h50M114 59h50M114 70h50" strokeWidth="1.3" opacity=".4" />
      <rect x="119" y="27" width="16" height="4" rx="2" fill="currentColor" stroke="none" opacity=".6" />
      <rect x="144" y="27" width="15" height="4" rx="2" fill="currentColor" stroke="none" opacity=".6" />
    </svg>
  );
}

function DocumentIllustration() {
  return (
    <svg viewBox="0 0 172 104" role="img" aria-label="문서 기반 수집" fill="none" stroke="currentColor">
      <path
        d="M22 16h44l22 22v50a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5z"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M66 16v22h22" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M29 50h47M29 60h37M29 70h47M29 80h29" strokeWidth="2.4" strokeLinecap="round" opacity=".35" />
      <path d="M14 65h77" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <circle cx="91" cy="65" r="3.4" fill="currentColor" stroke="none" opacity=".8" />
      <path d="M100 52h16" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M111 46.5l5.5 5.5-5.5 5.5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="126" y="26" width="34" height="9" rx="4.5" fill="currentColor" stroke="none" opacity=".85" />
      <path d="M130 37v39M130 50h8M130 64h8M130 76h8" strokeWidth="1.8" opacity=".4" />
      <rect x="140" y="45" width="24" height="9" rx="4.5" fill="currentColor" stroke="none" opacity=".5" />
      <rect x="140" y="59" width="24" height="9" rx="4.5" fill="currentColor" stroke="none" opacity=".5" />
      <rect x="140" y="71" width="24" height="9" rx="4.5" fill="currentColor" stroke="none" opacity=".5" />
    </svg>
  );
}

export default function SourceList() {
  const livePortals = PORTAL_SOURCES.filter((s) => s.live).length;

  return (
    <Shell breadcrumb={["수집 엔진"]}>
      <div className="page-head">
        <div>
          <span className="eyebrow">engines</span>
          <h1>수집 엔진</h1>
          <p className="page-sub">
            API 를 가져오는 방식은 셋입니다. 어느 방식으로 수집했든 이후 액션 생성·테스트는 같습니다
          </p>
        </div>
      </div>

      <div className="method-grid">
        <section className="method-card">
          <div className="method-illu" style={{ color: "var(--kind-traffic)" }}>
            <TrafficIllustration />
          </div>
          <div className="method-body">
            <div className="cluster between">
              <h2>트래픽 기반</h2>
              <span className="dot dot-ok">동작</span>
            </div>
            <p>화면을 쓰는 동안 오가는 API 호출을 관측해 스키마를 역추론합니다</p>
          </div>
          <div className="method-sources">
            <SourceRow source={{ name: "공공 · 민간 · 사내 시스템", live: true, state: "제한 없음" }} />
          </div>
        </section>

        <section className="method-card">
          <div className="method-illu" style={{ color: "var(--kind-portal)" }}>
            <PortalIllustration />
          </div>
          <div className="method-body">
            <div className="cluster between">
              <h2>포털 공개 기반</h2>
              <span className="dot dot-ok">
                {livePortals} / {PORTAL_SOURCES.length} 동작
              </span>
            </div>
            <p>기관이 포털에 공개한 명세 페이지의 요청·응답 표를 읽어 스키마를 추출합니다</p>
          </div>
          <div className="method-sources">
            {PORTAL_SOURCES.map((source) => (
              <SourceRow key={source.name} source={source} />
            ))}
          </div>
        </section>

        <section className="method-card is-soon">
          <div className="method-illu" style={{ color: "var(--kind-document)" }}>
            <DocumentIllustration />
          </div>
          <div className="method-body">
            <div className="cluster between">
              <h2>문서 기반</h2>
              <span className="tag">준비중</span>
            </div>
            <p>활용가이드 PDF·HWP 를 올려 명세를 구조화합니다</p>
          </div>
          <div className="method-sources">
            <SourceRow source={{ name: "PDF · HWP 활용가이드", live: false, state: "준비중" }} />
          </div>
        </section>
      </div>
    </Shell>
  );
}

import Shell from "../components/Shell";

/**
 * 수집 엔진 화면.
 *
 * 수집 방식은 셋이고 같은 위계다 — 트래픽 기반 / 포털 공개 기반 / 문서 기반.
 * "기관 포털"은 그중 포털 공개 기반 수집의 **대상 목록**이라 하위에만 붙는다.
 * 트래픽 기반은 대상이 특정 사이트가 아니므로 하위 목록을 갖지 않는다.
 *
 * 아직 안 되는 것은 흐리게 두고 "준비중"이라 적는다. 화면에 떠 있는 것 중
 * 무엇이 실제로 동작하는지 구분되지 않으면, 되는 기능까지 의심받는다.
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
    <div className={`source-row ${source.live ? "is-live" : "is-soon"}`}>
      <span className={`source-dot ${source.live ? "on" : "off"}`} />
      <span className="source-name">
        {source.name}
        {source.host && <span className="source-host">{source.host}</span>}
      </span>
      <span className="source-state">{source.state}</span>
    </div>
  );
}

function TrafficIllustration() {
  return (
    <svg viewBox="0 0 172 104" role="img" aria-label="트래픽 기반 수집">
      <rect x="10" y="18" width="84" height="66" rx="7" fill="none" stroke="#3157e8" strokeWidth="2.2" />
      <path d="M10 31h84" stroke="#3157e8" strokeWidth="2" />
      <circle cx="19" cy="24.5" r="2" fill="#3157e8" />
      <circle cx="27" cy="24.5" r="2" fill="#3157e8" opacity=".5" />
      <rect x="19" y="40" width="32" height="4" rx="2" fill="#3157e8" opacity=".3" />
      <rect x="19" y="49" width="46" height="4" rx="2" fill="#3157e8" opacity=".17" />
      <circle cx="60" cy="62" r="13" fill="none" stroke="#3157e8" strokeWidth="1.5" opacity=".4" />
      <path d="M60 62v20l5.4-5.4 3.9 7.6 4.2-2.1-3.8-7.4 7.3-.9z" fill="#7d97f2" />
      <path d="M96 44C118 44 118 32 140 32" fill="none" stroke="#3157e8" strokeWidth="2.2"
            strokeDasharray="4 4" strokeLinecap="round" />
      <path d="M96 52C118 52 118 64 140 64" fill="none" stroke="#3157e8" strokeWidth="2.2"
            strokeDasharray="4 4" strokeLinecap="round" opacity=".5" />
      <rect x="143" y="25" width="20" height="14" rx="3" fill="#3157e8" />
      <rect x="143" y="57" width="20" height="14" rx="3" fill="#3157e8" opacity=".5" />
    </svg>
  );
}

function PortalIllustration() {
  return (
    <svg viewBox="0 0 172 104" role="img" aria-label="포털 공개 기반 수집">
      <path d="M8 40 L44 20 L80 40" fill="none" stroke="#0d9488" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M16 43v33M30 43v33M44 43v33M58 43v33M72 43v33" stroke="#0d9488" strokeWidth="2.2" />
      <path d="M6 79h76" stroke="#0d9488" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="44" cy="31" r="3" fill="#0d9488" />
      <path d="M90 52h16" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M101 46.5l5.5 5.5-5.5 5.5" fill="none" stroke="#0d9488" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
      <rect x="114" y="22" width="50" height="60" rx="5" fill="none" stroke="#0d9488" strokeWidth="2.2" />
      <path d="M114 36h50M139 36v46" stroke="#0d9488" strokeWidth="1.5" opacity=".5" />
      <path d="M114 48h50M114 59h50M114 70h50" stroke="#0d9488" strokeWidth="1.3" opacity=".4" />
      <rect x="119" y="27" width="16" height="4" rx="2" fill="#0d9488" opacity=".6" />
      <rect x="144" y="27" width="15" height="4" rx="2" fill="#0d9488" opacity=".6" />
    </svg>
  );
}

function DocumentIllustration() {
  return (
    <svg viewBox="0 0 172 104" role="img" aria-label="문서 기반 수집">
      <path d="M22 16h44l22 22v50a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5z"
            fill="none" stroke="#b98410" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M66 16v22h22" fill="none" stroke="#b98410" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M29 50h47M29 60h37M29 70h47M29 80h29" stroke="#b98410" strokeWidth="2.4"
            strokeLinecap="round" opacity=".3" />
      <path d="M14 65h77" stroke="#e0a52a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="91" cy="65" r="3.4" fill="#e0a52a" />
      <path d="M100 52h16" stroke="#b98410" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M111 46.5l5.5 5.5-5.5 5.5" fill="none" stroke="#b98410" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
      <rect x="126" y="26" width="34" height="9" rx="4.5" fill="#b98410" opacity=".85" />
      <path d="M130 37v39M130 50h8M130 64h8M130 76h8" stroke="#b98410" strokeWidth="1.8" opacity=".4" />
      <rect x="140" y="45" width="24" height="9" rx="4.5" fill="#b98410" opacity=".5" />
      <rect x="140" y="59" width="24" height="9" rx="4.5" fill="#b98410" opacity=".5" />
      <rect x="140" y="71" width="24" height="9" rx="4.5" fill="#b98410" opacity=".5" />
    </svg>
  );
}

/**
 * 시작 안내.
 *
 * 수집은 브라우저(확장 프로그램)에서 일어나므로 관리자가 직접 시작할 수 없다.
 * 그래서 "시작" 버튼을 만들지 않는다 — 눌러도 아무것도 시작되지 않는 버튼은
 * 안내가 없는 것보다 나쁘다. 대신 무엇을 해야 하는지 순서대로 펼친다.
 */
function Guide({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="method-guide">
      <summary>{label}</summary>
      <div className="guide-body">{children}</div>
    </details>
  );
}

export default function SourceList() {
  return (
    <Shell breadcrumb={["수집 엔진"]}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">수집</p>
          <h1>수집 엔진</h1>
          <p className="subtitle">
            API 를 가져오는 방식은 셋입니다. 어느 방식으로 수집했든 이후 액션 생성·테스트는 같습니다.
          </p>
        </div>
      </section>

      <div className="method-grid">
        <section className="method-card is-live">
          <div className="method-illu"><TrafficIllustration /></div>
          <div className="method-body">
            <h3>트래픽 기반 수집</h3>
            <p>화면을 쓰는 동안 오가는 API 호출을 관측해 스키마를 역추론합니다.</p>
            <span className="kind-badge kind-traffic">사용 가능</span>
          </div>
          <div className="method-sources">
            <h4>대상</h4>
            <SourceRow source={{ name: "공공 · 민간 · 사내 시스템", live: true, state: "제한 없음" }} />
          </div>
          <Guide label="이 방식으로 시작하는 방법">
            <ol className="guide-steps">
              <li>확장 프로그램을 로드합니다 — <code>chrome://extensions</code> → 개발자 모드 →
                  <code>apps/extension/.output/chrome-mv3</code></li>
              <li>대상 사이트를 열고 확장 아이콘을 눌러 사이드 패널을 엽니다</li>
              <li>프로젝트 이름을 넣고 <strong>트래픽 기록 시작</strong></li>
              <li>버튼·필터·확대축소처럼 <strong>페이지가 넘어가지 않는 조작</strong>을 클릭합니다</li>
              <li><strong>기록 종료 및 전송</strong> → <strong>관리자에서 열기</strong></li>
            </ol>
            <p className="guide-note">
              <strong>확장을 새로고침했다면 대상 페이지도 새로고침하세요</strong>
              이미 열려 있던 탭의 스크립트는 고아가 되어 클릭이 하나도 잡히지 않습니다.
              화면에는 오류 없이 “0 클릭”만 보여 알아채기 어렵습니다.
            </p>
            <p className="guide-note">
              <strong>페이지가 넘어가는 클릭은 연결되지 않습니다</strong>
              링크를 눌러 이동하면 그 뒤 요청은 새 페이지에서 발생해 이전 클릭과 묶이지 않습니다.
              맞는 사이트인지 미리 보려면 <code>F12</code> → Network → <code>Fetch/XHR</code> 로 걸러
              클릭해 보세요. 새 항목이 뜨고 목록이 초기화되지 않으면 맞습니다.
            </p>
          </Guide>
        </section>

        <section className="method-card is-live">
          <div className="method-illu"><PortalIllustration /></div>
          <div className="method-body">
            <h3>포털 공개 기반 수집</h3>
            <p>기관이 포털에 공개한 명세 페이지의 요청·응답 표를 읽어 스키마를 추출합니다.</p>
            <span className="kind-badge kind-portal">
              {PORTAL_SOURCES.filter((s) => s.live).length} / {PORTAL_SOURCES.length} 사용 가능
            </span>
          </div>
          <div className="method-sources">
            <h4>기관 포털</h4>
            {PORTAL_SOURCES.map((source) => (
              <SourceRow key={source.name} source={source} />
            ))}
          </div>
          <Guide label="이 방식으로 시작하는 방법">
            <ol className="guide-steps">
              <li><a href="https://www.data.go.kr" target="_blank" rel="noreferrer">공공데이터포털</a>에서
                  쓰려는 오픈API 를 찾습니다</li>
              <li><strong>활용신청</strong>을 하면 승인 후 <code>serviceKey</code> 가 발급됩니다</li>
              <li>그 API 의 <strong>상세페이지</strong>를 엽니다 — <code>요청주소</code> 와
                  <code>요청변수</code> 표가 함께 있는 화면입니다. 목록·검색 페이지는 인식되지 않습니다</li>
              <li>사이드 패널에 <strong>공개 명세 페이지 감지</strong> 가 뜨는지 확인하고,
                  프로젝트 이름을 넣어 <strong>공개 명세 수집</strong></li>
              <li><strong>관리자에서 열기</strong> → 오퍼레이션의 <strong>액션 만들기</strong></li>
              <li>테스트 콘솔 상단 <strong>포털 인증키</strong> 에 <code>serviceKey</code> 를 등록한 뒤 질의합니다</li>
            </ol>
            <p className="guide-note">
              <strong>수집은 인증키 없이 됩니다</strong>
              명세만 읽으므로 키가 없어도 3~5 단계를 먼저 해볼 수 있습니다. 키는 <strong>실행할 때</strong>
              필요하고, 없으면 호출 전에 막힙니다.
            </p>
            <p className="guide-note">
              <strong>상세기능은 한 번에 하나씩 수집됩니다</strong>
              상세페이지가 상세기능을 목록에서 하나씩 보여주기 때문입니다. 다른 기능도 필요하면
              그 페이지에서 목록을 바꾼 뒤 다시 누르면 같은 세션에 누적됩니다.
            </p>
          </Guide>
        </section>

        <section className="method-card">
          <div className="method-illu"><DocumentIllustration /></div>
          <div className="method-body">
            <h3>문서 기반 수집</h3>
            <p>활용가이드 PDF·HWP 를 올려 명세를 구조화합니다.</p>
            <span className="kind-badge kind-document">준비중</span>
          </div>
          <div className="method-sources">
            <h4>대상</h4>
            <SourceRow source={{ name: "PDF · HWP 활용가이드", live: false, state: "준비중" }} />
          </div>
        </section>
      </div>
    </Shell>
  );
}

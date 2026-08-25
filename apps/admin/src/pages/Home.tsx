import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import ContextSearch from "../components/ContextSearch";
import LiveMonitor from "../components/LiveMonitor";
import OnboardingWizard from "../components/OnboardingWizard";
import Toast, { useToast } from "../components/Toast";
import { ErrorBox, SkeletonRows } from "../components/States";
import { KindBadge } from "./Market";

/**
 * 플랫폼 홈 — 전체 맥락 대시보드.
 *
 * 프로젝트 하나의 상세가 아니라 "내가 가진 전부"를 본다. 이전 안은 첫 화면이
 * 프로젝트 상세라서 기능 메뉴처럼 보였다.
 *
 * 홈은 세 질문에만 답한다.
 *   ① 나는 무엇을 갖고 있나  — 프로젝트 카드 + 요약 수치
 *   ② 지금 잘 돌고 있나      — 실시간 호출 모니터
 *   ③ 다음에 뭘 하나         — AI 추천 · 새 프로젝트
 * 이 셋을 벗어나는 것은 홈에 두지 않는다. "할 수 있는 일 목록"을 늘어놓은 것이
 * 기능 메뉴처럼 보이던 원인이었다.
 */

type ProjectRow = {
  id: number; name: string; description: string;
  mcps: number; tools: number; skills: number; kinds: string[]; calls: number;
};
type Totals = {
  projects: number; mcps: number; skills: number; calls: number; successRate: number;
};
type Rec = {
  id: number; slug: string; name: string; description: string; mark: string;
  kind: string; tools: number; origin: string; why: string;
};

const EXAMPLES = [
  "아파트 실거래가와 인구를 같이 보고 싶다",
  "배송 지연을 고객에게 알리고 싶다",
  "내일 날씨 특보를 받고 싶다",
];

export default function Home() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const { toasts, showToast, dismiss } = useToast();
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/api/home")
      .then((r) => { setRows(r.projects); setTotals(r.totals); })
      .catch((err) => setError(errorMessage(err)));

    // 추천은 내가 가진 프로젝트 구성을 문맥으로 쓴다. 근거가 없으면 표시하지
    // 않는 것이 원칙이라, 설명이 비면 서버가 인기순으로 채워 근거를 붙여 준다.
    api.get("/api/recommend?limit=2")
      .then((r) => setRecs(r.items))
      .catch(() => setRecs([]));
  }, []);

  useEffect(load, [load]);

  const busiest = Math.max(1, ...(rows ?? []).map((r) => r.calls));

  return (
    <Shell breadcrumb={["홈"]}>
      {/* 검색 위 디스플레이 헤드라인 — 안내를 플레이스홀더에만 두면 타이핑을
          시작하는 순간 사라진다. 가장 중요한 안내가 가장 먼저 사라지는 셈이다. */}
      <section className="hero">
        <span className="hero-eyebrow mono">Context Search</span>
        <h1>무엇을 하려는지 <em>문장으로</em> 적어 보세요</h1>
        <p>MCP · 스킬 · 도구를 한 번에 찾습니다 — 키워드와 의미를 함께 씁니다</p>

        <div className="hero-search">
          <ContextSearch placeholder="예: 아파트 실거래가와 인구를 같이 보고 싶다" size="lg" />
        </div>

        {/* 맥락 검색은 어떻게 물어야 하는지 모르면 못 쓴다. 키워드를 넣던 습관을
            문장으로 바꾸는 데 예시 하나가 설명 열 줄보다 낫다. */}
        <div className="hero-ex">
          {EXAMPLES.map((t) => <span key={t} className="hero-chip">{t}</span>)}
        </div>
      </section>

      {error && <ErrorBox message={error} />}

      <div className="home-mon">
        <LiveMonitor />
        <div className="home-side">
          <div className="stat-card">
            <div className="stat-kv">
              <div><b className="num">{totals?.projects ?? "–"}</b><span>프로젝트</span></div>
              <div><b className="num">{totals?.mcps ?? "–"}</b><span>MCP</span></div>
              <div><b className="num">{totals?.skills ?? "–"}</b><span>스킬</span></div>
            </div>
          </div>

          {/* AI 추천 — 근거 칩이 없으면 표시하지 않는다. */}
          {recs.map((r) => (
            <div key={r.id} className="ai-ring">
              <article className="ai-card">
                <header>
                  <span className="ai-badge"><i aria-hidden="true" />AI 추천</span>
                  <span className="mono t4">{r.why}</span>
                </header>
                <b>{r.name}</b>
                <p>{r.description}</p>
                <div className="ai-foot">
                  <KindBadge kind={r.kind} />
                  <Link className="btn btn-sm btn-primary" to={`/market/${r.slug}`}>살펴보기</Link>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>

      <h2 className="sec-title">내 프로젝트</h2>
      {rows === null && !error && <SkeletonRows />}

      <div className="home-grid">
        {(rows ?? []).map((p) => (
          <article key={p.id} className="home-card">
            <div className="home-card-hd">
              <Link className="cell-name" to={`/projects/${p.id}`}>{p.name}</Link>
              <p className={p.description ? "" : "t4"}>{p.description || "설명이 없습니다"}</p>
            </div>
            <div className="home-kinds">
              {p.kinds.map((k) => <KindBadge key={k} kind={k} />)}
            </div>
            <div className="home-metrics">
              <div><b className="num">{p.mcps}</b><span>MCP</span></div>
              <div><b className="num">{p.tools}</b><span>도구</span></div>
              <div><b className="num">{p.skills}</b><span>스킬</span></div>
            </div>
            <div className="home-bar" aria-hidden="true">
              <i style={{ width: `${Math.round((p.calls / busiest) * 100)}%` }} />
            </div>
            <p className="home-when mono">{p.calls.toLocaleString()} 호출</p>
          </article>
        ))}

        <button type="button" className="home-card is-new" onClick={() => setWizard(true)}>
          <span className="home-plus" aria-hidden="true">＋</span>
          <b>새 프로젝트</b>
          <span>위자드가 알맞은 MCP 를 골라 줍니다</span>
        </button>
      </div>

      {wizard && (
        <OnboardingWizard
          onClose={() => { setWizard(false); load(); }}
          onDone={(id, name) => {
            setWizard(false);
            showToast(`${name} 을(를) 시작합니다`);
            navigate(`/projects/${id}`);
          }}
        />
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

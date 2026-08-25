import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import ContextSearch from "./ContextSearch";
import { KindMark, KIND_LABEL, type CollectionKind } from "./CollectionMark";

/**
 * 프로젝트 온보딩 위자드.
 *
 *   ① 이름 · 설명 → ② MCP 담기 → ③ 확인 → 프로젝트로 입장
 *
 * 2단계 배치가 이 화면의 핵심이다. **검색이 위, 추천이 아래**다. 추천을 맨 위에
 * 두면 추천이 전부인 화면처럼 보이고, 원하는 게 없을 때 막다른 길이 된다.
 * "MCP 를 추가할 수 있습니다"라는 능동 문구와 검색을 위에 두면 주도권이
 * 사용자에게 있고, 추천은 그 아래에서 거들 뿐이다.
 *
 * 추천 근거는 1단계에서 적은 설명 문장에서 뽑는다. 근거 칩("실거래가")이
 * 붙지 않는 추천은 내보내지 않는다 — 왜 이걸 골랐는지 화면이 말할 수 없으면
 * 추천하지 않는 편이 낫다.
 */

type Rec = {
  id: number; slug: string; name: string; description: string; mark: string;
  kind: string; tools: number; origin: string; pricePerCall: number; why: string;
};
type Picked = { id: number; name: string; kind: string; tools: number; pricePerCall: number };

const STEPS = ["프로젝트", "MCP 담기", "확인"];

export default function OnboardingWizard({
  onClose, onDone,
}: {
  onClose: () => void;
  onDone: (projectId: number, name: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [intent, setIntent] = useState<string[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function goPick() {
    if (!name.trim()) {
      setError("프로젝트 이름을 입력해 주세요");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // 설명 문장을 그대로 추천에 넘긴다. 여기서 뽑은 검색어가 근거 칩이 된다.
      const r = await api.get(`/api/recommend?text=${encodeURIComponent(desc || name)}&limit=4`);
      setIntent(r.intent);
      setRecs(r.items);
      // 근거가 확실한 것(검색어에 걸린 것)만 미리 골라 둔다. 인기순 폴백은
      // 사용자가 직접 고르게 남긴다 — 무관한 것이 자동으로 담기면 신뢰를 잃는다.
      setPicked(r.items
        .filter((i: Rec) => i.why && i.why !== "많이 담긴 MCP")
        .map((i: Rec) => ({ id: i.id, name: i.name, kind: i.kind, tools: i.tools, pricePerCall: i.pricePerCall })));
      setStep(1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function toggle(r: { id: number; name: string; kind: string; tools: number; pricePerCall: number }) {
    setPicked((s) => s.some((p) => p.id === r.id)
      ? s.filter((p) => p.id !== r.id)
      : [...s, { id: r.id, name: r.name, kind: r.kind, tools: r.tools, pricePerCall: r.pricePerCall }]);
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const project = await api.post("/api/projects", { name: name.trim() });
      if (desc.trim()) {
        await api.patch(`/api/projects/${project.id}`, { name: name.trim(), description: desc.trim() });
      }
      if (picked.length) {
        await api.post("/api/catalog/dispatch", {
          entryIds: picked.map((p) => p.id),
          projectIds: [project.id],
        });
      }
      onDone(project.id, name.trim());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const tools = picked.reduce((n, p) => n + p.tools, 0);
  const paid = picked.filter((p) => p.pricePerCall > 0);

  return (
    <div className="modal-backdrop wiz-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="wiz" onClick={(e) => e.stopPropagation()}>
        <div className="wiz-top">
          <ol className="wiz-steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>
                <i aria-hidden="true">{i < step ? "✓" : i + 1}</i>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── 1단계 ── */}
        {step === 0 && (
          <div className="wiz-body">
            <h2>어떤 프로젝트인가요</h2>
            <p className="wiz-d">
              여기에 적은 설명으로 알맞은 MCP 를 골라 드립니다. 나중에 바꿔도 됩니다.
            </p>

            <label className="field-label" htmlFor="wz-name">프로젝트 이름</label>
            <input id="wz-name" className="input wiz-input" autoFocus value={name}
                   placeholder="예: 부동산 투자 리서치"
                   onChange={(e) => setName(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") goPick(); }} />

            <label className="field-label" htmlFor="wz-desc" style={{ marginTop: 18 }}>
              무엇을 하려고 하나요
            </label>
            <textarea id="wz-desc" className="textarea wiz-input" rows={3} value={desc}
                      placeholder="수도권 아파트 실거래가와 지역 인구를 함께 보고, 투자 후보 지역을 추려내는 에이전트를 만들려고 합니다"
                      onChange={(e) => setDesc(e.target.value)} />
            <p className="field-help">
              문장으로 적을수록 추천이 정확해집니다 — 다음 단계에서 이 문장을 그대로 맥락 검색에 씁니다.
            </p>

            {error && <p className="field-help is-error">{error}</p>}
          </div>
        )}

        {/* ── 2단계 : 검색이 위, 추천이 아래 ── */}
        {step === 1 && (
          <div className="wiz-body">
            <h2>MCP 를 추가할 수 있습니다</h2>
            <p className="wiz-d">
              찾아서 담고, 아래 추천에서 골라 담으세요. 지금 담지 않아도 나중에 언제든 추가됩니다.
            </p>

            <div className="wiz-pick">
              <div>
                <ContextSearch
                  placeholder="이름 · 기관 · 하려는 일을 문장으로"
                  onPick={(e) => toggle(e)}
                />
                <p className="field-help">
                  홈 상단 검색과 같은 검색입니다. 결과를 누르면 바로 담깁니다.
                </p>
              </div>

              {/* 담은 목록을 곁에 고정한다. 검색하는 동안에도 계속 보여야
                  같은 걸 두 번 담지 않는다. */}
              <aside className="wiz-basket">
                <header>
                  <b>담은 MCP</b>
                  <span className="mono">{picked.length}</span>
                </header>
                {picked.length === 0 && <p className="t4">아직 없습니다</p>}
                {picked.map((p) => (
                  <div key={p.id} className="wiz-bk">
                    <span className={`kind-badge kind-${p.kind}`}>
                      <KindMark kind={p.kind} size={11} />
                      {KIND_LABEL[p.kind as CollectionKind] ?? p.kind}
                    </span>
                    <span className="wiz-bk-nm">
                      <b>{p.name}</b>
                      <span className="mono">{p.tools} tools</span>
                    </span>
                    <button type="button" onClick={() => toggle(p)} aria-label={`${p.name} 빼기`}>✕</button>
                  </div>
                ))}
                {picked.length > 0 && (
                  <footer className="mono">
                    도구 {tools}개 · {paid.length ? `유료 ${paid.length}개 포함` : "전부 무료"}
                  </footer>
                )}
              </aside>
            </div>

            <div className="ai-ring wiz-recs">
              <div className="ai-recbox">
                <header>
                  <span className="ai-badge lg"><i aria-hidden="true" />AI 추천</span>
                  <b className="ai-ttl">
                    적어 주신 설명을 읽고 <em>{recs.length}개를 골랐습니다</em>
                  </b>
                  <span className="mono t4">{picked.length}개 담김</span>
                </header>

                {intent.length > 0 && (
                  <div className="ai-why">
                    <span className="mono t4">근거</span>
                    {intent.map((k) => <span key={k} className="why">{k}</span>)}
                  </div>
                )}

                <div className="wiz-recgrid">
                  {recs.map((r) => {
                    const on = picked.some((p) => p.id === r.id);
                    return (
                      <button key={r.id} type="button" className={`wiz-rec ${on ? "on" : ""}`}
                              onClick={() => toggle(r)}>
                        <span className="wiz-cb" aria-hidden="true">✓</span>
                        <span className={`mk-mark tone-${r.origin === "public" ? "pub" : "priv"}`}>
                          {r.mark}
                        </span>
                        <span className="wiz-rec-nm">
                          <b>{r.name}</b>
                          <span className="mono">
                            {r.tools} tools · {r.origin === "public" ? "공공" : "민간"}
                          </span>
                        </span>
                        {r.why && <span className="why">{r.why}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && <p className="field-help is-error">{error}</p>}
          </div>
        )}

        {/* ── 3단계 ── */}
        {step === 2 && (
          <div className="wiz-body">
            <h2>준비됐습니다</h2>
            <p className="wiz-d">시작한 뒤에도 언제든 마켓에서 담고 뺄 수 있습니다.</p>

            <div className="wiz-summary">
              <div className="wiz-sum-hd">
                <span className="mk-mark lg tone-pub">{name.trim().slice(0, 2) || "PJ"}</span>
                <div>
                  <b>{name}</b>
                  <span>{desc || "설명 없음"}</span>
                </div>
              </div>
              <div className="wiz-sum-kv">
                <div><b className="num">{picked.length}</b><span>MCP</span></div>
                <div><b className="num">{tools}</b><span>도구</span></div>
                <div>
                  <b className="num">{paid.length ? `유료 ${paid.length}` : "₩0"}</b>
                  <span>예상 비용</span>
                </div>
              </div>
              <p className="wiz-sum-note mono">
                {paid.length === 0
                  ? "담은 MCP 가 전부 공공이라 비용이 발생하지 않습니다."
                  : `유료 MCP ${paid.length}개가 포함되어 호출한 만큼 과금됩니다.`}
              </p>
            </div>

            {error && <p className="field-help is-error">{error}</p>}
          </div>
        )}

        <div className="wiz-foot">
          {step === 0 ? (
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              나중에 하기
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
              ← 이전
            </button>
          )}

          <div className="cluster">
            {step === 1 && (
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)} disabled={busy}>
                건너뛰기
              </button>
            )}
            {step === 0 && (
              <button type="button" className="btn btn-primary btn-lg" onClick={goPick} disabled={busy}>
                {busy ? "고르는 중…" : "다음 →"}
              </button>
            )}
            {step === 1 && (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                {picked.length ? `${picked.length}개 담고 다음 →` : "다음 →"}
              </button>
            )}
            {step === 2 && (
              <button type="button" className="btn btn-primary btn-lg" onClick={finish} disabled={busy}>
                {busy ? "만드는 중…" : "프로젝트 시작하기 →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

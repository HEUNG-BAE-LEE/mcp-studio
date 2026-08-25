import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import ConfirmPopover from "../components/ConfirmPopover";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";

/**
 * 스킬 관리 — EmberLink(climax) SkillManager 계보.
 *
 * 목록 카드에 파이프라인 모양을 **teal·purple 도트**로 찍는다. 카드를 훑기만
 * 해도 "MCP 두 번 + 프롬프트 한 번" 같은 형태가 읽힌다. 색 규칙은 제품 전역과
 * 같다 — MCP 는 포털 초록 계열, PROMPT 는 브랜드 보라.
 *
 * 우리가 더한 것은 **1회 실행 비용**이다. 스킬은 MCP 를 정해진 횟수만큼 부르므로
 * LLM 이 자유롭게 고를 때와 달리 비용이 예측 가능하다.
 */

type Skill = {
  id: number; name: string; slug: string; description: string; tags: string[];
  shape: string[]; stepCount: number; costPerRun: number; missingTools: number;
  enabled: boolean; updatedAt: string | null;
  tools: { id: number; name: string; toolName: string }[];
};
type Suggest = {
  name: string; slug: string; description: string; why: string;
  steps: { type: string; tool_id: string | null; text: string }[];
};

export default function SkillManager() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<Skill[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [suggest, setSuggest] = useState<Suggest[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toasts, showToast, dismiss } = useToast();

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/skills${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => {
        setRows(r);
        setSel((cur) => (cur && r.some((s: Skill) => s.id === cur) ? cur : r[0]?.id ?? null));
      })
      .catch((err) => setError(errorMessage(err)));
    api.get(`/api/projects/${projectId}/skill-suggest`)
      .then((r) => setSuggest(r.items))
      .catch(() => setSuggest([]));
  }, [projectId, q]);

  useEffect(load, [load]);

  async function remove(s: Skill) {
    setConfirming(null);
    try {
      await api.delete(`/api/skills/${s.id}`);
      showToast(`${s.name} 을(를) 지웠습니다`);
      load();
    } catch (err) {
      showToast("지우지 못했습니다", "error", errorMessage(err));
    }
  }

  async function adopt(s: Suggest) {
    try {
      await api.post(`/api/projects/${projectId}/skills`, {
        name: s.name, slug: s.slug, description: s.description,
        tags: ["추천"], steps: s.steps,
      });
      showToast(`${s.name} 을(를) 담았습니다`, "ok", "빌더에서 바로 고칠 수 있습니다");
      load();
    } catch (err) {
      showToast("담지 못했습니다", "error", errorMessage(err));
    }
  }

  const current = (rows ?? []).find((s) => s.id === sel) ?? null;

  return (
    <Shell breadcrumb={["프로젝트", "스킬"]} projectId={projectId}>
      <div className="page-head">
        <div>
          <span className="eyebrow">skills</span>
          <h1>Skill 관리</h1>
          <p className="page-sub">
            담긴 MCP 를 순서대로 묶어 <code>/slug</code> 하나로 부릅니다.
          </p>
        </div>
        <div className="head-side">
          <input className="input" style={{ width: 220 }} value={q}
                 placeholder="이름 · /slug · 설명 · 태그"
                 onChange={(e) => setQ(e.target.value)} />
          <Link className="btn btn-primary" to={`/projects/${projectId}/skills/new`}>
            ＋ Skill 생성
          </Link>
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {rows === null && !error && <SkeletonRows />}

      {/* 추천은 담긴 MCP 만으로 바로 도는 것만 낸다. 근거 없는 추천은 없다. */}
      {suggest.map((s) => (
        <div key={s.slug} className="ai-ring skl-suggest">
          <article className="ai-card">
            <header>
              <span className="ai-badge"><i aria-hidden="true" />AI 추천 스킬</span>
              <span className="mono t4">{s.why}</span>
            </header>
            <div className="skl-sug-hd">
              <b>{s.name}</b>
              <span className="skl-slugmini">/{s.slug}</span>
              <span className="skl-dots" aria-hidden="true">
                {s.steps.map((st, i) => <i key={i} className={st.type === "mcp" ? "m" : "p"} />)}
              </span>
            </div>
            <p>{s.description}</p>
            <div className="ai-foot">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => adopt(s)}>
                담기
              </button>
            </div>
          </article>
        </div>
      ))}

      {rows !== null && rows.length === 0 && suggest.length === 0 && (
        <EmptyState
          title="아직 스킬이 없습니다"
          description={
            <>
              MCP 여러 개를 순서대로 묶으면 에이전트가 <strong>한 번에</strong> 부릅니다.
              <br />
              호출 횟수가 정해져 있어 비용도 예측할 수 있습니다.
            </>
          }
          action={
            <Link className="btn btn-sm btn-primary" to={`/projects/${projectId}/skills/new`}>
              Skill 만들기
            </Link>
          }
        />
      )}

      {rows !== null && rows.length > 0 && (
        <div className="skl-layout">
          <div className="skl-grid">
            {rows.map((s) => (
              <button key={s.id} type="button"
                      className={`skl-card ${sel === s.id ? "sel" : ""}`}
                      onClick={() => setSel(s.id)}>
                <div className="top">
                  <b>{s.name}</b>
                  <span className="skl-slugmini">/{s.slug}</span>
                  {!s.enabled && <span className="skl-tagx is-off">비노출</span>}
                  {s.missingTools > 0 && (
                    <span className="skl-tagx is-warn">도구 {s.missingTools}개 없음</span>
                  )}
                </div>
                {s.description && <p className="desc">{s.description}</p>}
                <div className="meta">
                  <span className="skl-dots" aria-hidden="true">
                    {s.shape.map((t, i) => <i key={i} className={t === "mcp" ? "m" : "p"} />)}
                  </span>
                  {s.tags.map((t) => <span key={t} className="skl-tagx">#{t}</span>)}
                  <span className="stat mono">
                    {s.stepCount} steps
                    {s.costPerRun > 0 && ` · 1회 ₩${s.costPerRun}`}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {current && (
            <aside className="skl-detail">
              <div className="skl-detail-hd">
                <b>{current.name}</b>
                <span className="skl-slugmini">/{current.slug}</span>
              </div>

              <div className="skl-lbl">파이프라인 ({current.stepCount} steps)</div>
              <div className="skl-mini">
                {current.shape.map((t, i) => (
                  <span key={i}>
                    {i > 0 && <span className="skl-miniarr">→</span>}
                    <span className={`skl-mininode ${t === "mcp" ? "m" : "p"}`}>
                      {t === "mcp" ? "MCP" : "PROMPT"}
                    </span>
                  </span>
                ))}
              </div>

              <div className="skl-lbl">호출</div>
              <pre className="code-line">/{current.slug} 강남구</pre>

              <div className="skl-lbl">사용 MCP</div>
              {current.tools.length === 0 && <p className="t4">없음</p>}
              {current.tools.map((t) => (
                <div key={t.id} className="skl-toolrow">
                  <span className="mono">{t.toolName}</span>
                </div>
              ))}

              <div className="skl-lbl">1회 실행 비용</div>
              <p className={current.costPerRun > 0 ? "num is-warn" : "num is-ok"}>
                ₩{current.costPerRun.toLocaleString()}
              </p>
              <p className="t4" style={{ fontSize: 12 }}>
                {current.costPerRun > 0
                  ? "유료 MCP 가 포함되어 실행할 때마다 이만큼 듭니다."
                  : "전부 공공 MCP 라 비용이 없습니다."}
              </p>

              <div className="cluster" style={{ marginTop: 16 }}>
                <Link className="btn btn-sm" to={`/projects/${projectId}/skills/${current.id}`}>
                  편집
                </Link>
                <ConfirmPopover
                  open={confirming === current.id}
                  title="스킬을 지울까요?"
                  description="되돌릴 수 없습니다."
                  facts={[{ label: "단계", value: String(current.stepCount) }]}
                  onConfirm={() => remove(current)}
                  onCancel={() => setConfirming(null)}
                >
                  <button type="button" className="btn btn-sm is-danger"
                          onClick={() => setConfirming(current.id)}>
                    삭제
                  </button>
                </ConfirmPopover>
              </div>
            </aside>
          )}
        </div>
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

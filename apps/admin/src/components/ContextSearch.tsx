import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { KindMark, KIND_LABEL, type CollectionKind } from "./CollectionMark";

/**
 * 맥락 검색 — 홈·위자드·마켓·스킬이 함께 쓰는 하나의 컴포넌트.
 *
 * 키워드만 넣는 검색과 다른 점은 **의도를 먼저 보여준다**는 것이다. 시스템이
 * 문장을 어떻게 읽었는지("실거래가 · 인구")를 결과 위에 붙이면, 빗나갔을 때
 * 왜 빗나갔는지가 즉시 보인다. 블랙박스 검색은 한 번 실패하면 다시 안 쓴다.
 *
 * 결과는 스킬 → MCP → 도구 순이다. 사용자가 원하는 것은 대개 "이 일을 해줘"지
 * "이 API 를 줘"가 아니다 — 완성된 답이 먼저, 재료가 나중이다.
 */

type Entry = {
  id: number; slug: string; name: string; description: string; provider: string;
  mark: string; kind: string; tools: number; origin: string; pricePerCall: number;
  inProject: boolean; score: number;
};
type SkillHit = { id: number; name: string; slug: string; steps: number; score: number };
type ToolHit = { id: number; name: string; toolName: string; method: string; entry: string; slug: string; score: number };
type Result = { intent: string[]; skills: SkillHit[]; entries: Entry[]; tools: ToolHit[]; total: number };

/** 검색어와 겹치는 구간을 <mark> 로 감싼다. 왜 걸렸는지 눈으로 확인시킨다. */
function highlight(text: string, keys: string[]) {
  if (!keys.length) return text;
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!escaped.length) return text;
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return parts.map((p, i) =>
    escaped.some((k) => k.toLowerCase() === p.toLowerCase())
      ? <mark key={i}>{p}</mark>
      : <span key={i}>{p}</span>,
  );
}

export default function ContextSearch({
  placeholder = "무엇을 하려는지 문장으로 적어 보세요",
  projectId,
  size = "md",
  onPick,
  autoFocus = false,
}: {
  placeholder?: string;
  projectId?: number | null;
  size?: "md" | "lg";
  /** 결과를 눌렀을 때. 넘기지 않으면 상세 화면으로 이동한다. */
  onPick?: (entry: Entry) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // 타이핑마다 요청을 보내지 않는다. 220ms 는 한 글자 더 치는 시간보다 짧아
  // 반응이 즉각적으로 느껴지면서, 어절 하나를 다 치는 동안은 한 번만 나간다.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setRes(null);
      return;
    }
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ q: text });
      if (projectId) qs.set("project_id", String(projectId));
      api.get(`/api/search?${qs}`)
        .then((r) => { setRes(r); setOpen(true); setCursor(0); })
        .catch(() => setRes(null));
    }, 220);
    return () => clearTimeout(t);
  }, [q, projectId]);

  // 바깥을 누르면 닫는다. 결과가 열린 채로 다른 곳을 만지면 화면이 겹친다.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const flat = res ? res.entries : [];

  function onKey(e: React.KeyboardEvent) {
    if (!open || !flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(flat.length - 1, c + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[cursor]);
    }
  }

  function pick(entry: Entry) {
    setOpen(false);
    if (onPick) onPick(entry);
    else navigate(`/market/${entry.slug}`);
  }

  return (
    <div className="cx" ref={boxRef}>
      <div className={`cx-box ${size === "lg" ? "is-lg" : ""} ${open ? "is-open" : ""}`}>
        <span className="cx-lens" aria-hidden="true" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => res && setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          aria-label="맥락 검색"
        />
        <span className="cx-ai">맥락 검색</span>
      </div>

      {open && res && (
        <div className="cx-drop" role="listbox">
          <div className="cx-intent">
            <span className="ai-badge"><i aria-hidden="true" />이렇게 이해했습니다</span>
            {res.intent.map((k) => <span key={k} className="why">{k}</span>)}
            <span className="cx-count">{res.total}개 결과</span>
          </div>

          {res.total === 0 && (
            <p className="cx-empty">
              걸리는 것이 없습니다. 하려는 일을 문장으로 적어 보세요 —
              예: “아파트 실거래가와 인구를 같이 보고 싶다”
            </p>
          )}

          {res.skills.length > 0 && (
            <>
              <div className="cx-sec">추천 조합 <b>스킬 {res.skills.length}</b></div>
              {res.skills.map((s) => (
                <div key={s.id} className="cx-row">
                  <span className="cx-mark is-skill">SK</span>
                  <span className="cx-nm">
                    <b>{highlight(s.name, res.intent)}</b>
                    <span className="mono">/{s.slug} · {s.steps} steps</span>
                  </span>
                  <span className="ai-badge sm"><i aria-hidden="true" />딱 맞음</span>
                </div>
              ))}
            </>
          )}

          {res.entries.length > 0 && (
            <>
              <div className="cx-sec">MCP <b>{res.entries.length}</b></div>
              {res.entries.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  className={`cx-row is-btn ${i === cursor ? "is-cursor" : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => pick(e)}
                >
                  <span className="cx-mark">{e.mark}</span>
                  <span className="cx-nm">
                    <b>{highlight(e.name, res.intent)}</b>
                    <span className="mono">
                      {e.tools} tools · {e.origin === "public" ? "공공" : "민간"}
                      {e.inProject ? " · 담김" : ""}
                    </span>
                  </span>
                  <span className={`kind-badge kind-${e.kind}`}>
                    <KindMark kind={e.kind} size={11} />
                    {KIND_LABEL[e.kind as CollectionKind] ?? e.kind}
                  </span>
                  <span className="cx-score mono">{e.score.toFixed(4)}</span>
                </button>
              ))}
            </>
          )}

          {res.tools.length > 0 && (
            <>
              <div className="cx-sec">도구 <b>{res.tools.length}</b></div>
              {res.tools.slice(0, 4).map((t) => (
                <div key={t.id} className="cx-row">
                  <span className="cx-meth mono">{t.method}</span>
                  <span className="cx-nm">
                    <b>{highlight(t.name, res.intent)}</b>
                    <span className="mono">{t.toolName} · {t.entry}</span>
                  </span>
                  <span className="cx-score mono">{t.score.toFixed(4)}</span>
                </div>
              ))}
            </>
          )}

          <div className="cx-foot mono">
            <span className="kbd">↑</span><span className="kbd">↓</span> 이동
            <span className="kbd">Enter</span> 열기
            <span className="kbd">Esc</span> 닫기
            <span className="cx-rrf">키워드 + 의미 융합</span>
          </div>
        </div>
      )}
    </div>
  );
}

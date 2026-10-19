import { useEffect, useState } from "react";
import { api } from "../api";
import CpLoading from "./CpLoading";
import "../compass.css";

/* 프로젝트 컨텍스트 한 장 — 온보딩 「프로젝트 소개」와 Compass 카드의 [편집] 이 같은 컴포넌트를 쓴다.
   사용자가 손대는 것은 둘: ① 소개 문단(초안을 고침) ② 올해 이루려는 것 한 줄. 나머지는 자동 칩 — 틀린 것만 ✕.
   말투: 마지막 단계라 사용자는 지쳐 있다 — "거의 다 됐어요 · 미리 정리해 두었어요 · 언제든 고칠 수 있어요". */

const PRIORITY_EXAMPLES = ["처리시간 단축", "신입 온보딩 단축", "계약 조회 자동화", "수요기관 응답 즉시화", "대금 지급 지연 줄이기"];
const CHIP_GROUPS = [["company", "회사"], ["industry", "업종"], ["org", "조직"], ["tasks", "업무"], ["users", "사용자"], ["constraints", "규제"], ["glossary", "용어"]];

export default function ProjectContextForm({ lang = "ko", initial = null, onSaved, onSkip, mode = "onboarding", projectId = null }) {
  const ko = lang === "ko";
  const [ctx, setCtx] = useState(initial);        // 저장된 컨텍스트 또는 초안
  const [loading, setLoading] = useState(!initial);
  const [narrative, setNarrative] = useState(initial?.narrative || "");
  const [priorities, setPriorities] = useState((initial?.priorities || []).join(", "));
  const [edited, setEdited] = useState(!!initial?.edited);
  const [removed, setRemoved] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [why, setWhy] = useState(false);          // 근거 팝업 — 문단이 어느 리소스에서 나왔는지
  const [err, setErr] = useState("");

  // 저장된 것이 없으면 리소스로 초안을 만든다(값은 읽지 않음)
  useEffect(() => {
    if (initial) return;
    let alive = true;
    (async () => {
      try {
        const saved = await api.compassContext(projectId);
        if (!alive) return;
        if (saved.context?.narrative) {
          setCtx(saved.context); setNarrative(saved.context.narrative); setPriorities((saved.context.priorities || []).join(", ")); setEdited(!!saved.context.edited);
        } else {
          const d = await api.compassContextDraft(projectId);
          if (!alive) return;
          setCtx({ ...d.draft, priorities: [] }); setNarrative(d.draft.narrative || "");
        }
      } catch (e) { if (alive) setErr(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [projectId]);   // eslint-disable-line react-hooks/exhaustive-deps

  const chips = [];
  if (ctx) {
    for (const [k, label] of CHIP_GROUPS) {
      const v = ctx[k];
      if (!v) continue;
      if (Array.isArray(v)) v.forEach((x) => chips.push({ key: `${k}:${x}`, label, text: x }));
      else if (typeof v === "object") Object.entries(v).forEach(([a, b]) => chips.push({ key: `glossary:${a}`, label, text: `${a} = ${b}` }));
      else chips.push({ key: `${k}:${v}`, label, text: v });
    }
  }
  const toggle = (key) => setRemoved((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const canSave = narrative.trim().length > 0 && priorities.trim().length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true); setErr("");
    try {
      const r = await api.compassContextSave({ narrative: narrative.trim(), priorities: priorities.trim(), removed: [...removed], edited: edited || narrative.trim() !== (ctx?.narrative || "") }, projectId);
      onSaved?.(r.context);
    } catch (e) { setErr(e.message || (ko ? "저장하지 못했습니다" : "Could not save")); }
    finally { setSaving(false); }
  };

  return (
    <div className={`cp-ctxform ${mode}`}>
      {mode === "onboarding" && (
        <div className="reassure">
          <span className="cp-chip ok">{ko ? "거의 다 됐어요 · 마지막 한 가지 · 1분" : "almost done · one last thing · 1 min"}</span>
          <h2>{ko ? "잠시만요, 마지막으로 한 가지만 확인할게요" : "One last thing before we finish"}</h2>
          <p>{ko ? "리소스는 모두 올라왔고 도구도 만들어졌습니다. 올라온 리소스를 보고 이 프로젝트가 어느 회사의 어떤 업무를 다루는지 미리 정리해 두었어요. 틀린 곳만 고치고, 올해 이루려는 것 한 줄만 적어 주시면 끝입니다 — 나머지는 저희가 정리합니다. 지금 건너뛰어도 되고, 언제든 다시 고칠 수 있어요."
                : "Resources are in and tools are built. We drafted what this project is about from them — fix what's wrong, add this year's goal in one line, and you're done. You can skip and edit any time."}</p>
        </div>
      )}
      {err && <div className="cp-alert" role="alert">{err}</div>}
      {loading ? (
        <CpLoading
          title={ko ? "이 프로젝트가 어떤 업무를 다루는지 정리하는 중이에요" : "Working out what this project covers"}
          note={ko ? "올라온 툴·테이블·문서의 이름만 읽습니다 — 데이터 값은 읽지 않아요 · 10초쯤 걸려요"
                   : "reads resource names only — no data values · about 10s"}
          steps={ko ? ["리소스 훑기", "업무 추리기", "문장으로 정리"] : ["scan", "infer", "write"]} />
      ) : (
        <>
          <div className="f">
            <label><span className="no">①</span>{ko ? "이 프로젝트가 다루는 회사 · 조직 · 업무" : "What this project covers"}<small>{ko ? "초안을 고치세요 — 문장 그대로 편집" : "edit the draft"}</small>{!edited && ctx?.source !== "user" && <span className="src">✦ {ko ? "초안" : "draft"}</span>}</label>
            <div className="tawrap">
              <textarea className={`ta ${!edited && ctx?.source !== "user" ? "ai" : ""}`} rows={4} value={narrative}
                onChange={(e) => { setNarrative(e.target.value); setEdited(true); }}
                placeholder={ko ? "예: 이 프로젝트는 조달청 계약·대금 지급 조회 업무를 다룹니다…" : ""} />
              {!!ctx?.evidence?.length && (
                <button type="button" className="whybtn" onClick={() => setWhy(true)}>
                  {ko ? "근거" : "basis"} <em>{ctx.evidence.length}</em></button>)}
            </div>
          </div>
          <div className="f">
            <label><span className="no">②</span>{ko ? "해당 프로젝트의 목표" : "This year's goal for this project"}<small>{ko ? "필수 · 한 줄 · 이것만은 사람이" : "required · one line"}</small></label>
            <input className={`in ${priorities.trim() ? "" : "need"}`} value={priorities} onChange={(e) => setPriorities(e.target.value)}
              placeholder={ko ? "예: 계약·대금 조회 평균 처리시간 20% 단축" : "e.g. cut call handling time 20%"} />
            <div className="ex">{PRIORITY_EXAMPLES.map((x) => <button key={x} type="button" onClick={() => setPriorities((v) => (v.trim() ? `${v.trim().replace(/,\s*$/, "")}, ${x}` : x))}>+ {x}</button>)}</div>
            <div className="why">{ko ? "제안의 순위와 \"왜 지금\" 이 이 한 줄을 따라갑니다." : "Ranking and rationale follow this line."}</div>
          </div>
          {!!chips.length && (
            <div className="f">
              <label>{ko ? "리소스 기반 추출 키워드" : "Structured automatically"}<small>{ko ? "①②와 리소스에서 뽑음 · 틀린 칩만 ✕" : "remove what's wrong"}</small><span className="src">✦ {ko ? "자동" : "auto"}</span></label>
              <div className="chips">{chips.map((c) => (
                <button key={c.key} type="button" className={removed.has(c.key) ? "off" : ""} onClick={() => toggle(c.key)} title={removed.has(c.key) ? (ko ? "되살리기" : "restore") : (ko ? "빼기" : "remove")}>
                  <em>{c.label}</em>{c.text}<i>{removed.has(c.key) ? "↺" : "✕"}</i></button>))}</div>
            </div>
          )}
          <div className="acts">
            <button className="skl-btn pri" disabled={!canSave || saving} onClick={save}>{saving ? (ko ? "저장하는 중…" : "saving…") : mode === "onboarding" ? (ko ? "확인했어요, 완료로 →" : "Looks right, finish →") : (ko ? "저장" : "Save")}</button>
            {onSkip && <button className="skl-btn ghost" onClick={onSkip}>{mode === "onboarding" ? (ko ? "나중에 할게요" : "Later") : (ko ? "닫기" : "Close")}</button>}
            <span className="meta">{ko ? "프로젝트 설정에 저장되고 언제든 고칠 수 있어요 · 데이터 값은 읽지 않았습니다" : "saved to project settings · editable any time · no data values were read"}</span>
          </div>
        </>
      )}
      {why && !!ctx?.evidence?.length && (
        <div className="cp-modal" role="dialog" aria-modal="true" onClick={() => setWhy(false)}>
          <div className="box evi" onClick={(e) => e.stopPropagation()}>
            <h3>{ko ? "이 문단의 근거" : "What this draft is based on"}</h3>
            <div className="sub">{ko ? "올라온 리소스의 이름에서 뽑았습니다 — 데이터 값은 읽지 않았습니다"
                                     : "taken from resource names only — no data values were read"}</div>
            <ul>{ctx.evidence.map((e, k) => (
              <li key={k}><b>{e.claim}</b>{!!e.refs?.length && <small>{e.refs.join(" · ")}</small>}</li>))}</ul>
            <div className="acts"><button className="skl-btn ghost" onClick={() => setWhy(false)}>{ko ? "닫기" : "Close"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

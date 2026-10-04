import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import { ErrorBox } from "../components/States";

/**
 * 스킬 빌더 — EmberLink(climax) SkillBuilder 계보의 3열.
 *
 *   좌: MCP 팔레트   중: 파이프라인 캔버스   우: 선택한 step 인스펙터
 *
 * 계승한 상호작용
 *   - 팔레트에서 캔버스로 **드래그**해 단계를 추가한다
 *   - 단계 사이 연결선에 마우스를 올리면 **＋ 프롬프트**가 나타난다
 *   - 인스펙터의 **변수 칩**을 누르면 커서 자리에 삽입된다
 *   - 앞 단계의 결과만 참조할 수 있다 (뒤를 가리키면 저장이 막힌다)
 *
 * 더한 것: **1회 실행 비용**. 유료 MCP 를 담으면 인스펙터에 합계가 뜬다.
 */

type PaletteItem = {
  id: number; name: string; toolName: string; method: string;
  description: string; pricePerCall: number; kind: string; entry: string;
};
type Step = {
  uid: string;
  type: "mcp" | "prompt";
  tool_id: string | null;
  args_template: Record<string, unknown>;
  text: string;
};

let seq = 0;
const uid = () => `s${++seq}`;

/** 서버(app/routers/skills.py)와 같은 규칙. 한글을 지우지 않는다 —
 *  스킬 이름이 대부분 한국어라 a-z 만 남기면 전부 "skill" 이 된다. */
function slugify(text: string): string {
  return text.trim().toLowerCase()
    .replace(/[\s/?#&=+%\\.,:;'"()[\]{}<>!@$^*|~`]+/g, "-")
    .replace(/^-|-$/g, "") || "skill";
}

export default function SkillBuilder() {
  const { id, skillId } = useParams();
  const projectId = Number(id);
  const editing = skillId && skillId !== "new" ? Number(skillId) : null;
  const navigate = useNavigate();

  const [palette, setPalette] = useState<PaletteItem[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragged = useRef<{ kind: "tool"; item: PaletteItem } | { kind: "step"; uid: string } | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    api.get(`/api/projects/${projectId}/skill-palette`)
      .then(setPalette)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(() => {
    if (!editing) return;
    api.get(`/api/projects/${projectId}/skills`)
      .then((rows) => {
        const s = rows.find((r: { id: number }) => r.id === editing);
        if (!s) return;
        setName(s.name);
        setSlug(s.slug);
        setDesc(s.description);
        setSteps(s.steps.map((st: Omit<Step, "uid">) => ({ ...st, uid: uid() })));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [editing, projectId]);

  const insertAt = useCallback((idx: number, step: Step) => {
    setSteps((s) => [...s.slice(0, idx), step, ...s.slice(idx)]);
    setSel(step.uid);
  }, []);

  function addTool(idx: number, item: PaletteItem) {
    insertAt(idx, {
      uid: uid(), type: "mcp", tool_id: String(item.id), args_template: {}, text: "",
    });
  }

  function addPrompt(idx: number) {
    insertAt(idx, { uid: uid(), type: "prompt", tool_id: null, args_template: {}, text: "" });
  }

  function onDrop(idx: number) {
    const d = dragged.current;
    dragged.current = null;
    setOver(null);
    if (!d) return;
    if (d.kind === "tool") {
      addTool(idx, d.item);
      return;
    }
    // 순서 바꾸기 — 자기 자리로 떨어뜨리면 아무 일도 없어야 한다.
    setSteps((s) => {
      const from = s.findIndex((x) => x.uid === d.uid);
      if (from < 0 || from === idx || from === idx - 1) return s;
      const moving = s[from];
      const rest = s.filter((x) => x.uid !== d.uid);
      const to = from < idx ? idx - 1 : idx;
      return [...rest.slice(0, to), moving, ...rest.slice(to)];
    });
  }

  function patch(uidKey: string, next: Partial<Step>) {
    setSteps((s) => s.map((x) => (x.uid === uidKey ? { ...x, ...next } : x)));
  }

  /** 변수 칩 삽입. 커서 자리에 넣어야 문장 중간에서도 쓸 수 있다. */
  function insertVar(v: string) {
    const step = steps.find((s) => s.uid === sel);
    if (!step || step.type !== "prompt") return;
    const el = textRef.current;
    const at = el ? el.selectionStart : step.text.length;
    const next = `${step.text.slice(0, at)}${v}${step.text.slice(at)}`;
    patch(step.uid, { text: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + v.length, at + v.length);
    });
  }

  async function save() {
    if (!name.trim()) {
      setError("스킬 이름을 입력해 주세요");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(), slug: slug.trim() || slugify(name), description: desc.trim(),
      tags: [] as string[],
      steps: steps.map(({ uid: _u, ...rest }) => rest),
    };
    try {
      if (editing) await api.put(`/api/skills/${editing}`, body);
      else await api.post(`/api/projects/${projectId}/skills`, body);
      navigate(`/projects/${projectId}/skills`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const selStep = steps.find((s) => s.uid === sel) ?? null;
  const selIdx = steps.findIndex((s) => s.uid === sel);
  const toolOf = (tid: string | null) => palette.find((p) => String(p.id) === tid);
  const cost = steps.reduce((n, s) =>
    s.type === "mcp" ? n + (toolOf(s.tool_id)?.pricePerCall ?? 0) : n, 0);
  const shown = palette.filter((p) =>
    !search || p.name.includes(search) || p.toolName.includes(search));

  // 앞 단계 결과만 참조할 수 있다 — 뒤를 가리키면 실행 순서상 값이 없다.
  const vars = ["{{input}}", ...steps.slice(0, Math.max(0, selIdx)).map((_, i) => `{{steps[${i}].output}}`)];

  /** 단계 사이 연결선. 드롭 지점이자 프롬프트 삽입 지점이다. */
  const Conn = ({ idx }: { idx: number }) => (
    <div
      className={`skl-conn ${over === idx ? "over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(idx); }}
      onDragLeave={() => setOver((o) => (o === idx ? null : o))}
      onDrop={() => onDrop(idx)}
    >
      <button type="button" className="skl-addp" onClick={() => addPrompt(idx)}>
        ＋ 프롬프트
      </button>
    </div>
  );

  return (
    <Shell breadcrumb={["프로젝트", "스킬", editing ? "편집" : "생성"]} projectId={projectId}>
      <div className="page-head">
        <div>
          <span className="eyebrow">skill builder</span>
          <h1>{editing ? "Skill 편집" : "Skill 생성"}</h1>
        </div>
        <div className="head-side">
          <button type="button" className="btn btn-ghost"
                  onClick={() => navigate(`/projects/${projectId}/skills`)}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="skl-builder">
        {/* ── 좌: 팔레트 ── */}
        <aside className="skl-panel">
          <h3>MCP 팔레트 <span className="cnt mono">{palette.length}</span></h3>
          <input className="input" value={search} placeholder="도구 검색"
                 onChange={(e) => setSearch(e.target.value)} />
          <div className="skl-palette">
            {palette.length === 0 && (
              <p className="skl-empty">
                담긴 MCP 가 없습니다 — 마켓에서 먼저 담으세요
              </p>
            )}
            {shown.map((p) => (
              <div key={p.id} className="skl-mcp" draggable
                   onDragStart={() => { dragged.current = { kind: "tool", item: p }; }}
                   onDoubleClick={() => addTool(steps.length, p)}>
                <span className="grip" aria-hidden="true">⠿</span>
                <span className="skl-mcp-nm">
                  <span className="nm">{p.name}</span>
                  <span className="sub mono">{p.toolName}</span>
                </span>
                {p.pricePerCall > 0
                  ? <span className="skl-meth is-paid mono">₩{p.pricePerCall}</span>
                  : <span className={`skl-meth ${p.method.toLowerCase()} mono`}>{p.method}</span>}
              </div>
            ))}
          </div>
          <p className="skl-tip">
            끌어다 가운데에 놓으세요. 두 번 눌러도 맨 뒤에 붙습니다.
            유료 MCP 는 스킬 1회 실행마다 단가가 곱해집니다.
          </p>
        </aside>

        {/* ── 중: 캔버스 ── */}
        <div className="skl-canvas">
          <div className="skl-cvhead">
            <input className="nm" value={name} placeholder="스킬 이름"
                   onChange={(e) => setName(e.target.value)} />
            <span className="skl-slug">
              /<input value={slug} placeholder={slugify(name || "skill")}
                      onChange={(e) => setSlug(e.target.value)} />
            </span>
          </div>
          <input className="input skl-desc" value={desc} placeholder="한 줄 설명"
                 onChange={(e) => setDesc(e.target.value)} />

          <div className="skl-flow">
            {steps.length === 0 && <Conn idx={0} />}
            {steps.map((s, i) => {
              const tool = toolOf(s.tool_id);
              return (
                <div key={s.uid}>
                  {i === 0 && <Conn idx={0} />}
                  <div
                    className={`skl-node ${s.type} ${sel === s.uid ? "sel" : ""}`}
                    draggable
                    onDragStart={() => { dragged.current = { kind: "step", uid: s.uid }; }}
                    onClick={() => setSel(s.uid)}
                  >
                    <span className="ic mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="body">
                      <span className="t">
                        {s.type === "mcp" ? (tool?.name ?? "도구를 고르세요") : "프롬프트"}
                        <span className="type mono">{s.type === "mcp" ? "MCP" : "PROMPT"}</span>
                      </span>
                      <span className="args mono">
                        {s.type === "mcp"
                          ? (tool?.toolName ?? "—")
                          : (s.text || "지시문을 적으세요")}
                      </span>
                    </span>
                    <button type="button" className="skl-x"
                            aria-label="이 단계 삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSteps((arr) => arr.filter((x) => x.uid !== s.uid));
                              if (sel === s.uid) setSel(null);
                            }}>✕</button>
                  </div>
                  <Conn idx={i + 1} />
                </div>
              );
            })}
            <div className="skl-node term">여기에 놓아 단계 추가</div>
          </div>
        </div>

        {/* ── 우: 인스펙터 ── */}
        <aside className="skl-panel">
          {!selStep && <p className="skl-empty">단계를 고르면 여기서 고칩니다</p>}

          {selStep?.type === "prompt" && (
            <>
              <h3>Step {selIdx + 1} · PROMPT</h3>
              <textarea
                ref={textRef}
                className="textarea"
                rows={5}
                value={selStep.text}
                placeholder="{{steps[0].output}} 를 표로 정리하라"
                onChange={(e) => patch(selStep.uid, { text: e.target.value })}
              />
              <div className="skl-lbl">쓸 수 있는 변수</div>
              <div>
                {vars.map((v) => (
                  <button key={v} type="button" className="skl-varchip mono"
                          onClick={() => insertVar(v)}>{v}</button>
                ))}
              </div>
              <p className="skl-tip">
                칩을 누르면 커서 자리에 삽입됩니다. 앞 단계의 결과만 참조할 수 있습니다.
              </p>
            </>
          )}

          {selStep?.type === "mcp" && (
            <>
              <h3>Step {selIdx + 1} · MCP</h3>
              <div className="skl-lbl">도구</div>
              <select className="input" value={selStep.tool_id ?? ""}
                      onChange={(e) => patch(selStep.uid, { tool_id: e.target.value })}>
                <option value="">고르세요</option>
                {palette.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
              {toolOf(selStep.tool_id) && (
                <p className="skl-tip">{toolOf(selStep.tool_id)!.description}</p>
              )}
              <div className="skl-lbl">인자 (JSON)</div>
              <textarea
                className="textarea mono"
                rows={4}
                value={JSON.stringify(selStep.args_template, null, 2)}
                onChange={(e) => {
                  try {
                    patch(selStep.uid, { args_template: JSON.parse(e.target.value || "{}") });
                  } catch {
                    /* 입력 중에는 깨진 JSON 이 정상이다. 저장 시점에만 막는다. */
                  }
                }}
              />
              <p className="skl-tip">
                값에 <code>{"{{input}}"}</code> 이나 <code>{"{{steps[0].output}}"}</code> 을 쓸 수 있습니다.
              </p>
            </>
          )}

          <div className="skl-lbl">이 스킬의 1회 실행 비용</div>
          <div className="skl-cost">
            <span>MCP 호출 {steps.filter((s) => s.type === "mcp").length}회</span>
            <b className={cost > 0 ? "num is-warn" : "num is-ok"}>₩{cost.toLocaleString()}</b>
          </div>
        </aside>
      </div>

    </Shell>
  );
}

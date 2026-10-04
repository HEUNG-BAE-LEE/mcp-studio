import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { CartItem } from "../hooks/useCart";

/**
 * 담은 MCP 를 프로젝트 여러 곳에 보낸다.
 *
 * 복수 선택을 허용하는 이유는 "도로명주소 변환"처럼 어느 프로젝트에나 쓰이는
 * MCP 가 있기 때문이다. 프로젝트마다 마켓을 다시 뒤지게 만들 이유가 없다.
 *
 * 이미 담긴 것이 섞여 있어도 전송을 막지 않는다. 그 항목만 건너뛰고 나머지를
 * 보낸다 — "이미 있어서 못 보냅니다"로 되돌리면 무엇을 빼야 하는지 사용자가
 * 직접 찾아야 한다.
 */

type Project = { id: number; name: string; description: string; actions?: number };

export default function DispatchSheet({
  items, onClose, onDone,
}: {
  items: CartItem[];
  onClose: () => void;
  onDone: (msg: string, detail?: string) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [dupes, setDupes] = useState<Record<number, number>>({});
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/projects")
      .then(async (rows: Project[]) => {
        setProjects(rows);
        // 각 프로젝트에 이미 담긴 것을 세어 둔다. 보내기 전에 몇 개가
        // 건너뛰어지는지 알려줘야 결과가 예상과 어긋나지 않는다.
        const counts: Record<number, number> = {};
        await Promise.all(rows.map(async (p) => {
          try {
            const have = await api.get(`/api/projects/${p.id}/catalog`);
            const ids = new Set(have.map((h: { id: number }) => h.id));
            counts[p.id] = items.filter((i) => ids.has(i.id)).length;
          } catch {
            counts[p.id] = 0;
          }
        }));
        setDupes(counts);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  async function send() {
    if (sending) return;
    if (!picked.length && !newName.trim()) {
      setError("보낼 프로젝트를 골라 주세요");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const r = await api.post("/api/catalog/dispatch", {
        entryIds: items.map((i) => i.id),
        projectIds: picked,
        newProjectName: newName.trim(),
      });
      const skipped = r.skipped ? ` · ${r.skipped}개 건너뜀(이미 담김)` : "";
      onDone(`${r.projects}개 프로젝트에 담았습니다`, `MCP ${r.added}개 추가${skipped}`);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  const totalTools = items.reduce((n, i) => n + i.tools, 0);
  const targetCount = picked.length + (newName.trim() ? 1 : 0);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>어느 프로젝트로 보낼까요</strong>
            <span>MCP {items.length}개 · 도구 {totalTools}개 — 여러 곳을 함께 고를 수 있습니다</span>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="닫기">✕</button>
        </div>

        <div className="modal-pad">
          {projects === null && <p className="t3">프로젝트를 불러오는 중…</p>}

          <div className="dz-list">
            {(projects ?? []).map((p) => {
              const on = picked.includes(p.id);
              const dup = dupes[p.id] ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`dz-row ${on ? "on" : ""}`}
                  onClick={() => setPicked((s) =>
                    s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id])}
                >
                  <span className="dz-cb" aria-hidden="true">✓</span>
                  <span className="dz-nm">
                    <b>{p.name}</b>
                    <span>{p.description || "설명 없음"}</span>
                  </span>
                  {dup > 0 && <span className="dz-dup">{dup}개 이미 있음</span>}
                </button>
              );
            })}

            <div className={`dz-row is-new ${newName.trim() ? "on" : ""}`}>
              <span className="dz-cb" aria-hidden="true">＋</span>
              <span className="dz-nm">
                {creating || newName ? (
                  <input
                    className="input"
                    autoFocus
                    value={newName}
                    placeholder="새 프로젝트 이름"
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  />
                ) : (
                  <button type="button" className="dz-newbtn" onClick={() => setCreating(true)}>
                    <b>새 프로젝트 만들어 보내기</b>
                    <span>이름만 정하면 됩니다</span>
                  </button>
                )}
              </span>
            </div>
          </div>

          {Object.values(dupes).some((n) => n > 0) && (
            <p className="guide-note" style={{ marginTop: 14 }}>
              <strong>이미 담긴 것은 건너뜁니다</strong>
              전송을 막지 않습니다. 겹치는 항목만 빼고 나머지를 보낸 뒤 결과를 알려드립니다.
            </p>
          )}

          {error && <p className="field-help is-error">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={send}
                  disabled={sending || targetCount === 0}>
            {sending ? "보내는 중…" : `${targetCount || 0}개 프로젝트로 보내기`}
          </button>
        </div>
      </div>
    </div>
  );
}

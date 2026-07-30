import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";

/**
 * 프로젝트 이름·설명 수정.
 *
 * 이름은 확장이 프로젝트를 찾는 열쇠이기도 하다 — 사이드 패널에 같은 이름을
 * 넣으면 그 프로젝트에 담긴다. 그래서 이름을 바꾸면 확장 설정도 함께 고쳐야
 * 하고, 다른 프로젝트와 겹치면 안 된다(서버가 409 로 막는다).
 */
type Project = { id: number; name: string; description: string };

export default function ProjectEditModal({
  project, onClose, onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("프로젝트 이름을 입력해 주세요");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/projects/${project.id}`, {
        name: trimmed,
        description: description.trim(),
      });
      onSaved(trimmed);
    } catch (err) {
      // 이름 중복(409)은 이 창 안에서 고칠 수 있는 문제다. 바깥 배너로 보내면
      // 창을 닫아야 읽을 수 있다.
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-title"
         onClick={onClose}>
      <div className="modal-card modal-narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong id="edit-title">이름·설명 수정</strong>
            <span>설명은 목록 카드에 두 줄까지 보입니다</span>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기">✕</button>
        </div>

        <div className="modal-pad">
          <label className="field-label" htmlFor="pj-name">이름</label>
          <input
            id="pj-name"
            ref={nameRef}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            disabled={saving}
          />

          <label className="field-label" htmlFor="pj-desc" style={{ marginTop: 16 }}>설명</label>
          <textarea
            id="pj-desc"
            className="textarea"
            rows={3}
            value={description}
            placeholder="무엇을 모아 둔 프로젝트인지 한두 줄로"
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />

          <p className="guide-note" style={{ marginTop: 16 }}>
            <strong>이름은 확장이 프로젝트를 찾는 열쇠입니다</strong>
            사이드 패널에 같은 이름을 넣으면 이 프로젝트에 담깁니다. 이름을 바꾸면
            확장 쪽 설정도 함께 고쳐 주세요.
          </p>

          {error && <p className="field-help is-error">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

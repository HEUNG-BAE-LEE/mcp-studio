import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { MarkPortal } from "./CollectionMark";

/**
 * 포털 인증키 등록.
 *
 * 트래픽 기반 수집은 기록된 URL에 키가 이미 박혀 있지만, 포털 공개 기반 수집은
 * 명세만 읽으므로 키가 없다. 실행 직전에 주입해야 하고, 그 값은 사용자만 갖고 있다.
 *
 * 키는 등록 후 되돌려주지 않는다 — 서버는 마스킹된 형태만 내려보낸다.
 */

type Credential = { portal: string; masked: string };

export default function CredentialPanel({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<Credential[] | null>(null);
  const [portal, setPortal] = useState("serviceKey");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/credentials`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(load, [load]);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("인증키를 입력해 주세요");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/projects/${projectId}/credentials`, { portal, value: trimmed });
      setValue("");
      setSaved(true);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="panel" style={{ marginTop: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <MarkPortal />
        <strong style={{ fontSize: 13 }}>포털 인증키</strong>
      </div>
      <p className="subtitle" style={{ margin: "0 0 12px" }}>
        포털 공개 기반 수집으로 만든 액션은 인증키를 LLM 에게 숨기고 실행 시점에 주입합니다.
        키가 없으면 호출 전에 막힙니다.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={portal}
          onChange={(e) => setPortal(e.target.value)}
          placeholder="파라미터 이름 (예: serviceKey)"
          style={{ width: 200, padding: 9 }}
        />
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="공공데이터포털에서 발급받은 인증키"
          style={{ flex: 1, minWidth: 220, padding: 9 }}
        />
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "등록 중…" : "등록"}
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 10 }}>
          <p>{error}</p>
        </div>
      )}

      {saved && !error && (
        <p className="spec-note" style={{ marginTop: 10 }}>인증키를 등록했습니다.</p>
      )}

      {rows && rows.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          {rows.map((row) => (
            <div key={row.portal} style={{ display: "flex", gap: 10, padding: "4px 0" }}>
              <span style={{ minWidth: 140 }}>{row.portal}</span>
              <code>{row.masked}</code>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

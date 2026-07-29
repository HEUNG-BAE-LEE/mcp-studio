import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";

/**
 * 포털 인증키 등록.
 *
 * 트래픽 기반 수집은 기록된 URL에 키가 이미 박혀 있지만, 포털 공개 기반 수집은
 * 명세만 읽으므로 키가 없다. 실행 직전에 주입해야 하고, 그 값은 사용자만 갖고 있다.
 *
 * 키는 등록 후 되돌려주지 않는다 — 서버는 마스킹된 형태만 내려보낸다.
 *
 * 이미 등록된 키가 있으면 접어 둔다. 실행 실패의 1순위 원인이라 상태는 늘
 * 보여야 하지만, 입력란까지 화면 위쪽을 계속 차지할 이유는 없다.
 */

type Credential = { portal: string; masked: string };

export default function CredentialPanel({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<Credential[] | null>(null);
  const [portal, setPortal] = useState("serviceKey");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/credentials`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(load, [load]);

  const registered = (rows?.length ?? 0) > 0;
  const expanded = open || !registered;

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
      setOpen(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="panel panel-pad">
      <div className="cluster between">
        <span className="field-label m0">
          포털 인증키
        </span>
        {registered ? (
          <span className="cluster">
            <span className="dot dot-ok">등록됨</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={expanded}
              onClick={() => setOpen(!open)}
            >
              {open ? "접기" : "변경"}
            </button>
          </span>
        ) : (
          <span className="dot dot-warn">미등록</span>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="cred-list">
          {rows.map((row) => (
            <div key={row.portal}>
              <span style={{ minWidth: 96 }}>{row.portal}</span>
              <span>{row.masked}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <>
          <p className="field-help mt-3">
            포털 공개 기반 수집으로 만든 액션은 인증키를 LLM 에게 숨기고 실행 시점에 주입합니다. 키가 없으면
            호출 전에 막힙니다.
          </p>
          <div className="cred-row mt-3">
            <input
              className="input input-mono"
              style={{ width: 150, flex: "0 0 150px" }}
              value={portal}
              aria-label="파라미터 이름"
              onChange={(e) => setPortal(e.target.value)}
              placeholder="serviceKey"
            />
            <input
              className="input"
              type="password"
              value={value}
              aria-label="인증키"
              onChange={(e) => setValue(e.target.value)}
              placeholder="공공데이터포털에서 발급받은 인증키"
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? "등록 중…" : "등록"}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="field-help" style={{ color: "var(--danger)", marginTop: 9 }} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

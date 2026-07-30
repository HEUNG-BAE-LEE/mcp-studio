import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";

/**
 * 포털 인증키 — 헤더에 붙는 상태 칩.
 *
 * 포털 공개 기반 수집은 명세만 읽으므로 키가 없다. 실행 직전에 주입해야 하고
 * 그 값은 사용자만 갖고 있다. 없으면 호출이 막히므로 화면에서 지울 수는 없다.
 *
 * 다만 늘 펼쳐 둘 이유도 없다. 한 번 등록하면 바꿀 일이 드문 값인데 입력란 두 개가
 * 대화 위를 차지하면, 이 화면이 무엇을 하는 곳인지 흐려진다. 그래서 평소에는
 * 상태만 한 줄로 보여주고, 누를 때만 편집란을 연다. 미등록일 때는 색으로 눈에
 * 띄게 해 "왜 호출이 실패하는지"를 찾아 헤매지 않게 한다.
 */

type Credential = { portal: string; masked: string };

export default function CredentialPanel({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<Credential[] | null>(null);
  const [open, setOpen] = useState(false);
  const [portal, setPortal] = useState("serviceKey");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setOpen(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const current = rows?.[0];

  return (
    <div className="cred">
      <button
        className={`cred-chip ${current ? "" : "is-missing"}`}
        onClick={() => setOpen((v) => !v)}
        title="포털 인증키는 LLM 에게 숨기고 실행 시점에 주입합니다"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.6" cy="8" r="2.6" />
          <path d="M8.2 8h6.2M12.4 8v2.2M10.6 8v1.6" strokeLinecap="round" />
        </svg>
        {current ? <>인증키 <code>{current.masked}</code></> : <>인증키 미등록</>}
      </button>

      {open && (
        <div className="cred-form">
          <p>
            포털 공개 기반 수집으로 만든 도구는 인증키를 LLM 에게 숨기고 실행 시점에 주입합니다.
            키가 없으면 호출 전에 막힙니다.
          </p>
          <div className="cred-row">
            <input
              value={portal}
              onChange={(e) => setPortal(e.target.value)}
              placeholder="파라미터 이름"
              aria-label="파라미터 이름"
            />
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="공공데이터포털에서 발급받은 인증키"
              aria-label="인증키"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            />
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "등록 중…" : "등록"}
            </button>
            <button className="btn-quiet" onClick={() => setOpen(false)}>닫기</button>
          </div>
          {error && <p className="cred-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

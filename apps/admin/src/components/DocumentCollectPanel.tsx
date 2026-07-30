import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";

/**
 * 문서 기반 수집.
 *
 * 포털에 게시되지도, 화면에서 실행되지도 않는 API 가 있다. 기관이 문서로만 배포한
 * 경우다. 이때 남는 방법은 그 문서를 읽는 것뿐이다.
 *
 * 파일마다 결과를 따로 알려준다. 다섯 개를 올렸는데 하나가 실패했을 때 "실패했습니다"
 * 한 줄이면 어느 파일이 문제인지 알 수 없다.
 */

const BASE = "http://localhost:8000";
const ACCEPT = ".pdf,.txt,.md,.json,.yaml,.yml,.html,.htm,.docx,.csv";

type Report = {
  file: string;
  serviceName?: string;
  provider?: string;
  operations: number;
  warnings: string[];
};

type Result = { sessionId: number | null; operations: number; reports: Report[]; message: string };

function sizeText(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function DocumentCollectPanel({
  projectId,
  onStarted,
}: {
  projectId: number | null;
  /** 결과 화면으로 넘어갈 때. 팝업 안이면 스스로 닫는다. */
  onStarted?: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(selected: FileList | null) {
    if (!selected) return;
    // 같은 파일을 두 번 고르는 실수를 막는다. 이름+크기로 판단한다.
    const merged = [...files];
    for (const file of Array.from(selected)) {
      if (!merged.some((f) => f.name === file.name && f.size === file.size)) merged.push(file);
    }
    setFiles(merged);
    setResult(null);
    setError(null);
  }

  async function submit() {
    if (!projectId) {
      setError("수집 결과를 담을 프로젝트를 먼저 고르세요.");
      return;
    }
    if (files.length === 0) {
      setError("분석할 문서를 선택하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    try {
      // FormData 는 api 클라이언트(JSON 전용)를 쓸 수 없어 fetch 를 직접 쓴다.
      const response = await fetch(`${BASE}/api/projects/${projectId}/document-collections`, {
        method: "POST",
        body: form,
      });
      const text = await response.text();
      const parsed = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(parsed?.detail || `업로드 실패 (${response.status})`);
      setResult(parsed);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crawl-panel">
      <div className="crawl-head">
        <strong>활용가이드 문서에서 명세 읽기</strong>
        <span>PDF·텍스트 문서를 올리면 API 명세를 찾아 MCP 도구로 만듭니다.</span>
      </div>

      <div className="doc-pick">
        <button className="btn-outline doc-browse" onClick={() => inputRef.current?.click()} disabled={busy}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1.8 4.2A1.4 1.4 0 0 1 3.2 2.8h3l1.4 1.6h4.2a1.4 1.4 0 0 1 1.4 1.4v5.4a1.4 1.4 0 0 1-1.4 1.4H3.2a1.4 1.4 0 0 1-1.4-1.4z"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          찾아보기
        </button>
        <span className="doc-pick-note">
          {files.length === 0 ? "여러 개 선택 가능" : `${files.length}개 선택됨`}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => pick(e.target.files)}
          style={{ display: "none" }}
        />
        <button className="btn btn-primary" onClick={submit} disabled={busy || files.length === 0}>
          {busy ? "분석 중…" : "수집하기"}
        </button>
      </div>

      {files.length > 0 && (
        <ul className="doc-files">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              <span className="doc-name" title={file.name}>{file.name}</span>
              <span className="doc-size">{sizeText(file.size)}</span>
              <button
                className="btn-icon"
                onClick={() => setFiles(files.filter((f) => f !== file))}
                disabled={busy}
                aria-label="목록에서 제거"
              >✕</button>
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <div className="doc-loading">
          <span className="spinner" />
          <div>
            <strong>문서를 읽고 명세를 찾고 있습니다</strong>
            <small>문서 하나에 10~30초 걸립니다. 창을 닫지 말고 기다려 주세요.</small>
          </div>
        </div>
      )}

      {error && (
        <div className="error-box" style={{ marginTop: 10 }}>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className={`doc-result ${result.operations > 0 ? "is-ok" : ""}`}>
          <strong>{result.message}</strong>
          <ul>
            {result.reports.map((report) => (
              <li key={report.file}>
                <span className="doc-name">{report.file}</span>
                <span className={report.operations > 0 ? "doc-ok" : "doc-none"}>
                  {report.operations > 0 ? `API ${report.operations}개` : "찾지 못함"}
                </span>
                {report.warnings.length > 0 && <em>{report.warnings[0]}</em>}
              </li>
            ))}
          </ul>
          {result.sessionId && (
            <button className="btn btn-primary" onClick={() => { onStarted?.(); navigate(`/spec-sessions/${result.sessionId}`); }}>
              수집 결과 보기
            </button>
          )}
        </div>
      )}

      <p className="guide-note" style={{ marginTop: 12 }}>
        <strong>문서에 적힌 것만 씁니다</strong>
        엔드포인트가 문서에 없으면 그 API 는 만들지 않습니다. 추출한 명세에는 “확인이 필요합니다”
        표시가 붙으며, Playground 에서 실제로 호출해 확인한 뒤 쓰는 것이 안전합니다.
        HWP 는 아직 직접 읽지 못하므로 PDF 로 저장해 올려 주세요.
      </p>
    </div>
  );
}

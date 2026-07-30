import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";

/**
 * 수집 전 확인 창.
 *
 * 포털 검색은 낱말이 겹치는 것을 다 준다. '미세먼지' 로 검색하면 대기질 API 옆에
 * '아이돌봄 대기가점기준' 이 같이 나온다. 무엇이 잡힐지 모르고 수집을 시작하면
 * 엉뚱한 API 가 섞이고, 그걸 나중에 지우는 편이 더 번거롭다.
 *
 * 그래서 ① 후보를 먼저 보여주고 ② 무엇에 쓸 것인지 적으면 LLM 이 목적에 맞는 것만
 * 추려 체크를 조정하고 ③ 마지막 판단은 사람이 체크박스로 한다.
 * LLM 판단을 그대로 믿고 수집하면, 왜 빠졌는지 알 수 없는 API 가 생긴다.
 */

type Candidate = {
  publicDataPk: string;
  title: string;
  provider: string;
  url: string;
  include: boolean;
  reason: string;
};

type PreviewResult = {
  judged: boolean;
  reason: string | null;
  items: Candidate[];
  keyword: string;
};

const PURPOSE_EXAMPLES = [
  "지역별 실시간 대기질과 미세먼지 예보를 알려주는 챗봇",
  "측정소 위치와 기준값을 조회하는 데이터 분석",
  "대기 경보·주의보 발령 현황 모니터링",
];

export default function CrawlPreviewDialog({
  listUrl,
  limit,
  projectName,
  onClose,
  onStart,
}: {
  listUrl: string;
  limit: number;
  projectName: string;
  onClose: () => void;
  onStart: (selected: string[], purpose: string) => Promise<void>;
}) {
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matching, setMatching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purposeRef = useRef<HTMLTextAreaElement | null>(null);

  function applyResult(next: PreviewResult) {
    setResult(next);
    // 기본은 전체 선택. LLM 이 추렸으면 그 결과를 초기값으로 쓴다.
    setChecked(new Set(next.items.filter((item) => item.include).map((item) => item.publicDataPk)));
  }

  async function load(withPurpose: string) {
    if (!result) setLoading(true); else setMatching(true);
    setError(null);
    try {
      applyResult(await api.post("/api/portal-crawls/preview", { listUrl, purpose: withPurpose, pages: 3 }));
      setSearched(true);
    } catch (err) {
      setError(errorMessage(err));
      setResult(null);
      setChecked(new Set());
      setSearched(true);
    } finally {
      setLoading(false);
      setMatching(false);
    }
  }

  // Esc 로 닫는다. 모달을 열어두고 빠져나갈 길이 버튼 하나뿐이면 답답하다.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !starting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, starting]);

  const items = result?.items ?? [];
  const allChecked = items.length > 0 && checked.size === items.length;
  function toggle(pk: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });
  }

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await onStart([...checked], purpose.trim());
    } catch (err) {
      setError(errorMessage(err));
      setStarting(false);
    }
  }

  return (
    <div className="dlg-backdrop" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <div className="dlg">
        <header className="dlg-head">
          <div>
            <h2 id="dlg-title">수집할 API 고르기</h2>
            <p>
              <b>{projectName}</b> 프로젝트에 담습니다 · 오퍼레이션 최대 <b>{limit}개</b>
            </p>
          </div>
          <button className="dlg-close" onClick={onClose} disabled={starting} aria-label="닫기">✕</button>
        </header>

        <div className="dlg-body">
          <section className="dlg-purpose">
            <label htmlFor="purpose">어떤 용도로 쓸 API 인가요?</label>
            <p className="dlg-hint">
              적어 주신 말에서 검색어를 뽑아 포털을 찾고, 목적에 맞는 API 만 골라 체크해
              드립니다. 마지막 선택은 아래 체크박스로 직접 하실 수 있습니다.
            </p>
            <div className="dlg-purpose-row">
              <textarea
                id="purpose"
                ref={purposeRef}
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 지역별 실시간 대기질과 미세먼지 예보를 알려주는 챗봇"
                disabled={starting}
              />
              <button
                className="btn btn-primary"
                onClick={() => load(purpose.trim())}
                disabled={matching || loading || starting || !purpose.trim()}
              >
                {matching || loading ? "찾는 중…" : searched ? "다시 찾기" : "API 찾기"}
              </button>
            </div>
            <div className="dlg-examples">
              {PURPOSE_EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => setPurpose(example)} disabled={starting}>
                  {example}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="error-box" style={{ margin: "0 0 12px" }}>
              <p>{error}</p>
            </div>
          )}

          {result?.reason && !loading && (
            <p className="dlg-notice">{result.reason}</p>
          )}
          {result?.judged && !matching && (
            <p className="dlg-notice is-ok">
              용도에 맞는 <b>{items.filter((i) => i.include).length}개</b>를 골라 체크했습니다.
              판단이 아쉬우면 직접 조정하세요.
            </p>
          )}

          {!searched && !loading ? (
            <div className="dlg-empty">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 21 21" strokeLinecap="round" />
              </svg>
              <strong>무엇에 쓸 API 인지 적어 주세요</strong>
              <small>
                적어 준 말에서 검색어를 뽑아 공공데이터포털을 찾습니다.
                결과가 나오면 체크로 고를 수 있습니다.
              </small>
              <button className="btn-outline" onClick={() => load("")} disabled={loading}>
                용도 없이 이 주소의 전체 목록 보기
              </button>
            </div>
          ) : loading ? (
            <div className="dlg-loading">
              <span className="spinner" />
              <div>
                <strong>포털에서 찾고 있습니다</strong>
                <small>검색 결과 3쪽까지 확인합니다 · 몇 초 걸립니다</small>
              </div>
            </div>
          ) : (
            <>
              <div className="dlg-listhead">
                <label className="dlg-checkall">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(items.map((i) => i.publicDataPk)))}
                    disabled={starting}
                  />
                  전체 선택
                </label>
                <span>
                  {result?.keyword && <>검색어 <b>{result.keyword}</b> · </>}
                  후보 {items.length}개 중 <b>{checked.size}개</b> 선택
                </span>
              </div>

              <ul className="dlg-list">
                {items.map((item) => {
                  const on = checked.has(item.publicDataPk);
                  return (
                    <li key={item.publicDataPk} className={on ? "on" : ""}>
                      <label>
                        <input type="checkbox" checked={on} onChange={() => toggle(item.publicDataPk)} disabled={starting} />
                        <span className="dlg-item">
                          <b>{item.title}</b>
                          {item.reason && <em className={item.include ? "keep" : "drop"}>{item.reason}</em>}
                        </span>
                      </label>
                      <a href={item.url} target="_blank" rel="noreferrer" className="dlg-item-link">포털에서 보기</a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <footer className="dlg-foot">
          <span className="dlg-foot-note">
            공공 서버를 배려해 요청 간 1초를 둡니다. 선택이 많으면 몇 분 걸릴 수 있습니다.
          </span>
          <button className="btn-quiet" onClick={onClose} disabled={starting}>취소</button>
          <button className="btn btn-primary" onClick={start} disabled={starting || checked.size === 0}>
            {starting ? "시작 중…" : `${checked.size}개 수집 시작`}
          </button>
        </footer>
      </div>
    </div>
  );
}

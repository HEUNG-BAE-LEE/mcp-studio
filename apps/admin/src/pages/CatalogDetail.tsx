import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";
import { ErrorBox, SkeletonRows } from "../components/States";
import { KindBadge, OriginBadge } from "./Market";
import { useCart } from "../hooks/useCart";
import { KIND_LABEL, type CollectionKind } from "../components/CollectionMark";

/**
 * MCP 상세 — 출처를 드러내는 화면.
 *
 * 이 한 줄이 데모의 핵심이다. 마켓 목록만 보면 이 제품은 "공공 API 링크
 * 모음집"으로 읽힌다. 출처 → 소요 시간 → 명세 원문 경로가 있어야
 * "이 카탈로그를 우리가 자동으로 만들었다"는 주장이 클릭 한 번으로 증명된다.
 *
 * 검증 신호를 세 갈래로 두는 것도 의도다. "결과 0건"은 실패가 아니라 파라미터
 * 예시가 없는 상태다 — 빨강으로 칠하면 멀쩡한 도구를 버리게 되고, 초록으로
 * 칠하면 LLM 이 나중에 빈 응답을 받는다.
 */

type Tool = {
  id: number; name: string; toolName: string; method: string;
  description: string; verify: string; note: string;
};
type Source = {
  kind: string; url: string; collectedAt: string | null; collectSeconds: number;
  verifiedAt: string | null; ok: number; warn: number; fail: number;
};
type Detail = {
  id: number; slug: string; name: string; description: string; provider: string;
  mark: string; category: string; origin: string; pricePerCall: number; version: string;
  tags: string[]; kind: string; tools: number; installs: number; inProject: boolean;
  source: Source; toolList: Tool[];
};

/** 수집 방식마다 "무엇을 읽었는지"가 다르다. 정본 문구를 그대로 쓴다. */
const HOW: Record<string, { line: string; link: string }> = {
  portal: { line: "포털이 공개한 명세를 읽었습니다", link: "원본 페이지" },
  document: { line: "활용가이드에서 명세를 뽑았습니다", link: "원본 문서" },
  traffic: { line: "확장이 화면의 호출을 관측했습니다", link: "관측한 화면" },
};

const VERIFY: Record<string, { cls: string; label: string }> = {
  verified: { cls: "is-ok", label: "검증됨" },
  warn: { cls: "is-warn", label: "확인 필요" },
  fail: { cls: "is-fail", label: "호출 실패" },
};

function when(iso: string | null): string {
  return iso ? iso.replace("T", " ").slice(0, 16) : "–";
}

export default function CatalogDetail() {
  const { slug } = useParams();
  const [row, setRow] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();
  const { toasts, showToast, dismiss } = useToast();

  useEffect(() => {
    api.get(`/api/catalog/${slug}`)
      .then(setRow)
      .catch((err) => setError(errorMessage(err)));
  }, [slug]);

  if (error) {
    return <Shell breadcrumb={["마켓플레이스", "상세"]}><ErrorBox message={error} /></Shell>;
  }
  if (!row) {
    return <Shell breadcrumb={["마켓플레이스", "상세"]}><SkeletonRows /></Shell>;
  }

  const how = HOW[row.source.kind] ?? HOW.portal;
  const inCart = cart.has(row.id);

  return (
    <Shell breadcrumb={["마켓플레이스", row.name]}>
      <div className="page-head">
        <div className="cd-title">
          <span className={`mk-mark lg tone-${row.origin === "public" ? "pub" : "priv"}`}>
            {row.mark}
          </span>
          <div>
            <span className="eyebrow">{row.provider}</span>
            <h1>{row.name}</h1>
            <p className="page-sub mono">{row.slug} · {row.tools} tools · {row.version}</p>
          </div>
        </div>
        <div className="head-side">
          <OriginBadge entry={row as never} />
          <button
            type="button"
            className={`btn ${inCart ? "" : "btn-primary"}`}
            onClick={() => {
              cart.toggle({
                id: row.id, name: row.name, kind: row.kind,
                tools: row.tools, pricePerCall: row.pricePerCall,
              });
              // 이 화면에는 장바구니 바가 없어서, 눌렸는지 알려줄 것이 필요하다.
              showToast(
                inCart ? `${row.name} 을(를) 뺐습니다` : `${row.name} 을(를) 담았습니다`,
                "ok",
                inCart ? undefined : "마켓에서 프로젝트로 보낼 수 있습니다",
              );
            }}
          >
            {inCart ? "담기 취소" : "장바구니에 담기"}
          </button>
        </div>
      </div>

      <p className="cd-desc">{row.description}</p>

      {/* ── 출처 ── 이 화면의 존재 이유 */}
      <section className="src" aria-label="출처">
        <header>
          <strong>출처</strong>
          <KindBadge kind={row.source.kind} />
          <span className="mono t3">
            수집 {when(row.source.collectedAt)} · 재검증 {when(row.source.verifiedAt)}
          </span>
        </header>

        <p className="src-line">
          {how.line}
          {row.source.url && (
            <>
              <span className="mono t4"> · </span>
              <a href={row.source.url} target="_blank" rel="noreferrer">{how.link} ↗</a>
            </>
          )}
        </p>

        <div className="src-stats">
          <div><b className="num is-ok">{row.source.ok}</b><span>실호출 검증됨</span></div>
          <div><b className="num is-warn">{row.source.warn}</b><span>확인 필요</span></div>
          {row.source.fail > 0 && (
            <div><b className="num is-fail">{row.source.fail}</b><span>호출 실패</span></div>
          )}
          <div><b className="num">{row.source.collectSeconds}초</b><span>수집 소요</span></div>
        </div>

        <p className="src-note">
          {KIND_LABEL[row.source.kind as CollectionKind]} 방식으로 {row.tools}개 도구를{" "}
          <strong>{row.source.collectSeconds}초</strong>에 만들었습니다. 검증 신호는 매일
          샘플 호출로 갱신됩니다.
        </p>
      </section>

      <h2 className="sec-title">포함된 도구 <span className="mono t3">{row.tools}</span></h2>
      <div className="cd-tools">
        {row.toolList.map((t) => {
          const v = VERIFY[t.verify] ?? VERIFY.verified;
          return (
            <div key={t.id} className="cd-tool">
              <span className="meth mono">{t.method}</span>
              <span className="cd-tool-nm">
                <b>{t.name}</b>
                <span className="mono">{t.toolName}</span>
                {t.note && <span className="cd-note">{t.note}</span>}
              </span>
              <span className={`state-pill ${v.cls}`}>{v.label}</span>
            </div>
          );
        })}
      </div>

      <p className="cd-back">
        <Link to="/market">← 마켓으로</Link>
      </p>

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

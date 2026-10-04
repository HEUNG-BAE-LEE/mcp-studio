import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import ContextSearch from "../components/ContextSearch";
import DispatchSheet from "../components/DispatchSheet";
import Toast, { useToast } from "../components/Toast";
import { ErrorBox, SkeletonRows } from "../components/States";
import { KindMark, KIND_LABEL, type CollectionKind } from "../components/CollectionMark";
import { useCart } from "../hooks/useCart";

/**
 * 마켓플레이스 — 플랫폼의 메뉴판.
 *
 * 카드의 ＋ 는 즉시 연결이 아니라 장바구니 담기다. 둘러보는 행위와 프로젝트를
 * 바꾸는 행위를 분리하면 실수로 프로젝트를 건드리는 일이 없다.
 *
 * 좌측 패싯에 **수집 방식**(포털 공개 · 문서 · 트래픽)을 그대로 노출한다.
 * 우리 변환 엔진이 마켓 전면에 드러나는 첫 지점이고, 숨기면 이 제품이
 * "API 링크 모음집"으로 읽힌다.
 */

type Entry = {
  id: number; slug: string; name: string; description: string; provider: string;
  mark: string; category: string; origin: string; pricePerCall: number; version: string;
  tags: string[]; kind: string; tools: number; installs: number; inProject: boolean;
};
type Facets = {
  origin: Record<string, number>;
  kind: Record<string, number>;
  category: Record<string, number>;
  total: number; tools: number; inProject: number;
};

const SORTS = [
  { key: "popular", label: "인기순" },
  { key: "recent", label: "최신순" },
  { key: "name", label: "이름순" },
];

export function OriginBadge({ entry }: { entry: Entry }) {
  return entry.origin === "public"
    ? <span className="mk-price is-free">공공 · 무료</span>
    : <span className="mk-price is-paid">민간 · ₩{entry.pricePerCall} / 호출</span>;
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`kind-badge kind-${kind}`}>
      <KindMark kind={kind} size={11} />
      {KIND_LABEL[kind as CollectionKind] ?? kind}
    </span>
  );
}

export default function Market() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("popular");
  const [sending, setSending] = useState(false);
  const cart = useCart();
  const { toasts, showToast, dismiss } = useToast();

  const load = useCallback(() => {
    const qs = new URLSearchParams({ sort });
    if (origin) qs.set("origin", origin);
    if (category) qs.set("category", category);
    if (kind) qs.set("kind", kind);
    api.get(`/api/catalog?${qs}`)
      .then((r) => { setRows(r.items); setFacets(r.facets); })
      .catch((err) => setError(errorMessage(err)));
  }, [origin, category, kind, sort]);

  useEffect(load, [load]);

  const active = [
    origin && { label: origin === "public" ? "공공" : "민간", clear: () => setOrigin("") },
    category && { label: category, clear: () => setCategory("") },
    kind && { label: KIND_LABEL[kind as CollectionKind] ?? kind, clear: () => setKind("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <Shell breadcrumb={["마켓플레이스"]}>
      <div className="page-head">
        <div>
          <span className="eyebrow">marketplace</span>
          <h1>마켓플레이스</h1>
          <p className="page-sub">
            우리가 미리 변환해 둔 MCP 입니다. 담아서 프로젝트로 보내면 에이전트가 바로 씁니다.
          </p>
        </div>
      </div>

      <div className="mk-search">
        <ContextSearch placeholder="이름 · 기관 · 하려는 일로 찾기" size="lg" />
      </div>

      {error && <ErrorBox message={error} />}

      <div className="mk-layout">
        <aside className="mk-facet">
          <h3>분류</h3>
          <button type="button" className={origin === "" ? "on" : ""} onClick={() => setOrigin("")}>
            전체 <b>{facets?.total ?? "–"}</b>
          </button>
          <button type="button" className={origin === "public" ? "on" : ""} onClick={() => setOrigin("public")}>
            공공 <b>{facets?.origin.public ?? 0}</b>
          </button>
          <button type="button" className={origin === "private" ? "on" : ""} onClick={() => setOrigin("private")}>
            민간 <b>{facets?.origin.private ?? 0}</b>
          </button>

          <hr className="hair" />
          <h3>주제</h3>
          {Object.entries(facets?.category ?? {}).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
            <button key={c} type="button" className={category === c ? "on" : ""}
                    onClick={() => setCategory(category === c ? "" : c)}>
              {c} <b>{n}</b>
            </button>
          ))}

          <hr className="hair" />
          {/* 이 패싯이 우리 변환 엔진을 마켓 전면에 드러내는 자리다. */}
          <h3>수집 방식</h3>
          {(["portal", "document", "traffic"] as const).map((k) => (
            <button key={k} type="button" className={kind === k ? "on" : ""}
                    onClick={() => setKind(kind === k ? "" : k)}>
              <KindBadge kind={k} />
              <b>{facets?.kind[k] ?? 0}</b>
            </button>
          ))}
        </aside>

        <div>
          <div className="mk-sortbar">
            <span className="mono t3">{rows?.length ?? 0}개</span>
            {active.map((a) => (
              <button key={a.label} type="button" className="mk-chip" onClick={a.clear}>
                {a.label} ✕
              </button>
            ))}
            <div className="seg" role="tablist" aria-label="정렬">
              {SORTS.map((s) => (
                <button key={s.key} type="button" role="tab" aria-selected={sort === s.key}
                        className={sort === s.key ? "on" : ""} onClick={() => setSort(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {rows === null && !error && <SkeletonRows />}

          <div className="mk-grid">
            {(rows ?? []).map((e) => {
              const inCart = cart.has(e.id);
              return (
                <article key={e.id} className={`mk-card ${inCart ? "picked" : ""}`}>
                  <div className="mk-hd">
                    <span className={`mk-mark tone-${e.origin === "public" ? "pub" : "priv"}`}>
                      {e.mark}
                    </span>
                    <Link className="mk-tt" to={`/market/${e.slug}`}>
                      <b>{e.name}</b>
                      <span className="mono">{e.slug} · {e.version}</span>
                    </Link>
                    <button
                      type="button"
                      className={`mk-add ${inCart ? "on" : ""}`}
                      aria-label={inCart ? `${e.name} 담기 취소` : `${e.name} 담기`}
                      onClick={() => cart.toggle({
                        id: e.id, name: e.name, kind: e.kind,
                        tools: e.tools, pricePerCall: e.pricePerCall,
                      })}
                    >
                      {inCart ? "✓" : "＋"}
                    </button>
                  </div>

                  <p className="mk-ds">{e.description}</p>

                  <div className="mk-ft">
                    <OriginBadge entry={e} />
                    <KindBadge kind={e.kind} />
                    <span className="mk-stat mono">
                      {e.tools} tools · {e.installs.toLocaleString()} 프로젝트
                      {e.inProject && " · 담김"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* 장바구니 바 — 담는 순간부터 도구 수와 비용을 보여준다. */}
      {cart.items.length > 0 && (
        <div className="cartbar" role="region" aria-label="담은 MCP">
          <span className="cartbar-n mono">{cart.items.length}</span>
          <span className="cartbar-lbl">
            담은 MCP
            <span className="mono">
              도구 {cart.tools}개 ·
              {cart.paid.length === 0
                ? " 예상 비용 ₩0"
                : ` 유료 ${cart.paid.length}개 포함`}
            </span>
          </span>
          <span className="cartbar-chips">
            {cart.items.map((i) => (
              <span key={i.id} className="cartbar-chip">
                <i className={`dot-${i.kind}`} aria-hidden="true" />
                {i.name}
                <button type="button" onClick={() => cart.remove(i.id)}
                        aria-label={`${i.name} 빼기`}>✕</button>
              </span>
            ))}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={cart.clear}>비우기</button>
          <button type="button" className="btn btn-primary" onClick={() => setSending(true)}>
            프로젝트로 보내기 →
          </button>
        </div>
      )}

      {sending && (
        <DispatchSheet
          items={cart.items}
          onClose={() => setSending(false)}
          onDone={(msg, detail) => {
            setSending(false);
            cart.clear();
            showToast(msg, "ok", detail);
            load();
          }}
        />
      )}

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

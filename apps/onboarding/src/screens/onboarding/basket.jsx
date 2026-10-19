// 소스 담기 — 한 건씩 넣어 목록에 쌓는다. 저장소·API·DB 가 같은 컴포넌트를 쓴다.
//
// 이전에는 종류마다 값을 객체 하나로 들고 있어 **두 번째를 넣으면 첫 번째가 덮어써졌다**.
// 고객사는 서비스마다 저장소가 따로라 바로 막히는 지점이었다.
//
// 레이아웃 규칙: 목록은 **고정 높이 박스**이고 넘치면 박스 안에서만 스크롤한다. 목록이 폼 아래로
// 이어지면 담을수록 세로가 자라 위자드 전체가 스크롤되는데, 스텝 화면에 스크롤이 생기는 순간
// "아래에 뭐가 더 있나" 를 확인하러 내려가야 한다.
import { useEffect, useState } from "react";
import { api } from "../../api";

/** 담긴 목록 — 고정 높이 + 내부 스크롤. 비어 있어도 높이가 같다(담는 순간 화면이 튀지 않게). */
export function Basket({ title, items, onEdit, onRemove, hint, emptyHint, emptyAction, busy }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: 0,
      border: "1px solid var(--line2)", borderRadius: 14, background: "var(--card)", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, padding: "11px 14px",
        background: "var(--main)", borderBottom: "1px solid var(--line)", flexShrink: 0,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 750, color: "var(--navy)" }}>{title}</span>
        <span style={{
          fontFamily: "var(--disp)", fontSize: 18, fontWeight: 700, lineHeight: 1,
          color: items.length ? "var(--blue)" : "var(--faint)",
        }}>{items.length}</span>
        {busy ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
                         fontSize: 10.5, color: "var(--blue)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)",
                           animation: "dashRing 1.5s ease-out infinite" }} />
            찾는 중
          </span>
        ) : !!items.length && (
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)" }}>읽는 순서대로</span>
        )}
      </div>

      {items.length ? (
        <div className="onb-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {items.map((it, i) => (
            <div key={it.key ?? i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 13px",
              borderBottom: i === items.length - 1 ? "none" : "1px solid var(--line)",
              animation: "popIn .25s ease-out both",
            }}>
              <span style={{
                width: 26, height: 26, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center",
                background: "var(--main)", border: "1px solid var(--line2)",
              }}>{it.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.3, fontWeight: 700, color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  {it.badge}
                </span>
                <span className="mono" style={{
                  display: "block", fontSize: 10.3, color: "var(--muted)", marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{it.detail}</span>
              </span>
              <span style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
                {it.control}
                {onEdit && <button onClick={() => onEdit(i)} style={btnGhostSm}>수정</button>}
                {onRemove && (
                  <button onClick={() => onRemove(i)} aria-label="빼기" style={{
                    width: 22, height: 22, borderRadius: 7, border: "1px solid var(--line2)",
                    background: "transparent", color: "var(--faint)", fontSize: 11, cursor: "pointer",
                    display: "grid", placeItems: "center",
                  }}>✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 20, textAlign: "center",
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#3a4560" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>
            {busy ? "찾는 중입니다…" : "아직 담은 것이 없습니다"}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
            {emptyAction || <>왼쪽에서 입력하고 <b>담기</b>를 누르세요</>}
          </div>
        </div>
      )}

      {/* 스크롤해도 사라지면 안 되는 문장은 목록 안이 아니라 박스 바닥에 둔다. */}
      <div style={{
        flexShrink: 0, padding: "9px 14px", borderTop: "1px solid var(--line)", background: "var(--main)",
        fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#767d92" strokeWidth="1.9" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" />
        </svg>
        {items.length ? hint : emptyHint}
      </div>
    </div>
  );
}

/** 서버 폴더 선택기 — `/api/fs/list` 가 디렉토리와 `.git` 존재 여부(isRepo)를 함께 준다. */
export function FolderPicker({ value, onPick }) {
  const [cwd, setCwd] = useState(value || "");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    api.fsList(cwd)
      .then((d) => { if (alive) { setData(d); setErr(""); } })
      .catch((e) => { if (alive) setErr(e.message || "폴더를 열지 못했습니다"); });
    return () => { alive = false; };
  }, [cwd]);

  return (
    <div style={{ border: "1px solid var(--line2)", borderRadius: 11, background: "var(--card)", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, padding: "8px 12px",
        background: "var(--main)", borderBottom: "1px solid var(--line)",
      }}>
        <button onClick={() => data?.parent && setCwd(data.parent)} disabled={!data?.parent} style={{
          ...btnGhostSm, opacity: data?.parent ? 1 : 0.4,
        }}>↑ 상위</button>
        <span className="mono" style={{
          fontSize: 11, color: "var(--muted)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "rtl",
        }}>{data?.path || cwd || "…"}</span>
      </div>
      <div className="onb-scroll" style={{ maxHeight: 148, overflowY: "auto" }}>
        {err && <div style={{ padding: "14px 13px", fontSize: 11.5, color: "var(--red)" }}>{err}</div>}
        {!err && !data?.dirs?.length && (
          <div style={{ padding: "14px 13px", fontSize: 11.5, color: "var(--faint)" }}>하위 폴더가 없습니다</div>
        )}
        {(data?.dirs || []).map((d) => (
          <div key={d.path} onClick={() => setCwd(d.path)} style={{
            display: "flex", alignItems: "center", gap: 9, padding: "8px 13px",
            borderBottom: "1px solid var(--line)", fontSize: 12, cursor: "pointer",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={d.isRepo ? "var(--blue)" : "var(--muted)"} strokeWidth="1.8">
              <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
            <span className="mono" style={{ flex: 1, minWidth: 0, color: "var(--navy)", fontSize: 11.5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
            {/* 어느 폴더를 골라야 할지 헤매지 않게 — .git 이 있는 곳이 보통 정답이다. */}
            {d.isRepo && <span style={repoBadge}>Git 저장소</span>}
            <button onClick={(e) => { e.stopPropagation(); onPick(d.path); }} style={btnGhostSm}>선택</button>
          </div>
        ))}
      </div>
      {data?.path && (
        <div style={{
          padding: "8px 12px", borderTop: "1px solid var(--line)", background: "var(--main)",
          display: "flex", alignItems: "center", gap: 9,
        }}>
          <span style={{ fontSize: 11, color: "var(--muted)", flex: 1 }}>
            {data.isRepo ? "이 폴더가 Git 저장소입니다" : "지금 폴더를 그대로 쓸 수도 있습니다"}
          </span>
          <button onClick={() => onPick(data.path)} style={btnGhostSm}>이 폴더 선택</button>
        </div>
      )}
    </div>
  );
}

const btnGhostSm = {
  padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line2)",
  background: "transparent", color: "var(--text)", fontSize: 11.5, fontWeight: 700,
  fontFamily: "var(--sans)", cursor: "pointer", whiteSpace: "nowrap",
};
const repoBadge = {
  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
  background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid color-mix(in srgb,var(--blue) 32%,transparent)",
  flexShrink: 0,
};

const RAG = "/api/ieum/onboarding/rag-data/";
const DOC_MOCK = {
  // 이음: 저장소에 실제로 있는 파일만 둔다(examples/documents · apps/legacy-pps/assets). 백엔드가 내려준다.
  "/mnt/legacy/docs/활용가이드": [
    { name: "01_기상청_단기예보조회서비스_활용가이드.pdf", type: "PDF", meta: "활용가이드", ok: true, blob_url: RAG + "활용가이드/01_기상청_단기예보조회서비스_활용가이드.pdf" },
    { name: "02_사내_회의실예약_API_명세서.pdf", type: "PDF", meta: "API 명세", ok: true, blob_url: RAG + "활용가이드/02_사내_회의실예약_API_명세서.pdf" },
    { name: "03_보도자료_공공데이터_개방계획.pdf", type: "PDF", meta: "보도자료", ok: true, blob_url: RAG + "활용가이드/03_보도자료_공공데이터_개방계획.pdf" },
    { name: "04_국토교통부_건축물대장_활용가이드(스캔본).pdf", type: "PDF", meta: "스캔본", ok: true, blob_url: RAG + "활용가이드/04_국토교통부_건축물대장_활용가이드(스캔본).pdf" },
    { name: "표지_스캔.png", type: "PNG", meta: "대상 아님", ok: false },
  ],
  "/mnt/legacy/docs/정의서": [
    { name: "finl_인터페이스정의서.xlsx", type: "XLSX", meta: "FINL 2015", ok: true, blob_url: RAG + "정의서/finl_인터페이스정의서.xlsx" },
    { name: "구버전_표지.png", type: "PNG", meta: "대상 아님", ok: false },
  ],
};

const docInp = {
  height: 34, padding: "0 11px", borderRadius: 9, border: "1px solid var(--line2)",
  background: "var(--card2)", color: "var(--text)", fontSize: 12, outline: "none",
};

/** 문서 폴더 모달 — preview 배포에서 서버 공유 폴더를 훑어 담는다. 구 위자드에서 그대로 옮겨왔다. */
export function DocCollect({ onClose, onConfirm }) {
  const [dir, setDir] = useState("/mnt/legacy/docs/활용가이드");
  const [loadedDir, setLoadedDir] = useState("/mnt/legacy/docs/활용가이드");
  const [sel, setSel] = useState(() => new Set());   // 좌측 현재 목록에서 체크된 파일명
  const [basket, setBasket] = useState([]);          // [{dir, name, type}]
  const files = DOC_MOCK[loadedDir] || [];
  const load = () => { setLoadedDir(dir); setSel(new Set()); };
  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const addFiles = (picked) => {
    const add = picked.filter((f) => f.ok).map((f) => ({ ...f, dir: loadedDir }));
    setBasket((b) => {
      const key = (x) => x.dir + "/" + x.name;
      const known = new Set(b.map(key));
      return [...b, ...add.filter((x) => !known.has(key(x)))];
    });
    setSel(new Set());
  };
  const addSel = () => addFiles(files.filter((f) => sel.has(f.name)));
  const addAll = () => addFiles(files);
  const rmBasket = (i) => setBasket((b) => b.filter((_, idx) => idx !== i));
  // 바구니를 디렉토리별로 그룹
  const groups = basket.reduce((acc, it) => { (acc[it.dir] ||= []).push(it); return acc; }, {});
  const ftBg = (t) => ({ PDF: "rgba(91,157,255,.15)", XLSX: "rgba(63,206,154,.15)", DOCX: "rgba(124,140,255,.15)" }[t] || "var(--main)");
  const ftFg = (t) => ({ PDF: "#5b9dff", XLSX: "#3fce9a", DOCX: "#a78bfa" }[t] || "var(--muted)");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,6,12,.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: "var(--app)", border: "1px solid var(--line2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", margin: 0 }}>문서 디렉토리에서 불러오기</h3>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>폴더를 바꿔가며 반복해서 담을 수 있어요</span>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {/* 좌: 디렉토리 로드/선택 */}
          <div style={{ borderRight: "1px solid var(--line)", padding: "16px 18px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={dir} onChange={(e) => setDir(e.target.value)} style={{ ...docInp, fontFamily: "var(--mono)", flex: 1 }} placeholder="/mnt/legacy/docs" />
              <button onClick={load} style={{ border: `1px solid ${"#1d4a45"}`, background: "#1b2c47", color: "#2dd4bf", borderRadius: 9, padding: "0 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>불러오기</button>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>현재: <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{loadedDir}</span></div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {files.map((f) => (
                <div key={f.name} onClick={() => f.ok && toggle(f.name)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, fontSize: 12, opacity: f.ok ? 1 : 0.5, cursor: f.ok ? "pointer" : "default" }}>
                  <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${sel.has(f.name) ? "#0d9488" : "var(--line2)"}`, background: sel.has(f.name) ? "#0d9488" : "transparent", display: "grid", placeItems: "center", color: "#fff", fontSize: 10, fontWeight: 800, flex: "none" }}>{sel.has(f.name) ? "✓" : ""}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: ftBg(f.type), color: ftFg(f.type) }}>{f.type}</span>
                  <span style={{ color: "var(--navy)", fontWeight: 600 }}>{f.name}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>{f.meta}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={addAll} disabled={!files.some((f) => f.ok)} style={{ flex: 1, padding: 9, borderRadius: 9, border: `1px solid ${"#1d4a45"}`, background: "#1b2c47", color: "#2dd4bf", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>현재 폴더 전체 담기</button>
              <button onClick={addSel} disabled={!sel.size} style={{ flex: 1, padding: 9, borderRadius: 9, border: `1px solid ${"#1d4a45"}`, background: sel.size ? "#1b2c47" : "var(--card)", color: sel.size ? "#2dd4bf" : "var(--muted)", fontSize: 11.5, fontWeight: 700, cursor: sel.size ? "pointer" : "not-allowed" }}>선택 파일만 담기</button>
            </div>
          </div>
          {/* 우: 담은 바구니 */}
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--navy)", marginBottom: 10 }}>담은 문서<span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "#2dd4bf" }}>{basket.length}개</span></div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {basket.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 11.5, padding: "40px 10px", lineHeight: 1.6 }}>왼쪽에서 문서를 골라<br/>여기에 담으세요</div>
              ) : Object.entries(groups).map(([g, items]) => (
                <div key={g}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--faint)", margin: "8px 0 4px" }}>{g}</div>
                  {items.map((it) => {
                    const gi = basket.indexOf(it);
                    return (
                      <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, fontSize: 11.5, background: "var(--card)", marginBottom: 5 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: ftBg(it.type), color: ftFg(it.type) }}>{it.type}</span>
                        <span style={{ color: "var(--navy)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                        <button onClick={() => rmBasket(gi)} style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: 7, border: "1px solid var(--line2)", background: "var(--card2)", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", flex: "none" }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 11, padding: "14px 20px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ padding: "12px 20px", borderRadius: 11, background: "var(--card)", color: "var(--text)", border: "1px solid var(--line2)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>취소</button>
          <button onClick={() => { onConfirm(basket); onClose(); }} disabled={!basket.length}
            style={{ flex: 1, padding: 12, borderRadius: 11, background: basket.length ? "#0d9488" : "var(--muted)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13.5, cursor: basket.length ? "pointer" : "not-allowed" }}>
            선택한 {basket.length}개 문서 담기 →
          </button>
        </div>
      </div>
    </div>
  );
}

// 만들어진 도구를 **가져온 곳별로** 묶어 보여준다.
//
// 이전에는 한 통에 시간순으로 쌓았다. 그러면 세 가지가 전달되지 않는다.
//   1. 스크롤을 내리면 지금 보는 도구가 코드에서 왔는지 DB 에서 왔는지 이름을 해석해야 안다
//   2. 상단의 "소스 코드 44 · 서버·DB 24" 가 목록과 이어지지 않아 어디에 그 44개가 있는지 못 짚는다
//   3. 무엇을 담고 무엇을 뺐는지가 화면에 없어 "그냥 다 가져왔다" 로 읽힌다
//
// 문구 규칙 — 화면에는 개발자 말을 쓰지 않는다(라우트 · SELECT · 기본키 · GET/POST).
// 사용자가 알아야 하는 건 "읽기만 한다" 와 "어디서 몇 개" 두 가지뿐이다.
import { useState } from "react";
import { Eq } from "./steps";

/** 리소스 종류마다 `collected` 가 센 것이 다르다(runner 가 정한다). 그 단위를 그대로 부른다. */
const UNIT = { code: "찾은 기능", openapi: "기능", db: "표", document: "파일" };

/** 어떻게 읽어냈나 — `resources[].stage` 를 사람 말로 옮긴다.
 *
 *  같은 44개라도 **설명서를 그대로 읽은 것**과 **코드를 보고 추정한 것**은 확인해야 할
 *  정도가 다르다. 백엔드는 이미 그 차이를 알고 있다(추정으로 만든 기능에는 "코드에서
 *  추정한 명세입니다" 경고가 붙는다). 화면이 그 구분을 버리면 사용자는 어느 쪽을
 *  검수해야 하는지 알 수 없다.
 *
 *  exact:false 는 "사람이 한 번 봐야 한다" 는 뜻이다. */
export const HOW = {
  "spec-file": { text: "API 설명서를 그대로 읽음", exact: true },
  "runtime-openapi": { text: "앱 명세를 그대로 읽음", exact: true },
  "route-discovery": { text: "코드를 읽어 추정 — 확인이 필요합니다", exact: false },
  "spec-url": { text: "서버에서 설명서를 읽음", exact: true },
  "db-schema": { text: "표 구조를 읽음", exact: true },
  "doc-chunk": { text: "문서를 잘라 담음", exact: true },
  // 진행 중에만 스치는 값 — 결과 배지로는 뜨지 않는다.
  fetch: { text: "저장소를 내려받는 중", exact: true },
  "db-func": { text: "코드 안 조회 기능을 찾는 중", exact: true },
};

/** 담은 기준 — 채널마다 한 줄. 길어지면 아무도 읽지 않아 없는 것과 같아진다. */
const CRITERIA = {
  code: "읽기만 하는 기능",
  openapi: "읽기만 하는 기능",
  db: "읽기만 하고 값은 고치지 않음",
  document: "PDF · 워드 · 엑셀만",
};

/** 이 도구가 무슨 일을 하는지. 실행 방식(SQL·GET)은 사용자의 관심사가 아니다 —
 *  알아야 하는 건 "여러 건인가 한 건인가, 찾는 것인가 세는 것인가" 다. */
export function actionOf(t) {
  const n = (t.name || "").toLowerCase();
  if (/(^|_)(sum|count|calc|avg|total)_/.test(n) || /_quote$/.test(n)) return "계산하기";
  if (/(^|_)(find|search)_/.test(n)) return "검색하기";
  if (/(^|_)list_/.test(n) || /_list$/.test(n)) return "목록 보기";
  if (/(^|_)get_/.test(n) || /_get$/.test(n)) return "한 건 보기";
  // 이름으로 못 가리면 주소를 본다 — 주소에 {id} 같은 자리가 있으면 한 건을 집는 호출이다.
  if (t.backend !== "db") return /\{[^}]+\}/.test(t.path || "") ? "한 건 보기" : "목록 보기";
  return "조회하기";
}

/** 도구 이름에서 원천 접두어와 동작 접미어를 걷어낸 가운데 — DB 면 표 이름이 남는다. */
function coreName(t) {
  let n = t.name || "";
  if (t.source && n.startsWith(`${t.source}_`)) n = n.slice(t.source.length + 1);
  return n.replace(/_(list|get)$/, "");
}

const titleOf = (t) => t.summary || coreName(t).replace(/_/g, " ") || t.name || "이름 없는 도구";

const svg = {
  code: (c) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round"><path d="m9 8-4 4 4 4M15 8l4 4-4 4" /></svg>
  ),
  db: (c) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" /></svg>
  ),
  http: (c) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2"
      strokeLinecap="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>
  ),
  document: (c) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"
      strokeLinecap="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" /></svg>
  ),
};
const iconFor = (type, tone) => (svg[type] || svg.http)(tone);

/** 만들어진 도구 패널.
 *
 *  @param channels  OnboardingV2 의 CHANNELS — 좌측 로그와 같은 묶음을 써야 두 패널의 수가 맞는다
 *  @param publish   {published, held:[{reason, tools}]} — held.tools 는 개수다(목록이 아니다)
 */
/** @param pending  아직 도는 중인 채널 key 집합. 문서→벡터 적재처럼 변환이 끝난 뒤에도
 *                  백그라운드로 이어지는 트랙이 여기 담긴다. 0개인데 "담지 않았습니다" 로
 *                  적으면 사용자가 안 담긴 줄 알고 되돌아온다 — 다른 상태다. */
export function ToolPanel({ tools = [], resources = [], channels = [], publish, running, pending }) {
  const [sel, setSel] = useState(null);            // null | {kind:'ch'|'res', key}
  const [closed, setClosed] = useState(() => new Set());

  const chOf = (type) => channels.find((c) => c.types.includes(type)) || channels[0];
  const nOfCh = (ch) => tools.filter((t) => {
    const r = resources.find((x) => x.name === t.source);
    return ch.types.includes(r?.type || t.kind);
  }).length;

  // 원천 하나 = 그룹 하나. 진행 중에는 아직 아무것도 안 나온 원천을 미리 늘어놓지 않는다.
  const groups = resources
    .map((r) => ({ r, ch: chOf(r.type), items: tools.filter((t) => t.source === r.name) }))
    .filter((g) => g.items.length || !running);

  const live = channels.filter((ch) => nOfCh(ch));
  // 고르는 축은 카테고리 하나뿐이다. 원천별로도 고를 수 있게 두면 카드와 그룹 헤더가
  // 서로 다른 것을 고르는 두 개의 필터가 되어, 지금 무엇이 걸려 있는지 알 수 없어진다.
  const shown = groups.filter((g) => !sel || g.ch?.key === sel.key);
  const visN = shown.reduce((n, g) => n + g.items.length, 0);

  const held = publish?.held || [];
  const heldN = held.reduce((n, h) => n + (Number(h.tools) || 0), 0);

  const toggle = (kind, key) => setSel((cur) =>
    (cur && cur.kind === kind && cur.key === key) ? null : { kind, key });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0,
                  border: "1px solid var(--line2)", borderRadius: 16, background: "var(--card)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 15px",
                    borderBottom: "1px solid var(--line)", background: "var(--main)", flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 750, color: "var(--navy)" }}>만들어진 도구</span>
        <span style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 700, lineHeight: 1,
                       color: tools.length ? "var(--blue)" : "var(--faint)" }}>{visN}</span>
        {running
          ? <span style={{ marginLeft: "auto" }}><Eq /></span>
          : <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)" }}>가져온 곳별</span>}
      </div>

      {/* 숫자를 늘어놓기 전에 문장 하나. 처음 보는 사람은 이 줄만 읽고도 화면을 이해한다. */}
      {!!tools.length && (
        <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 12.3, color: "var(--text)", lineHeight: 1.6, marginBottom: 11 }}>
            {running
              ? <>지금까지 <b style={{ color: "var(--navy)" }}>{tools.length}개</b>를 만들었습니다. 가져온 곳별로 아래에 쌓입니다.</>
              : <><b style={{ color: "var(--navy)" }}>{tools.length}개</b> 도구를 <b style={{ color: "var(--navy)" }}>{groups.filter((g) => g.items.length).length}곳</b>에서
                  만들었습니다. 모두 <b style={{ color: "var(--navy)" }}>정보를 읽기만 하는</b> 기능입니다.</>}
          </div>

          {/* 누적 막대 — 전체 구성이 한 줄. 색이 곧 아래 목록의 색이라 눈이 이어진다. */}
          <div style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden",
                        background: "var(--main)", marginBottom: 11 }}>
            {live.map((ch) => (
              <span key={ch.key} style={{
                display: "block", height: "100%", background: ch.tone,
                width: `${nOfCh(ch) / tools.length * 100}%`,
                opacity: sel?.kind === "ch" && sel.key !== ch.key ? .22 : 1,
                transition: "width .5s cubic-bezier(.3,1,.4,1), opacity .18s ease",
              }} />
            ))}
          </div>

          {/* 변환 중에는 카드가 없으므로 칩이 유일한 구성 표시다. 끝나면 카드가 같은 일을
              더 크게 하므로 칩은 "전체로 되돌리기" 하나만 남긴다 — 같은 숫자를 두 번 적지 않는다. */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <Chip on={!sel} onClick={() => setSel(null)}>전체 <b className="mono">{tools.length}</b></Chip>
            {running && live.map((ch) => {
              const on = sel?.kind === "ch" && sel.key === ch.key;
              return (
                <Chip key={ch.key} on={on} dim={!!sel && !on} tone={ch.tone}
                  onClick={() => toggle("ch", ch.key)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: ch.tone, flexShrink: 0 }} />
                  {ch.short} <b className="mono">{nOfCh(ch)}</b>
                </Chip>
              );
            })}
          </div>

          {/* 뺀 것을 숫자로 보여주는 게 "그냥 다 가져왔다" 를 없애는 가장 빠른 방법이다.
              held.tools 는 개수라 어느 원천에서 나왔는지는 알 수 없다 — 그래서 여기(전체)에 적는다. */}
          {!running && !!heldN && (
            <div style={{ marginTop: 11, padding: "8px 11px", borderRadius: 9,
                          background: "var(--amber-bg)", fontSize: 11, lineHeight: 1.55,
                          color: "var(--amber)", display: "flex", gap: 7 }}>
              <span style={{ flexShrink: 0 }}>✕</span>
              <span><b>{heldN}개는 아직 등록하지 않았습니다</b> — {held.map((h) => h.reason).join(" · ")}</span>
            </div>
          )}
        </div>
      )}

      {/* 카테고리 카드 — 변환 중에는 감춘다. 진행 중 화면의 주인공은 늘어나는 숫자다.
          원천마다 한 장씩 세우면 같은 "서버·DB" 가 네 장으로 흩어지고 그중 셋이 0개가 된다.
          카테고리는 셋으로 고정이므로 카드도 셋이어야 한 눈에 읽힌다 — 원천별 내역은
          바로 아래 그룹 목록이 이미 갖고 있어서 카드가 다시 나열할 이유가 없다. */}
      {!running && (
        <div style={{ display: "grid", gap: 8, padding: "13px 15px", background: "var(--main)",
                      borderBottom: "1px solid var(--line)",
                      gridTemplateColumns: `repeat(${channels.length},minmax(0,1fr))` }}>
          {channels.map((ch) => {
            const mine = groups.filter((g) => g.ch?.key === ch.key);
            const n = mine.reduce((a, g) => a + g.items.length, 0);
            const from = mine.filter((g) => g.items.length).length;   // 실제로 뭔가 나온 원천 수
            const on = sel?.kind === "ch" && sel.key === ch.key;
            const has = n > 0;
            // 도구 수가 0이어도 "안 담았다" 와 "아직 만드는 중" 은 다르다. 뒤엣것을
            // 회색으로 눕혀 두면 끝난 화면으로 읽혀서, 사용자가 되돌아와 다시 담는다.
            const busy = !has && pending?.has(ch.key);
            const live = has || busy;
            return (
              <button key={ch.key} disabled={!has}
                onClick={() => has && toggle("ch", ch.key)} style={{
                textAlign: "left", padding: "11px 12px", borderRadius: 12,
                cursor: has ? "pointer" : "default", opacity: live ? 1 : .55,
                fontFamily: "var(--sans)", transition: "border-color .16s ease, background .16s ease",
                background: on ? "var(--sel)" : "var(--card)",
                border: `1px solid ${on ? ch.tone
                  : busy ? `color-mix(in srgb,${ch.tone} 38%,var(--line2))` : "var(--line2)"}`,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5,
                               fontWeight: 700, color: live ? ch.tone : "var(--muted)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                 background: live ? ch.tone : "var(--faint)",
                                 animation: busy ? "dotPulse 1.1s ease-in-out infinite" : "none" }} />
                  {ch.label}
                </span>
                <span style={{ display: "block", fontFamily: "var(--disp)", fontSize: 24, fontWeight: 700,
                               lineHeight: 1, marginTop: 8, color: live ? ch.tone : "var(--faint)" }}>
                  {busy ? <Eq /> : <>{n}
                    <span style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--muted)", marginLeft: 3 }}>개</span>
                  </>}
                </span>
                <span style={{ display: "block", fontSize: 10.3, marginTop: 6, lineHeight: 1.5,
                               color: busy ? ch.tone : "var(--muted)" }}>
                  {has ? `${from}곳에서 가져왔습니다`
                    : busy ? "백그라운드에서 만드는 중입니다" : "이번에는 담지 않았습니다"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="onb-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {shown.map(({ r, ch, items }) => {
          const col = closed.has(r.name);
          return (
            <div key={r.name}>
              {/* 헤더는 화면에 붙어 있어야 한다 — 스크롤 중에도 "지금 보는 게 어디서 왔는지" 가 남는다. */}
              <div onClick={() => setClosed((s) => {
                const n = new Set(s); n.has(r.name) ? n.delete(r.name) : n.add(r.name); return n;
              })} style={{
                position: "sticky", top: 0, zIndex: 3, cursor: "pointer", userSelect: "none",
                padding: "11px 14px", background: "var(--main)",
                borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: "var(--faint)", width: 10, flexShrink: 0,
                                 display: "inline-block", transition: "transform .18s ease",
                                 transform: col ? "rotate(-90deg)" : "none" }}>▼</span>
                  <span style={{ width: 23, height: 23, flexShrink: 0, borderRadius: 7, display: "grid",
                                 placeItems: "center", background: `color-mix(in srgb,${ch?.tone} 14%,transparent)`,
                                 border: `1px solid color-mix(in srgb,${ch?.tone} 30%,transparent)` }}>
                    {iconFor(r.type, ch?.tone)}
                  </span>
                  <span style={{ fontSize: 12.6, fontWeight: 750, color: "var(--navy)", minWidth: 0,
                                 overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2.5px 8px", borderRadius: 999, flexShrink: 0,
                                 color: ch?.tone, background: `color-mix(in srgb,${ch?.tone} 13%,transparent)`,
                                 border: `1px solid color-mix(in srgb,${ch?.tone} 32%,transparent)` }}>
                    {ch?.short} 에서
                  </span>
                  <span style={{ marginLeft: "auto", flexShrink: 0, fontFamily: "var(--disp)", fontSize: 16,
                                 fontWeight: 700, color: items.length ? ch?.tone : "var(--faint)" }}>{items.length}</span>
                </div>

                <div style={{ marginTop: 7, fontSize: 11.3, color: "var(--text)", lineHeight: 1.6 }}>
                  {madeLine(r, items.length)}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {/* 어떻게 읽어냈는지가 결과 옆에 붙어야 "그냥 가져왔다" 가 아니게 된다. */}
                  {HOW[r.stage] && (
                    <span style={{
                      fontSize: 10.5, padding: "2.5px 8px", borderRadius: 7, lineHeight: 1.5,
                      background: HOW[r.stage].exact ? "var(--blue-bg)" : "var(--amber-bg)",
                      color: HOW[r.stage].exact ? "var(--blue)" : "var(--amber)",
                      border: `1px solid color-mix(in srgb,${HOW[r.stage].exact
                        ? "var(--blue)" : "var(--amber)"} 32%,transparent)`,
                    }}>
                      {HOW[r.stage].exact ? "◎" : "△"} {HOW[r.stage].text}
                    </span>
                  )}
                  <span style={{ fontSize: 10.5, padding: "2.5px 8px", borderRadius: 7, lineHeight: 1.5,
                                 background: "var(--green-bg)", color: "var(--green)",
                                 border: "1px solid color-mix(in srgb,var(--green) 30%,transparent)" }}>
                    ✓ {CRITERIA[r.type] || "읽기만 하는 기능"}
                  </span>
                  {r.state === "fail" && (
                    <span style={{ fontSize: 10.5, padding: "2.5px 8px", borderRadius: 7,
                                   background: "var(--red-bg)", color: "var(--red)",
                                   border: "1px solid color-mix(in srgb,var(--red) 30%,transparent)" }}>
                      ✕ 읽지 못했습니다
                    </span>
                  )}
                </div>
              </div>

              {!col && (items.length
                ? items.map((t, i) => (
                  <ToolRow key={`${t.name}-${i}`} t={t} tone={ch?.tone} title={r.name} />
                ))
                : (
                  <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--faint)", fontSize: 11.5 }}>
                    {r.state === "fail" ? "읽지 못해 도구를 만들지 못했습니다" : "여기서는 만들어진 도구가 없습니다"}
                  </div>
                ))}
            </div>
          );
        })}

        {!tools.length && (
          <div style={{ padding: "34px 20px", textAlign: "center", color: "var(--faint)", fontSize: 12 }}>
            아직 만들어진 도구가 없습니다
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: "11px 15px", borderTop: "1px solid var(--line)",
                    background: "var(--main)", fontSize: 11.5, color: "var(--muted)" }}>
        {sel
          ? <>고른 곳만 보는 중 — <b style={{ color: "var(--blue)" }}>{visN}개</b> / 전체 {tools.length}개</>
          : running
            ? <>만드는 중입니다 — 지금까지 <b style={{ color: "var(--blue)" }}>{tools.length}개</b></>
            : <>총 <b style={{ color: "var(--blue)" }}>{tools.length}개</b> 도구가 등록되었습니다</>}
      </div>
    </div>
  );
}

/** "무엇을 몇 개 읽어 몇 개를 만들었는지". 숫자가 어디서 나온 값인지 드러나야
 *  "그냥 가져왔다" 가 "21개를 읽어 24개를 만들었다" 로 바뀐다. */
function madeLine(r, n, plain = false) {
  const unit = UNIT[r.type] || "항목";
  const b = (x) => (plain ? x : <b style={{ color: "var(--navy)" }}>{x}</b>);
  if (!r.collected) return <>{b(`${n}개`)}를 만들었습니다</>;
  return <>{unit} {b(`${r.collected}개`)}를 읽어 {b(`${n}개`)}를 만들었습니다</>;
}

function Chip({ children, on, dim, tone, onClick }) {
  return (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999,
      cursor: "pointer", userSelect: "none", fontSize: 11.5, transition: "all .16s ease",
      background: on ? "var(--card)" : "var(--main)",
      border: `1px solid ${on && tone ? `color-mix(in srgb,${tone} 55%,transparent)` : "var(--line2)"}`,
      color: on ? "var(--navy)" : "var(--muted)", fontWeight: on ? 650 : 400,
      opacity: dim ? .42 : 1,
    }}>{children}</span>
  );
}

/** 도구 한 줄 — 읽는 순서를 뒤집었다.
 *  ① 무슨 일을 하는지(한글) → ② 종류 → ③ 어디서 왔는지 → ④ 실제 이름(작게).
 *  이전에는 ④가 맨 위라 매번 이름을 해석해야 출처를 알 수 있었다. */
function ToolRow({ t, tone, title }) {
  const isDb = t.backend === "db";
  const mark = isDb ? "var(--purple)" : "var(--blue)";
  return (
    <div style={{ display: "flex", gap: 10, padding: "11px 14px", position: "relative",
                  borderBottom: "1px solid var(--line)",
                  animation: "toolIn .34s cubic-bezier(.2,1.2,.4,1) both" }}>
      {/* 왼쪽 레일 — 필터로 섞여 보일 때도 행 자체가 출신을 갖는다. */}
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                     background: tone, opacity: .55 }} />
      <span style={{ width: 26, height: 26, flexShrink: 0, marginTop: 1, borderRadius: 8, display: "grid",
                     placeItems: "center", background: isDb ? "var(--purple-bg)" : "var(--blue-bg)",
                     border: `1px solid color-mix(in srgb,${mark} 30%,transparent)` }}>
        {isDb ? svg.db(mark) : svg.http(mark)}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12.4, fontWeight: 700, color: "var(--navy)", minWidth: 0,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {titleOf(t)}
          </span>
          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                         background: "var(--main)", border: "1px solid var(--line2)", color: "var(--text)" }}>
            {actionOf(t)}
          </span>
        </span>
        <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5,
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isDb
            ? <>{title} 의 <b style={{ color: "var(--text)", fontWeight: 650 }}>{coreName(t)}</b> 에서</>
            : t.path
              ? <>{title} 의 <b style={{ color: "var(--text)", fontWeight: 650 }}>{t.path}</b> 에서</>
              : <>{title} 에서</>}
        </span>
        <span className="mono" style={{ display: "block", fontSize: 9.5, color: "var(--faint)", marginTop: 4,
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.name}
        </span>
      </span>
    </div>
  );
}

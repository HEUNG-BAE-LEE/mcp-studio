import { useEffect } from "react";
// 연결할 소스 종류 — 복수 선택 카드 + 수확량 게이지.
//
// 이전 화면은 라디오 3택이라 "코드도 보고 DB 도 본다" 를 표현할 수 없었다. 체크박스로 바꾸고,
// 고른 종류마다 입력 화면이 하나씩 붙는 구조로 간다(서브스텝이 선택에 따라 늘어난다).
//
// 카드에 일러스트와 **수확량 게이지**를 넣는다. 사용자가 실제로 궁금한 건 설명이 아니라
// "이걸 고르면 무엇을 얼마나 얻나" 인데, 이전엔 그게 맨 아래 한 줄 텍스트였다.

/** 이 화면에 놓이는 것들의 공통 폭. 카드 그리드와 선택 요약바가 세로로 겹쳐 놓이므로
 *  두 줄이 같은 좌우 경계를 가져야 한 덩어리로 읽힌다. 예전에는 1190 과 1140 을 각자
 *  들고 있어 오른쪽 끝이 50px 어긋났다 — 숫자를 두 군데 적으면 한쪽만 고쳐진다. */
const STAGE_WIDTH = 1190;

/** 카드 일러스트 — 제품 라인아트 문법(stroke .75/1.25/2, 8px 그리드, 면은 그라디언트). */
const IL = {
  code: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      <g opacity=".55">
        {[24, 42, 60].map((y) => [16, 34].map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" rx="4" fill="var(--card)" stroke="var(--faint)" strokeWidth=".75" />
        )))}
      </g>
      <path d="M56 48h26" stroke="var(--blue)" strokeWidth="2" />
      <circle cx="88" cy="48" r="2.5" fill="var(--blue)" />
      <path d="M94 48h14" stroke="var(--blue)" strokeWidth="2" />
      <rect x="112" y="24" width="72" height="20" rx="6" fill="url(#obTeal)" stroke="var(--blue)" strokeWidth="1.5" />
      <rect x="112" y="52" width="72" height="20" rx="6" fill="url(#obPur)" stroke="var(--purple)" strokeWidth="1.5" />
      <path d="M122 34h26M122 62h34" stroke="var(--blue)" strokeWidth="1.25" opacity=".55" />
    </svg>
  ),
  openapi: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      {[22, 46, 70].map((y, i) => (
        <g key={y}>
          <rect x="30" y={y} width={i === 2 ? 96 : 140} height="18" rx="6" fill="url(#obGrey)" stroke="var(--muted)" strokeWidth="1.5" />
          <circle cx="42" cy={y + 9} r="2.5" fill="var(--muted)" />
          <path d={`M54 ${y + 9}h${[58, 44, 34][i]}`} stroke="var(--faint)" strokeWidth="1.25" />
        </g>
      ))}
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      <path d="M64 62a18 18 0 0 1 3-35 23 23 0 0 1 43-5 17 17 0 0 1 18 40z"
        fill="url(#obTeal)" stroke="var(--blue)" strokeWidth="1.75" />
      <path d="M84 40h16M84 50h26" stroke="var(--blue)" strokeWidth="1.25" opacity=".55" />
      <path d="M100 70v10" stroke="var(--blue)" strokeWidth="1.25" strokeDasharray="3 4" />
      <rect x="76" y="80" width="48" height="12" rx="5" fill="url(#obTeal)" stroke="var(--blue)" strokeWidth="1.5" />
      <circle cx="140" cy="26" r="9" fill="none" stroke="var(--blue)" strokeWidth="1.5" />
      <path d="M136 26l3 3 6-6" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={40 + i * 14} y={18 + i * 6} width="62" height="70" rx="7"
          fill="var(--card)" stroke="var(--faint)" strokeWidth=".75" opacity={0.35 + i * 0.2} />
      ))}
      <path d="M84 40h30M84 52h22M84 64h26" stroke="var(--amber)" strokeWidth="1.25" opacity=".7" />
      <path d="M116 56h14" stroke="var(--amber)" strokeWidth="2" />
      <circle cx="140" cy="56" r="2.5" fill="var(--amber)" />
      <rect x="148" y="44" width="30" height="24" rx="7" fill="url(#obAmb)" stroke="var(--amber)" strokeWidth="1.5" />
    </svg>
  ),
  db: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      <ellipse cx="72" cy="26" rx="34" ry="11" fill="url(#obPur)" stroke="var(--purple)" strokeWidth="1.75" />
      <path d="M38 26v40c0 6 15 11 34 11s34-5 34-11V26" stroke="var(--purple)" strokeWidth="1.75" fill="none" />
      <path d="M38 46c0 6 15 11 34 11s34-5 34-11" stroke="var(--purple)" strokeWidth="1.25" opacity=".6" />
      <path d="M110 52h20" stroke="var(--purple)" strokeWidth="2" />
      <circle cx="136" cy="52" r="2.5" fill="var(--purple)" />
      <path d="M142 52h10" stroke="var(--purple)" strokeWidth="2" />
      <rect x="152" y="40" width="32" height="24" rx="7" fill="url(#obPur)" stroke="var(--purple)" strokeWidth="1.5" />
    </svg>
  ),
};

/** 카드는 **무엇이 나오는가** 로 가른다. 두 장이다.
 *
 *  처음에는 소스코드·클라우드·문서·열린API·DB 다섯 장이었고, 다음에는 재료를 기준으로
 *  소스 코드 / 서버에서 직접 수집 / 문서 세 장이 됐다. 그런데 앞 두 장은 **산출물이 같다** —
 *  둘 다 API 도구를 만든다. 갈라 놓을 이유가 "어디서 읽는가" 밖에 없었고, 그 대가로
 *  클라우드가 `서버 카드 → 하위 옵션` 두 단계 안쪽에 묻혀 "클라우드도 된다" 가 안 읽혔다.
 *
 *  화면은 이미 답을 알고 있었다. 카드마다 달린 `chips` 가 정확히 `⇄ API 도구` 와
 *  `▦ 검색 지식` 이다 — 사용자가 첫 화면에서 궁금한 것은 어디서 읽는지가 아니라
 *  무엇이 만들어지는지다. 그래서 최상위를 그 축으로 두 장으로 줄이고, 출처(온프렘·클라우드)는
 *  API 탐색 카드 **안의 추가 항목**으로 내린다. 온프렘과 클라우드가 형제가 된다.
 *
 *  `ready:false` 는 숨기지 않는다 — 숨기면 "이 제품은 못 한다"로 읽힌다. */
// `how` — 고르기 **전에** "무엇을 얻나" 만큼이나 "어떻게 찾나" 가 궁금하다. 그게 없으면
// 결과를 받고도 "그냥 가져왔다" 로 읽힌다. 한 줄까지만 — 더 늘리면 선택 화면이 문서가 된다.
// 자세한 건 입력 화면의 "어떻게 찾나요?" 에서 편다.
export const SOURCES = [
  {
    id: "api", title: "API 탐색", illust: IL.code, ready: true, group: true,
    addLabel: "리소스 추가",
    desc: "떠 있는 서비스를 읽어 AI 가 부를 수 있는 도구로 만듭니다. 설명서가 없어도 됩니다.",
    how: "저장소에서 API 를 찾고, 서버 주소가 있으면 실제로 떠 있는지까지 대조합니다.",
    chips: [["api", "⇄ API 도구"]],
    gauge: 92, gaugeTone: "hi", gaugeText: "가장 많음", rec: "가장 많이 얻습니다",
    // 방식 이름은 **어떻게 찾나** 로 통일한다. 예전에는 앞의 둘이 "어디에 있나"(온프렘·
    // 클라우드)를, 마지막이 "어떻게 넣나"(직접 입력)를 말해 축이 섞였고, 그래서 셋을
    // 나란히 비교하기 어려웠다.
    options: [
      {
        id: "onprem", title: "소스코드 기반 수집", picks: ["code"],
        desc: "저장소를 읽어 API 를 찾고, 서버 주소가 있으면 실제로 떠 있는지까지 대조합니다.",
      },
      {
        id: "cloud", title: "클라우드 기반 수집", picks: ["cloud"],
        desc: "계정으로 로그인하면 구독 안의 API 서버를 찾아 드립니다.",
      },
      {
        id: "direct", title: "직접 입력 후 수집", picks: ["openapi"],
        desc: "설명서 주소를 손으로 넣습니다. 소스가 없어도 됩니다.",
      },
    ],
  },
  {
    // DB 를 API 카드 안의 칩으로 두던 것을 카드로 승격한다. 데이터베이스는 API 도 문서도
    // 아닌데, 접속 정보를 "소스 코드를 넣는 화면" 에서 받고 있었다. 카드가 생기면 그 입력이
    // 갈 자리가 생긴다.
    //
    // 소스코드 기반 수집은 여기 없다 — 코드에서 찾는 것은 조회 **함수**지 표 구조가 아니고,
    // 그 산출물은 API 카드 쪽이다.
    id: "database", title: "데이터베이스 탐색", illust: IL.db, ready: true, group: true,
    addLabel: "리소스 추가",
    desc: "표 구조를 읽어 조회 도구로 만듭니다. 데이터를 꺼내 보지는 않습니다.",
    how: "테이블과 컬럼을 읽어 조회 도구를 만듭니다. 코드 안의 조회 함수는 API 탐색에서 함께 가져옵니다.",
    chips: [["db", "▤ 조회 도구"]],
    gauge: 62, gaugeTone: "hi", gaugeText: "표 수만큼",
    options: [
      {
        id: "clouddb", title: "클라우드 기반 수집", picks: ["clouddb"],
        desc: "계정으로 로그인하면 구독 안의 관리형 DB 를 찾아 드립니다.",
      },
      {
        id: "directdb", title: "직접 입력 후 수집", picks: ["db"],
        desc: "데이터베이스 주소와 계정을 손으로 넣습니다.",
      },
    ],
  },
  {
    id: "document", title: "비정형 문서 탐색", illust: IL.document, ready: true,
    addLabel: "문서 올리기",
    desc: "PDF·DOCX·XLSX 를 올려 찾아 읽을 수 있는 지식으로 만듭니다(RAG).",
    how: "PDF · 워드 · 엑셀을 잘라 찾아 읽을 수 있는 조각으로 만듭니다.",
    chips: [["doc", "▦ 검색 지식"]],
    gauge: 44, gaugeTone: "mid", gaugeText: "올린 만큼",
  },
];

/** 입력 채널 이름 — 선택 요약·스텝 라벨이 쓴다. SOURCES 의 카드 id 와는 다른 축이다. */
export const CHANNEL_TITLE = {
  code: "소스 코드", cloud: "클라우드 계정", openapi: "서버 주소",
  // 클라우드 계정은 하나인데 카드가 둘이라 채널도 둘이다. 로그인 상태(azureAcct)는
  // 여전히 하나로 공유되고, 갈리는 것은 **무엇을 가져오나** 뿐이다 — API 서버냐 관리형 DB 냐.
  clouddb: "클라우드 계정 · DB", db: "데이터베이스", document: "문서",
};

const CHIP = {
  api: { bg: "var(--blue-bg)", fg: "var(--blue)", bd: "color-mix(in srgb,var(--blue) 32%,transparent)" },
  db: { bg: "var(--purple-bg)", fg: "var(--purple)", bd: "color-mix(in srgb,var(--purple) 32%,transparent)" },
  doc: { bg: "var(--amber-bg)", fg: "var(--amber)", bd: "color-mix(in srgb,var(--amber) 32%,transparent)" },
};

/** 카드 그리드. 선택은 배열이며 토글이다.
 *
 *  `selected` 가 담는 것은 카드 id 가 아니라 **입력 채널** id(code/cloud/openapi/db/document)다.
 *  뒤 스텝 구성이 이 배열로 만들어지므로, 그룹 카드는 자기 하위 채널이 하나라도 켜져 있으면
 *  켜진 것으로 본다. */
/** 카드 안에 쌓인 것 — 담은 리소스를 카드가 직접 보여준다.
 *
 *  카드가 "고르는 것" 에서 "쌓는 것" 이 되면서, 지금까지 무엇을 담았는지가 카드 안에 있어야
 *  한다. 아래 요약바에도 같은 정보가 있지만 그건 **채널 이름**(소스 코드·클라우드)이고,
 *  여기 필요한 것은 **무엇을 담았나**(저장소 이름·계정)다. 층위가 다르다.
 *
 *  넷까지만 적는다. 카드 높이가 담은 개수를 따라 자라면 두 장의 높이가 어긋나고,
 *  많이 담을수록 정작 옆 카드가 안 보인다. */
function CardRows({ items }) {
  if (!items?.length) return null;
  const shown = items.slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 2 }}>
      {shown.map((r) => (
        <div key={r.key} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 8,
          background: "var(--main)", border: "1px solid var(--line2)",
        }}>
          {/* 주소가 없는 온프렘 시스템은 왼쪽 띠로 표시한다 — 담기긴 했지만 대조는 못 한다. */}
          {r.warn && <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: "var(--amber)" }} />}
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--navy)", flexShrink: 0 }}>{r.label}</span>
          <span className="mono" style={{
            fontSize: 10.5, color: "var(--muted)", marginLeft: "auto",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{r.detail}</span>
        </div>
      ))}
      {items.length > shown.length && (
        <div style={{ fontSize: 10.5, color: "var(--faint)", paddingLeft: 3 }}>
          +{items.length - shown.length}개 더
        </div>
      )}
    </div>
  );
}

export function SourcePicker({ selected, onToggle, onPickChannels, openGroup, onOpenGroup, rows }) {
  // 카드는 줄어들지 않는다. 하위 작업(로그인·구독·수집)은 오른쪽 시트에서 벌어지므로
  // 카드가 자리를 내줄 이유가 없다. 예전에는 카드를 축소해 아래에 자리를 만들었는데,
  // 고르는 순간 화면 전체가 재배치돼 방금 무엇을 눌렀는지 놓치기 쉬웠다(#375).
  // 그룹 카드는 두 상태를 구분한다. **펼침**(아래 박스가 열려 있다)과 **선택됨**(하위를
  // 실제로 골랐다). 둘을 하나로 합쳐 체크를 켜면, 아직 아무것도 안 골랐는데 골랐다고
  // 표시돼 요약바·다음 버튼과 어긋난다.
  const groupPicked = (s) => (s.options || []).some((o) => o.picks.some((c) => selected.includes(c)));
  return (
    <>
      {/* 그라디언트는 한 번만 정의하고 카드들이 참조한다 — id 중복 시 브라우저마다 다른 걸 집는다. */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="obTeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f86f6" stopOpacity=".18" /><stop offset="1" stopColor="#2f86f6" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="obPur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6f78d6" stopOpacity=".18" /><stop offset="1" stopColor="#6f78d6" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="obAmb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8841e" stopOpacity=".18" /><stop offset="1" stopColor="#e8841e" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="obGrey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#767d92" stopOpacity=".14" /><stop offset="1" stopColor="#767d92" stopOpacity=".03" />
          </linearGradient>
        </defs>
      </svg>

      {/* 폭은 아래 선택 요약 바와 같은 STAGE_WIDTH 로 맞춘다. 카드 수에 따라 상한을 따로
          잡았더니(둘일 때 880, 셋일 때 1060) 카드 줄과 요약 바의 좌우 끝이 어긋나 보였다.
          기준을 하나로 두면 카드가 몇 장이든 같은 자리에서 시작하고 끝난다.

          트랙 최소값에 min() 을 씌우는 이유는 넘침 방지다. 그냥 300px 로 두면 컨테이너가
          그보다 좁을 때 그리드가 밖으로 밀려 왼쪽이 잘린다 — 오른쪽 도우미 패널이 붙으면
          실제로 그렇게 된다. auto-fit 은 남는 트랙을 접으므로 카드는 늘 폭을 꽉 채운다. */}
      <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: STAGE_WIDTH,
                    gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))" }}>
        {SOURCES.map((s, i) => {
          const picked = s.group ? groupPicked(s) : selected.includes(s.id);
          const open = s.group && openGroup === s.id;
          const on = picked || open;        // 테두리·배경은 펼침만으로도 살아난다
          const disabled = !s.ready;
          // 그룹 카드를 끌 때는 켜져 있던 하위 채널을 모두 끈다 — 카드는 꺼졌는데 입력 스텝만
          // 남아 있으면 "고르지도 않은 화면"이 이어진다.
          // 그룹 카드는 "어디서 찾을지" 를 아래 박스에서 묻는다. 카드 안에 하위 선택을 넣으면
          // 그 카드만 길어져 3장의 높이가 어긋나고, 고르기 전부터 선택지가 노출된다.
          const click = () => {
            if (!s.group) return onToggle(s.id);
            if (on) { onPickChannels(s.options.flatMap((o) => o.picks), false); onOpenGroup(null); }
            else onOpenGroup(s.id);
          };
          return (
            <div key={s.id} onClick={disabled ? undefined : click} style={{
              border: `1.5px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
              background: on ? "var(--sel)" : "var(--card)",
              borderRadius: 18, overflow: "hidden", position: "relative",
              display: "flex", flexDirection: "column",
              cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
              boxShadow: on ? "var(--sel-ring)" : "none",
              transform: on ? "translateY(-3px)" : "none",
              transition: "transform .18s ease,border-color .18s,box-shadow .18s",
              animation: "popIn .32s ease-out both", animationDelay: `${i * 0.05}s`,
            }}>
              {s.rec && !disabled && (
                <span style={{
                  position: "absolute", top: 16, left: 18, zIndex: 2, fontSize: 10.5, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 7, background: "var(--blue)", color: "#06231f",
                }}>{s.rec}</span>
              )}
              {disabled && (
                <span style={{
                  position: "absolute", top: 16, left: 18, zIndex: 2, fontSize: 10.5, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 7, background: "var(--main)",
                  border: "1px solid var(--line2)", color: "var(--muted)",
                }}>{s.soon}</span>
              )}
              {/* 체크는 사각형이다 — 원형은 "하나만" 을 뜻한다. 모양만으로 복수 선택이 읽힌다.
                  단 그룹 카드를 펼치기만 했을 때는 체크박스를 두지 않는다. 아래에서 방법을
                  고르기 전까지는 아직 고른 게 없는데, 빈 체크박스가 보이면 "왜 체크가 안
                  되지" 로 읽힌다. 그 자리에는 펼쳐졌다는 표시(∨)를 둔다. */}
              {open && !picked ? (
                <span style={{
                  position: "absolute", top: 16, right: 16,
                  zIndex: 2, display: "inline-flex",
                  alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
                  background: "var(--blue-bg)", color: "var(--blue)",
                  border: "1px solid color-mix(in srgb,var(--blue) 34%,transparent)",
                  fontSize: 10.5, fontWeight: 700,
                }}>
                  펼침
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              ) : (
                <span style={{
                  position: "absolute", top: 16, right: 16,
                  minWidth: 22, height: 22, padding: "0 5px",
                  borderRadius: 7, zIndex: 2,
                  border: `2px solid ${picked ? "var(--sel-border)" : "var(--line2)"}`,
                  background: picked ? "var(--sel-border)" : "var(--main)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                }}>
                  {picked && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                  {/* 그룹은 하위 몇 개를 골랐는지까지 보여준다 — 카드 하나가 채널 둘을 켤 수 있다. */}
                  {picked && s.group && (
                    <span className="mono" style={{ fontSize: 10, fontWeight: 800, color: "#06231f" }}>
                      {s.options.filter((o) => o.picks.some((c) => selected.includes(c))).length}
                    </span>
                  )}
                </span>
              )}

              {(
                <div style={{
                  // 카드가 셋이 되면서 세로가 빠듯하다. 일러스트는 분위기를 잡는 요소라
                  // 30px 줄여도 읽히는 정보가 줄지 않는다 — 목록·칩·게이지가 먼저다.
                  height: 88, display: "grid", placeItems: "center", borderBottom: "1px solid var(--line)",
                  background: on
                    ? "linear-gradient(170deg,color-mix(in srgb,var(--blue) 10%,transparent),transparent 72%)"
                    : "linear-gradient(170deg,rgba(255,255,255,.035),transparent 70%)",
                }}>{s.illust}</div>
              )}

              <div style={{ padding: "16px 20px 18px",
                            display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)",
                              letterSpacing: "-.015em", paddingRight: 30 }}>{s.title}</div>
                <div style={{ fontSize: 12.8, color: "var(--text)", lineHeight: 1.58 }}>{s.desc}</div>
                {/* "얻는 것" 옆에 "어떻게 얻는지" 한 줄. 방법을 모르면 결과를 믿을 근거가 없다. */}
                {s.how && (
                  <div style={{ marginTop: 2, padding: "9px 11px", borderRadius: 10,
                                background: "var(--main)", border: "1px solid var(--line2)" }}>
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".06em",
                                                   color: "var(--faint)", marginBottom: 4 }}>이렇게 찾습니다</div>
                    <div style={{ fontSize: 11.3, color: "var(--text)", lineHeight: 1.6 }}>{s.how}</div>
                  </div>
                )}
                <CardRows items={rows?.[s.id]} />
                <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px dashed var(--line2)",
                              display: "block" }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 650, marginBottom: 7, letterSpacing: ".04em" }}>얻는 것</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
                    {s.chips.map(([k, label]) => (
                      <span key={label} style={{
                        fontSize: 11, fontWeight: 700, padding: "3.5px 9px", borderRadius: 8,
                        background: CHIP[k].bg, color: CHIP[k].fg, border: `1px solid ${CHIP[k].bd}`,
                      }}>{label}</span>
                    ))}
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--main)", overflow: "hidden" }}>
                    <span style={{
                      display: "block", height: "100%", width: `${s.gauge}%`, borderRadius: 3,
                      background: s.gaugeTone === "hi"
                        ? "linear-gradient(90deg,var(--blue-d),#2dd4bf)"
                        : "linear-gradient(90deg,#4a4f68,#767d92)",
                    }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>수확량</span><b style={{ color: "var(--navy)" }}>{s.gaugeText}</b>
                  </div>
                  {/* 카드가 "쌓는 것" 이 됐으니 더 담을 수 있다는 신호가 카드 안에 있어야 한다.
                      별도 버튼이 아니라 카드 전체가 그대로 그 동작이다 — 같은 자리에 두 개의
                      클릭 대상을 겹치면 어느 쪽을 눌러야 하는지가 오히려 흐려진다. */}
                  {s.addLabel && (
                    <div style={{
                      marginTop: 10, padding: "8px 10px", borderRadius: 9, fontSize: 11.5,
                      fontWeight: 700, textAlign: "center",
                      border: `1px dashed ${on ? "color-mix(in srgb,var(--blue) 45%,transparent)" : "var(--line2)"}`,
                      color: on ? "var(--blue)" : "var(--muted)",
                    }}>+ {s.addLabel}</div>
                  )}
                  {open && !picked && (
                    <div style={{
                      marginTop: 8, padding: "7px 10px", borderRadius: 9, fontSize: 11,
                      background: "var(--blue-bg)", color: "var(--blue)", fontWeight: 650,
                      border: "1px solid color-mix(in srgb,var(--blue) 28%,transparent)",
                    }}>→ 오른쪽에서 추가할 방식을 골라주세요</div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** 어디서 찾을지 — 서버 카드를 고르면 오른쪽에서 밀려 나오는 시트.
 *
 *  예전에는 카드 그리드 **아래**에 펼쳐졌다. 그러면 카드가 축소되고 화면이 통째로
 *  재배치되는데, 사용자는 방금 무엇을 눌렀는지 놓치고 "왜 작아졌지" 부터 묻게 된다.
 *  게다가 로그인·구독·수집이 줄줄이 아래로 자라 스크롤이 생겼다.
 *
 *  시트는 그 둘을 한 번에 없앤다. 카드는 그 자리에 그대로 있고(닫으면 원래 화면),
 *  길어지는 작업은 시트 안에서만 스크롤한다. */
export function SourceSheet({ groupId, selected, onPick, onClose, extras }) {
  const group = SOURCES.find((s) => s.id === groupId);
  useEffect(() => {
    if (!group) return;
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [group, onClose]);
  if (!group?.options) return null;

  const pickedCount = group.options.filter((o) => o.picks.some((c) => selected.includes(c))).length;
  // 단계는 둘만 센다. 로그인·구독·수집을 각각 단계로 쪼개면 방법에 따라 개수가 달라져
  // "3 중 2" 가 무엇의 2인지 흐려진다. 여기서 확실한 건 고르기 전과 후뿐이다.
  const stage = pickedCount ? 1 : 0;

  return (
    <>
      {/* 카드를 가리되 지우지는 않는다 — 시트가 무엇에 딸린 작업인지 뒤에 남아 보여야 한다. */}
      <div onClick={onClose} style={{
        position: "absolute", inset: "-22px -32px -18px", zIndex: 5,
        background: "rgba(6,8,14,.55)", animation: "fadeIn .18s ease-out both",
      }} />
      <aside className="onb-sheet" style={{
        position: "absolute", top: -22, right: -32, bottom: -18, zIndex: 6,
        background: "var(--app)", borderLeft: "1px solid var(--line2)",
        boxShadow: "-24px 0 60px rgba(0,0,0,.5)",
        display: "flex", flexDirection: "column",
        animation: "sheetIn .26s cubic-bezier(.22,.9,.3,1) both",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "15px 18px",
          borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center",
            border: `2px solid ${pickedCount ? "var(--sel-border)" : "var(--line2)"}`,
            background: pickedCount ? "var(--sel-border)" : "transparent",
          }}>
            {!!pickedCount && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
          <b style={{ fontSize: 14, color: "var(--navy)" }}>{group.title}</b>
          <button onClick={onClose} aria-label="닫기" style={{
            marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: 16, lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>

        <div className="onb-scroll" style={{ padding: "16px 18px", flex: 1, overflow: "auto" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[0, 1].map((i) => (
              <span key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= stage ? "var(--blue)" : "var(--line2)",
                transition: "background .2s",
              }} />
            ))}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".06em", marginBottom: 14 }}>
            {stage ? "2 / 2 · 연결하고 수집하기" : "1 / 2 · 찾을 방법 고르기"}
          </div>

          <div style={{ display: "grid", gap: 9 }}>
            {group.options.map((o) => {
              const on = o.picks.some((c) => selected.includes(c));
              const extra = on ? extras?.[o.id] : null;
              return (
                <div key={o.id}>
                  <div onClick={() => onPick(o.picks, !on)} style={{
                    display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 15px",
                    borderRadius: 12, cursor: "pointer",
                    background: on ? "var(--sel)" : "var(--main)",
                    border: `1px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
                    transition: "background .16s,border-color .16s",
                  }}>
                    <span style={{
                      width: 18, height: 18, flexShrink: 0, marginTop: 1, borderRadius: 6, display: "grid",
                      placeItems: "center", border: `2px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
                      background: on ? "var(--sel-border)" : "transparent",
                    }}>
                      {on && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{o.title}</span>
                      <span style={{ display: "block", fontSize: 11.8, color: "var(--muted)", marginTop: 3, lineHeight: 1.55 }}>{o.desc}</span>
                    </span>
                  </div>
                  {extra && <div style={{ marginTop: 10 }}>{extra}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "13px 18px",
          borderTop: "1px solid var(--line)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>닫아도 선택은 남습니다</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "var(--blue)", color: "#06231f", fontSize: 12.5, fontWeight: 750,
          }}>완료</button>
        </div>
      </aside>
    </>
  );
}


/** 선택 요약 바 — 복수 선택은 "지금 몇 개 골랐지" 가 흐려진다. 고른 것과 남은 것을 상시 노출한다.
 *
 *  예상 도구 수는 뺐다. 종류별 상수를 더한 값이라 저장소 크기·프레임워크와 무관하게 늘 같은 수가
 *  나왔는데, 읽어보기 전에는 알 수 없는 값을 크게 띄우면 사용자는 그걸 약속으로 받아들인다. */
export function SelectionSummary({ selected, onRemove, total }) {
  if (!selected.length) return null;
  const left = Math.max(0, (total ?? selected.length) - selected.length);
  return (
    <div style={{
      marginTop: 18, maxWidth: STAGE_WIDTH, display: "flex", alignItems: "center", gap: 15,
      padding: "14px 19px", borderRadius: 15, background: "var(--card)",
      border: "1px solid color-mix(in srgb,var(--blue) 30%,transparent)",
      animation: "fadeUp .3s ease-out",
    }}>
      <div>
        <div style={{ fontFamily: "var(--disp)", fontSize: 28, fontWeight: 700, color: "var(--blue)", lineHeight: 1 }}>
          {selected.length}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>가지 선택</div>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flex: 1 }}>
        {selected.map((id) => {
          const s = { title: CHANNEL_TITLE[id] || id };
          return (
            <span key={id} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 10,
              background: "var(--main)", border: "1px solid var(--line2)", fontSize: 12,
              color: "var(--navy)", fontWeight: 650,
            }}>
              {s?.title}
              <span onClick={(e) => { e.stopPropagation(); onRemove(id); }}
                style={{ color: "var(--faint)", fontSize: 13, cursor: "pointer" }}>✕</span>
            </span>
          );
        })}
        {/* 남았을 때만 보이는 것이 가장 강한 유도다 — 다 고르면 이 자리가 사라진다. */}
        {!!left && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10,
            border: "1px dashed var(--line2)", color: "var(--muted)", fontSize: 12,
          }}>＋ 더 고르기 <span style={{ color: "var(--faint)" }}>· {left}가지 남음</span></span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 15, borderLeft: "1px solid var(--line2)" }}>
        입력 화면이 <b style={{ color: "var(--navy)" }}>{selected.length}개</b> 이어집니다
      </div>
    </div>
  );
}

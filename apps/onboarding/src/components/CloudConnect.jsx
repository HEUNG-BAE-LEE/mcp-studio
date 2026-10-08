// 클라우드 연결 — 레거시 위치 스텝에서 Entra ID SSO 로그인만 담당한다.
//
// 예전엔 이 컴포넌트가 로그인 + 구독 인벤토리 조회 + 리소스 선택까지 모두 했다.
// 구독을 뒤져 VM·DB 를 꺼내오는 일은 성격상 온프렘 대역 스윕과 같은 "탐색"이므로,
// 다음 스텝(레거시 소스 등록)의 자동탐색으로 옮겼다. 여기서는 연결까지만 끝낸다.
// 로그인 결과(계정·구독 목록)는 onConnected 로 위자드에 올려 탐색 범위 선택에 쓴다.
import { useId, useRef, useState } from "react";
import { api } from "../api";
import { azureConfigured, azureLogin, azureLogout, cancelAzureLogin, getArmToken } from "../lib/azureAuth";
import TrailingDots from "../ui/TrailingDots";

const PRI = "#0d9488", PRI_HI = "#2dd4bf", PRI_SOFT = "#1b2c47", PRI_LINE = "#1d4a45";
const AZURE = "#3CCBF4";

// Azure 브랜드 마크 — 프로바이더 카드·계정 배지에서 공통 사용.
// 공식 그라디언트 로고(src/svg/Cloud Provider/azure.svg). 한 페이지에 여러 번 그려질 수
// 있어 gradient id 가 겹치면 색이 뭉개지므로 useId 로 인스턴스마다 고유화한다.
function AzureMark({ size = 26 }) {
  const uid = useId().replace(/:/g, "");   // id 에 콜론이 들어가면 url(#..) 참조가 깨진다
  const g0 = `az0-${uid}`, g1 = `az1-${uid}`, g2 = `az2-${uid}`;
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.242 1.613A1.11 1.11 0 018.295.857h6.977L8.03 22.316a1.11 1.11 0 01-1.052.755h-5.43a1.11 1.11 0 01-1.053-1.466L7.242 1.613z" fill={`url(#${g0})`} />
      <path d="M18.397 15.296H7.4a.51.51 0 00-.347.882l7.066 6.595c.206.192.477.298.758.298h6.226l-2.706-7.775z" fill="#0078D4" />
      <path d="M15.272.857H7.497L0 23.071h7.775l1.596-4.73 5.068 4.73h6.665l-2.707-7.775h-7.998L15.272.857z" fill={`url(#${g1})`} />
      <path d="M17.193 1.613a1.11 1.11 0 00-1.052-.756h-7.81.035c.477 0 .9.304 1.052.756l6.748 19.992a1.11 1.11 0 01-1.052 1.466h-.12 7.895a1.11 1.11 0 001.052-1.466L17.193 1.613z" fill={`url(#${g2})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={g0} x1="8.247" x2="1.002" y1="1.626" y2="23.03"><stop stopColor="#114A8B" /><stop offset="1" stopColor="#0669BC" /></linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={g1} x1="14.042" x2="12.324" y1="15.302" y2="15.888"><stop stopOpacity=".3" /><stop offset=".071" stopOpacity=".2" /><stop offset=".321" stopOpacity=".1" /><stop offset=".623" stopOpacity=".05" /><stop offset="1" stopOpacity="0" /></linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={g2} x1="12.841" x2="20.793" y1="1.626" y2="22.814"><stop stopColor="#3CCBF4" /><stop offset="1" stopColor="#2892DF" /></linearGradient>
      </defs>
    </svg>
  );
}

// 인증 배지 — 방패 안 체크(SNS 인증마크 관용 형태). 로그인 완료를 한눈에.
function VerifiedShield({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.6l7.8 2.9v6.2c0 4.9-3.2 9.2-7.8 11.7-4.6-2.5-7.8-6.8-7.8-11.7V4.5L12 1.6z" fill={PRI_HI} />
      <path d="M8.2 12.1l2.6 2.6 5-5.2" fill="none" stroke="#08201e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CloudConnect({ acct, subs = [], onConnected }) {
  const [provider, setProvider] = useState(acct ? "azure" : null);   // azure | aws | gcp (aws/gcp 준비중)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // 취소 플래그 — 취소 후 늦게 도착한 로그인 결과를 무시하기 위한 ref.
  // state 로 두면 진행 중인 login 클로저가 갱신값을 못 보므로 ref 를 쓴다.
  const cancelled = useRef(false);

  const login = async () => {
    cancelled.current = false;
    setBusy(true); setErr(null);
    try {
      const a = await azureLogin();
      if (cancelled.current) return;   // 취소됐으면 결과 폐기
      // 로그인 응답의 ARM 토큰을 그대로 쓴다 — 여기서 getArmToken 을 다시 부르면
      // silent 실패 시 예외로 로그인 흐름이 끊긴다(팝업 폴백은 중첩 금지로 제거됨).
      const token = a.armToken || await getArmToken();
      const { subscriptions } = await api.azureSubscriptions(token);
      if (cancelled.current) return;
      onConnected?.({ acct: a, subs: subscriptions || [] });
    } catch (e) {
      if (cancelled.current) return;   // 취소로 인한 팝업 종료 오류는 무시
      const msg = e?.errorCode === "interaction_in_progress"
        ? "이전 로그인이 아직 정리되지 않았습니다 — 잠시 후 다시 시도하거나 취소를 눌러주세요."
        : e?.errorCode === "user_cancelled"
          ? "로그인이 취소되었습니다."
          : (e?.message || "로그인 실패");
      setErr(msg);
    } finally {
      if (!cancelled.current) setBusy(false);
    }
  };

  // 로그인 취소 — 진행 중이던 MSAL 상호작용을 정리하고 대기 상태를 푼다.
  // 팝업 창 자체는 MSAL 이 프로그래밍적 종료 API 를 주지 않아 사용자가 닫는다.
  const cancel = () => {
    cancelled.current = true;
    cancelAzureLogin();
    setBusy(false);
    setErr(null);
  };

  const logout = () => {
    azureLogout();
    setProvider(null); setErr(null);
    onConnected?.({ acct: null, subs: [] });
  };

  if (!azureConfigured()) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, padding: "16px 18px", fontSize: "var(--fs-label)", color: "var(--muted)", lineHeight: 1.6 }}>
        ⚙ Azure 로그인이 아직 설정되지 않았습니다 — 배포에 <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>VITE_AZURE_CLIENT_ID / VITE_AZURE_TENANT_ID</span> 를 넣으면 이 자리에서 실제 로그인이 동작합니다.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${PRI_LINE}`, borderRadius: 14, padding: "16px 18px" }}>
      {acct ? (
        // ── 연결 완료 — 계정 + 확인된 구독 수. 리소스 선택은 다음 스텝에서. ──
        <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 34, height: 34, borderRadius: 10, background: PRI_SOFT, border: `1px solid ${PRI_LINE}`, display: "grid", placeItems: "center" }}>
            <AzureMark size={19} />
            {/* 인증 배지는 아바타 우하단에 겹쳐 붙인다(SNS 인증마크 관용 배치) */}
            <span style={{ position: "absolute", right: -5, bottom: -5, lineHeight: 0, background: "var(--card)", borderRadius: "50%", padding: 1 }}><VerifiedShield size={15} /></span>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)" }}>{acct.name || acct.username}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-caption)", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: PRI_SOFT, border: `1px solid ${PRI_LINE}`, color: PRI_HI }}>
                <VerifiedShield size={11} />로그인 완료
              </span>
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `color-mix(in srgb,${AZURE} 16%,var(--card))`, color: AZURE }}>Azure</span>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", color: "var(--muted)", marginTop: 2 }}>
              {acct.username} · 구독 {subs.length}개 확인
            </div>
          </div>
          <button onClick={logout} title="Azure 로그아웃"
            style={{ background: "transparent", border: "1px solid var(--line2)", borderRadius: 8, color: "var(--muted)", fontSize: "var(--fs-caption)", fontWeight: 600, padding: "7px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>
            로그아웃
          </button>
          <div style={{ flexBasis: "100%", fontSize: "var(--fs-caption)", color: PRI_HI, background: PRI_SOFT, border: `1px solid ${PRI_LINE}`, borderRadius: 9, padding: "9px 12px", lineHeight: 1.55 }}>
            클라우드 리소스 연결 준비가 완료되었습니다. <b>[소스 등록]</b> 단계에서 이음으로 연결할 클라우드 리소스를 선택할 수 있습니다.
          </div>
        </div>
      ) : !provider ? (
        // ── 프로바이더 선택 (Azure 활성 · AWS/GCP 준비중) ──
        <div>
          <div style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)", marginBottom: 2, textAlign: "center" }}>클라우드 프로바이더를 선택하세요</div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--muted)", marginBottom: 14, textAlign: "center" }}>SSO 로그인으로 연결만 해두면, 리소스는 다음 단계에서 자동으로 찾습니다.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            <div onClick={() => setProvider("azure")}
              style={{ border: `1px solid ${PRI_LINE}`, borderRadius: 12, background: "var(--app)", padding: "16px 10px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ height: 30, display: "grid", placeItems: "center", marginBottom: 8 }}><AzureMark /></div>
              <div style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)" }}>Azure</div>
              <div style={{ fontSize: "var(--fs-caption)", color: PRI_HI, marginTop: 2 }}>Entra ID SSO</div>
            </div>
            <div style={{ border: "1px solid var(--line2)", borderRadius: 12, background: "var(--app)", padding: "16px 10px", textAlign: "center", opacity: 0.45, cursor: "not-allowed", position: "relative" }}>
              <div style={{ position: "absolute", top: 8, right: 8, fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", fontWeight: 600, background: "var(--card2)", border: "1px solid var(--line2)", color: "var(--muted)", padding: "2px 6px", borderRadius: 5 }}>준비중</div>
              <div style={{ height: 30, display: "grid", placeItems: "center", marginBottom: 8, color: "#FF9900" }}>
                <svg width="30" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 11.21c0 .3.03.54.09.71.06.18.14.37.26.58.04.06.05.13.05.18 0 .08-.04.16-.15.24l-.5.34a.38.38 0 01-.21.07c-.08 0-.16-.04-.24-.11a2.5 2.5 0 01-.28-.38 6 6 0 01-.25-.47c-.62.73-1.4 1.1-2.35 1.1-.67 0-1.2-.19-1.6-.57s-.59-.9-.59-1.53c0-.68.24-1.23.73-1.65s1.13-.62 1.95-.62c.27 0 .55.02.85.06.29.04.6.1.91.18v-.58c0-.61-.12-1.03-.37-1.28-.26-.25-.69-.37-1.3-.37-.28 0-.57.04-.86.1-.3.08-.58.16-.86.28a2.3 2.3 0 01-.28.1.5.5 0 01-.13.03c-.11 0-.17-.08-.17-.25v-.39c0-.13.02-.22.06-.28a.6.6 0 01.22-.17c.28-.14.62-.26 1-.36a4.9 4.9 0 011.25-.15c.95 0 1.64.22 2.09.65.44.43.66 1.08.66 1.96v2.59zm-3.24 1.21c.26 0 .53-.05.82-.14.29-.1.54-.27.76-.51.13-.15.22-.32.27-.51.05-.2.08-.42.08-.7v-.33a6.7 6.7 0 00-.74-.14 6 6 0 00-.75-.05c-.53 0-.92.1-1.19.32-.26.21-.39.52-.39.92 0 .37.1.65.3.84.19.2.47.3.83.3zM17.7 20.99c-4.6 0-8.74-1.7-11.87-4.53-.25-.22-.02-.53.27-.35 3.38 1.96 7.56 3.15 11.88 3.15 2.91 0 6.11-.6 9.06-1.85.44-.2.81.29.38.61-2.63 1.94-6.44 2.97-9.72 2.97z" transform="translate(-1 -2)" /></svg>
              </div>
              <div style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)" }}>AWS</div>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--muted)", marginTop: 2 }}>IAM Identity Center</div>
            </div>
            <div style={{ border: "1px solid var(--line2)", borderRadius: 12, background: "var(--app)", padding: "16px 10px", textAlign: "center", opacity: 0.45, cursor: "not-allowed", position: "relative" }}>
              <div style={{ position: "absolute", top: 8, right: 8, fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", fontWeight: 600, background: "var(--card2)", border: "1px solid var(--line2)", color: "var(--muted)", padding: "2px 6px", borderRadius: 5 }}>준비중</div>
              <div style={{ height: 30, display: "grid", placeItems: "center", marginBottom: 8 }}>
                <svg width="26" height="26" viewBox="0 0 24 24"><path d="M15.96 7.33l2.09-2.09.14-.88C14.38.9 8.34 1.3 4.91 5.18a9.6 9.6 0 00-2.03 3.81l.75-.1 4.17-.69.32-.33c1.86-2.04 5-2.31 7.14-.58z" fill="#EA4335" /><path d="M21.02 8.93a9.4 9.4 0 00-2.83-4.57L15.26 7.29a5.2 5.2 0 011.9 4.13v.52a2.61 2.61 0 010 5.18h-5.22l-.51.56v3.13l.51.49h5.22a6.79 6.79 0 003.85-12.37z" fill="#4285F4" /><path d="M6.74 21.29h5.21v-4.17H6.74c-.37 0-.73-.08-1.07-.23l-.74.22-2.1 2.09-.18.71a6.76 6.76 0 004.09 1.38z" fill="#34A853" /><path d="M6.74 7.76A6.78 6.78 0 002.65 19.9l3.02-3.02a2.61 2.61 0 113.45-3.45l3.02-3.02a6.77 6.77 0 00-5.4-2.66z" fill="#FBBC05" /></svg>
              </div>
              <div style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)" }}>Google Cloud</div>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--muted)", marginTop: 2 }}>Workspace SSO</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Azure 계정 연결</div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--muted)", marginBottom: 14 }}>로그인만 해두면 다음 단계에서 구독을 골라 탐색합니다.</div>
          {busy ? (
            // 진행 중 — 스피너 + 문구, 그리고 취소. 팝업이 안 뜨거나 사용자가 닫았을 때
            // 무한 대기를 벗어날 유일한 출구다.
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "var(--app)", border: `1px solid ${PRI_LINE}`, borderRadius: 10, padding: "11px 20px", fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--navy)" }}>
                <TrailingDots size={15} color={PRI_HI} />
                로그인을 진행 중입니다…
              </div>
              <button onClick={cancel}
                style={{ background: "transparent", border: "1px solid var(--line2)", borderRadius: 8, color: "var(--muted)", fontSize: "var(--fs-caption)", fontWeight: 600, padding: "8px 16px", cursor: "pointer" }}>
                로그인 취소
              </button>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--muted)", lineHeight: 1.5, maxWidth: 300 }}>
                팝업 창이 보이지 않으면 브라우저의 팝업 차단을 확인하세요. 취소 후 다시 시도할 수 있습니다.
              </div>
            </div>
          ) : (
            <>
              <button onClick={login}
                style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#fff", color: "#1b1b1b", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: "var(--fs-body)", fontWeight: 600, cursor: "pointer" }}>
                <svg width="17" height="17" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z" /><path fill="#81bc06" d="M12 1h10v10H12z" /><path fill="#05a6f0" d="M1 12h10v10H1z" /><path fill="#ffba08" d="M12 12h10v10H12z" /></svg>
                Microsoft 계정으로 로그인
              </button>
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setProvider(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: "var(--fs-caption)", cursor: "pointer" }}>← 프로바이더 다시 선택</button>
              </div>
            </>
          )}
        </div>
      )}
      {err && <div style={{ marginTop: 10, fontSize: "var(--fs-caption)", color: "var(--red)" }}>{err}</div>}
    </div>
  );
}

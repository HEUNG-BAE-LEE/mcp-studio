/* 업무 기록: 사람이 서버 브라우저를 조작해 업무 하나를 기록하고, 검증된 업무 기능으로 만든다.
   화면 ① 목록 → ② 새 기록 → ③ 기록 중(화면 중계) → ④ 검토. 승인 창은 화면 안 요소다(브라우저 기본 대화상자를 쓰지 않는다).
   입력 원값(값 다시 입력 필요)은 서버로 보내 검증에만 쓰고 저장하지 않는다(요청이 끝나면 메모리에서도 지운다).
   전역 REC 는 discovery.js 가 쓰고 있어서, 이 파일의 상태 객체는 RECR 이다. */
const RECR = { page:'list', list:[], fns:[], usage:null, demo:null, form:null, live:null, fn:null, rec:null, busy:false, values:{}, load:'loading', loadErr:'', wheel:0, wheelQ:null, saveQ:null, regSrc:null };
const REC_STATUS = { recording:['기록 중','info'], analyzing:['분석 중','info'], verifying:['검증 중','info'], review:['검토 대기','warn'],
  confirmed:['확정','ok'], registered:['등록 완료','ok'], failed:['실패','danger'], interrupted:['중단됨','mute'] };
const REC_VERIFY = { verified:['검증됨','ok'], partial:['부분 검증','warn'], failed:['검증 실패','danger'], pending:['검증 전','mute'],
  skipped:['검증 생략','mute'], stale:['다시 검증 필요','warn'], 'needs-login':['다시 로그인 필요','warn'], 'needs-value':['값 다시 입력 필요','warn'] };
const REC_REASON = { needs_value:'값 입력 필요', unresolved_path:'값 경로를 찾지 못함', auth_expired:'로그인 만료', waf_blocked:'보안 장비가 막음',
  http_error:'HTTP 오류', shape_mismatch:'응답 모양이 다름', error_response:'오류 응답', browser_needed:'브라우저 실행 필요',
  login_failed:'로그인 실패', unexpected_error:'예상하지 못한 오류', skipped:'건너뜀', pipeline_error:'분석·검증 중 오류',
  chain_broken:'앞 단계 값을 이어받지 못함', write_denied:'쓰기 승인을 받지 못함', browser_only:'브라우저에서만 성공' };
const REC_DECISION = { approve:'승인', deny:'거부', timeout:'시간 초과', login:'로그인', sent:'보냄', staging:'스테이징', error:'승인 창 오류', 'denied-host':'차단 주소', beacon:'외부 통계 차단' };
const recHeldLabel = l => /^조회로 보이는 \S+ — /.test(l || '');                // 재실행이 조회로 분류했지만 GET 이 아니라 묻는 요청
const recIsWrite = n => n.held || n.decision === 'sent' || n.decision === 'login';
const REC_ENDED_MS = 10000;                                                   // 끝난 승인 id 를 기억하는 시간(늦게 온 같은 id 의 hold 를 무시)
const recHoldHead = L => (L.holds || [])[0] || null;                          // 가장 오래된 대기 하나만 보인다
const REC_SOURCES = [['USER_INPUT','사용자 입력'],['PREVIOUS_STEP_OUTPUT','앞 단계 결과'],['SESSION_CONTEXT','세션 값'],
  ['SYSTEM_CONFIG','설정값'],['DERIVED','계산 값'],['CONSTANT','고정값']];
const recPill = (map, k) => { const v = map[k] || [k || '-', 'mute']; return `<span class="pill rec-${v[1]}">${esc(v[0])}</span>`; };
const recReason = c => REC_REASON[c] || c;                                     // 모르는 사유는 코드를 그대로 보인다
const recDecision = c => REC_DECISION[c] || c;
const recErr = e => toast(esc(e.message), 'warn');                              // toast 는 innerHTML 이라 서버 문구도 거른다
const recSteps = f => f.steps.filter(s => !s.skip);

async function recRefresh() {
  if (RECR.page === 'live' && RECR.live) {                                      // 다른 메뉴를 다녀온 기록 화면: 중계를 다시 붙인다
    render(); recBind();
    if (RECR.live.status === 'recording' && RECR.live.token) recWs.open(RECR.live.id, RECR.live.token);
    return;
  }
  try {
    const d = await api.get('/recorder/');
    RECR.list = d.recordings; RECR.fns = d.functions; RECR.usage = d.usage; RECR.demo = d.demo; RECR.load = 'ok';
    if (S.view === 'rec' && RECR.page === 'list') render();
  } catch (e) {
    RECR.load = 'error'; RECR.loadErr = e.message; RECR.usage = null;                 // 못 불러왔으면 빈 목록처럼 보이지 않게 오류 상태로 둔다
    if (S.view === 'rec' && RECR.page === 'list') render();
    recErr(e);
  }
}

function vRec() {
  if (RECR.page === 'new' && RECR.form) return pageHead('rec') + recNewHTML();
  if (RECR.page === 'live' && RECR.live) return recLiveHTML();
  if (RECR.page === 'review' && RECR.fn) return pageHead('rec') + recReviewHTML();
  return pageHead('rec') + recListHTML();
}

/* 검토 화면은 다시 그리면 "값 다시 입력" 칸이 비므로, 메모리에 있는 값을 칸에 되돌린다(저장소에는 두지 않는다) */
function recRender() {
  render();
  $$('input[data-inp="recVal"]').forEach(el => { el.value = RECR.values[el.dataset.n] || ''; });
}

/* ① 목록 */
function recListHTML() {
  const fnBy = Object.fromEntries(RECR.fns.map(f => [f.id, f]));
  const u = RECR.usage;                                                    // 불러오기 전이거나 실패했으면 null — 숫자 줄을 그리지 않는다
  const who = u ? Object.entries(u.byOwner).map(([k, v]) => `${esc(k)} ${+v}개`).join(', ') : '';
  const rows = RECR.list.map(r => {
    const f = r.functionId ? fnBy[r.functionId] : null;
    const kinds = f ? [...new Set(f.steps.map(s => s.kind === 'html' ? 'HTML' : 'JSON'))].join('·') : '';
    return `<tr data-act="recOpen" data-id="${esc(r.id)}" tabindex="0"><td><b>${esc(r.name)}</b><small>${esc(r.owner || '')} · ${r.env === 'op' ? '운영' : '스테이징'}</small></td>
      <td>${recPill(REC_STATUS, f && ['confirmed', 'registered'].includes(f.status) ? f.status : r.status)} ${f ? recPill(REC_VERIFY, f.verification.status) : ''}
</td>
      <td>${f && f.status === 'registered' ? `도구 ${((f.registered || {}).tools || []).length}개` : ''}</td><td>${f ? `${recSteps(f).length}단계` : ''}</td><td>${esc(kinds)}</td><td>${+r.spanCount || 0}개 행동</td></tr>`;
  }).join('');
  return `<div class="rec-bar"><button class="btn primary" data-act="recNew">${svg('plus', 16)}새 기록</button>
    ${u ? `<span class="rec-hint">지금 기록 중 ${+u.total}/${+u.max}개${who ? ` (${who})` : ''} · 사람당 ${+u.perOwner}개</span>` : ''}</div>
    ${RECR.load === 'loading' ? '<div class="md-empty">기록 목록을 불러오는 중입니다…</div>'
      : RECR.load === 'error' ? `<div class="md-empty">기록 목록을 불러오지 못했습니다. ${esc(RECR.loadErr)}<br><button class="btn sm" data-act="recRetry">다시 불러오기</button></div>`
      : RECR.list.length ? `<table class="tbl rec-list"><thead><tr><th>업무</th><th>상태</th><th>작업 유형</th><th>단계</th><th>응답</th><th>기록</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="md-empty">아직 기록한 업무가 없습니다. <b>새 기록</b>을 눌러 업무 하나를 기록해 보세요.</div>'}`;
}

/* ② 새 기록 */
function recNewHTML() {
  const f = RECR.form;
  const inp = (k, ph, o = {}) => `<input class="inp ${o.mono ? 'mono' : ''}" ${o.type ? `type="${o.type}"` : ''} data-inp="recF" data-k="${k}" value="${esc(f[k] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
  return `<div class="card rec-form">
    <div class="field"><label>업무 이름</label>${inp('name', '9월 발주 상세 조회')}</div>
    <div class="field"><label>대상 시스템 주소</label>${inp('base', 'http://10.20.4.30:8080/po', { mono:1 })}<small>기록을 시작할 기준점입니다. 업무 중 다른 시스템으로 넘어가도 막지 않고 함께 기록합니다.</small></div>
    <div class="field"><label>시작 화면 (선택)</label>${inp('start', '/login.do', { mono:1 })}</div>
    <div class="field"><label>환경</label><div class="rec-env">
      <label><input type="radio" name="recEnv" data-chg="recEnv" value="op" ${f.env === 'op' ? 'checked' : ''}> 운영 — 기록하며 한 동작은 실제로 반영됩니다. 재실행 검증의 쓰기만 승인받습니다</label>
      <label><input type="radio" name="recEnv" data-chg="recEnv" value="stg" ${f.env === 'stg' ? 'checked' : ''}> 스테이징 — 기록과 재실행 모두 승인 없이 보냅니다</label></div></div>
    <div class="field"><label>서비스 계정 (선택)</label><div class="two">${inp('account', '아이디')}${inp('password', '비밀번호', { type:'password' })}</div>
      <small>비우거나 자동 로그인이 실패하면 기록 화면에서 직접 로그인합니다. 직접 로그인한 비밀번호는 저장하지 않습니다.</small></div>
    <div class="field"><label>기록하는 사람</label>${inp('owner', '홍길동')}<small>동시 기록 상한을 사람마다 셉니다.</small></div>
    <div class="rec-actions"><button class="btn" data-act="recBack">취소</button>${RECR.demo ? '<button class="btn" data-act="recDemo">시연용 값 채우기</button>' : ''}
      <button class="btn primary" data-act="recStart" ${RECR.busy ? 'disabled' : ''}>${RECR.busy ? '브라우저를 띄우는 중…' : '기록 시작'}</button></div></div>`;
}

/* ③ 기록 중. 캔버스와 입력 칸(#recIme)은 한 번 만든 뒤 바꾸지 않는다 — 한글 조합 중에 다시 만들면 입력이 끊긴다.
   메시지가 올 때는 상단 줄·안내·승인 창·타임라인 영역의 안쪽만 바꾼다(recPatch). */
function recTopHTML(L) {
  const tabs = L.tabs.length > 1 ? `<span class="rec-tabs">${L.tabs.map(t => `<button class="btn sm ${+t.index === +L.active ? 'primary' : ''}" data-act="recTab" data-i="${+t.index}">${esc((t.title || t.url || '탭').slice(0, 14))}</button>`).join('')}</span>` : '';
  return `<span class="dot"></span><b>${L.status === 'recording' ? (L.paused ? '일시정지' : '기록 중') : esc((REC_STATUS[L.status] || [L.status])[0])}</b>
      <span>${esc(L.name)}</span><span class="env">${L.env === 'op' ? '운영' : '스테이징'}</span>${tabs}
      <span class="sp"></span>${L.status === 'recording' ? `<button class="btn sm" data-act="recPause">${L.paused ? '다시 기록' : '일시정지'}</button>
      <button class="btn sm primary" data-act="recStop">기록 종료</button>` : '<button class="btn sm" data-act="recBack">목록으로</button>'}`;
}
const recMsgHTML = L => L.msg ? `<div class="rec-msg">${esc(L.msg)}</div>` : '';
function recOverlayHTML(L) {
  const H = recHoldHead(L), more = (L.holds || []).length - 1;
  return (H ? `<div class="rec-hold" role="dialog" aria-modal="true"><b>${svg('lock', 16)} 쓰기 요청 승인</b>${recHeldLabel(H.label) ? ' <span class="pill rec-warn">조회로 보이는 POST</span>' : ''}
        <p>"${esc(H.label || '알 수 없는 버튼')}" → <code>${esc(H.method)} ${esc(H.path)}</code></p>
        ${more > 0 ? `<p class="muted">대기 ${more}건 더</p>` : ''}
        <p>재실행 검증이 보내려는 요청입니다. 운영 데이터가 바뀝니다. 2분 안에 답하지 않으면 보내지 않습니다.</p>
        <button class="btn danger-fill" data-act="recApprove" data-ok="1">승인하고 보내기</button> <button class="btn" data-act="recApprove" data-ok="0">보내지 않기</button></div>` : '')
    + (L.dialog ? `<div class="rec-hold" role="dialog" aria-modal="true"><b>대상 사이트의 확인 창</b><p>${esc(L.dialog.message)}</p>
        <button class="btn primary" data-act="recDialog" data-ok="1">확인</button> ${L.dialog.type !== 'alert' ? '<button class="btn" data-act="recDialog" data-ok="0">취소</button>' : ''}</div>` : '');
}
function recSideHTML(L) {
  const tl = L.spans.slice(-60).map(s => `<li><b>${+s.seq}</b> ${esc(((s.action.target || {}).text || s.action.label || s.action.type || '').slice(0, 24))}
      ${s.network.map(n => `<div class="${recIsWrite(n) ? 'w' : ''}">${esc(n.method)} ${esc(n.path)} ${n.status == null ? '' : esc(n.status)}${n.kind === 'html' ? ' · HTML' : ''}${n.decision ? ` · ${esc(recDecision(n.decision))}` : ''}</div>`).join('')}</li>`).join('');
  const blocked = L.blocked.slice(-5).map(b => `<li class="b">차단(서버 보호) ${esc(b.why)} — ${esc(b.url)}</li>`).join('');
  return `<div class="label">타임라인</div><ol class="rec-tl">${tl || '<li class="mute">화면을 클릭하면 여기에 쌓입니다</li>'}${blocked}</ol>
      <div class="rec-count">요청 ${L.spans.reduce((a, s) => a + s.network.length, 0)} · 쓰기 ${L.spans.reduce((a, s) => a + s.network.filter(recIsWrite).length, 0)} · 차단 ${L.blocked.length}</div>`;
}
function recLiveHTML() {
  const L = RECR.live;
  return `<div class="rec-live" data-rid="${esc(L.id)}">
    <div class="rec-top ${L.env === 'op' ? 'op' : ''}" id="recTop">${recTopHTML(L)}</div>
    <div id="recMsg">${recMsgHTML(L)}</div>
    <div class="rec-body"><div class="rec-screen"><canvas id="recCv" width="960" height="600"></canvas>
      <textarea id="recIme" autocomplete="off" aria-label="키보드 입력"></textarea>
      <div id="recOv">${recOverlayHTML(L)}</div>
    </div>
    <aside class="rec-side" id="recSide">${recSideHTML(L)}</aside></div></div>`;
}

/* ④ 검토 */
function recReviewHTML() {
  const f = RECR.fn, v = f.verification || {}, rid = f.source.recordingId, active = recSteps(f);
  const inputs = f.inputs.map(i => `<tr class="${i.confidence === 'low' || i.needsValue ? 'low' : ''}"><td class="mono">${esc(i.name)}</td><td>${esc(i.screenLabel || '-')}</td>
      <td><select class="inp sm" data-chg="recSrc" data-n="${esc(i.name)}" aria-label="${esc(i.name)} 출처">${REC_SOURCES.map(([k, l]) => `<option value="${k}" ${i.source === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${i.confidence === 'low' ? '<span class="pill rec-warn">확인 필요</span>' : ''}</td>
      <td class="mono">${i.needsValue ? `<input class="inp sm" type="password" autocomplete="off" data-inp="recVal" data-n="${esc(i.name)}" placeholder="${esc(i.ex || '검증할 값')}" aria-label="${esc(i.name)} 검증할 값"><small>값 다시 입력 필요 · 저장하지 않습니다</small>` : esc(i.ex)}</td></tr>`).join('');
  const ev = (seq, w) => seq ? `<img class="rec-shot" alt="행동 ${seq} ${w}" src="/api/ieum/recorder/recordings/${esc(rid)}/shots/${seq}-${w}.jpg" data-rid="${esc(rid)}" data-seq="${+seq}">` : '';
  const nameOnly = s => !s.write && !['GET', 'HEAD'].includes(String(s.method).toUpperCase()) && s.writeWhy !== '사람이 지정';
  const steps = f.steps.map((s, i) => { const seq = (f.evidence[s.id] || [])[0];
    return `<div class="rec-step ${s.skip ? 'skip' : ''}"><b>${esc(s.id)} · ${s.role === 'core' ? '핵심' : '선행'}</b>${s.skip ? ' <span class="pill rec-mute">건너뜀</span>' : ''}
      <span class="pill ${s.write ? 'rec-warn' : 'rec-mute'}">${s.write ? '쓰기' : '조회'}</span>
      <span class="pill rec-mute">${s.kind === 'html' ? 'HTML 표' : s.kind === 'json' ? 'JSON' : '기타'}</span> <span class="pill rec-mute">${s.exec === 'browser' ? '브라우저 실행' : 'HTTP'}</span>
      <div class="rec-step-ctl"><button class="btn sm" data-act="recStepMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(s.id)} 앞으로">↑</button>
        <button class="btn sm" data-act="recStepMove" data-i="${i}" data-d="1" ${i === f.steps.length - 1 ? 'disabled' : ''} aria-label="${esc(s.id)} 뒤로">↓</button>
        <button class="btn sm" data-act="recStepWrite" data-i="${i}" aria-label="${esc(s.id)} ${s.write ? '조회로 바꾸기' : '쓰기로 바꾸기'}">${s.write ? '조회로 바꾸기' : '쓰기로 바꾸기'}</button>
        <button class="btn sm" data-act="recStepSkip" data-i="${i}">${s.skip ? '다시 쓰기' : '건너뛰기'}</button></div>
      ${nameOnly(s) ? `<button class="btn sm" data-act="recStepConfirmRead" data-i="${i}" aria-label="${esc(s.id)} 조회로 확정">조회로 확정</button><br><small class="rec-why">이름으로만 조회로 판정됨 — 확정하기 전에는 확인을 받는 도구로 등록됩니다</small><br>` : ''}
      ${s.writeWhy ? `<small class="rec-why">${s.write ? '쓰기' : '조회'}로 본 이유: ${esc(s.writeWhy)}</small><br>` : ''}
      <div class="mono">${esc(s.method)} ${esc(s.path)}${s.discriminator ? ` (${esc(s.discriminator)})` : ''}</div>
      ${s.base !== f.source.base ? `<small>다른 시스템: ${esc(s.base)}</small><br>` : ''}
      ${Number.isInteger(s.pickedIndex) ? `<small>기록 때 고른 결과: ${s.pickedIndex + 1}번째${s.pickedRow ? ` · ${esc(String(s.pickedRow).slice(0, 40))}` : ''}</small><br>` : ''}
      ${s.params.map(p => `<small>${esc(p.a)} ← ${esc(p.from)}${p.confidence === 'low' ? ' ⚠' : ''}</small>`).join('<br>')}
      ${Object.keys(s.outputs).length ? `<br><small>꺼내는 값: ${Object.entries(s.outputs).map(([k, p]) => `${esc(k)}=${esc(p)}`).join(', ')}</small>` : ''}
      <div class="rec-shots">${ev(seq, 'pre')}${ev(seq, 'post')}</div></div>`; }).join('');
  const excl = f.excluded.map(x => `<li><code>${esc(x.method)} ${esc(x.path)}</code> · ${esc(x.role)} — ${esc(x.why)}
      ${['auth', 'denied'].includes(x.role) ? '' : `<button class="btn sm" data-act="recPromote" data-m="${esc(x.method)}" data-p="${esc(x.path)}">단계로 올리기</button>`}</li>`).join('');
  const runs = (v.runs || []).map(r => {
    const bad = (r.steps || []).filter(s => s.ok === false);
    return `<li>${r.ok === true ? '✅' : r.ok === false ? '❌' : '⏭'} ${r.kind === 'same-values' ? '같은 값' : '다른 값'}
      ${r.reason ? `<small>${esc(recReason(r.reason))}</small>` : ''}${r.note ? `<small>${esc(recReason(r.note))}</small>` : ''}
      ${bad.map(s => `<div class="rec-run-step"><small>${esc(s.id)}: ${esc(recReason(s.reason || 'error_response'))}${s.note ? ` — ${esc(s.note)}` : ''}</small></div>`).join('')}</li>`; }).join('');
  const apAll = (RECR.rec || {}).approvals || [], apBeacon = apAll.filter(a => a.decision === 'beacon').length;
  const sentAll = apAll.filter(a => a.decision === 'sent'), pend = +((RECR.rec || {}).pendingWrites) || 0, dropped = +((RECR.rec || {}).approvalsDropped) || 0;
  const at = a => a.at ? new Date(a.at * 1000).toLocaleTimeString('ko-KR') : '';
  const sentList = sentAll.map(a => `<li><code>${esc(a.method)} ${esc(a.url || a.path)}</code> · ${esc(a.label || '동작 이름 없음')} <small>${esc(at(a))}</small></li>`).join('');
  const aps = apAll.filter(a => !['beacon', 'sent', 'login'].includes(a.decision)).map(a => `<li><code>${esc(a.method)} ${esc(a.path)}</code> · ${esc(recDecision(a.decision))}${a.decision === 'deny' && a.label === '기록 종료 중' ? ` (${esc(a.label)})` : ''}</li>`).join('')
    + (apBeacon ? `<li class="muted">외부 통계 ${apBeacon}종 차단 (횟수가 아니라 주소 종류 수)</li>` : '');
  const reg = f.registered, blockers = f.flowBlockers || [];
  const regSid = RECR.regSrc || (reg ? Object.keys(TOOLS).find(sid => TOOLS[sid].some(t => (reg.tools || []).includes(t.id))) : null);   // 다시 연 기능은 도구 id 로 원본을 찾는다
  const regCard = reg
    ? `<div class="label">도구 후보로 등록</div><div>등록 완료 · 도구 ${(reg.tools || []).length}개</div>
       <button class="btn primary" data-act="goSrc" data-id="${esc(regSid || '')}" ${regSid && SRC[regSid] ? '' : 'disabled'}>변환 스튜디오 열기</button>
       <button class="btn sm" data-act="recRegister" data-m="${esc(reg.mode || 'flow')}">다시 등록</button>`
    : `<div class="label">도구 후보로 등록</div>
       <button class="btn primary" data-act="recRegister" data-m="flow" ${blockers.length ? 'disabled' : ''}>도구 후보로 등록</button>
       ${blockers.map(b => `<br><small>${esc(b)}</small>`).join('')}
       <br><button class="btn sm" data-act="recRegister" data-m="steps" ${active.length ? '' : 'disabled'}>단계별로 등록</button>`;
  return `<div class="rec-rv-head"><div><h3>${esc(f.name)}</h3>${recPill(REC_VERIFY, v.status)}</div>
    <div><button class="btn" data-act="recBack">목록</button> <button class="btn" data-act="recVerify" ${RECR.busy ? 'disabled' : ''}>${RECR.busy ? '검증하는 중…' : '다시 검증'}</button></div></div>
    ${(f.notes || []).map(n => `<div class="rec-msg">${esc(n)}</div>`).join('')}
    <div class="rec-rv"><div>
      <div class="label">설명 (AI 가 이 업무를 고를 때 읽습니다)</div>
      <textarea class="inp rec-desc" data-chg="recDesc" rows="2" aria-label="업무 설명">${esc(f.desc || '')}</textarea>
      <div class="label">입력값</div>
      <table class="tbl"><thead><tr><th>이름</th><th>화면 라벨</th><th>출처</th><th>기록 값</th></tr></thead><tbody>${inputs || '<tr><td colspan="4" class="mute">입력값이 없습니다</td></tr>'}</tbody></table>
      <div class="label">단계 (위에서 아래 순서로 실행합니다. 건너뛴 단계는 보관만 하고 되돌릴 수 있습니다)</div><div class="rec-steps">${steps || '<div class="md-empty">단계가 없습니다. 아래에서 업무에 해당하는 요청을 단계로 올려 주세요.</div>'}</div>
      <details ${f.steps.length ? '' : 'open'}><summary class="label">단계에 넣지 않은 요청 (${f.excluded.length})</summary><ul class="rec-excl">${excl}</ul></details>
    </div><aside>
      <div class="card"><div class="label">검증 ${recPill(REC_VERIFY, v.status)}${v.reason ? ` <small>${esc(recReason(v.reason))}</small>` : ''}</div><ul class="rec-runs">${runs}</ul></div>
      <div class="card"><div class="label">기록 중 실제로 보낸 쓰기</div>
        ${pend ? `<div class="rec-msg">응답을 받지 못한 쓰기 ${pend}건이 있습니다. 서버에는 이미 나갔을 수 있으니 반영 여부를 확인해 주세요.</div>` : ''}
        ${sentList ? `<ul class="rec-runs">${sentList}</ul>${dropped ? `<small class="mute">이 밖에 ${dropped}건은 개수만 셌습니다.</small>` : ''}` : '<small class="mute">기록 중 보낸 쓰기가 없습니다.</small>'}</div>
      ${aps ? `<div class="card"><div class="label">재실행 쓰기 승인 기록</div><ul class="rec-runs">${aps}</ul></div>` : ''}
      <div class="card">${regCard}</div>
      <small class="mute">등록하면 화면 캡처를 지웁니다. 이후 근거는 가린 화면 글자로 보여 줍니다.</small>
    </aside></div>`;
}

/* 캡처 이미지가 없으면(확정 뒤 삭제) 같은 자리에 "화면 글자 보기" 버튼을 둔다. error 는 버블링하지 않아 캡처 단계에서 받는다 */
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('rec-shot')) return;
  const b = document.createElement('button');
  b.className = 'btn sm'; b.textContent = '화면 글자 보기'; b.dataset.act = 'recAriaOpen'; b.dataset.rid = img.dataset.rid; b.dataset.seq = img.dataset.seq;
  img.replaceWith(b);
}, true);

async function recAria(rid, seq) {
  try {
    const d = await api.get(`/recorder/recordings/${rid}/spans/${seq}/`);
    openModal(`행동 ${seq} 화면 글자`, `<div class="label">직전 — ${esc(d.pre.title || d.pre.url || '')}</div><pre class="rec-aria">${esc(d.pre.aria || '')}</pre>
      <div class="label">직후 — ${esc(d.post.title || d.post.url || '')}</div><pre class="rec-aria">${esc(d.post.aria || '')}</pre>`, null, null, { wide:true, cancel:'닫기' });
  } catch (e) { recErr(e); }
}

/* 화면 중계. 토큰이 틀리면 서버가 연 뒤 4403 으로 닫는다 — 이때는 다시 붙이지 않는다 */
const recWs = {
  sock:null, tries:0,
  open(id, token) {
    this.close();
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ieum/recorder/ws/${id}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url); this.sock = ws;
    ws.onmessage = ev => {
      this.tries = 0;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      try { recOnMsg(m); } catch (e) { console.error('업무 기록 화면 갱신 오류', e); }       // 파싱 실패만 조용히 넘기고, 처리 오류는 드러낸다
    };
    ws.onclose = ev => {
      if (this.sock !== ws) return;
      this.sock = null;
      const L = RECR.live; if (!L || L.id !== id) return;
      if (ev.code === 4403) { L.msg = '접속 권한이 없습니다. 이 기록은 시작한 브라우저 탭에서만 화면을 열 수 있습니다.'; L.token = null; recPatch(); return; }
      if (L.status !== 'recording') return;
      if (++this.tries > 15) { L.msg = '연결을 다시 맺지 못했습니다. 목록으로 나가 기록을 다시 열어 주세요.'; recPatch(); return; }
      L.msg = '연결이 끊겼습니다. 기록은 서버에서 계속됩니다. 다시 연결하는 중…'; recPatch();
      setTimeout(() => RECR.live && RECR.live.id === id && !this.sock && this.open(id, token), 2000);
    };
  },
  send(m) { if (this.sock && this.sock.readyState === 1) { this.sock.send(JSON.stringify(m)); return true; } return false; },
  close() { if (this.sock) { const s = this.sock; this.sock = null; try { s.close(); } catch (e) {} } },
};

function recOnMsg(m) {
  const L = RECR.live; if (!L) return;
  if (m.t === 'frame') { const img = new Image(); img.onload = () => { const cv = $('#recCv'); if (cv) cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); }; img.src = 'data:image/jpeg;base64,' + m.data; return; }
  if (L.msg && L.msg.startsWith('연결이 끊겼습니다')) L.msg = '';
  if (m.t === 'span') L.spans.push(m);
  else if (m.t === 'hold') {
    const now = Date.now(); for (const k of Object.keys(L.ended)) if (now - L.ended[k] > REC_ENDED_MS) delete L.ended[k];
    if (!(m.id in L.ended) && !L.holds.some(h => h.id === m.id)) L.holds.push(m);       // 이미 끝난 id 의 늦은 재전송은 무시
  }
  else if (m.t === 'hold-end') { L.holds = L.holds.filter(h => h.id !== m.id); L.ended[m.id] = Date.now(); if (m.decision === 'timeout') toast('응답이 없어 쓰기 요청을 보내지 않았습니다.', 'warn'); }
  else if (m.t === 'blocked') L.blocked.push(m);
  else if (m.t === 'dialog') L.dialog = m;
  else if (m.t === 'tabs') { L.tabs = m.tabs; L.active = m.active; }
  else if (m.t === 'login' || m.t === 'notice') L.msg = m.msg;
  else if (m.t === 'limit') L.msg = '행동 기록 상한(300개)에 도달했습니다. 기록을 종료해 주세요.';
  else if (m.t === 'status') {
    if (m.status === 'closed') return;                       // 정리 신호다. 상태를 덮지 않는다
    L.status = m.status; if (m.status === 'review') { recOpenFn(L.id); return; }
    if (m.status === 'failed' || m.status === 'interrupted') L.msg = (m.status === 'failed' ? '분석·검증에 실패했습니다. ' : '기록이 중단되었습니다. ') + (m.error || ''); }
  recPatch();
}

function recPatch() {
  if (S.view !== 'rec' || RECR.page !== 'live' || !RECR.live) return;
  const L = RECR.live, root = $('.rec-live');
  if (!root || root.dataset.rid !== L.id || !$('#recCv')) { render(); recBind(); return; }      // 틀이 없을 때만 통째로 그린다
  const set = (id, html) => { const el = $(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
  const top = $('#recTop'); if (top) top.className = 'rec-top' + (L.env === 'op' ? ' op' : '');
  set('#recTop', recTopHTML(L)); set('#recMsg', recMsgHTML(L)); set('#recOv', recOverlayHTML(L));
  const side = $('#recSide'), keep = side ? side.scrollTop : 0;
  set('#recSide', recSideHTML(L)); if (side) side.scrollTop = keep;
  const ime = $('#recIme');                                   // 승인 창이 닫혔으면 입력 칸으로 돌아온다(조합 중이거나 다른 입력에 있으면 건드리지 않는다)
  if (ime && !recHoldHead(L) && !L.dialog && (document.activeElement === document.body || !document.activeElement)) ime.focus();
}

function recBind() {
  const cv = $('#recCv'), ime = $('#recIme'); if (!cv || !ime) return;
  const box = () => cv.getBoundingClientRect();
  cv.onmousedown = e => { if (recHoldHead(RECR.live) || RECR.live.dialog) return; const r = box(); recWs.send({ t:'click', x:e.clientX - r.left, y:e.clientY - r.top, w:r.width, h:r.height }); setTimeout(() => ime.focus(), 0); };
  cv.onwheel = e => {                                          // 한 프레임에 받은 휠은 모아서 한 번만 보낸다
    e.preventDefault(); const r = box();
    RECR.wheel += e.deltaY; RECR.wheelQ = { x:e.clientX - r.left, y:e.clientY - r.top, w:r.width, h:r.height };
    if (RECR.wheelRaf) return;
    RECR.wheelRaf = requestAnimationFrame(() => { const q = RECR.wheelQ, dy = RECR.wheel; RECR.wheel = 0; RECR.wheelRaf = 0; if (q && dy) recWs.send({ t:'wheel', x:q.x, y:q.y, w:q.w, h:q.h, dy }); });
  };
  ime.oncompositionend = e => { if (e.data) recWs.send({ t:'text', data:e.data }); ime.value = ''; };
  ime.oninput = e => { if (!e.isComposing && e.inputType === 'insertText' && e.data) { recWs.send({ t:'text', data:e.data }); ime.value = ''; } };
  ime.onkeydown = e => { if (e.isComposing) return; if (['Enter','Backspace','Tab','Escape','Delete','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); recWs.send({ t:'key', key:e.key }); } };
  if (!recHoldHead(RECR.live) && !RECR.live.dialog) ime.focus();
}

async function recOpenFn(rid) {
  try {
    const r = await api.get(`/recorder/recordings/${rid}/`);
    if (!r.functionId) { toast('아직 업무 기능이 만들어지지 않았습니다.', 'info'); return; }
    RECR.fn = await api.get(`/recorder/functions/${r.functionId}/`);
    RECR.rec = r; RECR.values = {};
    recWs.close(); RECR.live = null; RECR.page = 'review'; render();
  } catch (e) { recErr(e); }
}

/* 저장은 한 줄로 세운다. patch 가 함수면 보낼 차례가 왔을 때의 최신 업무 기능으로 몸통을 만든다 —
   앞 저장의 응답이 오기 전에 누른 단계 편집이 낡은 단계 목록을 보내 앞 변경을 덮어쓰던 것을 막는다 */
function recSaveFn(patch) {
  const fid = RECR.fn.id;
  RECR.saveQ = (RECR.saveQ || Promise.resolve()).then(async () => {
    if (!RECR.fn || RECR.fn.id !== fid) return;                  // 다른 업무로 옮겨 갔으면 낡은 편집을 보내지 않는다
    const body = typeof patch === 'function' ? patch(RECR.fn) : patch;
    if (!body) return;
    try { const fn = await api.put(`/recorder/functions/${fid}/`, body); if (RECR.fn && RECR.fn.id === fid) RECR.fn = fn; recRender(); }
    catch (e) { recErr(e); recRender(); }                        // 거절되면 화면의 선택을 서버 값으로 되돌린다
  });
  return RECR.saveQ;
}

/* 단계 편집: 누른 순간의 순번이 아니라 단계 id 로 찾아, 차례가 왔을 때의 목록에 적용한다. edit 가 false 를 돌려주면 보내지 않는다 */
const recStepEdit = (i, edit) => {
  const id = RECR.fn.steps[i].id;
  return recSaveFn(fn => {
    const list = recStepsBody(fn.steps), k = fn.steps.findIndex(s => s.id === id);
    return k < 0 || edit(list, k, fn) === false ? null : { steps:list };
  });
};

/* 단계 순서·건너뛰기는 현재 단계 전체를 {id, skip} 으로. write 는 사람이 바꾼 그 단계에만 싣는다(실으면 서버가 "사람이 지정"으로 남기므로 나머지에는 싣지 않는다) — 보낸다(빠뜨린 단계가 있으면 서버가 400 으로 거절한다) */
const recStepsBody = list => list.map(s => ({ id:s.id, skip:!!s.skip }));

const recNewLive = (id, name, env, token) => ({ id, name, env, token, status:'recording', spans:[], blocked:[], tabs:[], active:0, holds:[], ended:{}, dialog:null, paused:false, msg:'' });

Object.assign(INP, {
  recF: el => { RECR.form[el.dataset.k] = el.value; },
  recVal: el => { RECR.values[el.dataset.n] = el.value; },
});
Object.assign(CHG, {
  recEnv: el => { RECR.form.env = el.value; },
  recSrc: el => recSaveFn({ inputs:[{ name:el.dataset.n, source:el.value }] }),
  recDesc: el => recSaveFn({ desc:el.value }),
});
Object.assign(ACT, {
  recNew: () => { RECR.form = { name:'', base:'', start:'', env:'op', account:'', password:'', owner:WS.user || '' }; RECR.page = 'new'; render(); },
  recBack: () => { recWs.close(); RECR.page = 'list'; RECR.live = null; RECR.fn = null; RECR.rec = null; RECR.form = null; RECR.values = {}; render(); recRefresh(); },
  recDemo: () => { Object.assign(RECR.form, RECR.demo); render(); },
  recStart: async () => {
    RECR.busy = true; render();
    try {
      const out = await api.post('/recorder/recordings/', RECR.form);
      RECR.live = recNewLive(out.id, RECR.form.name, RECR.form.env, out.token);
      RECR.form.password = '';                                   // 서비스 계정 비밀번호는 서버로 넘어갔으니 화면 메모리에서 지운다
      RECR.page = 'live'; RECR.busy = false; render(); recBind(); recWs.open(out.id, out.token);
      try { sessionStorage.setItem('ieum.rec.' + out.id, out.token); } catch (e) {}
    } catch (e) { RECR.busy = false; render(); recErr(e); }
  },
  recOpen: a => { const r = RECR.list.find(x => x.id === a.dataset.id); if (!r) return;
    if (r.status === 'recording') { let tok = null; try { tok = sessionStorage.getItem('ieum.rec.' + r.id); } catch (e) {}
      if (!tok) { toast('이 기록은 다른 탭에서 시작되어 이 탭에서는 화면을 열 수 없습니다.', 'info'); return; }
      RECR.live = recNewLive(r.id, r.name, r.env, tok); RECR.page = 'live'; render(); recBind(); recWs.open(r.id, tok); return; }
    recOpenFn(r.id); },
  recPause: () => { RECR.live.paused = !RECR.live.paused; recWs.send({ t:'pause', on:RECR.live.paused }); recPatch(); },
  recStop: async () => {                                         // 종료 대기 안내("저장 요청 N건…")가 중계로 먼저 오므로 안내를 먼저 깔고 응답 뒤에 덮지 않는다
    const L = RECR.live, first = '기록을 마무리하는 중입니다. 보낸 저장 요청이 끝나기를 기다릴 수 있습니다…'; L.msg = first; recPatch();
    try { await api.post(`/recorder/recordings/${L.id}/stop/`); if (L.status === 'recording') L.status = 'analyzing'; if (L.msg === first || !L.msg) L.msg = '기록을 마쳤습니다. 분석하고 다시 실행해 검증하는 중입니다…'; recPatch(); } catch (e) { recErr(e); } },
  recApprove: a => { const H = recHoldHead(RECR.live); if (!H) return;
    if (!recWs.send({ t:'approve', id:H.id, ok:a.dataset.ok === '1' })) { toast('연결이 끊겨 승인을 보내지 못했습니다. 연결되면 다시 눌러 주세요.', 'warn'); return; }   // 못 보냈으면 창을 닫지 않는다
    RECR.live.holds.shift(); RECR.live.ended[H.id] = Date.now(); recPatch(); },
  recDialog: a => {
    if (!recWs.send({ t:'dialog', ok:a.dataset.ok === '1' })) { toast('연결이 끊겨 답을 보내지 못했습니다. 연결되면 다시 눌러 주세요.', 'warn'); return; }
    RECR.live.dialog = null; recPatch(); },
  recTab: a => recWs.send({ t:'tab', index:+a.dataset.i }),
  recRetry: () => { RECR.load = 'loading'; render(); recRefresh(); },
  recAriaOpen: a => recAria(a.dataset.rid, +a.dataset.seq),
  recPromote: a => recSaveFn({ promote:{ method:a.dataset.m, path:a.dataset.p } }),
  recStepMove: a => recStepEdit(+a.dataset.i, (list, k) => {
    const j = k + +a.dataset.d;
    if (j < 0 || j >= list.length) return false;
    [list[k], list[j]] = [list[j], list[k]];
  }),
  recStepWrite: a => recStepEdit(+a.dataset.i, (list, k, fn) => { list[k].write = !fn.steps[k].write; }),
  recStepConfirmRead: a => recStepEdit(+a.dataset.i, (list, k) => { list[k].write = false; }),
  recStepSkip: a => recStepEdit(+a.dataset.i, (list, k) => { list[k].skip = !list[k].skip; }),
  recVerify: async () => {
    if (RECR.busy) return;
    await RECR.saveQ;                                             // 아직 나가는 중인 편집이 반영된 단계로 검증한다
    if (RECR.busy || !RECR.fn) return;
    const need = RECR.fn.inputs.filter(i => i.needsValue && !RECR.values[i.name]);
    if (need.length) { toast(`값을 먼저 입력해 주세요: ${esc(need.map(i => i.name).join(', '))}`, 'warn'); return; }
    const values = Object.assign({}, RECR.values);                // 이름으로 묶어 보낸다
    RECR.busy = true; recRender();
    try { RECR.fn = await api.post(`/recorder/functions/${RECR.fn.id}/verify/`, { values }); toast('다시 검증했습니다.', 'ok'); }
    catch (e) { recErr(e); }                                      // 409(진행 중)도 문구만 보이고 자동으로 다시 시도하지 않는다
    finally { RECR.busy = false; RECR.values = {}; for (const k in values) values[k] = ''; recRender(); }   // 입력 원값은 요청이 끝나면 지운다
  },
  recRegister: async a => {
    await RECR.saveQ;                                             // 저장 중인 편집이 끝난 뒤 등록한다
    try {
      const out = await api.post(`/recorder/functions/${RECR.fn.id}/register/`, { mode:a.dataset.m });
      RECR.fn = out.function;
      RECR.regSrc = ((out.tools || [])[0] || {}).src || ((out.sources || [])[0] || {}).id || null;
      await loadAll().catch(() => {});                            // 새 원본·도구를 스튜디오가 읽는 전역(SRC·TOOLS)에 반영한다
      recRender();
      const unknown = Object.values(out.loginKnown || {}).some(v => !v);        // 원본 시스템별 {id: bool}. 객체는 항상 참이라 값을 본다
      toast(`도구 후보 ${out.tools.length}개를 등록했습니다. 변환 스튜디오에서 설명과 매핑을 검토한 뒤 공개하세요.` + (unknown ? ' 로그인 정보를 알 수 없는 원본 시스템이 있어, 원본 시스템 메뉴에서 인증 정보를 등록해야 실행됩니다.' : ''), unknown ? 'warn' : 'ok');
    } catch (e) { recErr(e); }
  },
});

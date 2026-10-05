/* 진입점: 렌더, 화면 이동, 전역 이벤트 */
/* ---------- 렌더 ---------- */
const VFN = { dash:vDash, src:vSrc, studio:vStudio, play:vPlay, deploy:vDeploy, logs:vLogs, disc:vDisc };
function render() {
  if (!VFN[S.view]) S.view = 'dash';
  if (S.view === 'disc' && !S.disc) S.view = 'src';
  const nv = S.view === 'disc' ? 'src' : S.view;
  $('#nav').innerHTML = VIEWS.map(v => `<button class="${nv === v.id ? 'on' : ''}" ${nv === v.id ? 'aria-current="page"' : ''} data-act="nav" data-v="${v.id}">${v.label}</button>`).join('');
  $('#view').innerHTML = VFN[S.view]();
  if (S.view === 'play') { renderChat(); renderTrace(); }
  try { localStorage.setItem('ieum.view', S.view === 'disc' ? 'src' : S.view); } catch (e) {}
  if (S.view === 'disc' && S.disc && $('#bwImg')) discBrowserPatch(S.disc);
  if (S.view === 'disc' && S.disc && S.disc.phase === 'running') { const nl = $('#netlog'); if (nl) nl.scrollTop = nl.scrollHeight; }
}
const go = v => { S.view = v; render(); window.scrollTo({ top:0 }); const n = $('#nav .on'); n && n.scrollIntoView({ inline:'nearest', block:'nearest' }); };
const curTool = () => TOOL[S.tool];
function refreshTool() {
  const t = curTool();
  $('#toolDetail').innerHTML = toolDetailHTML(t);
  $('#toolList').innerHTML = toolListHTML();
  $$('.tl-f button b').forEach((b, i) => { const ts = srcTools(S.src); b.textContent = [ts.length, ts.filter(x => x.status === 'review' || x.status === 'drift').length, ts.filter(x => x.status === 'done').length, ts.filter(x => x.status === 'off').length][i]; });
}
function markDirty() { const t = curTool(); t._dirty = true; const b = $('#saveBtn'); if (b) b.disabled = false; }



/* 동작 */
Object.assign(ACT, {
  nav: a => { go(a.dataset.v); if (a.dataset.v === 'dash') refreshDash(); if (a.dataset.v === 'logs') refreshLogs(); if (a.dataset.v === 'src') refreshJobs(); },
  scope: () => openModal('1차 개발 범위', `<div class="scope-g">
      <div><h5>${svg('check', 16, 2.4)}1차에 포함</h5><ul>
        <li>REST(OpenAPI), SOAP(WSDL), 공공데이터포털 연결</li><li>명세 없는 레거시의 호출 샘플 추론</li>
        <li>AI 도구 설명 초안 자동 작성</li><li>파라미터, 코드값, 날짜 형식 매핑</li>
        <li>MCP 서버 배포와 모델별 호출 형식 변환</li><li>사용자 확인, 마스킹, 호출 한도 정책</li><li>명세 변경 감지와 호출 로그</li></ul></div>
      <div><h5>${svg('layers', 16)}2차 이후</h5><ul>
        <li>DB 직접 조회, GraphQL, gRPC 연결</li><li>명세 변경 자동 반영 (1차는 감지만)</li>
        <li>A2A 에이전트 간 연동</li><li>설치형(온프레미스) 게이트웨이</li><li>도구 사용 통계 기반 설명 자동 개선</li></ul></div></div>`,
    null, null, { wide:true, cancel:'닫기' }),
  noop: () => {},
  dClose: () => closeDrawer(),
  mClose: () => closeModal(),
  mOk: () => modalOk && modalOk(),
  copy: a => copyText(a.dataset.text),
  soon: a => toast(a.dataset.msg, 'info'),
});

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
  if (a.dataset.act === 'noop') return;
  const fn = ACT[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el, e); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#modal').classList.contains('show')) closeModal(); else if ($('#drawer').classList.contains('show')) closeDrawer(); return; }
  if (e.key === 'Enter' && e.target.id === 'pgIn' && !e.isComposing) { e.preventDefault(); pgSend(); return; }
  if (e.key === 'Enter' && e.target.id === 'banIn' && !e.isComposing) { e.preventDefault(); const v = e.target.value.trim(); if (v && !S.wz.ban.includes(v)) S.wz.ban.push(v); $('#wzBody').innerHTML = wzBody(); const i = $('#banIn'); i && i.focus(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act]')) { e.preventDefault(); e.target.click(); }
});
$('#ov').addEventListener('click', closeDrawer);
$('#mov').addEventListener('click', closeModal);
$$('[data-ico]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.ico, +(el.dataset.s || 21))));
$('#logoMark').innerHTML = MARK(26);

document.body.setAttribute('aria-busy', 'true');
loadAll().then(() => { document.body.removeAttribute('aria-busy'); $('#wsCompany').textContent = WS.company; $('#wsUser').textContent = WS.user; $('#wsAvatar').textContent = (WS.user || '?').slice(0, 1); render(); refreshDash(); })
  .catch(e => { $('#view').innerHTML = `<div class="md-empty" style="margin:40px">서버에서 데이터를 불러오지 못했습니다. ${esc(e.message)}</div>`; });

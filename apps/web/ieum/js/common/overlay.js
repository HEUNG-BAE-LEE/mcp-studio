/* 드로어, 모달, 토스트 */
/* ---------- 드로어 · 모달 · 토스트 ---------- */
let lastFocus = null;
function openDrawer(html) {
  lastFocus = document.activeElement;
  const d = $('#drawer'); d.innerHTML = html; d.classList.add('show'); $('#ov').classList.add('show');
  document.body.classList.add('d-open');
  setTimeout(() => { const f = d.querySelector('.icon-btn, button, input'); f && f.focus(); }, 60);
}
function closeDrawer() {
  $('#drawer').classList.remove('show'); $('#ov').classList.remove('show'); document.body.classList.remove('d-open');
  if (S.wz) { clearTimeout(S.wz.timer); S.wz = null; }
  lastFocus && lastFocus.focus && lastFocus.focus();
}
let modalOk = null;
function openModal(title, body, okLabel, onOk, opt = {}) {
  modalOk = onOk;
  const m = $('#modal');
  m.className = 'modal' + (opt.wide ? ' wide' : '');
  m.innerHTML = `<div class="m-head"><span id="mTitle">${title}</span><button class="icon-btn" data-act="mClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="m-body">${body}</div>
    <div class="m-foot">${opt.extra || ""}${opt.noCancel ? '' : `<button class="btn" data-act="mClose">${opt.cancel || '취소'}</button>`}${okLabel ? `<button class="btn primary" data-act="mOk">${okLabel}</button>` : ''}</div>`;
  requestAnimationFrame(() => { m.classList.add('show'); $('#mov').classList.add('show'); const f = m.querySelector('.m-body input') || m.querySelector('[data-act="mOk"]'); f && f.focus(); });
}
function closeModal() { $('#modal').classList.remove('show'); $('#mov').classList.remove('show'); modalOk = null; }
let toastT = null;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.className = 'toast ' + kind;
  t.innerHTML = svg(kind === 'warn' ? 'alert' : kind === 'info' ? 'info' : 'check', 18, 2.2) + `<span>${msg}</span>`;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('복사했습니다.'); }
  catch (e) { toast('이 브라우저에서는 자동 복사가 막혀 있습니다. 직접 선택해 복사하세요.', 'warn'); }
}


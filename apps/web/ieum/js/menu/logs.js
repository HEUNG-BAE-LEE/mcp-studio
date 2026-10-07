/* 호출 로그 */
/* ---------- 호출 로그 ---------- */
const LST = { ok:['성공','ok'], err:['실패','danger'], wait:['확인 대기','warn'], cache:['캐시 응답','info'] };
const fmtTs = ts => { const d = new Date(ts * 1000), z = n => String(n).padStart(2, '0'), today = new Date();
  return `${d.toDateString() === today.toDateString() ? '' : `${z(d.getMonth() + 1)}-${z(d.getDate())} `}${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`; };
const clientLabel = c => (MODELS[c] || { label:c }).label;
function logRows() {
  const q = S.logQ.trim().toLowerCase();
  const list = LOGS.filter(l => (S.logStatus === 'all' || l.status === S.logStatus) && (S.logClient === 'all' || l.client === S.logClient)
    && (!q || (l.tool + (l.user || '') + (TOOL[l.tool] ? SRC[TOOL[l.tool].src].name : '')).toLowerCase().includes(q)));
  if (!list.length) return `<tr><td class="empty" colspan="8">${LOGS.length ? '조건에 맞는 호출 기록이 없습니다.' : '아직 호출 기록이 없습니다. 테스트 실행이나 AI 연결로 도구를 호출하면 여기에 쌓입니다.'}</td></tr>`;
  return list.map(l => { const t = TOOL[l.tool];
    return `<tr data-act="logOpen" data-id="${l.id}" tabindex="0"><td class="date">${fmtTs(l.ts)}</td><td>${esc(l.user || '')}</td><td>${esc(clientLabel(l.client))}</td><td class="l tn">${esc(l.tool)}</td><td class="l" style="font-size:13px">${t ? esc(SRC[t.src].name) : '삭제된 도구'}</td><td class="num">${l.convertMs ?? '—'}ms</td><td class="num">${l.sourceMs == null ? '—' : fmt(l.sourceMs) + 'ms'}</td><td>${stt(l.status, LST)}</td></tr>`; }).join('');
}
function vLogs() {
  const cnt = k => LOGS.filter(l => l.status === k).length;
  return pageHead('logs') + `
  <div class="toolbar">
    <div class="tl-f" style="padding:0;border:0">${[['all', '전체', LOGS.length], ['ok', '성공', cnt('ok')], ['err', '실패', cnt('err')]].map(([v, l, n]) => `<button class="${S.logStatus === v ? 'on' : ''}" data-act="lf" data-v="${v}">${l}<b>${n}</b></button>`).join('')}</div>
    <span class="sp"></span>
    <select class="sel-f" data-chg="logClient" aria-label="AI 클라이언트"><option value="all">AI 클라이언트 전체</option>${Object.entries(MODELS).map(([k, m]) => `<option value="${k}" ${S.logClient === k ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
    <div class="search"><input type="search" placeholder="도구, 사용자, 시스템으로 검색" aria-label="로그 검색" data-inp="logQ" value="${esc(S.logQ)}"><span class="s-btn">${svg('search', 17)}</span></div>
  </div>
  <div class="twrap"><table class="utbl" style="min-width:960px">
    <thead><tr><th>시각</th><th>사용자</th><th>AI 클라이언트</th><th class="l">도구</th><th class="l">원본 시스템</th><th>변환</th><th>원본 응답</th><th>상태</th></tr></thead>
    <tbody id="logBody">${logRows()}</tbody></table></div>
  <p class="tab-hint">최근 300건을 보관합니다. 행을 누르면 AI 요청부터 원본 응답까지 실제 변환 과정을 볼 수 있습니다.</p>`;
}
const refreshLogs = () => api.get('/logs/').then(r => { LOGS = r.rows; if (S.view === 'logs') render(); }).catch(() => {});
async function openLog(id) {
  let l; try { l = await api.get(`/logs/${id}/`); } catch (e) { toast(e.message, 'warn'); return; }
  const t = TOOL[l.tool], s = t && SRC[t.src];
  const out = { ok:l.status === 'ok', error:l.note || '', trace:l.trace || {}, result:(l.trace || {}).aiResult };
  const steps = l.trace ? buildRealTrace(l.tool, l.client, out, false) : [];
  openDrawer(`<div class="d-head"><div class="ttl"><div class="ag">호출 기록</div><h3 class="mono">${esc(l.tool)}</h3><p>${fmtTs(l.ts)}, ${esc(l.user || '')}가 ${esc(clientLabel(l.client))}에서 호출</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body">
      <div class="lsum">
        <div><span class="k">상태</span><span class="v">${stt(l.status, LST)}</span></div>
        <div><span class="k">AI 클라이언트</span><span class="v">${esc(clientLabel(l.client))}</span></div>
        <div><span class="k">원본 시스템</span><span class="v">${s ? esc(s.name) : '—'}</span></div>
        <div><span class="k">변환 시간</span><span class="v">${l.convertMs ?? '—'}ms</span></div>
        <div><span class="k">원본 응답 시간</span><span class="v">${l.sourceMs == null ? '호출 전' : fmt(l.sourceMs) + 'ms'}</span></div>
        <div><span class="k">요청 ID</span><span class="v mono" style="font-size:12.5px">req_${l.id}</span></div>
      </div>
      ${l.status === 'err' && l.note ? `<div class="notice danger" style="margin-bottom:8px">${svg('alert', 18)}<div class="nt">${esc(l.note)}</div></div>` : ''}
      ${steps.length ? traceHTML(steps, steps.length, true, false) : '<div class="md-empty">이 호출은 변환 과정을 남기지 못했습니다.</div>'}
    </div>
    <div class="d-foot"><span class="info">${s ? `${esc(s.name)}, ${PRL[s.proto]}` : ''}</span>${t ? `<button class="btn" data-act="goTool" data-id="${t.id}">변환 스튜디오에서 열기</button>` : ''}<button class="btn primary" data-act="dClose">닫기</button></div>`);
}


/* 동작 */
Object.assign(ACT, {
  lf: a => { S.logStatus = a.dataset.v; $$('.tl-f button[data-act="lf"]').forEach(b => b.classList.toggle('on', b.dataset.v === S.logStatus)); $('#logBody').innerHTML = logRows(); },
  logOpen: a => openLog(a.dataset.id),
});

/* 동작 */
Object.assign(INP, {
  logQ: el => { S.logQ = el.value; $('#logBody').innerHTML = logRows(); },
});

/* 동작 */
Object.assign(CHG, {
  logClient: el => { S.logClient = el.value; $('#logBody').innerHTML = logRows(); },
});

/* 원본 시스템: 목록, 연결 마법사, API 자동 탐색 */
/* ---------- 원본 시스템 ---------- */
function srcRows() {
  const q = S.srcQ.trim().toLowerCase();
  const list = SOURCES.filter(s => (S.srcProto === 'all' || s.proto === S.srcProto) && (!q || (s.name + s.desc).toLowerCase().includes(q)));
  if (!list.length) return `<tr><td class="empty" colspan="8">${SOURCES.length ? '조건에 맞는 원본 시스템이 없습니다. 검색어나 연결 방식을 바꿔 보세요.' : '연결된 원본 시스템이 없습니다. 오른쪽 위 <b>원본 시스템 연결</b>로 시작하세요.'}</td></tr>`;
  return list.map(s => {
    const st = srcStat(s), pend = srcPending(s);
    return `<tr data-act="${s.err ? 'reauth' : 'goSrc'}" data-id="${s.id}" tabindex="0">
      <td class="l sname"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></td>
      <td>${prBadge(s.proto)}</td>
      <td class="l" style="font-size:13px;color:var(--text-2)">${esc(s.spec)}</td>
      <td style="font-size:13px">${esc(s.auth)}</td>
      <td><span class="num">${srcPub(s)}</span> <span class="muted">/ ${srcTotal(s)}</span>${pend ? `<div style="font-size:12px;color:var(--warn)">검토 ${pend}개</div>` : ''}</td>
      <td>${stt(st, SST)}</td>
      <td class="date">${esc(s.sync)}</td>
      <td>${s.err ? `<button class="btn sm" data-act="reauth" data-id="${s.id}">다시 인증</button>` : `<button class="btn sm" data-act="goSrc" data-id="${s.id}">도구 보기</button>`} <button class="btn sm" data-act="srcDel" data-id="${s.id}" aria-label="${esc(s.name)} 삭제">삭제</button></td>
    </tr>`;
  }).join('');
}
function vSrc() {
  const later = [['db', 'DB 직접 조회', 'SQL 조회문을 읽기 전용 도구로 변환'], ['graph', 'GraphQL', '스키마를 읽어 쿼리별 도구 생성'], ['layers', 'gRPC', 'proto 정의를 읽어 서비스별 도구 생성']];
  return pageHead('src') + `
  <div class="toolbar">
    <div class="search"><input type="search" placeholder="시스템 이름으로 검색" aria-label="원본 시스템 검색" data-inp="srcQ" value="${esc(S.srcQ)}"><span class="s-btn">${svg('search', 17)}</span></div>
    <select class="sel-f" data-chg="srcProto" aria-label="연결 방식">
      ${[['all', '연결 방식 전체'], ['soap', 'SOAP'], ['rest', 'REST'], ['gov', '공공데이터'], ['sample', '샘플 추론'], ['disc', '자동 탐색']].map(([v, l]) => `<option value="${v}" ${S.srcProto === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <span class="sp"></span>
    <button class="btn" data-act="wzOpen">${svg('plus', 17)}하나씩 연결</button>
    <button class="btn primary" data-act="obOpen">${svg('plus', 17)}한 번에 연결</button>
  </div>
  <div class="twrap"><table class="utbl" style="min-width:980px">
    <thead><tr><th class="l">원본 시스템</th><th>연결 방식</th><th class="l">명세</th><th>인증</th><th>AI 도구</th><th>상태</th><th>마지막 동기화</th><th>관리</th></tr></thead>
    <tbody id="srcBody">${srcRows()}</tbody>
  </table></div>
  <p class="tab-hint">AI 도구 수는 <b>공개 중 / 전체 작업</b>입니다. 명세가 바뀌었는지는 변환 스튜디오의 <b>명세 다시 읽기</b>로 확인합니다.</p>
  ${discJobsHTML()}
  <h3 class="sec-t">2차 개발에서 지원할 연결 방식 <small>1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다</small></h3>
  <div class="later">${later.map(l => `<div class="srow avail"><span class="si">${svg(l[0], 18)}</span><span class="tx"><b>${l[1]}</b><span>${l[2]}</span></span><span class="p2">2차</span></div>`).join('')}</div>`;
}


/* ---------- 원본 시스템 연결 마법사 ---------- */
const WZ_STEPS = ['연결 방식', '명세 불러오기', '인증', '분석'];
const AN_STEPS = ['명세 읽기', '작업 목록 추출', '파라미터 형식 분석', 'AI 설명 초안 작성', '쓰기, 민감 작업 분류'];
function wzOpen() {
  S.wz = { step:1, mode:'rest', name:'', url:'', base:'', specText:'', fileName:'', sReq:'', sRes:'', gov:(GOV_APIS[0] || [])[0], an:0, timer:null, error:null, result:null,
    cred:{ type:'none', in:'header', name:'X-API-KEY' },
    d:discWzInit(), ban:[...(DISC.defaults.ban || [])] };
  renderWz();
}
function wzBody() {
  const w = S.wz;
  if (w.step === 1) return `<p class="tab-hint" style="margin-top:0">연결할 원본 시스템이 어떤 형태로 되어 있는지 고르세요.</p>
    ${[...new Set(WZ_MODES.map(m => m.g))].map(g => `<div class="wz-g">${g}</div><div class="wz-cards">${WZ_MODES.filter(m => m.g === g).map(m => `<button class="mode-card ${w.mode === m.v ? 'on' : ''} ${m.dis ? 'dis' : ''} ${m.rec ? 'wide' : ''}" ${m.dis ? 'disabled aria-disabled="true"' : `data-act="wzMode" data-v="${m.v}"`}><span class="radio"></span><span><span class="mt">${svg(m.ic, 16)}${m.t}${m.dis ? ' <span class="p2">2차</span>' : ''}${m.rec ? ' <span class="rec">명세 없는 레거시에 추천</span>' : ''}</span><span class="mp">${m.d}</span></span></button>`).join('')}</div>`).join('')}`;
  if (w.mode === 'discover') return wzDiscBody(w);
  const nm = `<div class="field"><label>시스템 이름</label><input class="inp" data-inp="wzName" placeholder="비우면 명세의 이름을 씁니다" value="${esc(w.name)}"></div>`;
  if (w.step === 2) {
    if (w.mode === 'gov') return `<div class="field"><label>포털 API</label></div>
      <div class="gov-list">${GOV_APIS.map(g => `<label class="gov-row"><input type="radio" name="gov" value="${g[0]}" data-chg="wzGov" ${w.gov === g[0] ? 'checked' : ''}><span class="tx">${g[1]}<small>${g[2]}</small></span></label>`).join('')}</div>
      <p class="tab-hint">공공데이터포털에서 활용 신청한 API의 서비스키가 필요합니다. 다음 단계에서 입력합니다.</p>`;
    if (w.mode === 'sample') return nm + `<div class="field" style="align-items:start"><label style="padding-top:8px">요청 샘플</label><textarea class="inp" rows="3" data-inp="wzSampleReq" placeholder="curl &quot;https://erp.example.com/po/list?fromDt=20260901&quot; 또는 GET https://...">${esc(w.sReq)}</textarea></div>
      <div class="field" style="align-items:start"><label style="padding-top:8px">응답 샘플 (JSON)</label><textarea class="inp" rows="6" data-inp="wzSampleRes" placeholder='{"list":[{"PO_NO":"P-1","AMT":"1200"}]}'>${esc(w.sRes)}</textarea></div>
      <p class="tab-hint">샘플 하나로 도구 하나를 만듭니다. 응답 필드의 의미는 추정이라 변환 스튜디오에서 꼭 확인하세요.</p>`;
    const ph = { rest:'https://erp.example.com/openapi.json', soap:'https://legacy.example.com/ws/Service?wsdl' }[w.mode];
    return nm + `<div class="field"><label>명세 URL</label><input class="inp" data-inp="wzUrl" placeholder="${ph}" value="${esc(w.url)}"></div>
      <div class="or">또는</div>
      <label class="drop">${svg('upload', 24)}<br>${w.fileName ? esc(w.fileName) + ' 올림' : '명세 파일을 눌러서 고르세요'}<small>${w.mode === 'soap' ? '.wsdl, .xml' : '.json, .yaml'} 파일, 최대 10MB</small><input type="file" data-chg="wzFile" aria-label="명세 파일 선택"></label>
      <div class="field" style="margin-top:14px"><label>서버 주소</label><input class="inp mono" data-inp="wzBase" placeholder="${w.mode === 'soap' ? '비우면 WSDL의 주소를 씁니다' : '비우면 명세의 servers 주소를 씁니다'}" value="${esc(w.base)}"></div>`;
  }
  if (w.step === 3) return authFormHTML(w) + `<div class="notice" style="margin-top:14px">${svg('lock', 18)}<div class="nt">인증 정보는 이음 서버에 <b>암호화해 저장</b>합니다. AI 모델에는 전달하지 않고, 원본 요청을 보낼 때만 이음이 넣습니다.</div></div>`;
  const R = w.result, nt = R ? R.tools.length : 0, np = R ? R.tools.reduce((a, t) => a + t.params.length, 0) : 0, nw = R ? R.tools.filter(t => t.mode === 'write').length : 0;
  const done = !!R, ems = [R ? '명세 1건' : '', `작업 ${nt}개`, `파라미터 ${np}개`, `설명 ${nt}개`, `쓰기 작업 ${nw}개`];
  if (w.error) return `<div class="notice warn">${svg('alert', 18)}<div class="nt"><b>연결하지 못했습니다.</b><br>${esc(w.error)}</div></div>
    <p class="tab-hint">이전 단계로 돌아가 주소와 인증 정보를 확인해 주세요.</p>`;
  return `<div class="bar-p"><i style="width:${(done ? 1 : w.an / AN_STEPS.length) * 100}%"></i></div>
    <ul class="an">${AN_STEPS.map((x, i) => `<li class="${done || i < w.an ? 'ok' : i === w.an ? 'run' : ''}"><span class="ic">${done || i < w.an ? svg('check', 13, 3) : ''}</span>${x}${done ? `<em>${ems[i]}</em>` : ''}</li>`).join('')}</ul>
    ${done ? `<div class="res-grid"><div><span>찾은 작업</span><b>${nt}</b></div><div><span>AI 도구 후보</span><b>${nt}</b></div><div><span>쓰기 작업</span><b style="color:var(--warn)">${nw}</b></div></div>
      <div class="notice">${svg('info', 18)}<div class="nt">새로 만든 도구는 모두 <b>검토 필요</b> 상태로 시작합니다. 변환 스튜디오에서 설명과 매핑을 확인한 뒤 공개하세요.</div></div>` : ''}`;
}
const AUTH_OPTS = { gov:[['key', '서비스키']], soap:[['none', '인증 없음'], ['wss', 'WS-Security (UsernameToken)'], ['basic', 'HTTP Basic']],
  rest:[['none', '인증 없음'], ['key', 'API Key'], ['bearer', 'Bearer 토큰'], ['basic', 'HTTP Basic'], ['oauth', 'OAuth 2.0 (Client Credentials)']] };
AUTH_OPTS.sample = AUTH_OPTS.rest;
AUTH_OPTS.disc = [['session', '세션 (서비스 계정)']];
function authFormHTML(w) {
  const c = w.cred, opts = AUTH_OPTS[w.mode] || AUTH_OPTS.rest;
  if (!opts.some(o => o[0] === c.type)) c.type = opts[0][0];
  const f = (k, label, o = {}) => `<div class="field"><label>${label}</label><input class="inp ${o.mono ? 'mono' : ''}" ${o.secret ? 'type="password" autocomplete="new-password"' : ''} data-inp="wzCred" data-k="${k}" placeholder="${o.ph || ''}" value="${esc(c[k] || '')}"></div>`;
  let body = '';
  if (c.type === 'key') body = (w.mode === 'gov' ? '' : `<div class="field"><label>전달 위치</label><select class="inp" data-chg="wzCredIn"><option value="header" ${c.in === 'header' ? 'selected' : ''}>요청 헤더</option><option value="query" ${c.in === 'query' ? 'selected' : ''}>쿼리 파라미터</option></select></div>${f('name', '이름', { mono:1, ph:'X-API-KEY' })}`)
    + f('key', w.mode === 'gov' ? '서비스키' : 'API Key', { secret:1, ph:w.mode === 'gov' ? '포털에서 발급받은 일반 인증키 (Decoding)' : '' });
  else if (c.type === 'bearer') body = f('key', '토큰', { secret:1 });
  else if (c.type === 'basic' || c.type === 'wss' || c.type === 'session') body = f('username', '계정') + f('password', '비밀번호', { secret:1 });
  else if (c.type === 'oauth') body = f('tokenUrl', '토큰 URL', { mono:1, ph:'https://auth.example.com/oauth/token' }) + f('clientId', 'Client ID') + f('clientSecret', 'Client Secret', { secret:1 });
  return `<div class="field"><label>인증 방식</label><select class="inp" data-chg="wzAuth">${opts.map(o => `<option value="${o[0]}" ${c.type === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>${body}`;
}
function renderWz() {
  const w = S.wz; if (!w) return;
  if (w.mode === 'discover') return renderDiscWz();
  const last = w.step === 4, done = !!w.result;
  const html = `<div class="d-head"><div class="ttl"><div class="ag">원본 시스템</div><h3 id="dTitle">원본 시스템 연결</h3><p>REST(OpenAPI), SOAP(WSDL), 공공데이터포털, 호출 샘플로 연결합니다.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body">
      <div class="wz-steps">${WZ_STEPS.map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div>
      <div id="wzBody">${wzBody()}</div>
    </div>
    <div class="d-foot"><span class="info">${w.step}/4 단계</span>
      ${w.step > 1 && !last ? '<button class="btn" data-act="wzPrev">이전</button>' : ''}
      ${w.error ? '<button class="btn" data-act="wzPrev">이전</button>' : ''}
      ${last && w.error ? '' : last ? `<button class="btn primary" data-act="wzFinish" ${done ? '' : 'disabled'}>변환 스튜디오에서 검토</button>` : `<button class="btn primary" data-act="wzNext">${w.step === 3 ? '연결하고 분석 시작' : '다음'}</button>`}</div>`;
  if ($('#drawer').classList.contains('show')) $('#drawer').innerHTML = html; else openDrawer(html);
}
function wzAnalyze() {
  const w = S.wz; if (!w) return;
  w.an = 0; w.error = null; w.result = null;
  const tick = () => { if (S.wz !== w || w.result || w.error) return; if (w.an < AN_STEPS.length - 1) { w.an++; renderWz(); } w.timer = setTimeout(tick, 700); };
  w.timer = setTimeout(tick, 500);
  api.post('/sources/connect/', { mode:w.mode, name:w.name.trim(), specUrl:w.url.trim(), specText:w.specText, base:w.base.trim(), gov:w.gov,
    auth:w.cred, sampleRequest:w.sReq, sampleResponse:w.sRes })
    .then(r => { clearTimeout(w.timer); SOURCES.push(r.source); SRC[r.source.id] = r.source; TOOLS[r.source.id] = r.tools; indexTools(); w.result = r; if (S.wz === w) renderWz(); if (S.view !== 'play') render(); })
    .catch(e => { clearTimeout(w.timer); w.error = e.message; if (S.wz === w) renderWz(); });
}
function wzFinish() {
  const r = S.wz && S.wz.result; if (!r) return;
  closeDrawer();
  Object.assign(S, { view:'studio', src:r.source.id, tool:r.tools[0].id, tf:'all', tq:'' });
  render();
  toast(`'${r.source.name}' 연결을 마쳤습니다. 도구 후보 ${r.tools.length}개를 검토해 주세요.`);
}

/* 동작 */
Object.assign(ACT, {
  goSrc: a => { const s = SRC[a.dataset.id]; if (s.err) return ACT.reauth(a); Object.assign(S, { src:s.id, tool:srcTools(s.id)[0].id, tf:'all', tq:'' }); go('studio'); },
  reauth: a => {
    const s = SRC[a.dataset.id];
    const w = S.rw = { mode:s.proto, cred:{ type:s.authType || 'none', in:'header', name:'X-API-KEY' } };
    openModal('인증 정보 다시 입력', `<p style="margin-top:0"><b>${esc(s.name)}</b> 연결에 문제가 있습니다. 인증 정보를 다시 입력하면 저장하고 연결을 복구합니다.</p><div id="rwBody">${authFormHTML(w)}</div>`,
      '저장하고 다시 연결', () => {
        api.post(`/sources/${s.id}/reauth/`, { auth:w.cred }).then(r => { Object.assign(s, r); closeModal(); render(); toast(`${s.name} 인증 정보를 저장했습니다.`); })
          .catch(e => toast(e.message, 'warn'));
      });
  },
  srcDel: a => {
    const s = SRC[a.dataset.id];
    openModal('원본 시스템 삭제', `<p style="margin:0"><b>${esc(s.name)}</b>과 이 시스템에서 만든 AI 도구 ${srcTools(s.id).length}개를 삭제합니다. 도구 묶음에서도 빠지며, 저장한 인증 정보도 지웁니다. 되돌릴 수 없습니다.</p>`, '삭제', () => {
      api('DELETE', `/sources/${s.id}/`).then(() => {
        srcTools(s.id).forEach(t => delete TOOL[t.id]); delete TOOLS[s.id]; delete SRC[s.id];
        SOURCES.splice(SOURCES.indexOf(s), 1);
        return api.get('/deploy/toolsets/').then(r => { TOOLSETS = r; });
      }).then(() => { closeModal(); render(); toast(`${s.name} 연결을 삭제했습니다.`); }).catch(e => toast(e.message, 'warn'));
    });
  },
  wzOpen: () => wzOpen(),
  wzMode: a => { S.wz.mode = a.dataset.v; renderWz(); },
  wzNext: () => {
    const w = S.wz;
    if (w.step === 2 && w.mode === 'sample' && !w.sReq.trim()) { toast('요청 샘플을 입력하세요.', 'warn'); return; }
    if (w.step === 2 && (w.mode === 'rest' || w.mode === 'soap') && !w.url.trim() && !w.specText) { toast('명세 URL을 입력하거나 파일을 올려 주세요.', 'warn'); return; }
    if (w.mode === 'discover') { const msg = discWzCheck(w); if (msg) { toast(msg, 'warn'); return; } }
    w.step++; renderWz(); if (w.step === 4) wzAnalyze();
  },
  wzPrev: () => { const w = S.wz; w.step--; w.error = null; renderWz(); },
  wzFinish: () => wzFinish(),
});

/* 동작 */
Object.assign(INP, {
  srcQ: el => { S.srcQ = el.value; $('#srcBody').innerHTML = srcRows(); },
  wzName: el => { S.wz.name = el.value; },
  wzUrl: el => { S.wz.url = el.value; },
});

/* 동작 */
Object.assign(CHG, {
  srcProto: el => { S.srcProto = el.value; $('#srcBody').innerHTML = srcRows(); },
  wzGov: el => { S.wz.gov = el.value; },
});

/* 연결 마법사, 인증 다시 입력 공용 입력 */
const credTarget = () => ($('#modal').classList.contains('show') && S.rw) ? S.rw : S.wz;
const credRender = () => { const w = credTarget(); if (w === S.rw && $('#rwBody')) $('#rwBody').innerHTML = authFormHTML(w); else $('#wzBody').innerHTML = wzBody(); };
Object.assign(INP, {
  wzBase: el => { S.wz.base = el.value; },
  wzSampleReq: el => { S.wz.sReq = el.value; },
  wzSampleRes: el => { S.wz.sRes = el.value; },
  wzCred: el => { credTarget().cred[el.dataset.k] = el.value; },
});
Object.assign(CHG, {
  wzAuth: el => { credTarget().cred.type = el.value; credRender(); },
  wzCredIn: el => { const c = credTarget().cred; c.in = el.value; if (!c.name || c.name === 'X-API-KEY' || c.name === 'api_key') c.name = el.value === 'header' ? 'X-API-KEY' : 'api_key'; credRender(); },
  wzFile: el => {
    const f = el.files && el.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast('명세 파일은 10MB까지 올릴 수 있습니다.', 'warn'); return; }
    const rd = new FileReader();
    rd.onload = () => { S.wz.specText = String(rd.result); S.wz.fileName = f.name; if (!S.wz.name) S.wz.name = f.name.replace(/\.[^.]+$/, ''); $('#wzBody').innerHTML = wzBody(); toast(`${f.name} 파일을 올렸습니다.`); };
    rd.readAsText(f);
  },
});

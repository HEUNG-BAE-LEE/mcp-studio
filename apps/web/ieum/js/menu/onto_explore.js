/* 온톨로지: 객체 탐색(원본 DB 의 실제 행을 객체로 둘러본다), AI 질의 테스트(공개한 온톨로지로 질문이 풀리는 과정) */

/* ===== 객체 탐색 ===== */
function onExItems() {
  const items = ON.exItems;
  if (!items) return onSpin();
  if (!items.length) return '<div class="empty-s">검색 결과가 없습니다.</div>';
  return items.map(v => `<button class="ob-item ${ON.obj && ON.obj.oid === v.oid && ON.obj.key === v.key ? 'on' : ''}" data-act="objOpen" data-oid="${esc(v.oid)}" data-key="${esc(v.key)}"><span class="oi" style="--sc:${onClr(v.clr)}">${esc(v.type[0])}</span><span class="tx"><b>${esc(v.title)}</b><small>${esc(v.type)}${v.sub && v.sub !== v.title ? ' · ' + esc(v.sub) : ''}</small></span></button>`).join('');
}
async function onExFetch(cid, partial) {
  const key = `${cid}|${ON.otype}|${ON.oq}`;
  ON.exKey = key;
  try {
    const d = await api.get(`/onto/connections/${encodeURIComponent(cid)}/instances?type=${encodeURIComponent(ON.otype)}&q=${encodeURIComponent(ON.oq)}`);
    if (ON.exKey !== key) return;
    ON.exItems = d.items; ON.exTypes = d.types;
    if (!ON.obj || !onObjOf(cid, ON.obj.oid)) ON.obj = d.items.length ? { oid:d.items[0].oid, key:d.items[0].key } : null;
  } catch (e) { if (ON.exKey === key) { ON.exItems = []; onErr(e); } }
  if (partial) { const l = $('#obList'); if (l) l.innerHTML = onExItems(); } else if (S.view === 'onto') render();
}
function onExploreTab(cid) {
  const objs = onObjs(cid);
  if (!objs.length) return `<div class="md-empty big">${svg('search', 34, 1.4)}<b>탐색할 객체가 없어요</b><span>객체 구축에서 객체를 만들면 원본 DB의 실제 행을 객체로 둘러볼 수 있어요.</span></div>`;
  if (ON.exItems === undefined || ON.exItems === null) { if (ON.exKey !== `${cid}|${ON.otype}|${ON.oq}`) onExFetch(cid); }
  if (ON.otype !== 'all' && !objs.some(o => o.id === ON.otype)) ON.otype = 'all';
  return `<div class="on-wrap ex" style="margin-top:0">
    <section class="panel on-list" aria-label="객체 검색">
      <div class="p-search" style="padding-top:12px"><div class="search full"><input type="search" placeholder="발주번호, 거래처명, 이름으로 검색" aria-label="객체 검색" data-inp="oq" value="${esc(ON.oq)}"><span class="s-btn">${svg('search', 16)}</span></div>
        <select class="sel-f" style="width:100%;margin-top:8px" data-chg="otype" aria-label="객체 유형"><option value="all">모든 객체 유형</option>${objs.map(o => `<option value="${esc(o.id)}" ${ON.otype === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
      <div id="obList" class="ob-list">${onExItems()}</div>
    </section>
    <div class="on-main" id="objView">${ON.obj ? onObjView(cid) : '<div class="empty-s">왼쪽에서 객체를 고르세요.</div>'}</div>
  </div>`;
}
function onMiniGraph(inst) {
  const nb = [];
  inst.links.forEach(l => l.items.forEach(it => { if (nb.length < 8) nb.push({ ln:l.name, oid:it.oid, key:it.key, title:it.title, ext:l.cross, clr:l.clr, tn:l.toName }); }));
  const cx = 300, cy = 150, n = Math.max(nb.length, 1), lim = 12;
  const pts = nb.map((_, i) => { const a = -Math.PI / 2 + (i + .5) * 2 * Math.PI / n; return [cx + Math.cos(a) * 210, cy + Math.sin(a) * 105]; });
  const nodeG = (t, x, y, main, o) => { const w = main ? 170 : 150, ttl = !main && t.title.length > lim ? t.title.slice(0, lim - 1) + '…' : t.title;
    return `<g class="mg-n ${main ? 'main' : ''} ${o.ext ? 'ext' : ''}" ${main ? '' : `data-act="objOpen" data-oid="${esc(o.oid)}" data-key="${esc(o.key)}" tabindex="0" role="button"`} style="--sc:${onClr(o.clr)}" aria-label="${esc(t.title)}">
      <rect x="${x - w / 2}" y="${y - 20}" width="${w}" height="40" rx="8"/><circle cx="${x - w / 2 + 18}" cy="${y}" r="10"/><text class="ict" x="${x - w / 2 + 18}" y="${y}" text-anchor="middle" dominant-baseline="central">${esc((o.tn || inst.object.name)[0])}</text>
      <text class="mt" x="${x - w / 2 + 34}" y="${y}" dominant-baseline="central">${esc(ttl)}</text></g>`; };
  return `<svg class="mg" viewBox="0 0 600 300" role="group" aria-label="관계 탐색">
    ${pts.map(([x, y], i) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="ml" x="${(cx + x) / 2}" y="${(cy + y) / 2 - 5}" text-anchor="middle">${esc(nb[i].ln)}</text>`).join('')}
    ${pts.map(([x, y], i) => nodeG(nb[i], x, y, false, nb[i])).join('')}${nodeG({ title:inst.title }, cx, cy, true, { oid:inst.oid, key:inst.key, ext:false, clr:inst.object.clr, tn:inst.object.name })}</svg>`;
}
function onObjView(cid) {
  const ob = ON.obj, inst = onNeed(`inst:${ob.oid}:${ob.key}`, () => api.get(`/onto/objects/${encodeURIComponent(ob.oid)}/instances/${encodeURIComponent(ob.key)}`));
  if (inst === 'loading') return onSpin('원본 DB에서 읽는 중');
  if (inst.error) return `<div class="md-empty">${esc(inst.error)}</div>`;
  const o = inst.object, back = ON.hist.length, val = p => p.hidden ? '<span class="muted">가림</span>' : esc(p.value === '' || p.value == null ? '—' : typeof p.value === 'number' ? fmt(p.value) + (p.unit || '') : p.value);
  return `<section class="box ob-view">
    <div class="ot-h">
      <span class="oi lg" style="--sc:${onClr(o.clr)}">${esc(o.name[0])}</span>
      <div class="tx"><div class="t1">${back ? `<button class="icon-btn sm" data-act="objBack" aria-label="이전 객체">${svg('back', 16)}</button>` : ''}<h3>${esc(inst.title)}</h3><span class="fl info">${esc(o.name)}</span></div>
        <div class="meta"><span>${svg('graph', 14)}${esc(o.connName)} 온톨로지</span><span>${svg('db', 14)}<code>${esc(inst.table)}</code></span><span>객체 ID <code>${esc(inst.key)}</code></span></div></div>
      <button class="btn sm" data-act="otSelGo" data-id="${esc(o.id)}">객체 유형 보기</button>
    </div>
    <div class="ob-g">
      <div><h5 class="h5">속성</h5><dl class="ob-props">${inst.props.map(p => `<dt>${esc(p.name)}</dt><dd>${val(p)}</dd>`).join('')}</dl>
        <h5 class="h5" style="margin-top:18px">연결된 객체</h5>
        ${inst.links.map(l => `<div class="ob-link"><div class="ol-h"><b>${esc(l.name)}</b><span>${fmt(l.total)}개</span></div><div class="ol-items">${l.items.map(it => `<button class="chip ${l.cross ? 'ext' : ''}" data-act="objOpen" data-oid="${esc(it.oid)}" data-key="${esc(it.key)}"><span class="oi sm" style="--sc:${onClr(l.clr)}">${esc(l.toName[0])}</span>${esc(it.title)}${l.cross ? `<small>${esc(l.toConnName)} 온톨로지</small>${svg('external', 11)}` : ''}</button>`).join('')}${l.total > l.items.length ? `<span class="muted" style="font-size:12.5px">외 ${fmt(l.total - l.items.length)}개</span>` : ''}${l.error ? `<span class="muted" style="font-size:12.5px">${esc(l.error)}</span>` : ''}</div></div>`).join('') || '<div class="muted" style="font-size:13px">이어진 링크가 없어요.</div>'}
      </div>
      <div><h5 class="h5">관계 탐색 <small>주변 객체를 누르면 이동합니다</small></h5><div class="mg-wrap">${onMiniGraph(inst)}</div>
        <details class="pv" style="margin-top:12px"><summary>실행한 SQL</summary>${code(inst.sql, 'sql')}</details></div>
    </div></section>`;
}
let onExTimer = null;
Object.assign(INP, {
  oq: el => { ON.oq = el.value; clearTimeout(onExTimer); onExTimer = setTimeout(() => onExFetch(ON.scope, true), 250); },
});
Object.assign(CHG, {
  otype: el => { ON.otype = el.value; ON.exItems = null; ON.exKey = ''; ON.obj = null; render(); },
});
Object.assign(ACT, {
  objOpen: async a => {
    const oid = a.dataset.oid, key = a.dataset.key, cid = oid.split('.')[0];
    if (!onConn(cid)) return;
    if (cid !== ON.scope) { ON.scope = cid; ON.hist = []; ON.exItems = null; ON.exKey = ''; ON.otype = 'all'; ON.oq = ''; toast(`${onOntoName(cid)}로 이동했어요.`, 'info'); if (!ON.g[cid]) { try { await onLoadGraph(cid); } catch (e) { onErr(e); } } }
    else if (ON.tab === 'explore' && ON.obj && (oid !== ON.obj.oid || key !== ON.obj.key)) ON.hist.push(ON.obj);
    else if (ON.tab !== 'explore') ON.hist = [];
    ON.tab = 'explore'; ON.mv = null; ON.obj = { oid, key }; render();
  },
  objBack: () => { ON.obj = ON.hist.pop() || ON.obj; render(); },
});

/* ===== AI 질의 테스트 ===== */
function onAskInit() {
  api.get('/onto/ask').then(st => { ON.askSt = st; ON.users = st.users; ON.free = st.free; if (!ON.askUser || !st.users.some(u => u.emp === ON.askUser)) ON.askUser = st.users[0] ? st.users[0].emp : null; if (S.view === 'onto') render(); })
    .catch(e => { ON.askSt = { error:e.message, published:[], users:[], questions:[] }; render(); });
}
function onAskWrap() {
  const st = ON.askSt;
  if (!st) { onAskInit(); return onSpin(); }
  if (st.error) return `<div class="md-empty">${esc(st.error)}</div>`;
  const pubs = st.published;
  return `<div class="cw-h"><span class="dbi" style="--sc:var(--ont)">${svg('msg', 22)}</span><div class="tx"><div class="t1"><h3>AI 질의 테스트</h3></div>
    <p>AI는 공개된 온톨로지를 함께 씁니다. ${pubs.length ? pubs.map(s => `<span class="dbchip"><i style="background:${onClr(s.clr)}"></i>${esc(s.name)} 온톨로지 v${s.ver}</span>`).join('') : '아직 공개한 온톨로지가 없어요.'}</p></div></div>${pubs.length ? onAskView() : `<div class="md-empty big">${svg('rocket', 34, 1.4)}<b>공개한 온톨로지가 없어요</b><span>연결의 온톨로지에서 객체를 검토해 공개 상태로 바꾼 뒤 <b>온톨로지 공개</b>를 누르면 여기서 질문해 볼 수 있어요.</span></div>`}`;
}
const ON_KCLS = { obj:'', link:'', filter:'', agg:'', perm:'ai', act:'src', hold:'hold', fail:'fail' };
function onBlock(b) {
  if (b.t === 'json') return code(b.v);
  if (b.t === 'sql') return code(b.v, 'sql');
  if (b.t === 'http') return code(b.v, 'http');
  if (b.t === 'res') return `<div class="res">${svg('check', 13, 2.6)}${esc(b.v)}</div>`;
  if (b.t === 'rules') return `<div class="rules2">${b.v.map(r => `<span class="${r.deny ? 'deny' : ''}">${esc(r.text)}${r.em ? ` <em>${esc(r.em)}</em>` : ''}</span>`).join('')}</div>`;
  if (b.t === 'approval') {
    const v = b.v;
    if (v.done) return `<div class="apv done"><b>${esc(v.title)}</b></div>`;
    return `<div class="apv"><b>${esc(v.title)}</b>${v.fields.length ? `<dl>${v.fields.map(f => `<dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd>`).join('')}</dl>` : ''}<div class="acts"><button class="btn primary sm" data-act="askApprove" ${ON.askBusy ? 'disabled' : ''}>${esc(v.yes)}</button><button class="btn sm" data-act="askReject" ${ON.askBusy ? 'disabled' : ''}>${esc(v.no)}</button></div></div>`;
  }
  return '';
}
function onAskView() {
  const st = ON.askSt, u = ON.askUser, out = ON.askOut, q = ON.askQ;
  return `<div class="ask-g">
    <section class="box"><div class="box-h"><h3>실행 사용자</h3></div><div class="box-b">
      ${st.users.length ? st.users.map(x => `<button class="opt ${u === x.emp ? 'on' : ''}" data-act="askUser" data-v="${esc(x.emp)}"><span class="radio"></span><span><b>${esc(x.name)}</b><small>${esc(x.deptName || x.dept)} ${esc(x.rank)}, 사번 ${esc(x.emp)}</small></span></button>`).join('') : '<div class="muted" style="font-size:13px">질문을 실행할 사용자가 없어요. 직원 객체와 질문 사용자를 설정해 주세요. <button class="btn sm" data-act="onIdentity">실행 사용자 확인 설정</button></div>'}
      <p class="ot-cap" style="margin:8px 0 0">같은 질문도 실행 사용자의 행 권한, 속성 권한, 액션 조건에 따라 답이 달라집니다. 실제 연동에서는 로그인 인증이 사번을 알려 줍니다.</p></div>
      <div class="box-h" style="border-top:1px solid var(--line)"><h3>질문</h3></div><div class="box-b q-list">
      ${st.questions.map(x => `<button class="chip ${q && q.id === x.id ? 'on' : ''}" data-act="askRun" data-v="${x.id}" ${ON.askBusy || !u ? 'disabled' : ''}>${esc(x.q)}</button>`).join('')}
      ${st.free ? `<div class="ask-free"><input class="inp" id="askIn" placeholder="직접 질문해 보세요 (GPT가 질의 계획을 세웁니다)" ${ON.askBusy ? 'disabled' : ''} maxlength="200"><button class="btn sm primary" data-act="askSend" ${ON.askBusy || !u ? 'disabled' : ''}>${svg('send', 14)}</button></div>`
        : `<p class="ot-cap" style="margin:8px 0 0">자유 질문은 GPT 설정(AZURE_OPENAI_*)이 있을 때 쓸 수 있어요. 위의 정해 둔 질문은 설정 없이 규칙으로 풀립니다.</p>`}</div></section>
    <section class="box"><div class="box-h"><h3>온톨로지 질의 과정${out ? `<small>${esc(out.user.name)}님으로 실행</small>` : ''}</h3></div>
      ${ON.askBusy ? `<div class="trace-empty"><span class="spin"></span><br>질의를 실행하고 있어요</div>` : !out ? `<div class="trace-empty">${svg('graph', 40, 1.4)}<br>왼쪽에서 질문을 고르면 AI가 객체를 찾고, 링크를 따라가고,<br>권한을 적용해 쿼리하는 과정을 보여 드립니다.</div>`
        : `<div class="ask-q"><span class="msg u">${esc(out.question)}</span></div>
        <ol class="trace">${out.steps.map((s, i) => `<li class="step ${ON_KCLS[s.k] || ''} enter" style="animation-delay:${i * 90}ms"><span class="no">${s.k === 'hold' ? svg('user', 14, 2.2) : s.k === 'fail' ? svg('close', 14, 2.6) : i + 1}</span><div class="step-h"><b>${esc(s.title)}</b><span class="who">${esc(s.who)}</span></div>${s.blocks.map(onBlock).join('')}</li>`).join('')}</ol>
        ${out.answer ? `<div class="ask-a"><span class="msg a"><span class="by">AI 답변</span>${esc(out.answer)}</span></div>` : ''}
        <p class="pv-note" style="margin:10px 16px 14px">앞쪽 단계의 건수는 권한을 적용하기 전 값이에요. 실제 AI에게는 권한을 적용한 결과만 전달됩니다. ${out.mode === 'llm' ? '질의 계획은 GPT가 세웠고, 실행은 같은 엔진이 했어요.' : ''}</p>
        ${out.executed && ON.askSt.demo ? `<div style="padding:0 16px 14px"><button class="btn sm" data-act="askReset">${svg('refresh', 14)}시연 데이터 되돌리기</button> <span class="muted" style="font-size:12.5px">승인한 발주를 승인 전 상태로 되돌려 다시 시험해요</span></div>` : ''}`}
    </section></div>`;
}
async function onAskGo(body) {
  ON.askBusy = true; render();
  try { ON.askOut = await api.post('/onto/ask/run', Object.assign({ emp:ON.askUser }, body)); }
  catch (e) { ON.askOut = null; onErr(e); }
  ON.askBusy = false; render();
}
Object.assign(ACT, {
  askUser: a => { ON.askUser = a.dataset.v; ON.askOut = null; render(); },
  askRun: a => { ON.askQ = { id:a.dataset.v }; onAskGo({ id:a.dataset.v }); },
  askSend: () => { const i = $('#askIn'), t = i && i.value.trim(); if (!t) { toast('질문을 입력해 주세요.', 'warn'); return; } ON.askQ = { text:t }; onAskGo({ text:t }); },
  askApprove: () => onAskGo(Object.assign({}, ON.askQ, { approved:true })),
  askReject: () => onAskGo(Object.assign({}, ON.askQ, { approved:false })),
  askReset: async () => { try { await api.post('/onto/demo/reset-data'); ON.askOut = null; ON.cache = {}; toast('시연 데이터를 처음 상태로 되돌렸어요.'); } catch (e) { onErr(e); } render(); },
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'askIn' && !e.isComposing) { e.preventDefault(); ACT.askSend(); } });

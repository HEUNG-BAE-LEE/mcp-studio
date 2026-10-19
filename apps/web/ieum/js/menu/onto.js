/* 온톨로지 (2차): DB 연결마다 온톨로지 하나. 그래프, 객체 상세, 연결 정보, 공개.
   객체 구축·마법사는 onto_build.js, 데이터 마트는 onto_mart.js, 객체 탐색과 AI 질의 테스트는 onto_explore.js 에 있다.
   데이터는 전부 서버(/api/ieum/onto)에서 읽는다. 목업의 고정 데이터는 없다. */

const ON = {
  ov:null, boot:false, err:'',
  scope:null, tab:'graph', sel:null, dtab:'props',
  g:{},            // 연결 id -> {objects, links, others}
  cache:{},        // 'pv:oid' 'tl:oid' 'sim:oid:emp' ... -> 값 | 'loading'
  users:null, free:false,
  busy:{},         // 진행 중인 요청 표시
  obj:null, hist:[], oq:'', otype:'all', exItems:null, exKey:'', permUser:null,   // 객체 탐색, 권한 보기
  askSt:null, askUser:null, askOut:null, askQ:null, askBusy:false,               // AI 질의 테스트
  mv:null, me:null, tree:null, martTimer:null,                                    // 데이터 마트
  dbw:null, scw:null, otw:null,                                                    // 마법사
};
const ON_ST = { pub:['공개', 'ok'], review:['검토 필요', 'warn'], draft:['초안', 'mute'] };
const ON_FLAG = { pk:['기본키', 'info'], title:['제목', 'info'], link:['링크 키', 'ont'], search:['검색', 'mute'], mask:['마스킹', 'danger'], pii:['개인정보', 'danger'], perm:['속성 권한', 'ont'],
  code:['코드값', 'info'], hidden:['AI 비공개', 'mute'], filter:['객체 필터', 'mute'] };
const ON_TABS = [['graph', '그래프'], ['build', '객체 구축'], ['mart', '데이터 마트'], ['explore', '객체 탐색'], ['info', '연결 정보']];
const onClr = c => ({ mcp:'var(--mcp)', ont:'var(--ont)', rag:'var(--rag)', pri:'var(--primary)' }[c] || 'var(--mcp)');
const onN = n => n == null ? '—' : fmt(n);
const onJo = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b); };
const onSnake = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const onConn = id => ((ON.ov && ON.ov.conns) || []).find(c => c.id === id);
const onOntoName = id => `${(onConn(id) || { name:id }).name} 온톨로지`;
const onObjs = cid => (ON.g[cid] || { objects:[] }).objects;
const onObjOf = (cid, oid) => onObjs(cid).find(o => o.id === oid);
const onSt = (k, map = ON_ST) => { const x = map[k] || [k, 'mute']; return `<span class="stt ${x[1]}">${x[0]}</span>`; };
const onWhen = ts => {
  if (!ts) return '—';
  const d = new Date(ts * 1000), n = new Date(), p = x => String(x).padStart(2, '0'), hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  const days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (days === 0) return Math.abs(n - d) < 60e3 ? '방금' : `오늘 ${hm}`;
  if (days === 1) return `어제 ${hm}`;
  if (days === -1) return `내일 ${hm}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
};
const onErr = (e, pre = '') => toast(`${pre}${e.message}`, 'warn');

/* ---------- 읽어 오기 ---------- */
async function onLoadOv() { ON.ov = await api.get('/onto/'); ON.free = !!ON.ov.llm; }
async function onLoadGraph(cid) { ON.g[cid] = await api.get(`/onto/connections/${encodeURIComponent(cid)}/graph`); }
async function onBoot() {
  if (ON.boot) return;
  ON.boot = true;
  try {
    await onLoadOv();
    if (ON.scope !== 'ask' && !onConn(ON.scope)) ON.scope = ON.ov.conns.length ? ON.ov.conns[0].id : null;
    if (ON.scope && ON.scope !== 'ask') await onLoadGraph(ON.scope);
    ON.err = '';
  } catch (e) { ON.err = e.message; }
  ON.boot = false;
  if (S.view === 'onto') render();
}
function onEnter() { if (!ON.ov) onBoot(); else onReload(true); }
/* 서버 값이 바뀌었을 수 있을 때(다른 메뉴에서 돌아옴, 조작 뒤) 개요와 지금 보는 연결을 다시 읽는다 */
async function onReload(rerender = true, cids) {
  try {
    await onLoadOv();
    const list = cids || (ON.scope && ON.scope !== 'ask' ? [ON.scope] : []);
    await Promise.all(list.filter(c => onConn(c)).map(c => onLoadGraph(c)));
    Object.keys(ON.g).forEach(c => { if (!onConn(c)) delete ON.g[c]; });
    ON.cache = {};
  } catch (e) { ON.err = e.message; }
  if (rerender && S.view === 'onto') render();
}
/* 한 번만 읽고 값을 기억한다. 읽는 중이면 'loading' */
function onNeed(key, fn) {
  const v = ON.cache[key];
  if (v === undefined) {
    ON.cache[key] = 'loading';
    fn().then(r => { ON.cache[key] = r; }).catch(e => { ON.cache[key] = { error:e.message }; }).then(() => { if (S.view === 'onto') render(); });
    return 'loading';
  }
  return v;
}
const onSpin = t => `<div class="md-empty"><span class="spin"></span> ${t || '불러오는 중'}</div>`;

/* ---------- 화면 ---------- */
function vOnto() {
  const v0 = VIEWS.find(x => x.id === 'onto'), head = `<div class="page-head"><h2>${v0.h}</h2><span class="p2 lg">2차</span><p>${v0.p}</p></div>`;
  if (!ON.ov) { if (!ON.boot && !ON.err) onBoot(); return head + (ON.err ? `<div class="md-empty">${esc(ON.err)}<br><button class="btn sm" style="margin-top:10px" data-act="onRetry">다시 시도</button></div>` : onSpin()); }
  if (ON.scope !== 'ask' && !onConn(ON.scope)) ON.scope = ON.ov.conns.length ? ON.ov.conns[0].id : null;
  const convs = ON.ov.conns;
  const nav = `<nav class="on-nav" aria-label="온톨로지 메뉴">
    <div class="nv-h">온톨로지<span>${convs.length}</span></div>
    <p class="nv-note">DB 연결 하나에 온톨로지 하나</p>
    ${convs.map(s => `<button class="nv conn ${ON.scope === s.id ? 'on' : ''}" data-act="onScope" data-v="${esc(s.id)}"><i style="background:${onClr(s.clr)}"></i><span class="tx"><b>${esc(s.name)}</b><small>${esc(s.dbmsLabel)}</small><small>객체 ${s.objects}${s.marts ? `, 마트 ${s.marts}` : ''}, ${s.published ? `v${s.published} 공개` : '공개 전'}</small></span></button>`).join('')}
    <button class="nv add" data-act="dbWz">${svg('plus', 15)}<span class="tx"><b>DB 연결</b><small>새 온톨로지가 함께 만들어져요</small></span></button>
    <div class="nv-h" style="margin-top:6px">AI</div>
    <button class="nv ${ON.scope === 'ask' ? 'on' : ''}" data-act="onScope" data-v="ask">${svg('msg', 16)}<span class="tx"><b>AI 질의 테스트</b><small>공개된 온톨로지를 함께 써요</small></span></button>
  </nav>`;
  let body;
  if (ON.scope === 'ask') body = onAskWrap();
  else if (!ON.scope) body = onEmptyAll();
  else body = onConnView(ON.scope);
  return `${head}<div class="on-shell">${nav}<div class="on-body">${body}</div></div>`;
}
function onEmptyAll() {
  return `<div class="md-empty big">${svg('graph', 36, 1.4)}<b>아직 연결된 DB가 없어요</b><span>DB를 연결하면 그 DB의 온톨로지가 만들어집니다. 연결은 읽기 전용으로 접속만 하고, 객체는 연결한 뒤 객체 구축에서 만들어요.<br>둘러보려면 시연 환경(구매관리 DB, 인사 DB)을 불러올 수 있어요. 회계 ERP DB는 DB 연결 마법사로 직접 연결해 보세요.</span>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn primary" data-act="dbWz">${svg('plus', 15)}DB 연결</button><button class="btn" data-act="onDemoLoad" ${ON.busy.demo ? 'disabled' : ''}>${ON.busy.demo ? '<span class="spin"></span>불러오는 중' : svg('refresh', 15) + '시연 환경 불러오기'}</button></div></div>`;
}
function onConnView(cid) {
  const s = onConn(cid);
  if (!ON.g[cid]) {
    if (!ON.busy['g' + cid]) { ON.busy['g' + cid] = 1; onLoadGraph(cid).catch(e => { ON.g[cid] = { objects:[], links:[], others:{}, error:e.message }; }).then(() => { delete ON.busy['g' + cid]; if (S.view === 'onto') render(); }); }
    return onSpin();
  }
  if (!ON_TABS.some(t => t[0] === ON.tab)) ON.tab = 'graph';
  const objs = onObjs(cid), pub = objs.filter(o => o.status === 'pub').length;
  const cnt = { build:objs.length, mart:s.marts };
  const hd = `<div class="cw-h"><span class="dbi" style="--sc:${onClr(s.clr)}">${svg('graph', 22)}</span>
      <div class="tx"><div class="t1"><h3>${esc(onOntoName(cid))}</h3><span class="fl mute">${s.published ? `v${s.published}` : '공개 전'}</span></div>
        <p class="cw-db">${svg('db', 13)}<b>${esc(s.name)}</b><span class="stt ok">연결됨</span>${esc(s.dbmsLabel)}${s.host ? `, <code class="key">${esc(s.host)}${s.port ? ':' + s.port : ''}/${esc(s.db)}</code>` : (s.demo || String(s.db).startsWith('demo:') ? ', 시연용 SQLite 파일' : `, <code class="key">${esc(s.db)}</code>`)}, 스키마 ${esc(s.schema)}, ${s.mode === 'live' ? '실시간 조회' : '1시간마다 동기화'}</p></div>
      <div class="cw-act"><span class="on-ver">객체 유형 ${objs.length}개 (공개 ${pub}개)</span><button class="btn primary" data-act="onPublish" ${pub ? '' : 'disabled'}>${svg('rocket', 16)}온톨로지 공개</button></div></div>
    <div class="rtabs cw-tabs" role="tablist">${ON_TABS.map(([k, l]) => `<button class="rtab ${ON.tab === k ? 'on m' : ''}" role="tab" aria-selected="${ON.tab === k}" data-act="onTab" data-v="${k}">${l}${cnt[k] != null ? ` <span class="tc">${cnt[k]}</span>` : ''}</button>`).join('')}</div>`;
  const fn = { graph:onGraphTab, build:onBuildTab, mart:onMartTab, explore:onExploreTab, info:onInfoTab }[ON.tab];
  return hd + `<div class="cw-body">${ON.g[cid].error ? `<div class="md-empty">${esc(ON.g[cid].error)}</div>` : fn(cid)}</div>`;
}

/* ===== 그래프 ===== */
const onCross = cid => {
  const g = ON.g[cid], own = new Set(g.objects.map(o => o.id));
  return g.links.filter(l => own.has(l.from) !== own.has(l.to));
};
function onGraphSvg(cid) {
  const g = ON.g[cid], sel = ON.sel, objs = g.objects;
  const tw = t => [...t].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 15 : ch === ' ' ? 5 : 8.5), 0);
  const NW = o => Math.max(180, Math.ceil(52 + Math.max(tw(o.name) + (o.status !== 'pub' || o.mart ? 50 : 12), o.api.length * 7.2 + 12)));
  const byId = Object.fromEntries(objs.map(o => [o.id, o])), own = new Set(objs.map(o => o.id));
  const ls = g.links.filter(l => own.has(l.from) && own.has(l.to));
  if (!objs.length) return '';
  const pos = o => o.pos || [430, 190];
  let minX = Math.min(...objs.map(o => pos(o)[0] - NW(o) / 2)) - 24, maxX = Math.max(...objs.map(o => pos(o)[0] + NW(o) / 2)) + 24;
  let minY = Math.min(...objs.map(o => pos(o)[1])) - 50, maxY = Math.max(...objs.map(o => pos(o)[1])) + 50;
  if (maxX - minX < 760) { const m = (maxX + minX) / 2; minX = m - 380; maxX = m + 380; }
  if (maxY - minY < 260) { const m = (maxY + minY) / 2; minY = m - 130; maxY = m + 130; }
  const pair = {}; ls.forEach(l => { const k = [l.from, l.to].sort().join('|'); (pair[k] = pair[k] || []).push(l); });
  const edges = ls.map(l => {
    const a = pos(byId[l.from]), b = pos(byId[l.to]), on = l.from === sel || l.to === sel, grp = pair[[l.from, l.to].sort().join('|')], idx = grp.indexOf(l);
    let d, lx, ly;
    if (grp.length > 1) {                               // 같은 두 객체를 잇는 링크가 둘 이상이면 휘어서 겹치지 않게 한다
      const off = (idx - (grp.length - 1) / 2) * 90, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const qx = mx - dy / len * off, qy = my + dx / len * off;
      d = `M${a[0]} ${a[1]} Q${qx} ${qy} ${b[0]} ${b[1]}`; lx = .25 * a[0] + .5 * qx + .25 * b[0]; ly = .25 * a[1] + .5 * qy + .25 * b[1];
    } else { d = `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`; lx = (a[0] + b[0]) / 2; ly = (a[1] + b[1]) / 2; }
    minY = Math.min(minY, ly - 30); maxY = Math.max(maxY, ly + 30);
    const w = l.name.length * 12 + 16;
    return `<g class="oe ${l.status !== 'pub' ? 'rv' : ''} ${on ? 'on' : ''}"><path d="${d}"/>
      <g class="ol" transform="translate(${lx} ${ly})"><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11"/><text text-anchor="middle" dominant-baseline="central">${esc(l.name)}</text></g></g>`;
  }).join('');
  const xc = new Set(onCross(cid).flatMap(l => [l.from, l.to]));
  const nodes = objs.map(o => {
    const [x, y] = pos(o), nw = NW(o), X = x - nw / 2, Y = y - 29;
    const badge = o.status !== 'pub' ? [o.status === 'review' ? '검토' : '초안', ''] : o.mart ? ['마트', 'mt'] : null;
    return `<g class="on-n ${o.id === sel ? 'sel' : ''} st-${o.status}" data-act="otSel" data-id="${esc(o.id)}" tabindex="0" role="button" aria-label="${esc(o.name)} 객체 유형" style="--sc:${onClr(onConn(cid).clr)}">
      <rect class="bg" x="${X}" y="${Y}" width="${nw}" height="58" rx="10"/>
      <circle class="ic" cx="${X + 27}" cy="${y}" r="16"/><text class="ict" x="${X + 27}" y="${y}" text-anchor="middle" dominant-baseline="central">${esc(o.name[0])}</text>
      <text class="nm" x="${X + 52}" y="${y - 7}" dominant-baseline="central">${esc(o.name)}</text>
      <text class="ap" x="${X + 52}" y="${y + 12}" dominant-baseline="central">${esc(o.api)}</text>
      ${badge ? `<g transform="translate(${X + nw - 8} ${Y + 8})"><rect class="sb ${badge[1]}" x="-38" y="-1" width="38" height="18" rx="9"/><text class="sbt ${badge[1]}" x="-19" y="8" text-anchor="middle" dominant-baseline="central">${badge[0]}</text></g>` : ''}
      ${xc.has(o.id) ? `<g class="xr" transform="translate(${X + nw - 4} ${Y + 54})"><title>다른 온톨로지 참조가 있어요</title><circle r="9"/><path d="M-3 3 3.5-3.5M-0.5-3.5H3.5V0.5"/></g>` : ''}
    </g>`;
  }).join('');
  return `<svg class="og" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="${esc(onOntoName(cid))} 그래프">${edges}${nodes}</svg>`;
}
const onLegend = () => `<span class="og-leg"><i class="s"></i>링크<i class="r"></i>검토 필요<span class="xr-l">${svg('external', 11)}</span>다른 온톨로지 참조 있음</span>`;
/* 처음 열 때 고르는 객체: 링크가 가장 많은 객체(그래프의 허브) */
const onHub = cid => { const os = onObjs(cid); if (!os.length) return null; return os.slice().sort((a, b) => onObjLinks(cid, b.id).length - onObjLinks(cid, a.id).length || (b.rows || 0) - (a.rows || 0))[0].id; };
function onGraphTab(cid) {
  const g = ON.g[cid], objs = g.objects;
  if (!ON.sel || !onObjOf(cid, ON.sel)) ON.sel = onHub(cid);
  if (!objs.length) return `<div class="md-empty big">${svg('graph', 36, 1.4)}<b>${esc(onOntoName(cid))}에 아직 객체가 없어요</b><span>객체 구축에서 DB 스캔, 마트 생성, 객체 생성으로 온톨로지를 만드세요.</span><button class="btn primary" data-act="onTab" data-v="build">${svg('sparkle', 15)}객체 구축으로</button></div>`;
  const xs = onCross(cid), own = new Set(objs.map(o => o.id));
  const row = l => {
    const out = own.has(l.from), mine = out ? l.from : l.to, other = out ? l.to : l.from, oth = g.others[other] || { name:other, clr:'mcp', connName:'' }, m = onObjOf(cid, mine);
    return `<li><button class="link" data-act="otSel" data-id="${esc(mine)}">${esc(m ? m.name : mine)}</button><span class="xr-ar">${out ? '→' : '←'} ${esc(out ? l.name : l.rev)}</span><button class="xr-to" data-act="otGo" data-id="${esc(other)}" data-conn="${esc(oth.conn || '')}"><i style="background:${onClr(oth.clr)}"></i>${esc(oth.name)}<small>${esc(oth.connName)} 온톨로지</small>${svg('external', 12)}</button>${onSt(l.status)}</li>`;
  };
  return `<section class="box og-box" style="margin-top:0">
      <div class="box-h"><h3>${esc(onOntoName(cid))} 그래프<small>이 온톨로지의 객체만 그립니다</small></h3><div class="og-tools">${onLegend()}</div></div>
      <div class="og-wrap">${onGraphSvg(cid)}</div>
      ${xs.length ? `<div class="xref"><h5>다른 온톨로지 참조 <small>${xs.length}개, 사번이나 부서코드처럼 값이 같은 키로 다른 DB의 온톨로지 객체를 참조합니다</small></h5><ul>${xs.map(row).join('')}</ul></div>` : ''}
    </section>
    ${ON.sel ? onDetail(cid, onObjOf(cid, ON.sel)) : ''}`;
}

/* ===== 객체 상세 ===== */
const onVisProps = o => o.props.filter(p => !/hidden|filter/.test(p.flags.join(' ')));
const onObjLinks = (cid, oid) => (ON.g[cid] ? ON.g[cid].links : []).filter(l => l.from === oid || l.to === oid);
const onFlagChips = fl => fl.map(k => `<span class="fl ${ON_FLAG[k] ? ON_FLAG[k][1] : 'mute'}">${ON_FLAG[k] ? ON_FLAG[k][0] : k}</span>`).join('');
function onDetail(cid, o) {
  const s = onConn(cid), g = ON.g[cid];
  const tabs = [['props', `속성 ${onVisProps(o).length}`], ['links', `링크 ${onObjLinks(cid, o.id).length}`], ['actions', `액션 ${(o.actions || []).length}`], ['perm', '권한'], ['preview', '미리보기'], ['tools', 'AI 도구']];
  const note = o.status === 'review' ? `<div class="notice warn" style="margin:14px 0 0">${svg('sparkle', 18)}<div class="nt"><b>스캔이 제안한 객체입니다.</b> ${esc(o.reviewNote || '속성 이름과 링크가 맞는지 확인한 뒤 검토를 마쳐 주세요.')}</div><button class="btn sm primary" data-act="otDone" data-id="${esc(o.id)}">검토 완료</button></div>`
    : o.status === 'draft' ? `<div class="notice mute" style="margin:14px 0 0">${svg('pencil', 18)}<div class="nt"><b>초안입니다.</b> 아직 AI에 공개되지 않습니다. 속성 권한을 정한 뒤 공개하세요.</div><button class="btn sm" data-act="otDone" data-id="${esc(o.id)}">공개로 전환</button></div>` : '';
  const mm = o.mart ? onMartsOf(cid) : null, mart = Array.isArray(mm) ? mm.find(m => m.id === o.mart) : null;
  const body = ({ props:onProps, links:onLinksTab, actions:onActionsTab, perm:onPermTab, preview:onPreviewTab, tools:onToolsTab })[ON.dtab](cid, o);
  return `<section class="box ot-detail" aria-label="${esc(o.name)} 상세">
    <div class="ot-h">
      <span class="oi lg" style="--sc:${onClr(s.clr)}">${esc(o.name[0])}</span>
      <div class="tx"><div class="t1"><h3>${esc(o.name)}</h3><code>${esc(o.api)}</code>${onSt(o.status)}</div>
        <p>${esc(o.desc)}</p>
        <div class="meta"><span>${svg('db', 14)}${esc(s.name)} <code>${esc(o.table)}</code>${o.isView ? ' <em>뷰</em>' : ''}</span><span>${onN(o.rows)}행</span>${o.filterText ? `<span>${svg('layers', 14)}객체 필터 <code>${esc(o.filterText)}</code></span>` : ''}${o.mergeNote ? `<span>${svg('refresh', 14)}${esc(o.mergeNote)}</span>` : ''}${o.mart ? `<span>${svg('layers', 14)}마트 <button class="link" data-act="martOpen" data-id="${esc(o.mart)}">${esc(mart ? mart.name : o.mart)}</button>${mart ? `, ${esc(mart.refreshLabel)} 갱신` : ''}</span>` : ''}</div></div>
      <label class="pubsw ${o.status === 'pub' ? '' : 'dis'}">AI에게 공개 <span class="sw"><input type="checkbox" data-chg="otAi" data-id="${esc(o.id)}" ${o.status === 'pub' && !o.aiOff ? 'checked' : ''} ${o.status === 'pub' ? '' : 'disabled'} aria-label="AI에게 공개"><span></span></span></label>
    </div>
    ${note}
    <div class="rtabs ot-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="rtab ${ON.dtab === k ? 'on m' : ''}" role="tab" aria-selected="${ON.dtab === k}" data-act="otTab" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="ot-body">${body}</div>
  </section>`;
}
function onProps(cid, o) {
  return `${o.mart ? `<div class="notice" style="margin-bottom:12px">${svg('layers', 18)}<div class="nt">마트 <code class="key">MART.${esc(o.mart)}</code>의 컬럼을 속성으로 씁니다. SQL과 갱신 주기는 마트에서 관리해요.</div><button class="btn sm" data-act="martOpen" data-id="${esc(o.mart)}">마트 보기</button></div>` : ''}<p class="ot-cap">${o.mart ? '마트 컬럼을 속성으로 만들었습니다.' : '컬럼 이름 사전, 공통코드, 값 분포를 보고 표시 이름과 타입을 제안했습니다.'} 이름을 누르면 고칠 수 있어요.</p>
  <div class="mapw"><table class="map" style="min-width:820px"><thead><tr><th>원본 컬럼</th><th></th><th>속성</th><th>타입</th><th>특성</th><th>설명, 변환</th></tr></thead><tbody>
  ${o.props.map((p, i) => { const off = p.flags.includes('hidden') || p.flags.includes('filter');
    return `<tr class="${off ? 'off' : ''}"><td><div class="f">${esc(p.col)}</div><div class="ty">${esc(p.ctype)}</div></td><td class="ar">${svg('arrow', 14)}</td>
      <td>${off ? '<span class="hid">객체 속성 아님</span>' : `<button class="pn" data-act="propEdit" data-i="${i}">${esc(p.name)}${svg('pencil', 12)}</button><div class="ty">${esc(p.api)}</div>`}</td>
      <td>${p.type ? `<span class="mono" style="font-size:12px">${esc(p.type)}</span>` : ''}</td><td>${onFlagChips(p.flags)}</td><td class="dsc">${esc(p.note)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function onLinksTab(cid, o) {
  const ls = onObjLinks(cid, o.id), g = ON.g[cid];
  if (!ls.length) return '<div class="md-empty">연결된 링크가 없습니다.</div>';
  const nm = id => { const x = onObjOf(cid, id) || g.others[id]; return x ? x.name : id; };
  return `<div class="mapw"><table class="map" style="min-width:820px"><thead><tr><th>링크</th><th>관계</th><th>조인 키</th><th>근거</th><th>상태</th></tr></thead><tbody>
  ${ls.map(l => { const out = l.from === o.id, other = out ? l.to : l.from, oth = onObjOf(cid, other) || g.others[other] || {};
    return `<tr><td><b style="font-weight:500">${esc(out ? l.name : l.rev)}</b> <button class="pn" data-act="linkEdit" data-id="${esc(l.id)}" aria-label="링크 이름 고치기">${svg('pencil', 12)}</button><div class="ty">${esc(nm(l.from))} → ${esc(nm(l.to))}, <span class="mono">${esc(out ? l.api : l.rapi)}</span></div></td>
      <td><span class="mono" style="font-size:12px">${out ? l.card : l.card.split(':').reverse().join(':')}</span> <button class="link" data-act="otGo" data-id="${esc(other)}" data-conn="${esc(oth.conn || cid)}">${esc(nm(other))}</button></td>
      <td><span class="f" style="white-space:normal">${esc(l.keyText)}</span></td>
      <td class="dsc">${l.cross ? `<span class="fl ont">${esc(onOntoName(oth.conn || ''))} 참조</span> ` : ''}${esc(l.basis)}</td><td>${onSt(l.status)}${l.status !== 'pub' ? ` <button class="btn sm" data-act="linkOk" data-id="${esc(l.id)}">확인</button>` : ''}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function onActionsTab(cid, o) {
  const as = o.actions || [];
  const lead = `<p class="ot-cap">${svg('shield', 14)}이음은 DB에 직접 쓰지 않습니다. 쓰기는 액션으로 정의하고, 원본 시스템의 API로 실행합니다.</p>`;
  if (!as.length) return lead + `<div class="md-empty">이 객체에는 아직 액션이 없습니다. 액션은 변환 스튜디오에 등록한 쓰기 도구(원본 시스템 API)를 불러 쓰도록 정의합니다. 지금은 시연 환경에서만 미리 만들어 둔 액션이 있어요.</div>`;
  return lead + `<div class="acts-g">${as.map(a => `<div class="act-c">
    <div class="ac-h"><b>${esc(a.name)}</b><code>${esc(a.api)}</code><span class="md-tag w">쓰기</span><span class="fl warn">사용자 확인</span>${a.connected ? '' : '<span class="fl danger">원본 API 연결 없음</span>'}</div>
    <div class="ac-via">${svg('plug', 14)}실행: <code>${esc(a.via)}</code><span class="muted">${esc(a.viaSrc)}</span></div>
    <div class="ac-g"><div><h5>파라미터</h5><ul>${a.params.map(p => `<li><b>${esc(p[0])}</b><span>${esc(p[1])}</span><em>${p[2]}</em></li>`).join('')}</ul></div>
    <div><h5>제출 조건</h5><ul>${a.rules.map(r => `<li>${svg('check', 13, 2.4)}<span>${esc(r)}</span></li>`).join('')}</ul></div></div>
    <div class="ac-eff">${svg('arrow', 13)}${esc(a.effect)}</div></div>`).join('')}</div>`;
}
function onPermTab(cid, o) {
  const p = o.perm, ident = ON.ov.settings.identity || {}, idObj = ident.object ? (ON.g[ident.object.split('.')[0]] ? onObjOf(ident.object.split('.')[0], ident.object) : null) : null;
  const auth = `<div class="notice" style="margin-bottom:14px">${svg('lock', 18)}<div class="nt">권한/인증 layer가 로그인한 사용자의 사번을 알려 주면, 이음이 ${idObj ? `${esc(onOntoName(idObj.conn))}의 <b>${esc(idObj.name)}</b> 객체` : '인사 DB의 직원 객체'}에서 그 사번의 부서와 직급을 읽습니다. 아래 규칙은 그 부서와 직급으로 판단합니다. 이 화면에서는 인증 연동 없이 사용자를 직접 고르는 것으로 대신해요.</div><button class="btn sm" data-act="onIdentity">연결 설정</button></div>`;
  const pii = o.props.filter(x => x.flags.includes('mask') || x.flags.includes('pii')).map(x => x.name);
  if (!p || !(p.rows.length || p.props.length)) {
    return auth + `<div class="perm-g"><div class="box pol"><div class="box-h"><h3>행 권한</h3></div><div class="box-b"><p class="muted" style="margin:0;font-size:13px">별도 규칙 없이 원본 DB 읽기 계정이 볼 수 있는 행을 모두 조회합니다.</p></div></div>
      <div class="box pol"><div class="box-h"><h3>속성 권한</h3></div><div class="box-b"><p class="muted" style="margin:0;font-size:13px">${pii.length ? `${esc(pii.join(', '))}은 마스킹해서 전달합니다.` : '모든 속성을 그대로 전달합니다.'}</p></div></div></div>`;
  }
  const st = ON.users ? null : onNeed('askst', () => api.get('/onto/ask').then(x => { ON.users = x.users; ON.free = x.free; return x; }));
  const users = ON.users, emp = ON.permUser || (users && users[0] && users[0].emp);
  let sim = '';
  if (users && users.length && emp) {
    const r = onNeed(`sim:${o.id}:${emp}`, () => api.get(`/onto/objects/${encodeURIComponent(o.id)}/simulate?emp=${encodeURIComponent(emp)}`));
    const amt = r && r !== 'loading' && !r.error ? p.props.map(x => { const v = r.props[x.col]; return `<span>${esc(x.label)} <b class="${v === true ? '' : v === 'row' ? '' : 'no'}">${v === true ? '보임' : v === 'row' ? '같은 부서 행만' : '가림'}</b></span>`; }).join('') : '';
    sim = `<div class="sim"><span class="lbl2">다른 사용자로 보기</span>
      <span class="seg">${users.map(u => `<button class="${u.emp === emp ? 'on' : ''}" data-act="permUser" data-v="${esc(u.emp)}">${esc(u.name)} (${esc(u.deptName || u.dept)} ${esc(u.rank)})</button>`).join('')}</span>
      <span class="sim-r">${r === 'loading' || !r ? '<span class="spin"></span>' : r.error ? esc(r.error) : `<span>볼 수 있는 ${esc(o.name)} <b>${fmt(r.rows)}</b>건 <small class="muted">(전체 ${fmt(r.total)}건)</small></span>${amt}`}</span></div>`;
  }
  return auth + `<div class="perm-g">
    <div class="box pol"><div class="box-h"><h3>행 권한<small>어떤 행을 볼 수 있는지</small></h3></div><ul class="rules">${p.rows.map(r => `<li><b>${esc(r.label)}</b><span>${esc(r.text)}</span></li>`).join('') || '<li><span class="muted">규칙 없음</span></li>'}</ul></div>
    <div class="box pol"><div class="box-h"><h3>속성 권한<small>어떤 값을 볼 수 있는지</small></h3></div><ul class="rules">${p.props.map(r => `<li><b>${esc(r.label)}</b><span>${esc(r.text)}</span></li>`).join('') || '<li><span class="muted">규칙 없음</span></li>'}</ul></div>
  </div>${sim}<p class="pv-note">규칙은 위에서부터 처음 맞는 하나가 적용됩니다. 어디에도 맞지 않으면 볼 수 있는 행이 없어요. 규칙 수정은 아직 화면에서 지원하지 않고, 서버 API(PUT /api/ieum/onto/objects/{id}/perm)로 고칩니다.</p>`;
}
function onPreviewTab(cid, o) {
  const r = onNeed('pv:' + o.id, () => api.get(`/onto/objects/${encodeURIComponent(o.id)}/preview`));
  if (r === 'loading') return onSpin('원본 DB에서 읽는 중');
  if (r.error) return `<div class="md-empty">${esc(r.error)}</div>`;
  if (!r.rows.length) return '<div class="md-empty">읽을 수 있는 행이 없어요.</div>';
  const val = (c, v) => v == null || v === '' ? '—' : typeof v === 'number' ? fmt(v) + (c.unit || '') : v;
  return `<p class="ot-cap">원본 DB에서 읽기 전용으로 ${r.rows.length}행을 가져와 객체로 바꾼 모습입니다. 마스킹과 코드값 변환이 적용되어 있습니다.</p>
  <div class="twrap" style="margin-top:0"><table class="utbl" style="min-width:${r.cols.length * 140}px"><thead><tr>${r.cols.map(c => `<th class="l">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
  ${r.rows.map(row => `<tr>${r.cols.map(c => `<td class="l" style="font-size:13px">${esc(val(c, row[c.api]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <details class="pv" style="margin-top:12px"><summary>실행한 SQL</summary>${code(r.sql, 'sql')}</details>
  ${r.sample.length ? `<p class="ot-cap" style="margin-top:12px">객체 탐색에서 열기: ${r.sample.slice(0, 4).map(x => `<button class="link" data-act="objOpen" data-oid="${esc(x.oid)}" data-key="${esc(x.key)}">${esc(x.title)}</button>`).join(', ')}</p>` : ''}`;
}
function onToolsTab(cid, o) {
  const r = onNeed('tl:' + o.id, () => api.get(`/onto/objects/${encodeURIComponent(o.id)}/tools`));
  if (r === 'loading') return onSpin();
  if (r.error) return `<div class="md-empty">${esc(r.error)}</div>`;
  const first = r.tools[0];
  const off = !r.published || o.aiOff;
  return `${off ? `<div class="notice mute" style="margin-bottom:12px">${svg('lock', 18)}<div class="nt">지금은 AI에 공개되지 않습니다. ${o.status === 'pub' ? '공개 토글을 켜고' : '검토를 마치고 공개한 뒤'} 온톨로지를 공개하면 아래 도구가 온톨로지 MCP 서버에 추가됩니다.</div></div>` : ''}
  <div class="tools-g"><div><h5 class="h5">만들어지는 도구</h5><ul class="tool-ul">${r.tools.map((t, i) => `<li data-act="onToolPick" data-i="${i}" style="cursor:pointer"><code>${esc(t.name)}</code><span>${esc(t.title)}</span>${t.mode === 'w' ? '<span class="md-tag w">쓰기</span>' : '<span class="md-tag r">읽기</span>'}</li>`).join('')}</ul>
    <p class="pv-note">링크와 액션 이름은 영문 API 이름으로 정해집니다. 점(.)은 MCP 클라이언트가 거절해서 쓰지 않고 __ 로 잇습니다.</p></div>
  <div><h5 class="h5" id="onToolH">${esc(first.name)} 정의</h5><div id="onToolDef">${code({ name:first.name, title:first.title, description:first.desc, inputSchema:first.inputSchema, annotations:first.annotations })}</div></div></div>`;
}
Object.assign(ACT, {
  onToolPick: a => { const r = ON.cache['tl:' + ON.sel]; if (!r || !r.tools) return; const t = r.tools[+a.dataset.i]; $('#onToolH').textContent = `${t.name} 정의`; $('#onToolDef').innerHTML = code({ name:t.name, title:t.title, description:t.desc, inputSchema:t.inputSchema, annotations:t.annotations }); },
});

/* ===== 연결 정보 ===== */
function onInfoTab(cid) {
  const s = onConn(cid), t = s.lastTest || {}, repl = s.replica;
  return `<div class="ci-g">
    <div class="box"><div class="box-h"><h3>접속 정보</h3><button class="btn sm" data-act="onConnTest" data-id="${esc(cid)}" ${ON.busy['ct' + cid] ? 'disabled' : ''}>${ON.busy['ct' + cid] ? '<span class="spin"></span>' : svg('refresh', 14)}연결 테스트</button></div>
      <dl class="ob-props in"><dt>DB 종류</dt><dd>${esc(s.dbmsLabel)}</dd>${s.host ? `<dt>호스트</dt><dd><code class="key">${esc(s.host)}${s.port ? ':' + s.port : ''}</code></dd>` : ''}<dt>${s.demo || s.dbms === 'sqlite' ? '파일' : '데이터베이스'}</dt><dd>${String(s.db).startsWith('demo:') ? '시연용 SQLite 파일 (' + esc(s.db) + ')' : esc(s.db)}</dd><dt>스키마</dt><dd>${esc(s.schema)} (테이블 ${onN(s.tables)}개${s.views ? `, 뷰 ${s.views}개` : ''})</dd>
        <dt>SQL 별칭</dt><dd><code class="key">${esc(s.alias)}</code> 마트 SQL 에서 ${esc(s.alias)}.테이블 로 부릅니다</dd>
        ${s.user ? `<dt>계정</dt><dd><code class="key">${esc(s.user)}</code> 읽기 전용으로 쓰세요</dd>` : '<dt>접속</dt><dd>읽기 전용 (mode=ro, query_only)</dd>'}<dt>커넥터</dt><dd>내장 (이 서버에서 직접 접속)</dd>
        <dt>조회 방식</dt><dd>${s.mode === 'live' ? '실시간 조회' : `1시간마다 동기화${repl ? `, 복제본 ${onN(s.syncRows)}행 (${onWhen(s.synced)})` : ', 아직 복제하지 않음'}`}</dd>
        <dt>쿼리 보호</dt><dd>최대 1,000행, 5초, 동시 4개</dd><dt>마지막 확인</dt><dd>${t.at ? `${onWhen(t.at)}, 응답 ${t.ms}ms` : '—'}</dd></dl></div>
    <div><div class="notice">${svg('shield', 18)}<div class="nt"><b>DB에는 읽기 전용으로만 접속합니다.</b> 연결은 접속만 하고 스키마를 자동으로 읽지 않아요. 객체는 객체 구축에서 DB 스캔, 마트 생성, 객체 생성으로 만듭니다. 데이터를 바꾸는 일은 객체 액션으로 원본 시스템 API를 통해서만 실행합니다.</div></div>
      <h3 class="sec-t" style="margin-top:20px">조회 방식</h3>
      <div class="srow avail" style="margin:0 0 8px"><span class="si">${svg('server', 18)}</span><span class="tx"><b>${s.mode === 'live' ? '실시간 조회' : '주기 동기화'}</b><span>${s.mode === 'live' ? '질문할 때마다 원본 DB에 읽기 쿼리를 보냅니다.' : '객체가 쓰는 테이블을 이음 저장소로 복사해 두고 질문은 복제본에 보냅니다.'}</span></span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${s.mode === 'live' ? `<button class="btn sm" data-act="onMode" data-id="${esc(cid)}" data-v="sync">주기 동기화로 바꾸기</button>` : `<button class="btn sm" data-act="onSyncNow" data-id="${esc(cid)}" ${ON.busy['sy' + cid] ? 'disabled' : ''}>${svg('refresh', 14)}지금 동기화</button><button class="btn sm" data-act="onMode" data-id="${esc(cid)}" data-v="live">실시간 조회로 바꾸기</button>`}</div>
      ${onMcpBox(cid)}
      <h3 class="sec-t" style="margin-top:20px">연결 관리</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="onRename" data-id="${esc(cid)}">${svg('pencil', 14)}이름 바꾸기</button><button class="btn sm danger-b" data-act="onConnDel" data-id="${esc(cid)}">연결 삭제</button></div>
      <p class="pv-note">연결을 삭제하면 그 온톨로지(객체, 링크, 마트, 공개 버전)도 함께 지워집니다.</p></div>
  </div>`;
}

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  onRetry: () => { ON.err = ''; ON.boot = false; onBoot(); render(); },
  onDemoLoad: async () => {
    ON.busy.demo = true; render();
    try { ON.ov = await api.post('/onto/demo/load'); ON.g = {}; ON.cache = {}; ON.scope = ON.ov.conns[0] && ON.ov.conns[0].id; ON.tab = 'graph'; ON.sel = null; ON.mv = null; ON.me = null;
      toast('시연 환경을 불러왔어요. 구매관리 DB와 인사 DB 온톨로지가 만들어졌습니다.'); }
    catch (e) { onErr(e, '시연 환경을 불러오지 못했습니다. '); }
    ON.busy.demo = false; render();
  },
  onScope: a => { const v = a.dataset.v; ON.scope = v; ON.tab = 'graph'; ON.mv = null; ON.me = null; ON.hist = []; ON.cache = {}; ON.sel = null; ON.exItems = null; ON.exKey = ''; ON.obj = null; ON.otype = 'all'; ON.oq = ''; ON.askOut = null; if (v === 'ask') { ON.askSt = null; onAskInit(); } render(); window.scrollTo({ top:0 }); },
  onTab: a => { const v = a.dataset.v; if (v === 'mart') { ON.mv = null; ON.me = null; } if (v === 'explore') { ON.exItems = null; ON.exKey = ''; } ON.tab = v; render(); },
  otSel: a => { ON.sel = a.dataset.id; if (!['build', 'graph'].includes(ON.tab)) ON.tab = 'graph'; ON.mv = null; render(); },
  otGo: async a => {               // 다른 온톨로지의 객체로 이동
    const id = a.dataset.id, cid = a.dataset.conn || id.split('.')[0];
    if (!onConn(cid)) return;
    if (cid !== ON.scope) toast(`${onOntoName(cid)}로 이동했어요.`, 'info');
    ON.scope = cid; ON.tab = 'graph'; ON.sel = id; ON.mv = null; ON.cache = {};
    if (!ON.g[cid]) { try { await onLoadGraph(cid); } catch (e) { onErr(e); } }
    render(); const d = $('.ot-detail'); d && d.scrollIntoView({ block:'start', behavior:'smooth' });
  },
  otSelB: a => { ON.sel = a.dataset.id; ON.tab = 'build'; ON.mv = null; render(); const d = $('#buildDetail'); if (d) d.scrollIntoView({ block:'start', behavior:'smooth' }); },
  otSelGo: async a => { const id = a.dataset.id, cid = id.split('.')[0]; ON.scope = cid; ON.tab = 'graph'; ON.sel = id; ON.dtab = 'props'; ON.mv = null; if (!ON.g[cid]) await onLoadGraph(cid); render(); const d = $('.ot-detail'); d && d.scrollIntoView({ block:'start', behavior:'smooth' }); },
  otTab: a => { ON.dtab = a.dataset.v; render(); },
  otDone: async a => {
    try { const o = await api.post(`/onto/objects/${encodeURIComponent(a.dataset.id)}/review`); await onReload(false, [o.conn]); onToast(`${o.name} 객체 유형을 공개 대상으로 바꿨습니다. 온톨로지를 공개하면 AI에 반영됩니다.`); render(); }
    catch (e) { onErr(e); }
  },
  propEdit: a => {
    const o = onObjOf(ON.scope, ON.sel), p = o.props[+a.dataset.i];
    openModal('속성 이름 고치기', `<div class="field"><label>원본 컬럼</label><span class="mono" style="font-size:13px">${esc(p.col)} ${esc(p.ctype)}</span></div><div class="field"><label>표시 이름</label><input class="inp" id="pnIn" value="${esc(p.name)}"></div><div class="field"><label>API 이름</label><input class="inp mono" id="paIn" value="${esc(p.api)}"></div><div class="field"><label>설명</label><input class="inp" id="pdIn" value="${esc(p.note)}"></div><p class="tab-hint" style="margin:6px 0 0">AI는 표시 이름과 설명을 보고 이 속성의 뜻을 판단합니다.</p>`, '저장', async () => {
      try { await api('PATCH', `/onto/objects/${encodeURIComponent(o.id)}/props/${encodeURIComponent(p.col)}`, { name:$('#pnIn').value, api:$('#paIn').value, note:$('#pdIn').value }); closeModal(); await onReload(false, [o.conn]); render(); toast('속성 이름을 바꿨습니다.'); }
      catch (e) { onErr(e); }
    });
  },
  linkEdit: a => {
    const l = Object.values(ON.g).flatMap(g => g.links).find(x => x.id === a.dataset.id); if (!l) return;
    openModal('링크 이름 고치기', `<p class="tab-hint" style="margin-top:0">${esc(l.keyText)}</p><div class="field"><label>정방향 이름</label><input class="inp" id="lnA" value="${esc(l.name)}"></div><div class="field"><label>정방향 API</label><input class="inp mono" id="lnB" value="${esc(l.api)}"></div><div class="field"><label>역방향 이름</label><input class="inp" id="lnC" value="${esc(l.rev)}"></div><div class="field"><label>역방향 API</label><input class="inp mono" id="lnD" value="${esc(l.rapi)}"></div><p class="tab-hint" style="margin:6px 0 0">API 이름은 AI 도구 이름에 들어갑니다. 공개한 뒤에 바꾸면 다음 공개 때 반영돼요.</p>`, '저장', async () => {
      try { await api('PATCH', `/onto/links/${encodeURIComponent(l.id)}`, { name:$('#lnA').value, api:$('#lnB').value, rev:$('#lnC').value, rapi:$('#lnD').value }); closeModal(); await onReload(false, [ON.scope]); render(); toast('링크 이름을 바꿨습니다.'); }
      catch (e) { onErr(e); }
    });
  },
  linkOk: async a => { try { await api.post(`/onto/links/${encodeURIComponent(a.dataset.id)}/review`); await onReload(false, [ON.scope]); render(); toast('링크를 확인했습니다.'); } catch (e) { onErr(e); } },
  permUser: a => { ON.permUser = a.dataset.v; render(); },
  onConnTest: async a => {
    const c = onConn(a.dataset.id); ON.busy['ct' + c.id] = 1; render();
    try { const r = await api.post('/onto/connections/test', { dbms:c.dbms, name:c.name, host:c.host, port:c.port, db:c.db, user:c.user, schema:c.schema, existing:c.id });
      toast(r.ok ? `${c.name} 연결을 확인했어요. 응답 ${r.ms}ms. ${r.message}` : r.error, r.ok ? '' : 'warn'); await onLoadOv(); }
    catch (e) { onErr(e); }
    delete ON.busy['ct' + c.id]; render();
  },
  onSyncNow: async a => { ON.busy['sy' + a.dataset.id] = 1; render(); try { const r = await api.post(`/onto/connections/${encodeURIComponent(a.dataset.id)}/sync`); await onLoadOv(); toast(`복제했어요. 테이블 ${r.tables}개, ${fmt(r.rows)}행 (${r.ms}ms)`); } catch (e) { onErr(e); } delete ON.busy['sy' + a.dataset.id]; render(); },
  onMode: async a => {
    try { await api.put(`/onto/connections/${encodeURIComponent(a.dataset.id)}`, { mode:a.dataset.v }); await onReload(false); render(); toast(a.dataset.v === 'sync' ? '주기 동기화로 바꿨어요. 객체가 쓰는 테이블을 복제합니다.' : '실시간 조회로 바꿨어요.'); }
    catch (e) { onErr(e); }
  },
  onRename: a => { const c = onConn(a.dataset.id); openModal('연결 이름 바꾸기', `<div class="field"><label>이름</label><input class="inp" id="rnIn" value="${esc(c.name)}"></div>`, '저장', async () => { try { await api.put(`/onto/connections/${encodeURIComponent(c.id)}`, { name:$('#rnIn').value }); closeModal(); await onReload(false); render(); } catch (e) { onErr(e); } }); },
  onConnDel: a => {
    const c = onConn(a.dataset.id);
    openModal('연결 삭제', `<p style="margin-top:0"><b>${esc(c.name)}</b> 연결을 삭제할까요? 이 연결의 온톨로지(객체 ${c.objects}개, 마트 ${c.marts}개, 공개 버전)도 함께 지워지고 되돌릴 수 없어요. 원본 DB는 그대로입니다.</p>`, '삭제', async () => {
      try { await api('DELETE', `/onto/connections/${encodeURIComponent(c.id)}`); closeModal(); delete ON.g[c.id]; await onLoadOv(); ON.scope = ON.ov.conns[0] ? ON.ov.conns[0].id : null; ON.cache = {}; render(); toast('연결을 삭제했어요.'); } catch (e) { onErr(e); } });
  },
  onPublish: async () => {
    const cid = ON.scope;
    try {
      const p = await api.get(`/onto/connections/${encodeURIComponent(cid)}/publish`);
      openModal(`${onOntoName(cid)} v${p.ver} 공개`, `<p style="margin-top:0">공개 객체 유형 <b>${p.pub.length}개</b>와 그 링크 ${p.links}개, 액션 ${p.actions}개를 ${esc(onOntoName(cid))} MCP 서버에 반영합니다. 만들어지는 AI 도구는 ${p.tools}개예요. 다른 온톨로지는 바뀌지 않아요.</p>
        ${p.rest.length ? `<div class="notice warn">${svg('alert', 18)}<div class="nt">검토가 끝나지 않은 ${p.rest.length}개는 이번 공개에서 빠집니다: ${esc(p.rest.map(o => o.name).join(', '))}</div></div>` : ''}
        ${p.off.length ? `<div class="notice mute" style="margin-top:8px">${svg('lock', 18)}<div class="nt">AI 공개를 꺼 둔 ${p.off.length}개도 빠집니다: ${esc(p.off.map(o => o.name).join(', '))}</div></div>` : ''}`, '공개하기', async () => {
        try { const r = await api.post(`/onto/connections/${encodeURIComponent(cid)}/publish`, { by:WS.user || '' }); closeModal(); await onReload(false, [cid]); render(); r.mcp && r.mcp.state === 'error' ? toast(`v${r.ver}를 공개했지만 MCP 서버에는 반영하지 못했어요. ${r.mcp.message}`, 'warn') : toast(`${onOntoName(cid)} v${r.ver}를 공개했습니다. AI 도구 ${r.tools}개가 MCP 서버에 반영됩니다.`); }
        catch (e) { onErr(e); }
      });
    } catch (e) { onErr(e); }
  },
});
Object.assign(CHG, {
  otAi: async el => {
    try { const o = await api.post(`/onto/objects/${encodeURIComponent(el.dataset.id)}/ai`, { on:el.checked }); await onReload(false, [o.conn]); render(); toast(el.checked ? `${onJo(o.name, '을', '를')} AI에 공개합니다.` : `${onJo(o.name, '을', '를')} AI에 공개하지 않습니다.`); }
    catch (e) { onErr(e); el.checked = !el.checked; }
  },
});
const onToast = (m, k) => toast(m, k);
function onDrawerClosed() {
  [ON.dbw, ON.scw, ON.otw].forEach(w => { if (w && w.timer) clearTimeout(w.timer); });
  ON.dbw = ON.scw = ON.otw = null;
}

/* ===== 실행 사용자 확인 설정: 어느 객체가 직원이고 어느 속성이 사번·부서·직급인지 ===== */
async function onIdentityOpen() {
  try {
    await Promise.all(ON.ov.conns.filter(c => !ON.g[c.id]).map(c => onLoadGraph(c.id)));
    const st = ON.ov.settings, id = st.identity || {};
    const objs = ON.ov.conns.flatMap(c => onObjs(c.id).map(o => ({ o, c })));
    if (!objs.length) { toast('먼저 객체를 만들어 주세요. 직원 객체가 있어야 해요.', 'warn'); return; }
    ON.idf = { objs, obj:id.object || '', cols:{ id:id.id || '', dept:id.dept || '', rank:id.rank || '', name:id.name || '' }, ranks:(st.ranks || []).join(', '), users:(st.askUsers || []).join(', ') };
    if (!ON.idf.obj || !objs.some(x => x.o.id === ON.idf.obj)) { const e = objs.find(x => /employee/i.test(x.o.api)) || objs[0]; ON.idf.obj = e.o.id; ON.idf.cols = onIdentityGuess(e.o); }
    openModal('실행 사용자 확인 설정', '<div id="idfBody"></div>', '저장', onIdentitySave, { wide:true });
    onIdentityRender();
  } catch (e) { onErr(e); }
}
function onIdentityGuess(o) {
  const vis = onVisProps(o), by = re => (vis.find(p => re.test(p.col)) || {}).col || '';
  return { id:(o.pk || [])[0] || '', dept:by(/DEPT/i), rank:by(/JBGD|RANK|POS|GRADE/i), name:by(/_NM$|NAME/i) };
}
function onIdentityRender() {
  const f = ON.idf, cur = f.objs.find(x => x.o.id === f.obj), vis = cur ? onVisProps(cur.o) : [];
  const sel = (k, label, opt) => `<div class="field"><label>${label}</label><select class="inp" data-chg="idfCol" data-k="${k}">${opt ? '<option value="">사용 안 함</option>' : ''}${vis.map(p => `<option value="${esc(p.col)}" ${f.cols[k] === p.col ? 'selected' : ''}>${esc(p.name)} (${esc(p.col)})</option>`).join('')}</select></div>`;
  $('#idfBody').innerHTML = `<p class="tab-hint" style="margin-top:0">로그인 인증이 알려 주는 사번으로, 이음이 이 객체에서 그 사람의 부서와 직급을 읽어 권한 규칙을 판단합니다.</p>
    <div class="field"><label>직원 객체</label><select class="inp" data-chg="idfObj">${f.objs.map(x => `<option value="${esc(x.o.id)}" ${f.obj === x.o.id ? 'selected' : ''}>${esc(x.c.name)} · ${esc(x.o.name)}</option>`).join('')}</select></div>
    ${sel('id', '사번', false)}${sel('dept', '부서 코드', true)}${sel('rank', '직급 이름', true)}${sel('name', '이름', true)}
    <div class="field"><label>직급 순서</label><input class="inp" id="idfRanks" value="${esc(f.ranks)}" placeholder="사원, 선임, 책임, 팀장, 본부장"></div><p class="pv-note" style="margin:-4px 0 12px 106px">낮은 직급부터 쉼표로. 권한 규칙의 "팀장 이상"이 이 순서를 씁니다.</p>
    <div class="field"><label>질문 사용자</label><input class="inp" id="idfUsers" value="${esc(f.users)}" placeholder="사번을 쉼표로 (AI 질의 테스트에서 고를 사람)"></div>`;
}
async function onIdentitySave() {
  const f = ON.idf;
  try {
    const cur = f.objs.find(x => x.o.id === f.obj);
    const ranks = $('#idfRanks').value.split(',').map(x => x.trim()).filter(Boolean), users = $('#idfUsers').value.split(',').map(x => x.trim()).filter(Boolean);
    await api.put('/onto/settings', { identity:{ object:cur.o.id, id:f.cols.id, dept:f.cols.dept, rank:f.cols.rank, name:f.cols.name }, ranks, askUsers:users });
    closeModal(); await onLoadOv(); ON.cache = {}; ON.users = null; ON.askSt = null; render(); toast('실행 사용자 확인 설정을 저장했어요.');
  } catch (e) { onErr(e); }
}
Object.assign(ACT, { onIdentity: () => onIdentityOpen() });
Object.assign(CHG, {
  idfObj: el => { const f = ON.idf; f.obj = el.value; f.cols = onIdentityGuess(f.objs.find(x => x.o.id === f.obj).o); f.ranks = $('#idfRanks').value; f.users = $('#idfUsers').value; onIdentityRender(); },
  idfCol: el => { ON.idf.cols[el.dataset.k] = el.value; },
});

/* 변환 스튜디오 */
/* ---------- 변환 스튜디오 ---------- */
function toolListHTML() {
  const ts = srcTools(S.src), q = S.tq.trim().toLowerCase();
  const f = t => S.tf === 'all' || (S.tf === 'review' ? (t.status === 'review' || t.status === 'drift') : t.status === S.tf);
  const list = ts.filter(t => f(t) && (!q || (t.id + t.title + opLabel(t)).toLowerCase().includes(q)));
  if (!list.length) return `<div class="empty-s">이 조건에 맞는 도구가 없습니다.</div>`;
  return list.map(t => `<button class="tool-item ${t.id === S.tool ? 'on' : ''} ${t.status === 'off' ? 'off' : ''}" data-act="pickTool" data-id="${t.id}" aria-pressed="${t.id === S.tool}">
      <span class="tr1"><span class="tn">${t.id}</span>${stt(t.status, TST)}</span>
      <span class="tt">${esc(t.title)} ${t.mode === 'write' ? '<span class="md-tag w" style="font-size:10.5px;line-height:16px;padding:0 5px">쓰기</span>' : ''}</span>
    </button>`).join('');
}
const RULE_OPTS = (list, cur) => list.map(k => `<option value="${k}" ${cur === k ? 'selected' : ''}>${RULE[k][0]}</option>`).join('');
const DATE_FMTS = ['YYYYMMDD', 'YYYYMM', 'YYYY', 'MM', 'epoch'];
const codesText = c => (c || []).map(x => `${x[0]}=${x[1]}`).join(', ');
const ruleCell = (kind, i, x) => {
  const list = kind === 'params' ? ['name', 'keep', 'date', 'time', 'num', 'code', 'pad', 'inject', 'ctx'] : ['name', 'keep', 'date', 'time', 'num', 'code', 'strip', 'mask'];
  const cur = list.includes(x.rule) ? x.rule : list[0];
  let extra = '';
  if (kind === 'params' && cur === 'inject') extra = `<input class="mini mono sub-in" data-inp="mp" data-kind="params" data-i="${i}" data-k="v" value="${esc(x.v ?? x.ex ?? '')}" placeholder="고정값" aria-label="자동 주입 값">`;
  if (kind === 'params' && cur === 'date') extra = `<select class="mini sub-in" data-chg="mp" data-kind="params" data-i="${i}" data-k="ot" aria-label="원본 날짜 형식">${DATE_FMTS.map(f => `<option ${x.ot === f ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
  if (cur === 'code') extra = `<input class="mini mono sub-in" data-inp="mp" data-kind="${kind}" data-i="${i}" data-k="codes" value="${esc(codesText(x.codes))}" placeholder="원본=AI값, 01=annual" aria-label="코드표">`;
  return `<select class="mini" data-chg="mrule" data-kind="${kind}" data-i="${i}" aria-label="변환 규칙">${RULE_OPTS(list, cur)}</select>${extra}`;
};
function mapParamsHTML(t) {
  return `<div class="mapw"><table class="map"><thead><tr><th>원본 필드</th><th></th><th>AI 파라미터</th><th>변환 규칙</th><th>설명</th></tr></thead><tbody>
  ${t.params.map((p, i) => {
    const hid = HIDDEN.has(p.rule);
    return `<tr>
      <td>${p.o ? `<div class="f">${esc(p.o)}</div><div class="ty">${esc(p.loc ? p.loc + ', ' : '')}${esc(p.ot)}</div>` : '<span class="hid">원본 필드 없음</span>'}</td>
      <td class="ar">${svg('arrow', 14)}</td>
      <td>${hid ? '<span class="hid">AI에 노출 안 함</span>' : `<input class="mini f" data-inp="mp" data-kind="params" data-i="${i}" data-k="a" value="${esc(p.a)}" aria-label="AI 파라미터 이름">
        <div class="ty">${esc(p.at)}${p.req ? '<span class="req" title="필수">*</span>' : ''}</div>`}</td>
      <td>${ruleCell('params', i, p)}</td>
      <td class="dsc"><input class="mini" data-inp="mp" data-kind="params" data-i="${i}" data-k="d" value="${esc(p.d || '')}" aria-label="파라미터 설명"></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function mapResHTML(t) {
  if (!t.res.length) return `<div class="md-empty">명세에서 응답 필드를 찾지 못했습니다. 원본 응답을 그대로 AI에게 전달합니다.</div>`;
  return `<div class="mapw"><table class="map"><thead><tr><th>원본 응답 필드</th><th></th><th>AI 결과 필드</th><th>변환 규칙</th><th>예시</th></tr></thead><tbody>
  ${t.res.map((r, i) => {
    const drift = r.drift && !r.fixed;
    const cut = (v, n) => { v = String(v ?? ''); return esc(v.length > n ? v.slice(0, n) + '…' : v); };
    return `<tr class="${drift ? 'dr' : ''}">
      <td>${drift ? `<div class="f old">${esc(r.o)}</div><div class="f">${esc(r.newO)} <span class="gs-tag">새 필드</span></div>` : `<div class="f">${esc(r.fixed ? r.newO : r.o)}${r.guess ? '<span class="gs-tag">추정</span>' : ''}</div>`}</td>
      <td class="ar">${svg('arrow', 14)}</td>
      <td><input class="mini f" data-inp="mp" data-kind="res" data-i="${i}" data-k="a" value="${esc(r.a)}" aria-label="AI 결과 필드 이름"><div class="ty">${esc(r.at)}</div></td>
      <td>${ruleCell('res', i, r)}</td>
      <td><span class="exv">${drift ? '<span style="color:var(--danger)">값 없음 (null)</span>' : cut(r.ov, 30)}</span></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function previewHTML(t) {
  if (S.ptab === 'req') return code(origReq(t), 'http') + `<p class="pv-note">예시 값으로 만든 원본 요청입니다. 인증 정보는 이음 보관소에서 꺼내 넣고, AI에게는 보여주지 않습니다.</p>`;
  if (S.ptab === 'res') return `<div class="cmp"><div><p class="cap"><i style="background:var(--rag)"></i>원본 응답</p>${code(origResp(t), 'http')}</div><div><p class="cap"><i style="background:var(--mcp)"></i>AI에게 전달하는 결과</p>${code(aiResult(t))}</div></div>`;
  return code(mcpDef(t)) + `<p class="pv-note">AI 모델은 이 정의만 봅니다. 원본 필드 이름, 코드값, 인증 정보는 드러나지 않습니다.</p>`;
}
function noticeHTML(t) {
  if (t.status === 'drift') { const r = t.res.find(x => x.drift && !x.fixed);
    if (!r) return `<div class="notice warn td-notice">${svg('alert', 18)}<div class="nt"><b>원본 명세가 바뀌었습니다.</b> ${esc(t.driftMsg || '')}</div><button class="btn sm" data-act="include">확인했고 계속 공개</button></div>`;
    return `<div class="notice warn td-notice">${svg('alert', 18)}<div class="nt"><b>원본 명세가 바뀌었습니다.</b> 응답 필드 <span class="inline-code">${r.o}</span> → <span class="inline-code">${r.newO}</span>. 이 때문에 지금은 <span class="inline-code">${r.a}</span> 값이 비어서 전달됩니다. 오늘 새벽 명세를 다시 읽으면서 감지했습니다.</div><button class="btn sm primary" data-act="fixDrift">새 필드로 매핑</button></div>`; }
  if (t.status === 'review' && t.mode === 'write') return `<div class="notice warn td-notice">${svg('shield', 18)}<div class="nt"><b>데이터를 만들거나 바꾸는 쓰기 작업입니다.</b> 실행 방식이 사용자 확인 후 실행인지, 설명이 AI가 오해하지 않게 쓰였는지 확인한 뒤 검토를 마쳐 주세요.</div><button class="btn sm primary" data-act="reviewDone">검토 완료</button></div>`;
  if (t.status === 'review' && t.disc) { const ev = t.disc.ev, v = dVerify({ verify:t.disc.verify });
    return `<div class="notice ${ev === 'both' ? '' : 'warn'} td-notice">${svg('search', 18)}<div class="nt"><b>자동 탐색으로 찾은 API입니다.</b> 근거는 ${ev === 'both' ? '소스와 운영 트래픽 모두' : ev === 'src' ? 'Git 소스뿐' : '운영 트래픽뿐'}이고, 검증 결과는 ${v[0]}입니다.${ev === 'tr' ? ' 소스가 없어 타입은 관찰한 값으로 추정했습니다.' : ''}${t.disc.recNote ? ` ${esc(t.disc.recNote)}` : ''} <button class="link" data-act="discEv" data-job="${t.disc.job}" data-id="${t.disc.id}">탐색 근거 보기</button></div><button class="btn sm primary" data-act="reviewDone">검토 완료</button></div>`; }
  if (t.status === 'review' && !t.guess) return `<div class="notice td-notice">${svg('info', 18)}<div class="nt"><b>명세를 읽어 자동으로 만든 도구 후보입니다.</b> 설명과 파라미터 매핑이 맞는지 확인한 뒤 공개하세요.</div><button class="btn sm primary" data-act="reviewDone">검토 완료</button></div>`;
  if (t.status === 'review') return `<div class="notice td-notice">${svg('info', 18)}<div class="nt"><b>호출 샘플 12건으로 형식을 추론했습니다.</b> 추정 표시가 있는 필드의 의미가 맞는지 확인해 주세요. 맞지 않으면 필드 이름과 설명을 고친 뒤 저장하세요.</div><button class="btn sm primary" data-act="reviewDone">확인 완료</button></div>`;
  if (t.status === 'off') return `<div class="notice mute td-notice">${svg('lock', 18)}<div class="nt"><b>AI 공개 대상에서 제외된 작업입니다.</b> ${esc(t.offReason || '')}</div><button class="btn sm" data-act="include">다시 포함</button></div>`;
  return '';
}
function toolDetailHTML(t) {
  const s = SRC[t.src], rc = ruleCounts(t), vis = visibleParams(t).length;
  const canPub = t.status === 'done' || t.status === 'off';
  return `
  <div class="td-head">
    <div class="tx">
      <div class="t1"><h3>${t.id}</h3>${stt(t.status, TST)}${modeTag(t.mode)}</div>
      <p>${esc(t.title)}<code>${esc(opLabel(t))}</code></p>
    </div>
    <div class="acts">
      <label class="pubsw ${canPub ? '' : 'dis'}" title="${canPub ? '' : '검토를 마쳐야 공개할 수 있습니다'}">AI에게 공개 <span class="sw"><input type="checkbox" data-chg="pub" ${t.status === 'done' ? 'checked' : ''} ${canPub ? '' : 'disabled'} aria-label="AI에게 공개"><span></span></span></label>
      <button class="btn" data-act="tryTool" ${t.status === 'off' ? 'disabled' : ''}>${svg('play', 15)}테스트 실행</button>
      <button class="btn primary" data-act="saveTool" id="saveBtn" ${t._dirty ? '' : 'disabled'}>변경사항 저장</button>
    </div>
  </div>
  ${noticeHTML(t)}
  <div class="pipe" aria-label="변환 흐름">
    <div class="pp src"><span class="pl">원본 작업</span><b>${esc(opLabel(t))}</b><span>${PDESC[s.proto]}</span><span>입력 ${t.params.filter(p => p.o).length}개, 응답 ${t.res.length}개</span></div>
    <div class="plink"><i></i></div>
    <div class="pp hub"><span class="hb">${MARK(20)}이음 변압기</span><span class="rc">${Object.entries(rc).map(([k, n]) => `<span>${RULE[k][0]} ${n}</span>`).join('')}</span></div>
    <div class="plink"><i></i></div>
    <div class="pp ai"><span class="pl">AI 도구</span><b>${t.id}</b><span>MCP 도구, JSON Schema</span><span>AI에 입력 ${vis}개 노출</span></div>
  </div>
  <div class="td-grid">
    <div>
      <div class="sec2 desc-ed"><h4>AI가 읽는 도구 설명 <small>AI는 이 설명을 보고 언제 이 도구를 쓸지 판단합니다</small></h4>
        <textarea data-inp="desc" aria-label="도구 설명">${esc(t.desc)}</textarea>
        <div class="row"><span id="descCnt">${t.desc.length}자</span><button class="link" data-act="rewrite">${'AI로 다시 쓰기'}</button></div>
      </div>
      <div class="sec2"><h4>입력 파라미터 매핑 <small><span style="color:var(--danger)">*</span> 필수, 보라색 규칙은 AI에게 보이지 않습니다</small></h4>${mapParamsHTML(t)}</div>
      <div class="sec2"><h4>응답 매핑</h4>${mapResHTML(t)}</div>
    </div>
    <div class="sec2">
      <div class="box pol"><div class="box-h"><h3>실행 정책</h3></div><div class="box-b">
        <div class="d-label">실행 방식</div>
        <button class="opt ${t.exec === 'auto' ? 'on' : ''}" data-act="exec" data-v="auto" ${t.mode === 'write' ? 'disabled' : ''}><span class="radio"></span><span><b>바로 실행</b><small>조회처럼 결과만 읽는 작업에 권장합니다</small></span></button>
        <button class="opt ${t.exec === 'confirm' ? 'on' : ''}" data-act="exec" data-v="confirm"><span class="radio"></span><span><b>사용자 확인 후 실행</b><small>${t.mode === 'write' ? '쓰기 작업은 이 방식만 쓸 수 있습니다' : 'AI가 호출하기 전에 사용자에게 내용을 보여 줍니다'}</small></span></button>
        <div class="gap sm"></div>
        <div class="tg first"><span class="tx"><b>개인정보 마스킹</b><small>전화번호, 이메일, 주민등록번호 일부를 가려서 전달</small></span><span class="sw"><input type="checkbox" data-chg="pol" data-k="mask" ${t.mask ? 'checked' : ''} aria-label="개인정보 마스킹"><span></span></span></div>
        <div class="tg"><span class="tx"><b>응답 캐시</b><small>같은 요청은 10분 동안 원본을 다시 부르지 않음</small></span><span class="sw"><input type="checkbox" data-chg="pol" data-k="cache" ${t.cache ? 'checked' : ''} ${t.mode === 'write' ? 'disabled' : ''} aria-label="응답 캐시"><span></span></span></div>
        <div class="tg"><span class="tx"><b>사용자당 호출 한도</b><small>1분 기준, 넘으면 AI에게 잠시 후 다시 시도하라고 알림</small></span><input class="inp" type="number" min="1" max="600" value="${t.limit}" data-inp="limit" aria-label="분당 호출 한도"></div>
      </div></div>
    </div>
  </div>
  <div class="sec2"><h4>미리보기<span class="sp"></span>
    <span class="seg" role="tablist">${[['mcp', 'MCP 도구 정의'], ['req', '원본 요청'], ['res', '응답 변환']].map(([v, l]) => `<button role="tab" class="${S.ptab === v ? 'on' : ''}" aria-selected="${S.ptab === v}" data-act="ptab" data-v="${v}">${l}</button>`).join('')}</span></h4>
    <div id="preview">${previewHTML(t)}</div>
  </div>`;
}
function vStudio() {
  const srcs = SOURCES.filter(s => srcTools(s.id).length);
  if (!srcs.length) return pageHead('studio') + `<div class="md-empty" style="margin:20px 0">아직 AI 도구가 없습니다. <button class="link" data-act="nav" data-v="src">원본 시스템</button>을 연결하면 도구 후보가 만들어집니다.</div>`;
  if (!srcTools(S.src).length) S.src = srcs[0].id;
  const s = SRC[S.src], ts = srcTools(s.id);
  let t = TOOL[S.tool]; if (!t || t.src !== s.id) { t = ts[0]; S.tool = t.id; }
  const cnt = { all: ts.length, review: ts.filter(x => x.status === 'review' || x.status === 'drift').length, done: ts.filter(x => x.status === 'done').length, off: ts.filter(x => x.status === 'off').length };
  return pageHead('studio') + `
  <div class="toolbar">
    <span class="lbl2">원본 시스템</span>
    <select class="sel-f" data-chg="src" aria-label="원본 시스템 선택" style="max-width:280px">${srcs.map(x => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    ${prBadge(s.proto)}<span class="muted" style="font-size:13px">${esc(s.spec)}, 마지막 동기화 ${esc(s.sync)}</span>
    <span class="sp"></span>
    ${s.proto === 'disc' ? '' : `<button class="btn" data-act="reread">${svg('refresh', 16)}명세 다시 읽기</button>`}
  </div>
  <div class="studio">
    <section class="panel" aria-label="도구 목록">
      <div class="p-head">도구 목록 <span class="cnt">${cnt.all}개</span></div>
      <div class="tl-f">${[['all', '전체'], ['review', '검토 필요'], ['done', '공개 중'], ['off', '제외']].map(([v, l]) => `<button class="${S.tf === v ? 'on' : ''}" data-act="tf" data-v="${v}">${l}<b>${cnt[v]}</b></button>`).join('')}</div>
      <div class="p-search"><div class="search full"><input type="search" placeholder="도구 이름으로 검색" aria-label="도구 검색" data-inp="tq" value="${esc(S.tq)}"><span class="s-btn">${svg('search', 16)}</span></div></div>
      <div class="tool-list" id="toolList">${toolListHTML()}</div>
    </section>
    <section id="toolDetail" aria-label="도구 상세">${toolDetailHTML(t)}</section>
  </div>`;
}


/* 동작 */
Object.assign(ACT, {
  goTool: a => { const t = TOOL[a.dataset.id]; closeDrawer(); Object.assign(S, { src:t.src, tool:t.id, tf:a.dataset.f || 'all', tq:'' }); go('studio'); },
  tf: a => { S.tf = a.dataset.v; $$('.tl-f button').forEach(b => b.classList.toggle('on', b.dataset.v === S.tf)); $('#toolList').innerHTML = toolListHTML(); },
  pickTool: a => { S.tool = a.dataset.id; refreshTool(); if (innerWidth <= 1100) $('#toolDetail').scrollIntoView({ block:'start', behavior:'smooth' }); },
  ptab: a => { S.ptab = a.dataset.v; $$('.seg button[data-act="ptab"]').forEach(b => { b.classList.toggle('on', b.dataset.v === S.ptab); b.setAttribute('aria-selected', b.dataset.v === S.ptab); }); $('#preview').innerHTML = previewHTML(curTool()); },
  rewrite: () => {
    const t = curTool(); const btn = $('[data-act="rewrite"]'); btn.disabled = true; btn.textContent = '쓰는 중…';
    api.post(`/studio/${t.id}/rewrite/`, { desc:t.desc, again:!!t._orig }).then(r => {
      if (!t._orig) t._orig = t.desc;
      t.desc = r.desc; $('[data-inp="desc"]').value = t.desc; $('#descCnt').textContent = t.desc.length + '자';
      if (S.ptab === 'mcp') $('#preview').innerHTML = previewHTML(t);
      markDirty(); toast('AI가 설명을 다시 썼습니다. 마음에 들지 않으면 한 번 더 누르세요.', 'info');
    }).catch(e => toast(e.message, 'warn')).finally(() => { btn.disabled = false; btn.textContent = 'AI로 다시 쓰기'; });
  },
  fixDrift: () => { const t = curTool(); t.res.forEach(r => { if (r.drift) r.fixed = true; }); t.status = 'done'; markDirty(); refreshTool(); toast('새 필드로 매핑했습니다. 저장하면 다음 호출부터 적용됩니다.'); },
  reviewDone: () => { const t = curTool(); t.status = 'done'; t.res.forEach(r => delete r.guess); markDirty(); refreshTool(); toast(`${t.id} 검토를 마치고 공개했습니다.`); },
  include: () => { const t = curTool(); t.status = 'done'; markDirty(); refreshTool(); toast(`${t.id} 도구를 다시 공개했습니다.`); },
  exec: a => { const t = curTool(); if (t.mode === 'write' && a.dataset.v === 'auto') return; t.exec = a.dataset.v; markDirty(); $$('.opt[data-act="exec"]').forEach(b => b.classList.toggle('on', b.dataset.v === t.exec)); if (S.ptab === 'mcp') $('#preview').innerHTML = previewHTML(t); },
  saveTool: () => { const t = curTool(); const btn = $('#saveBtn'); btn.disabled = true;
    api.put(`/studio/${t.id}/`, t).then(() => { t._dirty = false; delete t._orig; t._ri = 0; toast('저장했습니다. 다음 배포 때 반영됩니다.'); })
      .catch(e => { btn.disabled = false; toast(`저장하지 못했습니다. ${e.message}`, 'warn'); }); },
  tryTool: () => { S.pg.tool = curTool().id; S.pg.out = null; go('play'); },
  reread: () => {
    const s = SRC[S.src];
    api.post(`/sources/${s.id}/reread/`).then(r => {
      srcTools(s.id).forEach(t => delete TOOL[t.id]);
      Object.assign(s, r.source); TOOLS[s.id] = r.tools; indexTools(); render();
      const msg = [r.added.length && `새 작업 ${r.added.length}개를 도구 후보로 추가했습니다`, r.drifted.length && `명세가 바뀐 도구 ${r.drifted.length}개가 있습니다`].filter(Boolean).join(', ');
      toast(msg ? `명세를 다시 읽었습니다. ${msg}.` : '명세를 다시 읽었습니다. 바뀐 내용이 없습니다.', r.drifted.length ? 'warn' : '');
    }).catch(e => { s.err = true; render(); toast(e.message, 'warn'); });
  },
});

/* 동작 */
Object.assign(INP, {
  tq: el => { S.tq = el.value; $('#toolList').innerHTML = toolListHTML(); },
  desc: el => { const t = curTool(); t.desc = el.value; $('#descCnt').textContent = el.value.length + '자'; if (S.ptab === 'mcp') $('#preview').innerHTML = previewHTML(t); markDirty(); },
  limit: el => { const t = curTool(); t.limit = +el.value || 1; markDirty(); },
});

/* 동작 */
Object.assign(CHG, {
  src: el => { Object.assign(S, { src:el.value, tool:srcTools(el.value)[0].id, tf:'all', tq:'' }); render(); },
  pub: el => { const t = curTool(); t.status = el.checked ? 'done' : 'off'; if (!el.checked && !t.offReason) t.offReason = '관리자가 공개를 껐습니다.'; markDirty(); refreshTool(); toast(el.checked ? `${t.id} 도구를 공개했습니다.` : `${t.id} 도구를 AI 공개 대상에서 뺐습니다.`); },
  pol: el => { const t = curTool(); t[el.dataset.k] = el.checked; markDirty(); },
});

/* 매핑 인라인 편집 */
const TYPE_BY_RULE = { date:'string (date)', num:'number', time:'string', code:'string', pad:'string' };
function editMap(el) {
  const t = curTool(), x = t[el.dataset.kind][+el.dataset.i], k = el.dataset.k, v = el.value;
  if (k === 'codes') x.codes = v.split(',').map(z => z.trim()).filter(Boolean).map(z => { const [o, a] = z.split('=').map(q => q.trim()); return [o, a ?? o, '']; });
  else x[k] = v;
  if (S.ptab === 'mcp') $('#preview').innerHTML = previewHTML(t);
  markDirty();
}
Object.assign(INP, { mp: editMap });
Object.assign(CHG, {
  mp: editMap,
  mrule: el => {
    const t = curTool(), x = t[el.dataset.kind][+el.dataset.i], r = el.value;
    x.rule = r;
    if (TYPE_BY_RULE[r] && el.dataset.kind === 'res') x.at = TYPE_BY_RULE[r];
    if (TYPE_BY_RULE[r] && el.dataset.kind === 'params' && !HIDDEN.has(r)) x.at = TYPE_BY_RULE[r];
    if (r === 'inject' && x.v === undefined) x.v = x.ex ?? '';
    if (r === 'date' && el.dataset.kind === 'params' && !DATE_FMTS.includes(x.ot)) x.ot = 'YYYYMMDD';
    if (r === 'code' && !x.codes) x.codes = [];
    markDirty(); refreshTool();
  },
});

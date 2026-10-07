/* 테스트 실행: 도구를 실제로 호출해 변환 과정을 확인한다 */
/* ---------- 테스트 실행 ---------- */
const argDefault = p => { const v = p.ax !== undefined ? p.ax : p.ex; return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); };
function pgArgs(t) {
  const a = S.pg.args[t.id] = S.pg.args[t.id] || {};
  visibleParams(t).forEach(p => { if (a[p.a] === undefined) a[p.a] = argDefault(p); });
  return a;
}
/* 입력 칸의 글자를 도구 인자 타입에 맞게 바꾼다. 빈 칸은 보내지 않는다. */
function pgCoerce(t) {
  const a = pgArgs(t), out = {};
  for (const p of visibleParams(t)) {
    const raw = a[p.a]; if (raw === '' || raw == null) continue;
    const ty = (p.at || 'string').split(' ')[0];
    if (ty === 'integer' || ty === 'number') { const n = Number(raw); if (Number.isNaN(n)) throw new Error(`${p.a} 는 숫자여야 합니다.`); out[p.a] = n; }
    else if (ty === 'boolean') out[p.a] = raw === 'true';
    else if (ty === 'object' || ty === 'array') { try { out[p.a] = JSON.parse(raw); } catch (e) { throw new Error(`${p.a} 는 JSON 형식이어야 합니다.`); } }
    else out[p.a] = raw;
  }
  return out;
}
function pgArgsHTML(t) {
  const a = pgArgs(t), ps = visibleParams(t);
  if (!ps.length) return `<p class="tab-hint" style="margin:0">이 도구는 입력이 필요 없습니다.</p>`;
  return ps.map(p => {
    const opts = p.codes && p.codes.length ? p.codes.map(c => c[1]) : p.enum;
    const ty = (p.at || 'string').split(' ')[0];
    const inp = opts ? `<select class="inp" data-chg="pgArg" data-k="${esc(p.a)}"><option value=""></option>${opts.map(o => `<option ${String(a[p.a]) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : ty === 'boolean' ? `<select class="inp" data-chg="pgArg" data-k="${esc(p.a)}"><option></option><option ${a[p.a] === 'true' ? 'selected' : ''}>true</option><option ${a[p.a] === 'false' ? 'selected' : ''}>false</option></select>`
      : `<input class="inp ${ty === 'object' || ty === 'array' ? 'mono' : ''}" data-inp="pgArg" data-k="${esc(p.a)}" value="${esc(a[p.a])}" aria-label="${esc(p.a)}">`;
    return `<div class="field"><label title="${esc(p.d || '')}">${esc(p.a)}${p.req ? '<span class="req" style="color:var(--danger)"> *</span>' : ''}</label>${inp}</div>`;
  }).join('');
}
function vPlay() {
  const tools = allTools().filter(t => t.status !== 'off');
  if (!tools.length) return pageHead('play') + `<div class="md-empty" style="margin:20px 0">테스트할 도구가 없습니다. <button class="link" data-act="nav" data-v="src">원본 시스템</button>을 연결해 도구를 만들어 주세요.</div>`;
  if (!TOOL[S.pg.tool] || TOOL[S.pg.tool].status === 'off') S.pg.tool = tools[0].id;
  const t = TOOL[S.pg.tool], busy = S.pg.phase === 'running';
  return pageHead('play') + `
  <div class="pg">
    <section class="box chat" aria-label="도구 호출">
      <div class="box-h">
        <div class="r1"><h3>도구 호출</h3><span class="ctx">${svg('user', 14)}호출 사용자 ${esc(WS.user)}</span></div>
        <span class="seg" role="radiogroup" aria-label="AI 모델">${Object.entries(MODELS).map(([k, m]) => `<button role="radio" aria-checked="${S.pg.model === k}" class="${S.pg.model === k ? 'on' : ''}" data-act="pgModel" data-v="${k}">${m.label}</button>`).join('')}</span>
      </div>
      <div class="pg-direct" id="pgForm">
        <div class="field"><label>도구</label><select class="inp" data-chg="pgTool" aria-label="도구 선택">${SOURCES.map(s => `<optgroup label="${esc(s.name)}">${srcTools(s.id).filter(x => x.status !== 'off').map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${x.id}${x.mode === 'write' ? ' (쓰기)' : ''}${x.status === 'review' || x.status === 'drift' ? ' · 검토 중' : ''}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <p class="tab-hint" style="margin:0">${esc(t.desc)}</p>
        <div id="pgArgs">${pgArgsHTML(t)}</div>
        <div class="row2"><button class="btn primary" data-act="pgExec" ${busy ? 'disabled' : ''}>${svg('play', 15)}${busy ? '호출하는 중…' : '실행'}</button><button class="btn" data-act="pgReset">${svg('refresh', 14)}초기화</button></div>
      </div>
      ${PG_CHAT ? `<div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="ask"><input class="inp" id="pgIn" placeholder="자연어로 질문하면 Claude가 도구를 골라 실행합니다" aria-label="질문 입력"><button class="btn primary" data-act="pgSend" aria-label="보내기">${svg('send', 16)}</button></div>`
        : `<p class="tab-hint" style="padding:0 16px 14px;margin:0">서버에 <span class="inline-code">ANTHROPIC_API_KEY</span> 환경변수를 설정하면 자연어 질문으로도 테스트할 수 있습니다.</p>`}
    </section>
    <section class="box" aria-label="변환 과정">
      <div class="box-h"><h3>변환 과정<small id="trSub"></small></h3></div>
      <div id="trace"></div>
    </section>
  </div>`;
}
function renderChat() {
  const el = $('#msgs'); if (!el) return;
  el.innerHTML = S.pg.chat.map(m => m.r === 'u' ? `<div class="msg u">${esc(m.t)}</div>`
    : `<div class="msg a"><span class="by">${m.err ? '오류' : 'Claude'}</span>${esc(m.t)}${(m.calls || []).map((c, i) => `<div><button class="chip" data-act="pgShow" data-i="${m.i}" data-j="${i}">${esc(c.tool)} ${c.ok ? '✓' : '✕'} 변환 과정 보기</button></div>`).join('')}</div>`).join('')
    + (S.pg.phase === 'chat' ? `<div class="msg a typing">도구를 호출하는 중<i></i><i></i><i></i></div>` : '');
  el.scrollTop = el.scrollHeight;
}
function renderTrace() {
  const el = $('#trace'); if (!el) return;
  const sub = $('#trSub'), o = S.pg.out;
  if (!o) {
    el.innerHTML = `<div class="trace-empty">${svg('layers', 40, 1.4)}<br>도구를 실행하면 AI의 도구 호출이 원본 시스템 요청으로<br>어떻게 바뀌는지 여기에 실제 요청과 응답으로 보여 드립니다.</div>`;
    if (sub) sub.textContent = ''; return;
  }
  const t = TOOL[o.tool];
  if (sub) sub.textContent = t ? `${t.id}, ${SRC[t.src].name}` : '';
  const steps = buildRealTrace(o.tool, o.model || S.pg.model, o, S.pg.phase === 'hold');
  el.innerHTML = traceHTML(steps, steps.length, S.pg.phase === 'hold' ? null : true, false);
}
async function pgExec(approved) {
  const t = TOOL[S.pg.tool];
  let args; try { args = pgCoerce(t); } catch (e) { toast(e.message, 'warn'); return; }
  S.pg.phase = 'running'; S.pg.out = null; render();
  try {
    const out = await api.post('/playground/call/', { tool:t.id, args, model:S.pg.model, approved:!!approved, user:WS.user });
    if (out.hold) { S.pg.phase = 'hold'; S.pg.out = { tool:t.id, model:S.pg.model, ok:false, trace:{ args } }; }
    else { S.pg.phase = 'done'; S.pg.out = { ...out, tool:t.id, model:S.pg.model }; }
  } catch (e) { S.pg.phase = 'idle'; toast(e.message, 'warn'); }
  if (S.view === 'play') render();
}
async function pgSend() {
  const inp = $('#pgIn'); const q = inp.value.trim(); if (!q || S.pg.phase === 'chat') return;
  inp.value = '';
  S.pg.chat.push({ r:'u', t:q }); S.pg.phase = 'chat'; renderChat();
  try {
    const r = await api.post('/playground/chat/', { message:q, user:WS.user });
    S.pg.chat.push({ r:'a', t:r.answer || '(답변 없음)', calls:r.calls, i:S.pg.chat.length });
    const last = r.calls[r.calls.length - 1];
    if (last) S.pg.out = { tool:last.tool, model:'claude', ok:last.ok, trace:last.trace, error:last.ok ? '' : '호출에 실패했습니다.' };
  } catch (e) { S.pg.chat.push({ r:'a', t:e.message, err:true }); }
  S.pg.phase = 'idle'; renderChat(); renderTrace();
}

/* 동작 */
Object.assign(ACT, {
  pgExec: () => pgExec(false),
  pgSend: () => pgSend(),
  pgModel: a => { S.pg.model = a.dataset.v; render(); },
  pgShow: a => { const m = S.pg.chat[+a.dataset.i], c = m.calls[+a.dataset.j]; S.pg.out = { tool:c.tool, model:'claude', ok:c.ok, trace:c.trace, error:c.ok ? '' : '호출에 실패했습니다.' }; renderTrace(); },
  approve: () => pgExec(true),
  reject: () => { S.pg.phase = 'idle'; S.pg.out = null; render(); toast('실행하지 않았습니다.', 'info'); },
  pgReset: () => { Object.assign(S.pg, { args:{}, phase:'idle', out:null, chat:[] }); render(); },
});
Object.assign(INP, { pgArg: el => { pgArgs(TOOL[S.pg.tool])[el.dataset.k] = el.value; } });
Object.assign(CHG, {
  pgTool: el => { S.pg.tool = el.value; S.pg.out = null; S.pg.phase = 'idle'; render(); },
  pgArg: el => { pgArgs(TOOL[S.pg.tool])[el.dataset.k] = el.value; },
});

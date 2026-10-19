/* 온톨로지: 객체 구축 탭, DB 연결 마법사, DB 스캔 마법사, 객체 생성 마법사 */

const ON_TOOLS = [['scan', 'DB 스캔으로 자동 구성', '스키마를 읽어 객체와 링크 후보를 한 번에 제안합니다. 처음 구축할 때 쓰세요.', 'scanWz', '스캔 시작', 'sparkle'],
  ['mart', '마트 생성', 'SQL로 테이블을 조인하거나 집계한 결과를 마트로 만듭니다. 다른 연결의 테이블도 조인할 수 있어요.', 'martNew', '마트 만들기', 'code'],
  ['obj', '객체 생성', '테이블이나 마트 하나를 원본으로 골라 객체 유형을 직접 정의합니다.', 'otNew', '객체 만들기', 'plus']];
const onTablesOf = cid => onNeed('tables:' + cid, () => api.get(`/onto/connections/${encodeURIComponent(cid)}/tables`));
const onMartsOf = cid => onNeed('marts:' + cid, () => api.get(`/onto/connections/${encodeURIComponent(cid)}/marts`));
/* 마법사를 열기 전에 필요한 목록을 확실히 읽어 둔다(화면 그리기는 위의 onNeed 가 하고, 이쪽은 기다린다) */
async function onPreload(cid) {
  const get = async (k, path) => { const v = ON.cache[k]; if (v && v !== 'loading' && !v.error) return v; ON.cache[k] = await api.get(path); return ON.cache[k]; };
  await Promise.all([get('tables:' + cid, `/onto/connections/${encodeURIComponent(cid)}/tables`), get('marts:' + cid, `/onto/connections/${encodeURIComponent(cid)}/marts`)]);
}

/* ===== 객체 구축 탭 ===== */
function onBuildTab(cid) {
  const s = onConn(cid), objs = onObjs(cid), tb = onTablesOf(cid), ms = onMartsOf(cid);
  if (tb === 'loading' || ms === 'loading') return onSpin('원본 테이블을 읽는 중');
  if (tb.error) return `<div class="md-empty">${esc(tb.error)}</div>`;
  const marts = Array.isArray(ms) ? ms : [];
  if (ON.sel && !onObjOf(cid, ON.sel)) ON.sel = null;
  if (!ON.sel && objs.length) ON.sel = onHub(cid);
  const rows = objs.map(o => `<tr data-act="otSelB" data-id="${esc(o.id)}" tabindex="0" class="${o.id === ON.sel ? 'sel' : ''}">
      <td class="l"><div class="obn"><span class="oi" style="--sc:${onClr(s.clr)}">${esc(o.name[0])}</span><span><b>${esc(o.name)}</b><small class="mono">${esc(o.api)}</small></span></div></td>
      <td class="l">${o.mart ? `<span class="fl info">마트</span> <button class="link mono" style="font-size:12px" data-act="martOpen" data-id="${esc(o.mart)}">${esc(o.mart)}</button>` : `<span class="fl mute">테이블</span> <span class="mono" style="font-size:12px">${esc(o.table)}</span>`}</td>
      <td>${onVisProps(o).length}</td><td>${onObjLinks(cid, o.id).length}</td><td>${onN(o.rows)}</td><td>${onSt(o.status)}</td></tr>`).join('');
  const trows = tb.tables.map(t => `<tr><td class="l"><span class="mono" style="font-size:12.5px">${esc(t.key)}</span>${t.tag ? ` <span class="fl mute">${esc(t.tag)}</span>` : ''}</td><td>${onN(t.rows)}</td>
      <td class="l">${t.objs.map(x => `<button class="chip sm" data-act="otSelB" data-id="${esc(x[0])}"><span class="fl info">객체</span>${esc(x[1])}</button>`).join('')}${t.marts.map(x => `<button class="chip sm" data-act="martOpen" data-id="${esc(x[0])}"><span class="fl ont">마트</span>${esc(x[1])}</button>`).join('')}${!t.objs.length && !t.marts.length ? '<span class="muted" style="font-size:13px">아직 쓰지 않음</span>' : ''}</td></tr>`).join('');
  const sel = ON.sel ? onObjOf(cid, ON.sel) : null;
  return `<div class="kpi bk">
      <div><span class="k">원본 테이블</span><span class="v">${fmt(tb.total)}<small>개</small></span><span class="d">스키마 ${esc(s.schema)}</span></div>
      <div><span class="k">객체 유형</span><span class="v">${objs.length}<small>개</small></span><span class="d">공개 ${objs.filter(o => o.status === 'pub').length}개</span></div>
      <div><span class="k">데이터 마트</span><span class="v">${marts.length}<small>개</small></span><span class="d">객체로 지정 ${marts.filter(m => m.obj).length}개</span></div>
      <div><span class="k">쓰고 있는 테이블</span><span class="v">${tb.used}<small>개</small></span><span class="d">아직 쓰지 않은 테이블 ${fmt(tb.unused)}개</span></div></div>
    <div class="bt-g">${ON_TOOLS.map(([k, t, d, act, btn, ic]) => `<div class="bt ${!objs.length && k === 'scan' ? 'hl' : ''}"><span class="bt-i">${svg(ic, 20)}</span><div class="tx"><b>${t}</b><p>${d}</p></div><button class="btn ${!objs.length && k === 'scan' ? 'primary' : ''}" data-act="${act}" data-id="${esc(cid)}">${btn}</button></div>`).join('')}</div>
    <h3 class="sec-t">객체 유형 <small>${onJo(s.name, '을', '를')} 원본으로 하는 객체예요. 행을 누르면 아래에 상세가 열립니다</small></h3>
    ${objs.length ? `<div class="twrap" style="margin-top:0"><table class="utbl" style="min-width:860px"><thead><tr><th class="l">객체 유형</th><th class="l">원본</th><th>속성</th><th>링크</th><th>행 수</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="md-empty big">${svg('graph', 36, 1.4)}<b>아직 객체가 없어요</b><span>DB 스캔으로 자동 구성부터 시작해 보세요. 스키마를 읽어 객체와 링크 후보를 한 번에 제안합니다.</span><button class="btn primary" data-act="scanWz" data-id="${esc(cid)}">${svg('sparkle', 15)}DB 스캔 시작</button></div>`}
    ${sel ? `<div id="buildDetail" style="margin-top:20px">${onDetail(cid, sel)}</div>` : ''}
    <details class="pv src-t"${objs.length ? '' : ' open'}><summary>원본 테이블 <span class="muted">${tb.tables.length}개 표시, 전체 ${fmt(tb.total)}개</span></summary>
      <div class="twrap" style="margin-top:8px"><table class="utbl" style="min-width:700px"><thead><tr><th class="l">테이블</th><th>행 수</th><th class="l">쓰는 곳</th></tr></thead><tbody>${trows}</tbody></table></div></details>`;
}

/* ===== DB 연결 마법사: 접속만 하고 스캔하지 않음 ===== */
const ON_DBW_STEPS = ['DB 종류', '접속 정보', '범위와 조회 방식'];
function dbwOpen() {
  const free = (ON.ov.demoDbs || []).find(d => !d.used);
  ON.dbw = { step:1, dbms:'sqlite', name:'', host:'', port:'', db:free ? free.id : '', user:'', password:'', schema:'', mode:'live', test:null, testing:false, creating:false };
  if (free) ON.dbw.name = free.name;
  renderDbw();
}
const onDbmsOf = k => (ON.ov.dbms || []).find(d => d.id === k) || {};
function dbwBody() {
  const w = ON.dbw, d = onDbmsOf(w.dbms);
  if (w.step === 1) return `<p class="tab-hint" style="margin-top:0">연결할 DB 종류를 고르세요. 모든 DB는 읽기 전용으로 접속합니다.</p>
    <div class="wz-cards">${(ON.ov.dbms || []).map(x => `<button class="mode-card ${w.dbms === x.id ? 'on' : ''} ${x.available ? '' : 'dis'}" data-act="dbwDbms" data-v="${x.id}"><span class="radio"></span><span><span class="mt">${svg('db', 16)}${esc(x.label)}${x.id === 'sqlite' ? ' <span class="rec">시연 DB 포함</span>' : ''}</span><span class="mp">${esc(x.ver)}${x.available ? '' : ` · 이 서버에서는 접속할 수 없어요`}</span></span></button>`).join('')}</div>
    ${!d.available && w.dbms ? `<div class="notice warn" style="margin-top:12px">${svg('alert', 18)}<div class="nt">${esc(d.hint)}</div></div>` : ''}`;
  if (w.step === 2) {
    const lite = w.dbms === 'sqlite';
    const demo = (ON.ov.demoDbs || []).map(x => `<label class="gov-row ${x.used ? 'dis' : ''}"><input type="radio" name="dbwDemo" value="${esc(x.id)}" data-chg="dbwDemo" ${w.db === x.id ? 'checked' : ''} ${x.used ? 'disabled' : ''}><span class="tx">${esc(x.name)} <span class="mono" style="font-size:12px">${esc(x.schema)}</span><small>${esc(x.label)}${x.used ? ', 이미 연결했어요' : ''}</small></span></label>`).join('');
    return `<div class="field"><label>이름</label><input class="inp" data-inp="dbwF" data-k="name" value="${esc(w.name)}"></div>
      ${lite ? `<div class="d-label">시연 DB</div><div class="gov-list" style="margin:0 0 12px">${demo}</div><div class="field"><label>또는 파일</label><input class="inp mono" data-inp="dbwF" data-k="db" placeholder="SQLite 파일의 절대 경로 (서버에서 허용한 폴더만)" value="${w.db.startsWith('demo:') ? '' : esc(w.db)}"></div>`
      : `<div class="field"><label>호스트</label><div class="two"><input class="inp mono" data-inp="dbwF" data-k="host" value="${esc(w.host)}" aria-label="호스트" placeholder="10.20.5.40"><input class="inp mono" data-inp="dbwF" data-k="port" value="${esc(w.port)}" aria-label="포트" placeholder="${d.port || ''}"></div></div>
      <div class="field"><label>데이터베이스</label><input class="inp mono" data-inp="dbwF" data-k="db" value="${esc(w.db)}"></div>
      <div class="field"><label>계정</label><div class="two"><input class="inp mono" data-inp="dbwF" data-k="user" value="${esc(w.user)}" aria-label="계정"><input class="inp" type="password" data-inp="dbwF" data-k="password" value="${esc(w.password)}" autocomplete="off" aria-label="비밀번호" placeholder="비밀번호"></div></div>
      <p class="pv-note" style="margin:-4px 0 12px 106px">읽기 전용 계정을 쓰세요. 이음은 쓰지 않지만 쓰기 권한이 있는 계정이면 DB 쪽에서 막아 두는 편이 안전해요.</p>`}
      <div class="field"><label>커넥터</label><select class="inp" disabled><option>내장 (이 서버에서 직접 접속)</option></select></div>
      <div class="dbw-test"><button class="btn" data-act="dbwTest" ${w.testing ? 'disabled' : ''}>${w.testing ? '<span class="spin"></span>테스트 중' : svg('refresh', 15) + '연결 테스트'}</button>
        ${w.test ? (w.test.ok ? `<div class="notice" style="flex:1;margin:0">${svg('check', 18)}<div class="nt"><b>연결했습니다.</b> 응답 ${w.test.ms}ms, 테이블 ${w.test.tables}개${w.test.views ? `, 뷰 ${w.test.views}개` : ''}. ${esc(w.test.message)}</div></div>` : `<div class="notice danger" style="flex:1;margin:0">${svg('alert', 18)}<div class="nt">${esc(w.test.error)}</div></div>`)
          : '<span class="muted" style="font-size:13px">다음 단계로 가려면 연결 테스트를 통과해야 합니다.</span>'}</div>`;
  }
  const schemas = w.test && w.test.schemas ? w.test.schemas : [];
  return `${w.dbms !== 'sqlite' ? `<div class="d-label">객체 구축에 쓸 스키마</div>
    ${schemas.length ? `<select class="inp" data-chg="dbwSchema" style="margin-bottom:16px">${schemas.map(x => `<option ${w.schema === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<input class="inp mono" data-inp="dbwF" data-k="schema" value="${esc(w.schema)}" placeholder="스키마 이름" style="margin-bottom:16px">`}` : ''}
    <div class="d-label">조회 방식</div>
    <button class="opt ${w.mode === 'live' ? 'on' : ''}" data-act="dbwMode" data-v="live"><span class="radio"></span><span><b>실시간 조회</b><small>질문할 때마다 원본 DB에 읽기 쿼리를 보냅니다. 항상 최신이지만 원본 DB에 부하가 갑니다.</small></span></button>
    <button class="opt ${w.mode === 'sync' ? 'on' : ''}" data-act="dbwMode" data-v="sync"><span class="radio"></span><span><b>주기 동기화 <span class="rec">대용량 ERP에 권장</span></b><small>객체가 쓰는 테이블을 이음 저장소로 복사해 두고 1시간마다 다시 복사합니다. 질문은 복제본에 보냅니다.</small></span></button>
    <div class="tg" style="margin-top:8px"><span class="tx"><b>쿼리 보호</b><small>한 번에 최대 1,000행, 쿼리 시간 5초, 동시 쿼리 4개까지</small></span><span class="sw"><input type="checkbox" checked disabled aria-label="쿼리 보호"><span></span></span></div>
    <div class="notice" style="margin-top:12px">${svg('info', 18)}<div class="nt">연결만 하고 스키마는 아직 읽지 않아요. 연결한 뒤 <b>객체 구축</b>에서 DB 스캔, 마트 생성, 객체 생성으로 온톨로지를 만듭니다.</div></div>`;
}
function renderDbw() {
  const w = ON.dbw; if (!w) return;
  const d = onDbmsOf(w.dbms);
  const canNext = w.step === 1 ? !!d.available : w.step === 2 ? !!(w.test && w.test.ok) : true;
  const html = `<div class="d-head"><div class="ttl"><div class="ag">온톨로지</div><h3 id="dTitle">DB 연결</h3><p>DB에 읽기 전용으로 접속만 합니다. 객체는 연결한 뒤 객체 구축에서 만들어요.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body"><div class="wz-steps">${ON_DBW_STEPS.map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div><div id="dbwBody">${dbwBody()}</div></div>
    <div class="d-foot"><span class="info">${w.step}/3 단계</span>${w.step > 1 ? '<button class="btn" data-act="dbwPrev">이전</button>' : ''}
      ${w.step === 3 ? `<button class="btn primary" data-act="dbwApply" ${w.creating ? 'disabled' : ''}>${w.creating ? '<span class="spin"></span>' : svg('plug', 15)}연결</button>` : `<button class="btn primary" id="dbwNext" data-act="dbwNext" ${canNext ? '' : 'disabled'}>다음</button>`}</div>`;
  if ($('#drawer').classList.contains('show')) { const b = $('#drawer .d-body'), st = b ? b.scrollTop : 0; $('#drawer').innerHTML = html; const nb = $('#drawer .d-body'); if (nb) nb.scrollTop = st; } else openDrawer(html);
}
const dbwPayload = w => ({ dbms:w.dbms, name:w.name, host:w.host, port:w.port, db:w.db, user:w.user, password:w.password, schema:w.schema, mode:w.mode });

/* ===== DB 스캔 마법사 ===== */
function scwOpen(cid) {
  ON.scw = { conn:cid, step:1, mode:'all', start:'', sample:true, pii:true, job:null, sel:new Set(), timer:null, err:'' };
  const tb = ON.cache['tables:' + cid];
  if (tb && tb.tables) { const t = tb.tables.find(x => x.ok && x.role === 'entity'); ON.scw.start = t ? t.name : ''; }
  renderScw();
}
const scwDone = p => !!p.done;
function scwNeed(p, sel) {
  if (!p.needs) return null;
  const job = ON.scw.job, have = new Set(job.existing), picked = new Set(job.proposals.filter(q => q.add.ot && sel.has(q.id)).map(q => q.add.ot));
  const missing = p.needs.filter(id => !have.has(id) && !picked.has(id));
  if (!missing.length) return null;
  const nm = id => { const q = job.proposals.find(x => x.add.ot === id); return q ? q.title.replace(/\s*\(.*\)$/, '') : (job.names && job.names[id]) || id.split('.').pop(); };
  return `${missing.map(nm).join(', ')} 객체도 함께 반영할 때만`;
}
function scwBody() {
  const w = ON.scw, s = onConn(w.conn);
  if (w.step === 1) {
    const tb = ON.cache['tables:' + w.conn], opts = tb && tb.tables ? tb.tables.filter(x => x.ok && x.kind === 'table') : [];
    return `<div class="notice" style="margin-bottom:14px">${svg('db', 18)}<div class="nt"><b>${esc(s.name)}</b> ${s.host ? `<code class="key">${esc(s.host)}/${esc(s.db)}</code>` : ''}를 읽기 전용으로 스캔합니다. 원본 DB에는 아무것도 쓰지 않아요.</div></div>
    <div class="d-label">스캔 범위</div>
    <button class="opt ${w.mode === 'all' ? 'on' : ''}" data-act="scwMode" data-v="all"><span class="radio"></span><span><b>전체 스키마</b><small>${esc(s.schema)} 스키마의 테이블을 모두 읽고, 이미 객체나 마트에 쓰는 테이블은 건너뜁니다.</small></span></button>
    <button class="opt ${w.mode === 'rel' ? 'on' : ''}" data-act="scwMode" data-v="rel"><span class="radio"></span><span><b>테이블에서 시작해 관계 따라가기</b><small>고른 테이블에서 FK와 값 일치율로 이어진 테이블만 따라갑니다(한 단계).</small></span></button>
    ${w.mode === 'rel' ? `<div class="field" style="margin-top:8px"><label>시작 테이블</label><select class="inp" data-chg="scwStart">${opts.map(t => `<option value="${esc(t.name)}" ${w.start === t.name ? 'selected' : ''}>${esc(t.key)}</option>`).join('')}</select></div>` : ''}
    <div class="tg" style="margin-top:6px"><span class="tx"><b>값 분포 샘플링</b><small>테이블당 1,000행을 읽어 코드값, 날짜 형식, 링크 값 일치율을 확인합니다. 끄면 FK와 뷰 조인으로만 링크를 찾아요.</small></span><span class="sw"><input type="checkbox" data-chg="scwOpt" data-k="sample" ${w.sample ? 'checked' : ''} aria-label="값 분포 샘플링"><span></span></span></div>
    <div class="tg"><span class="tx"><b>개인정보 컬럼 감지</b><small>연락처, 이메일, 주민등록번호 형태의 값에 마스킹을 제안합니다</small></span><span class="sw"><input type="checkbox" data-chg="scwOpt" data-k="pii" ${w.pii ? 'checked' : ''} aria-label="개인정보 감지"><span></span></span></div>`;
  }
  const j = w.job;
  if (!j) return onSpin('스캔을 시작하는 중');
  const done = j.state !== 'running', total = j.steps.length, ok = j.steps.filter(x => x.state === 'ok').length;
  if (j.state === 'error') return `<div class="notice danger">${svg('alert', 18)}<div class="nt"><b>스캔하지 못했어요.</b> ${esc(j.error)}</div></div>`;
  return `<div class="bar-p"><i style="width:${ok / total * 100}%"></i></div>
    <ul class="an">${j.steps.map(x => `<li class="${x.state === 'ok' ? 'ok' : x.state === 'run' ? 'run' : ''}"><span class="ic">${x.state === 'ok' ? svg('check', 13, 3) : ''}</span>${esc(x.title)}${x.state === 'ok' ? `<em>${esc(x.result)}</em>` : ''}</li>`).join('')}</ul>
    ${done ? (j.proposals.length ? `${j.rel ? `<div class="rel-wrap">${scwRelSvg(j.rel)}</div>` : ''}
      <div class="d-label">제안 <small class="muted" style="font-weight:400">반영할 항목을 고르세요. 새 객체는 검토 필요 상태로 추가됩니다</small></div>
      <div class="gov-list" style="margin:6px 0 10px">${j.proposals.map(p => { const dn = scwDone(p), need = !dn && scwNeed(p, w.sel);
        return `<label class="gov-row ${dn || need ? 'dis' : ''}"><input type="checkbox" data-chg="scwSel" value="${esc(p.id)}" ${w.sel.has(p.id) && !dn && !need ? 'checked' : ''} ${dn || need ? 'disabled' : ''}><span class="fl ${p.kind === '객체' ? 'info' : p.kind === '병합' ? 'ont' : 'mute'}" style="flex:none">${p.kind}</span><span class="tx">${esc(p.title)}<small>${esc(p.sub)}${dn ? ', 이미 반영됨' : need ? `, ${esc(need)}` : ''}</small></span>${p.rec === 'check' ? '<span class="stt warn">확인 필요</span>' : p.rec === 'no' ? '<span class="stt mute">권장 안 함</span>' : ''}</label>`; }).join('')}</div>`
      : `<div class="notice mute">${svg('info', 18)}<div class="nt">${esc(j.empty || '새로 제안할 객체가 없어요.')}</div></div>`) + (j.skip ? `<p class="tab-hint" style="margin:8px 0 0">${esc(j.skip)}</p>` : '') : ''}`;
}
function scwRelSvg(r) {
  const nb = r.nodes.slice(0, 7), cx = 320, cy = 122, n = Math.max(nb.length, 1);
  const pts = nb.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * 228, cy + Math.sin(a) * 92]; });
  const box = (x, y, t, l, obj, main) => `<g class="rt ${obj ? 'obj' : ''} ${main ? 'main' : ''}"><rect x="${x - 72}" y="${y - 20}" width="144" height="40" rx="7"/><text class="r1" x="${x}" y="${y - 6}" text-anchor="middle" dominant-baseline="central">${esc(t.length > 18 ? t.slice(0, 17) + '…' : t)}</text><text class="r2" x="${x}" y="${y + 9}" text-anchor="middle" dominant-baseline="central">${esc(l)}${main ? '' : obj ? ', 객체' : ', 객체 아님'}</text></g>`;
  return `<svg class="rel" viewBox="0 0 640 250" role="img" aria-label="시작 테이블과 이어진 테이블">
    ${pts.map(([x, y], i) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="${nb[i].object ? 'o' : ''}"/><text class="rk" x="${cx + (x - cx) * .52}" y="${cy + (y - cy) * .52 - 5}" text-anchor="middle">${esc(nb[i].via)}</text>`).join('')}
    ${pts.map(([x, y], i) => box(x, y, nb[i].table, nb[i].label, nb[i].object)).join('')}${box(cx, cy, r.start.table, r.start.label, 1, 1)}</svg>`;
}
function renderScw() {
  const w = ON.scw; if (!w) return;
  const j = w.job, done = j && j.state !== 'running', n = j ? j.proposals.filter(p => w.sel.has(p.id) && !scwDone(p) && !scwNeed(p, w.sel)).length : 0;
  const html = `<div class="d-head"><div class="ttl"><div class="ag">${esc(onConn(w.conn).name)}, 객체 구축</div><h3 id="dTitle">DB 스캔으로 자동 구성</h3><p>스키마를 읽어 객체와 링크 후보를 한 번에 제안합니다.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body"><div class="wz-steps">${['스캔 범위', '스캔과 제안'].map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div><div id="scwBody">${scwBody()}</div></div>
    <div class="d-foot"><span class="info">${w.step === 2 && done ? `${n}개 선택` : `${w.step}/2 단계`}</span>${w.step === 1 ? `<button class="btn primary" data-act="scwRun" ${w.mode === 'rel' && !w.start ? 'disabled' : ''}>${svg('play', 15)}스캔 시작</button>`
      : j && j.proposals.length ? `<button class="btn primary" id="scwApply" data-act="scwApply" ${done && n ? '' : 'disabled'}>선택한 제안 반영</button>` : '<button class="btn" data-act="dClose">닫기</button>'}</div>`;
  if ($('#drawer').classList.contains('show')) { const b = $('#drawer .d-body'), st = b ? b.scrollTop : 0; $('#drawer').innerHTML = html; const nb = $('#drawer .d-body'); if (nb) nb.scrollTop = st; } else openDrawer(html);
}
function scwPoll() {
  const w = ON.scw; if (!w || !w.job) return;
  w.timer = setTimeout(async () => {
    if (ON.scw !== w) return;
    try {
      const j = await api.get(`/onto/scans/${w.job.id}`);
      if (ON.scw !== w) return;
      const first = w.job.state === 'running' && j.state !== 'running';
      w.job = j;
      if (first) w.sel = new Set(j.proposals.filter(p => p.rec === 'yes' && !p.done).map(p => p.id));
      renderScw();
      if (j.state === 'running') scwPoll();
    } catch (e) { w.job = { ...w.job, state:'error', error:e.message, steps:w.job.steps, proposals:[], existing:[] }; renderScw(); }
  }, 600);
}

/* ===== 객체 생성 마법사: 테이블 또는 마트에서 ===== */
const ON_OTW_STEPS = ['원본 선택', '객체 정의', '링크와 확인'];
function otwOpen(o = {}) {
  const conn = o.conn || (onConn(ON.scope) ? ON.scope : (ON.ov.conns[0] || {}).id);
  ON.otw = { conn, step:o.step || 1, src:o.src || 'table', pick:o.pick || null, d:null, loading:false, links:new Set(), pkChk:null, err:'', creating:false };
  otwFirstPick(ON.otw);
  if (ON.otw.step >= 2) otwLoadDraft();
  renderOtw();
}
function otwTables(cid) { const tb = ON.cache['tables:' + cid]; return tb && tb.tables ? tb.tables.slice().sort((a, b) => b.ok - a.ok) : []; }
function otwMarts(cid) { const ms = ON.cache['marts:' + cid]; return Array.isArray(ms) ? ms : []; }
function otwFirstPick(w) {
  if (w.pick) return;
  if (w.src === 'table') { const t = otwTables(w.conn).find(x => x.ok && x.role === 'entity') || otwTables(w.conn).find(x => x.ok); w.pick = t ? t.name : null; }
  else { const m = otwMarts(w.conn).find(x => x.status === 'ok' && !x.obj); w.pick = m ? m.id : null; }
}
async function otwLoadDraft() {
  const w = ON.otw; if (!w || !w.pick) return;
  w.loading = true; w.d = null; w.err = ''; renderOtw();
  try {
    const d = await api.get(`/onto/connections/${encodeURIComponent(w.conn)}/draft?src=${w.src}&pick=${encodeURIComponent(w.pick)}`);
    if (ON.otw !== w) return;
    w.d = { ...d, inc:new Set(d.cols.filter(x => !x.sys).map(x => x.c)), pkSet:new Set(d.pk), names:Object.fromEntries(d.cols.map(x => [x.c, x.name])) };
    w.links = new Set(d.links.filter(l => l.rec).map(l => l.key)); w.defFor = w.src + ':' + w.pick;
  } catch (e) { if (ON.otw === w) w.err = e.message; }
  if (ON.otw === w) { w.loading = false; renderOtw(); }
}
function otwBody() {
  const w = ON.otw, s = onConn(w.conn);
  if (w.step === 1) {
    const tabs = `<span class="seg" style="margin-bottom:12px">${[['table', '테이블에서 만들기'], ['mart', '마트에서 만들기']].map(([k, l]) => `<button class="${w.src === k ? 'on' : ''}" data-act="otwSrc" data-v="${k}">${l}</button>`).join('')}</span>`;
    if (w.src === 'table') {
      const tb = onTablesOf(w.conn);
      if (tb === 'loading') return tabs + onSpin('테이블을 읽는 중');
      return `${tabs}<p class="tab-hint" style="margin-top:0">${esc(s.name)}의 테이블 하나를 객체의 원본으로 씁니다. 표시 이름과 타입은 사전과 값 분포로 제안하고, 다음 단계에서 고칠 수 있어요.</p>
      <div class="gov-list">${otwTables(w.conn).map(x => `<label class="gov-row ${x.ok ? '' : 'dis'}"><input type="radio" name="otwPick" value="${esc(x.name)}" data-chg="otwPick" ${x.ok && w.pick === x.name ? 'checked' : ''} ${x.ok ? '' : 'disabled'}><span class="tx"><span class="mono">${esc(x.key)}</span>${x.tag ? ` <span class="fl mute">${esc(x.tag)}</span>` : ''}<small>${onN(x.rows)}행${x.why ? `, ${esc(x.why)}` : x.marts.length ? `, 마트 ${esc(x.marts.map(m => m[1]).join(', '))}에서 사용 중` : ''}</small></span></label>`).join('')}</div>
      <p class="pv-note">여러 테이블을 한 번에 객체로 만들려면 DB 스캔으로 자동 구성을 쓰세요.</p>`;
    }
    const ms = onMartsOf(w.conn);
    if (ms === 'loading') return tabs + onSpin();
    return `${tabs}<p class="tab-hint" style="margin-top:0">${esc(s.name)}에서 SQL로 구성한 마트를 객체의 원본으로 지정합니다. 빌드가 성공했고 아직 지정하지 않은 마트만 고를 수 있어요.</p>
      ${ms.length ? `<div class="gov-list">${ms.map(m => { const ok = m.status === 'ok' && !m.obj;
        return `<label class="gov-row ${ok ? '' : 'dis'}"><input type="radio" name="otwPick" value="${esc(m.id)}" data-chg="otwPick" ${ok && w.pick === m.id ? 'checked' : ''} ${ok ? '' : 'disabled'}><span class="tx"><b style="font-weight:500">${esc(m.name)}</b> <span class="mono" style="font-size:11.5px;color:var(--text-3)">${esc(m.id)}</span>
          <small>${m.status === 'ok' ? `${onN(m.rows)}행, ${esc(m.refreshLabel)} 갱신` : m.status === 'fail' ? '마지막 빌드 실패, 빌드가 성공해야 지정할 수 있어요' : m.status === 'building' ? '빌드 중' : '아직 빌드하지 않았어요'}${m.obj ? `, 이미 ${esc(m.objName || '')} 객체로 지정됨` : ''}${m.dbs.filter(x => x !== 'MART').length > 1 ? ', DB 간 조인' : ''}</small></span>${onMartStt(m)}</label>`; }).join('')}</div>` : '<div class="md-empty">이 연결에는 아직 마트가 없어요.</div>'}
      <button class="link" data-act="martNewFromWz" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;font-size:13.5px;margin-top:12px">${svg('plus', 14)}SQL로 새 마트 만들기</button>`;
  }
  if (w.loading || !w.d) return w.err ? `<div class="notice danger">${svg('alert', 18)}<div class="nt">${esc(w.err)}</div></div>` : onSpin('초안을 만드는 중');
  const d = w.d;
  if (w.step === 2) return `<div class="notice" style="margin-bottom:14px">${svg(w.src === 'table' ? 'db' : 'layers', 18)}<div class="nt">${esc(d.sourceLabel)}</div></div>
      <div class="field"><label>표시 이름</label><input class="inp" data-inp="otwDef" data-k="name" value="${esc(d.name)}"></div>
      <div class="field"><label>API 이름</label><input class="inp mono" data-inp="otwDef" data-k="api" value="${esc(d.api)}"></div>
      <div class="field"><label>설명</label><input class="inp" data-inp="otwDef" data-k="desc" value="${esc(d.desc)}"></div>
      <div class="d-label" style="margin-top:6px">속성 <small class="muted" style="font-weight:400">기본키는 객체 하나를 가리키는 컬럼이에요. 여러 개를 고르면 복합 키가 됩니다.</small></div>
      <div class="mapw" style="margin:8px 0 6px"><table class="map" style="min-width:620px"><thead><tr><th>포함</th><th>${w.src === 'table' ? '컬럼' : '마트 컬럼'}</th><th>표시 이름</th><th>타입</th><th>기본키</th><th>제목</th></tr></thead><tbody>
      ${d.cols.map(x => `<tr class="${x.sys ? 'off' : ''}"><td><input type="checkbox" data-chg="otwInc" value="${esc(x.c)}" ${d.inc.has(x.c) ? 'checked' : ''} ${d.pkSet.has(x.c) || x.sys ? 'disabled' : ''} aria-label="${esc(x.c)} 포함"></td><td><span class="f">${esc(x.c)}</span><div class="ty">${esc(x.ct)}</div></td>
        <td>${x.sys ? `<span class="hid">${esc(x.note)}</span>` : `<input class="inp sm" data-inp="otwPn" data-col="${esc(x.c)}" value="${esc(d.names[x.c])}" aria-label="${esc(x.c)} 표시 이름">`}</td><td><span class="mono" style="font-size:12px">${esc(x.t)}</span></td>
        <td>${x.sys ? '' : `<input type="checkbox" data-chg="otwPk" value="${esc(x.c)}" ${d.pkSet.has(x.c) ? 'checked' : ''} aria-label="${esc(x.c)} 기본키">`}</td><td>${x.sys ? '' : `<input type="radio" name="otwTitle" data-chg="otwTitle" value="${esc(x.c)}" ${d.title === x.c ? 'checked' : ''} aria-label="${esc(x.c)} 제목">`}</td></tr>`).join('')}</tbody></table></div>
      <p class="pv-note" id="otwPkNote">${otwPkNote()}</p>`;
  const cands = d.links;
  return `<div class="d-label">링크 <small class="muted" style="font-weight:400">${w.src === 'table' ? 'FK와 값 일치율로 찾은 기존 객체예요' : '마트 컬럼 이름과 값으로 찾은 기존 객체예요'}</small></div>
    <div class="gov-list" style="margin:6px 0 14px">${cands.length ? cands.map(c => `<label class="gov-row"><input type="checkbox" data-chg="otwLk" value="${esc(c.key)}" ${w.links.has(c.key) ? 'checked' : ''}><span class="fl ${c.cross ? 'ont' : 'mute'}" style="flex:none">${c.cross ? 'DB 간' : '링크'}</span><span class="tx">${esc(c.label)}<small>${esc(c.sub)}</small></span>${c.rec ? '' : '<span class="stt mute">권장 안 함</span>'}</label>`).join('')
      : '<div class="empty-s" style="padding:14px">이어질 만한 기존 객체가 없어요. 링크는 만든 뒤에도 스캔으로 찾을 수 있어요.</div>'}</div>
    <div class="otw-sum"><div><span>객체</span><b>${esc(d.name)}</b></div><div><span>연결</span><b>${esc(s.name)}</b></div><div><span>원본</span><b class="mono" style="font-size:12.5px">${esc(d.table)}</b></div><div><span>속성</span><b>${d.inc.size}개</b></div></div>
    <div class="notice">${svg('info', 18)}<div class="nt">새 객체는 <b>검토 필요</b> 상태로 ${esc(s.name)} 온톨로지에 추가됩니다.</div></div>
    ${w.err ? `<div class="notice danger" style="margin-top:8px">${svg('alert', 18)}<div class="nt">${esc(w.err)}</div></div>` : ''}`;
}
function otwPkNote() {
  const w = ON.otw, d = w.d;
  if (!d.pkSet.size) return '기본키를 하나 이상 고르세요.';
  const c = w.pkChk;
  if (!c) return w.src === 'mart' ? `기본키 ${[...d.pkSet].join(' + ')}` : `기본키 ${[...d.pkSet].join(' + ')} 로 원본 행이 모두 구별되는지 확인하는 중…`;
  if (c.error) return esc(c.error);
  return c.unique ? `기본키 ${esc([...d.pkSet].join(' + '))}로 원본 행이 모두 구별되는지 확인했어요. 겹치는 행 없음 (${fmt(c.rows)}행).` : `<span style="color:var(--danger)">기본키 ${esc([...d.pkSet].join(' + '))}로는 행을 구별할 수 없어요. ${fmt(c.rows)}행 중 서로 다른 값은 ${fmt(c.distinct)}개뿐입니다.</span>`;
}
function otwCheckPk() {
  const w = ON.otw; if (!w || !w.d || w.src !== 'table' || !w.d.pkSet.size) return;
  const cols = [...w.d.pkSet], key = cols.join(',');
  w.pkKey = key;
  api.post(`/onto/connections/${encodeURIComponent(w.conn)}/check-key`, { table:w.pick, cols }).then(r => { if (ON.otw === w && w.pkKey === key) { w.pkChk = r; const n = $('#otwPkNote'); if (n) n.innerHTML = otwPkNote(); const b = $('#otwNext'); if (b) b.disabled = !otwCanNext(); } })
    .catch(e => { if (ON.otw === w) { w.pkChk = { error:e.message }; const n = $('#otwPkNote'); if (n) n.innerHTML = otwPkNote(); } });
}
function otwCanNext() {
  const w = ON.otw;
  if (w.step === 1) return !!w.pick && (w.src === 'table' ? !!(otwTables(w.conn).find(x => x.name === w.pick && x.ok)) : !!otwMarts(w.conn).find(m => m.id === w.pick && m.status === 'ok' && !m.obj));
  if (w.step === 2) return !!(w.d && w.d.pkSet.size && w.d.name.trim() && w.d.api.trim() && !(w.pkChk && (w.pkChk.error || w.pkChk.unique === false)));
  return true;
}
function renderOtw() {
  const w = ON.otw; if (!w) return;
  const html = `<div class="d-head"><div class="ttl"><div class="ag">${esc(onConn(w.conn).name)}, 객체 구축</div><h3 id="dTitle">객체 생성</h3><p>테이블이나 마트를 원본으로 골라 객체 유형을 정의합니다.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body"><div class="wz-steps">${ON_OTW_STEPS.map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div><div id="otwBody">${otwBody()}</div></div>
    <div class="d-foot"><span class="info">${w.step}/3 단계</span>${w.step > 1 ? '<button class="btn" data-act="otwPrev">이전</button>' : ''}
      ${w.step === 3 ? `<button class="btn primary" data-act="otwCreate" ${w.creating ? 'disabled' : ''}>${w.creating ? '<span class="spin"></span>' : ''}객체 만들기</button>` : `<button class="btn primary" id="otwNext" data-act="otwNext" ${otwCanNext() ? '' : 'disabled'}>다음</button>`}</div>`;
  if ($('#drawer').classList.contains('show')) { const b = $('#drawer .d-body'), st = b ? b.scrollTop : 0; $('#drawer').innerHTML = html; const nb = $('#drawer .d-body'); if (nb) nb.scrollTop = st; } else openDrawer(html);
}

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  dbWz: () => { if (!ON.ov) return; dbwOpen(); },
  dbFromWz: () => { closeDrawer(); setTimeout(() => { S.view = 'onto'; render(); if (ON.ov) dbwOpen(); else onBoot().then(() => dbwOpen()); }, 60); },
  dbwDbms: a => { const w = ON.dbw; w.dbms = a.dataset.v; w.test = null; w.port = ''; if (w.dbms === 'sqlite') { const free = (ON.ov.demoDbs || []).find(d => !d.used); if (free) { w.db = free.id; w.name = free.name; } } else if (w.db.startsWith('demo:')) w.db = ''; renderDbw(); },
  dbwTest: async () => {
    const w = ON.dbw; w.testing = true; w.test = null; renderDbw();
    try { w.test = await api.post('/onto/connections/test', dbwPayload(w)); if (w.test.ok && w.test.schemas && w.test.schemas.length && !w.schema) w.schema = w.test.schemas[0]; } catch (e) { w.test = { ok:false, error:e.message }; }
    w.testing = false; if (ON.dbw === w) renderDbw();
  },
  dbwNext: () => { const w = ON.dbw; w.step++; renderDbw(); },
  dbwPrev: () => { ON.dbw.step--; renderDbw(); },
  dbwMode: a => { ON.dbw.mode = a.dataset.v; renderDbw(); },
  dbwApply: async () => {
    const w = ON.dbw; w.creating = true; renderDbw();
    try {
      const c = await api.post('/onto/connections', dbwPayload(w));
      ON.dbw = null; closeDrawer(); await onLoadOv(); ON.scope = c.id; ON.tab = 'build'; ON.sel = null; ON.cache = {}; delete ON.g[c.id];
      S.view = 'onto'; render(); toast(`${c.name}에 연결했어요. 객체 구축에서 DB 스캔으로 시작하세요.`);
    } catch (e) { w.creating = false; onErr(e, '연결하지 못했습니다. '); if (ON.dbw === w) renderDbw(); }
  },
  scanWz: async a => { const cid = a.dataset.id; try { await onPreload(cid); scwOpen(cid); } catch (e) { onErr(e); } },
  scwMode: a => { ON.scw.mode = a.dataset.v; renderScw(); },
  scwRun: async () => {
    const w = ON.scw; w.step = 2; w.job = null; renderScw();
    try { w.job = await api.post(`/onto/connections/${encodeURIComponent(w.conn)}/scans`, { mode:w.mode, start:w.mode === 'rel' ? w.start : '', sample:w.sample, pii:w.pii }); renderScw(); scwPoll(); }
    catch (e) { w.job = { state:'error', error:e.message, steps:[], proposals:[], existing:[] }; renderScw(); }
  },
  scwApply: async () => {
    const w = ON.scw, j = w.job, picked = j.proposals.filter(p => w.sel.has(p.id) && !scwDone(p) && !scwNeed(p, w.sel)).map(p => p.id);
    try {
      const r = await api.post(`/onto/scans/${j.id}/apply`, { picked });
      clearTimeout(w.timer); ON.scw = null; closeDrawer();
      await onReload(false, [w.conn]); ON.scope = w.conn; ON.tab = 'build'; ON.sel = r.objects[0] || ON.sel; ON.dtab = 'props'; S.view = 'onto'; render();
      toast(`제안 ${picked.length}개를 반영했어요.${r.skipped.length ? ` ${r.skipped.length}개는 건너뛰었어요.` : ''} 새 객체는 검토한 뒤 공개하세요.`);
    } catch (e) { onErr(e, '반영하지 못했습니다. '); }
  },
  otNew: async a => { const cid = a.dataset.id && onConn(a.dataset.id) ? a.dataset.id : ON.scope; try { await onPreload(cid); otwOpen({ conn:cid }); } catch (e) { onErr(e); } },
  otwSrc: a => { const w = ON.otw; w.src = a.dataset.v; w.pick = null; otwFirstPick(w); renderOtw(); },
  otwNext: () => { const w = ON.otw; if (!otwCanNext()) return; w.step++; if (w.step === 2 && w.defFor !== w.src + ':' + w.pick) { w.pkChk = null; otwLoadDraft().then(otwCheckPk); } else if (w.step === 2) { renderOtw(); otwCheckPk(); } else renderOtw(); },
  otwPrev: () => { ON.otw.step--; renderOtw(); },
  otwCreate: async () => {
    const w = ON.otw, d = w.d; w.creating = true; w.err = ''; renderOtw();
    try {
      const o = await api.post(`/onto/connections/${encodeURIComponent(w.conn)}/objects`, { src:w.src, pick:w.pick, name:d.name, api:d.api, desc:d.desc, include:[...d.inc], pk:[...d.pkSet], title:d.title, names:d.names, links:[...w.links] });
      ON.otw = null; closeDrawer(); await onReload(false, [w.conn]); ON.scope = w.conn; ON.tab = 'build'; ON.sel = o.id; ON.dtab = 'props'; S.view = 'onto'; render();
      toast(`${onJo(o.name, '을', '를')} 객체로 만들었어요. 검토한 뒤 공개하세요.`);
    } catch (e) { w.creating = false; w.err = e.message; if (ON.otw === w) renderOtw(); }
  },
});
Object.assign(INP, {
  dbwF: el => { const w = ON.dbw; w[el.dataset.k] = el.value; if (el.dataset.k === 'db' && !el.value.startsWith('demo:')) { /* 파일 경로 */ } w.test = null; const b = $('#dbwNext'); if (b) b.disabled = true; },
  otwDef: el => { const w = ON.otw; w.d[el.dataset.k] = el.value; const n = $('#otwNext'); if (n) n.disabled = !otwCanNext(); },
  otwPn: el => { ON.otw.d.names[el.dataset.col] = el.value; },
});
Object.assign(CHG, {
  dbwDemo: el => { const w = ON.dbw; w.db = el.value; const d = (ON.ov.demoDbs || []).find(x => x.id === el.value); if (d) w.name = d.name; w.test = null; renderDbw(); },
  dbwSchema: el => { ON.dbw.schema = el.value; },
  scwStart: el => { ON.scw.start = el.value; },
  scwOpt: el => { ON.scw[el.dataset.k] = el.checked; },
  scwSel: el => { const w = ON.scw; el.checked ? w.sel.add(el.value) : w.sel.delete(el.value); renderScw(); },
  otwPick: el => { const w = ON.otw; w.pick = el.value; const n = $('#otwNext'); if (n) n.disabled = !otwCanNext(); },
  otwLk: el => { const w = ON.otw; el.checked ? w.links.add(el.value) : w.links.delete(el.value); },
  otwInc: el => { const d = ON.otw.d; el.checked ? d.inc.add(el.value) : d.inc.delete(el.value); },
  otwPk: el => { const w = ON.otw, d = w.d; if (el.checked) { d.pkSet.add(el.value); d.inc.add(el.value); } else d.pkSet.delete(el.value); w.pkChk = null; renderOtw(); otwCheckPk(); },
  otwTitle: el => { ON.otw.d.title = el.value; },
});

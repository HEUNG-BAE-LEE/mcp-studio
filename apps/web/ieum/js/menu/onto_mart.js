/* 온톨로지: 데이터 마트 — 목록, SQL 편집기, 상세. 마트는 SQL 결과를 이음 저장소에 테이블로 저장해 두고 객체로 지정할 수 있다. */

const ON_REFRESH = { hourly:'매시간', daily:'매일 02:00', weekly:'매주 월요일 02:00', manual:'수동' };
const ON_MART_BUILD = ['원본 DB에서 읽기 (읽기 전용 계정)', '이음 저장소에 결과 저장', '스키마와 통계 등록'];
const ON_MART_TPL = { name:'부서별 승인 대기 발주', id:'mart_dept_pending', desc:'요청 부서별로 승인을 기다리는 발주 건수, 금액, 가장 오래된 발주일입니다.',
  sql:`SELECT pr.DEPT_CD,
       d.DEPT_NM,
       COUNT(*)          AS PENDING_CNT,
       SUM(po.PO_AMT)    AS PENDING_AMT,
       MIN(po.PO_YMD)    AS OLDEST_YMD
  FROM PO.TB_PO_MST po
  JOIN PO.TB_PR_MST pr ON pr.PR_NO = po.PR_NO
  JOIN HR.TB_DEPT d    ON d.DEPT_CD = pr.DEPT_CD
 WHERE po.DEL_YN = 'N'
   AND po.PO_STTS_CD = '20'
 GROUP BY pr.DEPT_CD, d.DEPT_NM` };
const onDur = ms => ms == null ? '—' : ms >= 60000 ? `${Math.floor(ms / 60000)}분 ${Math.round(ms % 60000 / 1000)}초` : ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}초` : `${ms}밀리초`;
const onBytes = b => b == null ? '—' : b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : b >= 1024 ? `${Math.round(b / 1024)}KB` : `${b}B`;
const onMartStt = m => m.status === 'ok' ? '<span class="stt ok">성공</span>' : m.status === 'fail' ? '<span class="stt danger">실패</span>' : m.status === 'building' ? '<span class="stt info">빌드 중</span>' : '<span class="stt mute">빌드 전</span>';
const onSchName = alias => { const c = ((ON.ov && ON.ov.conns) || []).find(x => x.alias === alias); return c ? [c.name, c.clr] : alias === 'MART' ? ['이음 마트', 'pri'] : [alias, 'mcp']; };

/* 마트 목록을 다시 읽는다. 빌드 중인 마트가 있으면 1초마다 */
function onMartPoll(cid) {
  clearTimeout(ON.martTimer);
  ON.martTimer = setTimeout(async () => {
    if (S.view !== 'onto' || ON.scope !== cid) return;
    try { ON.cache['marts:' + cid] = await api.get(`/onto/connections/${encodeURIComponent(cid)}/marts`); if (ON.tab === 'mart' || ON.tab === 'build') { if (!ON.me) render(); } await onLoadOv(); } catch (e) { return; }
    if ((ON.cache['marts:' + cid] || []).some(m => m.status === 'building')) onMartPoll(cid);
  }, 1000);
}

/* ===== 마트 탭 ===== */
function onMartTab(cid) {
  const ms = onMartsOf(cid);
  if (ms === 'loading') return onSpin();
  if (ms.error) return `<div class="md-empty">${esc(ms.error)}</div>`;
  if (ms.some(m => m.status === 'building')) onMartPoll(cid);
  if (ON.mv === 'new' || ON.mv === 'edit') return onMartEdit(cid);
  const cur = ON.mv && ms.find(m => m.id === ON.mv);
  if (cur) return onMartDetail(cid, cur);
  const s = onConn(cid);
  const rows = ms.map(m => { const dbs = m.dbs;
    return `<tr data-act="martOpen" data-id="${esc(m.id)}" tabindex="0"><td class="l sname"><b>${esc(m.name)}</b><span class="mono">${esc(m.id)}</span></td>
      <td class="l">${dbs.map(d => { const x = onSchName(d); return `<span class="dbchip"><i style="background:${onClr(x[1])}"></i>${esc(x[0])}</span>`; }).join('')}${dbs.filter(d => d !== 'MART').length > 1 ? '<span class="fl ont">DB 간 조인</span>' : ''}</td>
      <td>${m.status === 'ok' ? onN(m.rows) : '—'}</td><td style="font-size:13px">${esc(m.refreshLabel)}${m.inc ? `<div class="muted" style="font-size:12px">${esc(m.inc)} 기준 증분</div>` : ''}</td>
      <td>${onMartStt(m)}<div class="date" style="font-size:12px">${onWhen(m.last)}</div></td>
      <td>${m.obj ? `<button class="link" data-act="otSelGo" data-id="${esc(m.obj)}">${esc(m.objName || m.obj)}</button>` : '<span class="muted" style="font-size:13px">미지정</span>'}</td>
      <td>${m.obj ? '' : `<button class="btn sm" data-act="martToObj" data-id="${esc(m.id)}" ${m.status === 'ok' ? '' : 'disabled title="빌드가 성공해야 지정할 수 있어요"'}>객체로 지정</button>`}</td></tr>`; }).join('');
  return `<div class="mart-intro" style="margin-top:0"><div><h3>${esc(s.name)}의 데이터 마트 <span class="cnt-b">${ms.length}</span></h3>
      <p>SQL로 ${esc(s.name)}의 테이블을 조인하거나 집계한 결과를 이음 저장소에 저장해 둔 데이터입니다. 다른 연결의 테이블도 조인할 수 있고, 마트를 <b>객체로 지정</b>하면 AI가 객체로 질문할 수 있어요.</p></div>
    <button class="btn primary" data-act="martNew">${svg('plus', 16)}마트 만들기</button></div>
  <div class="mart-flow">${[['db', '데이터 소스', '원본 DB, 읽기 전용'], ['code', '데이터 마트', 'SQL로 조인, 집계'], ['graph', '객체 유형', '마트를 객체로 지정'], ['bot', 'AI 도구', '검색, 집계, 링크']].map(([ic, a, b], i) => `${i ? `<span class="mf-ar">${svg('arrow', 16)}</span>` : ''}<div class="mf ${i === 1 ? 'on' : ''}">${svg(ic, 18)}<span><b>${a}</b><small>${b}</small></span></div>`).join('')}</div>
  ${ms.length ? `<div class="twrap"><table class="utbl" style="min-width:1000px"><thead><tr><th class="l">마트</th><th class="l">원본</th><th>행 수</th><th>갱신 주기</th><th>마지막 빌드</th><th>객체</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="md-empty big" style="margin-top:16px">${svg('code', 32, 1.4)}<b>아직 마트가 없어요</b><span>여러 테이블을 조인하거나 집계해서 객체로 쓰고 싶을 때 마트를 만드세요.</span><button class="btn primary" data-act="martNew">${svg('plus', 15)}마트 만들기</button></div>`}`;
}

/* ===== 마트 편집기 ===== */
function meOpen(id) {
  const ms = ON.cache['marts:' + ON.scope] || [], m = id && ms.find(x => x.id === id);
  ON.me = m ? { edit:id, sql:m.sql, name:m.name, id, desc:m.desc, refresh:m.refresh, inc:m.inc || '', valid:null, validating:false, open:{}, saving:false }
    : { edit:null, sql:ON_MART_TPL.sql, name:ON_MART_TPL.name, id:ON_MART_TPL.id, desc:ON_MART_TPL.desc, refresh:'hourly', inc:'', valid:null, validating:false, open:{}, saving:false };
  if (m) ON.me.open[(onConn(m.home) || {}).alias] = true; else ON.me.open[(onConn(ON.scope) || {}).alias] = true;
  ON.mv = m ? 'edit' : 'new'; ON.tab = 'mart'; S.view = 'onto'; ON.tree = null;
  api.get('/onto/marts/schema').then(t => { ON.tree = t; if (ON.me) render(); }).catch(e => onErr(e));
  render(); window.scrollTo({ top:0 });
}
function meTree() {
  const e = ON.me;
  if (!ON.tree) return onSpin();
  return ON.tree.map(g => `<div class="tr-g"><button class="tr-h" data-act="meSch" data-v="${esc(g.alias)}" aria-expanded="${!!e.open[g.alias]}"><span class="caret ${e.open[g.alias] ? 'on' : ''}">${svg('back', 12, 2.4)}</span><i style="background:${onClr(g.clr)}"></i>${esc(g.name)}<span class="muted">${esc(g.alias)}</span></button>
    ${e.open[g.alias] ? g.tables.map(t => { const k = g.alias + '.' + t.name, cols = e.open[k] ? t.cols : [];
      return `<div class="tr-t"><button class="tr-x" data-act="meTbl" data-v="${esc(k)}" aria-label="${esc(t.name)} 컬럼 보기"><span class="caret ${e.open[k] ? 'on' : ''}">${svg('back', 11, 2.4)}</span></button><button class="tr-n mono" data-act="meIns" data-v="${esc(k)}" title="SQL에 넣기">${esc(t.name)}</button></div>
        ${cols.map(col => `<button class="tr-c mono" data-act="meIns" data-v="${esc(col)}" title="SQL에 넣기">${esc(col)}</button>`).join('')}`; }).join('') : ''}</div>`).join('');
}
function meRes() {
  const v = ON.me.valid; if (!v) return '';
  if (v.err) return `<div class="notice danger" style="margin-top:12px">${svg('alert', 18)}<div class="nt"><b>실행할 수 없는 SQL이에요.</b> ${esc(v.err)}</div></div>`;
  return `<ul class="chk">${v.checks.map(([k, t]) => `<li class="${k}">${svg(k === 'ok' ? 'check' : k === 'info' ? 'info' : 'alert', 14, 2.4)}<span>${esc(t)}</span></li>`).join('')}</ul>
    <div class="twrap" style="margin-top:10px"><table class="utbl" style="min-width:${v.cols.length * 120}px"><thead><tr>${v.cols.map(x => `<th class="l mono" style="font-size:12px">${esc(x.c)}<div class="ty" style="font-weight:400">${esc(x.t)}</div></th>`).join('')}</tr></thead><tbody>${v.rows.map(r => `<tr>${r.map(c => `<td class="l" style="font-size:13px;height:40px">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const meCanSave = () => { const e = ON.me, ms = ON.cache['marts:' + ON.scope] || []; return e && !e.saving && e.valid && !e.valid.err && e.name.trim() && /^mart_[a-z0-9_]+$/.test(e.id) && (e.edit || !ms.some(m => m.id === e.id)); };
function onMartEdit(cid) {
  const e = ON.me, editing = !!e.edit, ms = ON.cache['marts:' + cid] || [], cur = editing ? ms.find(m => m.id === e.edit) : null;
  const incOpts = e.valid && !e.valid.err ? e.valid.cols.map(x => x.c) : (cur ? cur.cols.map(c => c[0]) : []);
  return `<button class="link back" style="margin-top:0" data-act="martList">${svg('back', 15)}데이터 마트</button>
  <div class="me-head"><h3>${editing ? `${esc(cur ? cur.name : e.edit)} SQL 편집` : '새 마트'}</h3><span class="muted">왼쪽에서 테이블과 컬럼을 누르면 SQL에 들어갑니다</span></div>
  <div class="me-g">
    <section class="panel me-tree" aria-label="스키마"><div class="p-head">스키마</div><div class="tr">${meTree()}</div></section>
    <section class="box me-main"><div class="box-h"><h3>마트 SQL<small>읽기 전용 SELECT 문, 서로 다른 DB도 조인할 수 있어요</small></h3>${editing ? '' : `<button class="chip ${e.sql === ON_MART_TPL.sql ? 'on' : ''}" data-act="meTpl">예시: ${ON_MART_TPL.name}</button>`}</div>
      <div class="box-b"><textarea class="sql-ed" id="meSql" data-inp="meSql" spellcheck="false" aria-label="마트 SQL">${esc(e.sql)}</textarea>
        <div class="sql-f"><span class="muted">실제로 실행해서 확인해요. 미리 보기는 앞 5행만 보여 줍니다.</span><button class="btn" data-act="meRun" ${e.validating ? 'disabled' : ''}>${e.validating ? '<span class="spin"></span>실행 중' : svg('play', 14) + '실행해서 미리 보기'}</button></div>
        <div id="meRes">${meRes()}</div></div></section>
    <section class="box me-set"><div class="box-h"><h3>마트 설정</h3></div><div class="box-b">
      <label class="fld"><span>마트 이름</span><input class="inp" data-inp="meF" data-k="name" value="${esc(e.name)}"></label>
      <label class="fld"><span>마트 ID</span><input class="inp mono" data-inp="meF" data-k="id" value="${esc(e.id)}" ${editing ? 'disabled' : ''}><small>mart_로 시작하는 영문 소문자, 숫자, 밑줄</small></label>
      <label class="fld"><span>설명</span><textarea class="inp" data-inp="meF" data-k="desc" rows="3">${esc(e.desc)}</textarea></label>
      <label class="fld"><span>갱신 주기</span><select class="inp" data-chg="meR">${Object.entries(ON_REFRESH).map(([k, l]) => `<option value="${k}" ${e.refresh === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld"><span>증분 갱신 기준</span><select class="inp" data-chg="meInc"><option value="">사용 안 함 (전체 다시 계산)</option>${incOpts.map(c => `<option value="${esc(c)}" ${e.inc === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><small>기준 컬럼이 저장된 최댓값 이상인 구간만 다시 읽어 바꿔 넣어요</small></label>
      <div class="fld"><span>저장 위치</span><div class="ro">${svg('db', 14)}이음 저장소 <code>MART.${esc(e.id)}</code></div></div>
      <button class="btn primary" style="width:100%;margin-top:6px" id="meSave" data-act="meSave" ${meCanSave() ? '' : 'disabled'}>${e.saving ? '<span class="spin"></span>' : svg('play', 15)}${editing ? '저장하고 다시 빌드' : '마트 저장하고 빌드'}</button>
      <p class="pv-note" style="margin-top:8px">${e.valid && !e.valid.err ? '빌드가 끝나면 바로 객체로 지정할 수 있어요.' : '먼저 SQL을 실행해 미리 보기를 확인하세요.'}</p>
    </div></section>
  </div>`;
}

/* ===== 마트 상세 ===== */
function onMartDetail(cid, m) {
  const tables = m.tables || [];
  return `<button class="link back" style="margin-top:0" data-act="martList">${svg('back', 15)}데이터 마트</button>
  <div class="me-head"><h3>${esc(m.name)}</h3>${onMartStt(m)}<code class="key">MART.${esc(m.id)}</code><span class="sp"></span>
    <button class="btn" data-act="meEdit" data-id="${esc(m.id)}" ${m.status === 'building' ? 'disabled' : ''}>${svg('code', 15)}SQL 편집</button>
    <button class="btn" data-act="martRebuild" data-id="${esc(m.id)}" ${m.status === 'building' ? 'disabled' : ''}>${svg('refresh', 15)}지금 빌드</button>
    ${m.obj ? `<button class="btn primary" data-act="otSelGo" data-id="${esc(m.obj)}">${svg('graph', 15)}객체 보기</button>` : `<button class="btn primary" data-act="martToObj" data-id="${esc(m.id)}" ${m.status === 'ok' ? '' : 'disabled'}>${svg('graph', 15)}객체로 지정</button>`}</div>
  <p class="me-desc">${esc(m.desc)}</p>
  ${m.status === 'fail' ? `<div class="notice danger" style="margin-top:12px">${svg('alert', 18)}<div class="nt"><b>마지막 빌드가 실패했어요.</b> ${esc(m.failMsg)} ${esc(m.tip || '')}</div><button class="btn sm" data-act="meEdit" data-id="${esc(m.id)}">설정 고치기</button></div>` : ''}
  ${m.status === 'building' ? `<div class="notice" style="margin-top:12px">${svg('refresh', 18)}<div class="nt"><b>빌드 중입니다.</b><ul class="an mini">${ON_MART_BUILD.map((x, i) => `<li class="${i < m.bstep ? 'ok' : i === m.bstep ? 'run' : ''}"><span class="ic">${i < m.bstep ? svg('check', 12, 3) : ''}</span>${x}</li>`).join('')}</ul></div></div>` : ''}
  <div class="lin" aria-label="데이터 흐름">
    <div class="lin-c"><span class="lin-l">원본</span>${tables.map(t => { const x = onSchName(t.split('.')[0]); return `<span class="dbchip"><i style="background:${onClr(x[1])}"></i><span class="mono">${esc(t)}</span></span>`; }).join('')}${m.dbs.filter(d => d !== 'MART').length > 1 ? '<span class="fl ont">DB 간 조인</span>' : ''}</div>
    <span class="lin-ar">${svg('arrow', 18)}</span>
    <div class="lin-c mart"><span class="lin-l">마트</span><b>${esc(m.name)}</b><small>${esc(m.refreshLabel)}${m.inc ? `, ${esc(m.inc)} 기준 증분` : ''}</small></div>
    <span class="lin-ar">${svg('arrow', 18)}</span>
    <div class="lin-c ${m.obj ? 'obj' : 'none'}"><span class="lin-l">객체</span>${m.obj ? `<button class="link" data-act="otSelGo" data-id="${esc(m.obj)}"><b>${esc(m.objName || m.obj)}</b></button>` : '<b class="muted">아직 지정 안 함</b><small>객체로 지정하면 AI가 쓸 수 있어요</small>'}</div>
  </div>
  <div class="md-g">
    <div>
      <h5 class="h5">SQL</h5>${code(m.sql, 'sql')}
      <h5 class="h5" style="margin-top:18px">스키마와 미리 보기 <small>${m.cols.length}개 컬럼</small></h5>
      ${m.cols.length ? `<div class="twrap" style="margin-top:0"><table class="utbl" style="min-width:${m.cols.length * 120}px"><thead><tr>${m.cols.map(c => `<th class="l mono" style="font-size:12px">${esc(c[0])}<div class="ty" style="font-weight:400">${esc(c[1])}</div></th>`).join('')}</tr></thead>
        <tbody>${m.pv.map(r => `<tr>${r.map(v => `<td class="l" style="font-size:13px;height:40px">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="md-empty">아직 빌드하지 않아 스키마가 없어요.</div>'}
    </div>
    <div>
      <div class="box"><div class="box-h"><h3>정보</h3></div><dl class="ob-props in">
        <dt>행 수</dt><dd>${m.status === 'ok' || m.rows ? onN(m.rows) + '행' : '—'}</dd><dt>크기</dt><dd>${m.sizeApprox && m.size ? '약 ' : ''}${onBytes(m.size)}</dd><dt>갱신 주기</dt><dd>${esc(m.refreshLabel)}</dd>
        <dt>증분 기준</dt><dd>${esc(m.inc || '사용 안 함')}</dd><dt>다음 빌드</dt><dd>${m.refresh === 'manual' ? '수동으로 실행' : onWhen(m.next)}</dd><dt>소유자</dt><dd>${esc(m.owner || '—')}</dd><dt>저장 위치</dt><dd><code class="key">MART.${esc(m.id)}</code></dd></dl></div>
      <div class="box" style="margin-top:16px"><div class="box-h"><h3>빌드 이력</h3></div><ul class="builds">${m.builds.length ? m.builds.map(b => `<li title="${esc(b.error || '')}"><span class="stt ${b.status === 'ok' ? 'ok' : 'danger'}">${b.status === 'ok' ? '성공' : '실패'}</span><span>${onWhen(b.at)}</span><span class="muted">${onDur(b.ms)}${b.mode === 'inc' ? ' · 증분' : ''}</span><span class="r">${b.status === 'ok' ? onN(b.rows) + '행' : '실패'}</span></li>`).join('') : '<li class="muted">아직 빌드 기록이 없어요.</li>'}</ul></div>
    </div>
  </div>`;
}

Object.assign(ACT, {
  martNew: () => meOpen(null),
  martNewFromWz: () => { const c = ON.otw && ON.otw.conn; closeDrawer(); setTimeout(() => { S.view = 'onto'; if (c) ON.scope = c; meOpen(null); }, 60); },
  martOpen: async a => { const id = a.dataset.id; S.view = 'onto'; const m = Object.values(ON.cache).flat().find(x => x && x.id === id && x.home); const cid = m ? m.home : ON.scope; ON.scope = cid; ON.tab = 'mart'; ON.mv = id; ON.me = null; if (!ON.g[cid]) { try { await onLoadGraph(cid); } catch (e) { onErr(e); } } render(); window.scrollTo({ top:0 }); },
  martList: () => { ON.mv = null; ON.me = null; render(); },
  martToObj: async a => { const id = a.dataset.id, cid = ON.scope; try { await onPreload(cid); otwOpen({ conn:cid, src:'mart', pick:id, step:2 }); otwCheckPk(); } catch (e) { onErr(e); } },
  meEdit: a => meOpen(a.dataset.id),
  martRebuild: async a => { try { const m = await api.post(`/onto/marts/${encodeURIComponent(a.dataset.id)}/build`, {}); onMartPut(m); render(); toast('빌드를 시작했어요.', 'info'); onMartPoll(m.home); } catch (e) { onErr(e); } },
  meSch: a => { const e = ON.me; e.open[a.dataset.v] = !e.open[a.dataset.v]; render(); },
  meTbl: a => { const e = ON.me; e.open[a.dataset.v] = !e.open[a.dataset.v]; render(); },
  meIns: a => { const ta = $('#meSql'); if (!ta) return; const st = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? st; ta.setRangeText(a.dataset.v, st, en, 'end'); ta.focus(); INP.meSql(ta); },
  meTpl: () => { Object.assign(ON.me, { sql:ON_MART_TPL.sql, name:ON_MART_TPL.name, id:ON_MART_TPL.id, desc:ON_MART_TPL.desc, valid:null }); render(); },
  meRun: async () => {
    const e = ON.me; e.validating = true; render();
    try { e.valid = await api.post('/onto/marts/validate', { conn:ON.scope, sql:e.sql, inc:e.inc, edit:e.edit || '' }); if (!e.valid.err && e.inc && !e.valid.cols.some(c => c.c === e.inc)) e.inc = ''; }
    catch (err) { e.valid = { err:err.message }; }
    e.validating = false; if (ON.me === e) render();
  },
  meSave: async () => {
    const e = ON.me; if (!meCanSave()) return; e.saving = true; render();
    const body = { id:e.id, name:e.name, desc:e.desc, sql:e.sql, refresh:e.refresh, inc:e.inc, owner:WS.user || '' };
    try {
      const m = e.edit ? await api.put(`/onto/marts/${encodeURIComponent(e.edit)}`, body) : await api.post(`/onto/connections/${encodeURIComponent(ON.scope)}/marts`, body);
      onMartPut(m); ON.me = null; ON.mv = m.id; await onLoadOv(); render(); toast(`${m.name} 마트를 저장했어요. 빌드를 시작합니다.`); onMartPoll(m.home);
    } catch (err) { e.saving = false; onErr(err); if (ON.me === e) render(); }
  },
});
/* 한 마트의 새 값을 캐시에 끼워 넣는다 */
function onMartPut(m) { const k = 'marts:' + m.home, list = Array.isArray(ON.cache[k]) ? ON.cache[k] : []; const i = list.findIndex(x => x.id === m.id); if (i >= 0) list[i] = m; else list.push(m); ON.cache[k] = list; }
Object.assign(INP, {
  meSql: el => { const e = ON.me; e.sql = el.value; if (e.valid) { e.valid = null; const r = $('#meRes'); if (r) r.innerHTML = ''; } const b = $('#meSave'); if (b) b.disabled = !meCanSave(); },
  meF: el => { ON.me[el.dataset.k] = el.value; const b = $('#meSave'); if (b) b.disabled = !meCanSave(); },
});
Object.assign(CHG, {
  meR: el => { ON.me.refresh = el.value; },
  meInc: el => { ON.me.inc = el.value; },
});

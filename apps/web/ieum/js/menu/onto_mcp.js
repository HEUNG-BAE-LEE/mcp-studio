/* 온톨로지: AI 연결(MCP 서버). 공개한 온톨로지마다 서버 하나가 뜨고, 액세스 키(실행 사용자 지정)로 AI 앱이 붙는다. 연결 정보 탭에 들어간다. */

const ON_MCP_ST = { running:['실행 중', 'ok'], starting:['시작하는 중', 'info'], stopped:['중지됨', 'mute'], crashed:['멈춤', 'danger'], none:['서버 없음', 'mute'] };
function onMcpBox(cid) {
  const r = onNeed('mcp:' + cid, () => api.get(`/onto/connections/${encodeURIComponent(cid)}/mcp`));
  if (r === 'loading') return `<h3 class="sec-t" style="margin-top:20px">AI 연결 (MCP 서버)</h3>${onSpin()}`;
  if (r.error) return `<h3 class="sec-t" style="margin-top:20px">AI 연결 (MCP 서버)</h3><div class="md-empty">${esc(r.error)}</div>`;
  const sv = r.server, st = ON_MCP_ST[sv.state] || ON_MCP_ST.none, url = sv.url;
  const users = r.users || [];
  return `<h3 class="sec-t" style="margin-top:20px">AI 연결 (MCP 서버)</h3>
    ${sv.state === 'none' ? `<div class="notice mute">${svg('rocket', 18)}<div class="nt">${sv.autoserve === false ? '이 서버는 MCP 서버를 자동으로 띄우지 않게 설정되어 있어요(IEUM_ONTO_AUTOSERVE=0).' : '온톨로지를 공개하면 이 온톨로지의 MCP 서버가 뜹니다. 공개한 객체, 링크, 액션이 AI 도구로 바뀌어 올라가요.'}</div></div>` : `
    <div class="srow avail" style="margin:0 0 8px"><span class="si">${svg('server', 18)}</span><span class="tx"><b>${esc(r.name)}</b><span>${url ? `<code class="key">${esc(url)}</code>` : ''} 공개 버전 v${sv.ver || '?'}, 도구 ${sv.tools || 0}개</span></span><span class="stt ${st[1]}">${st[0]}</span></div>
    ${sv.state === 'crashed' ? `<div class="notice danger" style="margin:0 0 8px">${svg('alert', 18)}<div class="nt">${esc(sv.message || '서버가 멈췄어요.')}</div></div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${url ? `<button class="btn sm" data-act="copy" data-text="${esc(url)}">${svg('copy', 14)}주소 복사</button>` : ''}
      ${sv.state === 'running' || sv.state === 'starting' ? `<button class="btn sm" data-act="mcpStop" data-id="${esc(cid)}">서버 내리기</button>` : `<button class="btn sm primary" data-act="mcpStart" data-id="${esc(cid)}">서버 올리기</button>`}
      <button class="btn sm" data-act="mcpLogs" data-id="${esc(cid)}">서버 로그</button></div>
    <p class="pv-note" style="margin-top:0">서버는 기본 설정에서 이 컴퓨터(127.0.0.1)에서만 받습니다(IEUM_MCP_HOST 로 바꿀 수 있어요). 공개할 때마다 프로세스를 다시 띄우지 않고 새 버전으로 바뀌어요. 스튜디오에서 객체를 고쳐도 다시 공개하기 전에는 서버에 닿지 않습니다.</p>`}
    <h3 class="sec-t" style="margin-top:16px">액세스 키 <small>${r.keys.length}개</small></h3>
    ${r.keys.length ? `<ul class="rules" style="margin:0 0 10px">${r.keys.map(k => { const u = users.find(x => x.emp === k.runAs); return `<li><b>${esc(k.name)}</b><span>${k.runAs ? `실행 사용자 ${u ? esc(u.name) + ' ' : ''}(사번 ${esc(k.runAs)})` : '<em>실행 사용자 없음: 권한 규칙이 있는 객체는 비어 보입니다</em>'} · ${esc(k.key)} · ${esc(k.last)}</span></li>`; }).join('')}</ul>` : '<p class="muted" style="font-size:13px;margin:0 0 10px">이 서버에 쓸 수 있는 키가 없어요. 아래에서 발급하세요.</p>'}
    <div class="field"><label>키 이름</label><input class="inp" id="mcpKeyName" placeholder="예: 김현우 Claude" value=""></div>
    <div class="field"><label>실행 사용자</label><select class="inp" id="mcpKeyRun"><option value="">지정 안 함</option>${users.map(u => `<option value="${esc(u.emp)}">${esc(u.name)} (${esc(u.deptName || u.dept)} ${esc(u.rank)})</option>`).join('')}</select></div>
    <button class="btn sm primary" data-act="mcpKey" data-id="${esc(cid)}">${svg('key', 14)}액세스 키 발급</button>
    <p class="pv-note">실행 사용자를 정하면 AI 가 이 키로 부를 때 그 직원의 부서와 직급으로 행·속성 권한이 적용되고, 쓰기 액션의 제출 조건도 그 사람 기준으로 판단합니다.</p>`;
}
Object.assign(ACT, {
  mcpStart: async a => { try { await api.post(`/onto/connections/${encodeURIComponent(a.dataset.id)}/mcp/start`); delete ON.cache['mcp:' + a.dataset.id]; render(); toast('서버를 올렸어요.'); } catch (e) { onErr(e); } },
  mcpStop: async a => { try { await api.post(`/onto/connections/${encodeURIComponent(a.dataset.id)}/mcp/stop`); delete ON.cache['mcp:' + a.dataset.id]; render(); toast('서버를 내렸어요.'); } catch (e) { onErr(e); } },
  mcpLogs: async a => {
    try { const r = await api.get(`/onto/connections/${encodeURIComponent(a.dataset.id)}/mcp/logs?lines=120`);
      openModal('MCP 서버 로그', `<pre class="code" tabindex="0" style="max-height:420px;overflow:auto">${esc(r.lines.join('\n') || '로그가 없어요.')}</pre>`, null, null, { wide:true, cancel:'닫기' }); }
    catch (e) { onErr(e); }
  },
  mcpKey: async a => {
    const cid = a.dataset.id, name = $('#mcpKeyName').value, runAs = $('#mcpKeyRun').value;
    try {
      const k = await api.post(`/onto/connections/${encodeURIComponent(cid)}/mcp/keys`, { name, runAs });
      const sv = (ON.cache['mcp:' + cid] || {}).server || {}, url = sv.url || 'http://127.0.0.1:<포트>/mcp';
      delete ON.cache['mcp:' + cid]; render();
      openModal('액세스 키를 발급했어요', `<p style="margin-top:0">이 키는 지금만 볼 수 있어요. 안전한 곳에 복사해 두세요.</p>
        <div class="field"><label>키</label><input class="inp mono" readonly value="${esc(k.secret)}" onclick="this.select()"></div>
        <p class="tab-hint">Claude Code 에 연결하려면:</p>${code(`claude mcp add --transport http ieum-onto-${cid} ${url} \\\n  --header "Authorization: Bearer ${k.secret}"`, 'http')}`, '키 복사', () => { copyText(k.secret); }, { wide:true, cancel:'닫기' });
    } catch (e) { onErr(e); }
  },
});

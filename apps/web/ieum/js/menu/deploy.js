/* AI 연결 배포 */
/* ---------- AI 연결 배포 ---------- */
const CLIENTS = { claude:'Claude', gemini:'Gemini', gpt:'GPT', agent:'기타 에이전트' };
/* 서버(로컬 프로세스) 상태. 서버가 그때그때 읽어서 돌려주며, 배포 화면을 보는 동안 몇 초마다 다시 읽는다. */
const RT_STATE = { running:['배포 중', 'ok'], starting:['시작하는 중', 'info'], stopped:['중지됨', 'mute'], crashed:['비정상 종료', 'danger'] };
const rtOf = ts => ts.runtime || { state:'none' };
const endpoint = ts => rtOf(ts).url || '';
const curTs = () => TOOLSETS.find(x => x.id === S.ts) || TOOLSETS[0];
function tsChip(ts) {
  if (ts.status === 'draft') return '<span class="stt mute">초안</span>';
  const [label, kind] = RT_STATE[rtOf(ts).state] || RT_STATE.stopped;
  return `<span class="stt ${kind}">${label} ${ts.ver}</span>`;
}
function rtInfo(ts) {
  const rt = rtOf(ts), bits = [];
  if (rt.port) bits.push(`포트 ${rt.port}`);
  if (rt.pid) bits.push(`PID ${rt.pid}`);
  if (rt.startedAt && rt.state === 'running') bits.push(`${new Date(rt.startedAt * 1000).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}에 시작`);
  return bits.join(' · ');
}
/* 서버 상태에 따라 알려 줄 것. 주소가 있으면 이 주소가 어디서 열리는지도 밝힌다. */
function rtNotice(ts) {
  const rt = rtOf(ts);
  if (ts.status === 'draft') return '';
  const box = (kind, icon, text, btn) => `<div class="notice ${kind}" style="margin-top:14px">${svg(icon, 18)}<div class="nt" style="white-space:pre-wrap">${text}</div>${btn || ''}</div>`;
  if (rt.state === 'crashed') return box('danger', 'alert', `<b>서버가 종료됐습니다.</b> ${esc(rt.message || '')}`, `<button class="btn sm primary" data-act="tsStart">다시 시작</button>`);
  if (rt.state === 'stopped') return box('mute', 'info', '<b>서버가 내려가 있습니다.</b> 마지막으로 배포한 버전 그대로 다시 띄울 수 있습니다. 그동안 AI는 이 묶음의 도구를 쓸 수 없습니다.', `<button class="btn sm primary" data-act="tsStart">${svg('play', 13)}시작</button>`);
  if (rt.state === 'starting') return box('', 'refresh', '서버를 시작하는 중입니다. 잠시 뒤 주소가 열립니다.');
  return `<p class="tab-hint" style="margin:10px 0 0">이 서버는 이 컴퓨터(127.0.0.1)에서만 열려 있습니다. 같은 컴퓨터의 Claude Code, Gemini CLI 같은 앱은 바로 연결되지만, 클라우드에서 실행되는 AI(OpenAI API, 웹 커넥터 등)는 이 주소에 닿지 못합니다.</p>`;
}
function snippet(c, ts) {
  const url = endpoint(ts) || 'http://127.0.0.1:<포트>/mcp', name = `ieum-${ts.slug}`, key = 'Bearer <발급받은 액세스 키>';
  if (c === 'claude') return ['Claude Code 설정 파일(.mcp.json)에 아래처럼 등록합니다. 터미널에서는 claude mcp add --transport http 로도 추가할 수 있습니다.',
    { mcpServers:{ [name]:{ type:'http', url, headers:{ Authorization:key } } } }];
  if (c === 'gemini') return ['Gemini CLI 설정 파일(settings.json)의 mcpServers에 추가합니다.',
    { mcpServers:{ [name]:{ httpUrl:url, headers:{ Authorization:key } } } }];
  if (c === 'gpt') return ['OpenAI Responses API 요청의 tools 배열에 원격 MCP 도구로 넣습니다. OpenAI 서버가 이 주소를 직접 부르므로, 이 컴퓨터에서만 열리는 주소로는 연결되지 않습니다. 외부에서 닿는 주소가 필요합니다.',
    { type:'mcp', server_label:name, server_url:url, headers:{ Authorization:key } }];
  return ['MCP 클라이언트를 직접 만든다면 JSON-RPC 2.0 요청을 그대로 보내면 됩니다. tools/list 로 도구 목록을, tools/call 로 실행을 요청합니다.',
    `curl ${url} \\
  -H "Authorization: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`];
}
function keysBox() {
  return `<div class="sec2"><h4>액세스 키<span class="sp"></span><button class="btn sm" data-act="keyNew">${svg('key', 14)}키 발급</button></h4>
        <div class="mapw"><table class="map" style="min-width:560px"><thead><tr><th>이름</th><th>키</th><th>발급일</th><th>마지막 사용</th><th>상태</th><th></th></tr></thead><tbody>
        ${KEYS.length ? '' : '<tr><td class="empty" colspan="6">발급한 키가 없습니다. 키를 발급해 AI 앱에 연결하세요.</td></tr>'}${KEYS.map(k => `<tr><td>${esc(k.name)}</td><td class="key">${k.key}</td><td class="dsc">${k.created}</td><td class="dsc">${k.last}</td><td>${k.on ? '<span class="stt ok">사용 중</span>' : '<span class="stt mute">폐기됨</span>'}</td><td>${k.on ? `<button class="btn sm" data-act="keyRevoke" data-id="${k.id}">폐기</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>`;
}
function vDeploy() {
  if (!TOOLSETS.length) return pageHead('deploy') + `<div class="md-empty" style="margin:20px 0">도구 묶음이 없습니다. ${allTools().length ? '도구를 골라 묶음을 만들고 MCP 서버로 배포하세요.' : '먼저 원본 시스템을 연결해 도구를 만들어 주세요.'}<br><br><button class="btn primary" data-act="tsNew" ${allTools().length ? '' : 'disabled'}>도구 묶음 만들기</button></div>` + keysBox();
  const ts = TOOLSETS.find(x => x.id === S.ts) || TOOLSETS[0];
  const tools = ts.tools.map(id => TOOL[id]).filter(Boolean);
  const ready = tools.filter(t => t.status === 'done').length, held = tools.length - ready;
  const [note, body] = snippet(S.client, ts);
  const rt = rtOf(ts), url = endpoint(ts), deployed = ts.status !== 'draft';
  return pageHead('deploy') + `
  <div class="dp">
    <section class="panel" aria-label="도구 묶음">
      <div class="p-head">도구 묶음 <span class="cnt">${TOOLSETS.length}개</span></div>
      ${TOOLSETS.map(x => `<button class="ts-item ${x.id === ts.id ? 'on' : ''}" data-act="tsPick" data-id="${x.id}">
        <span class="t1"><b>${esc(x.name)}</b>${tsChip(x)}</span>
        <span class="m">도구 ${x.tools.length}개, 사용 대상 ${esc(x.audience)}</span></button>`).join('')}
      <div style="padding:12px 14px"><button class="btn" style="width:100%" data-act="tsNew">${svg('plus', 16)}도구 묶음 만들기</button></div>
    </section>
    <section aria-label="묶음 상세">
      <div class="td-head">
        <div class="tx"><div class="t1"><h3 style="font-family:inherit">${esc(ts.name)}</h3>${tsChip(ts)}</div>
          <p>사용 대상 ${esc(ts.audience)}, 마지막 변경 ${ts.updated}</p></div>
        <div class="acts"><button class="btn" data-act="tsEdit">묶음 수정</button>${deployed ? `<button class="btn" data-act="tsLog">${svg('code', 15)}서버 로그</button>` : ''}${rt.state === 'running' ? `<button class="btn" data-act="tsStop">${svg('stop', 14)}중지</button>` : ''}<button class="btn primary" data-act="deploy">${svg('rocket', 16)}${deployed ? '새 버전 배포' : '처음 배포하기'}</button></div>
      </div>
      <div class="ep-row"><span>MCP 서버 주소</span>${url ? `<div class="ep"><code>${esc(url)}</code><button class="icon-btn" data-act="copy" data-text="${esc(url)}" aria-label="주소 복사">${svg('copy', 17)}</button></div>` : '<div class="ep"><span class="muted">처음 배포하면 주소가 발급됩니다.</span></div>'}</div>
      <div class="ep-row"><span>실행 방식</span><div style="font-size:13.5px;color:var(--text-2)">${deployed ? `이 컴퓨터의 프로세스${rtInfo(ts) ? ` · ${rtInfo(ts)}` : ''}` : '배포하면 이 컴퓨터에서 서버 프로세스가 뜹니다'}</div></div>
      <div class="ep-row"><span>전송 방식</span><div style="font-size:13.5px;color:var(--text-2)">Streamable HTTP, 액세스 키 인증</div></div>
      ${rtNotice(ts)}

      <div class="sec2"><h4>AI에 연결하기</h4>
        <div class="rtabs" role="tablist" style="margin-top:0">${Object.entries(CLIENTS).map(([k, l]) => `<button class="rtab ${S.client === k ? 'on m' : ''}" role="tab" aria-selected="${S.client === k}" data-act="client" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="snip-h"><p>${note}</p><button class="btn sm" data-act="copy" data-text="${esc(typeof body === 'string' ? body : JSON.stringify(body, null, 2))}">${svg('copy', 14)}복사</button></div>
        ${typeof body === 'string' ? code(body, 'http') : code(body)}
      </div>

      <div class="dp-grid">
        <div class="sec2"><h4>포함된 도구 <small>공개 ${ready}개${held ? `, 검토가 끝나지 않은 ${held}개는 배포에서 빠집니다` : ''}</small></h4>
          <div class="mapw"><table class="map" style="min-width:420px"><thead><tr><th>도구</th><th>원본 시스템</th><th>방식</th><th>상태</th></tr></thead><tbody>
          ${tools.map(t => `<tr><td><button class="link mono" style="font-size:12.5px;text-decoration:none" data-act="goTool" data-id="${t.id}">${t.id}</button></td><td class="dsc">${esc(SRC[t.src].name)}</td><td>${modeTag(t.mode)}</td><td>${stt(t.status, TST)}</td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="sec2"><h4>보안 정책 <small>도구별 설정을 따릅니다</small></h4>
          <div class="box pol"><div class="box-b">
            <div class="tg first"><span class="tx"><b>사용자 확인 후 실행</b><small>쓰기 도구는 MCP 도구 정의에 확인 필요 표시가 붙어, 연결한 AI 앱이 사용자에게 먼저 묻습니다</small></span><b>${tools.filter(t => t.exec === 'confirm').length}개</b></div>
            <div class="tg"><span class="tx"><b>개인정보 마스킹</b><small>전화번호, 이메일 등을 가려서 전달</small></span><b>${tools.filter(t => t.mask).length}개</b></div>
            <div class="tg"><span class="tx"><b>호출 기록</b><small>모든 호출은 호출 로그에 남습니다 (최근 300건)</small></span><b>항상</b></div>
            <div class="tg"><span class="tx"><b>호출 한도</b><small>도구별 분당 한도를 액세스 키 단위로 적용</small></span><b>도구별</b></div>
          </div></div></div>
      </div>

      ${keysBox()}
    </section>
  </div>`;
}


/* 배포 실행. 저장하지 않은 도구 변경이 있으면 먼저 저장한다 — 서버는 저장된 것만 안다. */
async function deployNow(ts, dirty) {
  const btn = $('#modal [data-act="mOk"]'), msg = $('#dpMsg');
  btn.disabled = true; btn.textContent = '배포하는 중…';
  msg.innerHTML = `<div class="notice"><span class="spin"></span><div class="nt">${dirty.length ? '변경한 도구를 저장하고 ' : ''}서버를 배포하는 중입니다. 처음 띄울 때는 10초 가까이 걸릴 수 있습니다.</div></div>`;
  try {
    for (const t of dirty) { await api.put(`/studio/${t.id}/`, t); t._dirty = false; delete t._orig; t._ri = 0; }
    const r = await api.post(`/deploy/toolsets/${ts.id}/deploy/`);
    Object.assign(ts, r.toolset); closeModal(); render();
    toast(`${ts.name} ${ts.ver} 배포를 마쳤습니다. ${endpoint(ts)}${r.skipped.length ? ` (공개 상태가 아닌 도구 ${r.skipped.length}개는 빠졌습니다)` : ''}`, r.skipped.length ? 'info' : '');
  } catch (e) {
    btn.disabled = false; btn.textContent = '다시 시도';
    msg.innerHTML = `<div class="notice danger">${svg('alert', 18)}<div class="nt" style="white-space:pre-wrap;word-break:break-word">${esc(e.message)}</div></div>`;
  }
}
function deployError(title, e) {
  openModal(esc(title), `<div class="notice danger">${svg('alert', 18)}<div class="nt" style="white-space:pre-wrap;word-break:break-word">${esc(e.message)}</div></div>`, null, null, { wide:true, cancel:'닫기' });
}

/* 서버 상태는 화면 밖에서도 바뀐다(프로세스가 죽거나 콘솔이 다시 뜬다). 바뀐 게 있을 때만 다시 그린다. */
const tsSig = list => list.map(t => [t.id, t.status, t.ver, (t.runtime || {}).state, (t.runtime || {}).port, (t.runtime || {}).pid].join(':')).join('|');
async function refreshToolsets() {
  const fresh = await api.get('/deploy/toolsets/');
  if (tsSig(fresh) === tsSig(TOOLSETS)) return false;
  const byId = new Map(TOOLSETS.map(t => [t.id, t]));
  TOOLSETS.splice(0, TOOLSETS.length, ...fresh.map(f => byId.has(f.id) ? Object.assign(byId.get(f.id), f) : f));
  return true;
}
setInterval(() => {
  if (S.view !== 'deploy' || document.hidden || $('#modal').classList.contains('show')) return;
  refreshToolsets().then(changed => changed && render()).catch(() => {});
}, 4000);

/* 동작 */
Object.assign(ACT, {
  tsPick: a => { S.ts = a.dataset.id; render(); },
  client: a => { S.client = a.dataset.v; render(); },
  deploy: () => {
    const ts = curTs(), tools = ts.tools.map(id => TOOL[id]).filter(Boolean);
    const ok = tools.filter(t => t.status === 'done'), no = tools.filter(t => t.status !== 'done');
    const dirty = tools.filter(t => t._dirty), first = ts.status === 'draft';
    const nv = first ? 'v1.0' : 'v' + (parseFloat(ts.ver.slice(1)) + .1).toFixed(1);
    const how = first ? '이 컴퓨터에서 MCP 서버 프로세스가 새로 뜨고 주소가 발급됩니다.'
      : rtOf(ts).state === 'running' ? '떠 있는 서버가 다음 요청부터 새 도구 정의로 답합니다. 서버를 다시 시작하지 않아 연결된 AI가 끊기지 않습니다.'
      : '내려가 있는 서버를 새 버전으로 다시 띄웁니다.';
    openModal(`${esc(ts.name)} ${nv} 배포`, ok.length ? `<p style="margin-top:0">도구 <b>${ok.length}개</b>를 MCP 서버로 배포합니다. ${how}</p>
      ${dirty.length ? `<div class="notice warn" style="margin-bottom:10px">${svg('alert', 18)}<div class="nt">저장하지 않은 변경이 있는 도구 ${dirty.length}개를 먼저 저장하고 배포합니다.<br>${dirty.map(t => `<span class="inline-code">${t.id}</span>`).join(' ')}</div></div>` : ''}
      ${no.length ? `<div class="notice warn">${svg('alert', 18)}<div class="nt">검토가 끝나지 않은 도구 ${no.length}개는 이번 배포에서 빠집니다.<br>${no.map(t => `<span class="inline-code">${t.id}</span>`).join(' ')}</div></div>` : ''}
      <div id="dpMsg" style="margin-top:10px"></div>`
      : `<div class="notice danger">${svg('alert', 18)}<div class="nt">공개 중인 도구가 없어 배포할 수 없습니다. 변환 스튜디오에서 도구를 공개해 주세요.</div></div>`,
      ok.length ? '배포하기' : null, () => deployNow(ts, dirty));
  },
  tsStart: a => {
    const ts = curTs(); a.disabled = true; a.textContent = '시작하는 중…';
    api.post(`/deploy/toolsets/${ts.id}/start/`).then(r => { Object.assign(ts, r); render(); toast(`서버를 시작했습니다. ${endpoint(ts)}`); })
      .catch(e => { render(); deployError('서버를 시작하지 못했습니다', e); });
  },
  tsStop: () => { const ts = curTs();
    openModal('서버 중지', `<p style="margin:0"><b>${esc(ts.name)}</b> 서버를 중지하면 연결된 AI가 이 주소로 도구를 쓸 수 없습니다. 다시 시작하면 같은 주소로 돌아옵니다.</p>`, '중지', () => {
      api.post(`/deploy/toolsets/${ts.id}/stop/`).then(r => { Object.assign(ts, r); closeModal(); render(); toast(`${ts.name} 서버를 중지했습니다.`); }).catch(e => toast(e.message, 'warn'));
    }); },
  tsLog: () => { const ts = curTs();
    api.get(`/deploy/toolsets/${ts.id}/logs/?lines=300`).then(r => {
      openModal(`${esc(ts.name)} 서버 로그`, `<pre class="code" id="logBox" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:56vh">${esc(r.lines.join('\n') || '아직 남은 로그가 없습니다.')}</pre>`, null, null,
        { wide:true, cancel:'닫기', extra:`<button class="btn" data-act="tsLog">${svg('refresh', 15)}새로 읽기</button>` });
      setTimeout(() => { const b = $('#logBox'); if (b) b.scrollTop = b.scrollHeight; }, 80);
    }).catch(e => toast(e.message, 'warn'));
  },
  keyNew: () => openModal('액세스 키 발급', `<div class="field"><label>키 이름</label><input class="inp" id="keyName" placeholder="예: 영업팀 Gemini 연동"></div><p class="tab-hint" style="margin:6px 0 0">키마다 연결할 도구 묶음과 사용 대상을 따로 제한할 수 있습니다.</p>`, '발급', () => {
    const name = ($('#keyName').value || '').trim() || '새 액세스 키';
    api.post('/deploy/keys/', { name }).then(row => {
    const full = row.secret; delete row.secret; KEYS.unshift(row);
    openModal('키를 발급했습니다', `<p style="margin-top:0">아래 키는 <b>지금 한 번만</b> 보여 드립니다. 창을 닫기 전에 복사해 안전한 곳에 보관하세요.</p>
      <div class="newkey"><code>${full}</code><button class="btn sm" data-act="copy" data-text="${full}">${svg('copy', 14)}복사</button></div>`, '확인', () => { closeModal(); render(); }, { noCancel:true });
    }).catch(e => toast(e.message, 'warn'));
  }),
  keyRevoke: a => { const k = KEYS.find(x => x.id === a.dataset.id);
    openModal('액세스 키 폐기', `<p style="margin:0"><b>${esc(k.name)}</b> 키를 폐기하면 이 키로 연결한 AI는 바로 도구를 쓸 수 없습니다. 폐기한 키는 되살릴 수 없습니다.</p>`, '폐기', () => { api.post(`/deploy/keys/${k.id}/revoke/`).then(() => { k.on = false; closeModal(); render(); toast(`${k.name} 키를 폐기했습니다.`); }).catch(e => toast(e.message, 'warn')); }); },
});

/* 동작 */
Object.assign(CHG, {
  dpol: () => toast('정책을 바꿨습니다. 새 버전을 배포하면 적용됩니다.', 'info'),
});

/* 도구 묶음 만들기, 수정 */
function tsForm(ts) {
  const sel = new Set(ts ? ts.tools : []);
  return `<div class="field"><label>이름</label><input class="inp" id="tsName" value="${esc(ts ? ts.name : '')}" placeholder="예: 인사·근태 도우미"></div>
    <div class="field"><label>주소 이름</label><input class="inp mono" id="tsSlug" value="${esc(ts ? ts.slug : '')}" placeholder="hr" ${ts && ts.status !== 'draft' ? 'readonly' : ''}></div>
    <div class="field"><label>사용 대상</label><input class="inp" id="tsAud" value="${esc(ts ? ts.audience : '전 직원')}"></div>
    <div class="d-label" style="margin:12px 0 6px">포함할 도구</div>
    <div style="max-height:240px;overflow:auto;border:1px solid var(--line);padding:6px 10px">${SOURCES.map(s => `<div style="margin:6px 0 2px;font-size:12.5px;color:var(--text-2)">${esc(s.name)}</div>${srcTools(s.id).map(t => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0"><input type="checkbox" class="tsTool" value="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span class="mono" style="font-size:12.5px">${t.id}</span>${stt(t.status, TST)}</label>`).join('')}`).join('')}</div>`;
}
function tsRead() { return { name:$('#tsName').value, slug:$('#tsSlug').value, audience:$('#tsAud').value, tools:$$('.tsTool').filter(c => c.checked).map(c => c.value) }; }
Object.assign(ACT, {
  tsNew: () => openModal('도구 묶음 만들기', tsForm(null), '만들기', () => {
    api.post('/deploy/toolsets/', tsRead()).then(r => { TOOLSETS.push(r); S.ts = r.id; closeModal(); render(); toast(`${r.name} 묶음을 만들었습니다. 배포하면 MCP 주소가 열립니다.`); }).catch(e => toast(e.message, 'warn'));
  }, { wide:true }),
  tsEdit: () => {
    const ts = TOOLSETS.find(x => x.id === S.ts) || TOOLSETS[0];
    openModal('도구 묶음 수정', tsForm(ts), '저장', () => {
      api.put(`/deploy/toolsets/${ts.id}/`, tsRead()).then(r => { Object.assign(ts, r); closeModal(); render(); toast('저장했습니다. 새 버전을 배포하면 적용됩니다.'); }).catch(e => toast(e.message, 'warn'));
    }, { wide:true, extra:`<button class="btn danger" data-act="tsDel" data-id="${ts.id}">삭제</button>` });
  },
  tsDel: a => {
    const ts = TOOLSETS.find(x => x.id === a.dataset.id);
    api('DELETE', `/deploy/toolsets/${ts.id}/`).then(() => { TOOLSETS.splice(TOOLSETS.indexOf(ts), 1); S.ts = null; closeModal(); render(); toast(`${ts.name} 묶음을 삭제했습니다. 이 주소로 연결한 AI는 더 쓸 수 없습니다.`); }).catch(e => toast(e.message, 'warn'));
  },
});

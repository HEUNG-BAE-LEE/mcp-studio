/* AI 연결 배포 */
/* ---------- AI 연결 배포 ---------- */
const CLIENTS = { claude:'Claude', gemini:'Gemini', gpt:'GPT', agent:'기타 에이전트' };
const endpoint = ts => `${WS.host}/mcp/${WS.slug}/${ts.slug}`;
function snippet(c, ts) {
  const url = endpoint(ts), name = `ieum-${ts.slug}`, key = 'Bearer <발급받은 액세스 키>';
  if (c === 'claude') return ['Claude 앱의 커넥터 설정에 원격 MCP 서버 URL로 추가하거나, Claude Code 설정 파일에 아래처럼 등록합니다.',
    { mcpServers:{ [name]:{ type:'http', url, headers:{ Authorization:key } } } }];
  if (c === 'gemini') return ['Gemini CLI 설정 파일(settings.json)의 mcpServers에 추가합니다.',
    { mcpServers:{ [name]:{ httpUrl:url, headers:{ Authorization:key } } } }];
  if (c === 'gpt') return ['OpenAI Responses API 요청의 tools 배열에 원격 MCP 도구로 넣습니다.',
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
  const live = ts.status === 'live';
  return pageHead('deploy') + `
  <div class="dp">
    <section class="panel" aria-label="도구 묶음">
      <div class="p-head">도구 묶음 <span class="cnt">${TOOLSETS.length}개</span></div>
      ${TOOLSETS.map(x => `<button class="ts-item ${x.id === ts.id ? 'on' : ''}" data-act="tsPick" data-id="${x.id}">
        <span class="t1"><b>${esc(x.name)}</b>${x.status === 'live' ? `<span class="stt ok">배포 중 ${x.ver}</span>` : '<span class="stt mute">초안</span>'}</span>
        <span class="m">도구 ${x.tools.length}개, 사용 대상 ${esc(x.audience)}</span></button>`).join('')}
      <div style="padding:12px 14px"><button class="btn" style="width:100%" data-act="tsNew">${svg('plus', 16)}도구 묶음 만들기</button></div>
    </section>
    <section aria-label="묶음 상세">
      <div class="td-head">
        <div class="tx"><div class="t1"><h3 style="font-family:inherit">${esc(ts.name)}</h3>${live ? `<span class="stt ok">배포 중 ${ts.ver}</span>` : '<span class="stt mute">초안</span>'}</div>
          <p>사용 대상 ${esc(ts.audience)}, 마지막 변경 ${ts.updated}</p></div>
        <div class="acts"><button class="btn" data-act="tsEdit">묶음 수정</button><button class="btn primary" data-act="deploy">${svg('rocket', 16)}${live ? '새 버전 배포' : '처음 배포하기'}</button></div>
      </div>
      <div class="ep-row"><span>MCP 서버 주소</span>${live ? `<div class="ep"><code>${endpoint(ts)}</code><button class="icon-btn" data-act="copy" data-text="${esc(endpoint(ts))}" aria-label="주소 복사">${svg('copy', 17)}</button></div>` : '<div class="ep"><span class="muted">처음 배포하면 주소가 발급됩니다.</span></div>'}</div>
      <div class="ep-row"><span>전송 방식</span><div style="font-size:13.5px;color:var(--text-2)">Streamable HTTP, 액세스 키 인증</div></div>

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


/* 동작 */
Object.assign(ACT, {
  tsPick: a => { S.ts = a.dataset.id; render(); },
  client: a => { S.client = a.dataset.v; render(); },
  deploy: () => {
    const ts = TOOLSETS.find(x => x.id === S.ts), tools = ts.tools.map(id => TOOL[id]);
    const ok = tools.filter(t => t.status === 'done'), no = tools.filter(t => t.status !== 'done');
    const nv = ts.status === 'live' ? 'v' + (parseFloat(ts.ver.slice(1)) + .1).toFixed(1) : 'v1.0';
    openModal(`${esc(ts.name)} ${nv} 배포`, `<p style="margin-top:0">도구 <b>${ok.length}개</b>를 MCP 서버로 배포합니다. 연결된 AI는 다음 요청부터 새 도구 정의를 받습니다.</p>
      ${no.length ? `<div class="notice warn">${svg('alert', 18)}<div class="nt">검토가 끝나지 않은 도구 ${no.length}개는 이번 배포에서 빠집니다.<br>${no.map(t => `<span class="inline-code">${t.id}</span>`).join(' ')}</div></div>` : ''}`,
      '배포하기', () => { api.post(`/deploy/toolsets/${ts.id}/deploy/`).then(r => { Object.assign(ts, r.toolset); closeModal(); render(); toast(`${ts.name} ${ts.ver} 배포를 마쳤습니다.`); }).catch(e => toast(e.message, 'warn')); });
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
    <div class="field"><label>주소 이름</label><input class="inp mono" id="tsSlug" value="${esc(ts ? ts.slug : '')}" placeholder="hr" ${ts && ts.status === 'live' ? 'readonly' : ''}></div>
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

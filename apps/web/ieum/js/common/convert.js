/* 변환 생성기, 코드 하이라이트, 변환 과정(trace) */
/* ---------- 변환 생성기 ---------- */
const visibleParams = t => {
  const seen = new Set();
  return t.params.filter(p => p.a && !HIDDEN.has(p.rule) && !seen.has(p.a) && seen.add(p.a));
};
function aiArgs(t) {
  const o = {};
  visibleParams(t).forEach(p => o[p.a] = p.ax !== undefined ? p.ax : p.ex);
  return o;
}
function mcpDef(t) {
  const props = {}, req = [];
  visibleParams(t).forEach(p => {
    const [type, f] = p.at.split(' ');
    const d = { type, description: p.d };
    if (f) d.format = f.replace(/[()]/g, '');
    if (p.codes && p.codes.length) d.enum = p.codes.map(c => c[1]); else if (p.enum) d.enum = p.enum;
    if (p.rule === 'geo') d.examples = ['서울 강남구'];
    props[p.a] = d;
    if (p.req) req.push(p.a);
  });
  const def = { name: t.id, title: t.title, description: t.desc, inputSchema: { type: 'object', properties: props, required: req },
    annotations: { readOnlyHint: t.mode === 'read' } };
  if (t.mode === 'write') def.annotations.destructiveHint = !!t.destructive;
  if (t.exec === 'confirm') def._meta = { 'ieum/approval': 'user_confirm' };
  return def;
}
function setPath(o, path, v) {
  const parts = path.split('.'); let cur = o;
  parts.forEach((p, i) => {
    const last = i === parts.length - 1, arr = p.endsWith('[]'), k = arr ? p.slice(0, -2) : p;
    if (arr) { if (last) cur[k] = [v]; else { cur[k] = cur[k] || [{}]; cur = cur[k][0]; } }
    else if (last) cur[k] = v;
    else { cur[k] = cur[k] || {}; cur = cur[k]; }
  });
}
const hostOf = u => u.replace(/^https?:\/\//, '').split('/')[0];
const pathOf = u => '/' + u.replace(/^https?:\/\//, '').split('/').slice(1).join('/');

function origReq(t) {
  const s = SRC[t.src], ps = t.params.filter(p => p.o);
  if (s.proto === 'soap') {
    return `POST ${pathOf(s.base)} HTTP/1.1
Host: ${hostOf(s.base)}
Content-Type: text/xml; charset=UTF-8
SOAPAction: "urn:${t.op}"

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hr="${s.ns}">
  <soapenv:Header>
    <wsse:Security><!-- 이음 보관소의 연동 계정으로 서명 --></wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <hr:${t.op}>
${ps.map(p => `      <hr:${p.o}>${p.ex}</hr:${p.o}>`).join('\n')}
    </hr:${t.op}>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
  if (s.proto === 'gov') {
    return `GET ${pathOf(s.base)}/${t.op}
  ?${ps.map(p => `${p.o}=${p.ex}`).join('\n  &')} HTTP/1.1
Host: ${hostOf(s.base)}`;
  }
  let path = t.path; const qs = [], body = {};
  ps.forEach(p => {
    if (path.includes(`{${p.o}}`)) path = path.replace(`{${p.o}}`, p.ex);
    else if (t.method === 'GET') qs.push(`${p.o}=${encodeURIComponent(p.ex)}`);
    else body[p.o] = p.ex;
  });
  const auth = s.proto === 'sample' ? 'X-API-KEY: ••••••••' : s.proto === 'disc' ? 'Cookie: JSESSIONID=••••••••' : 'Authorization: Bearer ••••••••';
  let out = `${t.method} ${pathOf(s.base).replace(/\/$/, '')}${path}${qs.length ? '?' + qs.join('&') : ''} HTTP/1.1
Host: ${hostOf(s.base)}
${auth}`;
  if (t.method !== 'GET') out += `\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}`;
  return out;
}
function origResp(t) {
  const s = SRC[t.src];
  if (s.proto === 'soap') {
    const hasRc = t.res.some(r => r.o === 'RSLT_CD');
    const rows = (hasRc ? [] : ['      <hr:RSLT_CD>0000</hr:RSLT_CD>']).concat(t.res.map(r => `      <hr:${r.o}>${r.ov}</hr:${r.o}>`));
    return `HTTP/1.1 200 OK
Content-Type: text/xml; charset=UTF-8

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hr="${s.ns}">
  <soapenv:Body>
    <hr:${t.op}Response>
${rows.join('\n')}
    </hr:${t.op}Response>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
  if (s.proto === 'gov') {
    let body = t.resXml;
    if (!body) {
      const cats = t.res.filter(r => r.cat), plain = t.res.filter(r => !r.cat && /^[\w]+$/.test(r.o));
      const items = cats.map(r => `      <item><category>${r.cat}</category><${t.valKey}>${r.ov}</${t.valKey}></item>`);
      if (plain.length) items.push(`      <item>\n${plain.map(r => `        <${r.o}>${r.ov}</${r.o}>`).join('\n')}\n      </item>`);
      body = `<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL_SERVICE</resultMsg>
  </header>
  <body>
    <items>
${items.join('\n')}
    </items>
  </body>
</response>`;
    }
    return `HTTP/1.1 200 OK\nContent-Type: application/xml; charset=UTF-8\n\n${body}`;
  }
  const o = {};
  t.res.forEach(r => setPath(o, r.newO || r.o, r.ov));
  return `HTTP/1.1 200 OK\nContent-Type: application/json\n\n${JSON.stringify(o, null, 2)}`;
}
function aiResult(t) {
  if (t.aiOut) return t.aiOut;
  const o = {};
  t.res.forEach(r => setPath(o, r.a, r.drift && !r.fixed ? null : (r.av !== undefined ? r.av : r.ov)));
  return o;
}
function modelCall(m, name, args) {
  if (m === 'claude') return { type:'tool_use', id:'toolu_01HvQ3kT7mR2xPzN', name, input:args };
  if (m === 'gemini') return { functionCall:{ name, args } };
  if (m === 'gpt') return { tool_calls:[{ id:'call_Zp81fLx0qW', type:'function', function:{ name, arguments:JSON.stringify(args) } }] };
  return { jsonrpc:'2.0', id:42, method:'tools/call', params:{ name, arguments:args } };
}
const ruleCounts = t => {
  const c = {};
  [...t.params, ...t.res].forEach(p => { if (p.rule && p.rule !== 'keep') c[p.rule] = (c[p.rule] || 0) + 1; });
  return c;
};

/* ---------- 코드 하이라이트 ---------- */
function hlJSON(s) {
  return esc(s).replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g,
    (m, str, colon, num, kw) => str ? (colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`)
      : num ? `<span class="n">${num}</span>` : `<span class="b">${kw}</span>`);
}
function hlXML(s) {
  return esc(s)
    .replace(/&lt;!--[\s\S]*?--&gt;/g, m => `<span class="c">${m}</span>`)
    .replace(/(&lt;\/?)([\w:.-]+)((?:\s+[\w:.-]+=&quot;.*?&quot;)*)(\s*\/?&gt;)/g, (m, a, tag, attrs, b) =>
      `<span class="t">${a}${tag}</span>${attrs.replace(/([\w:.-]+)=(&quot;.*?&quot;)/g, '<span class="a">$1</span>=<span class="s">$2</span>')}<span class="t">${b}</span>`);
}
function hlHTTP(s) {
  const i = s.indexOf('\n\n');
  const head = i < 0 ? s : s.slice(0, i), body = i < 0 ? '' : s.slice(i + 2);
  const h = esc(head).split('\n').map((ln, n) => {
    if (n === 0) return ln.replace(/^(GET|POST|PUT|PATCH|DELETE|HTTP\/1\.1)(\s)/, '<span class="m">$1</span>$2').replace(/(\?|&amp;)(\w+)=/g, '$1<span class="k">$2</span>=');
    if (/^\s+(\?|&amp;)/.test(ln)) return ln.replace(/(\?|&amp;)(\w+)=/g, '$1<span class="k">$2</span>=');
    return ln.replace(/^([\w-]+):/, '<span class="k">$1</span>:');
  }).join('\n');
  if (!body) return h;
  return h + '\n\n' + (body.trim().startsWith('<') ? hlXML(body) : hlJSON(body));
}
const code = (text, lang = 'json') => `<pre class="code" tabindex="0">${lang === 'json' ? hlJSON(typeof text === 'string' ? text : JSON.stringify(text, null, 2)) : lang === 'xml' ? hlXML(text) : hlHTTP(text)}</pre>`;

/* ---------- 변환 과정(trace) ---------- */
const httpReq = o => `${o.method} ${o.url} HTTP/1.1\n${Object.entries(o.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}${o.body ? `\n\n${o.body}` : ''}`;
const httpResp = o => `HTTP/1.1 ${o.status}\n${Object.entries(o.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}${o.body ? `\n\n${o.body}` : ''}`;
const ruleChips = list => (list || []).map(ruleChip).join('');
/* 서버가 돌려준 실제 호출 기록(trace)을 단계별 화면으로 바꾼다. out = { ok, error, trace } */
function buildRealTrace(toolId, model, out, hold) {
  const t = TOOL[toolId], tr = out.trace || {}, steps = [];
  const label = (MODELS[model] || MODELS.mcp || { label:'AI' }).label;
  steps.push({ k:'ai', title:`${label}가 도구를 골랐습니다`, who:toolId,
    body:`${code(modelCall(model in MODELS ? model : 'mcp', toolId, tr.args || {}))}<div class="model-note">${svg('info', 15)}<span>모델마다 도구 호출 형식이 다릅니다. 2단계부터는 어떤 모델이든 같은 원본 요청으로 바뀝니다.</span></div>` });
  if (hold) {
    const rows = Object.entries(tr.args || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</dd>`).join('');
    steps.push({ k:'hold', hold:true, title:'사용자 확인', who:'쓰기 작업', ms:'',
      body:state => state === true ? `<div class="apv done"><b>실행을 확인했습니다</b><dl>${rows}</dl></div>`
        : `<div class="apv"><b>${esc((t && t.confirmQ) || '이 작업을 실행할까요?')}</b><dl>${rows}</dl><div class="acts"><button class="btn primary sm" data-act="approve">실행</button><button class="btn sm" data-act="reject">그만두기</button></div><small>이 도구는 사용자 확인 후 실행하도록 설정되어 있습니다.</small></div>` });
    return steps;
  }
  if (tr.originRequest) steps.push({ k:'ieum', title:'이음이 원본 요청으로 바꿨습니다', who:t ? PDESC[SRC[t.src].proto] : '', ms:`${tr.convertMs ?? 0}ms`,
    body:`<div class="rules">${ruleChips(tr.rulesReq)}<span class="rl ij" title="원본 시스템 인증 정보를 이음 보관소에서 꺼내 넣습니다">인증 정보 주입</span></div>${code(httpReq(tr.originRequest), 'http')}` });
  if (tr.originResponse) steps.push({ k:'src', title:'원본 시스템이 응답했습니다', who:t ? SRC[t.src].name : '', ms:`${tr.sourceMs ?? 0}ms`, body:code(httpResp(tr.originResponse), 'http') });
  if (out.ok) steps.push({ k:'ieum', title:'AI가 읽기 쉬운 결과로 바꿨습니다', who:'JSON', ms:'',
    body:`<div class="rules">${ruleChips(tr.rulesRes) || '<span class="rl nm">이름 정리</span>'}</div>${code(tr.aiResult || out.result || {})}` });
  else steps.push({ k:'ieum', title:'호출에 실패했습니다', who:'오류', ms:'', body:`<div class="notice warn" style="margin:0">${svg('alert', 18)}<div class="nt">${esc(out.error || '')}</div></div>` });
  return steps;
}
function traceHTML(steps, shown, state, anim) {
  let n = 0;
  return `<ol class="trace">${steps.map((st, i) => {
    if (i >= shown) return '';
    if (!st.hold) n++;
    const body = typeof st.body === 'function' ? st.body(state) : st.body;
    return `<li class="step ${st.k === 'ai' ? 'ai' : st.k === 'src' ? 'src' : st.k === 'hold' ? 'hold' : ''} ${anim && i === shown - 1 ? 'enter' : ''}" data-i="${i}">
      <span class="no">${st.hold ? svg('user', 14, 2.2) : n}</span>
      <div class="step-h"><b>${st.title}</b><span class="who">${esc(st.who)}</span>${st.ms ? `<span class="ms">${st.ms}</span>` : ''}</div>${body}</li>`;
  }).join('')}</ol>`;
}


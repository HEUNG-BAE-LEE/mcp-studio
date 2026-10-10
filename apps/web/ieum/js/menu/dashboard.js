/* 대시보드 */
/* ---------- 대시보드 ---------- */
function vDash() {
  const tools = allTools();
  const pub = tools.filter(t => t.status === 'done').length;
  const pend = tools.filter(t => t.status === 'review' || t.status === 'drift').length;
  const K = DASH.kpi, calls = K.calls24h;
  const okSrc = SOURCES.filter(s => srcStat(s) === 'ok').length;
  const kpi = `<div class="kpi">
    <div><span class="k">연결된 원본 시스템</span><span class="v">${SOURCES.length}<small>개</small></span><span class="d">정상 ${okSrc}개, 확인 필요 ${SOURCES.length - okSrc}개</span></div>
    <div><span class="k">공개 중인 AI 도구</span><span class="v">${pub}<small>개</small></span><span class="d">검토 대기 ${pend}개</span></div>
    <div><span class="k">최근 24시간 호출</span><span class="v">${fmt(calls)}<small>회</small></span><span class="d">${K.callsDeltaPct == null ? '전일 기록 없음' : `<span class="${K.callsDeltaPct >= 0 ? 'up' : ''}">${K.callsDeltaPct >= 0 ? '▲' : '▼'} ${Math.abs(K.callsDeltaPct)}%</span> 전일 대비`}</span></div>
    <div><span class="k">변환 성공률</span><span class="v">${K.successRate == null ? '—' : K.successRate}<small>${K.successRate == null ? '' : '%'}</small></span><span class="d">실패 ${fmt(K.failedCalls)}건</span></div>
    <div><span class="k">평균 변환 시간</span><span class="v">${K.convertMs == null ? '—' : K.convertMs}<small>${K.convertMs == null ? '' : 'ms'}</small></span><span class="d">${K.sourceMs == null ? '아직 호출 기록이 없습니다' : `원본 응답 평균 ${K.sourceMs}ms 별도`}</span></div>
  </div>`;

  const share = DASH.clientShare;
  const clients = Object.entries(MODELS).map(([k, m]) => `<div class="tp-node ai"><span class="ic">${svg('bot', 16)}</span><span class="nx"><span>${m.label}</span><small>${m.via}</small></span><span class="cc" title="최근 24시간 호출">${fmt((DASH.clientCalls || {})[k] || 0)}</span></div>`).join('');
  const srcs = SOURCES.map(s => { const st = srcStat(s); return `<button class="tp-node sr" data-act="goSrc" data-id="${s.id}"><span class="ic">${svg(s.proto === 'gov' ? 'globe' : 'server', 16)}</span><span class="nx"><span>${esc(s.name)}</span><small>${PRL[s.proto]}, 도구 ${srcPub(s)}개</small></span><span class="dot ${SST[st][1] === 'ok' ? '' : SST[st][1]}" title="${SST[st][0]}"></span></button>`; }).join('');
  const topo = `<div class="box"><div class="box-h"><h3>연결 구조<small>AI 쪽 형식과 원본 쪽 형식을 이음이 중간에서 바꿉니다</small></h3></div>
    <div class="topo">
      <div class="tp-col"><div class="tp-h">AI 모델, 에이전트 <span style="float:right">24시간 호출</span></div>${clients}</div>
      <div class="tp-link"><i></i><span>MCP, 함수 호출</span></div>
      <div class="tp-hub"><div class="hb">${MARK(24)}이음 게이트웨이</div>
        <ul><li>공개 도구 <b>${pub}개</b></li><li>AI 호출 형식 <b>4종</b> 변환</li><li>사용자 확인, 마스킹, 호출 한도</li></ul></div>
      <div class="tp-link"><i></i><span>SOAP, REST, XML</span></div>
      <div class="tp-col"><div class="tp-h">원본 시스템</div>${srcs}</div>
    </div></div>`;

  // 시간대별 호출
  const hours = DASH.hourly.map(x => x.hour), vals = DASH.hourly.map(x => x.calls), errs = DASH.hourly.map(x => x.errors);
  const W = 720, H = 190, L = 40, B = 24, T = 10, mx = Math.max(4, Math.ceil(Math.max(...vals, 1) / 4) * 4);
  const bw = (W - L - 6) / 24;
  let g = '';
  for (let k = 0; k <= 4; k++) { const y = T + (H - T - B) * (1 - k / 4); g += `<line class="gl" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text class="lb" x="${L - 8}" y="${y + 4}" text-anchor="end">${fmt(mx * k / 4)}</text>`; }
  vals.forEach((v, i) => {
    const x = L + 3 + i * bw, h = (H - T - B) * v / mx, eh = (H - T - B) * errs[i] / mx, y = H - B - h;
    g += `<rect class="bar" x="${x + bw * .18}" y="${y}" width="${bw * .64}" height="${h}" rx="2"><title>${hours[i]}시: ${fmt(v)}회 (실패 ${errs[i]}건)</title></rect>`;
    if (eh >= .5) g += `<rect class="er" x="${x + bw * .18}" y="${y}" width="${bw * .64}" height="${Math.max(eh, 1.5)}" rx="1"/>`;
    if (i % 3 === 2) g += `<text class="lb" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${hours[i]}시</text>`;
  });
  const chart = `<div class="box"><div class="box-h"><h3>시간대별 호출<small>최근 24시간</small></h3></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 24시간 시간대별 호출 수 막대 그래프">${g}</svg></div>
    <div class="legend2"><span><i style="background:var(--bar)"></i>성공</span><span><i style="background:var(--danger)"></i>실패</span></div></div>`;

  const top = DASH.topTools.filter(t => TOOL[t.id]), max = (top[0] || {}).calls || 1;
  const rank = `<div class="box"><div class="box-h"><h3>많이 쓰인 도구<small>최근 24시간</small></h3><button class="link" data-act="nav" data-v="logs">호출 로그 보기</button></div>
    <ul class="rank">${top.length ? '' : '<li class="md-empty" style="border:0">아직 호출 기록이 없습니다.</li>'}${top.map(t => `<li><span class="rn"><b>${t.id}</b><span>${esc(SRC[t.src].name)}</span></span><span class="rc2">${fmt(t.calls)}</span><span class="meter"><i style="width:${(t.calls / max * 100).toFixed(1)}%"></i></span></li>`).join('')}</ul></div>`;

  const al = [];
  SOURCES.filter(s => s.err).forEach(s => al.push(['danger', `${s.name} 연결에 문제가 있습니다.`, '인증 정보를 확인하고 다시 인증해 주세요.', '다시 인증', `data-act="reauth" data-id="${s.id}"`]));
  tools.filter(t => t.status === 'drift').forEach(t => { const r = t.res.find(x => x.drift && !x.fixed); al.push(['warn', `${SRC[t.src].name} API 명세가 바뀌었습니다.`, r ? `<code>${t.id}</code> 응답 필드가 <code>${esc(r.o)}</code> → <code>${esc(r.newO)}</code>(으)로 바뀌어 지금은 값이 비어서 전달됩니다.` : `<code>${t.id}</code> ${esc(t.driftMsg || '')}`, '매핑 고치기', `data-act="goTool" data-id="${t.id}"`]); });
  const wr = tools.filter(t => t.status === 'review' && t.mode === 'write');
  if (wr.length) al.push(['warn', `쓰기 작업 도구 ${wr.length}개가 검토를 기다립니다.`, wr.map(t => `<code>${t.id}</code>`).join(' '), '검토하기', `data-act="goTool" data-id="${wr[0].id}" data-f="review"`]);
  const gs = tools.filter(t => t.status === 'review' && t.guess);
  if (gs.length) al.push(['info', `${SRC[gs[0].src].name} 시스템은 호출 샘플로 형식을 추론했습니다.`, `의미가 확실하지 않은 필드가 있는 도구 ${gs.length}개를 확인해 주세요.`, '확인하기', `data-act="goTool" data-id="${gs[0].id}"`]);
  const alerts = `<div class="box"><div class="box-h"><h3>확인이 필요한 항목<small>${al.length}건</small></h3></div>
    ${al.length ? al.map(a => `<div class="alert ${a[0]}">${svg(a[0] === 'info' ? 'info' : 'alert', 18)}<div class="tx"><b>${esc(a[1])}</b><span>${a[2]}</span></div><button class="btn sm" ${a[4]}>${a[3]}</button></div>`).join('')
      : `<div class="md-empty" style="margin:18px;border:0">확인이 필요한 항목이 없습니다.</div>`}</div>`;

  if (!SOURCES.length) return pageHead('dash') + `<div class="box" style="padding:36px 28px;text-align:center"><h3 style="margin:0 0 8px">연결된 원본 시스템이 없습니다</h3><p class="tab-hint" style="margin:0 0 18px">REST(OpenAPI), SOAP(WSDL) 명세나 호출 샘플로 시스템을 연결하면 AI 도구 후보가 만들어집니다.<br>직접 붙여 볼 시스템이 없다면 이 서버의 시연용 인사 시스템(<span class="inline-code">${location.origin}/demo-origin/openapi.json</span>, 인증 X-API-KEY: demo-key)을 연결해 보세요.</p><div style="display:flex;gap:8px;justify-content:center"><button class="btn" data-act="wzOpen">하나씩 연결</button><button class="btn primary" data-act="obOpen">한 번에 연결</button></div></div>`;
  return pageHead('dash') + kpi + `<div class="dgrid"><div class="dcol">${topo}${chart}</div><div class="dcol">${alerts}${rank}</div></div>`;
}


/* 원본 시스템: 목록, 연결 마법사, API 자동 탐색 */
/* ---------- 원본 시스템 ---------- */
function srcRows() {
  const q = S.srcQ.trim().toLowerCase();
  const list = SOURCES.filter(s => (S.srcProto === 'all' || s.proto === S.srcProto) && (!q || (s.name + s.desc).toLowerCase().includes(q)));
  if (!list.length) return `<tr><td class="empty" colspan="8">${SOURCES.length ? '조건에 맞는 원본 시스템이 없습니다. 검색어나 연결 방식을 바꿔 보세요.' : '연결된 원본 시스템이 없습니다. 오른쪽 위 <b>원본 시스템 연결</b>로 시작하세요.'}</td></tr>`;
  return list.map(s => {
    const st = srcStat(s), pend = srcPending(s);
    return `<tr data-act="${s.err ? 'reauth' : 'goSrc'}" data-id="${s.id}" tabindex="0">
      <td class="l sname"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></td>
      <td>${prBadge(s.proto)}</td>
      <td class="l" style="font-size:13px;color:var(--text-2)">${esc(s.spec)}</td>
      <td style="font-size:13px">${esc(s.auth)}</td>
      <td><span class="num">${srcPub(s)}</span> <span class="muted">/ ${srcTotal(s)}</span>${pend ? `<div style="font-size:12px;color:var(--warn)">검토 ${pend}개</div>` : ''}</td>
      <td>${stt(st, SST)}</td>
      <td class="date">${esc(s.sync)}</td>
      <td>${s.err ? `<button class="btn sm" data-act="reauth" data-id="${s.id}">다시 인증</button>` : `<button class="btn sm" data-act="goSrc" data-id="${s.id}">도구 보기</button>`} <button class="btn sm" data-act="srcDel" data-id="${s.id}" aria-label="${esc(s.name)} 삭제">삭제</button></td>
    </tr>`;
  }).join('');
}
function vSrc() {
  const later = [['db', 'DB 직접 조회', 'SQL 조회문을 읽기 전용 도구로 변환'], ['graph', 'GraphQL', '스키마를 읽어 쿼리별 도구 생성'], ['layers', 'gRPC', 'proto 정의를 읽어 서비스별 도구 생성']];
  return pageHead('src') + `
  <div class="toolbar">
    <div class="search"><input type="search" placeholder="시스템 이름으로 검색" aria-label="원본 시스템 검색" data-inp="srcQ" value="${esc(S.srcQ)}"><span class="s-btn">${svg('search', 17)}</span></div>
    <select class="sel-f" data-chg="srcProto" aria-label="연결 방식">
      ${[['all', '연결 방식 전체'], ['soap', 'SOAP'], ['rest', 'REST'], ['gov', '공공데이터'], ['sample', '샘플 추론']].map(([v, l]) => `<option value="${v}" ${S.srcProto === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <span class="sp"></span>
    <button class="btn primary" data-act="wzOpen">${svg('plus', 17)}원본 시스템 연결</button>
  </div>
  <div class="twrap"><table class="utbl" style="min-width:980px">
    <thead><tr><th class="l">원본 시스템</th><th>연결 방식</th><th class="l">명세</th><th>인증</th><th>AI 도구</th><th>상태</th><th>마지막 동기화</th><th>관리</th></tr></thead>
    <tbody id="srcBody">${srcRows()}</tbody>
  </table></div>
  <p class="tab-hint">AI 도구 수는 <b>공개 중 / 전체 작업</b>입니다. 명세가 바뀌었는지는 변환 스튜디오의 <b>명세 다시 읽기</b>로 확인합니다.</p>
  ${S.disc ? discJobsHTML() : ''}
  <h3 class="sec-t">2차 개발에서 지원할 연결 방식 <small>1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다</small></h3>
  <div class="later">${later.map(l => `<div class="srow avail"><span class="si">${svg(l[0], 18)}</span><span class="tx"><b>${l[1]}</b><span>${l[2]}</span></span><span class="p2">2차</span></div>`).join('')}</div>`;
}


function discJobsHTML() {
  const d = S.disc, n = d.phase === 'running' ? null : dFound().length;
  return `<h3 class="sec-t">자동 탐색 작업</h3>
  <div class="twrap" style="margin-top:0"><table class="utbl" style="min-width:820px"><thead><tr><th class="l">대상</th><th>방식</th><th>상태</th><th>찾은 API</th><th>등록</th><th></th></tr></thead><tbody>
  <tr data-act="discOpen" tabindex="0"><td class="l sname"><b>${esc(d.name)}</b><span>${DISC_CFG.base}</span></td>
    <td style="font-size:13px">${[d.git && 'Git 소스', d.crawl && '운영 화면'].filter(Boolean).join(' + ')}</td>
    <td>${d.phase === 'running' ? '<span class="stt info">탐색 중</span>' : d.phase === 'done' ? '<span class="stt ok">등록 완료</span>' : '<span class="stt warn">검토 대기</span>'}</td>
    <td>${n == null ? '—' : `<span class="num">${n}</span>개`}</td><td>${d.registered ? d.registered + '개' : '—'}</td>
    <td><button class="btn sm" data-act="discOpen">${d.phase === 'review' ? '결과 검토' : '열기'}</button></td></tr></tbody></table></div>`;
}


/* ---------- 원본 시스템 연결 마법사 ---------- */
const WZ_STEPS = ['연결 방식', '명세 불러오기', '인증', '분석'];
const AN_STEPS = ['명세 읽기', '작업 목록 추출', '파라미터 형식 분석', 'AI 설명 초안 작성', '쓰기, 민감 작업 분류'];
function wzOpen() {
  S.wz = { step:1, mode:'rest', name:'', url:'', base:'', specText:'', fileName:'', sReq:'', sRes:'', gov:(GOV_APIS[0] || [])[0], an:0, timer:null, error:null, result:null,
    cred:{ type:'none', in:'header', name:'X-API-KEY' },
    dn:DISC_CFG.name, git:true, crawl:true, stg:true, ok:false, ban:[...BAN_WORDS], when:'now' };
  renderWz();
}
function wzBody() {
  const w = S.wz;
  if (w.step === 1) return `<p class="tab-hint" style="margin-top:0">연결할 원본 시스템이 어떤 형태로 되어 있는지 고르세요.</p>
    ${[...new Set(WZ_MODES.map(m => m.g))].map(g => `<div class="wz-g">${g}</div><div class="wz-cards">${WZ_MODES.filter(m => m.g === g).map(m => `<button class="mode-card ${w.mode === m.v ? 'on' : ''} ${m.dis ? 'dis' : ''} ${m.rec ? 'wide' : ''}" ${m.dis ? 'disabled aria-disabled="true"' : `data-act="wzMode" data-v="${m.v}"`}><span class="radio"></span><span><span class="mt">${svg(m.ic, 16)}${m.t}${m.dis ? ' <span class="p2">2차</span>' : ''}${m.rec ? ' <span class="rec">명세 없는 레거시에 추천</span>' : ''}</span><span class="mp">${m.d}</span></span></button>`).join('')}</div>`).join('')}`;
  if (w.mode === 'discover') return wzDiscBody(w);
  const nm = `<div class="field"><label>시스템 이름</label><input class="inp" data-inp="wzName" placeholder="비우면 명세의 이름을 씁니다" value="${esc(w.name)}"></div>`;
  if (w.step === 2) {
    if (w.mode === 'gov') return `<div class="field"><label>포털 API</label></div>
      <div class="gov-list">${GOV_APIS.map(g => `<label class="gov-row"><input type="radio" name="gov" value="${g[0]}" data-chg="wzGov" ${w.gov === g[0] ? 'checked' : ''}><span class="tx">${g[1]}<small>${g[2]}</small></span></label>`).join('')}</div>
      <p class="tab-hint">공공데이터포털에서 활용 신청한 API의 서비스키가 필요합니다. 다음 단계에서 입력합니다.</p>`;
    if (w.mode === 'sample') return nm + `<div class="field" style="align-items:start"><label style="padding-top:8px">요청 샘플</label><textarea class="inp" rows="3" data-inp="wzSampleReq" placeholder="curl &quot;https://erp.example.com/po/list?fromDt=20260901&quot; 또는 GET https://...">${esc(w.sReq)}</textarea></div>
      <div class="field" style="align-items:start"><label style="padding-top:8px">응답 샘플 (JSON)</label><textarea class="inp" rows="6" data-inp="wzSampleRes" placeholder='{"list":[{"PO_NO":"P-1","AMT":"1200"}]}'>${esc(w.sRes)}</textarea></div>
      <p class="tab-hint">샘플 하나로 도구 하나를 만듭니다. 응답 필드의 의미는 추정이라 변환 스튜디오에서 꼭 확인하세요.</p>`;
    const ph = { rest:'https://erp.example.com/openapi.json', soap:'https://legacy.example.com/ws/Service?wsdl' }[w.mode];
    return nm + `<div class="field"><label>명세 URL</label><input class="inp" data-inp="wzUrl" placeholder="${ph}" value="${esc(w.url)}"></div>
      <div class="or">또는</div>
      <label class="drop">${svg('upload', 24)}<br>${w.fileName ? esc(w.fileName) + ' 올림' : '명세 파일을 눌러서 고르세요'}<small>${w.mode === 'soap' ? '.wsdl, .xml' : '.json, .yaml'} 파일, 최대 10MB</small><input type="file" data-chg="wzFile" aria-label="명세 파일 선택"></label>
      <div class="field" style="margin-top:14px"><label>서버 주소</label><input class="inp mono" data-inp="wzBase" placeholder="${w.mode === 'soap' ? '비우면 WSDL의 주소를 씁니다' : '비우면 명세의 servers 주소를 씁니다'}" value="${esc(w.base)}"></div>`;
  }
  if (w.step === 3) return authFormHTML(w) + `<div class="notice" style="margin-top:14px">${svg('lock', 18)}<div class="nt">인증 정보는 이음 서버에 <b>암호화해 저장</b>합니다. AI 모델에는 전달하지 않고, 원본 요청을 보낼 때만 이음이 넣습니다.</div></div>`;
  const R = w.result, nt = R ? R.tools.length : 0, np = R ? R.tools.reduce((a, t) => a + t.params.length, 0) : 0, nw = R ? R.tools.filter(t => t.mode === 'write').length : 0;
  const done = !!R, ems = [R ? '명세 1건' : '', `작업 ${nt}개`, `파라미터 ${np}개`, `설명 ${nt}개`, `쓰기 작업 ${nw}개`];
  if (w.error) return `<div class="notice warn">${svg('alert', 18)}<div class="nt"><b>연결하지 못했습니다.</b><br>${esc(w.error)}</div></div>
    <p class="tab-hint">이전 단계로 돌아가 주소와 인증 정보를 확인해 주세요.</p>`;
  return `<div class="bar-p"><i style="width:${(done ? 1 : w.an / AN_STEPS.length) * 100}%"></i></div>
    <ul class="an">${AN_STEPS.map((x, i) => `<li class="${done || i < w.an ? 'ok' : i === w.an ? 'run' : ''}"><span class="ic">${done || i < w.an ? svg('check', 13, 3) : ''}</span>${x}${done ? `<em>${ems[i]}</em>` : ''}</li>`).join('')}</ul>
    ${done ? `<div class="res-grid"><div><span>찾은 작업</span><b>${nt}</b></div><div><span>AI 도구 후보</span><b>${nt}</b></div><div><span>쓰기 작업</span><b style="color:var(--warn)">${nw}</b></div></div>
      <div class="notice">${svg('info', 18)}<div class="nt">새로 만든 도구는 모두 <b>검토 필요</b> 상태로 시작합니다. 변환 스튜디오에서 설명과 매핑을 확인한 뒤 공개하세요.</div></div>` : ''}`;
}
const AUTH_OPTS = { gov:[['key', '서비스키']], soap:[['none', '인증 없음'], ['wss', 'WS-Security (UsernameToken)'], ['basic', 'HTTP Basic']],
  rest:[['none', '인증 없음'], ['key', 'API Key'], ['bearer', 'Bearer 토큰'], ['basic', 'HTTP Basic'], ['oauth', 'OAuth 2.0 (Client Credentials)']] };
AUTH_OPTS.sample = AUTH_OPTS.rest;
function authFormHTML(w) {
  const c = w.cred, opts = AUTH_OPTS[w.mode] || AUTH_OPTS.rest;
  if (!opts.some(o => o[0] === c.type)) c.type = opts[0][0];
  const f = (k, label, o = {}) => `<div class="field"><label>${label}</label><input class="inp ${o.mono ? 'mono' : ''}" ${o.secret ? 'type="password" autocomplete="new-password"' : ''} data-inp="wzCred" data-k="${k}" placeholder="${o.ph || ''}" value="${esc(c[k] || '')}"></div>`;
  let body = '';
  if (c.type === 'key') body = (w.mode === 'gov' ? '' : `<div class="field"><label>전달 위치</label><select class="inp" data-chg="wzCredIn"><option value="header" ${c.in === 'header' ? 'selected' : ''}>요청 헤더</option><option value="query" ${c.in === 'query' ? 'selected' : ''}>쿼리 파라미터</option></select></div>${f('name', '이름', { mono:1, ph:'X-API-KEY' })}`)
    + f('key', w.mode === 'gov' ? '서비스키' : 'API Key', { secret:1, ph:w.mode === 'gov' ? '포털에서 발급받은 일반 인증키 (Decoding)' : '' });
  else if (c.type === 'bearer') body = f('key', '토큰', { secret:1 });
  else if (c.type === 'basic' || c.type === 'wss') body = f('username', '계정') + f('password', '비밀번호', { secret:1 });
  else if (c.type === 'oauth') body = f('tokenUrl', '토큰 URL', { mono:1, ph:'https://auth.example.com/oauth/token' }) + f('clientId', 'Client ID') + f('clientSecret', 'Client Secret', { secret:1 });
  return `<div class="field"><label>인증 방식</label><select class="inp" data-chg="wzAuth">${opts.map(o => `<option value="${o[0]}" ${c.type === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>${body}`;
}
function wzDiscBody(w) {
  if (w.step === 2) return `
    <div class="field"><label>시스템 이름</label><input class="inp" data-inp="wzDn" value="${esc(w.dn)}"></div>
    <div class="dz">
      <div class="dz-h"><b>운영 접속 정보</b><small>화면 탐색에 쓰고, Git에서 찾은 API를 실제로 호출해 검증할 때도 씁니다</small></div>
      <div class="field"><label>운영 주소</label><input class="inp mono" value="${DISC_CFG.base}"></div>
      <div class="field"><label>테스트 계정</label><div class="two"><input class="inp" value="${DISC_CFG.account}" aria-label="아이디"><input class="inp" type="password" value="password" autocomplete="off" aria-label="비밀번호"></div></div>
    </div>
    <div class="dz ${w.git ? '' : 'off'}">
      <label class="dz-h ck2"><span class="sw"><input type="checkbox" data-chg="wzGit" ${w.git ? 'checked' : ''} aria-label="Git 소스 분석"><span></span></span><b>Git 소스 분석</b><small>컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다</small></label>
      ${w.git ? `<div class="field"><label>저장소 URL</label><input class="inp mono" value="${DISC_CFG.repo}"></div>
      <div class="field"><label>브랜치</label><input class="inp mono" value="${DISC_CFG.branch}"></div>
      <div class="field"><label>접근 토큰</label><input class="inp" type="password" value="token-value" autocomplete="off" aria-label="읽기 전용 접근 토큰"></div>
      <div class="field"><label>프레임워크</label><select class="inp"><option>자동 감지</option><option>전자정부 표준프레임워크 (Spring MVC)</option><option>Spring Boot</option><option>Express</option><option>FastAPI</option><option>JAX-WS</option></select></div>
      <p class="pv-note" style="margin:0 0 4px 106px">읽기 전용 토큰만 씁니다. 소스는 분석이 끝나면 지웁니다.</p>` : ''}
    </div>
    <div class="dz ${w.crawl ? '' : 'off'}">
      <label class="dz-h ck2"><span class="sw"><input type="checkbox" data-chg="wzCrawl" ${w.crawl ? 'checked' : ''} aria-label="운영 화면 탐색"><span></span></span><b>운영 화면 탐색</b><small>헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다</small></label>
      ${w.crawl ? `<div class="field"><label>시작 페이지</label><input class="inp mono" value="${DISC_CFG.start}"></div>
      <div class="field"><label>탐색 범위</label><input class="inp mono" value="/po/*"></div>
      <div class="field"><label>제외 경로</label><input class="inp mono" value="/logout.do, /admin/*"></div>
      <div class="field"><label>최대 화면 수</label><input class="inp" type="number" value="50" style="width:120px"></div>` : ''}
    </div>`;
  return `
    <div class="tg first"><span class="tx"><b>쓰기 요청 차단</b><small>화면 탐색 중 생기는 POST, PUT, DELETE 요청은 가로채서 형식만 기록하고 운영에 보내지 않습니다. 로그인 요청만 예외로 보냅니다.</small></span><span class="sw"><input type="checkbox" checked disabled aria-label="쓰기 요청 차단"><span></span></span></div>
    <div class="tg"><span class="tx"><b>누르지 않을 버튼</b><small>버튼 글자에 아래 단어가 들어 있으면 누르지 않고 건너뜁니다</small>
      <span class="bans">${w.ban.map(b => `<span>${esc(b)}<button data-act="wzBanDel" data-v="${esc(b)}" aria-label="${esc(b)} 빼기">${svg('close', 12, 2.4)}</button></span>`).join('')}<input class="inp" id="banIn" placeholder="단어 추가" aria-label="누르지 않을 단어 추가"></span></span></div>
    <div class="tg"><span class="tx"><b>Git에서 찾은 쓰기 API 검증</b><small>운영에서는 쓰기 API를 부르지 않습니다</small>
      <span class="radios"><button class="opt ${w.stg ? 'on' : ''}" data-act="wzStg" data-v="1"><span class="radio"></span><span><b>스테이징에서 검증</b><small class="mono">${DISC_CFG.staging}</small></span></button>
      <button class="opt ${w.stg ? '' : 'on'}" data-act="wzStg" data-v="0"><span class="radio"></span><span><b>검증하지 않음</b><small>미검증으로 표시하고 검토 때 직접 확인합니다</small></span></button></span></span></div>
    <div class="tg"><span class="tx"><b>캡처 데이터 개인정보 마스킹</b><small>전화번호, 사업자번호, 이메일은 저장 전에 가립니다</small></span><span class="sw"><input type="checkbox" checked aria-label="개인정보 마스킹"><span></span></span></div>
    <div class="tg"><span class="tx"><b>탐색 시작 시각</b><small>운영 부하를 줄이려면 사용자가 적은 시간에 예약하세요</small></span><select class="inp" style="width:auto" data-chg="wzWhen"><option value="now" ${w.when === 'now' ? 'selected' : ''}>지금 바로</option><option value="night" ${w.when === 'night' ? 'selected' : ''}>오늘 19:00 예약</option></select></div>
    <label class="own ${w.ok ? 'on' : ''}"><input type="checkbox" data-chg="wzOk" ${w.ok ? 'checked' : ''}><span><b>운영 시스템 담당자에게 탐색 승인을 받았습니다</b><small>승인자 ${esc(DISC_CFG.owner)}, 탐색 기록은 담당자에게도 공유됩니다</small></span></label>`;
}
function renderWz() {
  const w = S.wz; if (!w) return;
  if (w.mode === 'discover') {
    const steps = ['연결 방식', '탐색 대상', '안전 설정'];
    const html = `<div class="d-head"><div class="ttl"><div class="ag">원본 시스템</div><h3 id="dTitle">원본 시스템 연결</h3><p>명세가 없는 시스템은 Git 소스와 운영 화면을 분석해 API를 찾습니다.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
      <div class="d-body"><div class="wz-steps">${steps.map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div><div id="wzBody">${wzBody()}</div></div>
      <div class="d-foot"><span class="info">${w.step}/3 단계</span>${w.step > 1 ? '<button class="btn" data-act="wzPrev">이전</button>' : ''}
        ${w.step === 3 ? `<button class="btn primary" data-act="wzDisc" ${w.ok ? '' : 'disabled'}>${svg('play', 15)}${w.when === 'now' ? '탐색 시작' : '탐색 예약'}</button>` : '<button class="btn primary" data-act="wzNext">다음</button>'}</div>`;
    if ($('#drawer').classList.contains('show')) $('#drawer').innerHTML = html; else openDrawer(html);
    return;
  }
  const last = w.step === 4, done = !!w.result;
  const html = `<div class="d-head"><div class="ttl"><div class="ag">원본 시스템</div><h3 id="dTitle">원본 시스템 연결</h3><p>REST(OpenAPI), SOAP(WSDL), 공공데이터포털, 호출 샘플로 연결합니다.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body">
      <div class="wz-steps">${WZ_STEPS.map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div>
      <div id="wzBody">${wzBody()}</div>
    </div>
    <div class="d-foot"><span class="info">${w.step}/4 단계</span>
      ${w.step > 1 && !last ? '<button class="btn" data-act="wzPrev">이전</button>' : ''}
      ${w.error ? '<button class="btn" data-act="wzPrev">이전</button>' : ''}
      ${last && w.error ? '' : last ? `<button class="btn primary" data-act="wzFinish" ${done ? '' : 'disabled'}>변환 스튜디오에서 검토</button>` : `<button class="btn primary" data-act="wzNext">${w.step === 3 ? '연결하고 분석 시작' : '다음'}</button>`}</div>`;
  if ($('#drawer').classList.contains('show')) $('#drawer').innerHTML = html; else openDrawer(html);
}
function wzAnalyze() {
  const w = S.wz; if (!w) return;
  w.an = 0; w.error = null; w.result = null;
  const tick = () => { if (S.wz !== w || w.result || w.error) return; if (w.an < AN_STEPS.length - 1) { w.an++; renderWz(); } w.timer = setTimeout(tick, 700); };
  w.timer = setTimeout(tick, 500);
  api.post('/sources/connect/', { mode:w.mode, name:w.name.trim(), specUrl:w.url.trim(), specText:w.specText, base:w.base.trim(), gov:w.gov,
    auth:w.cred, sampleRequest:w.sReq, sampleResponse:w.sRes })
    .then(r => { clearTimeout(w.timer); SOURCES.push(r.source); SRC[r.source.id] = r.source; TOOLS[r.source.id] = r.tools; indexTools(); w.result = r; if (S.wz === w) renderWz(); if (S.view !== 'play') render(); })
    .catch(e => { clearTimeout(w.timer); w.error = e.message; if (S.wz === w) renderWz(); });
}
function wzFinish() {
  const r = S.wz && S.wz.result; if (!r) return;
  closeDrawer();
  Object.assign(S, { view:'studio', src:r.source.id, tool:r.tools[0].id, tf:'all', tq:'' });
  render();
  toast(`'${r.source.name}' 연결을 마쳤습니다. 도구 후보 ${r.tools.length}개를 검토해 주세요.`);
}

/* ---------- API 자동 탐색 ---------- */
const D_TAG = { cap:['캡처','info'], allow:['허용 (로그인)','ont'], out:['범위 밖','mute'], block:['차단','danger'], ok:['검증','ok'], stg:['스테이징 검증','ok'], err:['검증 실패','danger'], file:['파일 응답','warn'], nf:['없음','warn'] };
const D_STAGES = [['src','소스 분석'],['web','화면 탐색'],['merge','교차 확인'],['verify','호출 검증'],['review','결과 검토']];
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function discStart(opt) {
  const git = opt.git, crawl = opt.crawl, stg = opt.stg;
  const found = a => (git && a.src) || (crawl && a.tr);
  const ev = DISC_EVENTS.filter(e => (e.l === 'git' && git) || (e.l === 'web' && crawl) || e.l === 'sys');
  DISC_APIS.filter(found).forEach(a => {
    const v = a.verify, onlyTr = !(git && a.src);
    if (['ok', 'file', '404'].includes(v.k)) ev.push({ l:'vfy', m:a.m, p:a.path, code:v.code, ms:v.ms, tag:v.k === 'ok' ? 'ok' : v.k === 'file' ? 'file' : 'nf', api:a.id, dt:2 });
    if ((v.k === 'stg' || v.k === 'stgerr') && stg && !onlyTr) ev.push({ l:'vfy', env:'stg', m:a.m, p:a.path, code:v.code, ms:v.ms, tag:v.k === 'stg' ? 'stg' : 'err', api:a.id, dt:3 });
  });
  ev.push({ l:'sys', k:'stage', st:'review', msg:'탐색을 마쳤습니다. 결과를 검토해 주세요', dt:1 });
  if (S.disc && S.disc.timer) clearTimeout(S.disc.timer);
  S.disc = { ...opt, ev, i:0, t:0, phase:'running', sel:new Set(), filter:'all', timer:null, registered:0,
    log:[], files:[], gitStages:[], pages:0, scr:crawl ? 'blank' : null, hl:null, hlKind:null, act:'탐색을 준비하고 있습니다', stage:{ src:git ? 'run' : 'skip', web:crawl ? 'run' : 'skip', merge:'wait', verify:'wait', review:'wait' } };
  go('disc'); discTick();
}
function discApply(e) {
  const d = S.disc; d.t += e.dt || 1;
  if (e.msg) d.act = e.msg;
  if (e.l === 'git') {
    if (e.k === 'stage') d.gitStages.push(e);
    if (e.k === 'file') d.files.push(e);
    if (e.k === 'stage' && e.msg.startsWith('MyBatis')) d.stage.src = 'done';
  }
  if (e.l === 'web') {
    if (e.scr) d.scr = e.scr;
    d.hl = e.hl || (e.k === 'page' ? null : d.hl); d.hlKind = e.k === 'skip' ? 'skip' : e.tag === 'block' ? 'block' : 'act';
    if (e.k === 'page') { d.pages = e.cnt; d.hl = null; }
    if (e.k === 'req') d.log.push({ t:d.t, ...e });
    if (e.k === 'skip') d.log.push({ t:d.t, note:e.msg, skip:1 });
    if (e.k === 'done') { d.pages = e.cnt; d.stage.web = 'done'; d.hl = null; d.scr = 'done'; }
  }
  if (e.l === 'vfy') d.log.push({ t:d.t, ...e });
  if (e.l === 'sys' && e.k === 'stage') {
    if (e.st === 'merge') { if (d.stage.src === 'run') d.stage.src = 'done'; if (d.stage.web === 'run') d.stage.web = 'done'; d.stage.merge = 'run'; }
    if (e.st === 'verify') { d.stage.merge = 'done'; d.stage.verify = 'run'; }
    if (e.st === 'review') { d.stage.merge = 'done'; d.stage.verify = 'done'; d.stage.review = 'run'; d.phase = 'review'; discDefaultSel(); }
  }
}
function discTick() {
  const d = S.disc; if (!d || d.phase !== 'running') return;
  d.timer = setTimeout(() => {
    if (!S.disc || S.disc !== d) return;
    discApply(d.ev[d.i++]);
    if (S.view === 'disc') { if (d.phase === 'review') render(); else discLive(); }
    if (d.phase === 'running' && d.i < d.ev.length) discTick();
  }, d.i === 0 ? 300 : d.ev[d.i] && d.ev[d.i].l === 'vfy' ? 260 : 480);
}
function discSkip() { const d = S.disc; clearTimeout(d.timer); while (d.phase === 'running' && d.i < d.ev.length) discApply(d.ev[d.i++]); render(); }

/* 탐색 결과 계산 */
function dEvidence(a) {
  const d = S.disc, s = d.git && !!a.src, t = d.crawl && !!a.tr;
  return s && t ? 'both' : s ? 'src' : t ? 'tr' : null;
}
function dFound() { return DISC_APIS.filter(dEvidence); }
function dVerify(a) {
  const d = S.disc, v = a.verify, onlyTr = !(d.git && a.src);
  if (v.k === 'ok') return [`운영 ${v.code}, ${v.ms}ms`, 'ok'];
  if (v.k === 'file') return [`운영 ${v.code}, 엑셀 파일`, 'warn'];
  if (v.k === '404') return [`운영 ${v.code}`, 'danger'];
  if (v.k === 'block') return ['쓰기라 보내지 않음', 'mute'];
  if (v.k === 'out') return ['범위 밖이라 생략', 'mute'];
  if (!d.stg || onlyTr) return ['미검증', 'mute'];
  return v.k === 'stg' ? [`스테이징 ${v.code}, ${v.ms}ms`, 'ok'] : [`스테이징 ${v.code}`, 'danger'];
}
function dRec(a) {
  if ((a.verify.k === 'stg' || a.verify.k === 'stgerr') && (!S.disc.stg || !(S.disc.git && a.src))) return ['check', '쓰기 API를 검증하지 않았으니 형식을 직접 확인해 주세요'];
  return [a.rec, a.recNote || (a.rec === 'yes' ? '' : '')];
}
const REC = { yes:['등록 추천','ok'], check:['확인 필요','warn'], no:['제외 추천','mute'] };
function discDefaultSel() { const d = S.disc; d.sel = new Set(dFound().filter(a => a.tool && dRec(a)[0] === 'yes').map(a => a.id)); }

/* 가짜 레거시 화면 */
function lgScreen(scr, hl, kind) {
  const H = k => hl === k ? ` lg-hl ${kind}" data-tg="${kind === 'skip' ? '건너뜀' : kind === 'block' ? '차단' : '클릭'}` : '';
  const menu = a => `<div class="lg-menu">${['메인','발주 현황','발주 등록','구매요청','거래처 관리','통계'].map(m => `<span class="${m === a ? 'on' : ''}">${m}</span>`).join('')}</div>`;
  const shell = (a, body) => `<div class="lg-top"><b>구매관리시스템</b><span>구매팀 테스트계정 | 로그아웃</span></div><div class="lg-wrap">${menu(a)}<div class="lg-body">${body}</div></div>`;
  if (scr === 'blank') return `<div class="lg-blank">브라우저를 띄우는 중</div>`;
  if (scr === 'done') return `<div class="lg-blank">${svg('check', 28, 2.4)}<br>화면 ${S.disc.pages}개 탐색을 마쳤습니다</div>`;
  if (scr === 'login') return `<div class="lg-login"><b>구매관리시스템</b><label>아이디<span class="lg-in">${DISC_CFG.account}</span></label><label>비밀번호<span class="lg-in">••••••••••</span></label><span class="lg-btn pri${H('login')}">로그인</span></div>`;
  if (scr === 'main') return shell('메인', `<div class="lg-h">월별 발주 현황</div><div class="lg-bars">${[42, 55, 38, 61, 70, 52, 66, 74, 58].map(h => `<i style="height:${h}%"></i>`).join('')}</div><div class="lg-h">공지사항</div><div class="lg-ls"><span>10월 발주 마감 일정 안내</span><span>거래처 정보 일제 정비 요청</span></div>`);
  if (scr === 'poList') return shell('발주 현황', `<div class="lg-h">발주 현황</div><div class="lg-srch"><span class="lg-in">2026-09-01</span>~<span class="lg-in">2026-09-30</span><span class="lg-in">상태: 전체</span><span class="lg-btn pri${H('search')}">조회</span></div>
    <div class="lg-tb"><div class="th"><span>발주번호</span><span>거래처</span><span>금액</span><span>상태</span></div>${[['PO-2609-0142','한빛상사','4,850,000','승인대기'],['PO-2609-0139','대한오피스','1,230,000','승인'],['PO-2609-0127','미래상사','760,000','승인']].map((r, i) => `<div class="${i === 0 ? 'tr' + H('row') : 'tr'}">${r.map(c => `<span>${c}</span>`).join('')}</div>`).join('')}</div>`);
  if (scr === 'poReg') return shell('발주 등록', `<div class="lg-h">발주 등록</div><div class="lg-form"><span>거래처</span><span class="lg-in">한빛상사</span><span class="lg-btn${H('vend')}">찾기</span></div>
    <div class="lg-tb"><div class="th"><span>품목</span><span>단가</span><span>수량</span></div><div class="tr${H('item')}"><span>A4 복사용지 80g</span><span>12,500</span><span>20</span></div></div>
    <div class="lg-acts"><span class="lg-btn pri${H('save')}">저장</span><span class="lg-btn">취소</span></div>`);
  if (scr === 'prList') return shell('구매요청', `<div class="lg-h">구매요청함</div><div class="lg-tb"><div class="th"><span>요청번호</span><span>제목</span><span>요청자</span><span>상태</span></div>${[['PR-2609-0088','10월 사무용품 구매','홍길동','요청'],['PR-2609-0081','모니터 교체','최유나','승인']].map(r => `<div class="tr">${r.map(c => `<span>${c}</span>`).join('')}</div>`).join('')}</div>`);
  if (scr === 'prReg') return shell('구매요청', `<div class="lg-h">구매요청 작성</div><div class="lg-form"><span>제목</span><span class="lg-in wide">10월 사무용품 구매</span></div>
    <div class="lg-budget"><span>부서 예산 잔액</span><b>8,550,000원</b><span class="lg-btn${H('budget')}">예산 확인</span></div>
    <div class="lg-draft${H('draft')}">자동 임시저장 중…</div><div class="lg-acts"><span class="lg-btn pri${H('submit')}">요청 전송</span></div>`);
  return '';
}

/* 렌더 */
function dStepper(d) {
  return `<div class="dstep">${D_STAGES.map(([k, l], i) => { const st = d.stage[k];
    return `${i ? '<span class="ds-line"></span>' : ''}<span class="ds ${st}"><em>${st === 'done' ? svg('check', 12, 3) : st === 'skip' ? '–' : i + 1}</em>${l}${st === 'skip' ? ' <small>안 함</small>' : ''}</span>`; }).join('')}</div>`;
}
function dCounters(d) {
  const reqs = d.log.filter(x => !x.skip && x.l === 'web').length, blocked = d.log.filter(x => x.tag === 'block').length, skips = d.log.filter(x => x.skip).length;
  const ids = new Set(); d.files.forEach(f => f.apis.forEach(x => ids.add(x))); d.log.forEach(x => x.api && x.l === 'web' && ids.add(x.api));
  return `<div class="dk">
    <div><span class="k">방문한 화면</span><span class="v">${d.crawl ? d.pages + '<small> / 50</small>' : '—'}</span></div>
    <div><span class="k">캡처한 요청</span><span class="v">${d.crawl ? reqs : '—'}</span></div>
    <div><span class="k">분석한 컨트롤러</span><span class="v">${d.git ? d.files.length : '—'}</span></div>
    <div><span class="k">발견한 API 후보</span><span class="v num">${ids.size}</span></div>
    <div><span class="k">차단한 쓰기 요청</span><span class="v" style="color:${blocked ? 'var(--danger)' : 'inherit'}">${d.crawl ? blocked : '—'}</span></div>
    <div><span class="k">건너뛴 동작</span><span class="v">${d.crawl ? skips : '—'}</span></div></div>`;
}
function dNetLog(d) {
  if (!d.log.length) return '<div class="empty-s">아직 기록된 요청이 없습니다.</div>';
  return d.log.map((x, i) => x.skip ? `<div class="nl skip ${i === d.log.length - 1 ? 'enter' : ''}"><span class="nt2">${mmss(x.t)}</span><span class="nn">${svg('alert', 13)}${esc(x.note)}</span></div>`
    : `<div class="nl ${i === d.log.length - 1 ? 'enter' : ''}"><span class="nt2">${mmss(x.t)}</span><span class="mth ${x.m === 'GET' ? 'g' : 'p'}">${x.m}</span><span class="np" title="${esc(x.p)}">${x.env === 'stg' ? '<i>스테이징</i> ' : ''}${esc(x.p)}</span><span class="nc">${x.code ?? '—'}</span><span class="ntag ${D_TAG[x.tag][1]}">${D_TAG[x.tag][0]}</span></div>`).join('');
}
function dGit(d) {
  if (!d.git) return '<div class="empty-s">이번 탐색에서는 Git 소스 분석을 하지 않았습니다.</div>';
  return `<div class="gst">${d.gitStages.map(s => `<div><span class="ok">${svg('check', 13, 3)}</span><b>${s.msg}</b><span>${esc(s.det)}</span></div>`).join('') || '<div class="muted">저장소를 내려받는 중</div>'}</div>
    <div class="gfiles">${d.files.map((f, i) => `<div class="gf ${i === d.files.length - 1 ? 'enter' : ''}"><span class="gn">${svg('code', 14)}<span>…/po/web/${f.f}</span></span><span class="gr">${f.apis.map(id => `<span class="mth ${DA[id].m === 'GET' ? 'g' : 'p'}">${DA[id].m}</span><span class="gp">${DA[id].path}${DA[id].src.dep ? ' <em>@Deprecated</em>' : ''}</span>`).join('')}</span>${f.note ? `<span class="gnote">${f.note}</span>` : ''}</div>`).join('')}</div>`;
}
function discLiveHTML(d) {
  return `${dStepper(d)}<div class="dact">${d.phase === 'running' ? '<span class="spin"></span>' : svg('check', 15, 2.6)}<span>${esc(d.act)}</span><span class="sp"></span><span class="muted">경과 ${mmss(d.t)}</span></div>
  ${dCounters(d)}
  <div class="dgrid2">
    <section class="box"><div class="box-h"><h3>운영 화면 탐색<small>헤드리스 브라우저</small></h3>${d.crawl && d.phase === 'running' && d.stage.web === 'run' ? '<span class="live">탐색 중</span>' : ''}</div>
      ${d.crawl ? `<div class="bw"><div class="bw-bar">${svg('lock', 13)}<span>${DISC_CFG.base}${esc((d.ev.slice(0, d.i).filter(e => e.url).pop() || {}).url || '')}</span></div><div class="bw-view lg">${lgScreen(d.scr, d.hl, d.hlKind)}</div></div>` : '<div class="empty-s">이번 탐색에서는 화면 탐색을 하지 않았습니다.</div>'}
    </section>
    <section class="box"><div class="box-h"><h3>네트워크 기록<small>이음이 캡처하고 보낸 요청</small></h3></div><div class="netlog" id="netlog">${dNetLog(d)}</div></section>
  </div>
  <section class="box" style="margin-top:20px"><div class="box-h"><h3>Git 소스 분석<small>${DISC_CFG.repo.replace('https://', '')}</small></h3></div><div class="box-b" id="gitPane">${dGit(d)}</div></section>`;
}
function discLive() {
  const d = S.disc, el = $('#discBody'); if (!el) return;
  el.innerHTML = discLiveHTML(d);
  const nl = $('#netlog'); if (nl) nl.scrollTop = nl.scrollHeight;
}
function discHead(d) {
  const st = d.phase === 'running' ? '<span class="stt info">탐색 중</span>' : d.phase === 'done' ? '<span class="stt ok">등록 완료</span>' : '<span class="stt warn">검토 대기</span>';
  const how = [d.git && 'Git 소스 분석', d.crawl && '운영 화면 탐색'].filter(Boolean).join(', ');
  return `<button class="link" data-act="nav" data-v="src" style="text-decoration:none;display:inline-flex;align-items:center;gap:2px;font-size:13.5px">${svg('back', 15)}원본 시스템</button>
  <div class="page-head" style="margin-top:6px"><h2>${esc(d.name)} 자동 탐색</h2>${st}<p>${how}, 운영 ${DISC_CFG.base}</p>
    <span class="sp" style="flex:1"></span>${d.phase === 'running' ? '<button class="btn" data-act="discSkip">끝까지 건너뛰기</button>' : '<button class="btn" data-act="discReplay">' + svg('refresh', 15) + '탐색 과정 다시 보기</button>'}</div>`;
}
function vDisc() {
  const d = S.disc;
  if (!d) { S.view = 'src'; return vSrc(); }
  if (d.phase === 'running') return discHead(d) + `<div id="discBody">${discLiveHTML(d)}</div>`;
  return discHead(d) + discResultHTML(d);
}

/* 결과 검토 */
function discRows(d) {
  const f = d.filter, list = dFound().filter(a => f === 'all' || (f === 'rec' ? dRec(a)[0] === 'yes' : dEvidence(a) === f));
  const order = { yes:0, check:1, no:2 };
  list.sort((a, b) => order[dRec(a)[0]] - order[dRec(b)[0]]);
  if (!list.length) return `<tr><td class="empty" colspan="7">이 조건에 맞는 API가 없습니다.</td></tr>`;
  return list.map(a => { const e = dEvidence(a), [vl, vc] = dVerify(a), [rk, rn] = dRec(a);
    return `<tr data-act="discEv" data-id="${a.id}" tabindex="0" class="${d.sel.has(a.id) ? 'sel' : ''}">
      <td class="ck" data-act="noop"><input type="checkbox" data-chg="dsel" data-id="${a.id}" ${d.sel.has(a.id) ? 'checked' : ''} ${a.tool && d.phase !== 'done' ? '' : 'disabled'} aria-label="${esc(a.title)} 선택" title="${a.tool ? '' : 'AI 도구로 만들 수 없는 API입니다'}"></td>
      <td class="l"><div class="api"><span class="mth ${a.m === 'GET' ? 'g' : 'p'}">${a.m}</span><span class="tn">${esc(a.path)}</span></div><div class="api-s">${esc(a.title)}${a.tool ? ` <span class="mono">${a.tool}</span>` : ''}</div></td>
      <td><span class="evb ${e === 'tr' ? 'off' : 's'}">소스</span><span class="evb ${e === 'src' ? 'off' : 't'}">트래픽</span></td>
      <td class="l" style="font-size:13px;color:var(--text-2);white-space:normal;min-width:150px">${a.tr && d.crawl ? esc(a.tr.screen) : '<span class="muted">화면 호출 없음</span>'}</td>
      <td><span class="stt ${vc}">${vl}</span></td>
      <td>${modeTag(a.mode)}</td>
      <td class="l" style="white-space:normal;min-width:170px">${stt(rk, REC)}${rn ? `<div style="font-size:12px;color:var(--text-3);margin-top:3px;line-height:1.45">${esc(rn)}</div>` : ''}</td></tr>`; }).join('');
}
function discResultHTML(d) {
  const all = dFound(), n = k => all.filter(a => dEvidence(a) === k).length, rec = all.filter(a => dRec(a)[0] === 'yes').length;
  const blocked = d.log.filter(x => x.tag === 'block').length, skips = d.log.filter(x => x.skip).length;
  const stgN = all.filter(a => ['stg', 'stgerr'].includes(a.verify.k) && d.stg && d.git && a.src).length;
  const venn = `<svg viewBox="0 0 320 170" class="venn" role="img" aria-label="소스 ${n('src')}개, 둘 다 ${n('both')}개, 트래픽 ${n('tr')}개">
    <circle cx="118" cy="85" r="72" class="vs"/><circle cx="202" cy="85" r="72" class="vt"/>
    <g data-act="dfilter" data-v="src" class="vz ${d.filter === 'src' ? 'on' : ''}"><text x="82" y="82" class="vn">${n('src')}</text><text x="82" y="102" class="vl">소스에만</text></g>
    <g data-act="dfilter" data-v="both" class="vz ${d.filter === 'both' ? 'on' : ''}"><text x="160" y="82" class="vn">${n('both')}</text><text x="160" y="102" class="vl">모두 확인</text></g>
    <g data-act="dfilter" data-v="tr" class="vz ${d.filter === 'tr' ? 'on' : ''}"><text x="238" y="82" class="vn">${n('tr')}</text><text x="238" y="102" class="vl">트래픽에만</text></g>
    <text x="70" y="16" class="vh">Git 소스</text><text x="250" y="16" class="vh">운영 트래픽</text></svg>`;
  return `${dStepper(d)}
  ${d.phase === 'done' ? `<div class="notice" style="margin-top:16px">${svg('check', 18)}<div class="nt"><b>도구 후보 ${d.registered}개를 등록했습니다.</b> 변환 스튜디오에서 설명과 매핑을 검토한 뒤 공개하세요.</div><button class="btn sm primary" data-act="goSrc" data-id="po">변환 스튜디오 열기</button></div>` : ''}
  <div class="dsum">
    <section class="box"><div class="box-h"><h3>찾은 API ${all.length}개<small>원을 누르면 해당 API만 볼 수 있습니다</small></h3></div>
      <div class="dsum-b">${venn}<ul class="vleg">
        <li><b>모두 확인 ${n('both')}개</b>실제로 쓰이고 있고 소스로 형식까지 확인한 API</li>
        <li><b>소스에만 ${n('src')}개</b>화면에서 호출되지 않은 API. 쓰기 기능이거나 사용하지 않는 API일 수 있습니다</li>
        <li><b>트래픽에만 ${n('tr')}개</b>저장소에 소스가 없는 API. 공통 모듈이나 다른 저장소에 있을 수 있습니다</li></ul></div></section>
    <section class="box"><div class="box-h"><h3>안전하게 탐색했습니다</h3></div><ul class="safe">
      <li>${svg('shield', 16)}<span>쓰기 요청 <b>${blocked}건</b>을 가로채 운영에 보내지 않았습니다</span></li>
      <li>${svg('alert', 16)}<span>누르지 않을 버튼과 제외 경로 <b>${skips}개</b>를 건너뛰었습니다</span></li>
      <li>${svg('lock', 16)}<span>캡처한 응답의 개인정보 <b>12건</b>을 저장 전에 가렸습니다</span></li>
      <li>${svg('server', 16)}<span>${!d.git ? '화면 탐색만 해서 운영에는 읽기 요청만 다시 보냈습니다' : d.stg ? `쓰기 API <b>${stgN}개</b>는 스테이징(${DISC_CFG.staging.replace('http://', '')})에서만 검증했습니다` : '쓰기 API는 검증하지 않고 미검증으로 남겼습니다'}</span></li>
      <li>${svg('user', 16)}<span>${esc(d.owner)} 승인을 받고 탐색했습니다</span></li></ul></section>
  </div>
  <div class="toolbar"><div class="tl-f" style="padding:0;border:0">${[['all', '전체', all.length], ['rec', '등록 추천', rec], ['both', '모두 확인', n('both')], ['src', '소스에만', n('src')], ['tr', '트래픽에만', n('tr')]].map(([v, l, c]) => `<button class="${d.filter === v ? 'on' : ''}" data-act="dfilter" data-v="${v}">${l}<b>${c}</b></button>`).join('')}</div>
    <span class="sp"></span><span class="muted" style="font-size:12.5px">행을 누르면 소스 코드, 캡처한 요청, 파라미터 추론 근거를 볼 수 있습니다</span></div>
  <div class="twrap"><table class="utbl dtbl" style="min-width:1040px"><thead><tr><th class="ck"></th><th class="l">API</th><th>근거</th><th class="l">호출된 화면</th><th>검증</th><th>방식</th><th class="l">추천</th></tr></thead><tbody id="discBody">${discRows(d)}</tbody></table></div>
  ${d.phase === 'done' ? '' : `<div class="dock show" role="region" aria-label="선택한 API"><span class="cnt"><b>${d.sel.size}</b>개 선택</span><button class="clr" data-act="dselRec">추천만 선택</button><span class="sep"></span><button class="btn primary" data-act="discRegister" ${d.sel.size ? '' : 'disabled'}>도구 후보로 등록</button></div>`}
  <div style="height:70px"></div>`;
}

/* 근거 보기 */
function javaSnippet(a) {
  const s = a.src, m = a.m === 'GET' ? 'GET' : 'POST';
  if (s.ret === 'ModelAndView') return `@RequestMapping(value = "${a.path}", method = RequestMethod.${m})
public ModelAndView ${s.fn}(@ModelAttribute ${s.vo} searchVO) {
    List<PoVO> list = poService.selectPoList(searchVO);
    return new ModelAndView("excelView", "list", list);   // 엑셀 파일 응답
}`;
  return `${s.dep ? '@Deprecated\n' : ''}@RequestMapping(value = "${a.path}", method = RequestMethod.${m})
@ResponseBody
public Map<String, Object> ${s.fn}(@ModelAttribute ${s.vo} vo) {
    Map<String, Object> result = new HashMap<>();
    result.put("${a.mode === 'write' ? 'RSLT' : 'resultList'}", ${s.mapper.split('.')[0].replace('Mapper', '').toLowerCase()}Service.${s.fn}(vo));
    return result;   // ${s.mapper} (${s.sql})
}`;
}
function hlJava(t) {
  return esc(t).replace(/(\/\/.*$)|(&quot;.*?&quot;)|(@\w+)|\b(public|return|new|private|void)\b/gm,
    (m, c, s, an, kw) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : an ? `<span class="k">${an}</span>` : `<span class="t">${kw}</span>`);
}
function trSample(a) {
  const o = {}; a.res.forEach(r => setPath(o, r.o, r.av !== undefined && r.rule === 'mask' ? r.av : r.ov));
  const req = `${a.m} ${a.path.startsWith('http') ? a.path.replace(/^http:\/\/[^/]+/, '') : '/po' + a.path}${a.tr.q || ''} HTTP/1.1
Host: ${a.path.startsWith('http') ? '10.20.4.12' : '10.20.4.30:8080'}
Cookie: JSESSIONID=••••••••
X-Requested-With: XMLHttpRequest${a.m === 'POST' ? `\nContent-Type: application/x-www-form-urlencoded\n\n${a.params.map(p => `${p.o}=${encodeURIComponent(p.ex)}`).join('&')}` : ''}`;
  const res = a.tr.blocked ? null : `HTTP/1.1 200 OK\nContent-Type: application/json;charset=UTF-8${a.id === 'monthly' ? '\nX-Module: po-report' : ''}\n\n${JSON.stringify(o, null, 2)}`;
  return [req, res];
}
function discEvidence(id) {
  const a = DA[id], d = S.disc, e = dEvidence(a), [vl, vc] = dVerify(a), [rk, rn] = dRec(a);
  const srcOn = d.git && a.src, trOn = d.crawl && a.tr;
  openDrawer(`<div class="d-head"><div class="ttl"><div class="ag">탐색 근거</div><h3 class="mono" id="dTitle">${a.m} ${esc(a.path)}</h3><p>${esc(a.title)}${a.tool ? `, 도구 이름 제안 <span class="mono">${a.tool}</span>` : ''}</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
  <div class="d-body">
    <div class="lsum">
      <div><span class="k">근거</span><span class="v">${e === 'both' ? '소스와 트래픽 모두' : e === 'src' ? '소스에만' : '트래픽에만'}</span></div>
      <div><span class="k">검증</span><span class="v"><span class="stt ${vc}">${vl}</span></span></div>
      <div><span class="k">추천</span><span class="v">${stt(rk, REC)}</span></div>
      <div><span class="k">방식</span><span class="v">${a.mode === 'write' ? '쓰기' : '읽기'}${srcOn ? ` (${a.src.sql})` : ''}</span></div>
      <div><span class="k">관찰한 호출</span><span class="v">${trOn ? a.tr.samples + '건' : '없음'}</span></div>
      <div><span class="k">호출된 화면</span><span class="v" style="font-size:13px">${trOn ? esc(a.tr.screen) : '—'}</span></div>
    </div>
    ${rn ? `<div class="notice ${rk === 'yes' ? '' : rk === 'check' ? 'warn' : 'mute'}" style="margin-bottom:6px">${svg('info', 18)}<div class="nt">${esc(rn)}</div></div>` : ''}
    ${a.verify.note && d.stg ? `<div class="notice" style="margin-bottom:6px">${svg('server', 18)}<div class="nt">${esc(a.verify.note)}</div></div>` : ''}
    ${a.extra ? `<div class="notice" style="margin-bottom:6px">${svg('sparkle', 18)}<div class="nt">${esc(a.extra)}</div></div>` : ''}
    <div class="sec2"><h4>${svg('code', 16)}소스 근거 ${srcOn ? `<small>${a.src.file}:${a.src.line}</small>` : ''}</h4>
      ${srcOn ? `<pre class="code" tabindex="0">${hlJava(javaSnippet(a))}</pre><p class="pv-note">MyBatis 매퍼 <span class="inline-code">${a.src.mapper}</span>이 ${a.src.sql} 문이라 ${a.mode === 'write' ? '쓰기' : '읽기'} 작업으로 분류했습니다.</p>`
        : `<div class="md-empty sm">${esc(a.srcNote || (d.git ? '저장소에서 소스를 찾지 못했습니다.' : '이번 탐색에서는 Git 소스 분석을 하지 않았습니다.'))}</div>`}</div>
    <div class="sec2"><h4>${svg('globe', 16)}트래픽 근거</h4>
      ${trOn ? (() => { const [rq, rs] = trSample(a); return `<p class="cap"><i style="background:var(--mcp)"></i>캡처한 요청 <span class="muted" style="font-weight:400">관찰 ${a.tr.samples}건 중 1건</span></p>${code(rq, 'http')}
        ${rs ? `<p class="cap" style="margin-top:12px"><i style="background:var(--mcp)"></i>캡처한 응답</p>${code(rs, 'http')}<p class="pv-note">개인정보로 보이는 값은 저장 전에 가렸습니다.</p>` : '<div class="notice danger" style="margin-top:10px">' + svg('shield', 18) + '<div class="nt">쓰기 요청이라 가로채서 차단했습니다. 운영에는 보내지 않았고 요청 형식만 기록했습니다.</div></div>'}`; })()
        : `<div class="md-empty sm">${esc(a.trNote || (d.crawl ? '화면 탐색 중 호출되지 않았습니다.' : '이번 탐색에서는 화면 탐색을 하지 않았습니다.'))}</div>`}</div>
    ${a.params.length ? `<div class="sec2"><h4>파라미터 추론</h4><div class="mapw"><table class="map" style="min-width:560px"><thead><tr><th>원본 파라미터</th><th>소스 타입</th><th>관찰한 값</th><th>추론 결과</th></tr></thead><tbody>
      ${a.params.map(p => `<tr><td><div class="f">${p.o}</div></td><td class="dsc">${srcOn ? esc(p.ot) : '<span class="muted">소스 없음</span>'}</td><td><div class="codes">${(trOn ? (p.obs || [p.ex]) : []).map(v => `<span><i>${esc(v)}</i></span>`).join('') || '<span class="muted" style="font-size:12px">관찰 없음</span>'}</div></td><td><div class="f">${p.a}</div><div class="ty">${esc(p.at)}</div>${ruleChip(p.rule)}</td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
  </div>
  <div class="d-foot"><span class="info">${e === 'both' ? '근거가 두 가지라 신뢰도가 높습니다' : '근거가 한 가지라 검토가 필요합니다'}</span>
    ${a.tool && d.phase !== 'done' ? `<button class="btn" data-act="dselToggle" data-id="${a.id}">${d.sel.has(a.id) ? '선택에서 빼기' : '선택에 추가'}</button>` : ''}<button class="btn primary" data-act="dClose">닫기</button></div>`);
}

/* 등록 */
function discRegister() {
  const d = S.disc, id = 'po';
  const src = { id, name:d.name, desc:'발주, 구매요청, 거래처, 예산', proto:'disc', spec:'Git 소스와 운영 트래픽으로 추론', base:DISC_CFG.base, auth:'세션 (서비스 계정)', sync:'방금' };
  if (SRC[id]) { Object.assign(SRC[id], src); TOOLS[id].forEach(t => delete TOOL[t.id]); } else { SOURCES.push(src); SRC[id] = src; }
  TOOLS[id] = [...d.sel].map(x => DA[x]).map(a => {
    const onlyTr = dEvidence(a) === 'tr';
    return { id:a.tool, method:a.m, path:a.path, title:a.title, status:'review', mode:a.mode, calls:0, desc:a.desc, confirmQ:a.confirmQ,
      disc:a.id, guess:onlyTr ? 1 : 0, params:JSON.parse(JSON.stringify(a.params)), res:JSON.parse(JSON.stringify(a.res)).map(r => onlyTr ? { ...r, guess:1 } : r) };
  });
  indexTools();
  persist(api.post('/sources/', src).then(() => api.put(`/studio/source/${id}/`, TOOLS[id])));
  d.registered = TOOLS[id].length; d.phase = 'done'; d.stage.review = 'done';
  Object.assign(S, { src:id, tool:TOOLS[id][0].id, tf:'all', tq:'' });
  go('studio');
  toast(`도구 후보 ${d.registered}개를 등록했습니다. 검토한 뒤 공개하세요.`);
}


/* 동작 */
Object.assign(ACT, {
  goSrc: a => { const s = SRC[a.dataset.id]; if (s.err) return ACT.reauth(a); Object.assign(S, { src:s.id, tool:srcTools(s.id)[0].id, tf:'all', tq:'' }); go('studio'); },
  reauth: a => {
    const s = SRC[a.dataset.id];
    const w = S.rw = { mode:s.proto, cred:{ type:s.authType || 'none', in:'header', name:'X-API-KEY' } };
    openModal('인증 정보 다시 입력', `<p style="margin-top:0"><b>${esc(s.name)}</b> 연결에 문제가 있습니다. 인증 정보를 다시 입력하면 저장하고 연결을 복구합니다.</p><div id="rwBody">${authFormHTML(w)}</div>`,
      '저장하고 다시 연결', () => {
        api.post(`/sources/${s.id}/reauth/`, { auth:w.cred }).then(r => { Object.assign(s, r); closeModal(); render(); toast(`${s.name} 인증 정보를 저장했습니다.`); })
          .catch(e => toast(e.message, 'warn'));
      });
  },
  srcDel: a => {
    const s = SRC[a.dataset.id];
    openModal('원본 시스템 삭제', `<p style="margin:0"><b>${esc(s.name)}</b>과 이 시스템에서 만든 AI 도구 ${srcTools(s.id).length}개를 삭제합니다. 도구 묶음에서도 빠지며, 저장한 인증 정보도 지웁니다. 되돌릴 수 없습니다.</p>`, '삭제', () => {
      api('DELETE', `/sources/${s.id}/`).then(() => {
        srcTools(s.id).forEach(t => delete TOOL[t.id]); delete TOOLS[s.id]; delete SRC[s.id];
        SOURCES.splice(SOURCES.indexOf(s), 1);
        return api.get('/deploy/toolsets/').then(r => { TOOLSETS = r; });
      }).then(() => { closeModal(); render(); toast(`${s.name} 연결을 삭제했습니다.`); }).catch(e => toast(e.message, 'warn'));
    });
  },
  wzOpen: () => wzOpen(),
  wzMode: a => { S.wz.mode = a.dataset.v; renderWz(); },
  wzNext: () => {
    const w = S.wz;
    if (w.step === 2 && w.mode === 'sample' && !w.sReq.trim()) { toast('요청 샘플을 입력하세요.', 'warn'); return; }
    if (w.step === 2 && (w.mode === 'rest' || w.mode === 'soap') && !w.url.trim() && !w.specText) { toast('명세 URL을 입력하거나 파일을 올려 주세요.', 'warn'); return; }
    w.step++; renderWz(); if (w.step === 4) wzAnalyze();
  },
  wzPrev: () => { const w = S.wz; w.step--; w.error = null; renderWz(); },
  wzDisc: () => { const w = S.wz; if (!w.ok) return; const opt = { name:w.dn.trim() || DISC_CFG.name, git:w.git, crawl:w.crawl, stg:w.stg, owner:DISC_CFG.owner };
    const night = w.when === 'night'; closeDrawer(); discStart(opt); if (night) toast('목업에서는 예약 대신 바로 시작해 보여 드립니다.', 'info'); },
  wzStg: a => { S.wz.stg = a.dataset.v === '1'; $('#wzBody').innerHTML = wzBody(); },
  wzBanDel: a => { S.wz.ban = S.wz.ban.filter(b => b !== a.dataset.v); $('#wzBody').innerHTML = wzBody(); },
  discSkip: () => discSkip(),
  discReplay: () => { const d = S.disc; discStart({ name:d.name, git:d.git, crawl:d.crawl, stg:d.stg, owner:d.owner }); },
  dfilter: a => { S.disc.filter = S.disc.filter === a.dataset.v && a.dataset.v !== 'all' ? 'all' : a.dataset.v; render(); },
  discEv: a => discEvidence(a.dataset.id),
  dselToggle: a => { const d = S.disc, id = a.dataset.id; d.sel.has(id) ? d.sel.delete(id) : d.sel.add(id); closeDrawer(); render(); },
  dselRec: () => { discDefaultSel(); render(); },
  discRegister: () => { if (S.disc.sel.size) discRegister(); },
  discOpen: () => go('disc'),
  wzFinish: () => wzFinish(),
});

/* 동작 */
Object.assign(INP, {
  srcQ: el => { S.srcQ = el.value; $('#srcBody').innerHTML = srcRows(); },
  wzName: el => { S.wz.name = el.value; },
  wzDn: el => { S.wz.dn = el.value; },
  wzUrl: el => { S.wz.url = el.value; },
});

/* 동작 */
Object.assign(CHG, {
  srcProto: el => { S.srcProto = el.value; $('#srcBody').innerHTML = srcRows(); },
  wzGov: el => { S.wz.gov = el.value; },
  wzGit: el => { if (!el.checked && !S.wz.crawl) { el.checked = true; toast('Git 소스 분석과 운영 화면 탐색 중 하나는 켜야 합니다.', 'warn'); return; } S.wz.git = el.checked; $('#wzBody').innerHTML = wzBody(); },
  wzCrawl: el => { if (!el.checked && !S.wz.git) { el.checked = true; toast('Git 소스 분석과 운영 화면 탐색 중 하나는 켜야 합니다.', 'warn'); return; } S.wz.crawl = el.checked; $('#wzBody').innerHTML = wzBody(); },
  wzOk: el => { S.wz.ok = el.checked; el.closest('.own').classList.toggle('on', el.checked); const b = $('[data-act="wzDisc"]'); if (b) b.disabled = !el.checked; },
  wzWhen: el => { S.wz.when = el.value; const b = $('[data-act="wzDisc"]'); if (b) b.lastChild.textContent = el.value === 'now' ? '탐색 시작' : '탐색 예약'; },
  dsel: el => { const d = S.disc; el.checked ? d.sel.add(el.dataset.id) : d.sel.delete(el.dataset.id); el.closest('tr').classList.toggle('sel', el.checked);
    const c = $('.dock .cnt b'); if (c) c.textContent = d.sel.size; const b = $('[data-act="discRegister"]'); if (b) b.disabled = !d.sel.size; },
});

/* 연결 마법사, 인증 다시 입력 공용 입력 */
const credTarget = () => ($('#modal').classList.contains('show') && S.rw) ? S.rw : S.wz;
const credRender = () => { const w = credTarget(); if (w === S.rw && $('#rwBody')) $('#rwBody').innerHTML = authFormHTML(w); else $('#wzBody').innerHTML = wzBody(); };
Object.assign(INP, {
  wzBase: el => { S.wz.base = el.value; },
  wzSampleReq: el => { S.wz.sReq = el.value; },
  wzSampleRes: el => { S.wz.sRes = el.value; },
  wzCred: el => { credTarget().cred[el.dataset.k] = el.value; },
});
Object.assign(CHG, {
  wzAuth: el => { credTarget().cred.type = el.value; credRender(); },
  wzCredIn: el => { const c = credTarget().cred; c.in = el.value; if (!c.name || c.name === 'X-API-KEY' || c.name === 'api_key') c.name = el.value === 'header' ? 'X-API-KEY' : 'api_key'; credRender(); },
  wzFile: el => {
    const f = el.files && el.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast('명세 파일은 10MB까지 올릴 수 있습니다.', 'warn'); return; }
    const rd = new FileReader();
    rd.onload = () => { S.wz.specText = String(rd.result); S.wz.fileName = f.name; if (!S.wz.name) S.wz.name = f.name.replace(/\.[^.]+$/, ''); $('#wzBody').innerHTML = wzBody(); toast(`${f.name} 파일을 올렸습니다.`); };
    rd.readAsText(f);
  },
});

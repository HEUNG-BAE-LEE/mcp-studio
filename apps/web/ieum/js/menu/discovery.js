/* API 자동 탐색: 작업 목록, 연결 마법사(탐색 대상, 안전 설정), 실시간 탐색 화면, 결과 검토, 근거 보기, 도구 후보 등록.
   서버(/api/ieum/discovery)가 쌓는 이벤트를 폴링해서 그린다. 화면에 뜨는 숫자는 모두 서버가 센 값이다. */
let DISC = { capabilities:{}, defaults:{ ban:[], maxPages:50, frameworks:['auto'] }, jobs:[], demo:null };

const JOB_ST = { scheduled:['예약됨', 'info'], running:['탐색 중', 'info'], review:['검토 대기', 'warn'], done:['등록 완료', 'ok'], failed:['실패', 'danger'], cancelled:['취소됨', 'mute'], interrupted:['중단됨', 'danger'] };
const FW_LABEL = { auto:'자동 감지', spring:'Spring MVC, 전자정부, Spring Boot', express:'Express', fastapi:'FastAPI, Flask' };
const D_TAG = { cap:['캡처', 'info'], allow:['허용 (로그인)', 'ont'], out:['범위 밖', 'mute'], block:['차단', 'danger'], ok:['검증', 'ok'], stg:['스테이징 검증', 'ok'], err:['검증 실패', 'danger'], file:['파일 응답', 'warn'], nf:['없음', 'warn'] };
const D_STAGES = [['src', '소스 분석'], ['web', '화면 탐색'], ['merge', '교차 확인'], ['verify', '호출 검증'], ['review', '결과 검토']];
const D_LIVE = ['running', 'scheduled', 'queued'];
const REC = { yes:['등록 추천', 'ok'], check:['확인 필요', 'warn'], no:['제외 추천', 'mute'] };
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const jobHow = j => [j.opts.git && 'Git 소스', j.opts.crawl && '운영 화면'].filter(Boolean).join(' + ');
const fmtAt = ts => { const d = new Date(ts * 1000); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 시작`; };

/* ---------- 작업 목록 (원본 시스템 화면 아래) ---------- */
function discJobsHTML() {
  if (!DISC.jobs.length) return '';
  const rows = DISC.jobs.map(j => {
    const [l, c] = JOB_ST[j.status] || [j.status, 'mute'];
    const n = j.status === 'review' || j.status === 'done' ? j.apiCount : j.status === 'running' ? j.stats.found : null;
    return `<tr data-act="discOpen" data-id="${j.id}" tabindex="0"><td class="l sname"><b>${esc(j.name)}</b><span>${esc(j.opts.base || j.opts.repo || '')}</span></td>
      <td style="font-size:13px">${jobHow(j)}</td>
      <td><span class="stt ${c}">${l}</span>${j.status === 'scheduled' ? `<div style="font-size:12px;color:var(--text-3)">${fmtAt(j.startAt)}</div>` : ''}</td>
      <td>${n == null ? '—' : `<span class="num">${n}</span>개`}</td><td>${j.registered ? j.registered + '개' : '—'}</td>
      <td><button class="btn sm" data-act="discOpen" data-id="${j.id}">${j.status === 'review' ? '결과 검토' : '열기'}</button> <button class="btn sm" data-act="discDel" data-id="${j.id}" aria-label="${esc(j.name)} 탐색 기록 삭제">삭제</button></td></tr>`;
  }).join('');
  return `<h3 class="sec-t">자동 탐색 작업</h3>
  <div class="twrap" style="margin-top:0"><table class="utbl" style="min-width:820px"><thead><tr><th class="l">대상</th><th>방식</th><th>상태</th><th>찾은 API</th><th>등록</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
const refreshJobs = () => api.get('/discovery/').then(r => { DISC = r; if (S.view === 'src') render(); }).catch(() => {});

/* ---------- 연결 마법사: 탐색 대상, 안전 설정 ---------- */
const discWzInit = () => ({ name:'', base:'', start:'/login.do', account:'', password:'', git:true, repo:'', branch:'', token:'', framework:'auto',
  crawl:!!DISC.capabilities.browser, scope:'', exclude:'/logout.do', readPost:'', maxPages:DISC.defaults.maxPages || 50, stg:false, stgUrl:'', mask:true,
  when:'now', startTime:'19:00', owner:'', ok:false });

function wzDiscBody(w) {
  const d = w.d, caps = DISC.capabilities;
  const inp = (k, o = {}) => `<input class="inp ${o.mono ? 'mono' : ''}" ${o.type ? `type="${o.type}"` : ''} data-inp="wzD" data-k="${k}" value="${esc(d[k] ?? '')}" placeholder="${esc(o.ph || '')}" ${o.type === 'password' ? 'autocomplete="new-password"' : ''} ${o.aria ? `aria-label="${o.aria}"` : ''} ${o.style ? `style="${o.style}"` : ''}>`;
  const fld = (label, html) => `<div class="field"><label>${label}</label>${html}</div>`;
  if (w.step === 2) return `
    ${DISC.demo ? `<div class="notice" style="margin-bottom:12px">${svg('info', 18)}<div class="nt">이 서버에는 시연용 구매관리 시스템과 Java 소스 샘플이 들어 있어 바로 탐색해 볼 수 있습니다. <button class="link" data-act="wzDemo">시연용 값 채우기</button></div></div>` : ''}
    ${fld('시스템 이름', inp('name', { ph:'비우면 운영 주소의 호스트 이름을 씁니다' }))}
    <div class="dz">
      <div class="dz-h"><b>운영 접속 정보</b><small>화면 탐색에 쓰고, Git에서 찾은 읽기 API를 실제로 호출해 검증할 때도 씁니다</small></div>
      ${fld('운영 주소', inp('base', { mono:1, ph:'http://10.20.4.30:8080/po' }))}
      ${fld('로그인 페이지', inp('start', { mono:1, ph:'/login.do' }))}
      ${fld('테스트 계정', `<div class="two">${inp('account', { ph:'아이디', aria:'아이디' })}${inp('password', { type:'password', ph:'비밀번호', aria:'비밀번호' })}</div>`)}
    </div>
    <div class="dz ${d.git ? '' : 'off'}">
      <label class="dz-h ck2"><span class="sw"><input type="checkbox" data-chg="wzDChk" data-k="git" ${d.git ? 'checked' : ''} aria-label="Git 소스 분석"><span></span></span><b>Git 소스 분석</b><small>컨트롤러와 매퍼를 읽어 화면에 안 나오는 API까지 찾습니다</small></label>
      ${d.git ? `${fld('저장소', inp('repo', { mono:1, ph:'https://git.example.com/legacy/po-web.git' }))}
      ${fld('브랜치', inp('branch', { mono:1, ph:'비우면 기본 브랜치' }))}
      ${fld('접근 토큰', inp('token', { type:'password', ph:'비공개 저장소일 때만', aria:'읽기 전용 접근 토큰' }))}
      ${fld('프레임워크', `<select class="inp" data-chg="wzDSel" data-k="framework">${(DISC.defaults.frameworks || ['auto']).map(f => `<option value="${f}" ${d.framework === f ? 'selected' : ''}>${FW_LABEL[f] || f}</option>`).join('')}</select>`)}
      <p class="pv-note" style="margin:0 0 4px 106px">읽기 전용 토큰만 쓰고, 분석이 끝나면 내려받은 소스를 지웁니다. 이 서버에 허용된 폴더는 경로로 바로 읽을 수 있습니다.${caps.git === false ? ' <b>이 서버에는 git 이 없어 경로만 쓸 수 있습니다.</b>' : ''}</p>` : ''}
    </div>
    <div class="dz ${d.crawl ? '' : 'off'}">
      <label class="dz-h ck2"><span class="sw"><input type="checkbox" data-chg="wzDChk" data-k="crawl" ${d.crawl ? 'checked' : ''} ${caps.browser ? '' : 'disabled'} aria-label="운영 화면 탐색"><span></span></span><b>운영 화면 탐색</b><small>헤드리스 브라우저로 메뉴를 돌며 실제 요청과 응답을 캡처합니다</small></label>
      ${caps.browser ? '' : `<p class="pv-note" style="margin:0 0 8px">${svg('alert', 14)} 이 서버에서 쓸 수 있는 브라우저가 없습니다. Chrome 을 설치하거나 서버에서 <span class="inline-code">python -m playwright install chromium</span> 을 실행해 주세요.</p>`}
      ${d.crawl ? `${fld('탐색 범위', inp('scope', { mono:1, ph:'비우면 운영 주소 아래 전부 (예: /po/*)' }))}
      ${fld('제외 경로', inp('exclude', { mono:1, ph:'/logout.do, /admin/*' }))}
      ${fld('조회용 POST', inp('readPost', { mono:1, ph:'비움 (예: /po/*List.do)' }))}
      ${fld('최대 화면 수', inp('maxPages', { type:'number', style:'width:120px' }))}
      <p class="pv-note" style="margin:0 0 4px 106px">경로는 <span class="inline-code">/po/*</span> 처럼 서버 기준으로도, <span class="inline-code">/logout.do</span> 처럼 운영 주소 기준으로도 쓸 수 있습니다. 조회에 POST 를 쓰는 시스템이면 그 경로만 적어 주세요. 그 경로의 POST 만 운영에 실제로 보냅니다.</p>` : ''}
    </div>`;
  return `
    <div class="tg first"><span class="tx"><b>쓰기 요청 차단</b><small>화면 탐색 중 생기는 POST, PUT, DELETE 요청은 가로채서 형식만 기록하고 운영에 보내지 않습니다. 로그인 요청만 예외로 보냅니다.</small></span><span class="sw"><input type="checkbox" checked disabled aria-label="쓰기 요청 차단"><span></span></span></div>
    <div class="tg"><span class="tx"><b>누르지 않을 버튼</b><small>버튼 글자에 아래 단어가 들어 있으면 누르지 않고 건너뜁니다</small>
      <span class="bans">${w.ban.map(b => `<span>${esc(b)}<button data-act="wzBanDel" data-v="${esc(b)}" aria-label="${esc(b)} 빼기">${svg('close', 12, 2.4)}</button></span>`).join('')}<input class="inp" id="banIn" placeholder="단어 추가" aria-label="누르지 않을 단어 추가"></span></span></div>
    <div class="tg"><span class="tx"><b>Git에서 찾은 쓰기 API 검증</b><small>운영에서는 쓰기 API를 부르지 않습니다. 스테이징에서만 시험 값으로 호출합니다</small>
      <span class="radios"><button class="opt ${d.stg ? 'on' : ''}" data-act="wzStg" data-v="1" ${d.git ? '' : 'disabled'}><span class="radio"></span><span><b>스테이징에서 검증</b><small>${d.stg ? `<input class="inp mono" data-inp="wzD" data-k="stgUrl" value="${esc(d.stgUrl)}" placeholder="http://10.20.9.30:8080/po" style="margin-top:4px" aria-label="스테이징 주소">` : '스테이징에 시험 데이터가 생길 수 있습니다'}</small></span></button>
      <button class="opt ${d.stg ? '' : 'on'}" data-act="wzStg" data-v="0"><span class="radio"></span><span><b>검증하지 않음</b><small>미검증으로 표시하고 검토 때 직접 확인합니다</small></span></button></span></span></div>
    <div class="tg"><span class="tx"><b>캡처 데이터 개인정보 마스킹</b><small>전화번호, 사업자번호, 주민번호, 카드번호, 이메일은 저장 전에 가립니다. 비밀번호와 토큰은 항상 가립니다</small></span><span class="sw"><input type="checkbox" data-chg="wzDChk" data-k="mask" ${d.mask ? 'checked' : ''} aria-label="개인정보 마스킹"><span></span></span></div>
    <div class="tg"><span class="tx"><b>탐색 시작 시각</b><small>운영 부하를 줄이려면 사용자가 적은 시간에 예약하세요. 서버가 켜져 있어야 시작합니다</small></span>
      ${d.when === 'at' ? `<input class="inp" type="time" data-inp="wzD" data-k="startTime" value="${esc(d.startTime)}" style="width:auto;margin-right:6px" aria-label="예약 시각">` : ''}<select class="inp" style="width:auto" data-chg="wzWhen"><option value="now" ${d.when === 'now' ? 'selected' : ''}>지금 바로</option><option value="at" ${d.when === 'at' ? 'selected' : ''}>시각 예약</option></select></div>
    <div class="field" style="margin-top:14px"><label>승인해 준 담당자</label>${inp('owner', { ph:'예: 김현우 책임 (구매팀)' })}</div>
    <label class="own ${d.ok ? 'on' : ''}"><input type="checkbox" data-chg="wzOk" ${d.ok ? 'checked' : ''}><span><b>운영 시스템 담당자에게 탐색 승인을 받았습니다</b><small>탐색 기록은 담당자에게도 공유할 수 있게 남습니다</small></span></label>`;
}
function renderDiscWz() {
  const w = S.wz; if (!w) return;
  const steps = ['연결 방식', '탐색 대상', '안전 설정'];
  const html = `<div class="d-head"><div class="ttl"><div class="ag">원본 시스템</div><h3 id="dTitle">원본 시스템 연결</h3><p>명세가 없는 시스템은 Git 소스와 운영 화면을 분석해 API를 찾습니다.</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
    <div class="d-body"><div class="wz-steps">${steps.map((x, i) => `${i ? '<span class="ws-line"></span>' : ''}<span class="ws ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><em>${i + 1 < w.step ? '✓' : i + 1}</em>${x}</span>`).join('')}</div><div id="wzBody">${wzBody()}</div></div>
    <div class="d-foot"><span class="info">${w.step}/3 단계</span>${w.step > 1 ? '<button class="btn" data-act="wzPrev">이전</button>' : ''}
      ${w.step === 3 ? `<button class="btn primary" data-act="wzDisc" ${w.d.ok ? '' : 'disabled'}>${svg('play', 15)}${w.d.when === 'now' ? '탐색 시작' : '탐색 예약'}</button>` : '<button class="btn primary" data-act="wzNext">다음</button>'}</div>`;
  if ($('#drawer').classList.contains('show')) $('#drawer').innerHTML = html; else openDrawer(html);
}
function discWzCheck(w) {
  const d = w.d;
  if (w.step === 2) {
    if ((d.crawl || d.stg) && !/^https?:\/\/\S+/.test(d.base.trim())) return '운영 주소를 http:// 또는 https:// 로 시작하게 입력해 주세요.';
    if (d.crawl && !d.account.trim()) return '화면 탐색에는 테스트 계정이 필요합니다.';
    if (d.git && !d.repo.trim()) return 'Git 저장소 주소(또는 허용된 폴더 경로)를 입력해 주세요.';
  }
  if (w.step === 3) {
    if (d.stg && !/^https?:\/\/\S+/.test(d.stgUrl.trim())) return '스테이징 주소를 입력하거나 스테이징 검증을 꺼 주세요.';
    if (d.when === 'at' && !d.startTime) return '예약 시각을 입력해 주세요.';
    if (!d.owner.trim()) return '승인해 준 담당자를 입력해 주세요.';
    if (!d.ok) return '운영 시스템 담당자의 승인을 받았는지 확인해 주세요.';
  }
  return '';
}
async function wzDiscStart() {
  const w = S.wz, d = w.d, msg = discWzCheck(w);
  if (msg) { toast(msg, 'warn'); return; }
  const btn = $('[data-act="wzDisc"]'); if (btn) btn.disabled = true;
  try {
    const job = await api.post('/discovery/jobs/', { ...d, ban:w.ban, approved:d.ok, maxPages:+d.maxPages || 50 });
    closeDrawer();
    await discOpenJob(job.id);
    refreshJobs();
    if (job.status === 'scheduled') toast(`${fmtAt(job.startAt)}합니다. 서버가 켜져 있어야 합니다.`, 'info');
  } catch (e) { if (btn) btn.disabled = false; toast(e.message, 'warn'); }
}

/* ---------- 작업 열기, 폴링 ---------- */
function discBlank(id) {
  return { id, name:'', phase:'running', opts:{ git:false, crawl:false }, stage:{ src:'wait', web:'wait', merge:'wait', verify:'wait', review:'wait' }, act:'', t:0, seq:0, log:[], files:[], gitStages:[],
    pages:0, pageUrl:'', shot:0, shown:0, hl:null, hlKind:null, stats:{}, apis:[], sel:new Set(), selInit:false, filter:'all', timer:null, error:null, notes:[], registered:0, browser:'', framework:'' };
}
function discApply(d, e) {
  if (e.l === 'git') { if (e.k === 'stage') d.gitStages.push(e); if (e.k === 'file') d.files.push(e); }
  else if (e.l === 'web') {
    if (e.k === 'page') { d.pages = e.cnt; d.pageUrl = e.url; d.hl = null; }
    if (e.k === 'act' || e.k === 'skip') { d.hl = e.hl || null; d.hlKind = e.hlKind || null; }
    if (e.k === 'req') d.log.push(e);
    if (e.k === 'skip') d.log.push({ t:e.t, note:e.msg, skip:1 });
    if (e.k === 'done') { d.pages = e.cnt; d.hl = null; }
    if (e.shot) d.shot = e.shot;
  } else if (e.l === 'vfy') d.log.push(e);
}
function discSync(d, r) {
  Object.assign(d, { name:r.name, phase:r.status, opts:r.opts, stage:r.stage, act:r.act, stats:r.stats || {}, t:r.elapsed || 0, error:r.error, notes:r.notes || [], registered:r.registered,
    browser:r.browser, sourceId:r.sourceId, framework:r.framework, startAt:r.startAt });
  (r.events || []).forEach(e => discApply(d, e));
  d.seq = r.seq;
  if (r.apis) { d.apis = r.apis; if (!d.selInit) { d.selInit = true; discDefaultSel(d); } }
}
async function discOpenJob(id) {
  const d = discBlank(id);
  let r = await api.get(`/discovery/jobs/${id}/?after=0`);
  discSync(d, r);
  while (r.more) { r = await api.get(`/discovery/jobs/${id}/?after=${d.seq}`); discSync(d, r); }
  if (S.disc && S.disc.timer) clearTimeout(S.disc.timer);
  S.disc = d;
  go('disc');
  discPoll();
}
function discPoll() {
  const d = S.disc; if (!d || !D_LIVE.includes(d.phase)) return;
  clearTimeout(d.timer);
  d.timer = setTimeout(async () => {
    if (S.disc !== d) return;
    try {
      const r = await api.get(`/discovery/jobs/${d.id}/?after=${d.seq}`);
      if (S.disc !== d) return;
      const before = d.phase;
      discSync(d, r);
      if (S.view === 'disc') { if (d.phase !== before) render(); else if (d.phase === 'running') discPatch(); }     // 예약 대기 중에는 바뀐 게 없으니 다시 그리지 않는다. 그리는 중에 클릭이 씹힌다
    } catch (e) { /* 일시적인 실패는 다음 주기에 다시 */ }
    discPoll();
  }, d.phase === 'running' ? 700 : 4000);
}

/* ---------- 탐색 결과 계산 ---------- */
const dEvidence = a => a.ev === 'out' ? null : a.ev;
const dFound = () => S.disc.apis.filter(a => a.ev !== 'out');
function dVerify(a) {
  const v = a.verify || { k:'none' };
  return { ok:[`운영 ${v.code}, ${v.ms}ms`, 'ok'], file:[`운영 ${v.code}, 파일 응답`, 'warn'], 404:['운영 404', 'danger'], err:[v.code ? `운영 ${v.code}` : '검증 실패', 'danger'],
    stg:[`스테이징 ${v.code}, ${v.ms}ms`, 'ok'], stgerr:[`스테이징 ${v.code}`, 'danger'], block:['쓰기라 보내지 않음', 'mute'], out:['범위 밖이라 생략', 'mute'], none:['미검증', 'mute'] }[v.k] || ['미검증', 'mute'];
}
const dRec = a => [a.rec, a.recNote || ''];
function discDefaultSel(d) { d = d || S.disc; d.sel = new Set(d.apis.filter(a => a.ev !== 'out' && a.tool && dRec(a)[0] === 'yes').map(a => a.id)); }

/* ---------- 실시간 화면 ---------- */
function dStepper(d) {
  return `<div class="dstep">${D_STAGES.map(([k, l], i) => { const st = d.stage[k] || 'wait';
    return `${i ? '<span class="ds-line"></span>' : ''}<span class="ds ${st}"><em>${st === 'done' ? svg('check', 12, 3) : st === 'skip' ? '–' : st === 'fail' ? '!' : i + 1}</em>${l}${st === 'skip' ? ' <small>안 함</small>' : st === 'fail' ? ' <small>실패</small>' : ''}</span>`; }).join('')}</div>`;
}
function dCounters(d) {
  const s = d.stats || {}, o = d.opts;
  return `<div class="dk">
    <div><span class="k">방문한 화면</span><span class="v">${o.crawl ? (s.pages ?? 0) + `<small> / ${o.maxPages || 50}</small>` : '—'}</span></div>
    <div><span class="k">캡처한 요청</span><span class="v">${o.crawl ? (s.requests ?? 0) : '—'}</span></div>
    <div><span class="k">분석한 컨트롤러</span><span class="v">${o.git ? (s.controllers ?? 0) : '—'}</span></div>
    <div><span class="k">발견한 API 후보</span><span class="v num">${s.found ?? 0}</span></div>
    <div><span class="k">차단한 쓰기 요청</span><span class="v" style="color:${s.blocked ? 'var(--danger)' : 'inherit'}">${o.crawl ? (s.blocked ?? 0) : '—'}</span></div>
    <div><span class="k">건너뛴 동작</span><span class="v">${o.crawl ? (s.skipped ?? 0) : '—'}</span></div></div>`;
}
function dNetLog(d) {
  if (!d.log.length) return '<div class="empty-s">아직 기록된 요청이 없습니다.</div>';
  const rows = d.log.slice(-250);
  return rows.map((x, i) => {
    const last = i === rows.length - 1 ? 'enter' : '';
    if (x.skip) return `<div class="nl skip ${last}"><span class="nt2">${mmss(Math.round(x.t))}</span><span class="nn">${svg('alert', 13)}${esc(x.note)}</span></div>`;
    const tg = D_TAG[x.tag] || ['기록', 'mute'];
    return `<div class="nl ${last}"><span class="nt2">${mmss(Math.round(x.t))}</span><span class="mth ${x.m === 'GET' ? 'g' : 'p'}">${esc(x.m)}</span><span class="np" title="${esc(x.p)}">${x.env === 'stg' ? '<i>스테이징</i> ' : ''}${esc(x.p)}</span><span class="nc">${x.code ?? '—'}</span><span class="ntag ${tg[1]}">${tg[0]}</span></div>`;
  }).join('');
}
function dGit(d) {
  if (!d.opts.git) return '<div class="empty-s">이번 탐색에서는 Git 소스 분석을 하지 않았습니다.</div>';
  const stages = d.gitStages.map(s => `<div><span class="ok">${svg('check', 13, 3)}</span><b>${esc(s.msg)}</b><span>${esc(s.det || '')}</span></div>`).join('') || '<div class="muted">저장소를 읽는 중</div>';
  const files = d.files.map((f, i) => `<div class="gf ${i === d.files.length - 1 && d.phase === 'running' ? 'enter' : ''}"><span class="gn">${svg('code', 14)}<span title="${esc(f.dir || f.f)}">…/${esc(f.f)}</span></span>
    <span class="gr">${f.apis.map(a => `<span class="mth ${a.m === 'GET' ? 'g' : 'p'}">${esc(a.m || '*')}</span><span class="gp">${esc(a.path)}${a.dep ? ' <em>@Deprecated</em>' : ''}</span>`).join('')}</span>${f.note ? `<span class="gnote">${esc(f.note)}</span>` : ''}</div>`).join('');
  return `<div class="gst">${stages}</div><div class="gfiles">${files}</div>`;
}
const dShownUrl = d => (d.opts.base || '').replace(/^https?:\/\//, '') + (d.pageUrl && d.pageUrl.startsWith('http') ? '' : d.pageUrl || '');
function dBrowser(d) {
  if (!d.opts.crawl) return '<div class="empty-s">이번 탐색에서는 화면 탐색을 하지 않았습니다.</div>';
  return `<div class="bw"><div class="bw-bar">${svg('lock', 13)}<span id="bwUrl">${esc(dShownUrl(d))}</span></div>
    <div class="bw-view sh" id="bwView"><div class="sh-blank" id="bwBlank">${svg('globe', 26)}<br>${d.phase === 'running' ? '브라우저를 띄우는 중' : d.phase === 'scheduled' ? '예약한 시각에 브라우저를 띄웁니다' : '캡처한 화면이 없습니다'}</div>
      <img class="sh-img" id="bwImg" alt="헤드리스 브라우저가 보고 있는 운영 화면" hidden><i class="sh-hl" id="bwHl" hidden></i></div></div>`;
}
function discBrowserPatch(d) {
  const img = $('#bwImg'); if (!img) return;
  const url = $('#bwUrl'); if (url) url.textContent = dShownUrl(d);
  if (d.shot && d.shot !== d.shown) { d.shown = d.shot; img.hidden = false; img.src = `/api/ieum/discovery/jobs/${d.id}/shot?v=${d.shot}`; const b = $('#bwBlank'); if (b) b.hidden = true; }
  const hl = $('#bwHl');
  if (d.hl && d.shot) {
    const h = d.hl;
    Object.assign(hl.style, { left:`${h.x / h.vw * 100}%`, top:`${h.y / h.vh * 100}%`, width:`${h.w / h.vw * 100}%`, height:`${h.h / h.vh * 100}%` });
    hl.className = 'sh-hl ' + (d.hlKind || 'act'); hl.dataset.tg = d.hlKind === 'skip' ? '건너뜀' : d.hlKind === 'block' ? '차단' : '클릭'; hl.hidden = false;
  } else hl.hidden = true;
}
function discActHTML(d) {
  return `${d.phase === 'running' ? '<span class="spin"></span>' : d.phase === 'scheduled' ? svg('history', 15) : svg('check', 15, 2.6)}<span>${esc(d.phase === 'scheduled' ? `${fmtAt(d.startAt)}합니다` : d.act)}</span><span class="sp"></span><span class="muted">경과 ${mmss(Math.round(d.t))}</span>`;
}
function discLiveHTML(d) {
  d.shown = 0;                                   // <img> 가 새로 만들어지므로 다시 채워야 한다
  return `<div id="dStep">${dStepper(d)}</div><div class="dact" id="dAct">${discActHTML(d)}</div>
  <div id="dCnt">${dCounters(d)}</div>
  <div class="dgrid2">
    <section class="box"><div class="box-h"><h3>운영 화면 탐색<small>헤드리스 브라우저${d.browser ? `, ${esc(d.browser)}` : ''}</small></h3><span class="live" id="dLive" ${d.crawl !== false && d.phase === 'running' && d.stage.web === 'run' ? '' : 'hidden'}>탐색 중</span></div><div id="dBw">${dBrowser(d)}</div></section>
    <section class="box"><div class="box-h"><h3>네트워크 기록<small>이음이 캡처하고 보낸 요청</small></h3></div><div class="netlog" id="netlog">${dNetLog(d)}</div></section>
  </div>
  <section class="box" style="margin-top:20px"><div class="box-h"><h3>Git 소스 분석<small>${esc(d.opts.repo ? d.opts.repo.replace(/^https?:\/\//, '') : '')}${d.framework ? ' · ' + esc(d.framework) : ''}</small></h3></div><div class="box-b" id="gitPane">${dGit(d)}</div></section>`;
}
/* 이벤트가 올 때마다 바뀐 부분만 다시 그린다. 화면 캡처 <img> 를 통째로 갈아 끼우면 깜빡인다. */
function discPatch() {
  const d = S.disc; if (!d || !$('#dStep')) return;
  const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
  set('#dStep', dStepper(d)); set('#dAct', discActHTML(d)); set('#dCnt', dCounters(d)); set('#gitPane', dGit(d));
  const nl = $('#netlog'); if (nl) { const stick = nl.scrollTop + nl.clientHeight >= nl.scrollHeight - 24; nl.innerHTML = dNetLog(d); if (stick) nl.scrollTop = nl.scrollHeight; }
  const live = $('#dLive'); if (live) live.hidden = !(d.phase === 'running' && d.stage.web === 'run');
  discBrowserPatch(d);
}

/* ---------- 머리글, 화면 ---------- */
function discHead(d) {
  const [l, c] = JOB_ST[d.phase] || [d.phase, 'mute'];
  const how = [d.opts.git && 'Git 소스 분석', d.opts.crawl && '운영 화면 탐색'].filter(Boolean).join(', ');
  const btn = d.phase === 'running' || d.phase === 'scheduled' ? `<button class="btn" data-act="discCancel">${d.phase === 'scheduled' ? '예약 취소' : '탐색 중단'}</button>`
    : `<button class="btn" data-act="discRerun">${svg('refresh', 15)}같은 설정으로 다시 탐색</button>`;
  return `<button class="link" data-act="nav" data-v="src" style="text-decoration:none;display:inline-flex;align-items:center;gap:2px;font-size:13.5px">${svg('back', 15)}원본 시스템</button>
  <div class="page-head" style="margin-top:6px"><h2>${esc(d.name)} 자동 탐색</h2><span class="stt ${c}">${l}</span><p>${how}${d.opts.base ? `, 운영 ${esc(d.opts.base)}` : ''}</p><span class="sp" style="flex:1"></span>${btn}</div>`;
}
function vDisc() {
  const d = S.disc;
  if (!d) { S.view = 'src'; return vSrc(); }
  if (D_LIVE.includes(d.phase)) return discHead(d) + `<div id="discBody">${discLiveHTML(d)}</div>`;
  if (['failed', 'cancelled', 'interrupted'].includes(d.phase)) return discHead(d) + discEndedHTML(d);
  return discHead(d) + discResultHTML(d);
}
function discEndedHTML(d) {
  const why = { failed:'탐색하지 못했습니다.', cancelled:'탐색을 중단했습니다.', interrupted:'탐색이 중단되었습니다.' }[d.phase];
  return `${dStepper(d)}<div class="notice warn" style="margin-top:16px">${svg('alert', 18)}<div class="nt"><b>${why}</b><br>${esc(d.error || '찾은 결과가 없습니다.')}</div></div>
    ${d.log.length || d.files.length ? `<div class="dgrid2"><section class="box"><div class="box-h"><h3>네트워크 기록</h3></div><div class="netlog">${dNetLog(d)}</div></section><section class="box"><div class="box-h"><h3>Git 소스 분석</h3></div><div class="box-b">${dGit(d)}</div></section></div>` : ''}`;
}

/* 결과 검토 */
function discRows(d) {
  const f = d.filter, list = d.apis.filter(a => f === 'all' || (f === 'rec' ? a.ev !== 'out' && dRec(a)[0] === 'yes' : dEvidence(a) === f));
  const order = { yes:0, check:1, no:2 };
  list.sort((a, b) => order[dRec(a)[0]] - order[dRec(b)[0]]);
  if (!list.length) return `<tr><td class="empty" colspan="7">이 조건에 맞는 API가 없습니다.</td></tr>`;
  return list.map(a => { const e = dEvidence(a), [vl, vc] = dVerify(a), [rk, rn] = dRec(a);
    return `<tr data-act="discEv" data-id="${a.id}" tabindex="0" class="${d.sel.has(a.id) ? 'sel' : ''}">
      <td class="ck" data-act="noop"><input type="checkbox" data-chg="dsel" data-id="${a.id}" ${d.sel.has(a.id) ? 'checked' : ''} ${a.tool && d.phase !== 'done' ? '' : 'disabled'} aria-label="${esc(a.title)} 선택" title="${a.tool ? '' : 'AI 도구로 만들 수 없는 API입니다'}"></td>
      <td class="l"><div class="api"><span class="mth ${a.m === 'GET' ? 'g' : 'p'}">${esc(a.m)}</span><span class="tn">${esc(a.path)}</span></div><div class="api-s">${esc(a.title)}${a.tool ? ` <span class="mono">${esc(a.tool)}</span>` : ''}</div></td>
      <td><span class="evb ${e === 'tr' || !e ? 'off' : 's'}">소스</span><span class="evb ${e === 'src' || !e ? 'off' : 't'}">트래픽</span></td>
      <td class="l" style="font-size:13px;color:var(--text-2);white-space:normal;min-width:150px">${a.tr ? esc(a.tr.screen) : '<span class="muted">화면 호출 없음</span>'}</td>
      <td><span class="stt ${vc}">${vl}</span></td>
      <td>${modeTag(a.mode)}</td>
      <td class="l" style="white-space:normal;min-width:170px">${stt(rk, REC)}${rn ? `<div style="font-size:12px;color:var(--text-3);margin-top:3px;line-height:1.45">${esc(rn)}</div>` : ''}</td></tr>`; }).join('');
}
function discResultHTML(d) {
  const all = dFound(), n = k => all.filter(a => a.ev === k).length, rec = all.filter(a => dRec(a)[0] === 'yes').length, s = d.stats || {}, o = d.opts;
  const venn = `<svg viewBox="0 0 320 170" class="venn" role="img" aria-label="소스 ${n('src')}개, 둘 다 ${n('both')}개, 트래픽 ${n('tr')}개">
    <circle cx="118" cy="85" r="72" class="vs"/><circle cx="202" cy="85" r="72" class="vt"/>
    <g data-act="dfilter" data-v="src" class="vz ${d.filter === 'src' ? 'on' : ''}"><text x="82" y="82" class="vn">${n('src')}</text><text x="82" y="102" class="vl">소스에만</text></g>
    <g data-act="dfilter" data-v="both" class="vz ${d.filter === 'both' ? 'on' : ''}"><text x="160" y="82" class="vn">${n('both')}</text><text x="160" y="102" class="vl">모두 확인</text></g>
    <g data-act="dfilter" data-v="tr" class="vz ${d.filter === 'tr' ? 'on' : ''}"><text x="238" y="82" class="vn">${n('tr')}</text><text x="238" y="102" class="vl">트래픽에만</text></g>
    <text x="70" y="16" class="vh">Git 소스</text><text x="250" y="16" class="vh">운영 트래픽</text></svg>`;
  const safe = [
    o.crawl && `<li>${svg('shield', 16)}<span>쓰기 요청 <b>${s.blocked ?? 0}건</b>을 가로채 운영에 보내지 않았습니다</span></li>`,
    o.crawl && `<li>${svg('alert', 16)}<span>누르지 않을 버튼과 제외 경로 <b>${s.skipped ?? 0}개</b>를 건너뛰었습니다</span></li>`,
    o.crawl && `<li>${svg('lock', 16)}<span>${o.mask ? `캡처한 요청과 응답의 개인정보 <b>${s.masked ?? 0}건</b>을 저장 전에 가렸습니다` : '개인정보 마스킹을 꺼서 캡처한 값을 그대로 저장했습니다. 비밀번호와 토큰만 가렸습니다'}</span></li>`,
    `<li>${svg('server', 16)}<span>${o.stg ? `쓰기 API <b>${s.stgVerified ?? 0}개</b>는 스테이징(${esc(hostOf(o.stgUrl))})에서만 호출했고, 운영에는 읽기 요청만 다시 보냈습니다` : '운영에는 읽기 요청만 다시 보냈고, 쓰기 API 는 호출하지 않아 미검증으로 남겼습니다'}</span></li>`,
    `<li>${svg('user', 16)}<span>${esc(o.owner)} 승인을 받고 탐색했습니다</span></li>`].filter(Boolean).join('');
  const notes = (d.notes || []).length ? `<ul class="vleg" style="margin:12px 0 0;min-width:0">${d.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  return `${dStepper(d)}
  ${d.phase === 'done' ? `<div class="notice" style="margin-top:16px">${svg('check', 18)}<div class="nt"><b>도구 후보 ${d.registered}개를 등록했습니다.</b> 변환 스튜디오에서 설명과 매핑을 검토한 뒤 공개하세요.</div><button class="btn sm primary" data-act="goSrc" data-id="${d.sourceId}">변환 스튜디오 열기</button></div>` : ''}
  <div class="dsum">
    <section class="box"><div class="box-h"><h3>찾은 API ${all.length}개<small>원을 누르면 해당 API만 볼 수 있습니다</small></h3></div>
      <div class="dsum-b">${venn}<ul class="vleg">
        <li><b>모두 확인 ${n('both')}개</b>실제로 쓰이고 있고 소스로 형식까지 확인한 API</li>
        <li><b>소스에만 ${n('src')}개</b>화면에서 호출되지 않은 API. 쓰기 기능이거나 사용하지 않는 API일 수 있습니다</li>
        <li><b>트래픽에만 ${n('tr')}개</b>저장소에 소스가 없는 API. 공통 모듈이나 다른 저장소에 있을 수 있습니다</li></ul></div></section>
    <section class="box"><div class="box-h"><h3>안전하게 탐색했습니다</h3></div><ul class="safe">${safe}</ul>${notes}</section>
  </div>
  <div class="toolbar"><div class="tl-f" style="padding:0;border:0">${[['all', '전체', d.apis.length], ['rec', '등록 추천', rec], ['both', '모두 확인', n('both')], ['src', '소스에만', n('src')], ['tr', '트래픽에만', n('tr')]].map(([v, l, c]) => `<button class="${d.filter === v ? 'on' : ''}" data-act="dfilter" data-v="${v}">${l}<b>${c}</b></button>`).join('')}</div>
    <span class="sp"></span><span class="muted" style="font-size:12.5px">행을 누르면 소스 코드, 캡처한 요청, 파라미터 추론 근거를 볼 수 있습니다</span></div>
  <div class="twrap"><table class="utbl dtbl" style="min-width:1040px"><thead><tr><th class="ck"></th><th class="l">API</th><th>근거</th><th class="l">호출된 화면</th><th>검증</th><th>방식</th><th class="l">추천</th></tr></thead><tbody id="discBody">${discRows(d)}</tbody></table></div>
  ${d.phase === 'done' ? '' : `<div class="dock show" role="region" aria-label="선택한 API"><span class="cnt"><b>${d.sel.size}</b>개 선택</span><button class="clr" data-act="dselRec">추천만 선택</button><span class="sep"></span><button class="btn primary" data-act="discRegister" ${d.sel.size ? '' : 'disabled'}>도구 후보로 등록</button></div>`}
  <div style="height:70px"></div>`;
}

/* 근거 보기 */
function hlJava(t) {
  return esc(t).replace(/(\/\/.*$)|(&quot;.*?&quot;)|(@\w+)|\b(public|return|new|private|void|static|final|class|if|else)\b/gm,
    (m, c, s, an, kw) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : an ? `<span class="k">${an}</span>` : `<span class="t">${kw}</span>`);
}
const hlSrc = a => a.src.lang === 'java' ? hlJava(a.src.snippet) : esc(a.src.snippet);
function discEvidenceOpen(a, o, canSelect, isSel) {
  const e = a.ev, [vl, vc] = dVerify(a), [rk, rn] = dRec(a), src = a.src, tr = a.tr;
  const sample = src && (src.sql ? `${src.sql}` : '');
  openDrawer(`<div class="d-head"><div class="ttl"><div class="ag">탐색 근거</div><h3 class="mono" id="dTitle">${esc(a.m)} ${esc(a.path)}</h3><p>${esc(a.title)}${a.tool ? `, 도구 이름 제안 <span class="mono">${esc(a.tool)}</span>` : ''}</p></div><button class="icon-btn" data-act="dClose" aria-label="닫기">${svg('close', 20)}</button></div>
  <div class="d-body">
    <div class="lsum">
      <div><span class="k">근거</span><span class="v">${e === 'both' ? '소스와 트래픽 모두' : e === 'src' ? '소스에만' : e === 'tr' ? '트래픽에만' : '범위 밖'}</span></div>
      <div><span class="k">검증</span><span class="v"><span class="stt ${vc}">${vl}</span></span></div>
      <div><span class="k">추천</span><span class="v">${stt(rk, REC)}</span></div>
      <div><span class="k">방식</span><span class="v">${a.mode === 'write' ? '쓰기' : '읽기'}${sample ? ` (${esc(sample)})` : ''}</span></div>
      <div><span class="k">관찰한 호출</span><span class="v">${tr ? tr.samples + '건' : '없음'}</span></div>
      <div><span class="k">호출된 화면</span><span class="v" style="font-size:13px">${tr ? esc(tr.screen) : '—'}</span></div>
    </div>
    ${rn ? `<div class="notice ${rk === 'yes' ? '' : rk === 'check' ? 'warn' : 'mute'}" style="margin-bottom:6px">${svg('info', 18)}<div class="nt">${esc(rn)}</div></div>` : ''}
    ${a.verify && a.verify.note ? `<div class="notice" style="margin-bottom:6px">${svg('server', 18)}<div class="nt">${esc(a.verify.note)}</div></div>` : ''}
    <div class="sec2"><h4>${svg('code', 16)}소스 근거 ${src ? `<small>${esc(src.file)}:${src.line}</small>` : ''}</h4>
      ${src ? `<pre class="code" tabindex="0">${hlSrc(a)}</pre><p class="pv-note">${src.mapper ? `매퍼 <span class="inline-code">${esc(src.mapper)}</span> 이 ${esc(src.sql)} 문이라 ${a.mode === 'write' ? '쓰기' : '읽기'} 작업으로 분류했습니다.` : '매퍼까지 따라가지 못해 메서드 이름으로 읽기·쓰기를 추정했습니다.'}</p>`
        : `<div class="md-empty sm">${o.git ? '저장소에서 소스를 찾지 못했습니다.' : '이번 탐색에서는 Git 소스 분석을 하지 않았습니다.'}</div>`}</div>
    <div class="sec2"><h4>${svg('globe', 16)}트래픽 근거</h4>
      ${tr ? `<p class="cap"><i style="background:var(--mcp)"></i>캡처한 요청 <span class="muted" style="font-weight:400">관찰 ${tr.samples}건 중 1건</span></p>${code(tr.req, 'http')}
        ${tr.res ? `<p class="cap" style="margin-top:12px"><i style="background:var(--mcp)"></i>캡처한 응답</p>${code(tr.res, 'http')}${o.mask ? '<p class="pv-note">개인정보로 보이는 값은 저장 전에 가렸습니다.</p>' : ''}`
          : tr.blocked ? `<div class="notice danger" style="margin-top:10px">${svg('shield', 18)}<div class="nt">쓰기 요청이라 가로채서 차단했습니다. 운영에는 보내지 않았고 요청 형식만 기록했습니다.</div></div>`
          : tr.file ? `<div class="notice warn" style="margin-top:10px">${svg('alert', 18)}<div class="nt">파일을 내려받는 응답이라 본문은 저장하지 않았습니다.</div></div>` : ''}`
        : `<div class="md-empty sm">${o.crawl ? '화면 탐색 중 호출되지 않았습니다.' : '이번 탐색에서는 화면 탐색을 하지 않았습니다.'}</div>`}</div>
    ${a.params.length ? `<div class="sec2"><h4>파라미터 추론</h4><div class="mapw"><table class="map" style="min-width:560px"><thead><tr><th>원본 파라미터</th><th>소스 타입</th><th>관찰한 값</th><th>추론 결과</th></tr></thead><tbody>
      ${a.params.map(p => `<tr><td><div class="f">${esc(p.o)}</div></td><td class="dsc">${src || p.loc === 'header' ? esc(p.ot) : '<span class="muted">소스 없음</span>'}</td><td><div class="codes">${((p.obs && p.obs.length ? p.obs : p.loc === 'header' ? [p.v] : [])).map(v => `<span><i>${esc(v)}</i></span>`).join('') || '<span class="muted" style="font-size:12px">관찰 없음</span>'}</div></td><td>${p.a ? `<div class="f">${esc(p.a)}</div><div class="ty">${esc(p.at)}</div>` : '<div class="ty">AI 에게 보이지 않음</div>'}${ruleChip(p.rule)}</td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
  </div>
  <div class="d-foot"><span class="info">${e === 'both' ? '근거가 두 가지라 신뢰도가 높습니다' : '근거가 한 가지라 검토가 필요합니다'}</span>
    ${canSelect ? `<button class="btn" data-act="dselToggle" data-id="${a.id}">${isSel ? '선택에서 빼기' : '선택에 추가'}</button>` : ''}<button class="btn primary" data-act="dClose">닫기</button></div>`);
}
async function discEvidenceFor(jobId, apiId) {
  const d = S.disc;
  if (d && d.id === jobId && d.apis.length) { const a = d.apis.find(x => x.id === apiId); if (a) return discEvidenceOpen(a, d.opts, !!a.tool && d.phase !== 'done', d.sel.has(a.id)); }
  try {
    const r = await api.get(`/discovery/jobs/${jobId}/?after=999999999`);
    const a = (r.apis || []).find(x => x.id === apiId);
    if (!a) { toast('이 API의 탐색 기록을 찾을 수 없습니다.', 'warn'); return; }
    discEvidenceOpen(a, r.opts, false, false);
  } catch (e) { toast('탐색 기록이 삭제되어 근거를 볼 수 없습니다.', 'warn'); }
}

/* 등록 */
async function discRegister() {
  const d = S.disc;
  try {
    const r = await api.post(`/discovery/jobs/${d.id}/register/`, { ids:[...d.sel] });
    const s = r.source;
    srcTools(s.id).forEach(t => delete TOOL[t.id]);
    const i = SOURCES.findIndex(x => x.id === s.id); if (i >= 0) SOURCES[i] = s; else SOURCES.push(s);
    SRC[s.id] = s; TOOLS[s.id] = r.tools; indexTools();
    Object.assign(d, { phase:'done', registered:d.sel.size, sourceId:s.id }); d.stage.review = 'done';
    Object.assign(S, { src:s.id, tool:r.tools[0].id, tf:'all', tq:'' });
    refreshJobs();
    go('studio');
    toast(r.added ? `도구 후보 ${r.added}개를 등록했습니다. 검토한 뒤 공개하세요.` : '고른 API 는 모두 이미 등록되어 있습니다. 기존 도구는 그대로 두었습니다.', r.added ? '' : 'info');
    if (!r.loginKnown) setTimeout(() => toast('로그인 방법을 알아내지 못해 이 도구들은 아직 실행할 수 없습니다. 화면 탐색을 켜고 다시 탐색해 주세요.', 'warn'), 3000);
  } catch (e) { toast(e.message, 'warn'); }
}

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  discOpen: a => discOpenJob(a.dataset.id).catch(e => toast(e.message, 'warn')),
  discDel: a => {
    const j = DISC.jobs.find(x => x.id === a.dataset.id); if (!j) return;
    openModal('탐색 기록 삭제', `<p style="margin:0"><b>${esc(j.name)}</b> 탐색 기록과 저장해 둔 계정 정보를 지웁니다. 이미 등록한 원본 시스템과 도구는 그대로 남지만, 도구의 "탐색 근거 보기"는 열리지 않습니다.</p>`, '삭제', () => {
      api('DELETE', `/discovery/jobs/${j.id}/`).then(() => { if (S.disc && S.disc.id === j.id) S.disc = null; closeModal(); return refreshJobs(); }).catch(e => toast(e.message, 'warn'));
    });
  },
  discCancel: () => api.post(`/discovery/jobs/${S.disc.id}/cancel/`).then(() => toast('탐색을 멈추는 중입니다.', 'info')).catch(e => toast(e.message, 'warn')),
  discRerun: () => api.post(`/discovery/jobs/${S.disc.id}/rerun/`).then(j => { refreshJobs(); return discOpenJob(j.id); }).catch(e => toast(e.message, 'warn')),
  discEv: a => discEvidenceFor(a.dataset.job || (S.disc && S.disc.id), a.dataset.id),
  dfilter: a => { S.disc.filter = S.disc.filter === a.dataset.v && a.dataset.v !== 'all' ? 'all' : a.dataset.v; render(); },
  dselToggle: a => { const d = S.disc, id = a.dataset.id; d.sel.has(id) ? d.sel.delete(id) : d.sel.add(id); closeDrawer(); render(); },
  dselRec: () => { discDefaultSel(); render(); },
  discRegister: () => { if (S.disc.sel.size) discRegister(); },
  wzDemo: () => { const m = DISC.demo; if (!m) return; Object.assign(S.wz.d, { name:m.name, base:m.base, start:m.start, account:m.account, password:m.password, repo:m.repo, branch:m.branch, stg:true, stgUrl:m.stgUrl, owner:m.owner, ok:false }); S.wz.d.git = true; S.wz.d.crawl = !!DISC.capabilities.browser; renderDiscWz(); toast('시연용 값을 채웠습니다.', 'info'); },
  wzDisc: () => wzDiscStart(),
  wzStg: a => { S.wz.d.stg = a.dataset.v === '1'; $('#wzBody').innerHTML = wzBody(); },
  wzBanDel: a => { S.wz.ban = S.wz.ban.filter(b => b !== a.dataset.v); $('#wzBody').innerHTML = wzBody(); },
});
Object.assign(INP, { wzD: el => { S.wz.d[el.dataset.k] = el.value; } });
Object.assign(CHG, {
  wzDChk: el => {
    const d = S.wz.d, k = el.dataset.k;
    if ((k === 'git' || k === 'crawl') && !el.checked && !d[k === 'git' ? 'crawl' : 'git']) { el.checked = true; toast('Git 소스 분석과 운영 화면 탐색 중 하나는 켜야 합니다.', 'warn'); return; }
    d[k] = el.checked; if (k === 'git' && !d.git) d.stg = false; $('#wzBody').innerHTML = wzBody();
  },
  wzDSel: el => { S.wz.d[el.dataset.k] = el.value; },
  wzOk: el => { S.wz.d.ok = el.checked; el.closest('.own').classList.toggle('on', el.checked); const b = $('[data-act="wzDisc"]'); if (b) b.disabled = !el.checked; },
  wzWhen: el => { S.wz.d.when = el.value; $('#wzBody').innerHTML = wzBody(); const b = $('[data-act="wzDisc"]'); if (b) b.lastChild.textContent = el.value === 'now' ? '탐색 시작' : '탐색 예약'; },
  dsel: el => { const d = S.disc; el.checked ? d.sel.add(el.dataset.id) : d.sel.delete(el.dataset.id); el.closest('tr').classList.toggle('sel', el.checked);
    const c = $('.dock .cnt b'); if (c) c.textContent = d.sel.size; const b = $('[data-act="discRegister"]'); if (b) b.disabled = !d.sel.size; },
});

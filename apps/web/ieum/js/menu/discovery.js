/* API 자동 탐색: 작업 목록, 연결 마법사(탐색 대상, 탐색 목적, 안전 설정), 실시간 탐색 화면(질문, 탐색 계획, 직접 조작),
   결과 검토(질문별 커버리지, 용도 기입), 근거 보기, 도구 후보 등록.
   서버(/api/ieum/discovery)가 쌓는 이벤트와 사람과 함께 탐색하는 상태(hitl)를 폴링해서 그린다. 화면에 뜨는 숫자는 모두 서버가 센 값이다. */
let DISC = { capabilities:{}, defaults:{ ban:[], maxPages:50, frameworks:['auto'] }, jobs:[], demo:null };

const JOB_ST = { scheduled:['예약됨', 'info'], running:['탐색 중', 'info'], review:['검토 대기', 'warn'], done:['등록 완료', 'ok'], failed:['실패', 'danger'], cancelled:['취소됨', 'mute'], interrupted:['중단됨', 'danger'] };
const FW_LABEL = { auto:'자동 감지', spring:'Spring MVC, 전자정부, Spring Boot', express:'Express', fastapi:'FastAPI, Flask' };
const D_TAG = { cap:['캡처', 'info'], allow:['허용 (로그인)', 'ont'], out:['범위 밖', 'mute'], block:['차단', 'danger'], ok:['검증', 'ok'], stg:['스테이징 검증', 'ok'], err:['검증 실패', 'danger'], file:['파일 응답', 'warn'], nf:['없음', 'warn'] };
const D_TIP = { block:'쓰기 요청이라 운영에 보내지 않고 요청 형식만 기록했습니다', allow:'로그인 요청이라 보냈습니다', out:'이 시스템 밖으로 가는 요청입니다', cap:'운영에서 받은 응답을 캡처했습니다' };
const D_KIND = { skip:['건너뜀', 'mute', 'alert'], ask:['질문', 'warn', 'msg'], human:['사람', 'ont', 'user'], auto:['자동', 'mute', 'history'] };
const D_REL = { high:['관련 높음', 'ok'], mid:['관련 중간', 'info'], low:['관련 낮음', 'warn'], excl:['제외 경로', 'mute'] };
const D_PST = { wait:['예정', 'mute'], run:['탐색 중', 'info'], done:['완료', 'ok'], skip:['건너뜀', 'mute'], ask:['질문 중', 'warn'] };
const D_HITL = { ambig:['애매할 때만 묻기', '위험해 보이는 버튼, 입력값이 필요한 화면, 관련도가 애매한 메뉴, 권한 오류, 조회로 보이는 POST 에서만 묻습니다'],
  every:['새 화면마다 묻기', '처음 여는 화면마다 계속할지 묻습니다. 시스템을 처음 탐색할 때 권장합니다'],
  never:['묻지 않고 건너뛰기', '애매하면 항상 안전한 쪽으로 처리합니다. 야간 예약 탐색에 권장합니다'] };
const D_BY = { ai:'AI(GPT)가 정함', rule:'메뉴 이름과 질문의 낱말이 겹치는 정도로 정함', none:'목적이 없어 화면 순서대로' };
const D_WAITS = [[120, '2분 뒤 자동 처리'], [300, '5분 뒤 자동 처리'], [600, '10분 뒤 자동 처리']];
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
      <td><span class="stt ${c}">${l}</span>${j.status === 'scheduled' ? `<div style="font-size:12px;color:var(--text-3)">${fmtAt(j.startAt)}</div>` : ''}${j.status === 'running' && j.hitl && j.hitl.counts && j.hitl.counts.pending ? `<div style="font-size:12px;color:var(--warn);font-weight:500">질문 ${j.hitl.counts.pending}개 대기</div>` : ''}</td>
      <td>${n == null ? '—' : `<span class="num">${n}</span>개`}</td><td>${j.registered ? j.registered + '개' : '—'}</td>
      <td><button class="btn sm" data-act="discOpen" data-id="${j.id}">${j.status === 'review' ? '결과 검토' : '열기'}</button> <button class="btn sm" data-act="discDel" data-id="${j.id}" aria-label="${esc(j.name)} 탐색 기록 삭제">삭제</button></td></tr>`;
  }).join('');
  return `<h3 class="sec-t">자동 탐색 작업</h3>
  <div class="twrap" style="margin-top:0"><table class="utbl" style="min-width:820px"><thead><tr><th class="l">대상</th><th>방식</th><th>상태</th><th>찾은 API</th><th>등록</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
const refreshJobs = () => api.get('/discovery/').then(r => { DISC = r; if (S.view === 'src') render(); }).catch(() => {});

/* ---------- 연결 마법사: 탐색 대상, 안전 설정 ---------- */
const discWzInit = () => ({ name:'', base:'', start:'/login.do', account:'', password:'', git:true, repo:'', branch:'', token:'', framework:'auto',
  crawl:!!DISC.capabilities.browser, scope:'', exclude:'/logout.do', readPost:'', maxPages:DISC.defaults.maxPages || 50, stg:false, stgUrl:'', mask:true, readAuto:false,
  when:'now', startTime:'19:00', owner:'', ok:false, purpose:'', ques:['', '', ''], hitl:DISC.defaults.hitl || 'ambig', wait:DISC.defaults.wait || 120 });

function wzDiscBody(w) {
  const d = w.d, caps = DISC.capabilities;
  const inp = (k, o = {}) => `<input class="inp ${o.mono ? 'mono' : ''}" ${o.type ? `type="${o.type}"` : ''} data-inp="wzD" data-k="${k}" value="${esc(d[k] ?? '')}" placeholder="${esc(o.ph || '')}" ${o.type === 'password' ? 'autocomplete="new-password"' : ''} ${o.aria ? `aria-label="${o.aria}"` : ''} ${o.style ? `style="${o.style}"` : ''}>`;
  const fld = (label, html) => `<div class="field"><label>${label}</label>${html}</div>`;
  if (w.step === 2) return `
    ${DISC.demo ? `<div class="notice" style="margin-bottom:12px">${svg('info', 18)}<div class="nt">이 서버에는 시연용 구매관리 시스템과 Java 소스 샘플이 들어 있어 바로 탐색해 볼 수 있습니다. <button class="link" data-act="wzDemo">시연용 값 채우기</button></div></div>` : ''}
    ${fld('시스템 이름', inp('name', { ph:'비우면 운영 주소의 호스트 이름을 씁니다' }))}
    <div class="dz pur">
      <div class="dz-h"><b>${svg('target', 16)}탐색 목적</b><small>목적과 질문 예시를 보고 탐색할 메뉴의 순서를 정하고, 찾은 API의 용도와 AI 도구 설명 초안을 씁니다</small></div>
      ${fld('목적', inp('purpose', { ph:'예: 구매팀 업무를 AI 비서로 조회' }))}
      <div class="field" style="align-items:start"><label style="padding-top:8px">질문 예시</label><div class="qedit">
        ${d.ques.map((q, i) => q == null ? '' : `<div class="qe"><span class="qchip"><em>Q${i + 1}</em></span><input class="inp" data-inp="wzQ" data-i="${i}" value="${esc(q)}" maxlength="120" placeholder="AI에게 물어볼 질문" aria-label="질문 예시 ${i + 1}"><button class="icon-btn sm" data-act="wzQDel" data-i="${i}" aria-label="질문 ${i + 1} 삭제">${svg('close', 14)}</button></div>`).join('')}
        ${d.ques.filter(q => q != null).length < (DISC.defaults.maxQuestions || 10) ? `<button class="link" data-act="wzQAdd">${svg('plus', 13)}질문 추가</button>` : ''}</div></div>
    </div>
    <div class="dz">
      <div class="dz-h"><b>운영 접속 정보</b><small>화면 탐색에 쓰고, Git에서 찾은 읽기 API를 실제로 호출해 검증할 때도 씁니다</small></div>
      ${fld('운영 주소', inp('base', { mono:1, ph:'http://10.20.4.30:8080/po' }))}
      ${fld('시작 페이지', inp('start', { mono:1, ph:'/login.do (로그인 화면이 없으면 /)' }))}
      ${fld('테스트 계정', `<div class="two">${inp('account', { ph:'아이디', aria:'아이디' })}${inp('password', { type:'password', ph:'비밀번호', aria:'비밀번호' })}</div>`)}
      <p class="pv-note" style="margin:0 0 4px 106px">로그인 화면이 없는 공개 사이트(예: 나라장터)라면 계정을 비워 두세요. 로그인하지 않고 열어서 탐색하고, 도구도 방문만으로 받은 세션으로 실행합니다.</p>
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
      ${fld('조회형 POST', `<label class="ck2b"><input type="checkbox" data-chg="wzDChk" data-k="readAuto" ${d.readAuto ? 'checked' : ''}><span>이름이 조회처럼 보이는 POST 는 묻지 않고 보내기</span></label>`)}
      ${fld('최대 화면 수', inp('maxPages', { type:'number', style:'width:120px' }))}
      <p class="pv-note" style="margin:0 0 4px 106px">경로는 <span class="inline-code">/po/*</span> 처럼 서버 기준으로도, <span class="inline-code">/logout.do</span> 처럼 운영 주소 기준으로도 쓸 수 있습니다. 조회에 POST 를 쓰는 시스템이면 그 경로만 적어 주세요. 그 경로의 POST 만 운영에 실제로 보냅니다.
        경로를 모르면 비워 두세요. 탐색 중 이름이 <span class="inline-code">select…</span>, <span class="inline-code">get…</span>, <span class="inline-code">…List</span> 처럼 조회로 보이는 POST 가 막히면 보내도 되는지 물어봅니다. 위의 '조회형 POST' 를 켜면 묻지 않고 보냅니다. 이름에 저장·삭제·수정·승인 같은 낱말이 든 요청은 어느 쪽이든 막습니다.</p>` : ''}
    </div>`;
  return `
    <div class="tg first"><span class="tx"><b>쓰기 요청 차단</b><small>화면 탐색 중 생기는 POST, PUT, DELETE 요청은 가로채서 형식만 기록하고 운영에 보내지 않습니다. 로그인 요청만 예외로 보냅니다.</small></span><span class="sw"><input type="checkbox" checked disabled aria-label="쓰기 요청 차단"><span></span></span></div>
    <div class="tg"><span class="tx"><b>누르지 않을 버튼</b><small>버튼 글자에 아래 단어가 들어 있으면 누르지 않고 건너뜁니다</small>
      <span class="bans">${w.ban.map(b => `<span>${esc(b)}<button data-act="wzBanDel" data-v="${esc(b)}" aria-label="${esc(b)} 빼기">${svg('close', 12, 2.4)}</button></span>`).join('')}<input class="inp" id="banIn" placeholder="단어 추가" aria-label="누르지 않을 단어 추가"></span></span></div>
    <div class="tg"><span class="tx"><b>Git에서 찾은 쓰기 API 검증</b><small>운영에서는 쓰기 API를 부르지 않습니다. 스테이징에서만 시험 값으로 호출합니다</small>
      <span class="radios"><button class="opt ${d.stg ? 'on' : ''}" data-act="wzStg" data-v="1" ${d.git ? '' : 'disabled'}><span class="radio"></span><span><b>스테이징에서 검증</b><small>${d.stg ? `<input class="inp mono" data-inp="wzD" data-k="stgUrl" value="${esc(d.stgUrl)}" placeholder="http://10.20.9.30:8080/po" style="margin-top:4px" aria-label="스테이징 주소">` : '스테이징에 시험 데이터가 생길 수 있습니다'}</small></span></button>
      <button class="opt ${d.stg ? '' : 'on'}" data-act="wzStg" data-v="0"><span class="radio"></span><span><b>검증하지 않음</b><small>미검증으로 표시하고 검토 때 직접 확인합니다</small></span></button></span></span></div>
    <div class="tg ${d.crawl ? '' : 'off'}"><span class="tx"><b>사람에게 물어볼 때</b><small>${d.crawl ? '크롤러가 판단하기 어려운 상황을 만나면 탐색 화면 위에 질문을 띄웁니다. 질문을 기다리는 동안에도 다른 메뉴는 계속 탐색합니다' : '운영 화면 탐색을 하지 않으면 사람에게 물어볼 일이 없습니다'}</small>
      <span class="radios">${Object.entries(D_HITL).map(([k, [l, dsc]]) => `<button class="opt ${w.d.hitl === k ? 'on' : ''}" data-act="wzHitl" data-v="${k}" ${d.crawl ? '' : 'disabled'}><span class="radio"></span><span><b>${l}${k === 'ambig' ? ' <span class="rec">권장</span>' : ''}</b><small>${dsc}</small></span></button>`).join('')}</span></span></div>
    <div class="tg"><span class="tx"><b>답이 없을 때</b><small>정해진 시간이 지나면 안전한 쪽으로 처리합니다. 질문은 머리글의 알림에도 표시됩니다</small></span>
      <select class="inp" style="width:auto" data-chg="wzDSel" data-k="wait" ${d.crawl && d.hitl !== 'never' ? '' : 'disabled'} aria-label="답이 없을 때 처리까지 시간">${D_WAITS.map(([v, l]) => `<option value="${v}" ${+d.wait === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
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
    if (!d.purpose.trim()) return '탐색 목적을 입력해 주세요. 목적에 맞춰 메뉴 순서를 정하고 API 용도를 연결합니다.';
    if (!d.ques.some(q => q && q.trim())) return '질문 예시를 하나 이상 입력해 주세요. AI 비서가 받을 질문을 알아야 필요한 API 를 찾았는지 확인할 수 있습니다.';
    if ((d.crawl || d.stg) && !/^https?:\/\/\S+/.test(d.base.trim())) return '운영 주소를 http:// 또는 https:// 로 시작하게 입력해 주세요.';
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
    const job = await api.post('/discovery/jobs/', { ...d, ban:w.ban, approved:d.ok, maxPages:+d.maxPages || 50, purpose:d.purpose.trim(), ques:d.ques.filter(q => q && q.trim()).map(q => q.trim()), wait:+d.wait || 120 });
    closeDrawer();
    await discOpenJob(job.id);
    refreshJobs();
    if (job.status === 'scheduled') toast(`${fmtAt(job.startAt)}합니다. 서버가 켜져 있어야 합니다.`, 'info');
  } catch (e) { if (btn) btn.disabled = false; toast(e.message, 'warn'); }
}

/* ---------- 작업 열기, 폴링 ---------- */
function discBlank(id) {
  return { id, name:'', phase:'running', opts:{ git:false, crawl:false, ques:[] }, stage:{ src:'wait', web:'wait', merge:'wait', verify:'wait', review:'wait' }, act:'', t:0, seq:0, log:[], files:[], gitStages:[],
    pages:0, pageUrl:'', shot:0, shownSrc:'', hl:null, hlKind:null, stats:{}, apis:[], sel:new Set(), selInit:false, filter:'all', timer:null, error:null, notes:[], registered:0, browser:'', framework:'',
    hitl:null, tab:'log', actWhy:null };
}
function discApply(d, e) {
  if (e.l === 'git') { if (e.k === 'stage') d.gitStages.push(e); if (e.k === 'file') d.files.push(e); }
  else if (e.l === 'web') {
    if (e.k === 'page') { d.pages = e.cnt; d.pageUrl = e.url; d.hl = null; }
    if (e.k === 'act' || e.k === 'skip') { d.hl = e.hl || null; d.hlKind = e.hlKind || null; }
    if (e.k === 'page' || e.k === 'act' || e.k === 'skip') d.actWhy = e.why != null ? e.why : null;      // 지금 하는 일이 답하려는 질문 예시
    if (e.k === 'req') d.log.push(e);
    if (e.k === 'skip') d.log.push({ t:e.t, kind:'skip', text:e.msg });
    if (e.k === 'plan') d.log.push({ t:e.t, kind:'auto', text:e.msg + (e.det ? `. ${e.det}` : ''), tagx:['계획', 'info'] });
    if (e.k === 'ask' || e.k === 'human' || e.k === 'auto') d.log.push({ t:e.t, kind:e.k, text:e.msg });
    if (e.k === 'done') { d.pages = e.cnt; d.hl = null; d.actWhy = null; }
    if (e.shot) d.shot = e.shot;
  } else if (e.l === 'vfy') d.log.push(e);
}
function discSync(d, r) {
  Object.assign(d, { name:r.name, phase:r.status, opts:r.opts, stage:r.stage, act:r.act, stats:r.stats || {}, t:r.elapsed || 0, error:r.error, notes:r.notes || [], registered:r.registered,
    browser:r.browser, sourceId:r.sourceId, framework:r.framework, startAt:r.startAt, hitl:r.hitl || d.hitl, reads:r.reads || null });
  d.opts.ques = d.opts.ques || [];
  if (r.shotSeq) d.shot = Math.max(d.shot, r.shotSeq);          // 직접 조작 중에는 이벤트 없이 화면만 바뀐다. 가장 최근 캡처 번호는 응답이 알려 준다
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
const discKick = () => discPoll(true);          // 사람이 뭔가 한 직후: 다음 주기를 기다리지 않고 바로 상태를 받아 온다
function discPoll(now) {
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
  }, now ? 0 : d.phase === 'running' ? (d.hitl && d.hitl.take ? 350 : 700) : 4000);        // 직접 조작 중에는 화면이 더 자주 바뀌어야 한다
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
const dQ = d => { const h = d.hitl; return h && h.active ? (h.asks.find(x => x.id === h.active && x.st === 'wait') || null) : null; };      // 지금 카드로 보이는 질문
const dPendingN = d => (d.hitl ? d.hitl.asks.filter(x => x.st === 'wait').length : 0);
const dQchips = (ques, qa) => (qa || []).filter(i => (ques || [])[i]).map(i => `<span class="qchip" title="${esc(ques[i])}">Q${i + 1}</span>`).join('');
const dHitlOf = d => D_HITL[(d.opts && d.opts.hitl) || 'never'] || D_HITL.never;
const dLive = d => d.opts.crawl && d.phase === 'running' && d.stage.web === 'run';
/* 바뀐 것만 다시 그린다. 화면 캡처와 입력칸이 있는 곳을 통째로 갈아 끼우면 깜빡이고 쓰던 글자가 사라진다. */
function dPut(sel, html) { const el = $(sel); if (!el || el._h === html) return false; el.innerHTML = html; el._h = html; return true; }

function dStepper(d) {
  return `<div class="dstep">${D_STAGES.map(([k, l], i) => { const st = d.stage[k] || 'wait';
    return `${i ? '<span class="ds-line"></span>' : ''}<span class="ds ${st}"><em>${st === 'done' ? svg('check', 12, 3) : st === 'skip' ? '–' : st === 'fail' ? '!' : i + 1}</em>${l}${st === 'skip' ? ' <small>안 함</small>' : st === 'fail' ? ' <small>실패</small>' : ''}</span>`; }).join('')}</div>`;
}
function dCounters(d) {
  const s = d.stats || {}, o = d.opts, c = (d.hitl && d.hitl.counts) || {};
  return `<div class="dk">
    <div><span class="k">방문한 화면</span><span class="v">${o.crawl ? (s.pages ?? 0) + `<small> / ${o.maxPages || 50}</small>` : '—'}</span></div>
    <div><span class="k">캡처한 요청</span><span class="v">${o.crawl ? (s.requests ?? 0) : '—'}</span></div>
    <div><span class="k">분석한 컨트롤러</span><span class="v">${o.git ? (s.controllers ?? 0) : '—'}</span></div>
    <div><span class="k">발견한 API 후보</span><span class="v num">${s.found ?? 0}</span></div>
    <div><span class="k">차단한 쓰기 요청</span><span class="v" style="color:${s.blocked ? 'var(--danger)' : 'inherit'}">${o.crawl ? (s.blocked ?? 0) : '—'}</span></div>
    <div><span class="k">사람 결정</span><span class="v">${o.crawl ? (c.human ?? 0) : '—'}${c.pending ? `<small class="pn"> 대기 ${c.pending}</small>` : ''}</span></div></div>`;
}
function dActParts(d) {
  const h = d.hitl || {}, live = d.phase === 'running', idle = live && (h.take || h.paused);
  const ic = idle && h.take ? svg('hand', 16) : idle ? svg('pause', 16) : live ? '<span class="spin"></span>' : d.phase === 'scheduled' ? svg('history', 15) : svg('check', 15, 2.6);
  const txt = d.phase === 'scheduled' ? `${fmtAt(d.startAt)}합니다` : idle && h.take ? '직접 조작 중입니다. 크롤러는 멈춰 있습니다' : idle ? '일시정지했습니다. 다시 시작을 누르면 이어서 탐색합니다' : d.act;
  const ques = d.opts.ques || [];
  const why = live && !idle && d.actWhy != null && ques[d.actWhy] ? `<span class="why">${svg('target', 13)}'${esc(ques[d.actWhy])}'에 답하려고</span>` : '';
  const bg = live && !idle && dQ(d) ? '<span class="bgtab">다른 탭</span>' : '';
  return { cls:`dact ${idle && h.take ? 'take' : idle ? 'pz' : ''}`, html:`${ic}<span class="dtx">${bg}${why}<span>${esc(txt)}</span></span><span class="muted">경과 ${mmss(Math.round(d.t))}</span>` };
}
function dCtlHTML(d) {
  const h = d.hitl; if (!h || !dLive(d)) return '';
  if (h.take) return `<button class="btn sm primary" data-act="takeEnd">${svg('check', 14, 2.4)}조작 끝내기</button>`;
  return `<button class="btn sm" data-act="dPause">${svg(h.paused ? 'play' : 'pause', 14)}${h.paused ? '다시 시작' : '일시정지'}</button><button class="btn sm" data-act="dTake">${svg('hand', 14)}직접 조작</button>`;
}
const dTakeHint = h => (h.take && h.take.fresh
  ? '테스트 계정의 세션을 잠시 비우고 로그인 화면에서 시작했습니다. 내 계정으로 로그인한 뒤 보여 주고 싶은 화면을 눌러 주세요. 요청은 운영에 보내지 않습니다(로그인만 보냅니다)'
  : '화면을 눌러 크롤러가 놓친 경로를 보여 주세요. 요청은 운영에 보내지 않고 형식만 기록합니다') + `. 끝나면 위의 '조작 끝내기'를 누르세요${h.take && h.take.n ? ` (지금까지 ${h.take.n}번 조작)` : ''}`;

const dShownUrl = d => (d.opts.base || '').replace(/^https?:\/\//, '') + (d.pageUrl && d.pageUrl.startsWith('http') ? '' : d.pageUrl || '');
function dBrowser(d) {
  if (!d.opts.crawl) return '<div class="empty-s">이번 탐색에서는 화면 탐색을 하지 않았습니다.</div>';
  return `<div class="bw" id="bw"><div class="take-bar" id="takeBar" hidden></div><div class="take-read" id="takeRead" hidden></div>
    <div class="bw-bar">${svg('lock', 13)}<span id="bwUrl">${esc(dShownUrl(d))}</span><em class="frz" id="bwFrz" hidden>이 화면에서 멈춤</em></div>
    <div class="bw-view sh" id="bwView"><div class="sh-blank" id="bwBlank">${svg('globe', 26)}<br>${d.phase === 'running' ? '브라우저를 띄우는 중' : d.phase === 'scheduled' ? '예약한 시각에 브라우저를 띄웁니다' : '캡처한 화면이 없습니다'}</div>
      <img class="sh-img" id="bwImg" alt="헤드리스 브라우저가 보고 있는 운영 화면" hidden draggable="false"><i class="sh-hl" id="bwHl" hidden></i><div id="qLayer"></div></div>
    <div class="take-in" id="takeIn" hidden>
      <input class="inp" id="takeText" placeholder="입력할 글자 (화면의 칸을 먼저 누르세요)" autocomplete="off" maxlength="200" aria-label="화면에 입력할 글자">
      <label class="ck"><input type="checkbox" id="takePw" data-chg="takePw">비밀번호</label>
      <button class="btn sm primary" data-act="takeType">입력</button>
      <span class="kk">${[['Enter', 'Enter'], ['Tab', 'Tab'], ['Backspace', '지우기'], ['Escape', 'Esc']].map(([k, l]) => `<button class="chip" data-act="takeKey" data-v="${k}">${l}</button>`).join('')}</span>
      <p class="take-note">쓴 글자는 크롤러가 화면에 옮기기만 하고 어디에도 저장하지 않습니다. 쓰기 요청은 운영에 보내지 않습니다(로그인 요청만 보냅니다).</p></div></div>`;
}
/* 질문 카드. 카드 안의 입력칸은 폴링 때마다 갈아 끼우지 않는다(남은 시간은 따로 갱신한다). */
function qCardHTML(d, q) {
  const more = dPendingN(d) - 1;
  return `<div class="dim"></div><div class="qcard" role="dialog" aria-label="크롤러 질문">
    <div class="qc-h"><span class="qk">${svg('msg', 13)}${esc(q.kindLabel)}</span>${more > 0 ? `<span class="qmore">대기 중인 질문 ${more}개 더</span>` : ''}</div>
    <b class="qt">${esc(q.title)}</b><p>${esc(q.body)}</p>
    ${q.pred ? `<div class="qpred">${esc(q.predLabel || '예상 요청')} <code>${esc(q.pred)}</code></div>` : ''}
    ${q.input ? `<div class="qin"><input class="inp" id="qVal" maxlength="60" placeholder="${esc(q.input.ph)}" aria-label="${esc(q.input.ph)}" autocomplete="off"><span class="sugg">${(q.input.sugg || []).map(x => `<button class="chip" data-act="qSugg" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</span></div>` : ''}
    <div class="qacts">${q.input ? '<button class="btn sm primary" data-act="qAns" data-v="__in">이 값으로 진행</button>' : ''}${q.opts.map(([v, l, c]) => `<button class="btn sm ${c === 'pri' ? 'primary' : ''}" data-act="qAns" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>
    <div class="qfoot">${svg('history', 13)}<span id="qLeft"></span></div>
    <div class="qbg" id="qBg"></div></div>`;
}
function dPutQ(html, qid) {
  const el = $('#qLayer'); if (!el || el._h === html) return;
  const v = $('#qVal'), keep = v && el.dataset.q === qid ? { val:v.value, focus:document.activeElement === v } : null;
  el.innerHTML = html; el._h = html; el.dataset.q = qid || '';
  if (keep) { const n = $('#qVal'); if (n) { n.value = keep.val; if (keep.focus) n.focus(); } }
}
function discBrowserPatch(d) {
  const img = $('#bwImg'); if (!img) return;
  const h = d.hitl || {}, take = !!h.take, q = take ? null : dQ(d), bw = $('#bw');
  bw.classList.toggle('asking', !!q); bw.classList.toggle('take', take);
  $('#bwFrz').hidden = !q; $('#takeBar').hidden = !take; $('#takeIn').hidden = !take;
  dPut('#takeBar', take ? `${svg('hand', 15)}<b>직접 조작 중</b><span>${esc(dTakeHint(h))}</span>` : '');
  const rq = take ? (h.asks || []).find(x => x.kind === 'readpost' && x.st === 'wait') : null;           // 직접 조작 중 화면이 비어 보이는 까닭: 조회로 보이는 POST 를 막았다
  const tr = $('#takeRead'); if (tr) { tr.hidden = !rq; dPut('#takeRead', rq ? `${svg('alert', 15)}<span><b>조회 요청을 막고 있어 화면이 비어 보여요.</b> 막은 요청 <code>${esc(rq.pred)}</code> 처럼 이름이 조회로 보이는 요청만 허락하면 실제로 보내요. 허락한 뒤에는 화면의 조회 버튼을 다시 눌러 주세요.</span><button class="btn sm primary" data-act="readAns" data-qid="${rq.id}" data-v="allow">조회로 허락</button><button class="btn sm" data-act="readAns" data-qid="${rq.id}" data-v="keep">계속 막기</button>` : ''); }
  const url = $('#bwUrl'); if (url) url.textContent = dShownUrl(d);
  const src = q && q.shot ? `/api/ieum/discovery/jobs/${d.id}/qshot/${q.id}` : d.shot ? `/api/ieum/discovery/jobs/${d.id}/shot?v=${d.shot}` : '';
  if (src && src !== d.shownSrc) { d.shownSrc = src; img.hidden = false; img.src = src; const b = $('#bwBlank'); if (b) b.hidden = true; }
  const hl = $('#bwHl'); let box = null, kind = 'act';
  if (q) { box = q.hl; kind = 'ask'; } else if (!take && d.hl && d.shot) { box = d.hl; kind = d.hlKind || 'act'; }
  if (box) {
    Object.assign(hl.style, { left:`${box.x / box.vw * 100}%`, top:`${box.y / box.vh * 100}%`, width:`${box.w / box.vw * 100}%`, height:`${box.h / box.vh * 100}%` });
    hl.className = 'sh-hl ' + kind; hl.dataset.tg = { skip:'건너뜀', block:'차단', ask:'질문' }[kind] || '클릭'; hl.hidden = false;
  } else hl.hidden = true;
  dPutQ(q ? qCardHTML(d, q) : '', q ? q.id : '');
  if (q) {
    const left = $('#qLeft');
    if (left) left.innerHTML = h.held ? `<b>멈춤</b> 카드에서 마우스를 떼면 다시 흐릅니다. 시간이 지나면 ${esc(q.defLabel)}.` : `<b>${mmss(Math.ceil(q.left || 0))}</b> 뒤 자동으로 ${esc(q.defLabel)}. 카드 위에 마우스를 올리면 시간이 멈춰요.`;
    dPut('#qBg', `${svg('layers', 13)}${q.kind === 'readpost' ? '답을 기다리는 동안 탐색을 멈춰 둡니다(막힌 채로 더 보면 빈 화면만 모이기 때문입니다)' : d.act && d.phase === 'running' ? `그동안 다른 탭에서 계속 탐색 중: ${esc(d.act)}` : '그동안 다른 메뉴는 계속 탐색합니다'}`);
  }
}

function dGit(d) {
  if (!d.opts.git) return '<div class="empty-s">이번 탐색에서는 Git 소스 분석을 하지 않았습니다.</div>';
  const stages = d.gitStages.map(s => `<div><span class="ok">${svg('check', 13, 3)}</span><b>${esc(s.msg)}</b><span>${esc(s.det || '')}</span></div>`).join('') || '<div class="muted">저장소를 읽는 중</div>';
  const files = d.files.map((f, i) => `<div class="gf ${i === d.files.length - 1 && d.phase === 'running' ? 'enter' : ''}"><span class="gn">${svg('code', 14)}<span title="${esc(f.dir || f.f)}">…/${esc(f.f)}</span></span>
    <span class="gr">${f.apis.map(a => `<span class="mth ${a.m === 'GET' ? 'g' : 'p'}">${esc(a.m || '*')}</span><span class="gp">${esc(a.path)}${a.dep ? ' <em>@Deprecated</em>' : ''}</span>`).join('')}</span>${f.note ? `<span class="gnote">${esc(f.note)}</span>` : ''}</div>`).join('');
  return `<div class="gst">${stages}</div><div class="gfiles">${files}</div>`;
}

/* 오른쪽 패널: 네트워크 기록 / 탐색 계획 / 질문 */
function dLogRow(d, x, last) {
  const en = last && d.phase === 'running' ? 'enter' : '';
  if (x.kind) {
    const [l, c, ic] = x.tagx ? [x.tagx[0], x.tagx[1], 'info'] : D_KIND[x.kind];
    return `<div class="nl note ${x.kind} ${en}"><span class="nt2">${mmss(Math.round(x.t))}</span><span class="nn">${svg(ic, 13)}${esc(x.text)}</span><span class="ntag ${c}">${l}</span></div>`;
  }
  const tg = x.tag === 'block' && x.rd ? ['차단 (조회형)', 'warn'] : D_TAG[x.tag] || ['기록', 'mute'];
  const tip = x.tag === 'block' && x.rd ? '이름은 조회처럼 보이지만 POST 라 막았습니다. 허락하면 보낼 수 있습니다' : D_TIP[x.tag] || '';
  const pu = d.hitl && x.api ? d.hitl.purp[x.api] : null;
  const u = x.l === 'web' && x.api && !['out', 'allow'].includes(x.tag) && (pu || x.use) ? (pu || { use:x.use, qa:x.qa || [] }) : null;
  return `<div class="nl ${en}"><span class="nt2">${mmss(Math.round(x.t))}</span><span class="mth ${x.m === 'GET' ? 'g' : 'p'}">${esc(x.m)}</span><span class="np" title="${esc(x.p)}">${x.env === 'stg' ? '<i>스테이징</i> ' : ''}${x.human ? '<i class="h">사람 조작</i> ' : ''}${esc(x.p)}</span><span class="nc">${x.code ?? '—'}</span><span class="ntag ${tg[1]}" ${tip ? `title="${esc(tip)}"` : ''}>${tg[0]}</span>
    ${u ? `<span class="nu"><span class="ul">용도</span>${esc(u.use)}${pu ? '<span class="hm">사람 기입</span>' : ''}${dQchips(d.opts.ques, u.qa)}<button class="ibtn" data-act="purp" data-key="${esc(x.api)}" data-label="${esc(x.p)}" title="용도 기입" aria-label="${esc(x.p)} 용도 기입">${svg('pencil', 13)}</button></span>` : ''}</div>`;
}
function dLogHTML(d) {
  if (!d.log.length) return '<div class="empty-s">아직 기록된 요청이 없습니다.</div>';
  const rows = d.log.slice(-250);
  return rows.map((x, i) => dLogRow(d, x, i === rows.length - 1)).join('');
}
function dPlanHTML(d) {
  const h = d.hitl, ques = d.opts.ques || [];
  if (!d.opts.crawl) return '<div class="empty-s">화면 탐색을 하지 않아 탐색 계획이 없습니다.</div>';
  if (!h || !h.plan.ready) return '<div class="empty-s">로그인한 뒤 메뉴를 읽으면<br>탐색 목적에 맞춰 계획을 세웁니다.</div>';
  const live = d.phase === 'running';
  return `<div class="plan-p"><span class="ul">목적</span>${esc(h.purpose || '(없음)')}<span class="by">${esc(D_BY[h.plan.by] || '')}</span></div><ol class="plan">${h.plan.items.map((p, i) => {
    const st = p.asking ? 'ask' : p.st;
    const act = !live ? '' : p.rel === 'excl' ? '' : p.rel === 'low' && ['wait', 'skip'].includes(p.st) && !p.asking
      ? (p.hum && p.st === 'wait' ? '<span class="muted" style="font-size:12px">포함함</span>' : `<button class="btn sm" data-act="planIncl" data-id="${p.id}">탐색하기</button>`)
      : p.st === 'wait' && !p.asking ? `<button class="btn sm" data-act="planSkip" data-id="${p.id}">건너뛰기</button>` : '';
    return `<li class="${st}"><span class="pi">${i + 1}</span><span class="pn2"><b>${esc(p.name)}</b>${p.why ? `<small>${esc(p.why)}</small>` : ''}${p.hum ? '<small class="hm">사람이 바꿈</small>' : ''}</span><span class="pq">${dQchips(ques, p.qa)}</span><span class="stt ${D_REL[p.rel][1]}">${D_REL[p.rel][0]}</span><span class="stt ${D_PST[st][1]}">${D_PST[st][0]}</span><span class="pa">${act}</span></li>`; }).join('')}</ol>`;
}
function dAsksHTML(d) {
  const h = d.hitl;
  if (!h || !h.asks.length) return `<div class="empty-s">아직 질문이 없습니다.<br>애매한 화면을 만나면 여기와 브라우저 화면 위에 질문을 띄웁니다.<br><span class="muted">개입 수준: ${dHitlOf(d)[0]}</span></div>`;
  const act = dQ(d), who = { human:`${esc(WS.user || '사람')}님 결정`, pre:`${esc(WS.user || '사람')}님 결정`, never:'묻지 않고 처리', auto:'답이 없어 자동 처리', end:'탐색이 끝나 처리하지 않음' };
  return `<ul class="asks">${h.asks.map(r => `<li class="${r.st}"><span class="ntag warn">${esc(r.kindLabel)}</span><div class="at"><b>${esc(r.title)}</b>${r.st === 'wait'
    ? `<span>${act && act.id === r.id ? '답을 기다리는 중, <b class="qleft"></b> 남음' : '앞 질문에 답하면 이어서 보여 드려요'}</span>`
    : `<span>${who[r.who] || '처리'}: ${esc(r.label)}</span>`}</div><span class="nt2">${mmss(Math.round(r.t))}</span></li>`).join('')}</ul>`;
}
const dRightHTML = d => d.tab === 'plan' ? dPlanHTML(d) : d.tab === 'qs' ? dAsksHTML(d) : dLogHTML(d);
function dTabsHTML(d) {
  const pn = dPendingN(d), n = d.hitl ? d.hitl.asks.length : 0;
  return `<div class="dtabs" role="tablist">${[['log', '네트워크 기록'], ['plan', '탐색 계획'], ['qs', '질문']].map(([k, l]) => `<button role="tab" aria-selected="${d.tab === k}" class="${d.tab === k ? 'on' : ''}" data-act="dtab" data-v="${k}">${l}${k === 'qs' && pn ? `<b class="bd2">${pn}</b>` : k === 'qs' && n ? ` <span class="muted">${n}</span>` : ''}</button>`).join('')}</div>`;
}
/* 지시 예시 칩: 지금 계획에 있는 실제 메뉴 이름으로 만든다 */
const josa = (w, withBatchim, without) => { const c = String(w || '').trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 === 0 ? without : withBatchim; };
function dChipsHTML(d) {
  const items = (d.hitl && d.hitl.plan.items || []).filter(p => p.rel !== 'excl'), out = [];
  const last = [...items].reverse().find(p => p.st === 'wait' && !p.asking), low = items.find(p => p.rel === 'low' && ['wait', 'skip'].includes(p.st) && !(p.hum && p.st === 'wait'));
  const take = items.find(p => p.asking) || items.find(p => p.st === 'wait' && (!last || p.id !== last.id));
  if (last) out.push(`${last.name} 메뉴는 보지 마`);
  if (low && (!last || low.id !== last.id)) out.push(`${low.name} 메뉴도 탐색해 줘`);
  if (take) out.push(`${take.name}${josa(take.name, '은', '는')} 내가 보여줄게`);
  return out.map(t => `<button class="chip" data-act="dCmdChip" data-v="${esc(t)}">${esc(t)}</button>`).join('');
}
function discLiveHTML(d) {
  d.shownSrc = '';                               // <img> 가 새로 만들어지므로 다시 채워야 한다
  return `<div id="dStep"></div><div class="dact" id="dAct"></div><div id="dCnt"></div>
  <div class="dgrid2">
    <section class="box"><div class="box-h"><h3>운영 화면 탐색<small>헤드리스 브라우저${d.browser ? `, ${esc(d.browser)}` : ''}</small></h3><span class="dctl" id="dCtl"></span></div>
      <div class="dbrowser" id="dBw">${dBrowser(d)}</div>
      <div class="cmd" id="cmdBar" hidden><div class="cmd-r"><input class="inp" id="cmdIn" maxlength="200" autocomplete="off" placeholder="크롤러에게 지시하기 (예: 메뉴 이름 + 보지 마)" aria-label="크롤러에게 지시"><button class="btn sm" data-act="dCmd">${svg('send', 14)}보내기</button></div>
        <div class="cmd-c" id="cmdChips"></div><p class="cmd-h">메뉴 이름과 '보지 마', '건너뛰어', '내가 보여줄게' 같은 표현을 알아듣습니다. 그 밖의 말은 메모로만 남깁니다.</p></div></section>
    <section class="box dside"><div class="box-h tabs-h" id="dTabs"></div><div class="dright" id="dRight"></div></section>
  </div>
  <section class="box" style="margin-top:20px"><div class="box-h"><h3>Git 소스 분석<small>${esc(d.opts.repo ? d.opts.repo.replace(/^https?:\/\//, '') : '')}${d.framework ? ' · ' + esc(d.framework) : ''}</small></h3></div><div class="box-b" id="gitPane">${dGit(d)}</div></section>`;
}
function discPatch() {
  const d = S.disc; if (!d || !$('#dStep')) return;
  dPut('#dStep', dStepper(d));
  const a = dActParts(d), ae = $('#dAct'); if (ae) { ae.className = a.cls; dPut('#dAct', a.html); }
  dPut('#dCnt', dCounters(d)); dPut('#gitPane', dGit(d)); dPut('#dCtl', dCtlHTML(d)); dPut('#dTabs', dTabsHTML(d));
  discBrowserPatch(d);
  const r = $('#dRight');
  if (r) { const stick = r.scrollTop + r.clientHeight >= r.scrollHeight - 40; if (dPut('#dRight', dRightHTML(d)) && d.tab === 'log' && stick) r.scrollTop = r.scrollHeight; }
  const q = dQ(d), ql = $('#dRight .qleft'); if (ql && q) ql.textContent = mmss(Math.ceil(q.left || 0));
  const cmd = $('#cmdBar'); if (cmd) { cmd.hidden = !(dLive(d) && d.hitl); dPut('#cmdChips', dChipsHTML(d)); }
}
function discAfterRender() {
  const d = S.disc; if (!d || !D_LIVE.includes(d.phase)) return;
  d.shownSrc = ''; discPatch();
  const r = $('#dRight'); if (r && d.tab === 'log') r.scrollTop = r.scrollHeight;
}

/* ---------- 머리글, 화면 ---------- */
function discHead(d) {
  const [l, c] = JOB_ST[d.phase] || [d.phase, 'mute'], o = d.opts;
  const how = [o.git && 'Git 소스 분석', o.crawl && '운영 화면 탐색'].filter(Boolean).join(', ');
  const btn = d.phase === 'running' || d.phase === 'scheduled' ? `<button class="btn" data-act="discCancel">${d.phase === 'scheduled' ? '예약 취소' : '탐색 중단'}</button>`
    : `<button class="btn" data-act="discRerun">${svg('refresh', 15)}같은 설정으로 다시 탐색</button>`;
  const ques = o.ques || [];
  const pur = o.purpose || ques.length ? `<div class="purpose">${svg('target', 16)}<span class="ul">탐색 목적</span><b>${esc(o.purpose || '(목적 없음)')}</b><span class="qs">${ques.map((q, i) => q ? `<span class="qchip lg2"><em>Q${i + 1}</em>${esc(q)}</span>` : '').join('')}</span></div>` : '';
  return `<button class="link" data-act="nav" data-v="src" style="text-decoration:none;display:inline-flex;align-items:center;gap:2px;font-size:13.5px">${svg('back', 15)}원본 시스템</button>
  <div class="page-head" style="margin-top:6px"><h2>${esc(d.name)} 자동 탐색</h2><span class="stt ${c}">${l}</span><p>${how}${o.base ? `, 운영 ${esc(o.base)}` : ''}${o.crawl ? `, 개입 수준 ${dHitlOf(d)[0]}` : ''}</p><span class="sp" style="flex:1"></span>${btn}</div>${pur}`;
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
    ${d.log.length || d.files.length ? `<div class="dgrid2"><section class="box"><div class="box-h"><h3>네트워크 기록</h3></div><div class="netlog">${dLogHTML(d)}</div></section><section class="box"><div class="box-h"><h3>Git 소스 분석</h3></div><div class="box-b">${dGit(d)}</div></section></div>` : ''}`;
}

/* 결과 검토 */
function discRows(d) {
  const f = d.filter, list = d.apis.filter(a => f === 'all' || (f === 'rec' ? a.ev !== 'out' && dRec(a)[0] === 'yes' : f === 'q' ? a.ev !== 'out' && (a.qa || []).length : f === 'hum' ? a.human : dEvidence(a) === f));
  const order = { yes:0, check:1, no:2 };
  list.sort((a, b) => order[dRec(a)[0]] - order[dRec(b)[0]]);
  if (!list.length) return `<tr><td class="empty" colspan="7">이 조건에 맞는 API가 없습니다.</td></tr>`;
  return list.map(a => { const e = dEvidence(a), [vl, vc] = dVerify(a), [rk, rn] = dRec(a), qa = a.qa || [];
    return `<tr data-act="discEv" data-id="${a.id}" tabindex="0" class="${d.sel.has(a.id) ? 'sel' : ''}">
      <td class="ck" data-act="noop"><input type="checkbox" data-chg="dsel" data-id="${a.id}" ${d.sel.has(a.id) ? 'checked' : ''} ${a.tool && d.phase !== 'done' ? '' : 'disabled'} aria-label="${esc(a.title)} 선택" title="${a.tool ? '' : 'AI 도구로 만들 수 없는 API입니다'}"></td>
      <td class="l"><div class="api"><span class="mth ${a.m === 'GET' ? 'g' : 'p'}">${esc(a.m)}</span><span class="tn">${esc(a.path)}</span></div><div class="api-s">${esc(a.title)}${a.tool ? ` <span class="mono">${esc(a.tool)}</span>` : ''}</div></td>
      <td class="l use-c">${a.ev === 'out' ? '<span class="muted" style="font-size:12px">이 시스템의 API 가 아닙니다</span>' : `<div class="use">${esc(a.use || '(용도 미정)')}${a.useBy === 'human' ? '<span class="hm">사람 기입</span>' : ''}<button class="ibtn" data-act="purp" data-key="${esc(a.key)}" data-label="${esc(a.m + ' ' + a.path)}" title="용도 기입" aria-label="${esc(a.path)} 용도 기입">${svg('pencil', 13)}</button></div><div class="qrow">${dQchips(d.opts.ques, qa) || '<span class="muted" style="font-size:11.5px">연결된 질문 없음</span>'}</div>`}</td>
      <td><span class="evb ${e === 'tr' || !e ? 'off' : 's'}">소스</span><span class="evb ${e === 'src' || !e ? 'off' : 't'}">트래픽</span>${a.human ? '<div><span class="hm">사람 확인</span></div>' : ''}</td>
      <td><span class="stt ${vc}">${vl}</span></td>
      <td>${modeTag(a.mode)}</td>
      <td class="l" style="white-space:normal;min-width:170px">${stt(rk, REC)}${rn ? `<div style="font-size:12px;color:var(--text-3);margin-top:3px;line-height:1.45">${esc(rn)}</div>` : ''}</td></tr>`; }).join('');
}
function discResultHTML(d) {
  const all = dFound(), n = k => all.filter(a => a.ev === k).length, rec = all.filter(a => dRec(a)[0] === 'yes').length, s = d.stats || {}, o = d.opts, ques = o.ques || [];
  const venn = `<svg viewBox="0 0 320 170" class="venn" role="img" aria-label="소스 ${n('src')}개, 둘 다 ${n('both')}개, 트래픽 ${n('tr')}개">
    <circle cx="118" cy="85" r="72" class="vs"/><circle cx="202" cy="85" r="72" class="vt"/>
    <g data-act="dfilter" data-v="src" class="vz ${d.filter === 'src' ? 'on' : ''}"><text x="82" y="82" class="vn">${n('src')}</text><text x="82" y="102" class="vl">소스에만</text></g>
    <g data-act="dfilter" data-v="both" class="vz ${d.filter === 'both' ? 'on' : ''}"><text x="160" y="82" class="vn">${n('both')}</text><text x="160" y="102" class="vl">모두 확인</text></g>
    <g data-act="dfilter" data-v="tr" class="vz ${d.filter === 'tr' ? 'on' : ''}"><text x="238" y="82" class="vn">${n('tr')}</text><text x="238" y="102" class="vl">트래픽에만</text></g>
    <text x="70" y="16" class="vh">Git 소스</text><text x="250" y="16" class="vh">운영 트래픽</text></svg>`;
  const cover = ques.map((q, i) => { if (!q) return ''; const hit = all.filter(a => a.tool && (a.qa || []).includes(i));
    return `<li class="${hit.length ? '' : 'miss'}"><span class="qchip"><em>Q${i + 1}</em></span><div><b>${esc(q)}</b><span>${hit.length ? hit.map(a => `<span class="mono">${esc(a.tool)}</span>`).join(', ') : '답할 API를 찾지 못했습니다. 표에서 용도를 기입해 질문과 연결하세요'}</span></div>${hit.length ? svg('check', 16, 2.6) : svg('alert', 16)}</li>`; }).join('');
  const answered = d.hitl ? d.hitl.asks.filter(x => x.who === 'human' || x.who === 'pre').length : 0;
  const safe = [
    o.crawl && `<li>${svg('shield', 16)}<span>쓰기 요청 <b>${s.blocked ?? 0}건</b>을 가로채 운영에 보내지 않았습니다</span></li>`,
    o.crawl && d.reads && d.reads.state === 'allow' && `<li>${svg('check', 16)}<span>이름이 조회처럼 보이는 POST <b>${d.reads.n}건</b>은 ${d.reads.auto ? '설정에 따라' : '허락을 받아'} 운영에 보냈습니다. 저장·삭제 같은 낱말이 든 요청은 보내지 않았습니다</span></li>`,
    o.crawl && `<li>${svg('user', 16)}<span>사람 결정 <b>${s.nHuman ?? 0}건</b>을 반영했습니다 (질문 답변 ${answered}건${s.nTake ? `, 직접 조작 ${s.nTake}회` : ''} 포함)</span></li>`,
    o.crawl && `<li>${svg('alert', 16)}<span>누르지 않을 버튼과 제외 경로 <b>${s.skipped ?? 0}개</b>를 건너뛰었습니다</span></li>`,
    o.crawl && `<li>${svg('history', 16)}<span>답이 없던 질문 <b>${s.nAuto ?? 0}건</b>은 안전한 쪽으로 처리했습니다</span></li>`,
    o.crawl && `<li>${svg('lock', 16)}<span>${o.mask ? `캡처한 요청과 응답의 개인정보 <b>${s.masked ?? 0}건</b>을 저장 전에 가렸습니다` : '개인정보 마스킹을 꺼서 캡처한 값을 그대로 저장했습니다. 비밀번호와 토큰만 가렸습니다'}</span></li>`,
    `<li>${svg('server', 16)}<span>${o.stg ? `쓰기 API <b>${s.stgVerified ?? 0}개</b>는 스테이징(${esc(hostOf(o.stgUrl))})에서만 호출했고, 운영에는 읽기 요청만 다시 보냈습니다` : '운영에는 읽기 요청만 다시 보냈고, 쓰기 API 는 호출하지 않아 미검증으로 남겼습니다'}</span></li>`,
    `<li>${svg('user', 16)}<span>${esc(o.owner)} 승인을 받고 탐색했습니다</span></li>`].filter(Boolean).join('');
  const notes = (d.notes || []).length ? `<ul class="vleg" style="margin:12px 0 0;min-width:0">${d.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  const filters = [['all', '전체', d.apis.length], ['rec', '등록 추천', rec], ['q', '질문과 연결', all.filter(a => (a.qa || []).length).length], ['hum', '사람 확인', all.filter(a => a.human).length],
    ['both', '모두 확인', n('both')], ['src', '소스에만', n('src')], ['tr', '트래픽에만', n('tr')]];
  const rd = d.reads && d.reads.state === 'keep' && d.phase !== 'done' ? `<div class="notice warn" style="margin-top:16px">${svg('shield', 18)}<div class="nt"><b>조회로 보이는 POST ${d.reads.paths.length}종(${d.reads.n}건)을 막았습니다.</b>
    이 사이트는 조회에도 POST 를 쓰는 것 같아서, 아래 표에서 응답 형식을 확인하지 못한 API 가 있습니다. 막은 요청: <span class="mono">${d.reads.paths.slice(0, 4).map(p => esc(p.split('/').pop())).join(', ')}</span>.
    허락하고 다시 탐색하면 이름이 조회처럼 보이는 요청만 실제로 보내고, 저장·삭제·수정 같은 낱말이 든 요청은 계속 막습니다.</div><button class="btn sm primary" data-act="discRerunReads">${svg('refresh', 14)}조회로 허락하고 다시 탐색</button></div>` : '';
  return `${dStepper(d)}${rd}
  ${d.phase === 'done' ? `<div class="notice" style="margin-top:16px">${svg('check', 18)}<div class="nt"><b>도구 후보 ${d.registered}개를 등록했습니다.</b> 변환 스튜디오에서 설명과 매핑을 검토한 뒤 공개하세요.</div><button class="btn sm primary" data-act="goSrc" data-id="${d.sourceId}">변환 스튜디오 열기</button></div>` : ''}
  <div class="dsum">
    <section class="box"><div class="box-h"><h3>찾은 API ${all.length}개<small>원을 누르면 해당 API만 볼 수 있습니다</small></h3></div>
      <div class="dsum-b">${venn}<ul class="vleg">
        <li><b>모두 확인 ${n('both')}개</b>실제로 쓰이고 있고 소스로 형식까지 확인한 API</li>
        <li><b>소스에만 ${n('src')}개</b>화면에서 호출되지 않은 API. 쓰기 기능이거나 사용하지 않는 API일 수 있습니다</li>
        <li><b>트래픽에만 ${n('tr')}개</b>저장소에 소스가 없는 API. 공통 모듈이나 다른 저장소에 있을 수 있습니다</li></ul></div></section>
    <section class="box"><div class="box-h"><h3>질문 예시별 커버리지<small>탐색 목적에 맞는 API를 찾았는지 확인합니다</small></h3></div>${cover ? `<ul class="cover">${cover}</ul>` : '<div class="empty-s">이 탐색에는 질문 예시가 없어 연결할 질문이 없습니다.</div>'}${notes}</section>
  </div>
  <section class="box" style="margin-top:20px"><div class="box-h"><h3>안전하게, 사람과 함께 탐색했습니다</h3></div><ul class="safe two-col">${safe}</ul></section>
  <div class="toolbar"><div class="tl-f" style="padding:0;border:0">${filters.map(([v, l, c]) => `<button class="${d.filter === v ? 'on' : ''}" data-act="dfilter" data-v="${v}">${l}<b>${c}</b></button>`).join('')}</div>
    <span class="sp"></span><span class="muted" style="font-size:12.5px">연필을 눌러 용도를 기입하고, 행을 누르면 근거를 볼 수 있습니다</span></div>
  <div class="twrap"><table class="utbl dtbl" style="min-width:1120px"><thead><tr><th class="ck"></th><th class="l">API</th><th class="l">용도와 연결된 질문</th><th>근거</th><th>검증</th><th>방식</th><th class="l">추천</th></tr></thead><tbody id="discBody">${discRows(d)}</tbody></table></div>
  ${d.phase === 'done' ? '' : `<div class="dock show" role="region" aria-label="선택한 API"><span class="cnt"><b>${d.sel.size}</b>개 선택</span><button class="clr" data-act="dselRec">추천만 선택</button><span class="sep"></span><button class="btn primary" data-act="discRegister" ${d.sel.size ? '' : 'disabled'}>도구 후보로 등록</button></div>`}
  <div style="height:70px"></div>`;
}

/* 근거 보기 */
function hlJava(t) {
  return esc(t).replace(/(\/\/.*$)|(&quot;.*?&quot;)|(@\w+)|\b(public|return|new|private|void|static|final|class|if|else)\b/gm,
    (m, c, s, an, kw) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : an ? `<span class="k">${an}</span>` : `<span class="t">${kw}</span>`);
}
const hlSrc = a => a.src.lang === 'java' ? hlJava(a.src.snippet) : esc(a.src.snippet);
function discEvidenceOpen(a, o, canSelect, isSel, canEdit) {
  const e = a.ev, [vl, vc] = dVerify(a), [rk, rn] = dRec(a), src = a.src, tr = a.tr, ques = o.ques || [], qa = a.qa || [];
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
    ${e === 'out' ? '' : `<div class="use-box"><div><span class="ul">용도</span><b>${esc(a.use || '(용도 미정)')}</b>${a.useBy === 'human' ? '<span class="hm">사람 기입</span>' : '<span class="muted" style="font-size:12px">추정</span>'}${canEdit && a.key ? `<button class="btn sm" data-act="purp" data-key="${esc(a.key)}" data-label="${esc(a.m + ' ' + a.path)}">${svg('pencil', 13)}기입</button>` : ''}</div>
      ${qa.filter(i => ques[i]).length ? `<ul>${qa.filter(i => ques[i]).map(i => `<li><span class="qchip"><em>Q${i + 1}</em></span>${esc(ques[i])}</li>`).join('')}</ul>` : '<p class="muted" style="margin:6px 0 0;font-size:12.5px">연결된 질문 예시가 없습니다.</p>'}</div>`}
    ${a.human ? `<div class="notice" style="margin-bottom:6px;background:var(--ont-bg);border-color:transparent">${svg('user', 18)}<div class="nt">사람의 결정이나 직접 조작으로 찾은 API입니다.</div></div>` : ''}
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
  if (d && d.id === jobId && d.apis.length) { const a = d.apis.find(x => x.id === apiId); if (a) return discEvidenceOpen(a, d.opts, !!a.tool && d.phase !== 'done', d.sel.has(a.id), true); }
  try {
    const r = await api.get(`/discovery/jobs/${jobId}/?after=999999999`);
    const a = (r.apis || []).find(x => x.id === apiId);
    if (!a) { toast('이 API의 탐색 기록을 찾을 수 없습니다.', 'warn'); return; }
    discEvidenceOpen(a, r.opts, false, false, false);
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

/* ---------- 사람과 함께 탐색하기: 동작 ---------- */
const dJobPath = () => `/discovery/jobs/${S.disc.id}`;
const dTell = (path, body, then) => api.post(`${dJobPath()}/${path}/`, Object.assign({ by:WS.user }, body)).then(r => { if (then) then(r); discKick(); return r; }).catch(e => { toast(esc(e.message), 'warn'); });
const dAnswer = (q, value) => dTell('answer', { qid:q.id, value }, r => { S.disc.hitl = r.hitl; discPatch(); });
const dTakeSend = cmd => dTell('take', cmd);
const dCommand = text => dTell('command', { text }, r => toast(esc(r.msg), r.ok ? (r.op === 'memo' ? 'info' : '') : 'warn'));       // 메시지에는 사이트가 준 메뉴 이름이 들어 있다
const dPlan = (id, op) => dTell('plan', { id, op }, r => { toast(esc(r.msg)); S.disc.hitl = r.hitl; discPatch(); });

function purpEdit(key, label) {
  const d = S.disc; if (!d) return;
  const a = d.apis.find(x => x.key === key), pu = d.hitl && d.hitl.purp[key], seen = d.log.slice().reverse().find(x => x.api === key);
  const cur = pu || (a ? { use:a.use || '', qa:a.qa || [] } : { use:(seen && seen.use) || '', qa:(seen && seen.qa) || [] }), ques = d.opts.ques || [];
  openModal('API 용도 기입', `<div class="field"><label>API</label><span class="mono" style="font-size:13px">${esc(a ? `${a.m} ${a.path}` : label || key)}</span></div>
    <div class="field"><label>용도</label><input class="inp" id="purpIn" value="${esc(cur.use)}" maxlength="60" placeholder="예: 발주 목록 조회"></div>
    <div class="field" style="align-items:start"><label style="padding-top:4px">답할 수 있는 질문</label><div class="purp-q">${ques.map((q, i) => !q ? '' : `<label><input type="checkbox" value="${i}" ${cur.qa.includes(i) ? 'checked' : ''}><span class="qchip"><em>Q${i + 1}</em></span>${esc(q)}</label>`).join('') || '<span class="muted" style="font-size:12.5px">이 탐색에는 질문 예시가 없습니다</span>'}</div></div>
    <p class="tab-hint" style="margin:8px 0 0">기입한 용도와 질문은 결과 검토와 AI 도구 설명 초안에 그대로 쓰입니다. 탐색은 멈추지 않고 계속됩니다.</p>`, '저장', () => {
    const use = $('#purpIn').value.trim(), qa = $$('.purp-q input:checked').map(x => +x.value);
    if (!use) { toast('용도를 입력해 주세요.', 'warn'); return; }
    api.post(`/discovery/jobs/${d.id}/purpose/`, { key, use, qa, label:label || key, by:WS.user }).then(r => {
      if (d.hitl) d.hitl.purp[key] = { use:r.use, qa:r.qa };
      d.apis.forEach(x => { if (x.key === key) { x.use = r.use; x.qa = r.qa; x.useBy = 'human'; } });
      closeModal(); if (d.phase === 'running') { discPatch(); discKick(); } else render(); toast('용도를 기입했습니다.');
    }).catch(e => toast(esc(e.message), 'warn'));
  });
}

/* 질문 카드 위에 마우스가 있는 동안: 서버에 알려 질문 시간을 멈춘다(알림이 끊기면 다시 흐른다) */
let dHoldTimer = null;
function dHold(on) {
  clearInterval(dHoldTimer); dHoldTimer = null;
  if (!on || !S.disc || S.disc.phase !== 'running') return;
  const ping = () => { const x = S.disc; if (!x || x.phase !== 'running' || !dQ(x)) { dHold(false); return; } api.post(`/discovery/jobs/${x.id}/hold/`).catch(() => {}); };
  ping(); dHoldTimer = setInterval(ping, 4000);
}
const inCard = el => !!(el && el.closest && el.closest('.qcard'));
document.addEventListener('mouseover', e => { if (inCard(e.target) && !dHoldTimer) dHold(true); });
document.addEventListener('mouseout', e => { if (dHoldTimer && inCard(e.target) && !inCard(e.relatedTarget) && !inCard(document.activeElement)) dHold(false); });
document.addEventListener('focusin', e => { if (inCard(e.target) && !dHoldTimer) dHold(true); });
document.addEventListener('focusout', e => { if (dHoldTimer && inCard(e.target) && !inCard(e.relatedTarget)) dHold(false); });

/* 직접 조작: 화면 캡처를 누르면 그 자리를 헤드리스 브라우저에 그대로 전한다 */
const dTaking = () => !!(S.disc && S.disc.hitl && S.disc.hitl.take);
document.addEventListener('click', e => {
  const img = e.target.closest && e.target.closest('#bwImg'); if (!img || !dTaking()) return;
  const r = img.getBoundingClientRect(), W = img.naturalWidth || 1100, H = img.naturalHeight || 680;
  dTakeSend({ op:'click', x:Math.round((e.clientX - r.left) / r.width * W), y:Math.round((e.clientY - r.top) / r.height * H) });
});
let dWheelAt = 0;
document.addEventListener('wheel', e => {
  const img = e.target.closest && e.target.closest('#bwImg'); if (!img || !dTaking()) return;
  e.preventDefault();
  if (Date.now() - dWheelAt < 120) return;
  dWheelAt = Date.now(); dTakeSend({ op:'scroll', dy:Math.max(-600, Math.min(600, Math.round(e.deltaY))) });
}, { passive:false });
document.addEventListener('keydown', e => {
  if (e.isComposing || e.key !== 'Enter') return;
  if (e.target.id === 'cmdIn') { e.preventDefault(); ACT.dCmd(); }
  else if (e.target.id === 'qVal') { e.preventDefault(); ACT.qAns({ dataset:{ v:'__in' } }); }
  else if (e.target.id === 'takeText') { e.preventDefault(); ACT.takeType(); }
});

/* 알림: 사람의 답을 기다리는 질문이 있으면 머리글 종 아이콘에 표시한다(다른 화면을 보고 있어도 놓치지 않게) */
const BELL = { n:0, jobs:[], title:document.title };
function discBell() {
  api.get('/discovery/pending/').then(r => {
    const b = $('#bellN'); if (!b) return;
    const was = BELL.n; BELL.n = r.count; BELL.jobs = r.jobs;
    b.hidden = !r.count; b.textContent = r.count;
    document.title = (r.count ? `(${r.count}) ` : '') + BELL.title;
    const first = r.jobs[0], viewing = first && S.view === 'disc' && S.disc && S.disc.id === first.id;
    if (r.count > was && first && !viewing) toast(`크롤러가 사람의 답을 기다립니다: ${esc(first.title)} (종 아이콘을 누르면 열립니다)`, 'info');
  }).catch(() => {});
}
const startBell = () => { discBell(); setInterval(discBell, 4000); };

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  bell: () => { if (BELL.jobs.length) discOpenJob(BELL.jobs[0].id).catch(e => toast(e.message, 'warn')); else toast('답을 기다리는 질문이 없습니다.', 'info'); },
  qAns: a => {
    const q = S.disc && dQ(S.disc); if (!q) return;
    let v = a.dataset.v;
    if (v === '__in') { const i = $('#qVal'); v = i ? i.value.trim() : ''; if (!v) { toast('값을 입력하거나 옆의 추천 값을 눌러 주세요.', 'warn'); return; } }
    dAnswer(q, v);
  },
  qSugg: a => { const q = S.disc && dQ(S.disc); if (q) dAnswer(q, a.dataset.v); },
  dPause: () => { const h = S.disc.hitl; dTell('pause', { paused:!h.paused }, r => { h.paused = r.paused; discPatch(); }); },
  dTake: () => dTell('take', { op:'start' }),
  takeEnd: () => dTell('take', { op:'end' }),
  takeType: () => { const i = $('#takeText'); if (!i || !i.value) return; const text = i.value; i.value = ''; dTakeSend({ op:'type', text }); },
  takeKey: a => dTakeSend({ op:'key', key:a.dataset.v }),
  dCmd: () => { const i = $('#cmdIn'); if (!i || !i.value.trim()) return; const text = i.value; i.value = ''; dCommand(text); },
  dCmdChip: a => dCommand(a.dataset.v),
  dtab: a => { S.disc.tab = a.dataset.v; discPatch(); const r = $('#dRight'); if (r && S.disc.tab === 'log') r.scrollTop = r.scrollHeight; },
  planSkip: a => dPlan(a.dataset.id, 'skip'),
  planIncl: a => dPlan(a.dataset.id, 'incl'),
  purp: a => purpEdit(a.dataset.key, a.dataset.label),
  discOpen: a => discOpenJob(a.dataset.id).catch(e => toast(e.message, 'warn')),
  discDel: a => {
    const j = DISC.jobs.find(x => x.id === a.dataset.id); if (!j) return;
    openModal('탐색 기록 삭제', `<p style="margin:0"><b>${esc(j.name)}</b> 탐색 기록과 저장해 둔 계정 정보를 지웁니다. 이미 등록한 원본 시스템과 도구는 그대로 남지만, 도구의 "탐색 근거 보기"는 열리지 않습니다.</p>`, '삭제', () => {
      api('DELETE', `/discovery/jobs/${j.id}/`).then(() => { if (S.disc && S.disc.id === j.id) S.disc = null; closeModal(); return refreshJobs(); }).catch(e => toast(e.message, 'warn'));
    });
  },
  discCancel: () => api.post(`/discovery/jobs/${S.disc.id}/cancel/`).then(() => toast('탐색을 멈추는 중입니다.', 'info')).catch(e => toast(e.message, 'warn')),
  discRerun: () => api.post(`/discovery/jobs/${S.disc.id}/rerun/`).then(j => { refreshJobs(); return discOpenJob(j.id); }).catch(e => toast(e.message, 'warn')),
  discRerunReads: () => api.post(`/discovery/jobs/${S.disc.id}/rerun/`, { allowReads:true }).then(j => { refreshJobs(); return discOpenJob(j.id); }).catch(e => toast(e.message, 'warn')),
  readAns: a => dTell('answer', { qid:a.dataset.qid, value:a.dataset.v }, r => { S.disc.hitl = r.hitl; discPatch(); toast(a.dataset.v === 'allow' ? '조회로 보이는 요청을 보내도록 했습니다. 화면의 조회 버튼을 다시 눌러 주세요.' : '계속 막습니다.', 'info'); }),
  discEv: a => discEvidenceFor(a.dataset.job || (S.disc && S.disc.id), a.dataset.id),
  dfilter: a => { S.disc.filter = S.disc.filter === a.dataset.v && a.dataset.v !== 'all' ? 'all' : a.dataset.v; render(); },
  dselToggle: a => { const d = S.disc, id = a.dataset.id; d.sel.has(id) ? d.sel.delete(id) : d.sel.add(id); closeDrawer(); render(); },
  dselRec: () => { discDefaultSel(); render(); },
  discRegister: () => { if (S.disc.sel.size) discRegister(); },
  wzDemo: () => { const m = DISC.demo; if (!m) return; Object.assign(S.wz.d, { name:m.name, base:m.base, start:m.start, account:m.account, password:m.password, repo:m.repo, branch:m.branch, stg:true, stgUrl:m.stgUrl, owner:m.owner, ok:false,
      exclude:m.exclude || S.wz.d.exclude, purpose:m.purpose || '', ques:[...(m.ques || ['', '', ''])], hitl:'ambig' }); S.wz.d.git = true; S.wz.d.crawl = !!DISC.capabilities.browser; renderDiscWz(); toast('시연용 값을 채웠습니다.', 'info'); },
  wzDisc: () => wzDiscStart(),
  wzStg: a => { S.wz.d.stg = a.dataset.v === '1'; $('#wzBody').innerHTML = wzBody(); },
  wzHitl: a => { S.wz.d.hitl = a.dataset.v; $('#wzBody').innerHTML = wzBody(); },
  wzQAdd: () => { const d = S.wz.d; d.ques.push(''); $('#wzBody').innerHTML = wzBody(); const ins = $$('[data-inp="wzQ"]'); ins.length && ins[ins.length - 1].focus(); },
  wzQDel: a => { const d = S.wz.d; if (d.ques.filter(q => q != null).length <= 1) { toast('질문 예시는 하나 이상 있어야 합니다.', 'warn'); return; } d.ques[+a.dataset.i] = null; $('#wzBody').innerHTML = wzBody(); },
  wzBanDel: a => { S.wz.ban = S.wz.ban.filter(b => b !== a.dataset.v); $('#wzBody').innerHTML = wzBody(); },
});
Object.assign(INP, { wzD: el => { S.wz.d[el.dataset.k] = el.value; }, wzQ: el => { S.wz.d.ques[+el.dataset.i] = el.value; } });
Object.assign(CHG, {
  wzDChk: el => {
    const d = S.wz.d, k = el.dataset.k;
    if ((k === 'git' || k === 'crawl') && !el.checked && !d[k === 'git' ? 'crawl' : 'git']) { el.checked = true; toast('Git 소스 분석과 운영 화면 탐색 중 하나는 켜야 합니다.', 'warn'); return; }
    d[k] = el.checked; if (k === 'git' && !d.git) d.stg = false; $('#wzBody').innerHTML = wzBody();
  },
  wzDSel: el => { S.wz.d[el.dataset.k] = el.value; },
  takePw: el => { const t = $('#takeText'); if (t) t.type = el.checked ? 'password' : 'text'; },
  wzOk: el => { S.wz.d.ok = el.checked; el.closest('.own').classList.toggle('on', el.checked); const b = $('[data-act="wzDisc"]'); if (b) b.disabled = !el.checked; },
  wzWhen: el => { S.wz.d.when = el.value; $('#wzBody').innerHTML = wzBody(); const b = $('[data-act="wzDisc"]'); if (b) b.lastChild.textContent = el.value === 'now' ? '탐색 시작' : '탐색 예약'; },
  dsel: el => { const d = S.disc; el.checked ? d.sel.add(el.dataset.id) : d.sel.delete(el.dataset.id); el.closest('tr').classList.toggle('sel', el.checked);
    const c = $('.dock .cnt b'); if (c) c.textContent = d.sel.size; const b = $('[data-act="discRegister"]'); if (b) b.disabled = !d.sel.size; },
});

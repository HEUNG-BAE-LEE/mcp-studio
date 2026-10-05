/* 서버(FastAPI)에서 받아 채우는 데이터와 화면 상태 */
let WS = {}, SOURCES = [], TOOLS = {}, MODELS = {}, PG_CHAT = false, TOOLSETS = [], KEYS = [], LOGS = [];
let WZ_MODES = [], BAN_WORDS = [], GOV_APIS = [];
const SRC = {};
const ACT = {}, INP = {}, CHG = {};

/* ---------- 조회 ---------- */
const TOOL = {};
const indexTools = () => Object.entries(TOOLS).forEach(([sid, arr]) => arr.forEach(t => {
  t.src = sid; TOOL[t.id] = t;
  if (t.exec == null) t.exec = t.mode === 'write' ? 'confirm' : 'auto';
  if (t.mask == null) t.mask = true;
  if (t.cache == null) t.cache = SRC[sid].proto === 'gov';
  if (t.limit == null) t.limit = t.mode === 'write' ? 10 : 60;
}));
const srcTools = sid => TOOLS[sid] || [];
const allTools = () => Object.values(TOOL);
function srcStat(s) {
  if (s.err) return 'err';
  if (s.busy) return 'busy';
  const ts = srcTools(s.id);
  if (ts.some(t => t.status === 'drift')) return 'drift';
  if (ts.some(t => t.status === 'review')) return 'review';
  return 'ok';
}
const SST = { ok:['정상','ok'], review:['검토 필요','warn'], drift:['명세 변경 감지','warn'], err:['인증 만료','danger'], busy:['분석 중','info'] };
const TST = { done:['공개 중','ok'], review:['검토 필요','warn'], drift:['명세 변경','warn'], off:['제외','mute'] };
const PRL = { soap:'SOAP', rest:'REST', gov:'공공데이터', sample:'샘플 추론', disc:'자동 탐색' };
const PDESC = { soap:'SOAP 1.1, XML 메시지', rest:'REST, JSON', gov:'공공데이터포털, XML 응답', sample:'HTTP, 명세 없음', disc:'HTTP, 소스와 트래픽으로 추론' };
const srcTotal = s => s.ext ? s.ext.total : srcTools(s.id).length;
const srcPub = s => srcTools(s.id).filter(t => t.status === 'done').length;
const srcPending = s => srcTools(s.id).filter(t => t.status === 'review' || t.status === 'drift').length;
const opLabel = t => t.method ? `${t.method} ${t.path}` : t.op;

const stt = (k, map) => { const [l, c] = map[k]; return `<span class="stt ${c}">${l}</span>`; };
const prBadge = p => `<span class="pr ${p}">${PRL[p]}</span>`;
const ruleChip = r => { const x = RULE[r]; return x ? `<span class="rl ${x[1]}" title="${esc(x[2])}">${x[0]}</span>` : ''; };
const modeTag = m => m === 'write' ? '<span class="md-tag w">쓰기</span>' : '<span class="md-tag r">읽기</span>';


/* ---------- 상태 ---------- */
const S = {
  view:'dash', srcQ:'', srcProto:'all',
  src:'hr', tool:'get_vacation_balance', tf:'all', tq:'', ptab:'mcp',
  pg:{ model:'claude', tool:null, args:{}, phase:'idle', out:null, hold:false, chat:[] },
  ts:'ts-hr', client:'claude',
  logQ:'', logStatus:'all', logClient:'all',
  wz:null,
};
try { const v = localStorage.getItem('ieum.view'); if (v) S.view = v; } catch (e) {}

const VIEWS = [
  { id:'dash', label:'대시보드', h:'대시보드', p:'원본 시스템이 AI 도구로 바뀌어 얼마나, 어떻게 쓰이고 있는지 확인합니다.' },
  { id:'src', label:'원본 시스템', h:'원본 시스템', p:'사내 시스템이나 공공 API를 연결하면 명세를 읽어 AI가 쓸 수 있는 도구 후보를 자동으로 만듭니다.' },
  { id:'studio', label:'변환 스튜디오', h:'변환 스튜디오', p:'원본 작업이 AI 도구로 어떻게 바뀌는지 확인하고, 설명과 파라미터 매핑을 다듬습니다.' },
  { id:'play', label:'테스트 실행', h:'테스트 실행', p:'AI 모델에게 질문해 도구 호출부터 원본 응답 변환까지 단계별로 확인합니다.' },
  { id:'deploy', label:'AI 연결 배포', h:'AI 연결 배포', p:'도구를 묶어 MCP 서버로 배포하고 Claude, Gemini, GPT, 사내 Agent에 연결합니다.' },
  { id:'logs', label:'호출 로그', h:'호출 로그', p:'AI가 어떤 도구를 호출했고 이음이 어떻게 변환했는지 기록을 확인합니다.' },
];
const pageHead = id => { const v = VIEWS.find(x => x.id === id); return `<div class="page-head"><h2>${v.h}</h2><p>${v.p}</p></div>`; };

/* 백엔드(FastAPI) API 호출과 부트스트랩. 응답 형식은 {resultCode, resultMsg, resultData} */
const API = '/api/ieum';
let DASH = null;

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type':'application/json' },
    credentials:'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  if (!res.ok || !json || json.resultCode >= 400) throw new Error((json && json.resultMsg) || `요청에 실패했습니다 (${res.status})`);
  return json.resultData;
}
api.get = p => api('GET', p);
api.post = (p, b = {}) => api('POST', p, b);
api.put = (p, b) => api('PUT', p, b);

/* 저장 실패는 화면을 막지 않고 알려 준다 */
const persist = (promise, failMsg = '서버에 저장하지 못했습니다.') => promise.catch(e => { toast(`${failMsg} ${e.message}`, 'warn'); });

async function loadAll() {
  const [src, disc, tools, pg, ts, keys, logs, dash] = await Promise.all([
    api.get('/sources/'), api.get('/discovery/'), api.get('/studio/'), api.get('/playground/'),
    api.get('/deploy/toolsets/'), api.get('/deploy/keys/'), api.get('/logs/'), api.get('/dashboard/summary/'),
  ]);
  WS = src.workspace; SOURCES = src.sources;
  WZ_MODES = src.wizard.modes; BAN_WORDS = src.wizard.banWords; GOV_APIS = src.wizard.govApis;
  DISC = disc;
  TOOLS = tools; MODELS = pg.models; PG_CHAT = pg.chatEnabled;
  TOOLSETS = ts; KEYS = keys; LOGS = logs.rows;
  WS.host = location.origin; DASH = dash;
  SOURCES.forEach(s => SRC[s.id] = s);
  indexTools();
}
const refreshDash = () => api.get('/dashboard/summary/').then(d => { DASH = d; if (S.view === 'dash') render(); }).catch(() => {});

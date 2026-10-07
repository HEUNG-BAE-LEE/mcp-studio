"""
웹사이트 API 자동 탐색 & 실시간 대시보드
사용법: python3 api_discover.py
브라우저에서 http://localhost:5001 접속
"""

import json
import queue
import re
import threading
from collections import defaultdict
from urllib.parse import urlparse, parse_qs

from flask import Flask, request, jsonify, render_template_string, Response
from playwright.sync_api import sync_playwright

app = Flask(__name__)

# SSE 이벤트 큐 (클라이언트별)
clients: list[queue.Queue] = []


def broadcast(event_type: str, data: dict):
    msg = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    dead = []
    for q in clients:
        try:
            q.put_nowait(msg)
        except queue.Full:
            dead.append(q)
    for q in dead:
        clients.remove(q)


# ── API Collector ──

class APICollector:
    def __init__(self):
        self.apis = {}
        self.base_urls = set()

    def on_request(self, req):
        if req.resource_type not in ("xhr", "fetch"):
            return
        parsed = urlparse(req.url)
        if re.search(r"\.(js|css|png|jpg|jpeg|gif|svg|woff|ico|map)(\?|$)", parsed.path):
            return

        method = req.method
        path = parsed.path
        query = parse_qs(parsed.query)
        base = f"{parsed.scheme}://{parsed.netloc}"
        self.base_urls.add(base)
        key = f"{method} {parsed.netloc}{path}"

        headers = req.headers
        content_type = headers.get("content-type", "")
        post_data = None
        try:
            post_data = req.post_data
        except:
            pass

        is_new = key not in self.apis
        if is_new:
            self.apis[key] = {
                "method": method, "base_url": base, "path": path,
                "full_url": req.url,
                "query_params": {}, "request_headers": {},
                "response_headers": {},
                "request_body_samples": [], "response_samples": [],
                "content_type": content_type, "call_count": 0,
                "status_code": None, "status_text": None,
                "timing": None, "size": None,
                "initiator": None, "cookies": [],
            }

        api = self.apis[key]
        api["call_count"] += 1

        for k, v in query.items():
            if k not in api["query_params"]:
                api["query_params"][k] = v[0] if len(v) == 1 else v

        # 모든 request headers 수집
        for h, v in headers.items():
            api["request_headers"][h] = v

        # cookie 추출
        if "cookie" in headers and not api["cookies"]:
            for pair in headers["cookie"].split(";"):
                pair = pair.strip()
                if "=" in pair:
                    ck, cv = pair.split("=", 1)
                    api["cookies"].append({"name": ck.strip(), "value": cv.strip()[:80]})

        if post_data and len(api["request_body_samples"]) < 2:
            try:
                api["request_body_samples"].append(json.loads(post_data))
            except:
                api["request_body_samples"].append(post_data[:500])

        if is_new:
            broadcast("api_found", {
                "key": key, "method": method, "base_url": base,
                "path": path, "content_type": content_type,
            })

    def on_response(self, resp):
        req = resp.request
        if req.resource_type not in ("xhr", "fetch"):
            return
        parsed = urlparse(req.url)
        if re.search(r"\.(js|css|png|jpg|jpeg|gif|svg|woff|ico|map)(\?|$)", parsed.path):
            return
        key = f"{req.method} {parsed.netloc}{parsed.path}"
        if key not in self.apis:
            return
        api = self.apis[key]
        api["status_code"] = resp.status
        api["status_text"] = resp.status_text

        # 모든 response headers 수집
        for h, v in resp.headers.items():
            api["response_headers"][h] = v

        # response size
        content_length = resp.headers.get("content-length")
        if content_length:
            api["size"] = int(content_length)

        # timing
        try:
            timing = resp.request.timing
            if timing:
                api["timing"] = {
                    "dns": round(timing.get("domainLookupEnd", 0) - timing.get("domainLookupStart", 0), 1),
                    "connect": round(timing.get("connectEnd", 0) - timing.get("connectStart", 0), 1),
                    "ttfb": round(timing.get("responseStart", 0) - timing.get("requestStart", 0), 1),
                    "download": round(timing.get("responseEnd", 0) - timing.get("responseStart", 0), 1),
                    "total": round(timing.get("responseEnd", 0) - timing.get("startTime", 0), 1),
                }
        except:
            pass

        if len(api["response_samples"]) < 1:
            try:
                ct = resp.headers.get("content-type", "")
                if "json" in ct:
                    body = resp.json()
                    api["response_samples"].append(_truncate(body))
                    if not api["size"]:
                        api["size"] = len(resp.body())
            except:
                pass
        broadcast("api_updated", {
            "key": key, "status_code": resp.status,
            "call_count": api["call_count"],
        })

    def to_list(self):
        result = []
        for key, api in sorted(self.apis.items()):
            result.append({
                "key": key, "method": api["method"],
                "base_url": api["base_url"], "path": api["path"],
                "full_url": api.get("full_url"),
                "status_code": api.get("status_code"),
                "status_text": api.get("status_text"),
                "call_count": api["call_count"],
                "content_type": api["content_type"],
                "query_params": api["query_params"],
                "request_headers": api["request_headers"],
                "response_headers": api.get("response_headers", {}),
                "request_body": api["request_body_samples"][0] if api["request_body_samples"] else None,
                "response_body": api["response_samples"][0] if api["response_samples"] else None,
                "timing": api.get("timing"),
                "size": api.get("size"),
                "cookies": api.get("cookies", []),
            })
        return result


def _truncate(obj, max_items=5, max_depth=3, depth=0):
    if depth >= max_depth:
        return "..."
    if isinstance(obj, dict):
        return {k: _truncate(v, max_items, max_depth, depth + 1)
                for i, (k, v) in enumerate(obj.items()) if i < max_items * 2}
    if isinstance(obj, list):
        return [_truncate(obj[0], max_items, max_depth, depth + 1)] if obj else []
    return obj


# ── Crawler ──

crawl_state = {"running": False, "collector": None}


def crawl_worker(url: str, max_pages: int, wait_sec: int):
    collector = APICollector()
    crawl_state["collector"] = collector
    crawl_state["running"] = True
    parsed_base = urlparse(url)
    base_domain = parsed_base.netloc

    broadcast("status", {"msg": "브라우저 시작 중...", "phase": "init"})

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("request", collector.on_request)
        page.on("response", collector.on_response)

        visited = set()
        to_visit = [url]

        while to_visit and len(visited) < max_pages and crawl_state["running"]:
            current = to_visit.pop(0)
            if current in visited:
                continue
            visited.add(current)

            broadcast("page_visit", {
                "url": current, "visited": len(visited),
                "max_pages": max_pages, "queued": len(to_visit),
                "api_count": len(collector.apis),
            })

            try:
                page.goto(current, wait_until="networkidle", timeout=15000)
            except Exception as e:
                broadcast("page_error", {"url": current, "error": str(e)[:200]})
                continue

            page.wait_for_timeout(wait_sec * 1000)

            # scroll
            try:
                page.evaluate("""async () => {
                    const d = ms => new Promise(r => setTimeout(r, ms));
                    const h = document.body.scrollHeight;
                    for (let i = 0; i < 3; i++) { window.scrollBy(0, h/3); await d(500); }
                }""")
            except:
                pass
            page.wait_for_timeout(1000)

            # click interactive elements
            try:
                els = page.query_selector_all("button:visible, [role='tab']:visible, [role='button']:visible")
                for el in els[:5]:
                    try:
                        el.click(timeout=2000)
                        page.wait_for_timeout(800)
                    except:
                        pass
            except:
                pass

            # collect links
            try:
                links = page.eval_on_selector_all(
                    "a[href]",
                    """els => els.map(e => e.href).filter(h =>
                        h.startsWith('http') && !h.includes('#') &&
                        !h.match(/\\.(pdf|zip|png|jpg|mp4|mp3)$/i)
                    )""")
                for link in links:
                    if urlparse(link).netloc == base_domain and link not in visited:
                        to_visit.append(link)
            except:
                pass

        browser.close()

    broadcast("done", {
        "pages_visited": len(visited),
        "api_count": len(collector.apis),
    })
    crawl_state["running"] = False


# ── Routes ──

@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/api/start", methods=["POST"])
def start_crawl():
    if crawl_state["running"]:
        return jsonify({"error": "이미 실행 중입니다"}), 409
    data = request.json
    url = data.get("url", "")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    max_pages = int(data.get("max_pages", 10))
    wait_sec = int(data.get("wait_sec", 3))
    t = threading.Thread(target=crawl_worker, args=(url, max_pages, wait_sec), daemon=True)
    t.start()
    return jsonify({"ok": True})


@app.route("/api/stop", methods=["POST"])
def stop_crawl():
    crawl_state["running"] = False
    return jsonify({"ok": True})


@app.route("/api/results")
def get_results():
    c = crawl_state.get("collector")
    if not c:
        return jsonify({"apis": []})
    return jsonify({"apis": c.to_list(), "base_urls": sorted(c.base_urls)})


@app.route("/api/stream")
def stream():
    q = queue.Queue(maxsize=200)
    clients.append(q)

    def gen():
        try:
            while True:
                msg = q.get(timeout=30)
                yield msg
        except:
            pass
        finally:
            if q in clients:
                clients.remove(q)

    return Response(gen(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── HTML ──

HTML = r"""
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API Discovery Dashboard</title>
<style>
:root { --bg: #0f0f1a; --card: #1a1a2e; --border: #2a2a4a; --accent: #e94560; --green: #4ade80; --yellow: #facc15; --blue: #60a5fa; --text: #e2e8f0; --dim: #94a3b8; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'SF Mono', 'Fira Code', monospace; background: var(--bg); color: var(--text); min-height:100vh; }

.header { padding: 20px 24px; border-bottom: 1px solid var(--border); }
.header h1 { font-size: 20px; margin-bottom: 12px; }
.header h1 span { color: var(--accent); }
.controls { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.controls input[type=text] {
  flex:1; min-width:300px; padding:10px 14px; font-size:14px; font-family:inherit;
  background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); outline:none;
}
.controls input:focus { border-color: var(--accent); }
.controls input[type=number] { width:70px; padding:10px 8px; font-size:14px; font-family:inherit;
  background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); text-align:center; }
.controls label { font-size:12px; color:var(--dim); }
.btn { padding:10px 20px; font-size:14px; font-weight:600; font-family:inherit; border:none; border-radius:6px; cursor:pointer; transition:all .2s; }
.btn-start { background:var(--accent); color:#fff; }
.btn-start:hover { background:#c73650; }
.btn-stop { background:#334155; color:var(--text); }
.btn-stop:hover { background:#475569; }
.btn:disabled { opacity:.4; cursor:default; }

.dashboard { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:16px 24px; }
@media (max-width:1200px) { .dashboard { grid-template-columns:1fr; } }

.card { background:var(--card); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
.card-head { padding:12px 16px; border-bottom:1px solid var(--border); font-size:13px; font-weight:600; color:var(--dim); display:flex; justify-content:space-between; }
.card-body { padding:16px; max-height:500px; overflow-y:auto; }

/* stats */
.stats { display:flex; gap:16px; padding:12px 24px; flex-wrap:wrap; }
.stat { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px 20px; min-width:140px; }
.stat .val { font-size:28px; font-weight:700; }
.stat .label { font-size:11px; color:var(--dim); margin-top:2px; }
.stat.accent .val { color:var(--accent); }
.stat.green .val { color:var(--green); }
.stat.blue .val { color:var(--blue); }
.stat.yellow .val { color:var(--yellow); }

/* progress */
.progress-bar { height:3px; background:var(--border); margin:0; }
.progress-fill { height:100%; background: linear-gradient(90deg, var(--accent), var(--blue)); width:0%; transition:width .3s; }

/* log */
.log-item { padding:6px 0; font-size:12px; border-bottom:1px solid var(--border); display:flex; gap:8px; }
.log-item:last-child { border:none; }
.log-time { color:var(--dim); min-width:65px; }
.log-tag { padding:1px 6px; border-radius:3px; font-size:10px; font-weight:600; }
.log-tag.visit { background:#1e3a5f; color:var(--blue); }
.log-tag.api { background:#3b1f2b; color:var(--accent); }
.log-tag.error { background:#3b1f1f; color:#f87171; }
.log-tag.done { background:#1f3b2b; color:var(--green); }

/* api table */
.api-table { width:100%; border-collapse:collapse; font-size:12px; }
.api-table th { text-align:left; padding:8px; color:var(--dim); font-size:11px; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--card); }
.api-table td { padding:8px; border-bottom:1px solid var(--border); }
.method { padding:2px 6px; border-radius:3px; font-weight:700; font-size:11px; }
.method.GET { background:#1e3a5f; color:var(--blue); }
.method.POST { background:#3b1f2b; color:var(--accent); }
.method.PUT { background:#3b2f1f; color:var(--yellow); }
.method.DELETE { background:#3b1f1f; color:#f87171; }
.method.PATCH { background:#2b1f3b; color:#c084fc; }
.status { font-weight:600; }
.status.s2 { color:var(--green); }
.status.s3 { color:var(--yellow); }
.status.s4 { color:#f87171; }
.status.s5 { color:#f87171; }
.api-row { cursor:pointer; transition:background .15s; }
.api-row:hover { background:#ffffff08; }
.api-row.selected { background:#ffffff10; }

/* detail panel */
.detail { font-size:12px; }
.detail h3 { font-size:14px; margin-bottom:12px; }
.detail-section { margin-bottom:16px; }
.detail-section h4 { font-size:11px; color:var(--dim); margin-bottom:6px; text-transform:uppercase; }
.detail pre { background:var(--bg); border:1px solid var(--border); border-radius:4px; padding:10px; overflow-x:auto; font-size:11px; white-space:pre-wrap; word-break:break-all; max-height:200px; overflow-y:auto; }
.param-table { width:100%; font-size:11px; border-collapse:collapse; }
.param-table td { padding:4px 8px; border-bottom:1px solid var(--border); }
.param-table td:first-child { color:var(--blue); font-weight:600; width:30%; }
.empty { color:var(--dim); font-style:italic; padding:40px; text-align:center; }

/* detail tabs */
.tabs { display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:12px; }
.tab { padding:8px 14px; font-size:11px; font-weight:600; cursor:pointer; color:var(--dim); border-bottom:2px solid transparent; transition:all .15s; font-family:inherit; background:none; border-top:none; border-left:none; border-right:none; }
.tab:hover { color:var(--text); }
.tab.active { color:var(--accent); border-bottom-color:var(--accent); }
.tab-content { display:none; }
.tab-content.active { display:block; }
.header-group { margin-bottom:12px; }
.header-group h5 { font-size:11px; color:var(--dim); margin-bottom:4px; padding:4px 0; border-bottom:1px solid var(--border); }
.timing-bar-wrap { margin-bottom:6px; }
.timing-bar-label { font-size:11px; color:var(--dim); margin-bottom:2px; display:flex; justify-content:space-between; }
.timing-bar { height:6px; background:var(--border); border-radius:3px; overflow:hidden; }
.timing-bar-fill { height:100%; border-radius:3px; transition:width .3s; }
.timing-bar-fill.dns { background:#818cf8; }
.timing-bar-fill.connect { background:var(--yellow); }
.timing-bar-fill.ttfb { background:var(--green); }
.timing-bar-fill.download { background:var(--blue); }
.cookie-table { width:100%; font-size:11px; border-collapse:collapse; }
.cookie-table th { text-align:left; padding:4px 8px; color:var(--dim); border-bottom:1px solid var(--border); }
.cookie-table td { padding:4px 8px; border-bottom:1px solid var(--border); word-break:break-all; }
.size-badge { display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; background:#1e3a5f; color:var(--blue); margin-left:8px; }
</style>
</head>
<body>

<div class="header">
  <h1><span>API</span> Discovery Dashboard</h1>
  <div class="controls">
    <input type="text" id="url" placeholder="https://example.com" value="">
    <label>Pages<input type="number" id="maxPages" value="10" min="1" max="50"></label>
    <label>Wait(s)<input type="number" id="waitSec" value="3" min="1" max="10"></label>
    <button class="btn btn-start" id="btnStart" onclick="startCrawl()">Start</button>
    <button class="btn btn-stop" id="btnStop" onclick="stopCrawl()" disabled>Stop</button>
  </div>
</div>

<div class="progress-bar"><div class="progress-fill" id="progress"></div></div>

<div class="stats">
  <div class="stat accent"><div class="val" id="statApis">0</div><div class="label">APIs Found</div></div>
  <div class="stat blue"><div class="val" id="statPages">0</div><div class="label">Pages Visited</div></div>
  <div class="stat yellow"><div class="val" id="statQueued">0</div><div class="label">Queued</div></div>
  <div class="stat green"><div class="val" id="statStatus">Ready</div><div class="label">Status</div></div>
</div>

<div class="dashboard">
  <div class="card">
    <div class="card-head"><span>Discovered APIs</span><span id="apiCount">0 endpoints</span></div>
    <div class="card-body" id="apiListWrap">
      <table class="api-table">
        <thead><tr><th>Method</th><th>Path</th><th>Status</th><th>Calls</th></tr></thead>
        <tbody id="apiList"></tbody>
      </table>
      <div class="empty" id="apiEmpty">Start a scan to discover APIs</div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><span>API Detail</span></div>
    <div class="card-body detail" id="detailPanel">
      <div class="empty">Select an API from the list</div>
    </div>
  </div>

  <div class="card" style="grid-column:1/-1;">
    <div class="card-head"><span>Activity Log</span><button class="btn btn-stop" onclick="clearLog()" style="padding:4px 10px;font-size:11px;">Clear</button></div>
    <div class="card-body" id="logPanel" style="max-height:250px;"></div>
  </div>
</div>

<script>
let evtSource = null;
const apis = {};  // key -> full api data

function startCrawl() {
  const url = document.getElementById('url').value.trim();
  if (!url) return;
  document.getElementById('btnStart').disabled = true;
  document.getElementById('btnStop').disabled = false;
  document.getElementById('statStatus').textContent = 'Running';
  document.getElementById('apiList').innerHTML = '';
  document.getElementById('apiEmpty').style.display = 'block';
  document.getElementById('detailPanel').innerHTML = '<div class="empty">Select an API from the list</div>';
  Object.keys(apis).forEach(k => delete apis[k]);

  // SSE
  if (evtSource) evtSource.close();
  evtSource = new EventSource('/api/stream');
  evtSource.addEventListener('page_visit', e => {
    const d = JSON.parse(e.data);
    document.getElementById('statPages').textContent = d.visited;
    document.getElementById('statQueued').textContent = d.queued;
    document.getElementById('statApis').textContent = d.api_count;
    document.getElementById('progress').style.width = (d.visited / d.max_pages * 100) + '%';
    addLog('visit', `${d.url}`);
  });
  evtSource.addEventListener('api_found', e => {
    const d = JSON.parse(e.data);
    document.getElementById('apiEmpty').style.display = 'none';
    apis[d.key] = d;
    addApiRow(d);
    addLog('api', `${d.method} ${d.path}`);
    document.getElementById('apiCount').textContent = Object.keys(apis).length + ' endpoints';
    document.getElementById('statApis').textContent = Object.keys(apis).length;
  });
  evtSource.addEventListener('api_updated', e => {
    const d = JSON.parse(e.data);
    if (apis[d.key]) {
      apis[d.key].status_code = d.status_code;
      apis[d.key].call_count = d.call_count;
      updateApiRow(d.key);
    }
  });
  evtSource.addEventListener('page_error', e => {
    const d = JSON.parse(e.data);
    addLog('error', d.error.substring(0, 100));
  });
  evtSource.addEventListener('done', e => {
    const d = JSON.parse(e.data);
    document.getElementById('statStatus').textContent = 'Done';
    document.getElementById('progress').style.width = '100%';
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStop').disabled = true;
    addLog('done', `Complete: ${d.pages_visited} pages, ${d.api_count} APIs`);
    evtSource.close();
    // fetch full results
    fetch('/api/results').then(r=>r.json()).then(data => {
      data.apis.forEach(a => { apis[a.key] = a; updateApiRow(a.key); });
    });
  });
  evtSource.addEventListener('status', e => {
    const d = JSON.parse(e.data);
    addLog('visit', d.msg);
  });

  fetch('/api/start', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ url, max_pages: document.getElementById('maxPages').value, wait_sec: document.getElementById('waitSec').value })
  });
}

function stopCrawl() {
  fetch('/api/stop', {method:'POST'});
  document.getElementById('statStatus').textContent = 'Stopped';
  document.getElementById('btnStart').disabled = false;
  document.getElementById('btnStop').disabled = true;
  if (evtSource) evtSource.close();
}

function addApiRow(api) {
  const tr = document.createElement('tr');
  tr.className = 'api-row';
  tr.id = 'row-' + css(api.key);
  tr.onclick = () => selectApi(api.key);
  tr.innerHTML = `
    <td><span class="method ${api.method}">${api.method}</span></td>
    <td title="${api.base_url}${api.path}">${api.path}</td>
    <td class="status s${String(api.status_code||'?')[0]}">${api.status_code||'...'}</td>
    <td>${api.call_count||1}</td>`;
  document.getElementById('apiList').appendChild(tr);
}

function updateApiRow(key) {
  const api = apis[key];
  const tr = document.getElementById('row-' + css(key));
  if (!tr || !api) return;
  const tds = tr.querySelectorAll('td');
  tds[2].className = 'status s' + String(api.status_code||'?')[0];
  tds[2].textContent = api.status_code || '...';
  tds[3].textContent = api.call_count || 1;
}

function selectApi(key) {
  document.querySelectorAll('.api-row').forEach(r => r.classList.remove('selected'));
  const row = document.getElementById('row-' + css(key));
  if (row) row.classList.add('selected');

  const api = apis[key];
  const panel = document.getElementById('detailPanel');
  if (!api) { panel.innerHTML = '<div class="empty">No data</div>'; return; }

  const sizeStr = api.size ? formatSize(api.size) : '';
  let html = `<h3><span class="method ${api.method}">${api.method}</span> ${esc(api.path)}`;
  if (sizeStr) html += `<span class="size-badge">${sizeStr}</span>`;
  html += `</h3>`;

  // Tabs
  html += `<div class="tabs">
    <button class="tab active" onclick="switchTab(this,'tab-headers')">Headers</button>
    <button class="tab" onclick="switchTab(this,'tab-payload')">Payload</button>
    <button class="tab" onclick="switchTab(this,'tab-response')">Response</button>
    <button class="tab" onclick="switchTab(this,'tab-timing')">Timing</button>
    <button class="tab" onclick="switchTab(this,'tab-cookies')">Cookies</button>
  </div>`;

  // ── Headers Tab ──
  html += `<div class="tab-content active" id="tab-headers">`;
  html += `<div class="header-group"><h5>General</h5><table class="param-table">
    <tr><td>Request URL</td><td>${esc(api.full_url || api.base_url + api.path)}</td></tr>
    <tr><td>Method</td><td>${api.method}</td></tr>
    <tr><td>Status</td><td class="status s${String(api.status_code||'?')[0]}">${api.status_code||'?'} ${esc(api.status_text||'')}</td></tr>
    <tr><td>Calls</td><td>${api.call_count||'?'}</td></tr>
  </table></div>`;

  if (api.response_headers && Object.keys(api.response_headers).length) {
    html += `<div class="header-group"><h5>Response Headers (${Object.keys(api.response_headers).length})</h5><table class="param-table">`;
    for (const [k,v] of Object.entries(api.response_headers)) {
      html += `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`;
    }
    html += '</table></div>';
  }

  if (api.request_headers && Object.keys(api.request_headers).length) {
    html += `<div class="header-group"><h5>Request Headers (${Object.keys(api.request_headers).length})</h5><table class="param-table">`;
    for (const [k,v] of Object.entries(api.request_headers)) {
      html += `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`;
    }
    html += '</table></div>';
  }
  html += `</div>`;

  // ── Payload Tab ──
  html += `<div class="tab-content" id="tab-payload">`;
  if (api.query_params && Object.keys(api.query_params).length) {
    html += `<div class="detail-section"><h4>Query String Parameters</h4><table class="param-table">`;
    for (const [k,v] of Object.entries(api.query_params)) {
      html += `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`;
    }
    html += '</table></div>';
  }
  if (api.request_body) {
    html += `<div class="detail-section"><h4>Request Body</h4><pre>${esc(JSON.stringify(api.request_body, null, 2))}</pre></div>`;
  }
  if (!api.request_body && (!api.query_params || !Object.keys(api.query_params).length)) {
    html += '<div class="empty" style="padding:20px;">No payload</div>';
  }
  html += `</div>`;

  // ── Response Tab ──
  html += `<div class="tab-content" id="tab-response">`;
  if (api.response_body) {
    html += `<pre>${esc(JSON.stringify(api.response_body, null, 2))}</pre>`;
  } else {
    html += '<div class="empty" style="padding:20px;">No response body captured</div>';
  }
  html += `</div>`;

  // ── Timing Tab ──
  html += `<div class="tab-content" id="tab-timing">`;
  if (api.timing) {
    const t = api.timing;
    const max = Math.max(t.total || 1, 1);
    const bars = [
      {label:'DNS Lookup', val:t.dns, cls:'dns'},
      {label:'Connection', val:t.connect, cls:'connect'},
      {label:'TTFB (Waiting)', val:t.ttfb, cls:'ttfb'},
      {label:'Download', val:t.download, cls:'download'},
    ];
    bars.forEach(b => {
      const pct = Math.max((b.val / max) * 100, 1);
      html += `<div class="timing-bar-wrap">
        <div class="timing-bar-label"><span>${b.label}</span><span>${b.val} ms</span></div>
        <div class="timing-bar"><div class="timing-bar-fill ${b.cls}" style="width:${pct}%"></div></div>
      </div>`;
    });
    html += `<div style="margin-top:12px;font-size:12px;color:var(--dim);">Total: <strong style="color:var(--text);">${t.total} ms</strong></div>`;
  } else {
    html += '<div class="empty" style="padding:20px;">No timing data</div>';
  }
  html += `</div>`;

  // ── Cookies Tab ──
  html += `<div class="tab-content" id="tab-cookies">`;
  if (api.cookies && api.cookies.length) {
    html += `<table class="cookie-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>`;
    api.cookies.forEach(c => {
      html += `<tr><td>${esc(c.name)}</td><td>${esc(c.value)}</td></tr>`;
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="empty" style="padding:20px;">No cookies</div>';
  }
  html += `</div>`;

  panel.innerHTML = html;
}

function switchTab(btn, tabId) {
  const panel = btn.closest('.detail');
  panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  panel.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

function addLog(type, msg) {
  const panel = document.getElementById('logPanel');
  const now = new Date().toLocaleTimeString('ko', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const div = document.createElement('div');
  div.className = 'log-item';
  div.innerHTML = `<span class="log-time">${now}</span><span class="log-tag ${type}">${type.toUpperCase()}</span><span>${esc(msg)}</span>`;
  panel.prepend(div);
  if (panel.children.length > 200) panel.lastChild.remove();
}

function clearLog() { document.getElementById('logPanel').innerHTML = ''; }
function css(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }
function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
</script>
</body>
</html>
"""

if __name__ == "__main__":
    print("API Discovery Dashboard: http://localhost:5001")
    app.run(port=5001, debug=False, threaded=True)

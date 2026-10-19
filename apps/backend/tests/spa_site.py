"""나라장터(WebSquare)처럼 동작하는 시험용 공개 사이트. 이음의 자동 탐색이 실제 사이트에서 부딪힌 것들을 그대로 재현한다.

- 로그인 화면이 없고, 첫 방문이 SSO 처럼 리다이렉트를 거치며 세션 쿠키를 준다. 쿠키 없이 API 를 부르면 403 이다.
- 화면은 DOMContentLoaded 한참 뒤(여기서는 1.8초)에 자바스크립트가 만든다. 그 전에는 눌러볼 것이 하나도 없다.
- 시작하자마자 모달 팝업 3개가 뜨고 메뉴를 가린다(role=dialog, aria-modal). 닫기 버튼으로 닫는다.
- 메뉴는 `href="javascript:void(null)"` 인 앵커이고, 하위 메뉴는 숨어 있다가 상위를 눌러야 보인다. 말단을 누르면 **주소는 그대로** 화면만 바뀐다.
- 조회도 전부 POST 다(`selectXxxList.do`, JSON 본문 `{"dlSrch": {...}}`). `menu-info` 헤더가 없으면 403 이다.
- 이름은 조회가 아닌데 `get` 을 품은 쓰기(`budgetSave.do`), select 로 시작하지만 갱신하는 것(`selectAndUpdateRow.do`), 쓰기 `insertBid.do` 가 있다.
- 응답이 비어 있으면(막힌 경우) 화면이 "안내 메시지" 모달을 띄운다.

`serve()` 는 (주소, 서버가 받은 요청 기록) 을 돌려준다. 기록의 항목은 {method, path, cookie, menu}.
"""
import contextlib
import json
import threading
import time

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

# (메뉴 번호, 이름, 하위)
MENU = [
    ("10", "발주", [("1010", "발주목록", [])]),
    ("20", "입찰", [("2010", "입찰공고", [("201010", "입찰공고목록", []), ("201020", "연기공고목록", [])]),
                  ("2020", "입찰진행", [("202010", "입찰진행참가", [])])]),
    ("30", "관리", [("3010", "삭제내역", [])]),
]
LEAVES = ["발주목록", "입찰공고목록", "연기공고목록", "입찰진행참가", "삭제내역"]
BOOT_MS = 1800
SESSION = "S-4f1c"

SHELL = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>조달시스템</title><style>
body{font:14px sans-serif;margin:0}
.gnb-top{padding:6px 12px;background:#eef}.gnb-top a{margin-right:14px;cursor:pointer;color:#225;text-decoration:none}
ul.menu-generator,ul.menu-generator ul{list-style:none;margin:0;padding:0}
ul.menu-generator>li{display:inline-block;margin-right:24px;position:relative;vertical-align:top}
ul.menu-generator li>ul{display:none;position:absolute;left:0;top:26px;background:#fff;border:1px solid #bbb;min-width:170px;z-index:50}
ul.menu-generator li.open>ul{display:block}
ul.menu-generator li li>ul{left:170px;top:0}
ul.menu-generator a{display:block;padding:4px 10px;cursor:pointer;color:#222;text-decoration:none;white-space:nowrap}
#content{padding:16px;min-height:300px}
.modal{position:fixed;left:140px;width:520px;height:230px;z-index:6010;background:#fff;border:2px solid #446;box-shadow:0 4px 20px #0006;padding:12px}
table{border-collapse:collapse}td,th{border:1px solid #aaa;padding:2px 8px}
</style></head><body><div id="app">불러오는 중입니다.</div><script>
var MENU = __MENU__;
var API = {"발주목록": "selectOderReqList", "입찰공고목록": "selectBidPblancList", "연기공고목록": "selectBidDeferList", "입찰진행참가": "selectBidPrgrsList", "삭제내역": "selectDelHistList"};
fetch('/websquare/suffix.txt').then(function (r) { return r.text(); });
function post(url, body, menu) {
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json;charset=UTF-8', 'Accept': 'application/json', 'menu-info': encodeURIComponent(JSON.stringify(menu || {menuNo: '0'})), 'submissionid': 'sbm_' + url.split('/').pop()}, body: JSON.stringify(body)})
    .then(function (r) { return r.json(); })
    .then(function (j) { if (!j.ErrorMsg) { notice('서버 응답이 올바르지 않습니다.'); } return j; })
    .catch(function () { notice('서버와 통신하지 못했습니다.'); return {}; });
}
function notice(msg) {
  var d = document.createElement('div'); d.className = 'modal'; d.style.top = '300px'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  d.innerHTML = '<h2>안내 메시지</h2><p>' + msg + '</p><p><input type="button" class="ok" value="확인"></p>';
  d.querySelector('.ok').onclick = function () { d.remove(); };
  document.body.appendChild(d);
}
function popup(i) {
  var d = document.createElement('div'); d.className = 'modal'; d.style.top = (60 + i * 8) + 'px'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  d.innerHTML = '<h2>공지사항 ' + i + '</h2><p>시스템 점검 안내입니다.</p><p><input type="button" class="close" value="닫기"> <button class="w2window_close" title="창닫기">창닫기</button></p>';
  d.querySelector('.close').onclick = function () { d.remove(); };
  d.querySelector('.w2window_close').onclick = function () { d.remove(); };
  document.body.appendChild(d);
}
function renderMenu(list, depth) {
  return list.map(function (m) {
    var kids = m[2].length ? '<ul>' + renderMenu(m[2], depth + 1) + '</ul>' : '';
    return '<li class="depth' + depth + '-wrap"><a href="javascript:void(null);" class="btn depth' + depth + '" data-menu="' + m[0] + '">' + m[1] + '</a>' + kids + '</li>';
  }).join('');
}
function closeMenus(except) { document.querySelectorAll('.menu-generator li.open').forEach(function (l) { if (!except || !l.contains(except)) { l.classList.remove('open'); } }); }
function onMenu(e) {
  var a = e.currentTarget, li = a.parentElement, kids = li.querySelector(':scope > ul');
  if (kids) { var was = li.classList.contains('open'); closeMenus(li); li.classList.toggle('open', !was); return; }
  closeMenus(); openScreen(a.dataset.menu, a.textContent);
}
function openScreen(no, name) {
  var c = document.getElementById('content');
  c.innerHTML = '<h3 class="tit">' + name + '</h3><div class="tool"><input type="button" class="btnSearch" value="조회"> <input type="button" class="btnReset" value="초기화"> '
    + '<input type="button" class="btnBudget" value="예산 반영"> <input type="button" class="btnSel" value="선택 갱신"> <input type="button" class="btnNew" value="공고 신규"></div>'
    + '<table class="list"><tbody><tr><td>불러오는 중</td></tr></tbody></table>';
  var fn = API[name] || 'selectCommonList';
  var load = function () {
    return post('/api/m' + no + '/' + fn + '.do', {dlSrch: {srchTy: '0001', bizNm: '', fromYmd: '20260912', page: 1, flag: true}}, {menuNo: no, scrnNm: name}).then(function (j) {
      var rows = (j.dlRows || []).map(function (r) { return '<tr><td>' + r.no + '</td><td>' + r.title + '</td></tr>'; }).join('');
      c.querySelector('table.list tbody').innerHTML = rows || '<tr><td>데이터가 없음</td></tr>';
    });
  };
  c.querySelector('.btnSearch').onclick = load;
  c.querySelector('.btnReset').onclick = function () { c.querySelector('table.list tbody').innerHTML = ''; };
  c.querySelector('.btnBudget').onclick = function () { post('/api/budget/budgetSave.do', {amount: 1}, {menuNo: no}); };
  c.querySelector('.btnSel').onclick = function () { post('/api/misc/selectAndUpdateRow.do', {id: 1}, {menuNo: no}); };
  c.querySelector('.btnNew').onclick = function () { post('/api/bid/insertBid.do', {title: 'x'}, {menuNo: no}); };
  load();
}
function boot() {
  document.getElementById('app').innerHTML = '<div class="gnb-top"><a class="btn login" href="javascript:void(0);">로그인</a><a class="btn" href="javascript:void(0);">인증센터</a></div>'
    + '<nav class="gnb-menu"><ul class="menu-generator">' + renderMenu(MENU, 1) + '</ul></nav>'
    + '<div id="content"><h3 class="tit">조달시스템 메인</h3><ul class="notice"><li><a class="subject">시스템 점검 공지</a></li></ul></div>';
  document.querySelectorAll('.menu-generator a').forEach(function (a) { a.addEventListener('click', onMenu); });
  document.querySelector('.subject').addEventListener('click', function () { notice('공지 내용입니다.'); });
  [1, 2, 3].forEach(popup);
  post('/fs/fsc/fsca/fileUpload.do', {init: 1});
  post('/co/coz/coza/util/getSession.do', {});
  post('/fm/fma/fmaa/Pst/selectNtcPstList.do', {dlNtc: {pageNo: 1}});
}
setTimeout(boot, __BOOT__);
</script></body></html>"""


def make_app(hits: list) -> FastAPI:
    app = FastAPI()

    def record(request: Request, **extra):
        hits.append(dict(method=request.method, path=request.url.path, cookie=request.cookies.get("SESS") == SESSION, menu=bool(request.headers.get("menu-info")), **extra))

    @app.get("/")
    async def root(request: Request):
        record(request)
        return RedirectResponse("/sso/auth?state=abc", status_code=302)

    @app.get("/sso/auth")
    async def sso(request: Request):
        record(request)
        return RedirectResponse("/app?bodyDataKey=k1", status_code=302)

    @app.get("/app")
    async def shell(request: Request):
        record(request)
        html = SHELL.replace("__MENU__", json.dumps(MENU, ensure_ascii=False)).replace("__BOOT__", str(BOOT_MS))
        r = HTMLResponse(html)
        r.set_cookie("SESS", SESSION, path="/")
        return r

    @app.get("/websquare/suffix.txt")
    async def suffix(request: Request):
        record(request)
        return JSONResponse({"ok": 1})

    @app.post("/{path:path}")
    async def post(path: str, request: Request):
        record(request)
        name = path.rsplit("/", 1)[-1]
        if not path.startswith("fs/") and (request.cookies.get("SESS") != SESSION or not request.headers.get("menu-info")) and name.startswith("select"):
            return JSONResponse({"reason": "Forbidden", "ErrorMsg": "접근 권한이 존재하지 않습니다.", "ErrorCode": -801, "path": "/" + path}, status_code=403)
        if name.startswith("select") and not name.startswith("selectAndUpdate"):
            if name == "selectNtcPstList.do":
                return JSONResponse({"ErrorMsg": "정상적으로 조회되었습니다.", "dlNtc": [{"no": 1, "title": "시스템 점검 공지"}]})
            rows = [{"no": str(i), "title": "%s %d" % (path.split("/")[1], i)} for i in range(1, 4)]
            return JSONResponse({"ErrorMsg": "정상적으로 조회되었습니다.", "dlRows": rows})
        if name == "getSession.do":
            return JSONResponse({"ErrorMsg": "정상적으로 조회되었습니다.", "usrId": None})
        return JSONResponse({"ErrorMsg": "정상적으로 처리되었습니다."})                     # 쓰기든 아니든, 닿았다는 기록은 hits 에 남는다

    return app


@contextlib.contextmanager
def serve():
    hits: list = []
    server = uvicorn.Server(uvicorn.Config(make_app(hits), host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.02)
    try:
        yield f"http://localhost:{server.servers[0].sockets[0].getsockname()[1]}", hits
    finally:
        server.should_exit = True
        thread.join(timeout=5)

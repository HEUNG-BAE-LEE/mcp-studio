"""시연용 레거시 구매관리 사이트의 CSS 와 화면 스크립트.

레거시 화면답게 외부 파일 없이 모든 페이지에 `<style>` 과 `<script>` 로 직접 들어간다.
화면 스크립트는 같은 출처 요청에 `X-Requested-With: XMLHttpRequest` 를 붙여(jQuery.ajax 흉내)
상대 경로로 JSON 엔드포인트를 부르고, 응답으로 DOM 을 그린다. 서버는 이 헤더가 없으면 400 을 낸다.
"""

CSS = r"""
* { box-sizing: border-box; }
body { margin: 0; background: #ececec; color: #333; font: 12px/1.6 "Malgun Gothic", "맑은 고딕", Dotum, "돋움", sans-serif; }
a { color: #1a4f8a; }
#topbar { background: #4d4d4d; color: #fff; padding: 9px 20px; overflow: hidden; border-bottom: 3px solid #2f2f2f; }
#topbar.stg { background: #7b5a2b; border-bottom-color: #4d3718; }
#topbar .sysnm { float: left; font-size: 16px; font-weight: bold; letter-spacing: -0.5px; }
#topbar .user { float: right; }
#topbar .user a { color: #ffe9a8; margin-left: 12px; }
#menu { background: #d6d6d6; border-bottom: 1px solid #9a9a9a; padding: 0 20px; }
#menu a { display: inline-block; padding: 7px 16px; color: #222; text-decoration: none; border-right: 1px solid #b5b5b5; }
#menu a:hover { background: #e8e8e8; }
#wrap { width: 980px; max-width: 100%; margin: 14px auto; padding: 16px 20px 28px; background: #fff; border: 1px solid #b0b0b0; min-height: 440px; }
h2 { margin: 0 0 14px; padding: 0 0 5px; font-size: 15px; border-bottom: 2px solid #666; }
h3 { margin: 18px 0 6px; font-size: 13px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #a0a0a0; padding: 4px 8px; text-align: left; }
th { background: #e4e4e4; font-weight: bold; }
table.form { width: auto; }
table.form th { width: 90px; }
table.kv { margin-bottom: 8px; }
table.kv th { width: 90px; }
table.list tbody tr:hover { background: #f1f6fb; }
td.c { text-align: center; color: #777; }
td.r { text-align: right; }
input, select, textarea { border: 1px solid #8f8f8f; padding: 2px 5px; font: inherit; background: #fff; }
input[readonly] { background: #f0f0f0; }
#fromDt, #toDt { width: 84px; }
#qty { width: 60px; text-align: right; }
textarea { width: 460px; height: 90px; }
button, a.btn { display: inline-block; padding: 3px 14px; border: 1px solid #7d7d7d; background: linear-gradient(#f4f4f4, #d9d9d9); color: #222; font: inherit; text-decoration: none; cursor: pointer; }
button:hover, a.btn:hover { background: #e9e9e9; }
.box { border: 1px solid #bdbdbd; background: #f5f5f5; padding: 9px 12px; margin-bottom: 10px; }
.box b { display: inline-block; margin-bottom: 4px; }
.box table { margin: 4px 0 6px; }
.err { color: #c00000; min-height: 18px; }
.ok { color: #1c6b1c; min-height: 18px; }
.info { color: #555; margin: 6px 0; }
.who { margin: 0 0 8px; color: #555; }
.vendPick { margin-right: 12px; }
.chartbox { border: 1px solid #bdbdbd; padding: 10px 14px 6px; background: #fafafa; }
.bars { display: flex; align-items: flex-end; height: 150px; }
.col { flex: 1; text-align: center; }
.col .bar { margin: 0 auto; width: 26px; background: #6f8fb0; border: 1px solid #4b6a8a; }
.col .n { display: block; font-size: 11px; color: #444; }
.col .m { display: block; margin-top: 2px; border-top: 1px solid #999; font-size: 11px; color: #666; }
.tag { display: inline-block; margin-right: 4px; padding: 0 7px; border: 1px solid #aaa; background: #f0f0f0; }
.notice { margin: 4px 0 0; padding-left: 18px; }
#loginForm { text-align: center; }
#loginForm th, #loginForm td { text-align: left; }
table.login { margin: 30px auto 14px; }
"""

# 모든 로그인 후 화면이 함께 싣는 공통 스크립트
COMMON_JS = r"""
var XHR_HEADERS = {'X-Requested-With': 'XMLHttpRequest'};

function $id(id) { return document.getElementById(id); }
function enc(v) { return encodeURIComponent(v); }
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
  });
}
function fmtDate(v) {
  return /^\d{8}$/.test(v) ? v.substring(0, 4) + '-' + v.substring(4, 6) + '-' + v.substring(6) : v;
}

// jQuery.ajax 흉내. 같은 출처 요청에 X-Requested-With 를 붙이고 JSON 으로 읽는다.
// 세션이 끊겨 로그인 화면(HTML)이 돌아오면 JSON 이 아니므로 오류로 돌린다.
function ajax(url, opt) {
  opt = opt || {};
  var headers = {};
  Object.keys(XHR_HEADERS).forEach(function (k) { headers[k] = XHR_HEADERS[k]; });
  Object.keys(opt.headers || {}).forEach(function (k) { headers[k] = opt.headers[k]; });
  opt.headers = headers;
  return fetch(url, opt).then(function (res) {
    return res.text().then(function (text) {
      var json;
      try { json = JSON.parse(text); } catch (e) { throw new Error('세션이 만료되었거나 서버 응답이 올바르지 않습니다. 다시 로그인해 주세요.'); }
      if (!res.ok) { throw new Error(json.MSG || '요청을 처리하지 못했습니다.'); }
      return json;
    });
  });
}
function getJSON(url) { return ajax(url); }
function postForm(url, fields) {
  var body = Object.keys(fields).map(function (k) { return enc(k) + '=' + enc(fields[k]); }).join('&');
  return ajax(url, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}, body: body});
}

function showMsg(e) { var m = $id('msg'); if (m) { m.className = 'err'; m.textContent = (e && e.message) || String(e); } }
function showOk(html) { var m = $id('msg'); if (m) { m.className = 'ok'; m.innerHTML = html; } }
function clearMsg() { var m = $id('msg'); if (m) { m.className = 'err'; m.textContent = ''; } }

// 월별 발주 막대 그래프. list 는 chart/monthly.do 의 resultList.
function drawMonthly(list, boxId) {
  var max = 1, html = '<div class="bars">';
  list.forEach(function (r) { max = Math.max(max, parseInt(r.CNT, 10) || 0); });
  list.forEach(function (r) {
    var n = parseInt(r.CNT, 10) || 0;
    html += '<div class="col"><span class="n">' + n + '</span><div class="bar" style="height:' + Math.round(n / max * 110) + 'px"></div>'
          + '<span class="m">' + parseInt(r.MM, 10) + '월</span></div>';
  });
  $id(boxId).innerHTML = html + '</div>';
}
"""

# 메인: 월별 현황, 발주 상태 코드, 그리고 다른 출처의 SSO 접속자 정보.
# OTHER 는 서버가 요청 호스트를 보고 정해 앞에 붙인다.
MAIN_JS = r"""
getJSON('chart/monthly.do?yyyy=2026').then(function (d) { drawMonthly(d.resultList, 'chart'); }).catch(showMsg);

getJSON('common/codeList.do?grpCd=PO_STTS').then(function (d) {
  $id('legend').innerHTML = '발주 상태: ' + d.resultList.map(function (c) {
    return '<span class="tag">' + esc(c.CD) + ' ' + esc(c.CD_NM) + '</span>';
  }).join(' ');
}).catch(showMsg);

// 사내 SSO 는 다른 출처에 있다. 헤더를 더하면 사전 요청(preflight)이 필요해지므로 단순 요청으로 보낸다.
fetch(OTHER + '/demo-legacy/sso/userInfo.do').then(function (res) { return res.json(); }).then(function (u) {
  $id('who').textContent = '접속자: ' + u.userNm + ' (' + u.deptNm + ')';
}).catch(function () { $id('who').textContent = '접속자 정보를 불러오지 못했습니다.'; });
"""

# 발주 현황: 로드 직후에는 요청을 보내지 않는다. [조회] 를 눌러야 목록을 부른다.
PO_LIST_JS = r"""
var STTS = {'10': '작성', '20': '승인대기', '30': '승인', '90': '취소'};
function digits(v) { return String(v).replace(/\D/g, ''); }

function search() {
  clearMsg();
  var url = 'poList.do?fromDt=' + enc(digits($id('fromDt').value)) + '&toDt=' + enc(digits($id('toDt').value))
          + '&vendCd=' + enc($id('vendCd').value) + '&sttsCd=' + enc($id('sttsCd').value);
  getJSON(url).then(function (d) {
    var rows = d.resultList.map(function (r) {
      return '<tr onclick="openDetail(\'' + esc(r.PO_NO) + '\')" style="cursor:pointer"><td>' + esc(r.PO_NO) + '</td><td>' + esc(r.VEND_NM)
           + '</td><td class="r">' + esc(r.PO_AMT) + '</td><td>' + esc(STTS[r.PO_STTS_CD] || r.PO_STTS_CD) + '</td><td>' + esc(fmtDate(r.PO_YMD))
           + '</td><td>' + esc(r.CHARGER_NM) + '</td></tr>';
    });
    $id('poTable').tBodies[0].innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" class="c">조회된 발주가 없습니다.</td></tr>';
    $id('cnt').textContent = '총 ' + d.totalCnt + '건';
  }).catch(showMsg);
}

function openDetail(poNo) {
  clearMsg();
  getJSON('poDetail.do?poNo=' + enc(poNo)).then(function (d) {
    var po = d.po;
    var items = po.ITEMS.map(function (it) {
      return '<tr><td>' + esc(it.ITEM_CD) + '</td><td>' + esc(it.ITEM_NM) + '</td><td class="r">' + esc(it.QTY) + '</td><td class="r">' + esc(it.UNIT_PRICE) + '</td></tr>';
    }).join('');
    $id('poDetail').innerHTML = '<h3>발주 상세 ' + esc(po.PO_NO) + '</h3>'
      + '<table class="kv"><tr><th>거래처</th><td>' + esc(po.VEND_NM) + ' (' + esc(po.VEND_CD) + ')</td><th>발주일</th><td>' + esc(fmtDate(po.PO_YMD)) + '</td></tr>'
      + '<tr><th>담당자</th><td>' + esc(po.CHARGER_NM) + '</td><th>연락처</th><td>' + esc(po.CHARGER_TEL) + '</td></tr>'
      + '<tr><th>이메일</th><td>' + esc(po.CHARGER_EML) + '</td><th>결제조건</th><td id="payTermNm">' + esc(po.PAY_TERM) + '</td></tr>'
      + '<tr><th>발주금액</th><td>' + esc(po.PO_AMT) + '원</td><th>상태</th><td>' + esc(STTS[po.PO_STTS_CD] || po.PO_STTS_CD) + '</td></tr></table>'
      + '<table class="list"><thead><tr><th>품목코드</th><th>품목명</th><th>수량</th><th>단가</th></tr></thead><tbody>' + items + '</tbody></table>';
    // 결제조건 코드를 이름으로 바꾸려고 공통코드를 부른다.
    return getJSON('common/codeList.do?grpCd=PAY_TERM').then(function (c) {
      c.resultList.forEach(function (x) { if (x.CD === po.PAY_TERM) { $id('payTermNm').textContent = x.CD_NM; } });
    });
  }).catch(showMsg);
}

$id('btnSearch').onclick = search;
$id('btnReset').onclick = function () {
  $id('fromDt').value = '20260901';
  $id('toDt').value = '20260930';
  $id('sttsCd').value = '';
  $id('poTable').tBodies[0].innerHTML = '<tr><td colspan="6" class="c">조회 조건을 입력하고 [조회] 버튼을 누르세요.</td></tr>';
  $id('cnt').textContent = '';
  $id('poDetail').innerHTML = '';
  clearMsg();
};
"""

# 발주 등록: 거래처 찾기, 품목 선택(단가 조회), 저장
PO_REG_JS = r"""
var picked = {vendCd: '', itemCd: ''};

function setVend(cd, nm) { picked.vendCd = cd; $id('vendSel').textContent = nm + ' (' + cd + ')'; }

$id('btnVend').onclick = function () {
  clearMsg();
  getJSON('vendList.do?vendNm=' + enc($id('vendNm').value)).then(function (d) {
    $id('vendResult').innerHTML = d.resultList.length ? d.resultList.map(function (v) {
      return '<a href="#" class="vendPick" data-cd="' + esc(v.VEND_CD) + '" data-nm="' + esc(v.VEND_NM) + '">' + esc(v.VEND_NM) + ' (' + esc(v.VEND_CD) + ')</a>';
    }).join('') : '검색 결과가 없습니다.';
  }).catch(showMsg);
};

$id('vendResult').onclick = function (ev) {
  var a = ev.target;
  if (a && a.className === 'vendPick') {
    setVend(a.getAttribute('data-cd'), a.getAttribute('data-nm'));
    ev.preventDefault();
  }
};

// 품목 표의 각 행은 품목코드와 주거래처를 data- 속성으로 갖고 있다.
Array.prototype.forEach.call(document.querySelectorAll('.pick'), function (btn) {
  btn.onclick = function () {
    clearMsg();
    var tr = btn.parentNode.parentNode;
    var itemCd = tr.getAttribute('data-item-cd'), vendCd = tr.getAttribute('data-vend-cd');
    getJSON('itemPrice.do?itemCd=' + enc(itemCd) + '&vendCd=' + enc(vendCd)).then(function (d) {
      picked.itemCd = d.ITEM_CD;
      $id('itemSel').textContent = d.ITEM_NM + ' (' + d.ITEM_CD + ')';
      $id('unitPrice').value = d.UNIT_PRICE;
      if (!picked.vendCd) { setVend(vendCd, tr.getAttribute('data-vend-nm')); }
    }).catch(showMsg);
  };
});

$id('btnSave').onclick = function () {
  clearMsg();
  if (!picked.vendCd || !picked.itemCd) { showMsg(new Error('거래처와 품목을 선택해 주세요.')); return; }
  postForm('poSave.do', {vendCd: picked.vendCd, itemCd: picked.itemCd, qty: $id('qty').value, unitPrice: $id('unitPrice').value, payTerm: $id('payTerm').value}).then(function (d) {
    showOk('발주를 등록했습니다. 발주번호 ' + esc(d.PO_NO));
  }).catch(showMsg);
};
"""

# 구매요청함: 로드할 때 목록과 상태 코드를 함께 부른다.
PR_LIST_JS = r"""
Promise.all([getJSON('prList.do?deptCd=D1030&sttsCd=10'), getJSON('common/codeList.do?grpCd=PR_STTS')]).then(function (res) {
  var names = {};
  res[1].resultList.forEach(function (c) { names[c.CD] = c.CD_NM; });
  var rows = res[0].resultList.map(function (r) {
    return '<tr><td>' + esc(r.PR_NO) + '</td><td>' + esc(r.PR_TITLE) + '</td><td>' + esc(r.REQ_NM) + '</td><td>' + esc(names[r.PR_STTS_CD] || r.PR_STTS_CD) + '</td></tr>';
  });
  $id('prTable').tBodies[0].innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4" class="c">조회된 구매요청이 없습니다.</td></tr>';
}).catch(showMsg);
"""

# 구매요청 작성: 예산 확인, 자동 임시저장(로드 1.5초 뒤부터 3초마다), 전송
PR_REG_JS = r"""
var submitted = false;

$id('btnBudget').onclick = function () {
  clearMsg();
  getJSON('budgetRemain.do?deptCd=D1030&yyyy=2026').then(function (d) {
    $id('budget').textContent = d.YYYY + '년 예산 ' + d.BUDGET_AMT + '원 / 사용 ' + d.USED_AMT + '원 / 잔액 ' + d.REMAIN_AMT + '원';
  }).catch(showMsg);
};

function saveDraft() {
  if (submitted) { return; }
  postForm('prDraftSave.do', {title: $id('title').value, content: $id('content').value}).then(function (d) {
    var t = d.SAVED_AT;
    $id('draftMsg').textContent = '임시저장 ' + t.substring(8, 10) + ':' + t.substring(10, 12) + ':' + t.substring(12, 14);
  }).catch(function () { $id('draftMsg').textContent = '임시저장에 실패했습니다.'; });
}
setTimeout(function () { saveDraft(); setInterval(saveDraft, 3000); }, 1500);

$id('btnSubmit').onclick = function () {
  clearMsg();
  postForm('prSubmit.do', {prNo: $id('prNo').value, title: $id('title').value, content: $id('content').value}).then(function () {
    submitted = true;
    showOk('구매요청을 전송했습니다.');
  }).catch(showMsg);
};
"""

# 거래처 관리
VEND_LIST_JS = r"""
$id('btnVendSearch').onclick = function () {
  clearMsg();
  getJSON('vendList.do?vendNm=' + enc($id('vendNm').value)).then(function (d) {
    var rows = d.resultList.map(function (v) {
      return '<tr><td>' + esc(v.VEND_CD) + '</td><td>' + esc(v.VEND_NM) + '</td><td>' + esc(v.BIZ_NO) + '</td><td>' + esc(v.TEL) + '</td></tr>';
    });
    $id('vendTable').tBodies[0].innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4" class="c">조회된 거래처가 없습니다.</td></tr>';
  }).catch(showMsg);
};
"""

# 통계
STAT_JS = r"""
getJSON('chart/monthly.do?yyyy=2026').then(function (d) {
  drawMonthly(d.resultList, 'chart');
  $id('statTable').tBodies[0].innerHTML = d.resultList.map(function (r) {
    return '<tr><td>' + parseInt(r.MM, 10) + '월</td><td class="r">' + esc(r.CNT) + '</td></tr>';
  }).join('');
}).catch(showMsg);
"""

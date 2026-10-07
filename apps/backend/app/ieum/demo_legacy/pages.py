"""시연용 레거시 구매관리 사이트의 화면(HTML) 조립. 서버가 그리는 화면이고, 값은 JS 가 JSON 으로 채운다.

링크는 전부 상대 경로다(`main.do`). 화면은 `<마운트>/xxx.do` 에 있어 어느 마운트(운영/스테이징)에서도 그대로 풀린다.
"""
import html
import json
from typing import Dict, Optional

from app.ieum.demo_legacy import assets, data

SYSTEM_NAME = "구매관리시스템"
USER_LABEL = "구매팀 테스트계정"
MENU = [
    ("main.do", "메인"), ("poListView.do", "발주 현황"), ("poRegView.do", "발주 등록"),
    ("prListView.do", "구매요청"), ("vendListView.do", "거래처 관리"), ("statView.do", "통계"),
]
ERR_LOGIN = "아이디 또는 비밀번호가 올바르지 않습니다."


def system_name(env: str) -> str:
    return SYSTEM_NAME + ("(스테이징)" if env == "stg" else "")


def _document(env: str, title: str, top: str, body: str, script: str, active: str) -> str:
    # CSS/JS 에는 중괄호와 % 가 많아 포맷 문자열을 쓰지 않고 이어 붙인다.
    highlight = '#menu a[href="%s"] { background: #fff; font-weight: bold; }' % active if active else ""
    return "".join([
        '<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="UTF-8">\n',
        '<meta http-equiv="X-UA-Compatible" content="IE=edge">\n',
        '<link rel="icon" href="data:,">\n',  # 파비콘 요청(404)이 콘솔 오류로 남지 않게 한다
        "<title>%s - %s</title>\n<style>" % (system_name(env), title), assets.CSS, highlight, "</style>\n</head>\n<body>\n",
        top, '<div id="wrap">\n', body, "\n</div>\n",
        "<script>", script, "</script>\n</body>\n</html>\n",
    ])


def layout(env: str, title: str, body: str, script: str = "", active: str = "") -> str:
    """로그인한 사용자가 보는 공통 틀: 상단 바(시스템명, 사용자, 로그아웃), 상단 메뉴, 본문."""
    top = "".join([
        '<div id="topbar"%s><span class="sysnm">%s</span>' % (' class="stg"' if env == "stg" else "", system_name(env)),
        '<span class="user">%s <a href="logout.do">로그아웃</a></span></div>\n' % USER_LABEL,
        '<div id="menu">%s</div>\n' % " ".join('<a href="%s">%s</a>' % item for item in MENU),
    ])
    return _document(env, title, top, body, assets.COMMON_JS + script, active)


def login_page(env: str, failed: bool = False) -> str:
    """로그인 화면. 사용자 표시와 메뉴 없이 상단 바에 시스템명만 둔다."""
    top = '<div id="topbar"%s><span class="sysnm">%s</span></div>\n' % (' class="stg"' if env == "stg" else "", system_name(env))
    body = """<h2>로그인</h2>
<form id="loginForm" method="post" action="loginProc.do">
<input type="hidden" name="returnUrl" value="main.do">
<table class="form login">
<tr><th><label for="userId">아이디</label></th><td><input type="text" name="userId" id="userId"></td></tr>
<tr><th><label for="userPw">비밀번호</label></th><td><input type="password" name="userPw" id="userPw"></td></tr>
</table>
%s<p><button type="submit" id="btnLogin">로그인</button></p>
</form>""" % ('<p class="err">%s</p>\n' % ERR_LOGIN if failed else "")
    return _document(env, "로그인", top, body, "document.getElementById('userId').focus();", "")


def main_page(env: str, other_origin: str) -> str:
    """메인. `other_origin` 은 화면이 열린 주소와 '다른 출처'(SSO 서버 흉내)다."""
    body = """<h2>월별 발주 현황</h2>
<p id="who" class="who">접속자를 확인하는 중입니다.</p>
<div id="msg" class="err"></div>
<div id="chart" class="chartbox">불러오는 중입니다.</div>
<p id="legend" class="info"></p>
<h3>공지사항</h3>
<ul class="notice">
<li>[10/01] 2026년 4분기 구매 일정 안내</li>
<li>[09/28] 전자세금계산서 발행 방법 변경 안내</li>
<li>[09/15] 시스템 정기 점검 안내 (매월 둘째 주 일요일 02:00~04:00)</li>
</ul>"""
    return layout(env, "메인", body, "var OTHER = %s;\n" % json.dumps(other_origin) + assets.MAIN_JS, "main.do")


def po_list_page(env: str) -> str:
    body = """<h2>발주 현황</h2>
<div class="box">
<input type="hidden" id="vendCd" value="">
발주일 <input id="fromDt" value="20260901"> ~ <input id="toDt" value="20260930">
&nbsp; 상태 <select id="sttsCd"><option value="">전체</option><option value="10">작성</option><option value="20">승인대기</option><option value="30">승인</option><option value="90">취소</option></select>
&nbsp; <button type="button" id="btnSearch">조회</button> <button type="button" id="btnReset">초기화</button>
</div>
<div id="msg" class="err"></div>
<p id="cnt" class="info"></p>
<table id="poTable" class="list">
<thead><tr><th>발주번호</th><th>거래처</th><th>발주금액(원)</th><th>상태</th><th>발주일</th><th>담당자</th></tr></thead>
<tbody><tr><td colspan="6" class="c">조회 조건을 입력하고 [조회] 버튼을 누르세요.</td></tr></tbody>
</table>
<div id="poDetail"></div>"""
    return layout(env, "발주 현황", body, assets.PO_LIST_JS, "poListView.do")


def po_reg_page(env: str) -> str:
    rows = "\n".join(
        '<tr data-item-cd="%s" data-vend-cd="%s" data-vend-nm="%s"><td>%s</td><td>%s</td><td>%s</td>'
        '<td><button type="button" class="pick">품목 선택</button></td></tr>'
        % tuple(html.escape(v) for v in (cd, vend, data.VENDOR_BY_CD[vend][1], cd, nm, data.VENDOR_BY_CD[vend][1]))
        for cd, nm, _price, vend in data.ITEMS)
    body = """<h2>발주 등록</h2>
<div class="box">
<b>1. 거래처</b><br>
거래처명 <input id="vendNm" value="한빛"> <button type="button" id="btnVend">찾기</button>
<div id="vendResult" class="info"></div>
선택한 거래처: <span id="vendSel">-</span>
</div>
<div class="box">
<b>2. 품목</b>
<table class="list">
<thead><tr><th>품목코드</th><th>품목명</th><th>주거래처</th><th>선택</th></tr></thead>
<tbody>
%s
</tbody>
</table>
선택한 품목: <span id="itemSel">-</span>
</div>
<div class="box">
<b>3. 발주 내용</b><br>
수량 <input id="qty" value="10"> &nbsp; 단가 <input id="unitPrice" readonly> &nbsp;
결제조건 <select id="payTerm"><option value="10">현금</option><option value="30" selected>30일</option><option value="60">60일</option></select>
</div>
<div id="msg" class="err"></div>
<p><button type="button" id="btnSave">저장</button> <a href="poListView.do">취소</a></p>""" % rows
    return layout(env, "발주 등록", body, assets.PO_REG_JS, "poRegView.do")


def pr_list_page(env: str) -> str:
    body = """<h2>구매요청함</h2>
<p><a class="btn" href="prRegView.do">요청 작성</a></p>
<div id="msg" class="err"></div>
<table id="prTable" class="list">
<thead><tr><th>요청번호</th><th>제목</th><th>요청자</th><th>상태</th></tr></thead>
<tbody><tr><td colspan="4" class="c">불러오는 중입니다.</td></tr></tbody>
</table>"""
    return layout(env, "구매요청함", body, assets.PR_LIST_JS, "prListView.do")


def pr_reg_page(env: str, pr_no: str, draft: Optional[Dict[str, str]] = None) -> str:
    """구매요청 작성. 임시저장한 초안이 있으면 그 내용으로 채워서 연다."""
    draft = draft or {}
    title_attr = ' value="%s"' % html.escape(draft["title"], quote=True) if draft.get("title") else ""
    content = "\n" + html.escape(draft["content"]) if draft.get("content") else ""
    body = """<h2>구매요청 작성</h2>
<div class="box">
<table class="form">
<tr><th>요청번호</th><td><input id="prNo" value="%s" readonly></td></tr>
<tr><th><label for="title">제목</label></th><td><input id="title"%s></td></tr>
<tr><th><label for="content">내용</label></th><td><textarea id="content">%s</textarea></td></tr>
</table>
</div>
<p><button type="button" id="btnBudget">예산 확인</button> <button type="button" id="btnSubmit">요청 전송</button> <a href="prListView.do">목록</a></p>
<p id="budget" class="info"></p>
<p id="draftMsg" class="info"></p>
<div id="msg" class="err"></div>""" % (html.escape(pr_no, quote=True), title_attr, content)
    return layout(env, "구매요청 작성", body, assets.PR_REG_JS, "prListView.do")


def vend_list_page(env: str) -> str:
    body = """<h2>거래처 관리</h2>
<div class="box">거래처명 <input id="vendNm"> <button type="button" id="btnVendSearch">조회</button></div>
<div id="msg" class="err"></div>
<table id="vendTable" class="list">
<thead><tr><th>거래처코드</th><th>거래처명</th><th>사업자번호</th><th>전화</th></tr></thead>
<tbody><tr><td colspan="4" class="c">거래처명을 입력하고 [조회] 버튼을 누르세요.</td></tr></tbody>
</table>"""
    return layout(env, "거래처 관리", body, assets.VEND_LIST_JS, "vendListView.do")


def stat_page(env: str) -> str:
    body = """<h2>통계</h2>
<div id="msg" class="err"></div>
<div id="chart" class="chartbox">불러오는 중입니다.</div>
<h3>월별 발주 건수 (2026년)</h3>
<table id="statTable" class="list">
<thead><tr><th>월</th><th>발주 건수</th></tr></thead>
<tbody></tbody>
</table>"""
    return layout(env, "통계", body, assets.STAT_JS, "statView.do")

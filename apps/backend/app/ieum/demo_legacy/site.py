"""시연용 레거시 구매관리 사이트(po)의 라우터. 전자정부 프레임워크(Spring MVC) 앱처럼 동작한다.

`.do` 주소, 서버가 그리는 HTML 화면과 화면 안 JS 가 부르는 JSON 엔드포인트, 쿠키 세션(JSESSIONID),
폼 로그인. 이음의 API 자동 탐색이 탐색할 가짜 대상이다. `make_router` 가 환경 하나(운영 op /
스테이징 stg)를 새로 만들고, 상태(DB, 세션)는 그 안에 있어 두 환경이 섞이지 않는다.
"""
import re
import secrets
from datetime import datetime
from typing import Callable, Dict, Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

from app.ieum.demo_legacy import data, pages

DEMO_USER_ID = "svc_ieum_crawl"
DEMO_PASSWORD = "demo-pass"

JSON_TYPE = "application/json;charset=UTF-8"
HTML_TYPE = "text/html;charset=UTF-8"
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
# 유효한 xlsx 일 필요는 없다. zip 시그니처(PK\x03\x04)로 시작하는 작은 바이트열이면 된다.
XLSX_STUB = b"PK\x03\x04\x14\x00\x00\x00\x00\x00demo-legacy-po.xlsx"

_YMD = re.compile(r"[0-9]{8}")
_MISSING = "필수 값이 누락되었습니다."


def json_response(body: dict, status: int = 200, headers: Optional[Dict[str, str]] = None) -> JSONResponse:
    """레거시 앱처럼 `application/json;charset=UTF-8` 로 내보낸다."""
    return JSONResponse(body, status_code=status, media_type=JSON_TYPE, headers=headers)


def _ok(**fields) -> JSONResponse:
    return json_response(dict(RSLT="0000", **fields))


def _err(status: int, message: str) -> JSONResponse:
    return json_response({"RSLT": "E%d" % status, "MSG": message}, status)


async def _params(request: Request) -> Dict[str, str]:
    """쿼리 문자열과 form 본문을 한 사전으로 합친다(스프링 @RequestParam 처럼 둘 다 읽는다). 같은 이름은 첫 값."""
    found = parse_qs(request.url.query, keep_blank_values=True)
    if request.method == "POST":
        ctype = request.headers.get("content-type", "")
        if not ctype or ctype.startswith("application/x-www-form-urlencoded"):
            found.update(parse_qs((await request.body()).decode("utf-8", "replace"), keep_blank_values=True))
    return {k: v[0] for k, v in found.items()}


def other_origin(request: Request) -> str:
    """화면이 열린 주소의 '다른 출처'. 브라우저는 localhost 와 127.0.0.1 을 서로 다른 출처로 본다."""
    url = request.url
    host = "127.0.0.1" if (url.hostname or "").lower() == "localhost" else "localhost"
    try:
        port = ":%d" % url.port if url.port else ""
    except ValueError:  # Host 헤더의 포트가 숫자가 아닌 경우
        port = ""
    return "%s://%s%s" % ("https" if url.scheme == "https" else "http", host, port)


def make_router(env: str, mount: str) -> APIRouter:
    """환경 하나의 사이트를 새로 만든다.

    env: "op"(운영) | "stg"(스테이징). mount: 이 라우터가 붙을 URL 접두사("/demo-legacy/po" 같은 것).
    쿠키 Path 와 리다이렉트 주소에 쓴다. 라우터에는 prefix 를 주지 않으니 호출 측이
    `include_router(prefix=mount)` 로 붙인다. 돌려준 라우터의 `reset()` 은 상태를 초기값으로 되돌린다.
    """
    mount = mount.rstrip("/")
    db = data.LegacyDb()
    sessions = {}  # type: Dict[str, str]  # JSESSIONID -> 로그인 사용자 ID
    router = APIRouter(tags=["ieum-demo-legacy"])

    def reset() -> None:
        db.reset()
        sessions.clear()

    router.reset = reset  # type: ignore[attr-defined]

    def redirect(path: str) -> Response:
        return RedirectResponse("%s/%s" % (mount, path), status_code=302)

    def logged_in(request: Request) -> bool:
        return request.cookies.get("JSESSIONID") in sessions

    def page(path: str, render: Callable[[Request], str]) -> None:
        """로그인이 필요한 HTML 화면. 세션이 없으면 로그인 화면으로 보낸다."""
        async def endpoint(request: Request) -> Response:
            if not logged_in(request):
                return redirect("login.do")
            return HTMLResponse(render(request), media_type=HTML_TYPE)
        router.add_api_route("/" + path, endpoint, methods=["GET"], include_in_schema=False, name=path)

    def api(path: str, handler: Callable[[Dict[str, str]], Response], method: str = "GET") -> None:
        """로그인과 X-Requested-With 가 필요한 JSON 엔드포인트.

        세션이 없으면 XHR 이어도 302 로 로그인 화면을 준다(레거시 앱이 그렇다). 헤더가 없으면 WAF 가
        막는 흉내로 400 이다. 처리 중 예외는 어느 엔드포인트든 같은 500 본문으로 내보낸다.
        """
        async def endpoint(request: Request) -> Response:
            if not logged_in(request):
                return redirect("login.do")
            if request.headers.get("x-requested-with", "").lower() != "xmlhttprequest":
                return _err(400, "비정상 요청입니다.")
            try:
                return handler(await _params(request))
            except Exception:  # 공통 예외 처리기 흉내. 원인은 감춘다.
                return _err(500, "처리 중 오류가 발생했습니다.")
        router.add_api_route("/" + path, endpoint, methods=[method], include_in_schema=False, name=path)

    # ------------------------------------------------------------ 로그인
    @router.get("/", include_in_schema=False)
    async def index() -> Response:
        return redirect("main.do")

    @router.get("/login.do", include_in_schema=False)
    async def login_view(request: Request) -> Response:
        if logged_in(request):
            return redirect("main.do")
        failed = request.query_params.get("err") == "1"
        return HTMLResponse(pages.login_page(env, failed), media_type=HTML_TYPE)

    @router.post("/loginProc.do", include_in_schema=False)
    async def login_proc(request: Request) -> Response:
        p = await _params(request)
        if p.get("userId") != DEMO_USER_ID or p.get("userPw") != DEMO_PASSWORD:
            return redirect("login.do?err=1")
        sid = secrets.token_hex(16).upper()
        sessions[sid] = DEMO_USER_ID
        res = redirect("main.do")
        res.headers.append("set-cookie", "JSESSIONID=%s; Path=%s; HttpOnly" % (sid, mount))
        return res

    @router.get("/logout.do", include_in_schema=False)
    async def logout(request: Request) -> Response:
        sessions.pop(request.cookies.get("JSESSIONID", ""), None)
        return redirect("login.do")

    # ------------------------------------------------------------ 화면
    page("main.do", lambda request: pages.main_page(env, other_origin(request)))
    page("poListView.do", lambda request: pages.po_list_page(env))
    page("poRegView.do", lambda request: pages.po_reg_page(env))
    page("prListView.do", lambda request: pages.pr_list_page(env))
    page("prRegView.do", lambda request: pages.pr_reg_page(env, db.next_pr_no(), db.draft))
    page("vendListView.do", lambda request: pages.vend_list_page(env))
    page("statView.do", lambda request: pages.stat_page(env))

    # ------------------------------------------------------------ 발주
    def po_list(p: Dict[str, str]) -> Response:
        from_dt, to_dt = p.get("fromDt", ""), p.get("toDt", "")
        if any(v and not _YMD.fullmatch(v) for v in (from_dt, to_dt)):
            return _err(400, "조회 기간은 YYYYMMDD 로 입력해 주세요.")
        rows = db.list_pos(from_dt, to_dt, p.get("vendCd", ""), p.get("sttsCd", ""))
        return _ok(totalCnt=len(rows), resultList=[data.po_row(x) for x in rows])

    def po_detail(p: Dict[str, str]) -> Response:
        if not p.get("poNo", "").strip():
            return _err(400, _MISSING + " (poNo)")
        po = db.find_po(p["poNo"].strip())
        return _ok(po=data.po_detail(po)) if po else _err(404, "발주를 찾을 수 없습니다.")

    def po_save(p: Dict[str, str]) -> Response:
        for name in ("vendCd", "itemCd", "qty", "unitPrice"):
            if not p.get(name, "").strip():
                return _err(400, "%s (%s)" % (_MISSING, name))
        qty, price = data.to_int(p["qty"]), data.to_int(p["unitPrice"])
        if not qty or not price:
            return _err(400, "수량과 단가는 1 이상의 숫자여야 합니다.")
        po = db.add_po(p["vendCd"].strip(), p["itemCd"].strip(), qty, price, p.get("payTerm", "").strip() or "30")
        return _ok(PO_NO=po.po_no)

    def po_approve(p: Dict[str, str]) -> Response:
        if not p.get("poNo", "").strip():
            return _err(400, _MISSING + " (poNo)")
        result = db.approve(p["poNo"].strip())
        if result == "none":
            return _err(404, "발주를 찾을 수 없습니다.")
        return _err(409, "승인할 수 없는 상태입니다.") if result == "state" else _ok()

    def po_excel_down(p: Dict[str, str]) -> Response:
        # 화면 어디에서도 이 주소로 가지 않는다. 소스에만 있는 API 라는 설정이다.
        return Response(XLSX_STUB, media_type=XLSX_TYPE, headers={"Content-Disposition": "attachment; filename*=UTF-8''po.xlsx"})

    def old_po_list(p: Dict[str, str]) -> Response:
        # 소스에는 @Deprecated 로 남아 있지만 이미 내려간 옛 API. 화면에서 부르지 않는다.
        return _err(404, "더 이상 제공하지 않습니다.")

    api("poList.do", po_list)
    api("poDetail.do", po_detail)
    api("poSave.do", po_save, "POST")
    api("poApprove.do", po_approve, "POST")
    api("poExcelDown.do", po_excel_down)
    api("oldPoList.do", old_po_list)

    # ------------------------------------------------------------ 거래처, 품목
    def vend_list(p: Dict[str, str]) -> Response:
        return _ok(resultList=data.search_vendors(p.get("vendNm", "")))

    def item_price(p: Dict[str, str]) -> Response:
        item_cd = p.get("itemCd", "").strip()
        if not item_cd:
            return _err(400, _MISSING + " (itemCd)")
        item = data.ITEM_BY_CD.get(item_cd)
        if item is None:
            return _err(404, "품목을 찾을 수 없습니다.")
        return _ok(ITEM_CD=item[0], ITEM_NM=item[1], UNIT_PRICE=data.won(item[2]), VEND_CD=p.get("vendCd", ""))

    api("vendList.do", vend_list)
    api("itemPrice.do", item_price)

    # ------------------------------------------------------------ 구매요청, 예산
    def pr_list(p: Dict[str, str]) -> Response:
        return _ok(resultList=data.list_prs(p.get("deptCd", ""), p.get("sttsCd", "")))

    def pr_draft_save(p: Dict[str, str]) -> Response:
        db.draft = {"title": p.get("title", ""), "content": p.get("content", "")}
        return _ok(SAVED_AT=datetime.now().strftime("%Y%m%d%H%M%S"))  # 서버 시계를 그대로 쓴다

    def pr_submit(p: Dict[str, str]) -> Response:
        if not p.get("prNo", "").strip():
            return _err(400, _MISSING + " (prNo)")
        db.pr_seq += 1
        db.draft = None  # 전송하면 초안은 쓸모가 없어진다
        return _ok()

    def budget_remain(p: Dict[str, str]) -> Response:
        dept_cd = p.get("deptCd", "").strip()
        if not dept_cd:
            return _err(400, _MISSING + " (deptCd)")
        found = data.budget(dept_cd, p.get("yyyy") or "2026")
        return _ok(**found) if found else _err(404, "예산 정보를 찾을 수 없습니다.")

    api("prList.do", pr_list)
    api("prDraftSave.do", pr_draft_save, "POST")
    api("prSubmit.do", pr_submit, "POST")
    api("budgetRemain.do", budget_remain)

    # ------------------------------------------------------------ 공통 모듈
    api("chart/monthly.do", lambda p: _ok(resultList=data.monthly(p.get("yyyy") or "2026")))
    api("common/codeList.do", lambda p: _ok(resultList=data.codes(p.get("grpCd", ""))))

    return router

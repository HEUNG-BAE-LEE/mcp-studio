"""카탈로그 op → FastAPI 라우트 등록기 (서버 공용).

서버(main.py)는 인증·시대별 습관만 정의하고, 업무 라우트는 catalog.CATALOG 에서 한 번에 만든다.
라우트와 명세(assets/)가 같은 카탈로그를 보므로 하나를 고치면 둘 다 바뀐다.

응답은 seed.DATA 를 조회해 만든다. 같은 계약번호가 서버마다 다른 이름(cntrctNo / CNTRCT_NO)으로
나오는 것이 의도다 — 각 op 의 fields 가 원천 키 → 그 시스템의 필드명을 정한다.
"""
from fastapi import Request
from fastapi.responses import JSONResponse

from legacy_pps.common.catalog import CATALOG

VIRTUAL = {"X-Demo-System": "virtual"}      # 모든 응답에 "가상 시스템" 표시 — 사칭 방지


def project(row, fields, fmt=None):
    out = {}
    for src, dst in fields:
        v = row.get(src, "")
        out[dst] = fmt(src, v, dst) if fmt else v
    return out


def register_ops(app, server_key, guard=None, header_fn=None, envelope=None, fmt=None):
    for op in CATALOG[server_key]["ops"]:
        _register_one(app, op, guard, header_fn, envelope, fmt)


def _register_one(app, op, guard, header_fn, envelope, fmt):
    async def endpoint(request: Request):
        if guard is not None:
            blocked = guard(request)
            if blocked is not None:
                blocked.headers.update(VIRTUAL)
                return blocked
        params = dict(request.query_params)
        if op["method"] == "POST":
            try:
                params.update(await request.json())
            except Exception:
                form = await request.form()
                params.update(dict(form))
        params.update(request.path_params)
        try:
            rows, total = op["query"](params)
        except ValueError as e:                       # 잘못된 입력 — 시스템 관행대로 감싸서 돌려준다
            code, _, msg = str(e).rpartition("|")      # "08|필수값 누락" 처럼 코드를 앞에 붙일 수 있다
            return JSONResponse(envelope(None, 0, params, error=msg, code=code or None), headers=VIRTUAL)
        items = [project(r, op["fields"], fmt) for r in rows]
        headers = dict(VIRTUAL, **(header_fn(request) or {})) if header_fn else VIRTUAL
        return JSONResponse(envelope(items, total, params), headers=headers)

    app.add_api_route(op["path"], endpoint, methods=[op["method"]], name=op["op"], include_in_schema=False)


def page(rows, params, default_rows=10, max_rows=100, page_key="pageNo", rows_key="numOfRows"):
    try:
        n = max(1, min(int(params.get(rows_key) or default_rows), max_rows))
        p = max(1, int(params.get(page_key) or 1))
    except ValueError:
        raise ValueError("페이지 값은 숫자여야 합니다")
    return rows[(p - 1) * n: p * n], len(rows)

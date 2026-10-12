"""변환 스튜디오 메뉴: 원본 작업을 AI 도구로 바꾸는 정의(설명, 파라미터 매핑, 정책)를 관리한다."""
from typing import Any, Optional

from fastapi import APIRouter, Body

from app.ieum.gateway import engine, llm
from app.ieum.repositories import logs as log_repo
from app.ieum.repositories import studio as repo
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/studio", tags=["ieum-studio"])

STATUSES = ("done", "review", "drift", "off")


@router.get("/")
def tool_list(source: Optional[str] = None):
    """원본 시스템별 도구 목록. ?source=<id> 로 하나만 조회."""
    data = repo.all_tools()
    calls = log_repo.calls_by_tool()
    for arr in data.values():
        for t in arr:
            t["calls"] = calls.get(t["id"], 0)
    if source:
        return ok({source: data.get(source, [])})
    return ok(data)


# `/{tool_id}/` 보다 먼저 선언한다. 경로 모양이 달라 겹치지는 않지만 읽는 사람이 헷갈리지 않는다.
@router.put("/source/{source_id}/")
def source_tools(source_id: str, payload: Any = Body(None)):
    """연결 마법사, API 자동 탐색에서 만든 도구 후보를 시스템 단위로 등록한다."""
    if not isinstance(payload, list) or not all(isinstance(t, dict) and t.get("id") for t in payload):
        return fail(400, "도구 목록(id 포함)이 필요합니다.")
    return ok(repo.replace_source_tools(source_id, payload))


REWRITE_SYSTEM = (
    "너는 사내 시스템의 API 를 AI 에이전트가 쓰는 도구로 바꾸는 일을 돕는 기술 문서 작성자다. "
    "주어진 도구 정보만 근거로, AI 에이전트가 읽고 \"이 도구를 언제 써야 하는지\" 판단할 수 있는 설명을 한국어 2~3문장으로 쓴다.\n"
    "- 첫 문장은 이 도구가 무엇을 하고 무엇을 돌려주는지.\n"
    "- 이어서 언제 쓰면 좋은지, 쓰지 말아야 할 때(데이터를 바꾸는 작업이거나 비슷한 다른 도구가 맞는 경우 등)를 쓴다.\n"
    "- 소스 파일 경로, URL, 내부 구현 이야기는 쓰지 않는다. 주어진 정보에 없는 것은 지어내지 않는다.\n"
    "- 설명 문장만 출력한다. 따옴표, 머리말, 목록, 마크다운은 붙이지 않는다."
)


def rewrite_prompt(tool, desc=None, again=False):
    """도구 정의에서 \"AI 가 읽는 설명\"을 다시 쓰게 할 요청을 만든다. AI 에게 보이는 파라미터와 응답 필드만 싣는다."""
    lines = ["도구 이름: %s" % tool["id"], "제목: %s" % (tool.get("title") or "-"),
             "방식: %s" % ("쓰기(데이터 변경)" if tool.get("mode") == "write" else "읽기"),
             "호출: %s" % ("%s %s" % (tool["method"], tool["path"]) if tool.get("path") else (tool.get("op") or "-")),
             "현재 설명: %s" % ((desc if desc is not None else tool.get("desc")) or "(없음)")[:600]]
    params = engine.visible_params(tool)[:30]
    lines.append("입력 파라미터:" + ("" if params else " 없음"))
    lines += ["- %s (%s)%s%s" % (p["a"], (p.get("at") or "string").split(" ")[0], " 필수" if p.get("req") else "",
                                 ": %s" % p["d"] if p.get("d") and p["d"] != p["a"] else "") for p in params]
    res = [r for r in tool.get("res", []) if r.get("a")][:30]
    if res:
        lines.append("응답 필드:")
        lines += ["- %s%s" % (r["a"], " (예: %s)" % str(r["ov"])[:30] if r.get("ov") not in (None, "") else "") for r in res]
    if again:
        lines.append("\n이전과 다른 표현으로 써 주세요.")
    return REWRITE_SYSTEM, "\n".join(lines)


@router.post("/{tool_id}/rewrite/")
def tool_rewrite(tool_id: str, payload: Optional[dict] = Body(None)):
    """AI(GPT, 없으면 Claude)가 도구 설명을 다시 쓴다. 백엔드의 AZURE_OPENAI_* 설정을 쓴다."""
    if llm.provider() is None:
        return fail(400, llm.UNAVAILABLE)
    sid, tool = repo.find_tool(tool_id)
    if tool is None:
        return fail(404)
    body = payload or {}
    try:
        text = llm.complete(*rewrite_prompt(tool, body.get("desc"), bool(body.get("again"))))
    except llm.LlmError as e:
        return fail(e.status, str(e))
    return ok({"desc": llm.clean(text)})


@router.get("/{tool_id}/")
def tool_get(tool_id: str):
    sid, tool = repo.find_tool(tool_id)
    if tool is None:
        return fail(404)
    return ok(dict(tool, src=sid))


@router.put("/{tool_id}/")
def tool_save(tool_id: str, payload: Optional[dict] = Body(None)):
    sid, tool = repo.find_tool(tool_id)
    if tool is None:
        return fail(404)
    patch = payload or {}
    if "status" in patch and patch["status"] not in STATUSES:
        return fail(400, "알 수 없는 도구 상태입니다.")
    patch.pop("src", None)
    return ok(dict(repo.save_tool(tool_id, patch), src=sid))

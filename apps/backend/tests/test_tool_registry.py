# apps/backend/tests/test_tool_registry.py
from app.models import Action
from app.services.tool_registry import action_to_tool, dedupe_by_tool_name

SPEC = {
    "toolName": "search_apartment_markers",
    "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "bodySchema": {
            "minX": {"type": "number", "description": "서쪽 경도", "required": True,
                     "llmEditable": True, "example": "126.9654155"},
            "poiType": {"type": "string", "description": "물건 종류", "required": True,
                        "llmEditable": True, "example": "A"},
        },
    },
}


def test_openai_function_형식으로_변환한다():
    tool = action_to_tool(Action(project_id=1, name="x", tool_name="search_apartment_markers", action_spec=SPEC))
    assert tool["type"] == "function"
    assert tool["function"]["name"] == "search_apartment_markers"
    params = tool["function"]["parameters"]
    assert params["properties"]["minX"]["type"] == "number"
    assert set(params["required"]) == {"minX", "poiType"}


# 기록된 예시값이 LLM에게 닿지 않으면 poiType="A" 같은 사이트 고유 코드는
# 추측할 방법이 없다. 이 테스트가 그 경로를 지킨다.
def test_기록된_예시값이_description에_실린다():
    tool = action_to_tool(Action(project_id=1, name="x", tool_name="t", action_spec=SPEC))
    props = tool["function"]["parameters"]["properties"]
    assert props["minX"]["description"] == "서쪽 경도 (예: 126.9654155)"
    assert props["poiType"]["description"] == "물건 종류 (예: A)"


def test_설명이_비어도_예시값은_실린다():
    spec = {
        "toolName": "t", "description": "d",
        "request": {"bodySchema": {
            "minY": {"type": "number", "description": "", "required": True,
                     "llmEditable": True, "example": "37.5606793"},
        }},
    }
    tool = action_to_tool(Action(project_id=1, name="x", tool_name="t", action_spec=spec))
    assert tool["function"]["parameters"]["properties"]["minY"]["description"] == "minY (예: 37.5606793)"


def test_llmEditable가_false인_파라미터는_노출되지_않는다():
    spec = {
        "toolName": "search_apartment_markers",
        "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
        "request": {
            "bodySchema": {
                "minX": {"type": "number", "description": "서쪽 경도", "required": True, "llmEditable": True},
                "srhYear": {"type": "integer", "description": "조회 연도", "required": True, "llmEditable": False},
            },
        },
    }
    tool = action_to_tool(Action(project_id=1, name="x", tool_name="search_apartment_markers", action_spec=spec))
    params = tool["function"]["parameters"]
    assert "srhYear" not in params["properties"]
    assert "srhYear" not in params["required"]


# 시드 액션과 촬영 중 새로 만든 액션이 같은 tool_name을 쓰면, 두 개를 그대로
# tools로 넘길 경우 실행될 액션이 행 순서에 좌우된다. id가 더 큰(나중에 만든)
# 액션이 이기도록 미리 하나로 정리해야 한다.
def test_같은_tool_name의_ACTIVE_액션은_하나만_남는다():
    seeded = Action(id=1, project_id=1, name="시드", tool_name="search_apartment_markers",
                     action_spec=SPEC, status="ACTIVE")
    fresh = Action(id=2, project_id=1, name="새로_만든_액션", tool_name="search_apartment_markers",
                    action_spec=SPEC, status="ACTIVE")

    deduped = dedupe_by_tool_name([seeded, fresh])

    assert len(deduped) == 1
    assert deduped[0].id == 2


def test_dedupe는_id_순서와_무관하게_큰_id를_남긴다():
    fresh = Action(id=5, project_id=1, name="새로_만든_액션", tool_name="search_apartment_markers",
                    action_spec=SPEC, status="ACTIVE")
    seeded = Action(id=1, project_id=1, name="시드", tool_name="search_apartment_markers",
                     action_spec=SPEC, status="ACTIVE")

    deduped = dedupe_by_tool_name([fresh, seeded])

    assert len(deduped) == 1
    assert deduped[0].id == 5


def test_dedupe는_tool_name이_다르면_모두_남긴다():
    a = Action(id=1, project_id=1, name="a", tool_name="tool_a", action_spec=SPEC, status="ACTIVE")
    b = Action(id=2, project_id=1, name="b", tool_name="tool_b", action_spec=SPEC, status="ACTIVE")

    deduped = dedupe_by_tool_name([a, b])

    assert {d.id for d in deduped} == {1, 2}


def test_description이_비어있으면_파라미터_이름으로_대체된다():
    spec = {
        "toolName": "search_apartment_markers",
        "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
        "request": {
            "bodySchema": {
                "poiType": {"type": "string", "description": "", "required": True, "llmEditable": True},
            },
        },
    }
    tool = action_to_tool(Action(project_id=1, name="x", tool_name="search_apartment_markers", action_spec=spec))
    params = tool["function"]["parameters"]
    assert params["properties"]["poiType"]["description"] == "poiType"

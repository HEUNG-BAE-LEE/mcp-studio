# apps/backend/tests/test_tool_registry.py
from app.models import Action
from app.services.tool_registry import action_to_tool

SPEC = {
    "toolName": "search_apartment_markers",
    "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "bodySchema": {
            "minX": {"type": "number", "description": "서쪽 경도", "required": True, "llmEditable": True},
            "poiType": {"type": "string", "description": "물건 종류", "required": True, "llmEditable": True},
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

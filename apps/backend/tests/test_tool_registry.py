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

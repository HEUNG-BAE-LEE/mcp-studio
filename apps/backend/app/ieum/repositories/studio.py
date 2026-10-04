from app.ieum.store import JsonStore

tools = JsonStore("studio", "tools")


def clean(tool):
    """클라이언트 전용 임시 필드(_dirty 등)는 저장하지 않는다."""
    return {k: v for k, v in tool.items() if not k.startswith("_")}


def all_tools():
    """{source_id: [tool, ...]}"""
    return tools.load()


def flat_tools():
    return [dict(t, src=sid) for sid, arr in all_tools().items() for t in arr]


def find_tool(tool_id):
    for sid, arr in all_tools().items():
        for t in arr:
            if t["id"] == tool_id:
                return sid, t
    return None, None


def replace_source_tools(source_id, arr):
    data = all_tools()
    data[source_id] = [clean(t) for t in arr]
    tools.save(data)
    return data[source_id]


def save_tool(tool_id, patch):
    data = all_tools()
    for arr in data.values():
        for i, t in enumerate(arr):
            if t["id"] == tool_id:
                arr[i] = {**t, **clean(patch), "id": tool_id}
                tools.save(data)
                return arr[i]
    return None


def with_defaults(tool, source):
    """등록 시점의 기본 정책: 쓰기 도구는 사용자 확인, 공공데이터는 캐시."""
    t = clean(tool)
    t.setdefault("exec", "confirm" if t.get("mode") == "write" else "auto")
    t.setdefault("mask", True)
    t.setdefault("cache", source.get("proto") == "gov")
    t.setdefault("limit", 10 if t.get("mode") == "write" else 60)
    t.setdefault("calls", 0)
    return t


def delete_source_tools(source_id):
    data = all_tools()
    data.pop(source_id, None)
    tools.save(data)

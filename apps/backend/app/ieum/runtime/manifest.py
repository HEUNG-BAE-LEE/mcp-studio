"""배포 스냅샷(manifest). 배포하는 순간의 도구 정의와 원본 시스템 연결 정보를 파일 하나에 얼린다.

MCP 서버 프로세스는 이 파일만 보고 도구를 내놓는다. 변환 스튜디오에서 도구를 고치거나 공개를 꺼도 새 버전을
배포하기 전에는 서버에 닿지 않는다("다음 배포 때 반영됩니다"가 사실이 되게). 인증 정보는 담지 않는다 —
서버가 호출할 때 인증 금고에서 읽는다.
"""
import json
import os
import time
from pathlib import Path

SCHEMA = 1
# 원본 시스템에서 엔진이 쓰는 것만 옮긴다. specUrl 에는 서비스 키가 쿼리로 붙어 있을 수 있어 뺀다.
SOURCE_FIELDS = ("id", "name", "proto", "base", "ns", "authType")
# 호출에는 쓰지 않는 도구 필드. disc 는 자동 탐색의 근거(소스 위치, 검증 기록), calls 는 낡은 호출 횟수다.
TOOL_DROP = ("disc", "calls")


class ManifestError(ValueError):
    """스냅샷 파일이 없거나 형식이 다르다. 메시지는 화면까지 간다."""


def build(toolset: dict, version: str, tools: list, sources: dict) -> dict:
    """tools: 배포할 도구 정의(src 포함). sources: {원본 시스템 id: 시스템 행}"""
    used = {t["src"] for t in tools}
    return {
        "schema": SCHEMA,
        "toolset": {"id": toolset["id"], "slug": toolset["slug"], "name": toolset["name"], "version": version},
        "deployedAt": time.time(),
        "tools": [{k: v for k, v in t.items() if not k.startswith("_") and k not in TOOL_DROP} for t in tools],
        "sources": {sid: {k: src[k] for k in SOURCE_FIELDS if k in src} for sid, src in sources.items() if sid in used},
    }


def without_tools(data: dict, tool_ids) -> dict:
    """도구 몇 개를 뺀 새 스냅샷. 버전과 나머지 정의는 그대로다(원본 시스템을 지웠을 때 쓴다)."""
    gone = set(tool_ids)
    tools = [t for t in data["tools"] if t["id"] not in gone]
    used = {t["src"] for t in tools}
    return dict(data, tools=tools, sources={sid: s for sid, s in data["sources"].items() if sid in used})


def validate(data) -> dict:
    if not isinstance(data, dict) or data.get("schema") != SCHEMA:
        raise ManifestError("배포 스냅샷 형식을 알 수 없습니다.")
    ts = data.get("toolset")
    if not isinstance(ts, dict) or not all(isinstance(ts.get(k), str) and ts[k] for k in ("id", "slug", "version")):
        raise ManifestError("배포 스냅샷에 묶음 정보가 없습니다.")
    tools, sources = data.get("tools"), data.get("sources")
    if not isinstance(tools, list) or not isinstance(sources, dict):
        raise ManifestError("배포 스냅샷에 도구 목록이 없습니다.")
    for t in tools:
        if not isinstance(t, dict) or not t.get("id") or t.get("src") not in sources:
            raise ManifestError("배포 스냅샷의 도구에 원본 시스템 정보가 없습니다: %s" % (t.get("id") if isinstance(t, dict) else t))
    return data


def load(path) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            return validate(json.load(f))
    except OSError as e:
        raise ManifestError("배포 스냅샷을 읽지 못했습니다. (%s)" % type(e).__name__)
    except json.JSONDecodeError:
        raise ManifestError("배포 스냅샷이 깨져 있습니다.")


def write(path, data: dict) -> None:
    restore(path, json.dumps(data, ensure_ascii=False, indent=1).encode("utf-8"))


def restore(path, raw: bytes) -> None:
    """임시 파일에 쓴 뒤 바꿔치기한다. 서버가 요청마다 파일을 보므로 반쯤 쓰인 파일이 보이면 안 된다."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(raw)
    os.replace(tmp, path)

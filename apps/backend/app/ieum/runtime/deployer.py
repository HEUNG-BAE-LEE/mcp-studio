"""배포 흐름. 묶음 기록(toolsets.json), 스냅샷(manifest), 서버 프로세스(supervisor)를 이어 붙인다.

묶음은 세 가지 상태를 오간다.
    draft    한 번도 배포하지 않았다
    live     배포했고 서버를 띄워 두는 게 맞다 (프로세스가 실제로 떠 있는지는 runtime.state 가 말한다)
    stopped  배포했지만 사람이 서버를 내렸다. 콘솔이 다시 떠도 자동으로 올리지 않는다
"""
import logging
from typing import Iterable

from app.ieum.repositories import deploy as repo
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.runtime import manifest, supervisor
from app.ieum.runtime.supervisor import DeployError
from app.ieum.store import LOCK

log = logging.getLogger("ieum.runtime")

NONE_PUBLISHED = ("공개 중인 도구가 없어 배포할 수 없습니다. 변환 스튜디오에서 도구를 공개한 뒤 "
                  "'변경사항 저장'까지 눌렀는지 확인해 주세요. 저장하지 않은 공개 설정은 서버에 없습니다.")


def next_version(ts: dict) -> str:
    if ts["status"] == "draft":
        return "v1.0"
    return "v{:.1f}".format(float(ts["ver"][1:]) + .1)


def view(ts: dict) -> dict:
    """묶음 기록에 서버의 지금 상태(runtime)를 붙여 화면에 준다. 상태는 저장하지 않고 그때그때 읽는다."""
    if ts["status"] == "draft":
        state = {"state": "none"}
    else:
        state = supervisor.status(ts["id"])
        if "port" not in state and ts.get("port"):      # 내려가 있어도 주소는 그대로다. 다시 띄우면 같은 포트로 돌아온다
            state = dict(state, port=ts["port"], url=supervisor.url_of(ts["port"]))
    return dict(ts, runtime=dict(state, kind="local-process"))


def _get(ts_id: str) -> dict:
    ts = next((x for x in repo.toolsets.load() if x["id"] == ts_id), None)
    if ts is None:
        raise DeployError("묶음을 찾을 수 없습니다.", 404)
    return ts


def _update(ts_id: str, **fields) -> dict:
    with LOCK:
        rows = repo.toolsets.load()
        ts = next((x for x in rows if x["id"] == ts_id), None)
        if ts is None:
            raise DeployError("묶음을 찾을 수 없습니다.", 404)
        ts.update(fields)
        repo.toolsets.save(rows)
        return ts


def _other_ports(ts_id: str) -> set:
    """다른 묶음이 쓰는 포트. 서버가 내려가 있어도 그 묶음 자리를 뺏지 않는다."""
    return {x["port"] for x in repo.toolsets.load() if x["id"] != ts_id and x.get("port")}


def deploy(ts_id: str) -> dict:
    """공개 중인 도구만 담아 새 버전으로 배포한다. 검토가 안 끝난 도구는 이번 배포에서 빠진다.

    서버가 떠 있으면 같은 프로세스가 다음 요청부터 새 정의로 답하고, 없으면 새로 띄운다.
    """
    with supervisor.op_lock(ts_id):
        ts = _get(ts_id)
        by_id = {t["id"]: t for t in tool_repo.flat_tools()}
        sources = {s["id"]: s for s in src_repo.list_sources()}
        deployed = [i for i in ts["tools"] if by_id.get(i, {}).get("status") == "done" and by_id[i]["src"] in sources]
        skipped = [i for i in ts["tools"] if i not in deployed]
        if not deployed:
            raise DeployError(NONE_PUBLISHED, 400)

        version = next_version(ts)
        data = manifest.build(ts, version, [by_id[i] for i in deployed], sources)
        rt = supervisor.apply(ts_id, data, port_hint=ts.get("port"), reserved=_other_ports(ts_id))
        saved = _update(ts_id, ver=version, status="live", updated="방금", deployed=deployed, port=rt["port"], deployedAt=data["deployedAt"])
        return {"toolset": view(saved), "deployed": deployed, "skipped": skipped}


def start(ts_id: str) -> dict:
    """내려 둔(또는 죽은) 서버를 마지막으로 배포한 버전 그대로 다시 띄운다."""
    with supervisor.op_lock(ts_id):
        ts = _get(ts_id)
        if ts["status"] == "draft":
            raise DeployError("아직 배포한 적이 없는 묶음입니다. 먼저 배포해 주세요.", 400)
        rt = supervisor.ensure_running(ts_id, port_hint=ts.get("port"), reserved=_other_ports(ts_id))
        return view(_update(ts_id, status="live", port=rt["port"]))


def stop(ts_id: str) -> dict:
    with supervisor.op_lock(ts_id):
        ts = _get(ts_id)
        if ts["status"] == "draft":
            raise DeployError("아직 배포한 적이 없는 묶음입니다.", 400)
        supervisor.stop(ts_id)
        return view(_update(ts_id, status="stopped"))


def remove(ts_id: str) -> bool:
    """묶음을 지운다. 서버를 먼저 내린다. 없는 묶음이면 False."""
    with supervisor.op_lock(ts_id):
        if not any(x["id"] == ts_id for x in repo.toolsets.load()):
            return False
        supervisor.remove(ts_id)
        with LOCK:
            repo.toolsets.save([x for x in repo.toolsets.load() if x["id"] != ts_id])
    return True


def logs(ts_id: str, lines: int = 200) -> list:
    _get(ts_id)
    return supervisor.log_lines(ts_id, lines)


def drop_tools(tool_ids: Iterable[str]) -> None:
    """원본 시스템을 지우면 그 도구를 묶음에서도 뺀다.

    이미 배포한 서버가 지운 도구를 계속 내놓지 않게 스냅샷에서도 뺀다. 버전과 나머지 정의는 그대로다.
    """
    ids = set(tool_ids)
    with LOCK:
        rows = repo.toolsets.load()
        touched = []
        for ts in rows:
            if ids & (set(ts["tools"]) | set(ts.get("deployed", []))):
                ts["tools"] = [i for i in ts["tools"] if i not in ids]
                ts["deployed"] = [i for i in ts.get("deployed", []) if i not in ids]
                touched.append(ts["id"])
        if touched:
            repo.toolsets.save(rows)
    for ts_id in touched:
        with supervisor.op_lock(ts_id):
            if not supervisor.has_manifest(ts_id):
                continue
            path = supervisor.manifest_path(ts_id)
            try:
                manifest.write(path, manifest.without_tools(manifest.load(path), ids))
            except ValueError as e:            # 스냅샷이 깨져 있어도 원본 시스템 삭제를 막지는 않는다
                log.warning("배포 스냅샷에서 도구를 빼지 못했습니다: %s %s", ts_id, e)


def restore_all() -> None:
    """콘솔이 뜰 때 배포 중이던 서버를 다시 띄운다(바로 돌아온다). IEUM_MCP_AUTORESTORE=0 이면 하지 않는다."""
    if supervisor.autorestore():
        supervisor.restore([(x["id"], x.get("port")) for x in repo.toolsets.load() if x.get("status") == "live"],
                           on_port=lambda ts_id, port: _update(ts_id, port=port))


def shutdown() -> None:
    supervisor.shutdown()

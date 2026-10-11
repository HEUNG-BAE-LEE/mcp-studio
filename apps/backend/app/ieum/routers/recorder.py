"""업무 기록 메뉴: 기록 시작·화면 중계(WebSocket)·종료, 업무 기능 검토·등록(등록이 곧 확정).

WebSocket 은 기록 세션마다 시작 응답으로 받은 토큰이 있어야 열린다. 콘솔에 사용자 로그인이 아직 없어서, 남의 기록
화면을 열 수 없게 하는 장치가 이 토큰뿐이다. 스토어·파일을 다루는 동기 함수는 이벤트 루프를 막지 않게 스레드로 넘긴다.
"""
import asyncio
import json
import logging
import re
import secrets
from typing import Optional

from fastapi import APIRouter, Body, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from app.ieum.gateway import credentials
from app.ieum.recorder import retention, service, store
from app.ieum.recorder.manager import MANAGER, RecorderError, vault_key
from app.ieum.responses import fail, ok

log = logging.getLogger(__name__)

SHOT_NAME = re.compile(r"^\d+-(pre|post)\.jpg$")
REC_ID = re.compile(r"^rec_[0-9a-f]{8}$")


def _fid_ok(fid: str) -> bool:
    return bool(service.FID.fullmatch(fid))


def _startup() -> None:
    for job in (store.mark_interrupted, retention.sweep):
        try:
            job()
        except Exception:
            log.exception("기록 기동 정리(%s)에 실패했지만 서버는 계속 뜹니다.", job.__name__)


async def _shutdown() -> None:
    await MANAGER.shutdown()


router = APIRouter(prefix="/api/ieum/recorder", tags=["ieum-recorder"], on_startup=[_startup], on_shutdown=[_shutdown])


def _demo(origin: str) -> Optional[dict]:
    try:
        from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID
    except ImportError:
        return None
    return {"name": "9월 발주 상세 조회", "base": origin + "/demo-legacy/po", "start": "/login.do", "account": DEMO_USER_ID,
            "password": DEMO_PASSWORD, "owner": "시연 담당자", "ssrStart": "/vendSearchView.do"}


@router.get("/")
async def overview(request: Request):
    recs, fns = await asyncio.gather(asyncio.to_thread(store.list_recordings), asyncio.to_thread(store.list_functions))
    return ok({"recordings": recs, "functions": fns, "usage": MANAGER.usage(), "demo": _demo(str(request.base_url).rstrip("/"))})


@router.post("/recordings/")
async def recording_start(payload: Optional[dict] = Body(None)):
    try:
        return ok(await MANAGER.start(payload or {}), 201)
    except RecorderError as exc:
        return fail(exc.code, str(exc))


@router.get("/recordings/{rid}/")
async def recording_get(rid: str):
    if not REC_ID.fullmatch(rid):
        return fail(400, "잘못된 기록 번호입니다.")
    try:
        return ok(await asyncio.to_thread(store.get_recording, rid))
    except KeyError:
        return fail(404, "기록을 찾을 수 없습니다.")


@router.get("/recordings/{rid}/spans/{seq}/")
async def recording_span(rid: str, seq: int):
    if not REC_ID.fullmatch(rid):
        return fail(400, "잘못된 기록 번호입니다.")
    spans = await asyncio.to_thread(store.read_spans, rid)
    sp = next((s for s in spans if s["seq"] == seq), None)
    if sp is None:
        return fail(404, "행동 묶음을 찾을 수 없습니다.")
    pick = lambda x: {k: (x or {}).get(k) for k in ("url", "title", "aria")}
    return ok({"seq": seq, "action": sp["action"], "pre": pick(sp["pre"]), "post": pick(sp["post"])})


@router.post("/recordings/{rid}/stop/")
async def recording_stop(rid: str):
    if not REC_ID.fullmatch(rid):
        return fail(400, "잘못된 기록 번호입니다.")
    try:
        await MANAGER.stop(rid)
    except RecorderError as exc:
        return fail(exc.code, str(exc))
    try:
        return ok({"status": (await asyncio.to_thread(store.get_recording, rid))["status"]})
    except KeyError:
        return fail(404, "기록을 찾을 수 없습니다.")


@router.delete("/recordings/{rid}/")
async def recording_delete(rid: str):
    if not REC_ID.fullmatch(rid):
        return fail(400, "잘못된 기록 번호입니다.")
    missing, errors = False, []
    try:
        await MANAGER.close(rid)
    except Exception:
        log.exception("기록 세션을 닫지 못했습니다: %s", rid)
        errors.append("세션")
    try:
        await asyncio.to_thread(store.delete_recording, rid)
    except KeyError:
        missing = True
    except Exception:
        log.exception("기록 삭제에 실패했습니다: %s", rid)
        errors.append("기록")
    try:
        await asyncio.to_thread(credentials.delete, vault_key(rid))      # 기록이 이미 없어도 금고 키는 지운다
    except Exception:
        log.exception("금고 키 삭제에 실패했습니다: %s", rid)
        errors.append("금고")
    if errors:
        return fail(500, "일부를 지우지 못했습니다: " + ", ".join(errors))
    return fail(404, "기록을 찾을 수 없습니다.") if missing else ok({"deleted": rid})


@router.get("/recordings/{rid}/shots/{name}")
def recording_shot(rid: str, name: str):
    if not SHOT_NAME.fullmatch(name) or not REC_ID.fullmatch(rid):
        return fail(400, "잘못된 화면 캡처 이름입니다.")
    path = store.rec_dir(rid) / name
    if not path.exists():
        return fail(404, "화면 캡처가 없습니다. 업무 기능을 확정했거나 보관 기간이 지나 지웠을 수 있습니다.")
    return Response(content=path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.websocket("/ws/{rid}")
async def recording_ws(websocket: WebSocket, rid: str, token: str = ""):
    s = MANAGER.get(rid) if REC_ID.fullmatch(rid) else None
    if s is None or not secrets.compare_digest(token.encode(), s.token.encode()):
        await websocket.accept()
        await websocket.close(code=4403)
        return
    await websocket.accept()
    s.subscribe(websocket)
    try:
        await s.send_tabs()
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if not isinstance(msg, dict):
                    continue
                await s.dispatch(msg)           # 제어는 바로, 입력은 세션의 입력 줄로
            except Exception:
                log.exception("기록 화면 메시지 처리에 실패했습니다: %s", rid)
    except WebSocketDisconnect:
        pass
    finally:
        s.unsubscribe(websocket)


MANAGER.on_stopped = service.finish


def _with_blockers(bf: dict) -> dict:
    """업무 기능 응답에 업무 도구로 등록하지 못하는 이유(flowBlockers)를 싣는다. 저장하지 않고 응답할 때마다 구한다."""
    return dict(bf, flowBlockers=service.flow_blockers(bf))


@router.get("/functions/{fid}/")
async def function_get(fid: str):
    if not _fid_ok(fid):
        return fail(400, "잘못된 업무 기능 번호입니다.")
    try:
        return ok(_with_blockers(await asyncio.to_thread(store.get_function, fid)))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.put("/functions/{fid}/")
async def function_put(fid: str, payload: Optional[dict] = Body(None)):
    if not _fid_ok(fid):
        return fail(400, "잘못된 업무 기능 번호입니다.")
    try:
        await asyncio.to_thread(store.get_function, fid)            # 없는 번호만 404. 내용 오류는 400
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    try:
        return ok(_with_blockers(await asyncio.to_thread(service.update_function, fid, payload or {})))
    except ValueError as exc:
        return fail(400, str(exc))


@router.post("/functions/{fid}/verify/")
async def function_verify(fid: str, payload: Optional[dict] = Body(None)):
    if not _fid_ok(fid):
        return fail(400, "잘못된 업무 기능 번호입니다.")
    values = (payload or {}).get("values") or None
    if values is not None and not (isinstance(values, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in values.items())):
        return fail(400, "values 는 입력 이름과 값(글)의 객체여야 합니다.")
    try:
        return ok(_with_blockers(await service.reverify(fid, values)))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except service.Busy as exc:
        return fail(409, str(exc))
    except Exception:
        log.exception("다시 검증에 실패했습니다: %s", fid)
        return fail(400, "다시 검증하지 못했습니다. 서버 로그를 확인해 주세요.")


@router.post("/functions/{fid}/register/")
async def function_register(fid: str, payload: Optional[dict] = Body(None)):
    if not _fid_ok(fid):
        return fail(400, "잘못된 업무 기능 번호입니다.")
    mode = (payload or {}).get("mode") or "flow"
    # flow = 업무 도구 하나, steps = 단계별 도구, single = 예전 호출 호환(단계 하나). 등록이 곧 확정이다(confirm 라우트는 없앴다)
    fns = {"flow": service.register_flow, "steps": service.register_steps, "single": service.register_single}
    if mode not in fns:
        return fail(400, "mode 는 flow, steps, single 중 하나여야 합니다.")
    try:
        out = await asyncio.to_thread(fns[mode], fid)
        out["function"] = _with_blockers(out["function"])
        return ok(out, 201)
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except ValueError as exc:
        return fail(400, str(exc))

# apps/backend/app/ieum/recorder/manager.py
"""기록 세션 관리: 만들기, 찾기, 상한(서버 전체·사람당), 유휴 회수, 보관 정리 주기, Playwright 수명.

Playwright 비동기 객체는 만든 이벤트 루프에 묶인다. 시험처럼 서버(루프)가 바뀌면 이전 것은 쓸 수 없으므로 새로 만든다.
사람당 상한은 기록하는 사람 이름으로 센다(콘솔 로그인이 생기면 계정으로 바꾼다).
"""
import asyncio
import logging
import time
from typing import Awaitable, Callable, Dict, Optional

from app.ieum.gateway import credentials
from app.ieum.recorder import config, retention, store
from app.ieum.recorder.session import RecorderSession


log = logging.getLogger(__name__)

_REAP_SEC = 15
_STOP_STUCK_SEC = 300          # 멈추는 중인 채 이 시간을 넘긴 세션은 리퍼가 실패로 회수한다(안전망)
_STOP_CANCEL_WAIT_SEC = 10     # 멈춤 작업을 취소한 뒤 정리가 끝나기를 기다리는 시간
_STUCK_MSG = "기록을 멈추는 데 너무 오래 걸려 실패로 처리했습니다."


class RecorderError(Exception):
    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


def vault_key(rid: str) -> str:
    return f"rec:{rid}"


def _owner_key(name: str) -> str:
    return " ".join((name or "").split())


class Manager:
    def __init__(self) -> None:
        self.sessions: Dict[str, RecorderSession] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._pw = None
        self._reaper: Optional[asyncio.Task] = None
        self._swept_at = 0.0
        self._lock: Optional[asyncio.Lock] = None
        self._lock_loop = None
        self.on_stopped: Optional[Callable[[str, RecorderSession], Awaitable[None]]] = None
        self._stops: Dict[str, asyncio.Task] = {}      # 진행 중인 멈춤 작업(요청이 취소돼도 끝까지 돈다. 참조를 쥐어 GC 를 막는다)
        self._stuck: set = set()                        # 리퍼가 시간 초과로 끊은 멈춤

    def _guard(self) -> asyncio.Lock:
        """상한 확인부터 등록까지, 그리고 Playwright 기동을 한 번에 한 요청만 지나가게 하는 잠금(루프마다 새로 만든다)."""
        loop = asyncio.get_running_loop()
        if self._lock is None or self._lock_loop is not loop:
            self._lock, self._lock_loop = asyncio.Lock(), loop
        return self._lock

    async def _ensure(self):
        loop = asyncio.get_running_loop()
        if self.loop is not loop:                     # 루프가 바뀌었다(서버 재기동, 시험). 이전 세션은 쓸 수 없다
            self.sessions, self._pw, self._reaper = {}, None, None
            self._stops, self._stuck = {}, set()
            self.loop = loop
        if self._pw is None:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
        if self._reaper is None:
            self._reaper = asyncio.ensure_future(self._reap())
        return self._pw

    def usage(self) -> dict:
        by: Dict[str, int] = {}
        for s in self.sessions.values():
            if not s.closed:
                by[_owner_key(s.owner)] = by.get(_owner_key(s.owner), 0) + 1
        return {"total": sum(by.values()), "max": config.max_sessions(), "perOwner": config.max_per_owner(), "byOwner": by}

    async def start(self, payload: dict) -> dict:
        try:
            return await self._start(payload)
        except (RecorderError, asyncio.CancelledError):
            raise
        except Exception as exc:
            raise RecorderError(str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__, 500)

    async def _start(self, payload: dict) -> dict:
        name = (payload.get("name") or "").strip()
        owner = _owner_key(payload.get("owner") or "")
        base = (payload.get("base") or "").strip().rstrip("/")
        env = payload.get("env") or "op"
        if not name:
            raise RecorderError("업무 이름을 입력해 주세요.")
        if not owner:
            raise RecorderError("기록하는 사람을 입력해 주세요. 동시 기록 상한을 사람마다 셉니다.")
        if not base.startswith(("http://", "https://")):
            raise RecorderError("대상 시스템 주소는 http:// 또는 https:// 로 시작해야 합니다.")
        if env not in ("op", "stg"):
            raise RecorderError("환경은 운영(op) 또는 스테이징(stg) 이어야 합니다.")
        account, password = payload.get("account") or "", payload.get("password") or ""
        creds = {"username": account, "password": password} if account and password else None
        rec = store.new_recording(name, owner, base, payload.get("start") or "", env, "auto" if creds else "manual", payload.get("readPost") or "")
        async with self._guard():                     # 상한 확인과 자리 예약 사이에 await 가 끼지 않게 한 잠금으로 묶는다
            pw = await self._ensure()
            u = self.usage()
            if u["byOwner"].get(owner, 0) >= u["perOwner"]:
                raise RecorderError(f"{owner} 님이 이미 {u['byOwner'][owner]}개를 기록 중입니다(사람당 {u['perOwner']}개). 진행 중인 기록을 끝내고 다시 시작해 주세요.", 409)
            if u["total"] >= u["max"]:
                who = ", ".join(f"{k} {v}개" for k, v in u["byOwner"].items())
                raise RecorderError(f"동시 기록이 가득 찼습니다(서버 전체 {u['max']}개: {who}). 진행 중인 기록이 끝나면 다시 시작해 주세요.", 409)
            session = RecorderSession(rec, creds, on_dead=lambda rid: self.sessions.pop(rid, None))
            self.sessions[rec["id"]] = session        # 자리를 먼저 잡는다. 실패하면 아래에서 뺀다
        ok = False
        err: Optional[BaseException] = None
        try:
            await asyncio.to_thread(store.save_recording, rec)
            if creds:
                await asyncio.to_thread(credentials.put, vault_key(rec["id"]), {"type": "session", "username": account, "password": password})
            await session.start(pw)
            ok = True
        except BaseException as exc:                  # 취소(CancelledError)도 자리·브라우저·인증 정보를 치우고 다시 던진다
            err = exc
            raise
        finally:
            if not ok:
                await self._cleanup_failed_start(rec["id"], session, err)
        return {"id": rec["id"], "token": session.token}

    async def _cleanup_failed_start(self, rid: str, session: RecorderSession, err: Optional[BaseException]) -> None:
        """시작이 실패하거나 취소됐을 때 단계마다 따로 치운다. 한 단계가 터져도 나머지는 하고, 원래 오류를 덮지 않는다."""
        self.sessions.pop(rid, None)
        msg = "시작이 취소되었습니다." if isinstance(err, asyncio.CancelledError) else (
            (str(err).splitlines()[0][:300] if err is not None and str(err) else type(err).__name__))

        async def step(coro_fn):
            try:
                await asyncio.shield(coro_fn())
            except BaseException:
                log.exception("실패한 기록 정리 단계가 실패했습니다")
        await step(session.close)
        await step(lambda: asyncio.to_thread(credentials.delete, vault_key(rid)))
        await step(lambda: asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status="failed", error=msg, endedAt=time.time())))

    def get(self, rid: str) -> Optional[RecorderSession]:
        s = self.sessions.get(rid)
        return None if s is None or s.closed else s

    async def stop(self, rid: str) -> None:
        s = self.get(rid)
        if s is None:
            raise RecorderError("진행 중인 기록이 아닙니다.", 404)
        if s.stopping or rid in self._stops:          # 멈춤은 한 번만. on_stopped 가 두 번 돌면 분석이 겹친다
            raise RecorderError("이미 멈추는 중인 기록입니다.", 409)
        # 멈춤은 별도 작업으로 돌리고 요청은 그 끝을 기다리기만 한다. 요청(연결)이 취소돼도 멈춤 작업은 끝까지 돌아
        # 분석 예약(on_stopped)까지 스스로 마친다. 안 그러면 세션이 stopping 인 채 갇혀 사람당 상한을 계속 차지한다.
        await asyncio.shield(self._begin_stop(rid, s))

    def _begin_stop(self, rid: str, s: RecorderSession) -> asyncio.Task:
        task = self._stops[rid] = asyncio.ensure_future(self._stop_session(rid, s))
        task.add_done_callback(lambda t, rid=rid: self._stop_done(rid, t))
        return task

    def _stop_done(self, rid: str, task: asyncio.Task) -> None:
        """멈춤 작업 완료 콜백. 기다리던 요청이 취소됐으면 결과를 받을 곳이 없으므로 여기서 거둔다."""
        if self._stops.get(rid) is task:
            self._stops.pop(rid, None)
        self._stuck.discard(rid)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            log.warning("기록 %s 멈춤 작업이 실패로 끝났습니다: %s", rid, exc)

    async def _stop_session(self, rid: str, s: RecorderSession) -> None:
        try:
            await s.stop()
            await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status="analyzing"))
        except asyncio.CancelledError:
            if rid in self._stuck:                    # 리퍼가 시간 초과로 끊었다: 실패로 적고 치운다
                await self._drop_after_stop_failure(rid, s, _STUCK_MSG)
                raise RecorderError(_STUCK_MSG, 500)
            await self._drop_after_stop_failure(rid, s, None)     # 서버 종료로 취소되면 정리만 한다
            raise
        except Exception as exc:                      # KeyboardInterrupt·SystemExit 같은 종료 신호는 삼키지 않는다
            # 멈추다 실패하면 세션이 stopping 인 채 영영 남는다. 실패로 적고 치운 뒤 알린다.
            msg = (str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__)
            await self._drop_after_stop_failure(rid, s, msg)
            raise RecorderError(f"기록을 멈추는 중 실패했습니다: {msg}", 500)
        if self.on_stopped is not None:
            asyncio.ensure_future(self.on_stopped(rid, s))
        else:
            await self.close(rid)

    async def _drop_after_stop_failure(self, rid: str, s: RecorderSession, msg: Optional[str]) -> None:
        """멈춤 실패·취소 뒤 정리: 관리자에서 빼고, (사유가 있으면) 실패로 적고, 세션을 닫는다. 정리는 취소되지 않게 감싼다."""
        if self.sessions.get(rid) is s:
            self.sessions.pop(rid, None)
        if msg is not None:
            try:
                await asyncio.shield(asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status="failed", error=msg, endedAt=time.time())))
            except Exception:                         # 취소(CancelledError)는 잡지 않고 그대로 올린다
                log.exception("멈춤 실패를 기록하지 못했습니다")
        try:
            await asyncio.shield(s.close())
        except Exception:
            log.exception("멈춤 실패 뒤 세션을 닫지 못했습니다")

    async def close(self, rid: str) -> None:
        s = self.sessions.pop(rid, None)
        if s is not None:
            await s.close()

    async def shutdown(self) -> None:
        stops = [t for t in self._stops.values() if not t.done()]
        for task in stops:
            task.cancel()                             # 서버 종료: 멈춤 작업은 정리만 하고 끝난다
        if stops:
            await asyncio.wait(stops, timeout=_STOP_CANCEL_WAIT_SEC)
        for rid in list(self.sessions):
            await self.close(rid)
        if self._reaper is not None:
            self._reaper.cancel()
        if self._pw is not None:
            try:
                await self._pw.stop()
            except Exception:
                pass
        self._pw, self._reaper = None, None

    async def _reap(self) -> None:
        while True:
            await asyncio.sleep(_REAP_SEC)
            await self._reap_once()

    async def _reap_once(self) -> None:
        """한 번의 회수. 한 단계가 실패해도 다음 단계·다음 주기는 계속 돈다(리퍼가 죽으면 유휴·최대 시간·보관 정리가 영영 멈춘다)."""
        now = time.time()
        if now - self._swept_at > 86400:
            self._swept_at = now
            try:
                await asyncio.to_thread(retention.sweep, now)
            except Exception:
                log.exception("보관 정리에 실패했습니다")
        for rid, s in list(self.sessions.items()):
            try:
                try:
                    status = (await asyncio.to_thread(store.get_recording, rid))["status"]
                except KeyError:
                    await self.close(rid)
                    continue
                if s.stopping and not s.accept_replay and s.stopping_at and now - s.stopping_at > _STOP_STUCK_SEC:
                    await self._reap_stuck_stop(rid, s)
                    continue
                if status != "recording" or s.stopping or rid in self._stops:
                    continue                     # 분석·검증 중인 세션은 service.finish 가 닫는다
                if now - s.last_input > config.idle_sec():
                    try:
                        await s.begin_stopping()          # 멈춤과 같이: 입력을 끊고, 대기 승인을 거부로 닫고, 승인 기록을 남긴다
                        await s._deny_pending()
                        await s.trace.finish(s.page)
                        await s._deny_pending()
                        approvals = list(s.guard.decisions)
                        await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(
                            status="interrupted", endedAt=now, error="입력이 오래 없어 기록을 멈췄습니다.", approvals=approvals))
                    finally:
                        await self.close(rid)
                elif now - s.started > config.max_sec():
                    self._begin_stop(rid, s)          # 기다리지 않는다. 멈춤이 오래 걸려도 리퍼(안전망)는 계속 돌아야 한다
            except Exception:
                log.exception("기록 %s 회수 단계에 실패했습니다", rid)


    async def _reap_stuck_stop(self, rid: str, s: RecorderSession) -> None:
        """멈추는 중인 채 너무 오래 남은 세션: 멈춤 작업을 먼저 끊고(정리를 기다린 뒤), 정상으로 끝났으면 건드리지 않는다."""
        task = self._stops.get(rid)
        if task is not None:
            if not task.done():
                self._stuck.add(rid)
                task.cancel()                         # 작업이 취소를 받으면 실패로 적고 스스로 빼고 닫는다
                await asyncio.wait({task}, timeout=_STOP_CANCEL_WAIT_SEC)
            if not task.done():
                # 취소를 받고도 아직 돈다. 지금 실패로 적으면 늦게 정상으로 끝난 작업이 덮어쓸 수 있다. 다음 회수 때 다시 본다
                log.warning("기록 %s 의 멈춤 작업이 취소 뒤에도 끝나지 않았습니다. 다음 회수 때 다시 확인합니다", rid)
                return
            if not task.cancelled() and task.exception() is None:
                return                                # 막 정상으로 끝난 멈춤이다. 회수하지 않는다
            if self.sessions.get(rid) is s:           # 작업이 실패로 끝나며 이미 정리했다. 남았으면 치운다
                self.sessions.pop(rid, None)
                await s.close()
            return
        log.warning("기록 %s 이(가) %d초 넘게 멈추는 중이라 실패로 회수합니다", rid, _STOP_STUCK_SEC)
        try:
            await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status="failed", error=_STUCK_MSG, endedAt=time.time()))
        except KeyError:
            pass
        if self.sessions.get(rid) is s:
            self.sessions.pop(rid, None)
        await s.close()


MANAGER = Manager()

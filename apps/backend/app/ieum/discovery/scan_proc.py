"""소스 분석을 별도 프로세스에서 돌린다.

사용자가 준 저장소는 믿을 수 없다. 병적인 파일(열린 괄호 수만 개, 깊은 제네릭 중첩)은 정규식을 역추적에 빠뜨릴 수
있고, 파이썬 정규식은 GIL 을 놓지 않아서 스레드로 돌리면 **서버 전체가 함께 멈춘다**. 별도 프로세스에서 돌리면
시간 제한을 넘는 순간 강제로 끝낼 수 있고, 취소도 바로 먹는다. 메모리를 터뜨려도 서버는 살아 있다.

결과는 큐로 받는다. 컨트롤러 파일 하나를 해석할 때마다 on_file 이 불리는 흐름은 그대로 유지한다.
"""
import multiprocessing
import queue
import time
from typing import Callable, Optional

SCAN_TIMEOUT = 120          # 정상 저장소는 파일 수천 개도 몇 초면 끝난다. 이만큼 걸리면 병적인 입력이다
MEMORY_LIMIT = 2 * 1024 ** 3


class ScanAborted(RuntimeError):
    """분석을 끝내지 못했다. 메시지는 사용자에게 그대로 보인다."""


def _child(root: str, framework: str, q) -> None:
    try:                                           # 메모리 상한. 지원하지 않는 OS 에서는 건너뛴다
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT, MEMORY_LIMIT))
    except Exception:
        pass
    from app.ieum.discovery import scan
    try:
        result = scan.scan(root, framework, on_file=lambda info, endpoints: q.put(("file", info, endpoints)))
        q.put(("done", result))
    except ValueError as exc:                      # 없는 경로 같은, 사용자에게 보일 오류
        q.put(("error", str(exc)))
    except MemoryError:
        q.put(("error", "소스가 너무 커서 분석하다 메모리가 부족했습니다."))
    except Exception as exc:
        q.put(("error", f"소스를 분석하다 오류가 났습니다. ({type(exc).__name__})"))


def run(root, framework: str = "auto", *, on_file: Optional[Callable] = None, should_cancel: Optional[Callable[[], bool]] = None, timeout: Optional[float] = None):
    """scan.scan 과 같은 결과를 돌려준다. 시간을 넘기거나 비정상 종료하면 ScanAborted."""
    timeout = timeout or SCAN_TIMEOUT               # 호출 시점에 읽는다(기본값으로 묶어 두면 시험이 바꿀 수 없다)
    ctx = multiprocessing.get_context("spawn")      # fork 는 스레드가 도는 서버에서 안전하지 않다
    q = ctx.Queue()
    proc = ctx.Process(target=_child, args=(str(root), framework, q), daemon=True)
    proc.start()
    deadline = time.monotonic() + timeout
    try:
        while True:
            if should_cancel and should_cancel():
                raise ScanAborted("소스 분석을 멈췄습니다.")
            if time.monotonic() > deadline:
                raise ScanAborted(f"소스 분석이 {int(timeout)}초 안에 끝나지 않아 멈췄습니다. 저장소가 너무 크거나 분석할 수 없는 모양의 파일이 있을 수 있습니다.")
            try:
                msg = q.get(timeout=0.2)
            except queue.Empty:
                if not proc.is_alive():            # 큐에 마지막 메시지가 남았을 수 있어 한 번 더 비운다
                    try:
                        msg = q.get(timeout=0.5)
                    except queue.Empty:
                        raise ScanAborted("소스 분석 프로세스가 비정상으로 끝났습니다. 메모리가 부족했거나 읽을 수 없는 파일이 있을 수 있습니다.")
                else:
                    continue
            if msg[0] == "file":
                if on_file:
                    on_file(msg[1], msg[2])
            elif msg[0] == "done":
                return msg[1]
            else:
                raise ValueError(msg[1])
    finally:
        if proc.is_alive():
            proc.terminate()
            proc.join(3)
            if proc.is_alive():
                proc.kill()
        q.close()

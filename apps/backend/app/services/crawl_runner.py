"""일괄 수집을 백그라운드에서 돌리고 진행 상황을 DB 에 남긴다.

크롤은 수십 초가 걸린다. 요청을 붙잡고 있으면 화면이 멈춘 것처럼 보이고
브라우저 타임아웃에도 걸린다. 그래서 잡을 만들어 즉시 돌려주고, 화면은
`GET /api/crawl-jobs/{id}` 로 진행 상황을 물어본다.

스레드를 쓴다. 이 데모는 uvicorn 워커 하나로 돌고, 잡도 사람이 눌러야 시작하므로
큐·워커를 따로 둘 이유가 없다. SQLite 는 스레드마다 세션을 새로 열어 쓴다.
"""

import threading
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from app.db import engine
from app.models import CrawlJob, RecordingSession, SpecOperation
from app.services.portal_crawler import PortalUnreachable, crawl_portal


def _apply(job: CrawlJob, progress) -> None:
    job.phase = progress.phase
    job.services_found = progress.services_found
    job.services_done = progress.services_done
    job.operations = progress.operations
    # 화면 한 줄에 들어가야 한다. 긴 URL 이 그대로 오면 레이아웃이 깨진다.
    job.current = (progress.current or "")[:120]
    job.message = progress.message


def _run(job_id: int, list_url: str, limit: int, only_pks: list, purpose: str) -> None:
    def on_progress(progress):
        # 진행 상황을 매번 커밋한다. 크롤이 끝난 뒤에 한 번에 쓰면 화면은
        # 그때까지 아무것도 못 본다 — 진행 표시를 두는 의미가 사라진다.
        with Session(engine) as db:
            row = db.get(CrawlJob, job_id)
            if row is None:
                return
            _apply(row, progress)
            db.add(row)
            db.commit()

    try:
        results, progress = crawl_portal(list_url, limit=limit, on_progress=on_progress,
                                         only_pks=only_pks)
    except PortalUnreachable as exc:
        # 이 예외는 이미 사람이 읽고 조치할 수 있는 문장이다. 접두를 덧붙이면
        # "수집 중 오류가 발생했습니다: 공공데이터포털의 인증서를..." 처럼 늘어진다.
        with Session(engine) as db:
            row = db.get(CrawlJob, job_id)
            if row is not None:
                row.status = "failed"
                row.phase = "연결 실패"
                row.message = str(exc)
                row.finished_at = datetime.utcnow()
                db.add(row)
                db.commit()
        return
    except Exception as exc:  # noqa: BLE001 — 어떤 실패든 잡 상태로 남겨야 한다
        with Session(engine) as db:
            row = db.get(CrawlJob, job_id)
            if row is not None:
                row.status = "failed"
                row.phase = "실패"
                row.message = f"수집 중 오류가 발생했습니다: {exc}"
                row.finished_at = datetime.utcnow()
                db.add(row)
                db.commit()
        return

    with Session(engine) as db:
        row = db.get(CrawlJob, job_id)
        if row is None:
            return

        session_row = None
        if results:
            # 일괄 수집은 한 번에 여러 서비스를 담으므로 세션도 하나로 묶는다.
            # 서비스별로 세션을 쪼개면 "한 번 등록해서 한 번에 모았다"는 사실이
            # 화면에서 사라진다.
            session_row = RecordingSession(
                project_id=row.project_id,
                started_at=row.started_at or datetime.utcnow(),
                ended_at=datetime.utcnow(),
                status="COMPLETED",
                kind="portal",
                source_label=(f"{purpose} · 서비스 {len(results)}개" if purpose
                              else f"일괄 수집 · 서비스 {len(results)}개"),
            )
            db.add(session_row)
            db.commit()
            db.refresh(session_row)

            now = datetime.utcnow()
            for service in results:
                for op in service.operations:
                    db.add(SpecOperation(
                        session_id=session_row.id,
                        portal="data.go.kr",
                        service_name=service.service_name,
                        provider=service.provider,
                        op_name=op.op_name,
                        summary=op.summary,
                        method=op.method,
                        base_url=op.base_url,
                        path=op.path,
                        params=[p.__dict__ for p in op.params],
                        response_fields=op.response_fields,
                        warnings=op.warnings,
                        source_url=service.detail_url,
                        parsed_at=now,
                    ))
            db.commit()

        _apply(row, progress)
        row.status = "completed"
        row.session_id = session_row.id if session_row else None
        row.finished_at = datetime.utcnow()
        db.add(row)
        db.commit()


def start(project_id: int, list_url: str, limit: int,
          only_pks: Optional[list] = None, purpose: str = "") -> int:
    """잡을 만들고 스레드를 띄운 뒤 잡 id 를 돌려준다."""
    with Session(engine) as db:
        job = CrawlJob(
            project_id=project_id,
            list_url=list_url,
            limit=limit,
            status="running",
            phase="시작",
            started_at=datetime.utcnow(),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id

    thread = threading.Thread(target=_run,
                              args=(job_id, list_url, limit, only_pks or [], purpose),
                              daemon=True)
    thread.start()
    return job_id


def latest_for_project(project_id: int) -> list:
    with Session(engine) as db:
        return db.exec(
            select(CrawlJob)
            .where(CrawlJob.project_id == project_id)
            .order_by(CrawlJob.id.desc())
        ).all()

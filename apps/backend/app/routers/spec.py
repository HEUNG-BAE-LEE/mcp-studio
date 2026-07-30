"""포털 공개 기반 수집 엔드포인트.

확장이 "사용자가 이미 연 페이지"의 HTML을 통째로 보내면 여기서 파싱한다.
서버가 포털을 직접 순회하지 않는 이유는 spec_parser 모듈 주석에 적어두었다.
"""

import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import Action, CrawlJob, Project, RecordingSession, SpecOperation
from app.seed import seed_credentials
from app.services.schema_infer import build_action_spec_from_spec
from app.services.spec_parser import PORTAL_LABELS, detect_portal, parse

router = APIRouter()


class SpecCollectIn(BaseModel):
    url: str
    html: str


def _tool_name(op_name: str) -> str:
    """오퍼레이션 이름을 OpenAI 도구 이름 규칙(영숫자·밑줄)으로 다듬는다."""
    ascii_only = re.sub(r"[^A-Za-z0-9_-]", "", op_name)
    if not ascii_only:
        return "new_action"
    snake = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", ascii_only).lower()
    return re.sub(r"[-]+", "_", snake).strip("_") or "new_action"


@router.post("/api/projects/{project_id}/spec-sessions")
def collect_spec(project_id: int, payload: SpecCollectIn, db: Session = Depends(get_session)) -> dict:
    """명세 페이지 HTML을 받아 수집 세션과 오퍼레이션 후보를 만든다.

    같은 서비스를 다시 수집하면 **직전 세션에 누적**한다. 포털 상세페이지는
    상세기능을 select 로 전환하는 구조라, 사용자가 목록을 바꿔가며 여러 번
    수집하는 것이 정상 사용 흐름이기 때문이다. 매번 새 세션을 만들면
    한 서비스가 5개 세션으로 흩어진다.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")

    if detect_portal(payload.url) is None:
        raise HTTPException(422, "아직 지원하지 않는 포털입니다. 현재는 공공데이터포털만 수집할 수 있습니다")

    page = parse(payload.html, payload.url)
    if not page.operations:
        raise HTTPException(
            422,
            "이 페이지에서 API 명세를 찾지 못했습니다. 오픈API 상세페이지인지 확인해 주세요",
        )

    label = PORTAL_LABELS.get(detect_portal(payload.url), page.portal)
    session_row = db.exec(
        select(RecordingSession)
        .where(RecordingSession.project_id == project_id)
        .where(RecordingSession.kind == "portal")
        .where(RecordingSession.source_label == page.service_name)
        .order_by(RecordingSession.id.desc())
    ).first()

    if session_row is None:
        session_row = RecordingSession(
            project_id=project_id,
            started_at=datetime.utcnow(),
            ended_at=datetime.utcnow(),
            status="COMPLETED",
            kind="portal",
            source_label=page.service_name,
        )
        db.add(session_row)
        db.commit()
        db.refresh(session_row)

    existing = {
        row.op_name
        for row in db.exec(
            select(SpecOperation).where(SpecOperation.session_id == session_row.id)
        ).all()
    }

    added = 0
    for op in page.operations:
        if op.op_name in existing:
            continue
        db.add(SpecOperation(
            session_id=session_row.id,
            portal=page.portal,
            service_name=page.service_name,
            provider=page.provider,
            op_name=op.op_name,
            summary=op.summary,
            method=op.method,
            base_url=op.base_url,
            path=op.path,
            params=[p.__dict__ for p in op.params],
            response_fields=op.response_fields,
            warnings=op.warnings,
            source_url=payload.url,
            parsed_at=datetime.utcnow(),
        ))
        added += 1
    db.commit()

    collected = len(existing) + added
    return {
        "sessionId": session_row.id,
        "portal": page.portal,
        "portalLabel": label,
        "serviceName": page.service_name,
        "provider": page.provider,
        "added": added,
        "collected": collected,
        # 이 서비스에 상세기능이 몇 개인지. 화면은 "5개 중 2개 수집됨"을 보여주고
        # 나머지는 목록에서 선택해 다시 수집하라고 안내한다.
        "availableTotal": len(page.available),
        "available": [item["label"] for item in page.available],
    }


@router.get("/api/recording-sessions/{session_id}/spec-operations")
def list_spec_operations(session_id: int, db: Session = Depends(get_session)) -> list:
    rows = db.exec(
        select(SpecOperation).where(SpecOperation.session_id == session_id).order_by(SpecOperation.id)
    ).all()
    return [{
        "id": row.id,
        "opName": row.op_name,
        "summary": row.summary,
        "method": row.method,
        "url": f"{row.base_url}{row.path}",
        "serviceName": row.service_name,
        "provider": row.provider,
        "portal": row.portal,
        "paramCount": len(row.params),
        "requiredCount": sum(1 for p in row.params if p.get("required")),
        "responseFieldCount": len(row.response_fields),
        "params": row.params,
        "warnings": row.warnings,
        "sourceUrl": row.source_url,
    } for row in rows]


@router.post("/api/spec-operations/{operation_id}/actions")
def create_action_from_spec(operation_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    """오퍼레이션 후보를 액션으로 승격한다.

    트래픽 경로(actions.create_action)와 **같은 형태의 action_spec** 을 만든다.
    그래서 이후 실행·LLM 콘솔은 어느 수집 방식에서 왔는지 알 필요가 없다.
    """
    op = db.get(SpecOperation, operation_id)
    if op is None:
        raise HTTPException(404, "해당 오퍼레이션을 찾을 수 없습니다")

    session_row = db.get(RecordingSession, op.session_id)
    if session_row is None:
        raise HTTPException(404, "해당 수집 세션을 찾을 수 없습니다")

    name = (payload.get("name") or "").strip() or op.summary or op.op_name
    tool_name = (payload.get("toolName") or "").strip() or _tool_name(op.op_name)
    description = (payload.get("description") or "").strip() or (
        f"[{op.provider}] {op.service_name} — {op.op_name}".strip(" —[]")
    )

    spec = build_action_spec_from_spec(op, name=name, tool_name=tool_name, description=description)
    action = Action(
        project_id=session_row.project_id,
        name=name,
        tool_name=tool_name,
        description=description,
        action_spec=spec,
        status=payload.get("status", "DRAFT"),
        source_kind=session_row.kind or "portal",
    )
    db.add(action)
    db.commit()
    db.refresh(action)

    # 새 도구가 요구하는 키를 환경에 있는 값으로 채운다. 이미 등록된 것은 두고,
    # 환경에 없으면 아무 일도 하지 않는다.
    seed_credentials()
    return {"id": action.id, "name": action.name, "toolName": action.tool_name, "status": action.status}


class CredentialIn(BaseModel):
    portal: str
    value: str


@router.put("/api/projects/{project_id}/credentials")
def set_credential(project_id: int, payload: CredentialIn, db: Session = Depends(get_session)) -> dict:
    """포털 인증키를 등록한다. 실행 시점에 숨김 파라미터로 주입된다."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")
    # SQLModel 의 JSON 컬럼은 제자리 수정을 감지하지 못한다. 새 dict 를 대입해야 저장된다.
    project.credentials = {**(project.credentials or {}), payload.portal: payload.value}
    db.add(project)
    db.commit()
    return {"portal": payload.portal, "registered": True}


@router.get("/api/projects/{project_id}/credentials")
def list_credentials(project_id: int, db: Session = Depends(get_session)) -> list:
    """무슨 키가 필요한지, 그중 무엇이 등록됐는지 돌려준다.

    값 자체는 내려보내지 않는다(마스킹).

    "인증키를 등록하세요" 만으로는 무슨 키를 넣어야 할지 알 수 없다. 이름은
    기관마다 다르고(공공데이터포털 serviceKey · 행정안전부 confmKey · 통계청
    apiKey), 그 이름은 수집한 도구의 스펙에 이미 적혀 있다. 화면이 되묻는 대신
    필요한 목록을 여기서 만들어 준다.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")

    saved = project.credentials or {}

    # 실행 시점에 주입되는 파라미터(llmEditable=False)가 곧 인증키다.
    # 어느 도구가 그것을 쓰는지도 함께 모아 화면에서 근거를 보여준다.
    #
    # 같은 키가 serviceKey / ServiceKey 로 갈린다 — 기관이 명세를 직접 쓰기
    # 때문이다. executor 는 대소문자를 무시하고 주입하므로, 여기서도 소문자로
    # 묶어야 한다. 나누어 세면 이미 등록한 키를 "미등록" 이라고 알리게 된다.
    saved_lower = {name.lower(): (name, value) for name, value in saved.items()}

    needed: dict = {}
    for action in db.exec(select(Action).where(Action.project_id == project_id)).all():
        request = (action.action_spec or {}).get("request", {})
        schema = request.get("querySchema") or request.get("bodySchema") or {}
        for name, spec in schema.items():
            if spec.get("llmEditable", True):
                continue
            entry = needed.setdefault(name.lower(), {"label": name, "tools": []})
            entry["tools"].append(action.name)

    def _mask(value: str) -> str:
        return (value[:4] + "****") if len(value) > 4 else "****"

    rows = []
    for lower, entry in sorted(needed.items()):
        found = saved_lower.get(lower)
        rows.append({
            # 등록된 표기가 있으면 그것을, 없으면 명세의 표기를 보여준다.
            "portal": found[0] if found else entry["label"],
            "masked": _mask(found[1]) if found else None,
            "registered": found is not None,
            "usedBy": sorted(set(entry["tools"]))[:3],
            "usedByCount": len(set(entry["tools"])),
        })

    # 도구가 요구하지 않는데 이미 등록해 둔 키도 남긴다 — 지우려면 보여야 한다.
    rows += [
        {"portal": name, "masked": _mask(value), "registered": True,
         "usedBy": [], "usedByCount": 0}
        for name, value in sorted(saved.items()) if name.lower() not in needed
    ]
    return rows


# ── 포털 일괄 수집 ───────────────────────────────────────────


class PortalCrawlIn(BaseModel):
    listUrl: str
    limit: int = 30
    # 미리보기에서 사용자가 고른 서비스만 수집한다. 비우면 목록 순서대로 전부.
    publicDataPks: list = []
    purpose: str = ""


@router.post("/api/projects/{project_id}/portal-crawls")
def start_portal_crawl(project_id: int, payload: PortalCrawlIn,
                       db: Session = Depends(get_session)) -> dict:
    """목록 URL 하나로 그 안의 API 를 일괄 수집한다.

    수십 초가 걸리므로 즉시 잡 id 를 돌려주고, 화면은 진행 상황을 물어본다.
    """
    from app.services import crawl_runner
    from app.services.portal_crawler import MAX_LIMIT, is_supported_list_url

    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")

    url = payload.listUrl.strip()
    if not is_supported_list_url(url):
        raise HTTPException(
            422, "아직 공공데이터포털(data.go.kr) 주소만 수집할 수 있습니다"
        )
    if payload.limit > MAX_LIMIT:
        raise HTTPException(422, f"한 번에 수집할 수 있는 최대 개수는 {MAX_LIMIT}개입니다")

    job_id = crawl_runner.start(project_id, url, payload.limit,
                                only_pks=payload.publicDataPks, purpose=payload.purpose)
    return {"jobId": job_id, "status": "running"}


def _job_view(job: CrawlJob) -> dict:
    return {
        "id": job.id,
        "projectId": job.project_id,
        "listUrl": job.list_url,
        "limit": job.limit,
        "status": job.status,
        "phase": job.phase,
        "servicesFound": job.services_found,
        "servicesDone": job.services_done,
        "operations": job.operations,
        "current": job.current,
        "message": job.message,
        "sessionId": job.session_id,
        "startedAt": job.started_at,
        "finishedAt": job.finished_at,
    }


@router.get("/api/crawl-jobs/{job_id}")
def get_crawl_job(job_id: int, db: Session = Depends(get_session)) -> dict:
    job = db.get(CrawlJob, job_id)
    if job is None:
        raise HTTPException(404, "해당 수집 작업을 찾을 수 없습니다")
    return _job_view(job)


@router.delete("/api/crawl-jobs/{job_id}")
def delete_crawl_job(job_id: int, db: Session = Depends(get_session)) -> dict:
    """진행현황에서 잡 기록을 지운다.

    수집물(세션·오퍼레이션)은 건드리지 않는다 — 지우는 것은 "이런 수집을 돌렸다"
    는 기록뿐이다. 실패했거나 결과가 0인 시도가 쌓이면 정작 봐야 할 잡이 묻힌다.

    도는 중인 잡은 지우지 않는다. 스레드는 계속 돌면서 없는 행을 갱신하려 하고,
    화면에서는 사라졌는데 요청은 나가는 상태가 된다.
    """
    job = db.get(CrawlJob, job_id)
    if job is None:
        raise HTTPException(404, "해당 수집 작업을 찾을 수 없습니다")
    if job.status == "running":
        raise HTTPException(409, "아직 도는 중입니다. 끝난 뒤에 지울 수 있습니다")

    db.delete(job)
    db.commit()
    return {"deleted": True, "keptSession": job.session_id}


@router.get("/api/projects/{project_id}/portal-crawls")
def list_portal_crawls(project_id: int, db: Session = Depends(get_session)) -> list:
    rows = db.exec(
        select(CrawlJob).where(CrawlJob.project_id == project_id).order_by(CrawlJob.id.desc())
    ).all()
    return [_job_view(job) for job in rows]


class BulkActionIn(BaseModel):
    operationIds: list = []
    status: str = "ACTIVE"


@router.post("/api/recording-sessions/{session_id}/spec-actions")
def create_actions_bulk(session_id: int, payload: BulkActionIn,
                        db: Session = Depends(get_session)) -> dict:
    """수집한 오퍼레이션을 한 번에 액션으로 만든다.

    일괄 수집은 한 번에 수십 개를 모은다. 액션을 하나씩 눌러 만들게 하면
    수집을 자동화한 의미가 사라진다.

    같은 tool_name 이 이미 있으면 건너뛴다. 두 번 눌렀을 때 같은 도구가 겹쳐
    생기면 어느 쪽이 불릴지 순서에 좌우된다.
    """
    session_row = db.get(RecordingSession, session_id)
    if session_row is None:
        raise HTTPException(404, "해당 수집 세션을 찾을 수 없습니다")

    query = select(SpecOperation).where(SpecOperation.session_id == session_id)
    if payload.operationIds:
        query = query.where(SpecOperation.id.in_(payload.operationIds))
    operations = db.exec(query.order_by(SpecOperation.id)).all()

    existing = {
        row.tool_name
        for row in db.exec(
            select(Action).where(Action.project_id == session_row.project_id)
        ).all()
    }

    created, skipped = [], 0
    for op in operations:
        tool_name = _tool_name(op.op_name)
        if tool_name in existing:
            skipped += 1
            continue
        existing.add(tool_name)

        name = op.summary or op.op_name
        description = f"[{op.provider}] {op.service_name} — {op.op_name}".strip(" —[]")
        action = Action(
            project_id=session_row.project_id,
            name=name,
            tool_name=tool_name,
            description=description,
            action_spec=build_action_spec_from_spec(op, name=name, tool_name=tool_name,
                                                    description=description),
            status=payload.status,
            source_kind=session_row.kind or "portal",
        )
        db.add(action)
        created.append(action)
    db.commit()

    # 새 도구가 요구하는 키를 환경에 있는 값으로 채운다. 이미 등록된 것은 두고,
    # 환경에 없으면 아무 일도 하지 않는다.
    seed_credentials()

    return {
        "created": len(created),
        "skipped": skipped,
        "total": len(operations),
        "message": (
            f"액션 {len(created)}개를 만들었습니다"
            + (f" (이미 있는 {skipped}개는 건너뜀)" if skipped else "")
        ) if created else f"새로 만들 액션이 없습니다 (이미 있는 {skipped}개)",
    }


class PreviewIn(BaseModel):
    listUrl: str
    purpose: str = ""
    pages: int = 3


@router.post("/api/portal-crawls/preview")
def preview_portal_candidates(payload: PreviewIn) -> dict:
    """수집 전 후보를 보여주고, 적어 준 용도에 맞는 것만 추려 표시한다."""
    from app.services.api_matcher import extract_keyword, match
    from app.services.portal_crawler import (PortalUnreachable, is_supported_list_url,
                                              keyword_of, preview_candidates, replace_keyword)

    url = payload.listUrl.strip()
    if not is_supported_list_url(url):
        raise HTTPException(422, "아직 공공데이터포털(data.go.kr) 주소만 수집할 수 있습니다")

    # 사용자는 이 입력란을 검색창으로 쓴다. 적어 준 용도에서 검색어를 뽑아 포털을
    # 다시 검색한다 — 바깥 URL 의 검색어 결과를 좁히기만 하면 "날씨"라고 적어도
    # 미세먼지 목록 안에서만 고르게 되어 아무것도 안 나온다.
    keyword = extract_keyword(payload.purpose) if payload.purpose.strip() else ""
    search_url = replace_keyword(url, keyword) if keyword else url

    try:
        candidates = preview_candidates(search_url, pages=max(1, min(payload.pages, 5)))
    except PortalUnreachable as exc:
        # 502 로 구분한다. 사용자가 고쳐야 할 곳이 URL(422)이 아니라 네트워크다.
        raise HTTPException(502, str(exc)) from exc

    used = keyword or keyword_of(url)
    if not candidates:
        raise HTTPException(
            422,
            f"'{used}' 로 찾은 API 가 없습니다. 다른 표현으로 적어 보세요"
            if keyword else
            "이 주소에서 API 를 찾지 못했습니다. 검색 결과가 있는 목록 주소인지 확인해 주세요",
        )

    result = match(candidates, payload.purpose)
    # 어떤 낱말로 검색했는지 화면에 보여줘야 한다. 사용자가 적은 문장과 실제
    # 검색어가 다르면, 결과가 왜 이렇게 나왔는지 알 수 없다.
    result["keyword"] = used
    result["listUrl"] = search_url
    return result


# ── 문서 기반 수집 ───────────────────────────────────────────


@router.post("/api/projects/{project_id}/document-collections")
async def collect_documents(project_id: int, files: list[UploadFile] = File(...),
                            db: Session = Depends(get_session)) -> dict:
    """활용가이드 문서에서 API 명세를 뽑아 수집 세션으로 만든다.

    문서마다 결과를 따로 알려준다. 다섯 개를 올렸는데 하나가 실패했을 때
    "실패했습니다" 한 줄이면 어느 파일이 문제인지 알 수 없다.
    """
    from app.services.doc_collector import collect_from_document

    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")
    if not files:
        raise HTTPException(422, "분석할 문서를 선택해 주세요")

    now = datetime.utcnow()
    session_row = RecordingSession(
        project_id=project_id,
        started_at=now,
        ended_at=now,
        status="COMPLETED",
        kind="document",
        source_label=(files[0].filename or "문서") if len(files) == 1
                     else f"문서 {len(files)}개",
    )
    db.add(session_row)
    db.commit()
    db.refresh(session_row)

    reports, total = [], 0
    for upload in files:
        data = await upload.read()
        # 너무 큰 파일은 받지 않는다. 활용가이드는 보통 수백 KB 다.
        if len(data) > 12 * 1024 * 1024:
            reports.append({"file": upload.filename, "operations": 0,
                            "warnings": ["파일이 너무 큽니다 (12MB 초과)"]})
            continue

        result = collect_from_document(upload.filename or "문서", data)
        for op in result.operations:
            db.add(SpecOperation(
                session_id=session_row.id,
                portal="document",
                service_name=result.service_name,
                provider=result.provider,
                op_name=op["opName"],
                summary=op["summary"],
                method=op["method"],
                base_url=op["baseUrl"],
                path=op["path"],
                params=op["params"],
                response_fields=[],
                warnings=op["warnings"],
                source_url=upload.filename or "",
                parsed_at=now,
            ))
        total += len(result.operations)
        reports.append({
            "file": upload.filename,
            "serviceName": result.service_name,
            "provider": result.provider,
            "operations": len(result.operations),
            "warnings": result.warnings,
        })
    db.commit()

    # 아무것도 못 뽑았으면 빈 세션을 남기지 않는다. 목록만 지저분해진다.
    if total == 0:
        db.delete(session_row)
        db.commit()
        return {"sessionId": None, "operations": 0, "reports": reports,
                "message": "문서에서 API 명세를 찾지 못했습니다"}

    return {
        "sessionId": session_row.id,
        "operations": total,
        "reports": reports,
        "message": f"문서 {len(files)}개에서 API {total}개를 찾았습니다",
    }

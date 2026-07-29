# apps/backend/app/seed.py
"""촬영용 시드 데이터.
`_startup`에서 init_db() 다음으로 호출된다. 두 번 실행해도 중복 행이
생기지 않도록 이름(프로젝트) / (project_id, name) 조합(액션)으로 존재 여부를
먼저 확인한다.

액션은 실측된 국토교통부 실거래가 흐름(`/pt/gis/getMarker.do`, 영상 시나리오
5장면·8장면)을 그대로 반영한다. 개발 중 DB에 남은 `test`라는 이름의 액션이
화면에 나오면 제출물 신뢰도가 떨어지므로, 시드는 항상 사람이 읽을 수 있는
한국어 이름의 ACTIVE 액션을 만든다.
"""
from sqlmodel import Session, select
from app.db import engine
from app.models import Project, Action

SEEDS = [
    {"name": "국토교통부 실거래가", "allowed_origins": ["https://rt.molit.go.kr"]},
    {"name": "국가통계포털 KOSIS", "allowed_origins": ["https://kosis.kr"]},
]

# 영상 시나리오 8장면(콘솔 질의 "광화문 근처 아파트 단지 알려줘")까지 그대로
# 이어지도록, 5장면에서 1위(★9)로 뽑힌 getMarker.do 요청을 액션으로 미리
# 등록해 둔다. 파라미터 예시값은 실제 녹화 기록의 값이다.
ACTION_NAME = "아파트 단지 마커 조회"
ACTION_SPEC = {
    "name": ACTION_NAME,
    "toolName": "search_apartment_markers",
    "description": "지도 영역(경위도 바운딩 박스) 안의 아파트 단지 목록을 조회합니다.",
    "trigger": {"pageUrlPattern": "/pt/gis/getMarker.do"},
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "headers": {
            "Referer": "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=A&mobileAt=",
            "X-Requested-With": "XMLHttpRequest",
        },
        "querySchema": None,
        "bodySchema": {
            "minX": {"type": "number", "required": True, "llmEditable": True,
                      "description": "서쪽 경도", "example": 126.9654155},
            "minY": {"type": "number", "required": True, "llmEditable": True,
                      "description": "남쪽 위도", "example": 37.5606793},
            "maxX": {"type": "number", "required": True, "llmEditable": True,
                      "description": "동쪽 경도", "example": 126.9911647},
            "maxY": {"type": "number", "required": True, "llmEditable": True,
                      "description": "북쪽 위도", "example": 37.5720409},
            "srhYear": {"type": "integer", "required": True, "llmEditable": True,
                        "description": "조회 연도", "example": 2026},
            "poiType": {"type": "string", "required": True, "llmEditable": True,
                        "description": "물건 종류 코드", "example": "A"},
        },
    },
    "response": {"successStatus": [200], "schema": {"type": "object"}},
    "execution": {"authMode": "NONE", "credentialId": None, "requiresConfirmation": False},
}


def seed() -> None:
    with Session(engine) as db:
        for item in SEEDS:
            exists = db.exec(select(Project).where(Project.name == item["name"])).first()
            if not exists:
                db.add(Project(**item))
        db.commit()

        # 액션은 프로젝트가 먼저 커밋되어 id를 받은 뒤에 연결한다.
        molit = db.exec(
            select(Project).where(Project.name == "국토교통부 실거래가")
        ).first()
        if molit is not None:
            existing_action = db.exec(
                select(Action)
                .where(Action.project_id == molit.id)
                .where(Action.name == ACTION_NAME)
            ).first()
            if existing_action is None:
                db.add(Action(
                    project_id=molit.id,
                    name=ACTION_NAME,
                    tool_name="search_apartment_markers",
                    description=ACTION_SPEC["description"],
                    action_spec=ACTION_SPEC,
                    status="ACTIVE",   # llm-test가 ACTIVE만 조회하므로 DRAFT로 두면 콘솔에서 안 보인다
                ))
                db.commit()


# ── 포털 공개 기반 수집 시드 ──────────────────────────────────────
#
# 첫 화면부터 두 수집 방식이 섞여 보여야 "하나의 레지스트리로 모인다"가
# 화면으로 읽힌다. 다만 숫자를 지어내지 않는다 — 실제로 내려받아 둔 명세
# 페이지(tests/fixtures)를 **파서에 그대로 태워서** 만든다. 화면에 뜨는
# 오퍼레이션·파라미터 수는 전부 파싱 결과다.
from datetime import datetime
from pathlib import Path

from app.models import RecordingSession, SpecOperation
from app.services.spec_parser import parse

SPEC_FIXTURE = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "datagokr_airkorea.html"
SPEC_SOURCE_URL = "https://www.data.go.kr/data/15073861/openapi.do"
SPEC_PROJECT_NAME = "공공데이터포털 오픈API"


def seed_portal_spec() -> None:
    if not SPEC_FIXTURE.exists():
        # 픽스처가 없으면 조용히 건너뛴다. 시드 실패로 서버가 못 뜨는 편이 더 나쁘다.
        return

    page = parse(SPEC_FIXTURE.read_text(encoding="utf-8", errors="ignore"), SPEC_SOURCE_URL)
    if not page.operations:
        return

    with Session(engine) as db:
        project = db.exec(select(Project).where(Project.name == SPEC_PROJECT_NAME)).first()
        if project is None:
            project = Project(name=SPEC_PROJECT_NAME, allowed_origins=["https://www.data.go.kr"])
            db.add(project)
            db.commit()
            db.refresh(project)

        session_row = db.exec(
            select(RecordingSession)
            .where(RecordingSession.project_id == project.id)
            .where(RecordingSession.kind == "portal")
        ).first()
        if session_row is not None:
            return          # 이미 시드됨

        now = datetime.utcnow()
        session_row = RecordingSession(
            project_id=project.id,
            started_at=now,
            ended_at=now,
            status="COMPLETED",
            kind="portal",
            source_label=page.service_name,
        )
        db.add(session_row)
        db.commit()
        db.refresh(session_row)

        for op in page.operations:
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
                source_url=SPEC_SOURCE_URL,
                parsed_at=now,
            ))
        db.commit()

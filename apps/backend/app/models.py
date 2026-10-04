from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    # 목록 카드에 두 줄까지 보인다. 이름만으로는 무엇을 모아 둔 프로젝트인지
    # 알 수 없어, 시간이 지나면 자기가 만든 것도 구분하지 못한다.
    description: str = ""
    allowed_origins: list = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "ACTIVE"
    # 포털별 인증키. 포털 공개 기반 수집은 명세만 읽어서 키가 없기 때문에 따로 받아둔다.
    # {"data.go.kr": "발급받은 serviceKey"}
    credentials: dict = Field(default_factory=dict, sa_column=Column(JSON))

class RecordingSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str = "RECORDING"
    # 수집 방식. traffic=화면이 부른 API 관측, portal=포털이 공개한 명세 파싱,
    # document=활용가이드 문서 변환(Phase 2). 기본값이 traffic 이라 기존 기록은 그대로 동작한다.
    kind: str = "traffic"
    # 세션이 어느 대상에서 왔는지. traffic 이면 사이트 호스트, portal 이면 포털 키.
    source_label: str = ""

class SpecOperation(SQLModel, table=True):
    """포털 공개 기반 수집의 후보. 트래픽 수집의 NetworkRequest 와 같은 자리에 놓인다."""
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recordingsession.id")
    portal: str = ""
    service_name: str = ""
    provider: str = ""
    op_name: str = ""
    summary: str = ""
    method: str = "GET"
    base_url: str = ""
    path: str = ""
    params: list = Field(default_factory=list, sa_column=Column(JSON))
    response_fields: list = Field(default_factory=list, sa_column=Column(JSON))
    warnings: list = Field(default_factory=list, sa_column=Column(JSON))
    source_url: str = ""
    parsed_at: Optional[datetime] = None

class InteractionEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recordingsession.id")
    interaction_id: str = Field(index=True)
    event_type: str
    page_url: str
    element_selector: str
    element_text: str
    occurred_at: datetime

class NetworkRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recordingsession.id")
    interaction_id: Optional[str] = Field(default=None, index=True)
    request_url: str
    request_method: str
    request_headers: dict = Field(default_factory=dict, sa_column=Column(JSON))
    request_body: Optional[str] = None
    response_status: int
    response_preview: dict = Field(default_factory=dict, sa_column=Column(JSON))
    is_json: bool = False
    duration_ms: int
    occurred_at: datetime
    score: Optional[int] = None
    score_reasons: list = Field(default_factory=list, sa_column=Column(JSON))

class Action(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    # 어느 수집 방식에서 왔는지. traffic | portal | document.
    # 기존 액션은 traffic 이 되어 그대로 동작한다.
    source_kind: str = "traffic"
    name: str
    tool_name: str
    description: str = ""
    action_spec: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = "DRAFT"

class CrawlJob(SQLModel, table=True):
    """포털 일괄 수집 한 건. 수십 초가 걸리는 작업이라 상태를 남겨야
    화면이 진행 상황을 물어볼 수 있다."""
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    list_url: str = ""
    limit: int = 30
    status: str = "running"          # running | completed | failed
    phase: str = ""
    services_found: int = 0
    services_done: int = 0
    operations: int = 0
    current: str = ""
    message: str = ""
    session_id: Optional[int] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None



# ─────────────────────────────────────────────────────────────────────────────
# 마켓플레이스 — 카탈로그
#
# MCP 를 프로젝트 소유물이 아니라 "플랫폼이 진열한 상품"으로 승격한다.
# Action 은 여전히 프로젝트에 속하고, CatalogEntry 는 그 원본이 된다:
#   CatalogEntry(1) ─ CatalogTool(N)  ── 담기 ─▶  Action(N) in Project
#
# 수집 방식(kind)과 검증 이력을 여기에 함께 남기는 것이 핵심이다. 이걸 빠뜨리면
# 마켓 카드의 방식 배지도, 상세의 출처 표시도 나중에 되살릴 수 없다
# (전수 재수집을 해야 한다).
# ─────────────────────────────────────────────────────────────────────────────

class CatalogEntry(SQLModel, table=True):
    """마켓에 진열되는 MCP 한 묶음. 보통 기관·서비스 단위다."""
    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(index=True)          # kr.go.molit.rtms
    name: str
    description: str = ""
    provider: str = ""                     # 국토교통부 · 밸류맵
    mark: str = ""                         # 카드 좌측 모노그램 (2글자)
    category: str = "기타"                  # 부동산 · 통계·인구 · 기상·환경 …
    origin: str = "public"                 # public(공공) | private(민간)
    price_per_call: int = 0                # 원 단위. public 은 0
    version: str = "v1.0"
    tags: list = Field(default_factory=list, sa_column=Column(JSON))

    # ── 출처 (§6.6) ──
    kind: str = "portal"                   # portal | document | traffic
    source_url: str = ""
    collected_at: Optional[datetime] = None
    collect_seconds: int = 0
    verified_at: Optional[datetime] = None
    verified_ok: int = 0                   # 실호출 200 + 필드 확보
    verified_warn: int = 0                 # 200 이지만 0건/필수값 누락
    verified_fail: int = 0                 # 4xx·5xx

    # 인기 지표. "담긴 프로젝트 수"는 매번 세지 않고 담을 때 올린다.
    installs: int = 0


class CatalogTool(SQLModel, table=True):
    """카탈로그 항목에 들어 있는 도구 하나. 담으면 Action 으로 복제된다."""
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="catalogentry.id", index=True)
    name: str
    tool_name: str
    description: str = ""
    method: str = "GET"
    action_spec: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # verified | warn | fail — 상세 화면의 신호등
    verify_status: str = "verified"
    verify_note: str = ""


class ProjectCatalog(SQLModel, table=True):
    """어느 프로젝트가 어느 카탈로그를 담았는지. 마켓 카드의 '담김' 표시 근거."""
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    entry_id: int = Field(foreign_key="catalogentry.id", index=True)
    added_at: Optional[datetime] = None


class Skill(SQLModel, table=True):
    """MCP 를 순서대로 묶어 도구 하나처럼 부르는 레시피.

    EmberLink(climax) `src/apimcp/core/skills.py` 의 모델을 그대로 계승한다 —
    step 은 두 종류뿐(mcp | prompt)이고, {{input}} · {{steps[n].output}} 로
    앞 단계 결과를 참조한다. 실행 주체는 에이전트(LLM)이고 여기는 레시피만 든다.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str
    slug: str = ""
    description: str = ""
    tags: list = Field(default_factory=list, sa_column=Column(JSON))
    # [{"type":"mcp","tool_id":"12","args_template":{...}} | {"type":"prompt","text":"…"}]
    steps: list = Field(default_factory=list, sa_column=Column(JSON))
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CallLog(SQLModel, table=True):
    """실시간 호출 모니터(§6.1)가 읽는 최소 기록.

    본문은 남기지 않는다 — 파라미터와 응답을 저장하지 않는 것이 §3 의
    무저장 원칙이고, 나중에 빼는 것보다 처음부터 안 넣는 편이 쉽다.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(default=None, index=True)
    tool_name: str = ""
    kind: str = "mcp"                      # mcp | skill
    status: int = 200
    duration_ms: int = 0
    occurred_at: Optional[datetime] = Field(default=None, index=True)

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


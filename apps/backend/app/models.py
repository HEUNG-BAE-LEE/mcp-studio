from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    allowed_origins: list = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "ACTIVE"

class RecordingSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str = "RECORDING"

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
    name: str
    tool_name: str
    description: str = ""
    action_spec: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = "DRAFT"

"""스킬 — MCP 를 순서대로 묶어 도구 하나처럼 부른다.

EmberLink(climax) `src/apimcp/core/skills.py` 의 모델과 정책을 계승한다.

  - step 은 두 종류뿐이다: `mcp`(도구 1회 호출) · `prompt`(사이에 끼우는 지시문)
  - `{{input}}` · `{{steps[n].output}}` 로 앞 단계 결과를 참조한다
  - `/slug` 로 부른다

우리가 더한 것은 **1회 실행 비용**이다. 스킬은 MCP 를 정해진 횟수만큼 부르므로
LLM 이 자유롭게 고를 때와 달리 비용이 예측 가능하다 — 유료 MCP 를 쓰는
사용자에게 스킬은 기능이 아니라 비용 통제 수단이 된다.
"""
import re
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import engine
from app.models import Action, CatalogEntry, CatalogTool, ProjectCatalog, Skill

router = APIRouter(prefix="/api", tags=["skills"])

# 한글을 지우지 않는다. climax 는 a-z0-9- 만 남기는데, 우리 스킬 이름은 대부분
# 한국어라 그대로 쓰면 전부 "skill" 로 뭉개진다 — /지역-투자-브리핑 이
# /skill 보다 부르기에도 읽기에도 낫다. 공백과 URL 에서 뜻이 달라지는
# 글자만 걷어낸다.
_SLUG_RE = re.compile(r"[\s/?#&=+%\\.,:;'\"()\[\]{}<>!@$^*|~`]+")
_VAR = re.compile(r"\{\{\s*(.*?)\s*\}\}")
_STEP_RE = re.compile(r"^steps\[(\d+)\]\.output")


def slugify(text: str) -> str:
    s = _SLUG_RE.sub("-", text.strip().lower()).strip("-")
    return s or "skill"


class StepIn(BaseModel):
    type: str                       # mcp | prompt
    tool_id: str | None = None      # mcp 필수 — Action.id
    args_template: dict = {}
    text: str = ""


class SkillIn(BaseModel):
    name: str
    slug: str = ""
    description: str = ""
    tags: list[str] = []
    steps: list[StepIn] = []
    enabled: bool = True


def _validate(steps: list[StepIn]) -> None:
    """저장 전에 막는다. 잘못된 스킬은 실행 시점에 조용히 빈 응답을 내는데,
    그때는 원인을 찾기 어렵다."""
    if not steps:
        raise HTTPException(422, "최소 1개 step 이 필요합니다")

    for i, s in enumerate(steps):
        if s.type not in ("mcp", "prompt"):
            raise HTTPException(422, f"{i + 1}번째 step 의 종류가 잘못됐습니다")
        if s.type == "mcp" and not s.tool_id:
            raise HTTPException(422, f"{i + 1}번째 step 에 도구가 선택되지 않았습니다")
        if s.type == "prompt" and not s.text.strip():
            raise HTTPException(422, f"{i + 1}번째 프롬프트가 비어 있습니다")

        # 앞 단계만 참조할 수 있다. 뒤를 가리키면 실행 순서상 값이 없다.
        blob = s.text + str(s.args_template)
        for expr in _VAR.findall(blob):
            m = _STEP_RE.match(expr.strip())
            if m and int(m.group(1)) >= i:
                raise HTTPException(
                    422, f"{i + 1}번째 step 이 아직 실행되지 않은 {m.group(0)} 를 참조합니다")


def _row(db: Session, s: Skill) -> dict:
    """스킬 한 줄. 화면이 필요한 것은 파이프라인 모양과 1회 실행 비용이다."""
    tools, cost, missing = [], 0, 0
    for st in s.steps:
        if st.get("type") != "mcp":
            continue
        a = db.get(Action, int(st["tool_id"])) if str(st.get("tool_id", "")).isdigit() else None
        if not a:
            missing += 1
            continue
        tools.append({"id": a.id, "name": a.name, "toolName": a.tool_name})
        # 이 도구가 어느 카탈로그에서 왔는지 찾아 단가를 더한다
        ct = db.exec(select(CatalogTool).where(CatalogTool.tool_name == a.tool_name)).first()
        if ct:
            e = db.get(CatalogEntry, ct.entry_id)
            if e:
                cost += e.price_per_call

    return {
        "id": s.id, "projectId": s.project_id, "name": s.name, "slug": s.slug,
        "description": s.description, "tags": s.tags, "steps": s.steps,
        "enabled": s.enabled,
        "shape": [st.get("type") for st in s.steps],   # 카드의 teal·purple 도트
        "stepCount": len(s.steps),
        "tools": tools,
        "costPerRun": cost,
        "missingTools": missing,
        "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/projects/{project_id}/skills")
def list_skills(project_id: int, q: str = "") -> list[dict]:
    with Session(engine) as db:
        rows = db.exec(select(Skill).where(Skill.project_id == project_id)).all()
        if q:
            n = q.lower()
            rows = [s for s in rows if n in s.name.lower() or n in s.slug.lower()
                    or n in s.description.lower() or any(n in t.lower() for t in s.tags)]
        rows.sort(key=lambda s: s.updated_at or datetime.min, reverse=True)
        return [_row(db, s) for s in rows]


@router.post("/projects/{project_id}/skills")
def create_skill(project_id: int, body: SkillIn) -> dict:
    _validate(body.steps)
    with Session(engine) as db:
        slug = body.slug.strip() or slugify(body.name)
        if db.exec(select(Skill).where(Skill.project_id == project_id,
                                       Skill.slug == slug)).first():
            raise HTTPException(409, f"이미 /{slug} 를 쓰는 스킬이 있습니다")
        now = datetime.utcnow()
        s = Skill(project_id=project_id, name=body.name.strip(), slug=slug,
                  description=body.description.strip(), tags=body.tags,
                  steps=[st.model_dump() for st in body.steps], enabled=body.enabled,
                  created_at=now, updated_at=now)
        db.add(s)
        db.commit()
        db.refresh(s)
        return _row(db, s)


@router.put("/skills/{skill_id}")
def update_skill(skill_id: int, body: SkillIn) -> dict:
    _validate(body.steps)
    with Session(engine) as db:
        s = db.get(Skill, skill_id)
        if not s:
            raise HTTPException(404, "없는 스킬입니다")
        slug = body.slug.strip() or slugify(body.name)
        dup = db.exec(select(Skill).where(Skill.project_id == s.project_id,
                                          Skill.slug == slug)).first()
        if dup and dup.id != skill_id:
            raise HTTPException(409, f"이미 /{slug} 를 쓰는 스킬이 있습니다")
        s.name, s.slug = body.name.strip(), slug
        s.description, s.tags = body.description.strip(), body.tags
        s.steps = [st.model_dump() for st in body.steps]
        s.enabled = body.enabled
        s.updated_at = datetime.utcnow()
        db.add(s)
        db.commit()
        db.refresh(s)
        return _row(db, s)


@router.delete("/skills/{skill_id}")
def delete_skill(skill_id: int) -> dict:
    with Session(engine) as db:
        s = db.get(Skill, skill_id)
        if not s:
            raise HTTPException(404, "없는 스킬입니다")
        db.delete(s)
        db.commit()
        return {"deleted": skill_id}


@router.get("/projects/{project_id}/skill-palette")
def palette(project_id: int) -> list[dict]:
    """빌더 좌측 팔레트 — 이 프로젝트에 담긴 도구.

    유료 여부를 함께 실어 보낸다. 유료 MCP 가 섞이면 스킬 1회 실행 비용이
    붙으므로, 담기 전에 팔레트에서 구분돼야 한다.
    """
    with Session(engine) as db:
        price = {}
        for l in db.exec(select(ProjectCatalog).where(
                ProjectCatalog.project_id == project_id)).all():
            e = db.get(CatalogEntry, l.entry_id)
            if not e:
                continue
            for t in db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all():
                price[t.tool_name] = (e.price_per_call, e.kind, e.name)

        out = []
        for a in db.exec(select(Action).where(Action.project_id == project_id)).all():
            p, kind, entry = price.get(a.tool_name, (0, a.source_kind, ""))
            out.append({
                "id": a.id, "name": a.name, "toolName": a.tool_name,
                "method": (a.action_spec or {}).get("request", {}).get("method", "GET"),
                "description": a.description, "pricePerCall": p, "kind": kind, "entry": entry,
            })
        return out


@router.get("/projects/{project_id}/skill-suggest")
def suggest(project_id: int) -> dict:
    """담긴 MCP 만으로 바로 도는 스킬 제안(§6.9).

    제안은 근거가 있을 때만 낸다 — 도구가 2개 미만이면 묶을 것이 없으므로
    아무것도 내보내지 않는다. 빈 추천 카드는 화면만 차지한다.
    """
    with Session(engine) as db:
        actions = db.exec(select(Action).where(Action.project_id == project_id)).all()
        if len(actions) < 2:
            return {"items": []}

        have = {s.slug for s in db.exec(
            select(Skill).where(Skill.project_id == project_id)).all()}
        first, second = actions[0], actions[1]
        proposal = {
            "name": f"{first.name} 브리핑",
            "slug": slugify(f"{first.tool_name}-brief"),
            "description": f"{first.name} 와 {second.name} 를 묶어 한 번에 정리합니다.",
            "why": "담긴 MCP 만으로 바로 동작",
            "steps": [
                {"type": "mcp", "tool_id": str(first.id), "args_template": {}, "text": ""},
                {"type": "prompt", "tool_id": None, "args_template": {},
                 "text": "{{steps[0].output}} 를 표로 정리하고 눈에 띄는 값을 짚어라"},
                {"type": "mcp", "tool_id": str(second.id), "args_template": {}, "text": ""},
                {"type": "prompt", "tool_id": None, "args_template": {},
                 "text": "{{steps[1].output}} 와 {{steps[2].output}} 를 합쳐 브리핑을 쓰라"},
            ],
        }
        if proposal["slug"] in have:
            return {"items": []}
        return {"items": [proposal]}

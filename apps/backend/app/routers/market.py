"""마켓플레이스 — 카탈로그 조회 · 장바구니 전송 · 맥락 검색 · 홈 집계.

핵심 결정 두 가지가 코드에 박혀 있다.

1. **담기는 복제다.** 카탈로그를 프로젝트에 담으면 CatalogTool 을 Action 으로
   복사한다. 참조로 두면 카탈로그가 갱신될 때 프로젝트가 말없이 바뀌는데,
   에이전트가 쓰는 도구가 예고 없이 변하는 건 사고다.

2. **중복은 막지 않고 건너뛴다.** 여러 프로젝트에 한 번에 보낼 때 이미 담긴
   것이 섞여 있어도 전송을 거절하지 않는다. 그 항목만 빼고 나머지를 보낸 뒤
   결과를 알려준다 — 무엇을 빼야 하는지 사용자가 직접 찾게 만들지 않는다.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import engine
from app.models import (
    Action, CallLog, CatalogEntry, CatalogTool, Project, ProjectCatalog, Skill,
)

router = APIRouter(prefix="/api", tags=["market"])


# ── 직렬화 ──────────────────────────────────────────────────────────────────

def _entry_row(e: CatalogEntry, tools: int, picked: bool) -> dict:
    return {
        "id": e.id, "slug": e.slug, "name": e.name, "description": e.description,
        "provider": e.provider, "mark": e.mark, "category": e.category,
        "origin": e.origin, "pricePerCall": e.price_per_call, "version": e.version,
        "tags": e.tags, "kind": e.kind, "tools": tools, "installs": e.installs,
        "inProject": picked,
    }


def _picked_ids(db: Session, project_id: int | None) -> set[int]:
    if project_id is None:
        return set()
    rows = db.exec(select(ProjectCatalog).where(ProjectCatalog.project_id == project_id)).all()
    return {r.entry_id for r in rows}


# ── 목록 · 패싯 ─────────────────────────────────────────────────────────────

@router.get("/catalog")
def list_catalog(
    q: str = "", origin: str = "", category: str = "", kind: str = "",
    sort: str = "popular", project_id: int | None = None,
) -> dict:
    """마켓 목록. 패싯은 필터가 걸린 뒤에도 전체 기준으로 센다 —
    필터를 좁힐수록 다른 항목의 개수가 0 으로 보이면 되돌아갈 길이 사라진다."""
    with Session(engine) as db:
        entries = db.exec(select(CatalogEntry)).all()
        counts = {e.id: len(db.exec(
            select(CatalogTool).where(CatalogTool.entry_id == e.id)).all()) for e in entries}
        picked = _picked_ids(db, project_id)

        facets = {
            "origin": {"public": 0, "private": 0},
            "kind": {"portal": 0, "document": 0, "traffic": 0},
            "category": {},
            "total": len(entries),
            "tools": sum(counts.values()),
            "inProject": len(picked),
        }
        for e in entries:
            facets["origin"][e.origin] = facets["origin"].get(e.origin, 0) + 1
            facets["kind"][e.kind] = facets["kind"].get(e.kind, 0) + 1
            facets["category"][e.category] = facets["category"].get(e.category, 0) + 1

        needle = q.strip().lower()
        rows = [
            e for e in entries
            if (not origin or e.origin == origin)
            and (not category or e.category == category)
            and (not kind or e.kind == kind)
            and (not needle or needle in e.name.lower() or needle in e.description.lower()
                 or needle in e.provider.lower() or any(needle in t.lower() for t in e.tags))
        ]

        if sort == "recent":
            rows.sort(key=lambda e: e.collected_at or datetime.min, reverse=True)
        elif sort == "name":
            rows.sort(key=lambda e: e.name)
        else:
            rows.sort(key=lambda e: e.installs, reverse=True)

        return {
            "items": [_entry_row(e, counts[e.id], e.id in picked) for e in rows],
            "facets": facets,
        }


@router.get("/catalog/{slug}")
def get_catalog(slug: str, project_id: int | None = None) -> dict:
    """상세. 출처(§6.6)를 함께 싣는다 — 이 화면이 '어떻게 만들어졌나'를 답한다."""
    with Session(engine) as db:
        e = db.exec(select(CatalogEntry).where(CatalogEntry.slug == slug)).first()
        if not e:
            raise HTTPException(404, "카탈로그에 없는 MCP 입니다")
        tools = db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all()
        row = _entry_row(e, len(tools), e.id in _picked_ids(db, project_id))
        row["source"] = {
            "kind": e.kind,
            "url": e.source_url,
            "collectedAt": e.collected_at.isoformat() if e.collected_at else None,
            "collectSeconds": e.collect_seconds,
            "verifiedAt": e.verified_at.isoformat() if e.verified_at else None,
            "ok": e.verified_ok, "warn": e.verified_warn, "fail": e.verified_fail,
        }
        row["toolList"] = [
            {"id": t.id, "name": t.name, "toolName": t.tool_name, "method": t.method,
             "description": t.description, "verify": t.verify_status, "note": t.verify_note}
            for t in tools
        ]
        return row


# ── 장바구니 → 복수 프로젝트 전송 ────────────────────────────────────────────

class Dispatch(BaseModel):
    entryIds: list[int]
    projectIds: list[int] = []
    newProjectName: str = ""


@router.post("/catalog/dispatch")
def dispatch(body: Dispatch) -> dict:
    """담은 카탈로그를 프로젝트 여러 곳에 보낸다."""
    if not body.entryIds:
        raise HTTPException(422, "보낼 MCP 가 없습니다")

    with Session(engine) as db:
        targets = list(body.projectIds)

        # "새 프로젝트 만들어 보내기" — 마켓을 떠나지 않고 프로젝트를 만든다.
        if body.newProjectName.strip():
            name = body.newProjectName.strip()
            existing = db.exec(select(Project).where(Project.name == name)).first()
            if existing:
                targets.append(existing.id)
            else:
                p = Project(name=name, description="마켓에서 만든 프로젝트")
                db.add(p)
                db.commit()
                db.refresh(p)
                targets.append(p.id)

        if not targets:
            raise HTTPException(422, "보낼 프로젝트를 골라 주세요")

        results, added_total, skipped_total = [], 0, 0
        for pid in dict.fromkeys(targets):          # 중복 선택 제거
            project = db.get(Project, pid)
            if not project:
                continue
            have = _picked_ids(db, pid)
            added, skipped = 0, 0

            for eid in body.entryIds:
                if eid in have:
                    skipped += 1
                    continue
                entry = db.get(CatalogEntry, eid)
                if not entry:
                    continue

                # 담기 = 복제. 카탈로그가 나중에 바뀌어도 프로젝트는 그대로다.
                for t in db.exec(select(CatalogTool).where(CatalogTool.entry_id == eid)).all():
                    db.add(Action(
                        project_id=pid, source_kind=entry.kind, name=t.name,
                        tool_name=t.tool_name, description=t.description,
                        action_spec=t.action_spec, status="ACTIVE",
                    ))
                db.add(ProjectCatalog(project_id=pid, entry_id=eid, added_at=datetime.utcnow()))
                entry.installs += 1
                db.add(entry)
                added += 1

            db.commit()
            added_total += added
            skipped_total += skipped
            results.append({"projectId": pid, "projectName": project.name,
                            "added": added, "skipped": skipped})

        return {"results": results, "added": added_total, "skipped": skipped_total,
                "projects": len(results)}


@router.delete("/projects/{project_id}/catalog/{entry_id}")
def remove_from_project(project_id: int, entry_id: int) -> dict:
    """프로젝트에서 빼기. 담을 때 복제한 Action 도 함께 지운다."""
    with Session(engine) as db:
        link = db.exec(select(ProjectCatalog).where(
            ProjectCatalog.project_id == project_id,
            ProjectCatalog.entry_id == entry_id)).first()
        if not link:
            raise HTTPException(404, "이 프로젝트에 담기지 않은 MCP 입니다")

        names = {t.tool_name for t in db.exec(
            select(CatalogTool).where(CatalogTool.entry_id == entry_id)).all()}
        removed = 0
        for a in db.exec(select(Action).where(Action.project_id == project_id)).all():
            if a.tool_name in names:
                db.delete(a)
                removed += 1
        db.delete(link)
        db.commit()
        return {"removedActions": removed}


@router.get("/projects/{project_id}/catalog")
def project_catalog(project_id: int) -> list[dict]:
    """프로젝트에 담긴 카탈로그. 대시보드의 'MCP 목록'."""
    with Session(engine) as db:
        links = db.exec(select(ProjectCatalog).where(
            ProjectCatalog.project_id == project_id)).all()
        out = []
        for l in links:
            e = db.get(CatalogEntry, l.entry_id)
            if not e:
                continue
            tools = len(db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all())
            out.append(_entry_row(e, tools, True))
        return out


# ── 맥락 검색 ───────────────────────────────────────────────────────────────

_STOP = {"알려줘", "보고", "싶어", "싶다", "하고", "해줘", "좀", "관련", "정보", "데이터",
         "그리고", "같이", "함께", "조회", "찾아", "필요", "해서", "에서", "으로", "이랑", "랑"}


def _keywords(text: str) -> list[str]:
    """질의에서 검색어를 뽑는다.

    형태소 분석기를 붙이지 않는다. 한국어 조사는 뒤에 붙으므로, 어절을 그대로
    두고 부분일치로 맞추면 "실거래가랑" 도 "실거래가" 에 걸린다. 사전을 들이는
    비용 대비 이득이 없다.
    """
    out = []
    for raw in text.replace(",", " ").split():
        w = raw.strip("·.?!\"'()[]")
        if len(w) < 2 or w in _STOP:
            continue
        # 조사를 떼어 본다. "실거래가랑" → "실거래가" 처럼 어절 끝에서 잘라야
        # 부분일치가 걸린다. 두 글자 조사를 먼저 보고, 없으면 한 글자를 본다.
        for josa in ("이랑", "에서", "으로", "까지", "부터", "에게"):
            if len(w) > len(josa) + 1 and w.endswith(josa):
                w = w[: -len(josa)]
                break
        else:
            if len(w) > 2 and w[-1] in "은는이가을를의도와과로랑만에":
                w = w[:-1]
        if w and w not in out:
            out.append(w)
    return out[:6]


def _score(text: str, keys: list[str]) -> float:
    """RRF 흉내. 맞은 검색어 비율 + 앞쪽 검색어 가중.

    진짜 RRF(키워드 순위와 벡터 순위를 합치는 방식)는 임베딩 색인이 필요하다.
    지금은 색인이 없으므로 어휘 일치만 쓰되, 화면이 기대하는 0~1 점수 형태를
    맞춰 둔다 — 나중에 벡터를 붙일 때 이 함수만 갈아끼우면 된다.
    """
    low = text.lower()
    hit = sum(1 for i, k in enumerate(keys) if k.lower() in low)
    if not hit:
        return 0.0
    lead = 0.12 if keys and keys[0].lower() in low else 0.0
    return min(0.99, 0.55 + 0.4 * (hit / max(1, len(keys))) + lead)


@router.get("/search")
def search(q: str, project_id: int | None = None, limit: int = 8) -> dict:
    """스킬 → MCP → 도구 순으로 묶어 돌려준다.

    스킬이 맨 위인 이유: 사용자가 원하는 것은 대개 "이 일을 해줘"지
    "이 API 를 줘"가 아니다. 완성된 답이 먼저, 재료가 나중이다.
    """
    keys = _keywords(q)
    if not keys:
        return {"intent": [], "skills": [], "entries": [], "tools": [], "total": 0}

    with Session(engine) as db:
        picked = _picked_ids(db, project_id)

        skills = []
        for s in db.exec(select(Skill).where(Skill.enabled == True)).all():  # noqa: E712
            sc = _score(f"{s.name} {s.description} {' '.join(s.tags)}", keys)
            if sc:
                skills.append({"id": s.id, "name": s.name, "slug": s.slug,
                               "description": s.description, "steps": len(s.steps),
                               "projectId": s.project_id, "score": round(sc, 4)})

        entries, tools = [], []
        for e in db.exec(select(CatalogEntry)).all():
            sc = _score(f"{e.name} {e.description} {e.provider} {' '.join(e.tags)}", keys)
            if sc:
                n = len(db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all())
                row = _entry_row(e, n, e.id in picked)
                row["score"] = round(sc, 4)
                entries.append(row)
            for t in db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all():
                ts = _score(f"{t.name} {t.description} {t.tool_name}", keys)
                if ts:
                    tools.append({"id": t.id, "name": t.name, "toolName": t.tool_name,
                                  "method": t.method, "entry": e.name, "slug": e.slug,
                                  "score": round(ts, 4)})

        for arr in (skills, entries, tools):
            arr.sort(key=lambda r: r["score"], reverse=True)

        return {
            "intent": keys,
            "skills": skills[:3],
            "entries": entries[:limit],
            "tools": tools[:limit],
            "total": len(skills) + len(entries) + len(tools),
        }


@router.get("/recommend")
def recommend(text: str = "", project_id: int | None = None, limit: int = 4) -> dict:
    """온보딩·홈의 AI 추천. 근거 없는 추천은 내보내지 않는다(§6.3).

    설명 문장에서 뽑은 검색어를 그대로 '근거 칩'으로 돌려준다. 무엇 때문에
    이걸 골랐는지 화면이 말할 수 없으면 추천을 표시하지 않는 편이 낫다.
    """
    keys = _keywords(text)
    with Session(engine) as db:
        picked = _picked_ids(db, project_id)
        rows = []
        for e in db.exec(select(CatalogEntry)).all():
            if e.id in picked:
                continue
            hay = f"{e.name} {e.description} {e.provider} {e.category} {' '.join(e.tags)}"
            sc = _score(hay, keys) if keys else 0.0
            why = next((k for k in keys if k.lower() in hay.lower()), "")
            if sc:
                n = len(db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all())
                row = _entry_row(e, n, False)
                row["why"] = why
                row["score"] = round(sc, 4)
                rows.append(row)

        rows.sort(key=lambda r: r["score"], reverse=True)

        # 설명이 비었거나 아무것도 안 걸리면 인기순으로 채운다. 위자드 2단계가
        # 텅 비면 사용자가 다음으로 갈 수 없다.
        if len(rows) < limit:
            have = {r["id"] for r in rows}
            fallback = sorted(db.exec(select(CatalogEntry)).all(),
                              key=lambda e: e.installs, reverse=True)
            for e in fallback:
                if len(rows) >= limit or e.id in have or e.id in picked:
                    continue
                n = len(db.exec(select(CatalogTool).where(CatalogTool.entry_id == e.id)).all())
                row = _entry_row(e, n, False)
                row["why"] = "많이 담긴 MCP"
                row["score"] = 0.0
                rows.append(row)

        return {"intent": keys, "items": rows[:limit]}


# ── 홈 집계 · 실시간 모니터 ──────────────────────────────────────────────────

@router.get("/home")
def home() -> dict:
    """플랫폼 홈(§6.1)이 답해야 할 세 질문의 데이터."""
    with Session(engine) as db:
        projects = db.exec(select(Project)).all()
        rows = []
        for p in projects:
            cats = db.exec(select(ProjectCatalog).where(
                ProjectCatalog.project_id == p.id)).all()
            kinds, tools = [], 0
            for c in cats:
                e = db.get(CatalogEntry, c.entry_id)
                if not e:
                    continue
                if e.kind not in kinds:
                    kinds.append(e.kind)
                tools += len(db.exec(
                    select(CatalogTool).where(CatalogTool.entry_id == e.id)).all())
            skills = db.exec(select(Skill).where(Skill.project_id == p.id)).all()
            calls = db.exec(select(CallLog).where(CallLog.project_id == p.id)).all()
            rows.append({
                "id": p.id, "name": p.name, "description": p.description,
                "mcps": len(cats), "tools": tools, "skills": len(skills),
                "kinds": kinds, "calls": len(calls),
            })
        rows.sort(key=lambda r: r["calls"], reverse=True)

        total_calls = sum(r["calls"] for r in rows)
        ok = len(db.exec(select(CallLog).where(CallLog.status < 400)).all())
        return {
            "projects": rows,
            "totals": {
                "projects": len(rows),
                "mcps": sum(r["mcps"] for r in rows),
                "skills": sum(r["skills"] for r in rows),
                "calls": total_calls,
                "successRate": round(100 * ok / total_calls, 1) if total_calls else 100.0,
            },
        }


@router.get("/metrics/live")
def metrics_live() -> dict:
    """실시간 호출 모니터. 본문은 남기지 않으므로 여기서도 나가지 않는다(§3).

    폴링 대신 SSE 를 쓰는 게 원칙이지만, 화면이 필요한 것은 집계값 몇 개뿐이라
    한 번의 요청으로 끝나는 형태를 유지한다. 스트림 전환은 이 응답 모양을
    그대로 흘려보내면 되도록 맞춰 두었다.
    """
    with Session(engine) as db:
        now = datetime.utcnow()
        logs = db.exec(select(CallLog)).all()
        recent = [l for l in logs if l.occurred_at and l.occurred_at > now - timedelta(minutes=5)]

        # 최근 5분을 20구간으로 — 그래프의 점 개수
        buckets = [0] * 20
        for l in recent:
            idx = int((l.occurred_at - (now - timedelta(minutes=5))).total_seconds() / 15)
            buckets[min(19, max(0, idx))] += 1

        # 최근 60초를 24칸으로 — 막대. 실패를 따로 세야 붉게 칠할 수 있다
        bars = []
        for i in range(24):
            lo = now - timedelta(seconds=60 - i * 2.5)
            hi = lo + timedelta(seconds=2.5)
            seg = [l for l in logs if l.occurred_at and lo <= l.occurred_at < hi]
            bars.append({
                "n": len(seg),
                "fail": sum(1 for l in seg if l.status >= 400),
                "skill": sum(1 for l in seg if l.kind == "skill"),
            })

        last = sorted([l for l in logs if l.occurred_at],
                      key=lambda l: l.occurred_at, reverse=True)[:6]
        names = {p.id: p.name for p in db.exec(select(Project)).all()}
        ok = sum(1 for l in logs if l.status < 400)
        durations = sorted(l.duration_ms for l in logs) or [0]

        return {
            "rps": round(len(recent) / 300, 2),
            "series": buckets,
            "bars": bars,
            "today": len(logs),
            "successRate": round(100 * ok / len(logs), 1) if logs else 100.0,
            "p95": durations[int(len(durations) * 0.95) - 1] if durations else 0,
            "stream": [
                {"tool": l.tool_name, "kind": l.kind, "status": l.status,
                 "ms": l.duration_ms, "project": names.get(l.project_id, "")}
                for l in last
            ],
        }

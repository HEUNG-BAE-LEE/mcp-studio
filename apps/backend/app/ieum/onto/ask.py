"""AI 질의 테스트: 질문 하나가 공개한 온톨로지에서 어떻게 풀리는지 단계별로 보여 준다.

질문은 계획(plan)으로 바뀐다. 계획은 단계 목록이고, 단계는 온톨로지 질의 엔진(query.py)과 액션(actions.py)으로 실제로 실행된다 —
SQL 도, 건수도, 권한이 걸러 낸 결과도 전부 진짜다. 단계 모양:
  identify  실행 사용자를 직원 객체로 확인          search  객체를 조건으로 찾기                get  기본키로 한 건
  follow    링크 따라가기(DB 사이도 된다)              filter  지금 집합에 조건 더하기            read  행 읽기(권한 적용)
  aggregate 건수·합계 집계                             calc    읽은 값으로 계산                    action 액션 실행(쓰기는 사용자 확인 뒤)
권한은 단계 사이에 자동으로 끼어든다: 객체에 권한 규칙이 있으면 읽거나 집계하기 전에 '권한 적용' 단계가 어떤 행·속성이 걸러졌는지 보여 준다.
(앞쪽 단계의 건수는 권한 적용 전 값이다. 이 화면은 관리자가 동작을 이해하려는 곳이고, 실제 AI 에게는 권한을 적용한 결과만 간다.)
질문을 계획으로 바꾸는 길은 둘이다. 정해 둔 질문 셋은 규칙으로 만든 계획이라 늘 같게 풀리고, 자유 질문은 GPT 설정이 있을 때 모델이 계획을 만든다
(계획은 같은 엔진으로 실행되므로 모델이 지어낸 값이 결과에 섞이지 않는다). 답 문장은 정해 둔 질문은 템플릿으로, 자유 질문은 모델이 실제 결과를 보고 쓴다.
"""
import json
import re
from typing import Any, Dict, List, Optional

from app.ieum.gateway import llm
from app.ieum.onto import actions, conn as dbconn
from app.ieum.onto import dictionary as dic
from app.ieum.onto import perm, query, store

CANNED = [
    {"id": "q1", "q": "한빛상사에 이번 달 승인 대기 중인 발주 총액 얼마야?"},
    {"id": "q2", "q": "우리 팀 올해 구매 예산 얼마 남았어?"},
    {"id": "q3", "q": "PO-2609-0142 승인해 줘"},
]
MAX_STEPS = 10


class AskError(ValueError):
    """사용자에게 그대로 보일 오류"""


def users() -> List[dict]:
    """질문을 실행할 사용자 후보(설정의 askUsers 사번을 직원 객체에서 읽은 것)"""
    out = []
    for emp in store.settings().get("askUsers") or []:
        u = perm.identify(emp)
        if u:
            out.append(u)
    return out


def status() -> dict:
    """화면 머리말: 공개한 온톨로지 목록과 자유 질문 가능 여부"""
    pubs = []
    for c in store.conns.load():
        vers = store.versions.load().get(c["id"]) or []
        if vers:
            pubs.append({"id": c["id"], "name": c["name"], "clr": c["clr"], "ver": vers[-1]["ver"], "objects": len(vers[-1]["snapshot"]["objects"])})
    return {"published": pubs, "free": llm.provider() is not None, "provider": llm.provider(), "questions": CANNED, "users": users(), "asOf": store.as_of(), "demo": bool(store.settings().get("demo"))}


# ── 단계 블록 ──────────────────────────────────────────────────────────────

def J(v: Any) -> dict:
    return {"t": "json", "v": v}


def SQL(v: str) -> dict:
    return {"t": "sql", "v": v}


def RULES(items: List[tuple]) -> dict:
    """items: (문장, 보조 설명, 막힘 여부)"""
    return {"t": "rules", "v": [{"text": a, "em": b, "deny": bool(c)} for a, b, c in items]}


def RES(v: str) -> dict:
    return {"t": "res", "v": v}


def _conn_label(obj: dict) -> str:
    if obj["kind"] == "mart":
        return "이음 마트"
    c = dbconn.get(obj["conn"])
    return c["name"] if c else obj["conn"]


def _n(v: Any) -> str:
    return dic.fmt_num(v)


# ── 실행 ───────────────────────────────────────────────────────────────────

class Run:
    def __init__(self, ctx_user: query.Ctx, ctx_admin: query.Ctx, user: dict, approved: Optional[bool], text: str, inputs: Optional[dict] = None) -> None:
        self.cu, self.ca, self.user, self.approved, self.text = ctx_user, ctx_admin, user, approved, text
        self.inputs = inputs or {}
        self.vars: Dict[str, dict] = {}
        self.steps: List[dict] = []
        self.answer: Optional[str] = None
        self.pending: Optional[dict] = None
        self.stop = False
        self.perm_done: set = set()
        self.executed: Optional[dict] = None
        self.blocked: Optional[dict] = None

    # --- 공통
    def add(self, k: str, title: str, who: str, *blocks: dict) -> dict:
        s = {"k": k, "title": title, "who": who, "blocks": [b for b in blocks if b]}
        self.steps.append(s)
        return s

    def fail(self, why: str, title: str = "실행할 수 없어요", who: str = "") -> None:
        self.add("fail", title, who, RES(why))
        self.answer = why
        self.stop = True

    def _need(self, name: str) -> dict:
        v = self.vars.get(name)
        if v is None:
            raise AskError("계획이 아직 만들지 않은 집합 %s 를 가리켜요." % name)
        return v

    def _obj(self, ref: str) -> dict:
        return self.cu.find_object(ref)

    def _pair(self, obj: dict) -> tuple:
        return query.Q(self.cu, obj), query.Q(self.ca, obj)

    def _user_label(self) -> str:
        u = self.user
        return "%s, %s %s" % (u["name"], u.get("deptName") or u.get("dept"), u.get("rank"))

    # --- 권한 단계(읽거나 집계하기 전에 한 번)
    def perm_step(self, v: dict) -> None:
        obj = v["q"].obj
        if obj["id"] in self.perm_done or not obj.get("perm"):
            return
        self.perm_done.add(obj["id"])
        q, qa = v["q"], v["qa"]
        q._ensure_policy()
        pol = q.policy
        items = []
        if pol["mode"] == "all":
            items.append(("행: %s" % (("%s %s" % (dic.jo(pol["label"], "이라", "라"), pol["text"])) if pol["label"] else "모든 행"), "", False))
        elif pol["mode"] == "scope":
            via = (pol["scope"] or {}).get("via")
            tail = ""
            if via:
                vobj = next((o for o in self.cu.objects.values() if o["tname"] == via["table"] and o["conn"] == obj["conn"]), None)
                vp = next((p for p in (vobj or {}).get("props", []) if p["col"] == via["col"]), None)
                if vobj and vp:
                    tail = "%s → %s 링크" % (vobj["name"], re.sub(r"\s*(코드|번호)$", "", vp["name"]))
            items.append(("행: %s" % pol["text"], tail, False))
        else:
            items.append(("행: %s" % pol["text"], "", True))
        for col, a in q.access.items():
            p = next((x for x in obj["props"] if x["col"] == col), None)
            if p is None:
                continue
            if a["ok"] is True:
                items.append(("%s: 볼 수 있음" % p["name"], "", False))
            elif a["ok"] == "row":
                items.append(("%s: 같은 부서 구성원이라 그 행만 볼 수 있음" % p["name"], a["why"], False))
            else:
                items.append(("%s: 가림" % p["name"], a["why"], True))
        before, after = None, None
        try:
            before, after = qa.count(), q.count()
        except query.OntoQueryError:
            pass
        res = ""
        if before is not None:
            res = ("%s건 그대로" % _n(after)) if before == after else "%s건으로 줄어듦" % _n(after)
        self.add("perm", "권한 적용", self._user_label(), RULES(items), RES(res) if res else None)

    # --- 단계
    def op_identify(self, st: dict) -> None:
        cfg = perm.identity_config()
        if not cfg:
            return self.fail("직원 객체 연결이 설정되어 있지 않아 실행 사용자를 확인할 수 없어요.", "실행 사용자 확인")
        o = self.cu.objects.get(cfg["object"])
        if o is None:
            return self.fail("직원 객체가 공개되어 있지 않아요.", "실행 사용자 확인")
        q = query.Q(self.cu, o).where_key(self.user["emp"])
        qa = query.Q(self.ca, o).where_key(self.user["emp"])
        self.vars[st["as"]] = {"q": q, "qa": qa}
        self.add("perm", "실행 사용자 확인", "권한/인증 layer", RULES([("%s(사번 %s)를 이 테스트 화면에서 고른 사용자로 확인" % (self.user["name"], self.user["emp"]), "실제 연동에서는 로그인 인증 결과의 사번이 들어와요", False),
                                                                        ("사번 %s → %s 객체 → 부서 %s, 직급 %s" % (self.user["emp"], o["name"], self.user.get("deptName") or self.user.get("dept"), self.user.get("rank")), "", False)]))

    def op_search(self, st: dict) -> None:
        o = self._obj(st["object"])
        q, qa = self._pair(o)
        q.where(st.get("where"))
        qa.where(st.get("where"))
        keys = query.instances_for(qa, 3)
        total = qa.count()
        self.vars[st["as"]] = {"q": q, "qa": qa, "n": total}
        if total == 0:
            return self.fail("%s 에서 조건에 맞는 것을 찾지 못했어요. (%s)" % (o["name"], ", ".join(q.descr) or "조건 없음"), "객체 검색", o["api"])
        shown = ", ".join(("%s %s" % (k, t)) if t != k else k for k, t in keys)
        res = "%s, %s건" % (shown, _n(total)) if total <= len(keys) else "%s 외 %s건" % (shown, _n(total - len(keys)))
        self.add("obj", "객체 검색", o["api"], J({"objectType": o["api"], "where": st.get("where") or {}}), RES(res))

    def op_get(self, st: dict) -> None:
        o = self._obj(st["object"])
        q, qa = self._pair(o)
        q.where_key(st["key"])
        qa.where_key(st["key"])
        row = query.search(self.ca, o["id"], None, 1, 0, None, None, qa.clone())
        if not row["rows"]:
            return self.fail("%s %s 을(를) 찾을 수 없어요." % (o["name"], st["key"]), "객체 조회", o["api"])
        r = row["rows"][0]
        self.vars[st["as"]] = {"q": q, "qa": qa, "n": 1, "row": r}
        sp = next((p for p in query.exposed(o) if p["api"] == "status"), None)
        res = "%s %s" % (sp["name"], r.get(sp["api"])) if sp and r.get(sp["api"]) is not None else "1건"
        self.add("obj", "객체 조회", o["api"], J({"objectType": o["api"], "primaryKey": st["key"]}), RES(res))

    def op_follow(self, st: dict) -> None:
        src = self._need(st["from"])
        o = src["q"].obj
        hit = self.cu.find_link(o["id"], st["link"])
        to = self.cu.obj(hit["to"])
        q = src["q"].follow(st["link"])
        qa = src["qa"].follow(st["link"])
        n = qa.count()
        cross = to["conn"] != o["conn"]
        self.vars[st["as"]] = {"q": q, "qa": qa, "n": n}
        who = "%s → %s%s" % (o["name"], to["name"], (", %s" % _conn_label(to)) if (cross or st.get("showConn")) else "")
        show = qa.render(["%s.%s" % (qa.alias, query.ident(c)) for c in ([p["col"] for p in query.exposed(to)][:3] or ["*"])], show=True) if n else ""
        res = "%s %s건" % (to["name"], _n(n))
        if 0 < n <= 3:
            keys = query.instances_for(qa, 3)
            res += ": " + ", ".join("%s (%s)" % (t, k) if t != k else k for k, t in keys)
        self.add("link", "DB 간 링크 따라가기" if cross else "링크 따라가기", who, SQL(show) if show and (cross or n <= 3) else None, RES(res))

    def op_filter(self, st: dict) -> None:
        src = self._need(st["from"])
        q, qa = src["q"].clone(), src["qa"].clone()
        before = len(qa.rules)
        q.where(st["where"])
        qa.where(st["where"])
        n = qa.count()
        self.vars[st["as"]] = {"q": q, "qa": qa, "n": n}
        self.add("filter", "필터", q.obj["api"], RULES([(t, e, False) for t, e in qa.rules[before:]]), RES("%s건" % _n(n)))

    def op_aggregate(self, st: dict) -> None:
        src = self._need(st["from"])
        o = src["q"].obj
        self.perm_step(src)
        aggs = st.get("aggs") or [{"fn": "count", "as": "cnt"}]
        r = query.aggregate(self.cu, o["id"], None, aggs, st.get("groupBy"), q=src["q"].clone())
        hid = r["hidden"]
        sql = r["sql"]
        if hid:
            first, _, rest = sql.partition("\n")
            note = "-- %s 조회하지 않음" % ", ".join(dic.jo(h["name"], "은", "는") for h in hid)
            sql = first.ljust(max(40, len(first) + 2)) + note + ("\n" + rest if rest else "")
        parts = []
        for a in aggs:
            nm = a.get("as") or ("count" if a.get("fn", "count") == "count" and not a.get("prop") else "%s_%s" % (a["fn"], a.get("prop")))
            if r["result"] and nm in r["result"]:
                v = r["result"][nm]
                p = next((x for x in query.exposed(o) if x["api"] == a.get("prop")), None)
                parts.append("%s건" % _n(v) if (a.get("fn", "count") == "count") else "%s%s" % (_n(v), p.get("unit", "") if p else ""))
        self.vars[st.get("as", "agg")] = {"result": r["result"], "rows": r["rows"], "hidden": hid, "o": o, "aggs": aggs, "q": src["q"], "qa": src["qa"]}
        res = ", ".join(parts) + (" (%dms)" % r["ms"])
        self.add("agg", "집계 쿼리 실행", "%s, 읽기 전용" % _conn_label(o), SQL(sql), RES(res))

    def op_read(self, st: dict) -> None:
        src = self._need(st["from"])
        o = src["q"].obj
        self.perm_step(src)
        order = st.get("order")
        note = ""
        try:
            r = query.search(self.cu, o["id"], None, st.get("limit", 5), 0, order, st.get("props"), src["q"].clone())
        except query.Denied:
            r = query.search(self.cu, o["id"], None, st.get("limit", 5), 0, None, st.get("props"), src["q"].clone())
            note = "정렬 기준 속성을 볼 수 없어 기본키 순서로 읽었어요"
        self.vars[st["as"]] = {"rows": r["rows"], "o": o, "hidden": r["hidden"], "total": r["total"], "q": src["q"], "qa": src["qa"]}
        names = {p["api"]: p for p in query.exposed(o)}

        def line(row: dict) -> str:
            head = [str(row[p["api"]]) for p in query.exposed(o) if "title" in p["flags"] and row.get(p["api"]) is not None]
            if not head:
                head = [str(row[p["api"]]) for p in query.exposed(o) if "pk" in p["flags"] and row.get(p["api"]) is not None]
            rest = []
            for p in query.exposed(o):
                v = row.get(p["api"])
                if v is None or "pk" in p["flags"] or "title" in p["flags"]:
                    continue
                rest.append("%s %s%s" % (p["name"], _n(v) if isinstance(v, (int, float)) else v, p.get("unit", "")))
            return " ".join(head) + (": " if head and rest else "") + ", ".join(rest)
        res = (" / ".join(line(x) for x in r["rows"][:3]) if r["rows"] else "읽을 수 있는 행이 없어요") + (" 외 %s건" % _n(r["total"] - 3) if r["total"] > 3 else "")
        self.add("obj", st.get("title") or "객체 읽기", o["api"], SQL(r["sql"]), RES(res + ((" · " + note) if note else "")))

    def op_calc(self, st: dict) -> None:
        v = self._need(st["from"])
        row = (v.get("rows") or [{}])[0]
        names = {p["api"]: p["name"] for p in query.exposed(v["o"])}
        toks = re.findall(r"[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*|[+\-*/()]", st["expr"])
        out, label = [], []
        for t in toks:
            if re.match(r"[A-Za-z_]", t):
                val = row.get(t)
                if val is None:
                    hid = next((h for h in v.get("hidden", []) if h["prop"] == t), None)
                    return self.fail("%s을(를) %s 계산할 수 없어요." % (names.get(t, t), "볼 수 없어서" if hid else "읽지 못해"), "계산", st.get("label", ""))
                out.append(repr(float(val)))
                label.append(names.get(t, t))
            else:
                out.append(t)
                label.append(t)
        try:
            val = eval(" ".join(out), {"__builtins__": {}}, {})                  # noqa: S307 — 토큰은 위에서 숫자와 연산자만 남겼다
        except (SyntaxError, ZeroDivisionError, TypeError):
            return self.fail("식을 계산하지 못했어요: %s" % st["expr"], "계산")
        val = int(val) if float(val) == int(val) else round(val, 2)
        self.vars[st["as"]] = {"value": val, "unit": st.get("unit", "")}
        self.add("agg", "계산", "%s = %s" % (st.get("label", "결과"), " ".join(label)), RES("%s%s" % (_n(val), st.get("unit", ""))))

    def op_action(self, st: dict) -> None:
        o = self._obj(st["object"])
        try:
            obj, a = actions.find(self.ca, o["id"], st["action"])
        except actions.ActionError as e:
            return self.fail(str(e), "액션 선택", o["api"])
        d = actions.describe(obj, a)
        self.add("act", "액션 선택", a["api"], RULES([("%s (쓰기, 사용자 확인 필요)" % a["name"], "", False), ("실행: %s" % d["via"], "%s API" % d["viaSrc"] if d["viaSrc"] else "", False)]))
        key = st.get("key", "")
        if not key and not a.get("create"):
            return self.fail("어떤 %s 에 실행할지 알 수 없어요." % obj["name"], "제출 조건 확인")
        try:
            ev = actions.evaluate(self.cu, self.ca, o["id"], a["api"], key, st.get("inputs") or self.inputs, self.user)
        except (actions.ActionError, query.OntoQueryError) as e:
            return self.fail(str(e), "제출 조건 확인", self._user_label())
        self.add("perm" if all(r["ok"] for r in ev["rules"]) else "fail", "제출 조건 확인", self._user_label(),
                 RULES([(r["text"], "통과" if r["ok"] else ("통과 못 함" + ((": " + r["note"]) if r["note"] else "")), not r["ok"]) for r in ev["rules"]]))
        if not all(r["ok"] for r in ev["rules"]):
            bad = [r["text"] for r in ev["rules"] if not r["ok"]]
            self.blocked = {"rules": ev["rules"]}
            self.answer = "%s %s '%s' 조건을 만족해야 해요. %s님은 이 액션을 실행할 수 없어서 아무것도 바꾸지 않았습니다." % (ev["title"], dic.jo(a["name"], "은", "는"), bad[0], self.user["name"])
            self.stop = True
            return
        if not ev["connected"]:
            return self.fail("이 액션이 부를 원본 시스템 API 가 연결되어 있지 않아요. 변환 스튜디오에 도구를 등록해 주세요.", "원본 시스템 연결")
        if self.approved is None:
            self.add("hold", "사용자 확인", "쓰기 액션", {"t": "approval", "v": {"title": ev["confirm"]["title"], "fields": ev["confirm"]["fields"], "yes": "승인", "no": "그만두기"}})
            self.pending = {"object": o["id"], "action": a["api"], "key": key, "title": ev["title"], "name": a["name"]}
            self.stop = True
            return
        if self.approved is False:
            self.add("hold", "사용자 확인", "쓰기 액션", {"t": "approval", "v": {"title": "실행하지 않았습니다", "fields": [], "done": True}})
            self.answer = "%s %s 실행하지 않았어요. 아무것도 바꾸지 않았습니다." % (ev["title"], dic.jo(a["name"], "을", "를"))
            self.stop = True
            return
        self.add("hold", "사용자 확인", "쓰기 액션", {"t": "approval", "v": {"title": "%s님이 실행을 확인했습니다" % self.user["name"], "fields": [], "done": True}})
        ex = actions.execute(self.cu, self.ca, o["id"], a["api"], key, st.get("inputs") or self.inputs, self.user, confirmed=True)
        self.executed = ex
        tr = ex.get("trace") or {}
        req = tr.get("originRequest")
        if req:
            from urllib.parse import urlsplit
            u = urlsplit(req["url"])
            http = "%s %s%s HTTP/1.1\nHost: %s\n%s\n\n%s" % (req["method"], u.path, ("?" + u.query) if u.query else "", u.netloc, "\n".join("%s: %s" % (k, v) for k, v in req["headers"].items() if k.lower() in ("cookie", "content-type")), req.get("body", ""))
            resp = tr.get("originResponse") or {}
            http_res = "HTTP %s, %s" % (resp.get("status", "?"), (resp.get("body") or "").replace("\n", " ")[:120])
            self.add("act", "API 실행", "이음 → %s" % (d["viaSrc"].replace(" API", "") or "원본 시스템"), {"t": "http", "v": http}, RES(http_res if ex["ok"] else "실패: %s" % ex["error"]))
        if not ex["ok"]:
            self.answer = "%s %s 실행하지 못했어요. %s" % (ev["title"], dic.jo(a["name"], "을", "를"), ex["error"])
            self.stop = True
            return
        if a.get("create"):
            self.add("obj", "객체 다시 읽기", "실시간 조회", RES("%s 을(를) 새로 만들었어요" % ex.get("created")))
            self.answer = "%s %s 새로 등록했어요. 진행 상태는 %s입니다." % (ex.get("created"), dic.jo(obj["name"], "을", "를"), (ex.get("after") or {}).get("status", "작성"))
        else:
            ch = ex["changed"]
            self.add("obj", "객체 다시 읽기", "실시간 조회", RES("; ".join("%s %s → %s" % (c[0], c[1], c[2]) for c in ch) if ch else "바뀐 값이 없어요"))
            self.answer = "%s %s 마쳤어요. %s" % (ev["title"], dic.jo(a["name"], "을", "를"), ("%s %s 바뀌었습니다." % (dic.jo(ch[0][0], "이", "가"), dic.ro(str(ch[0][2])))) if ch else "")
        self.stop = True


def _run_plan(run: Run, plan: dict) -> None:
    ops = {"identify": run.op_identify, "search": run.op_search, "get": run.op_get, "follow": run.op_follow, "filter": run.op_filter, "aggregate": run.op_aggregate,
           "read": run.op_read, "calc": run.op_calc, "action": run.op_action}
    for i, st in enumerate(plan.get("steps", [])[:MAX_STEPS]):
        if run.stop:
            break
        fn = ops.get(st.get("op"))
        if fn is None:
            run.fail("알 수 없는 단계예요: %s" % st.get("op"))
            break
        st.setdefault("as", "v%d" % i)
        try:
            fn(st)
        except (query.OntoQueryError, actions.ActionError, AskError) as e:
            run.fail(str(e), "실행할 수 없어요", st.get("object") or st.get("link") or "")
            break
        except dbconn.ConnError as e:
            run.fail("원본 DB 조회가 실패했어요. %s" % e, "실행할 수 없어요")
            break


# ── 정해 둔 질문 ───────────────────────────────────────────────────────────

def _month_range(asof: str) -> List[str]:
    y, m = int(asof[:4]), int(asof[5:7])
    nxt = (y + (m == 12), 1 if m == 12 else m + 1)
    import datetime
    last = datetime.date(nxt[0], nxt[1], 1) - datetime.timedelta(days=1)
    return ["%04d-%02d-01" % (y, m), last.isoformat()]


def canned_plan(qid: str, asof: str, user: dict) -> dict:
    if qid == "q1":
        return {"steps": [
            {"op": "search", "as": "vendor", "object": "Vendor", "where": {"name": {"contains": "한빛상사"}}},
            {"op": "follow", "as": "pos", "from": "vendor", "link": "purchaseOrders"},
            {"op": "filter", "as": "pend", "from": "pos", "where": {"status": "승인대기", "orderDate": {"between": _month_range(asof)}}},
            {"op": "aggregate", "as": "agg", "from": "pend", "aggs": [{"fn": "count", "as": "cnt"}, {"fn": "sum", "prop": "amount", "as": "total"}]},
            {"op": "read", "as": "top", "from": "pend", "limit": 3, "order": [{"prop": "amount", "dir": "desc"}], "props": ["poNumber", "amount"], "title": "해당 발주 보기"},
        ]}
    if qid == "q2":
        return {"steps": [
            {"op": "identify", "as": "me"},
            {"op": "follow", "as": "dept", "from": "me", "link": "department"},
            {"op": "follow", "as": "bdgt", "from": "dept", "link": "budgets"},
            {"op": "filter", "as": "bdgt_y", "from": "bdgt", "where": {"fiscalYear": asof[:4]}},
            {"op": "read", "as": "row", "from": "bdgt_y", "limit": 1, "props": ["departmentCode", "fiscalYear", "budget", "used"], "title": "예산 읽기"},
            {"op": "calc", "as": "remain", "from": "row", "expr": "budget - used", "label": "잔액", "unit": "원"},
        ]}
    if qid == "q3":
        return {"steps": [
            {"op": "get", "as": "po", "object": "PurchaseOrder", "key": "PO-2609-0142"},
            {"op": "action", "object": "PurchaseOrder", "action": "approvePurchaseOrder", "key": "PO-2609-0142"},
        ]}
    raise AskError("알 수 없는 질문이에요.")


def canned_answer(qid: str, run: Run) -> Optional[str]:
    if run.answer or run.pending:
        return run.answer
    v = run.vars
    if qid == "q1" and "agg" in v:
        vend = (query.instances_for(v["vendor"]["qa"], 1) or [("", "한빛상사")])[0][1]
        month = int(store.as_of()[5:7])
        res = v["agg"]["result"] or {}
        cnt, total = res.get("cnt", 0), res.get("total")
        rows = (v.get("top") or {}).get("rows", [])
        if total is not None:
            tail = ""
            if rows and rows[0].get("amount") is not None:
                tail = " 가장 큰 건은 %s(%s원)입니다." % (rows[0]["poNumber"], _n(rows[0]["amount"]))
            return "%d월에 %s로 나간 발주 중 승인 대기는 %s건, %s%s원이에요.%s" % (month, vend, _n(cnt), "모두 " if cnt > 1 else "", _n(total), tail)
        hid = v["agg"]["hidden"][0] if v["agg"]["hidden"] else None
        scoped = v["agg"]["q"].policy.get("mode") == "scope"
        who = ("%s 요청분 중 " % (run.user.get("deptName") or "내 부서")) if scoped else ""
        first = rows[0].get("poNumber") if rows else ""
        tail = (" %s %s 볼 수 있어서 알려 드릴 수 없어요." % (dic.jo(hid["name"], "은", "는"), hid["why"])) if hid else ""
        return "%s%s 승인 대기 발주는 %s건%s이에요.%s" % (who, vend, _n(cnt), ("(%s)" % first) if first and cnt == 1 else "", tail)
    if qid == "q2" and "remain" in v and "row" in v:
        row = v["row"]["rows"][0] if v["row"]["rows"] else {}
        return "%s의 %s년 구매 예산 %s원 중 %s원을 써서 %s원 남았어요." % (run.user.get("deptName") or "내 부서", store.as_of()[:4], _n(row.get("budget")), _n(row.get("used")), _n(v["remain"]["value"]))
    return None


# ── 자유 질문(GPT) ─────────────────────────────────────────────────────────

PLAN_SYSTEM = """당신은 회사 데이터 온톨로지에 질문하는 계획을 세우는 도우미입니다. 아래 카탈로그의 객체, 속성, 링크, 액션만 쓰세요. 반드시 JSON 한 개만 답하세요(설명 금지).
형식: {"steps": [단계...]} 단계는 최대 8개이고 다음 중 하나입니다.
 {"op":"search","as":"이름","object":"객체 API 이름","where":{"속성API":값 또는 {"contains":"…"} {"between":["2026-09-01","2026-09-30"]} {"gte":숫자} {"in":[…]}}}
 {"op":"get","as":"이름","object":"객체 API 이름","key":"기본키 값"}
 {"op":"follow","as":"이름","from":"앞 단계 이름","link":"링크 API 이름"}
 {"op":"filter","as":"이름","from":"앞 단계 이름","where":{…}}
 {"op":"aggregate","as":"이름","from":"앞 단계 이름","aggs":[{"fn":"count|sum|avg|min|max","prop":"속성API(count 는 생략)","as":"결과 이름"}],"groupBy":["속성API"]}
 {"op":"read","as":"이름","from":"앞 단계 이름","limit":5,"order":[{"prop":"속성API","dir":"desc"}]}
 {"op":"calc","as":"이름","from":"read 단계 이름","expr":"속성API - 속성API","label":"이름","unit":"원"}
 {"op":"identify","as":"me"}  (질문에 "우리 팀", "내" 처럼 실행 사용자가 나오면 맨 앞에 두고 me 에서 링크를 따라가세요)
 {"op":"action","object":"객체 API 이름","action":"액션 API 이름","key":"기본키 값","inputs":{입력 이름: 값}}  (쓰기 요청일 때만. 실행 전에 사용자 확인을 거칩니다)
규칙: 속성 값에 코드가 아니라 이름(예: "승인대기")을 쓰세요. 날짜는 YYYY-MM-DD. 오늘 날짜(기준일)는 {asof} 입니다. 카탈로그에 없는 것은 쓰지 마세요.
카탈로그에 답할 방법이 없으면 {"steps": [], "unanswerable": "이유"} 로 답하세요."""


def catalog(ctx: query.Ctx) -> str:
    out = []
    for o in ctx.objects.values():
        if o.get("aiOff"):
            continue
        props = []
        for p in query.exposed(o):
            d = "%s(%s)" % (p["api"], p["name"])
            if p["type"] == "enum" and p["codes"]:
                d += "[%s]" % "|".join(p["codes"].values())
            elif p["type"] in ("date", "decimal", "integer", "timestamp"):
                d += ":%s" % p["type"]
            props.append(d)
        ls = ["%s→%s" % (x["api"], x["to"]) for x in ctx.links_of(o["id"])]
        acts = ["%s(%s)" % (a["api"], ", ".join(i["name"] + ":" + i["type"] for i in a.get("inputs", []))) for a in o.get("actions", [])]
        out.append("- %s (%s, %s) 키: %s\n  속성: %s\n  링크: %s\n  액션: %s" % (o["api"], o["name"], o["id"], ", ".join(p["api"] for p in query.exposed(o) if p["col"] in (o.get("pk") or [])),
                                                                              ", ".join(props), ", ".join(ls) or "없음", ", ".join(acts) or "없음"))
    return "\n".join(out)


def llm_plan(text: str, ctx: query.Ctx, asof: str) -> dict:
    try:
        plan = llm.complete_json(PLAN_SYSTEM.replace("{asof}", asof), "카탈로그:\n%s\n\n질문: %s" % (catalog(ctx), text))
    except llm.LlmError as e:
        raise AskError(str(e))
    if not isinstance(plan, dict) or not isinstance(plan.get("steps"), list):
        raise AskError("AI 가 질의 계획을 만들지 못했어요. 질문을 다르게 써 보세요.")
    return plan


def llm_answer(text: str, run: Run) -> str:
    facts = []
    for st in run.steps:
        facts.append({"단계": st["title"], "대상": st["who"], "결과": next((b["v"] for b in st["blocks"] if b["t"] == "res"), "")})
    facts_json = json.dumps(facts, ensure_ascii=False)
    hidden = [h for v in run.vars.values() for h in (v.get("hidden") or [])]
    sys_ = "회사 데이터에서 찾은 결과를 보고 질문에 한국어로 한두 문장으로 답하세요. 결과에 없는 숫자를 지어내지 마세요. 권한 때문에 가려진 값이 있으면 그 이유를 알려 주세요."
    try:
        return llm.clean(llm.complete(sys_, "질문: %s\n실행 사용자: %s\n단계 결과: %s\n가려진 속성: %s" % (text, run._user_label(), facts_json, json.dumps(hidden, ensure_ascii=False))), 600)
    except llm.LlmError:
        return "결과: " + "; ".join(f["결과"] for f in facts if f["결과"])


# ── 진입점 ─────────────────────────────────────────────────────────────────

def run(question: dict, emp: str, approved: Optional[bool] = None, inputs: Optional[dict] = None) -> dict:
    """질문 하나를 실행한다. question: {id} 정해 둔 질문, 또는 {text} 자유 질문. approved 는 쓰기 액션의 사용자 확인(None 이면 물어보는 단계에서 멈춘다).
    돌려주는 값: {steps, answer, pending, mode, user, question}"""
    user = perm.identify(emp)
    if user is None:
        raise AskError("실행 사용자를 직원 객체에서 찾을 수 없어요. 사번: %s" % emp)
    cu, ca = query.Ctx.published(user), query.Ctx.published(None)
    ca.admin = True
    if not cu.objects:
        raise AskError("공개한 온톨로지가 없어요. 온톨로지를 공개한 뒤 질문해 주세요.")
    qid = question.get("id")
    text = question.get("text") or ""
    asof = store.as_of()
    r = Run(cu, ca, user, approved, text, inputs)
    if qid:
        canned = next((x for x in CANNED if x["id"] == qid), None)
        if canned is None:
            raise AskError("알 수 없는 질문이에요.")
        text, r.text, mode = canned["q"], canned["q"], "rule"
        plan = canned_plan(qid, asof, user)
        _run_plan(r, plan)
        ans = canned_answer(qid, r)
    else:
        if not text.strip():
            raise AskError("질문을 입력해 주세요.")
        if llm.provider() is None:
            raise AskError("자유 질문은 GPT 설정(AZURE_OPENAI_*)이 있을 때 쓸 수 있어요. 정해 둔 질문을 골라 주세요.")
        mode = "llm"
        plan = llm_plan(text, cu, asof)
        if not plan.get("steps"):
            return {"steps": [], "answer": plan.get("unanswerable") or "공개한 온톨로지로는 답할 수 없는 질문이에요.", "pending": None, "mode": mode, "user": user, "question": text, "plan": plan}
        _run_plan(r, plan)
        ans = r.answer if (r.answer or r.pending) else llm_answer(text, r)
    return {"steps": r.steps, "answer": ans, "pending": r.pending, "mode": mode, "user": user, "question": text, "executed": bool(r.executed and r.executed.get("ok")), "plan": plan}

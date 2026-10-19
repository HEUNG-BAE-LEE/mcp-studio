"""온톨로지 질의 엔진: 객체를 조건으로 찾고(search), 한 건 읽고(get), 집계하고(aggregate), 링크를 따라간다(follow).

모든 데이터 접근이 여기를 지난다. 객체 정의에서 SQL 을 만들어 원본 DB 에 읽기 전용으로 보내고(conn.run, 행 수·시간·동시 쿼리 보호), 결과를 객체 모양으로 바꾼다:
  - 코드값은 이름으로(`PO_STTS_CD = 20` -> "승인대기"), 날짜는 YYYY-MM-DD, 마스킹 특성이 있는 값은 늘 가린다.
  - 객체 필터(삭제된 행 제외)는 늘 붙는다.
  - 실행 사용자(ctx.user)가 있으면 행 권한을 SQL 조건·조인으로, 속성 권한을 가림(NULL)으로 적용한다. 권한이 없는 속성은 조건·집계에 못 쓴다(추론으로 새는 것을 막는다).
  - 관리자 보기(ctx.admin)는 권한을 적용하지 않고 마스킹만 한다(스튜디오의 미리보기, 객체 탐색).
링크를 따라갈 때는 출발 집합의 키 값(최대 MAX_KEYS 개)을 읽어 상대 객체에 `키 IN (…)` 조건으로 건다. 두 연결에 걸친 링크도 같은 방법이라, 연결이 달라도 SQL 한 번으로 조인하지 않는다.
SQL 은 만든 그대로 보여 줄 수 있다(show=True 는 주석으로 값을 덧붙인다). 실행하는 문장에는 주석이 없다.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

from app.ieum.onto import conn as dbconn
from app.ieum.onto import dictionary as dic
from app.ieum.onto import perm, profile, store

MAX_KEYS = 500
MAX_LIMIT = 100
DEFAULT_LIMIT = 20
_ID_RX = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#]*$")
_CHAR_TYPES = {"CHAR", "VARCHAR", "VARCHAR2", "NVARCHAR", "NVARCHAR2", "NCHAR", "TEXT", "CLOB"}


class OntoQueryError(ValueError):
    """사용자(또는 AI)에게 그대로 보일 오류: 없는 속성, 잘못된 값, 권한 없음 등"""


class Denied(OntoQueryError):
    """권한이 없어 쓸 수 없는 속성"""


def ident(name: str) -> str:
    return name if _ID_RX.match(name) else '"%s"' % name.replace('"', '""')


# ── 컨텍스트 ───────────────────────────────────────────────────────────────

class Ctx:
    """한 번의 질의 묶음: 쓰는 객체·링크, 실행 사용자, 실행한 쿼리 기록"""

    def __init__(self, objects: Dict[str, dict], links: List[dict], user: Optional[dict] = None, admin: bool = False) -> None:
        self.objects, self.links, self.user, self.admin = objects, links, user, admin
        self.log: List[dict] = []
        self._aliases: Dict[str, str] = {}

    @classmethod
    def live(cls, user: Optional[dict] = None, admin: bool = False) -> "Ctx":
        """지금 스튜디오에 있는 객체 전부(검토 중인 것 포함)"""
        return cls(store.all_objects(), store.all_links(), user, admin)

    @classmethod
    def published(cls, user: Optional[dict] = None) -> "Ctx":
        """공개한 온톨로지(연결마다 가장 최근 공개 버전의 스냅샷)를 합친 것. 양쪽이 모두 공개된 링크만 남는다."""
        objs: Dict[str, dict] = {}
        links: List[dict] = []
        for cid, vers in store.versions.load().items():
            if not vers:
                continue
            snap = vers[-1]["snapshot"]
            objs.update(snap["objects"])
            links.extend(snap["links"])
        seen, ls = set(), []
        for l in links:
            if l["from"] in objs and l["to"] in objs and l["id"] not in seen:
                seen.add(l["id"])
                ls.append(l)
        return cls(objs, ls, user, False)

    def obj(self, oid: str) -> dict:
        o = self.objects.get(oid)
        if o is None:
            raise OntoQueryError("객체를 찾을 수 없어요: %s" % oid)
        return o

    def find_object(self, ref: str) -> dict:
        """id 또는 API 이름(여러 온톨로지에 같은 이름이 있으면 오류)으로 객체를 찾는다."""
        if ref in self.objects:
            return self.objects[ref]
        hits = [o for o in self.objects.values() if o["api"] == ref]
        if len(hits) == 1:
            return hits[0]
        if not hits:
            raise OntoQueryError("객체를 찾을 수 없어요: %s" % ref)
        raise OntoQueryError("%s 이름의 객체가 여러 온톨로지에 있어요. id 로 불러 주세요: %s" % (ref, ", ".join(o["id"] for o in hits)))

    def links_of(self, oid: str) -> List[dict]:
        """객체에서 따라갈 수 있는 링크: [{api, name, link, dir('out'|'in'), to}]"""
        out = []
        for l in self.links:
            if l["from"] == oid and l["to"] in self.objects:
                out.append({"api": l["api"], "name": l["name"], "link": l, "dir": "out", "to": l["to"]})
            if l["to"] == oid and l["from"] in self.objects and l["from"] != l["to"]:
                out.append({"api": l["rapi"], "name": l["rev"], "link": l, "dir": "in", "to": l["from"]})
        return out

    def find_link(self, oid: str, api: str) -> dict:
        hit = next((x for x in self.links_of(oid) if x["api"] == api), None)
        if hit is None:
            raise OntoQueryError("%s 에는 %s 링크가 없어요. 있는 링크: %s" % (self.obj(oid)["name"], api, ", ".join(x["api"] for x in self.links_of(oid)) or "없음"))
        return hit

    def alias_for(self, obj: dict, taken: set) -> str:
        words = re.findall(r"[A-Z][a-z0-9]*", obj["api"]) or [obj["api"]]
        base = "".join(w[0] for w in words).lower() or "t"
        a, n = base, 2
        while a in taken:
            a, n = "%s%d" % (base, n), n + 1
        return a


# ── 원본 ───────────────────────────────────────────────────────────────────

def table_ref(c: dict, table: str) -> Tuple[str, str]:
    """(실행용 테이블 표기, 보여 줄 표기). SQLite 는 별칭으로 attach 해 둔 스키마를, 다른 DB 는 실제 스키마 이름을 쓴다."""
    if c["dbms"] == "sqlite":
        return "%s.%s" % (ident(c["alias"]), ident(table)), "%s.%s" % (c["alias"], table)
    ex = ("%s.%s" % (ident(c["schema"]), ident(table))) if c.get("schema") else ident(table)
    return ex, "%s.%s" % (c["alias"], table)


def source(obj: dict) -> Tuple[dict, str, str]:
    """(연결, 실행용 테이블 표기, 보여 줄 테이블 표기)"""
    if obj["kind"] == "mart":
        return dict(dbconn.MART_CONN), "%s.%s" % (dbconn.MART_ALIAS, ident(obj["tname"])), "%s.%s" % (dbconn.MART_ALIAS, obj["tname"])
    c = dbconn.need(obj["conn"])
    ex, show = table_ref(c, obj["tname"])
    return c, ex, show


def exposed(obj: dict) -> List[dict]:
    """AI 와 화면에 내보내는 속성(비공개, 객체 필터 용도는 뺀다)"""
    return [p for p in obj["props"] if p["api"] and not ({"hidden", "filter"} & set(p["flags"]))]


def prop_by(obj: dict, key: str) -> dict:
    for p in exposed(obj):
        if p["api"] == key or p["col"].upper() == str(key).upper():
            return p
    raise OntoQueryError("%s 에는 %s 속성이 없어요. 있는 속성: %s" % (obj["name"], key, ", ".join(p["api"] for p in exposed(obj))))


def _is_char(p: dict) -> bool:
    return dic.parse_ctype(p["ctype"])[0] in _CHAR_TYPES


def coerce(p: dict, v: Any) -> Tuple[Any, str]:
    """조건 값을 컬럼에 맞게 바꾼다. (바인드 값, 사람이 읽는 값)"""
    if p["type"] == "enum" and p["codes"]:
        s = str(v).strip()
        if s in p["codes"]:
            return s, p["codes"][s]
        for code, name in p["codes"].items():
            if name == s or name.replace(" ", "") == s.replace(" ", ""):
                return code, name
        raise OntoQueryError("%s 의 값은 %s 중 하나여야 해요 (입력: %s)" % (p["name"], ", ".join(p["codes"].values()), s))
    if p["type"] == "date":
        s = str(v).strip()
        m = re.match(r"^(\d{4})-?(\d{2})-?(\d{2})$", s)
        if not m:
            raise OntoQueryError("%s 는 2026-09-26 같은 날짜로 적어 주세요 (입력: %s)" % (p["name"], s))
        d8 = "".join(m.groups())
        return (d8 if p["fmt"] == "YYYYMMDD" else "-".join(m.groups())), "-".join(m.groups())
    if p["type"] in ("integer", "decimal"):
        try:
            n = float(str(v).replace(",", "")) if p["type"] == "decimal" else int(float(str(v).replace(",", "")))
        except (TypeError, ValueError):
            raise OntoQueryError("%s 는 숫자로 적어 주세요 (입력: %s)" % (p["name"], v))
        if _is_char(p):
            return str(n), str(n)
        return (int(n) if n == int(n) else n), dic.fmt_num(n)
    return str(v), str(v)


# ── 질의 만들기 ────────────────────────────────────────────────────────────

class Q:
    """한 객체에 대한 질의 하나(집합). 조건을 쌓고, 세거나 읽거나 집계하거나 링크를 따라 다른 질의로 넘어간다."""

    def __init__(self, ctx: Ctx, obj: dict, alias: str = "") -> None:
        self.ctx, self.obj = ctx, obj
        self.conn, self.t_exec, self.t_show = source(obj)
        self.alias = alias or ctx.alias_for(obj, set())
        self.joins: List[Tuple[str, str, str]] = []        # (실행용 SQL, 보여 줄 SQL, 설명)
        self.wheres: List[Tuple[str, str]] = []             # (SQL 조건, 설명 주석)
        self.params: Dict[str, Any] = {}
        self.shown: Dict[str, str] = {}                     # 바인드 이름 -> 보여 줄 값
        self.empty = False
        self.notes: List[str] = []
        self._pol = False
        self._pol_wheres: List[Tuple[str, str]] = []        # 행 권한이 붙인 조건과 조인: 사용자가 쌓은 조건(wheres, joins)과 따로 둬서 clone 이 가져가지 않는다
        self._pol_joins: List[Tuple[str, str, str]] = []
        self.policy: dict = {"mode": "all", "label": "", "text": ""}
        self.access: Dict[str, dict] = {}
        self.hidden_used: List[str] = []
        self.descr: List[str] = []                          # 조건을 사람이 읽게 요약한 것(추적용)
        self.rules: List[Tuple[str, str]] = []              # (조건 설명, 보조 설명): 필터 단계에 그대로 보인다

    def clone(self, ctx: Optional[Ctx] = None) -> "Q":
        """같은 조건을 가진 새 질의. ctx 를 바꾸면(관리자 보기 등) 행 권한은 그 ctx 로 다시 판단한다 — 이미 붙은 행 권한 조건은 가져가지 않는다."""
        n = Q(ctx or self.ctx, self.obj, self.alias)
        n.wheres = list(self.wheres)
        n.params = {k: v for k, v in self.params.items() if not k.startswith("user_")}
        n.shown = {k: v for k, v in self.shown.items() if k in n.params}
        n.joins = list(self.joins)
        n.notes = list(self.notes)
        n.descr = list(self.descr)
        n.rules = list(self.rules)
        return n

    # --- 바인드, 조건
    def bind(self, base: str, value: Any, shown: str = "") -> str:
        """바인드 변수를 만든다. 같은 이름에 같은 값이면 같은 변수를 다시 쓴다(보이는 SQL 이 덜 지저분하다)."""
        name = re.sub(r"[^a-z0-9_]", "_", base.lower()) or "p"
        n, cand = 2, name
        while cand in self.params:
            if self.params[cand] == value:
                return ":" + cand
            cand, n = "%s%d" % (name, n), n + 1
        self.params[cand] = value
        self.shown[cand] = shown if shown != "" else str(value)
        return ":" + cand

    def add(self, sql: str, note: str = "") -> "Q":
        self.wheres.append((sql, note))
        return self

    def _col(self, p: dict) -> str:
        return "%s.%s" % (self.alias, ident(p["col"]))

    def _need_access(self, p: dict, what: str) -> None:
        """조건·집계에 쓰는 속성은 이 사용자가 온전히 볼 수 있어야 한다."""
        self._ensure_policy()
        a = self.access.get(p["col"])
        if a is not None and a["ok"] is not True:
            self.hidden_used.append(p["col"])
            raise Denied("%s %s 볼 수 있어서 %s에 쓸 수 없어요." % (dic.jo(p["name"], "은", "는"), a["why"], what))

    def where_prop(self, key: str, spec: Any) -> "Q":
        """속성 조건 하나. spec: 값(같다), 목록(이 중 하나), {eq, ne, contains, startsWith, in, gt, gte, lt, lte, between, from, to, isNull}"""
        p = prop_by(self.obj, key)
        self._need_access(p, "조건")
        col = self._col(p)
        ops = spec if isinstance(spec, dict) else ({"in": spec} if isinstance(spec, list) else {"eq": spec})
        if not ops:
            raise OntoQueryError("%s 조건이 비어 있어요." % p["name"])
        for op, raw in ops.items():
            if op == "isNull":
                self.add("%s IS %sNULL" % (col, "" if raw else "NOT "), "%s %s" % (p["name"], "없음" if raw else "있음"))
                self.descr.append("%s %s" % (p["name"], "없음" if raw else "있음"))
            elif op in ("eq", "ne", "gt", "gte", "lt", "lte"):
                val, shown = coerce(p, raw)
                sym = {"eq": "=", "ne": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<="}[op]
                note = shown + ((" (코드 %s)" % val) if p["type"] == "enum" and str(val) != shown else "")
                b = self.bind(p["api"], val, shown)
                self.add("%s %s %s" % (col, sym, b), note)
                text = "%s %s %s" % (p["name"], {"=": "=", "<>": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤"}[sym], shown)
                self.descr.append(text)
                self.rules.append((text, ("공통코드 %s" % val) if p["type"] == "enum" and str(val) != shown else ""))
            elif op in ("contains", "startsWith"):
                s = str(raw).strip()
                if not s:
                    raise OntoQueryError("%s 검색어가 비어 있어요." % p["name"])
                esc = s.replace("!", "!!").replace("%", "!%").replace("_", "!_")
                b = self.bind(p["api"], ("%" if op == "contains" else "") + esc.upper() + "%", s)
                self.add("UPPER(%s) LIKE %s ESCAPE '!'" % (col, b), "%s %s" % (s, "포함" if op == "contains" else "으로 시작"))
                self.descr.append("%s %s %s" % (p["name"], "포함" if op == "contains" else "시작", s))
                self.rules.append((self.descr[-1], ""))
            elif op == "in":
                vals = raw if isinstance(raw, list) else [raw]
                if not vals or len(vals) > 200:
                    raise OntoQueryError("%s 의 in 목록은 1~200개여야 해요." % p["name"])
                cs = [coerce(p, v) for v in vals]
                bs = [self.bind(p["api"], c[0], c[1]) for c in cs]
                self.add("%s IN (%s)" % (col, ", ".join(bs)), ", ".join(c[1] for c in cs))
                self.descr.append("%s = %s" % (p["name"], " 또는 ".join(c[1] for c in cs)))
                self.rules.append((self.descr[-1], ""))
            elif op == "between":
                if not isinstance(raw, list) or len(raw) != 2:
                    raise OntoQueryError("%s 의 between 은 [시작, 끝] 두 값이어야 해요." % p["name"])
                a, b2 = coerce(p, raw[0]), coerce(p, raw[1])
                self.add("%s BETWEEN %s AND %s" % (col, self.bind(p["api"] + "_from", a[0], a[1]), self.bind(p["api"] + "_to", b2[0], b2[1])), "%s ~ %s" % (a[1], b2[1]))
                self.descr.append("%s %s ~ %s" % (p["name"], a[1], b2[1]))
                self.rules.append((self.descr[-1], ""))
            elif op in ("from", "to"):
                val, shown = coerce(p, raw)
                self.add("%s %s %s" % (col, ">=" if op == "from" else "<=", self.bind(p["api"] + "_" + op, val, shown)), "%s %s" % (shown, "이후" if op == "from" else "이전"))
                self.descr.append("%s %s %s" % (p["name"], "≥" if op == "from" else "≤", shown))
                self.rules.append((self.descr[-1], ""))
            else:
                raise OntoQueryError("%s 의 조건 %s 을(를) 알 수 없어요. 쓸 수 있는 것: eq, ne, contains, startsWith, in, gt, gte, lt, lte, between, from, to, isNull" % (p["name"], op))
        return self

    def where(self, where: Optional[Dict[str, Any]]) -> "Q":
        for k, v in (where or {}).items():
            self.where_prop(k, v)
        return self

    def where_key(self, key: Any) -> "Q":
        """기본키 값(복합이면 'a|b' 나 {속성: 값})으로 한 건을 가리키는 조건"""
        props = {p["col"]: p for p in self.obj["props"]}
        for col, v in pk_values(self.obj, key).items():
            p = props[col]
            val, shown = coerce(p, v) if p["type"] in ("integer", "decimal") else (str(v), str(v))
            self.add("%s.%s = %s" % (self.alias, ident(col), self.bind(p["api"] or col, val, shown)), shown)
            self.descr.append("%s = %s" % (p["name"], shown))
        return self

    # --- 권한
    def _ensure_policy(self) -> None:
        if self._pol:
            return
        self._pol = True
        if self.ctx.admin:
            return
        self.access = perm.prop_access(self.obj, self.ctx.user)
        pol = perm.row_policy(self.obj, self.ctx.user)
        self.policy = pol
        if pol["mode"] == "none":
            self.empty = True
            self._pol_wheres.append(("1 = 0", "볼 수 있는 행 없음"))
            return
        if pol["mode"] != "scope":
            return
        sc = pol["scope"]
        val = perm.user_value(self.ctx.user, sc["user"])
        shown = "%s%s" % (val, (" " + self.ctx.user.get("deptName", "")) if sc["user"] == "dept" and self.ctx.user.get("deptName") else "")
        if sc.get("via"):
            v = sc["via"]
            va = self._via_alias(v["table"])
            ex, sh = table_ref(self.conn, v["table"])
            on = "%s.%s = %s.%s" % (va, ident(v["to"]), self.alias, ident(v["from"]))
            self._pol_joins.append(("JOIN %s %s ON %s" % (ex, va, on), "JOIN %s %s ON %s" % (sh, va, on), va))
            b = self.bind("user_" + sc["user"], val, shown)
            self._pol_wheres.append(("%s.%s = %s" % (va, ident(v["col"]), b), "행 권한: %s" % shown))
        else:
            b = self.bind("user_" + sc["user"], val, shown)
            self._pol_wheres.append(("%s.%s = %s" % (self.alias, ident(sc["col"]), b), "행 권한: %s" % shown))

    def _via_alias(self, table: str) -> str:
        words = [w for w in re.split(r"_", re.sub(r"^TB_|_MST$|_DTL$", "", table.upper())) if w]
        base = (words[0][:2] if len(words) == 1 else "".join(w[0] for w in words)).lower() or "v"
        used = {self.alias} | {j[2] for j in self.joins + self._pol_joins}
        a, n = base, 2
        while a in used:
            a, n = "%s%d" % (base, n), n + 1
        return a

    def prop_expr(self, p: dict) -> Optional[str]:
        """선택할 식. 권한이 없으면 None, 행에 따라 보이면 CASE WHEN"""
        self._ensure_policy()
        a = self.access.get(p["col"])
        if a is None or a["ok"] is True:
            return self._col(p)
        if a["ok"] == "row":
            val = perm.user_value(self.ctx.user, a["row"]["user"])
            b = self.bind("user_" + a["row"]["user"], val, str(val))
            return "CASE WHEN %s.%s = %s THEN %s END" % (self.alias, ident(a["row"]["col"]), b, self._col(p))
        return None

    # --- SQL
    def _where_clause(self, show: bool) -> str:
        flt = profile.filter_sql(self.conn, self.obj.get("filter"), self.alias) if self.obj.get("filter") and self.obj["kind"] != "mart" else ""
        parts: List[Tuple[str, str]] = ([(flt, "")] if flt else []) + self.wheres + self._pol_wheres
        lines = []
        for i, (sql, note) in enumerate(parts):
            line = "%s %s" % (" WHERE" if i == 0 else "   AND", sql)
            lines.append(line.ljust(max(40, len(line) + 2)) + "-- " + note if (show and note) else line)
        return "\n".join(lines)

    def render(self, select: List[str], *, show: bool = False, group: Optional[List[str]] = None, order: Optional[List[str]] = None, note: str = "") -> str:
        self._ensure_policy()
        head = "SELECT " + ", ".join(select)
        if show and note:
            head = head.ljust(max(40, len(head) + 2)) + "-- " + note
        parts = [head, "  FROM %s %s" % (self.t_show if show else self.t_exec, self.alias)]
        parts += ["  " + (j[1] if show else j[0]) for j in self.joins + self._pol_joins]
        w = self._where_clause(show)
        if w:
            parts.append(w)
        if group:
            parts.append(" GROUP BY " + ", ".join(group))
        if order:
            parts.append(" ORDER BY " + ", ".join(order))
        return "\n".join(parts)

    def exec(self, sql: str, limit: int) -> dbconn.Result:
        used = {k: self.params[k] for k in set(re.findall(r":([A-Za-z_][A-Za-z0-9_]*)", sql)) if k in self.params}
        res = dbconn.run(self.conn, sql, used, limit=limit, replica=True)
        self.ctx.log.append({"conn": self.conn["id"], "ms": res.ms, "rows": len(res.rows)})
        return res

    # --- 실행
    def count(self) -> int:
        if self.empty:
            self._ensure_policy()
        sql = self.render(["COUNT(*)"])
        return int(self.exec(sql, 1).rows[0][0])

    def count_sql(self, show: bool = True) -> str:
        return self.render(["COUNT(*) AS cnt"], show=show)

    def select_props(self, props: Optional[List[str]] = None) -> Tuple[List[dict], List[dict]]:
        """(내보낼 속성, 권한 때문에 가린 속성 [{prop, name, why}])"""
        self._ensure_policy()
        want = [prop_by(self.obj, k) for k in props] if props else exposed(self.obj)
        vis, hid = [], []
        for p in want:
            if self.prop_expr(p) is None:
                a = self.access[p["col"]]
                hid.append({"prop": p["api"], "name": p["name"], "why": a["why"]})
            else:
                vis.append(p)
        return vis, hid

    def keys(self, cols: List[str], limit: Optional[int] = None) -> Tuple[List[tuple], bool]:
        """이 집합의 컬럼 값 조합(서로 다른 것, 비어 있는 값은 뺀다). (값들, 한도를 넘었는가)"""
        limit = limit or MAX_KEYS
        self._ensure_policy()
        sel = ["%s.%s" % (self.alias, ident(c)) for c in cols]
        for c in cols:
            self.add("%s.%s IS NOT NULL" % (self.alias, ident(c)), "")
        sql = self.render(["DISTINCT " + ", ".join(sel)])
        self.wheres = self.wheres[: len(self.wheres) - len(cols)]
        res = self.exec(sql, limit)
        return [tuple(r) for r in res.rows], res.truncated

    def follow(self, api: str) -> "Q":
        """이 집합에서 링크 api 를 따라 상대 객체의 집합으로 간다."""
        hit = self.ctx.find_link(self.obj["id"], api)
        l = hit["link"]
        to = self.ctx.obj(hit["to"])
        mine = [k[0] if hit["dir"] == "out" else k[1] for k in l["keys"]]
        theirs = [k[1] if hit["dir"] == "out" else k[0] for k in l["keys"]]
        keys, trunc = self.keys(mine)
        if trunc:
            raise OntoQueryError("%s 를 따라갈 값이 너무 많아요(%d개 초과). 조건을 더 좁혀 주세요." % (hit["name"], MAX_KEYS))
        nq = Q(self.ctx, to, self.ctx.alias_for(to, {self.alias}))
        nq.notes.append("%s 링크: %s" % (hit["name"], l["keyText"]))
        nq.descr = []
        if not keys:
            nq.empty = True
            nq.add("1 = 0", "이어진 값 없음")
            return nq
        cols = ["%s.%s" % (nq.alias, ident(c)) for c in theirs]
        if len(theirs) == 1:
            vals = [k[0] for k in keys]
            if len(vals) == 1:
                nq.add("%s = %s" % (cols[0], nq.bind(dic.snake_of(self.obj["api"]), vals[0], str(vals[0]))), str(vals[0]))
            else:
                nq.add("%s IN (%s)" % (cols[0], ", ".join(nq.bind(dic.snake_of(self.obj["api"]), v, str(v)) for v in vals)), "%d개 값" % len(vals))
        else:
            ors = []
            for k in keys[:200]:
                ors.append("(" + " AND ".join("%s = %s" % (cols[i], nq.bind(theirs[i].lower(), k[i], str(k[i]))) for i in range(len(theirs))) + ")")
            nq.add("(" + " OR ".join(ors) + ")", "%d개 값" % len(keys))
        return nq

    # --- 결과 모양
    def shape(self, props: List[dict], row: tuple) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        for p, v in zip(props, row):
            out[p["api"]] = convert(p, v)
        return out


def convert(p: dict, v: Any) -> Any:
    """원본 값을 객체 값으로: 코드는 이름, 날짜는 YYYY-MM-DD, 숫자는 숫자, 마스킹 대상은 가림"""
    if v is None or v == "":
        return None
    t = p["type"]
    if t == "enum":
        return p["codes"].get(str(v).strip(), str(v))
    if t == "date":
        return dic.fmt_date8(v) if p["fmt"] == "YYYYMMDD" else str(v)
    if t == "timestamp":
        return dic.fmt_ts(v)
    if t in ("integer", "decimal"):
        try:
            f = float(v)
        except (TypeError, ValueError):
            return str(v)
        return int(f) if f == int(f) else f
    if p.get("mask"):
        return dic.mask_value(p["mask"], v)
    return str(v)


# ── 공개 함수 ──────────────────────────────────────────────────────────────

def _pk_order(q: Q) -> List[str]:
    return ["%s.%s" % (q.alias, ident(c)) for c in (q.obj.get("pk") or [])]


def search(ctx: Ctx, oid: str, where: Optional[dict] = None, limit: int = DEFAULT_LIMIT, offset: int = 0, order: Optional[List[dict]] = None, props: Optional[List[str]] = None,
           q: Optional[Q] = None) -> dict:
    """객체를 조건으로 찾는다. {object, name, total, rows, hidden, sql, ms, limit, offset}"""
    obj = ctx.obj(oid)
    q = q or Q(ctx, obj)
    q.where(where)
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    offset = max(0, int(offset or 0))
    vis, hid = q.select_props(props)
    if not vis:
        raise Denied("%s 의 속성을 볼 수 있는 권한이 없어요." % obj["name"])
    total = q.count()
    ord_ = []
    for o in order or []:
        p = prop_by(obj, o["prop"])
        q._need_access(p, "정렬")
        ord_.append("%s %s" % (q._col(p), "DESC" if str(o.get("dir", "asc")).lower() == "desc" else "ASC"))
    ord_ = ord_ or _pk_order(q)
    exprs = [q.prop_expr(p) for p in vis]
    sel = ["%s AS %s" % (e, ident("c%d" % i)) for i, e in enumerate(exprs)]
    sql = q.render(sel, order=ord_)
    res = q.exec(sql, offset + limit)
    rows = [q.shape(vis, r) for r in res.rows[offset: offset + limit]]
    return {"object": oid, "name": obj["name"], "total": total, "rows": rows, "hidden": hid, "limit": limit, "offset": offset, "ms": res.ms, "policy": q.policy,
            "sql": q.render([e for e in exprs], show=True, order=ord_), "where": q.descr}


def pk_values(obj: dict, key: Any) -> Dict[str, Any]:
    """기본키 값(컬럼 -> 값). key 는 단일 키면 값, 복합 키면 'a|b' 이거나 {속성 API 이름 또는 컬럼: 값}"""
    pk = obj.get("pk") or []
    if not pk:
        raise OntoQueryError("%s 에는 기본키가 없어 한 건을 가리킬 수 없어요." % obj["name"])
    props = {p["col"]: p for p in obj["props"]}
    if isinstance(key, dict):
        vals = {}
        for col in pk:
            v = key.get(props[col]["api"], key.get(col))
            if v is None:
                raise OntoQueryError("기본키 %s 값이 필요해요." % (props[col]["api"] or col))
            vals[col] = v
        return vals
    parts = str(key).split("|") if len(pk) > 1 else [str(key)]
    if len(parts) != len(pk):
        raise OntoQueryError("%s 의 기본키는 %d개 값(%s)이에요. 'a|b' 로 이어 주세요." % (obj["name"], len(pk), ", ".join(props[c]["api"] or c for c in pk)))
    return dict(zip(pk, parts))


def get(ctx: Ctx, oid: str, key: Any) -> dict:
    """기본키로 한 건. 없으면 row 가 None"""
    obj = ctx.obj(oid)
    q = Q(ctx, obj).where_key(key)
    r = search(ctx, oid, None, 1, 0, None, None, q)
    return {"object": oid, "name": obj["name"], "row": r["rows"][0] if r["rows"] else None, "hidden": r["hidden"], "sql": r["sql"], "ms": r["ms"], "policy": r["policy"]}


def aggregate(ctx: Ctx, oid: str, where: Optional[dict] = None, aggs: Optional[List[dict]] = None, group_by: Optional[List[str]] = None, limit: int = MAX_LIMIT,
              q: Optional[Q] = None, note: str = "") -> dict:
    """건수·합계·평균·최솟값·최댓값. aggs: [{fn, prop?, as?}]. 권한이 없는 속성의 집계는 빼고 hidden 에 적는다."""
    obj = ctx.obj(oid)
    q = q or Q(ctx, obj)
    q.where(where)
    q._ensure_policy()
    aggs = aggs or [{"fn": "count"}]
    sel: List[str] = []
    names: List[str] = []
    hidden: List[dict] = []
    gb: List[str] = []
    gprops = [prop_by(obj, g) for g in (group_by or [])]
    for p in gprops:
        q._need_access(p, "묶기")
        sel.append("%s AS %s" % (q._col(p), ident(p["api"])))
        gb.append(q._col(p))
        names.append(p["api"])
    for a in aggs:
        fn = str(a.get("fn", "count")).lower()
        if fn not in ("count", "sum", "avg", "min", "max"):
            raise OntoQueryError("집계 함수는 count, sum, avg, min, max 중 하나여야 해요 (입력: %s)." % fn)
        if fn == "count" and not a.get("prop"):
            alias = a.get("as") or "count"
            sel.append("COUNT(*) AS %s" % ident(alias))
            names.append(alias)
            continue
        p = prop_by(obj, a["prop"])
        if fn in ("sum", "avg") and p["type"] not in ("integer", "decimal"):
            raise OntoQueryError("%s 는 숫자 속성이 아니라 %s 할 수 없어요." % (p["name"], "합계" if fn == "sum" else "평균"))
        expr = q.prop_expr(p)
        if expr is None:
            hidden.append({"prop": p["api"], "name": p["name"], "why": q.access[p["col"]]["why"], "fn": fn})
            continue
        alias = a.get("as") or "%s_%s" % (fn, p["api"])
        sel.append("%s(%s) AS %s" % (fn.upper(), expr, ident(alias)))
        names.append(alias)
    if not sel:
        raise Denied("집계할 수 있는 값이 없어요.")
    sql = q.render(sel, group=gb or None, order=None)
    res = q.exec(sql, max(1, min(int(limit or MAX_LIMIT), 1000)))
    rows = []
    for r in res.rows:
        d = {}
        for i, n in enumerate(names):
            v = r[i]
            if i < len(gprops):
                v = convert(gprops[i], v)
            elif isinstance(v, float) and v == int(v):
                v = int(v)
            d[n] = v
        rows.append(d)
    show = q.render(sel, show=True, group=gb or None, note=note)
    return {"object": oid, "name": obj["name"], "rows": rows, "result": rows[0] if (rows and not group_by) else None, "hidden": hidden, "ms": res.ms, "policy": q.policy, "sql": show,
            "where": q.descr}


def instances_for(q: Q, n: int = 3) -> List[Tuple[str, str]]:
    """질의 집합의 앞 n 건: [(기본키 문자열, 제목)]. 제목 속성이 없으면 기본키가 제목이다."""
    obj = q.obj
    title_p = next((p for p in exposed(obj) if "title" in p["flags"]), None)
    pk_ps = [p for p in (next((x for x in obj["props"] if x["col"] == c), None) for c in obj.get("pk") or []) if p]
    cols = pk_ps + ([title_p] if title_p and title_p not in pk_ps else [])
    if not cols:
        return []
    sel = ["%s AS %s" % (q._col(p), ident("c%d" % i)) for i, p in enumerate(cols)]
    res = q.exec(q.render(sel, order=_pk_order(q)), n)
    out = []
    for r in res.rows:
        vals = {p["col"]: v for p, v in zip(cols, r)}
        key = "|".join(str(vals[p["col"]]) for p in pk_ps)
        title = convert(title_p, vals.get(title_p["col"])) if title_p else key.replace("|", " · ")
        out.append((key, str(title if title not in (None, "") else key.replace("|", " · "))))
    return out


def instances(ctx: Ctx, oid: str, q_text: str = "", limit: int = 30) -> List[dict]:
    """객체 탐색의 목록: 제목 속성(또는 기본키)으로 검색한 인스턴스 [{key, title, sub}]"""
    obj = ctx.obj(oid)
    title_p = next((p for p in exposed(obj) if "title" in p["flags"]), None)
    pk_ps = [next((p for p in obj["props"] if p["col"] == c), None) for c in obj.get("pk") or []]
    q = Q(ctx, obj)
    if q_text.strip():
        s = q_text.strip().upper()
        like = []
        for p in [x for x in exposed(obj) if "search" in x["flags"] or "pk" in x["flags"]][:5]:
            like.append("UPPER(%s) LIKE %s" % (q._col(p), q.bind("q", "%" + s.replace("%", "\\%").replace("_", "\\_") + "%", q_text.strip())))
        if like:
            q.add("(" + " OR ".join(l + " ESCAPE '\\'" for l in like) + ")", q_text.strip())
    cols = [p for p in pk_ps if p] + ([title_p] if title_p and title_p not in pk_ps else [])
    sel = ["%s AS %s" % (q._col(p), ident("c%d" % i)) for i, p in enumerate(cols)]
    res = q.exec(q.render(sel, order=_pk_order(q)), limit)
    out = []
    for r in res.rows:
        vals = {p["col"]: v for p, v in zip(cols, r)}
        key = "|".join(str(vals[p["col"]]) for p in pk_ps if p)
        title = convert(title_p, vals.get(title_p["col"])) if title_p else key.replace("|", " · ")
        out.append({"key": key, "title": str(title if title is not None else key.replace("|", " · ")), "sub": key if title_p else ""})
    return out


def instance(ctx: Ctx, oid: str, key: str, per_link: int = 8) -> dict:
    """객체 탐색의 한 건: 속성(표시 이름, 값)과 링크마다 이어진 객체(건수, 앞 몇 개)"""
    obj = ctx.obj(oid)
    g = get(ctx, oid, key)
    row = g["row"]
    if row is None:
        raise OntoQueryError("%s 에서 %s 을(를) 찾을 수 없어요." % (obj["name"], key))
    title_p = next((p for p in exposed(obj) if "title" in p["flags"]), None)
    hidden = {h["prop"] for h in g["hidden"]}
    props = [{"name": p["name"], "value": "" if row.get(p["api"]) is None else row[p["api"]], "unit": p.get("unit", ""), "type": p["type"], "hidden": p["api"] in hidden} for p in exposed(obj)]
    out_links = []
    for hit in ctx.links_of(oid):
        to = ctx.obj(hit["to"])
        try:
            tq = Q(ctx, obj).where_key(key).follow(hit["api"])
            total = tq.count()
            tt = next((p for p in exposed(to) if "title" in p["flags"]), None)
            pk_ps = [next((p for p in to["props"] if p["col"] == c), None) for c in to.get("pk") or []]
            cols = [p for p in pk_ps if p] + ([tt] if tt and tt not in pk_ps else [])
            items = []
            if total and cols:
                sel = ["%s AS %s" % (tq._col(p), ident("c%d" % i)) for i, p in enumerate(cols)]
                res = tq.exec(tq.render(sel, order=_pk_order(tq)), per_link)
                for r in res.rows:
                    vals = {p["col"]: v for p, v in zip(cols, r)}
                    k = "|".join(str(vals[p["col"]]) for p in pk_ps if p)
                    items.append({"oid": to["id"], "key": k, "title": str(convert(tt, vals.get(tt["col"])) if tt else k)})
            out_links.append({"api": hit["api"], "name": hit["name"], "dir": hit["dir"], "to": to["id"], "toName": to["name"], "cross": to["conn"] != obj["conn"], "total": total, "items": items})
        except OntoQueryError as e:
            out_links.append({"api": hit["api"], "name": hit["name"], "dir": hit["dir"], "to": to["id"], "toName": to["name"], "cross": to["conn"] != obj["conn"], "total": 0, "items": [],
                              "error": str(e)})
    title = row.get(title_p["api"]) if title_p else None
    return {"oid": oid, "key": key, "title": str(title if title not in (None, "") else key.replace("|", " · ")), "props": props, "links": out_links, "table": obj["table"], "sql": g["sql"]}

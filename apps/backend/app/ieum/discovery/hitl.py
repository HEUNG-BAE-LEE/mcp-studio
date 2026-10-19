"""탐색 중 사람이 개입하는 곳(HITL)의 상태와 규칙. 브라우저는 모른다 — 크롤러(crawler.py)가 이 상태를 읽고 쓴다.

세 가지가 있다.

  질문    크롤러가 판단하기 어려운 상황(위험해 보이는 버튼, 입력값이 필요한 화면, 권한 문제, 관련도가 낮은 메뉴, 새 화면)을
          만나면 질문을 남기고 **기다리지 않고** 다른 메뉴를 계속 탐색한다. 사람이 답하거나 시간이 지나면(안전한 쪽으로) 크롤러가
          그 답대로 다시 돌아와 처리한다. 질문이 여러 개면 한 번에 하나만 카드로 보이고, 시간은 그 질문에만 흐른다.
  지시    "거래처 관리는 보지 마" 같은 말과 계획 화면의 버튼. 메뉴를 건너뛰거나 넣고, 직접 조작으로 넘어간다.
  조작    사람이 화면 캡처를 눌러 헤드리스 브라우저를 직접 조종한다. 그동안 크롤러는 멈춘다.

API 스레드(사람이 누르는 것)와 크롤러 스레드(브라우저를 쥔 것)가 함께 만지므로 모든 변경은 락 안에서 한다.
Playwright 는 크롤러 스레드만 부른다. 여기서는 부르지 않는다.
"""
import queue
import threading
import time
from typing import Callable, Dict, List, Optional, Tuple

from app.ieum.discovery import planner

LEVELS = ("ambig", "every", "never")
KIND_LABEL = {"risky": "위험해 보이는 버튼", "input": "입력값 필요", "perm": "권한 문제", "low": "관련도 낮음", "screen": "새 화면", "readpost": "조회용 POST"}
HOLD_SECONDS = 6.0       # 카드 위에 마우스가 있는 동안 화면이 이만큼 간격으로 알려 온다. 알림이 끊기면 시간이 다시 흐른다
MAX_VALUE = 60           # 사람이 적는 값(거래처 이름 등)의 길이 상한
MAX_TYPED = 200          # 직접 조작에서 한 번에 보내는 글자 수 상한
INPUT_KINDS = ("click", "type", "key", "scroll")
KEYS = frozenset(("Enter", "Tab", "Backspace", "Delete", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageDown", "PageUp", "Home", "End"))


class Hitl:
    def __init__(self, *, level: str = "never", wait: int = 120, purpose: str = "", ques=(), clock: Callable[[], float] = time.time,
                 elapsed: Optional[Callable[[], float]] = None, log: Optional[Callable[[str, str], None]] = None,
                 on_ask: Optional[Callable[[dict], None]] = None) -> None:
        """clock: 시각(시험이 바꾼다). elapsed: 탐색을 시작한 뒤 흐른 초(질문 시각 표시). log(kind, text): human|auto 기록. on_ask(질문): 질문이 생길 때(읽기만 한다)."""
        self.level, self.wait, self.purpose, self.ques = level, int(wait), purpose, list(ques)
        self._clock = clock
        self._elapsed = elapsed or (lambda: 0.0)
        self._log = log or (lambda kind, text: None)
        self._on_ask = on_ask or (lambda rec: None)
        self.lock = threading.RLock()
        self.asks: List[dict] = []
        self.dec: Dict[str, str] = {}               # 질문 열쇠 → 결정. 같은 질문을 다시 하지 않는다
        self.shots: Dict[str, bytes] = {}           # 질문 id → 질문을 한 순간의 화면(JPEG). 메모리에만 둔다
        self.plan: List[dict] = []
        self.plan_ready = False
        self.plan_by = ""
        self.purp: Dict[str, dict] = {}             # 사람이 기입한 용도: API 열쇠 → {use, qa}
        self.paused = False
        self.take: Optional[dict] = None            # 직접 조작 중이면 {since, n, by, menu}
        self.inputs: "queue.Queue[dict]" = queue.Queue()
        self.n_human = self.n_auto = self.n_take = 0
        self._last = clock()
        self._hold_until = 0.0
        self._applied: set = set()

    # ── 시간 ────────────────────────────────────────────────────────────────

    def tick(self) -> None:
        """질문 시간을 흘린다. 크롤러와 화면 요청이 둘 다 부른다. 멈춘 상태(일시정지, 직접 조작, 마우스가 카드 위)에서는 흐르지 않는다."""
        with self.lock:
            now = self._clock()
            dt, self._last = max(0.0, now - self._last), now
            q = self.active()
            if q is None or self.paused or self.take is not None or now < self._hold_until:
                return
            q["left"] = max(0.0, q["left"] - dt)
            if q["left"] <= 0:
                self._resolve(q, q["def"], "auto")

    def hold(self) -> None:
        """사람이 카드 위에 마우스를 올려 두었다. 잠시 시간이 멈춘다."""
        with self.lock:
            self.tick()
            self._hold_until = self._clock() + HOLD_SECONDS

    def idle(self) -> bool:
        """크롤러가 쉬어야 하는가. 일시정지, 직접 조작 중."""
        return self.paused or self.take is not None

    # ── 질문 ────────────────────────────────────────────────────────────────

    def pending(self) -> List[dict]:
        return [a for a in self.asks if a["st"] == "wait"]

    def active(self) -> Optional[dict]:
        return next((a for a in self.asks if a["st"] == "wait"), None)

    def decided(self, key: str) -> Optional[str]:
        return self.dec.get(key)

    def ask(self, spec: dict, shot: Optional[bytes] = None) -> Optional[dict]:
        """질문을 남긴다. 같은 열쇠가 이미 결정됐으면 None(호출자가 decided 로 값을 읽는다), 이미 묻는 중이면 그 질문.

        spec: key, kind, title, body, pred, opts [[값, 이름, "pri"|""]], input {ph, sugg}, def(시간이 지나면 쓰는 값), defLabel,
              labels {값: 기록에 남길 말, "*": 입력값 문장 틀 "{v}"}, menu(계획 항목 id), hl(화면 위 강조 상자), task(크롤러가 답대로 처리할 일),
              present(사람이 지금 화면 앞에서 직접 조작하는 중이라 "묻지 않고" 설정이어도 묻는다), predLabel(pred 앞에 붙는 말. 기본은 "예상 요청")
        """
        with self.lock:
            key = spec["key"]
            if key in self.dec:
                return None
            for a in self.asks:
                if a["key"] == key and a["st"] == "wait":
                    return a
            qid = f"q{len(self.asks) + 1}"
            rec = {"id": qid, "key": key, "kind": spec["kind"], "kindLabel": KIND_LABEL.get(spec["kind"], spec["kind"]), "title": spec["title"],
                   "body": spec.get("body", ""), "pred": spec.get("pred", ""), "predLabel": spec.get("predLabel", ""), "opts": spec["opts"], "input": spec.get("input"), "def": spec["def"],
                   "defLabel": spec.get("defLabel", ""), "labels": spec.get("labels", {}), "menu": spec.get("menu"), "hl": spec.get("hl"),
                   "st": "wait", "val": None, "who": None, "t": round(self._elapsed(), 1), "total": self.wait, "left": float(self.wait),
                   "shot": 1 if shot else 0, "task": spec.get("task"), "label": ""}
            self.asks.append(rec)
            self._on_ask(rec)
            if shot:
                self.shots[qid] = shot
            if rec["menu"]:
                it = self.item(rec["menu"])
                if it and it["st"] not in ("done", "run"):
                    it["asking"] = True
            if self.level == "never" and not spec.get("present"):
                self._resolve(rec, rec["def"], "never")
            return rec

    def answer(self, qid: str, value: str, who: str = "human", by: str = "사람") -> Tuple[bool, str]:
        """사람이 답한다. 선택지 값이거나, 입력칸이 있는 질문이면 직접 적은 값."""
        with self.lock:
            self.tick()
            q = next((a for a in self.asks if a["id"] == qid), None)
            if q is None:
                return False, "질문을 찾을 수 없습니다."
            if q["st"] != "wait":
                return False, "이미 처리된 질문입니다."
            value = (value or "").strip()
            if value not in [o[0] for o in q["opts"]]:
                value = " ".join(value.split())[:MAX_VALUE]
                if not q["input"] or not value or any(ord(c) < 32 for c in value):
                    return False, "알 수 없는 답입니다."
            self._resolve(q, value, who, by)
            if q["kind"] == "perm" and value == "take":
                self.start_take(by, q["menu"], fresh=True)
            return True, q["label"]

    def _resolve(self, q: dict, value: str, who: str, by: str = "사람") -> None:
        q.update(st="done", val=value, who=who, at=round(self._elapsed(), 1))
        self.dec[q["key"]] = value
        labels = q["labels"]
        q["label"] = labels.get(value) or labels.get("*", "{v}").replace("{v}", value)
        if q["menu"]:
            it = self.item(q["menu"])
            if it:
                it.pop("asking", None)
        if who == "human":
            self.n_human += 1
            self._log("human", f"{by}님 결정: {q['label']}")
        elif who == "auto":
            self.n_auto += 1
            self._log("auto", f"답이 없어 안전한 쪽으로 처리: {q['label']}")
        elif who == "never":
            self.n_auto += 1
            self._log("auto", f"묻지 않고 처리: {q['label']}")

    def pop_answered(self) -> List[dict]:
        """답이 나왔는데 크롤러가 아직 처리하지 않은 질문들."""
        with self.lock:
            done = [a for a in self.asks if a["st"] == "done" and a["id"] not in self._applied]
            self._applied.update(a["id"] for a in done)
            return done

    def resolve_all(self, value_of: Callable[[dict], str], who: str = "auto") -> None:
        """남은 질문을 정리한다. auto 는 시간 상한에 닿아 기본값으로 처리한 것(세고 기록한다), end 는 탐색이 끝나 답을 받지 못한 것(세지 않는다)."""
        with self.lock:
            for q in self.pending():
                self._resolve(q, value_of(q), who)

    # ── 일시정지, 직접 조작 ─────────────────────────────────────────────────

    def set_paused(self, flag: bool, by: str = "사람") -> None:
        with self.lock:
            self.tick()
            if self.paused != flag:
                self.paused = flag
                self._log("human", f"{by}님이 탐색을 {'일시정지' if flag else '다시 시작'}했습니다")

    def start_take(self, by: str = "사람", menu: Optional[str] = None, fresh: bool = False) -> bool:
        """fresh: 테스트 계정의 세션을 비우고 로그인 화면에서 시작한다(권한이 없던 화면을 권한 있는 사람이 자기 계정으로 보여 줄 때)."""
        with self.lock:
            if self.take is not None:
                return False
            self.tick()
            self.paused = False
            self.take = {"since": round(self._elapsed(), 1), "n": 0, "by": by, "menu": menu, "fresh": fresh}
            self.n_take += 1
            self._log("human", f"{by}님이 직접 조작을 시작했습니다. 크롤러는 잠시 멈춥니다")
            return True

    def end_take(self, by: str = "사람") -> Optional[dict]:
        """직접 조작을 마친다. 끝낸 조작의 요약(조작 횟수, 메뉴)을 돌려준다. 조작 중이 아니었으면 None."""
        with self.lock:
            t = self.take
            if t is None:
                return None
            self.tick()
            self.take = None
            while True:
                try:
                    self.inputs.get_nowait()
                except queue.Empty:
                    break
            if t["n"]:
                self.n_human += 1
            self._log("human", "직접 조작을 마쳤습니다. 사람이 보여준 경로와 요청 형식을 기록했습니다" if t["n"] else "직접 조작을 마쳤습니다")
            if t.get("menu"):
                it = self.item(t["menu"])
                if it:
                    it["st"] = "done" if t["n"] else "skip"
                    it["hum"] = True
            return t

    def push_input(self, cmd: dict) -> Tuple[bool, str]:
        """직접 조작 중에만 받는다. click{x,y} type{text} key{key} scroll{dy}."""
        with self.lock:
            if self.take is None:
                return False, "직접 조작 중이 아닙니다."
            kind = cmd.get("op")
            if kind not in INPUT_KINDS:
                return False, "알 수 없는 조작입니다."
            if kind == "click" and not all(isinstance(cmd.get(k), (int, float)) for k in ("x", "y")):
                return False, "누른 위치를 알 수 없습니다."
            if kind == "key" and cmd.get("key") not in KEYS:
                return False, "쓸 수 없는 키입니다."
            if kind == "type" and not str(cmd.get("text") or ""):
                return False, "입력할 내용이 없습니다."
            if kind == "type" and len(str(cmd["text"])) > MAX_TYPED:
                return False, f"한 번에 {MAX_TYPED}자까지 보낼 수 있습니다."
            if kind == "scroll" and not isinstance(cmd.get("dy"), (int, float)):
                return False, "스크롤 값을 알 수 없습니다."
            if self.inputs.qsize() >= 50:
                return False, "조작이 밀려 있습니다. 잠시 뒤 다시 해 주세요."
            self.take["n"] += 1
            self.inputs.put(dict(cmd))
            return True, ""

    def next_input(self) -> Optional[dict]:
        try:
            return self.inputs.get_nowait()
        except queue.Empty:
            return None

    # ── 계획 ────────────────────────────────────────────────────────────────

    def set_plan(self, items: List[dict], by: str) -> None:
        with self.lock:
            self.plan, self.plan_ready, self.plan_by = items, True, by

    def item(self, mid: Optional[str]) -> Optional[dict]:
        return next((p for p in self.plan if p["id"] == mid), None)

    def set_state(self, mid: str, st: str) -> None:
        """계획 항목의 진행 상태. 새 메뉴를 열면 앞서 열던 메뉴는 끝난 것이다."""
        with self.lock:
            it = self.item(mid)
            if not it:
                return
            if st == "run":
                for p in self.plan:
                    if p["st"] == "run" and p["id"] != mid:
                        p["st"] = "done"
            if it["st"] == "skip" and st == "run":
                return
            it["st"] = st

    def skip_menu(self, mid: str, by: str = "사람", via: str = "plan") -> Tuple[bool, str]:
        with self.lock:
            it = self.item(mid)
            if it is None:
                return False, "계획에 없는 메뉴입니다."
            if it["st"] in ("run", "done"):
                return False, f"'{it['name']}' 메뉴는 이미 탐색했거나 탐색 중입니다."
            if it["st"] == "skip":
                return False, f"'{it['name']}' 메뉴는 이미 건너뛰기로 했습니다."
            it.update(st="skip", hum=True)
            it.pop("asking", None)
            self.n_human += 1
            self.dec[f"low|{mid}"] = "skip"
            self._log("human", f"{by}님 {'지시' if via == 'cmd' else '계획 변경'}: '{it['name']}' 메뉴 건너뛰기")
            for q in self.pending():
                if q["menu"] == mid:
                    self._resolve(q, "skip", "pre")
            return True, f"'{it['name']}' 메뉴를 탐색 계획에서 뺐습니다."

    def include_menu(self, mid: str, by: str = "사람", via: str = "plan") -> Tuple[bool, str]:
        with self.lock:
            it = self.item(mid)
            if it is None:
                return False, "계획에 없는 메뉴입니다."
            if it["st"] in ("run", "done"):
                return False, f"'{it['name']}' 메뉴는 이미 탐색했거나 탐색 중입니다."
            if it["rel"] == "excl":
                return False, f"'{it['name']}' 메뉴는 제외 경로라 탐색할 수 없습니다. 제외 경로는 연결 설정에서 바꿀 수 있습니다."
            if it["rel"] != "low" and it["st"] != "skip":
                return False, f"'{it['name']}' 메뉴는 이미 탐색 계획에 있습니다."
            if self.dec.get(f"low|{mid}") == "incl" and it["st"] == "wait":
                return False, f"'{it['name']}' 메뉴는 이미 탐색하기로 했습니다."
            it.update(st="wait", hum=True)
            it.pop("asking", None)
            self.n_human += 1
            self.dec[f"low|{mid}"] = "incl"
            self._log("human", f"{by}님 {'지시' if via == 'cmd' else '계획 변경'}: '{it['name']}' 메뉴도 탐색하기")
            for q in self.pending():
                if q["key"] == f"low|{mid}":
                    self._resolve(q, "incl", "pre")
            return True, f"'{it['name']}' 메뉴도 탐색하도록 계획을 바꿨습니다."

    def auto_skip_menu(self, mid: str, why: str) -> None:
        """사람에게 묻지 않고 계획에서 뺀다(관련 낮은 메뉴가 너무 많을 때). 사람의 결정도, 자동 처리한 질문도 아니라 세지 않는다."""
        with self.lock:
            it = self.item(mid)
            if it is None or it["st"] in ("run", "done"):
                return
            it.update(st="skip", why=why or it.get("why", ""))
            it.pop("asking", None)
            self.dec.setdefault(f"low|{mid}", "skip")

    def fail_menu(self, mid: str, why: str) -> None:
        """눌러서 열려 했는데 열리지 않은 메뉴: 건너뜀으로 두고 이유를 남긴다."""
        with self.lock:
            it = self.item(mid)
            if it is None:
                return
            it.update(st="skip", why=why)
            it.pop("asking", None)

    def finish_plan(self) -> None:
        """탐색이 끝났다: 아직 탐색 중으로 남은 메뉴를 완료로 둔다."""
        with self.lock:
            for p in self.plan:
                if p["st"] == "run":
                    p["st"] = "done"

    def command(self, text: str, by: str = "사람") -> dict:
        """사람의 지시 한 줄. {op, ok, msg}. 해석한 만큼만 반영하고, 못 알아들은 말은 기록만 남긴다고 사실대로 알린다."""
        text = " ".join((text or "").split())[:200]
        if not text:
            return {"op": "memo", "ok": False, "msg": "지시할 내용을 입력해 주세요."}
        with self.lock:
            r = planner.parse_command(text, self.plan)
            op, menu = r["op"], r["menu"]
            if op == "skip":
                ok, msg = self.skip_menu(menu["id"], by, "cmd")
            elif op == "incl":
                ok, msg = self.include_menu(menu["id"], by, "cmd")
            elif op == "take":
                # 권한 문제로 열리지 않았던 메뉴라면 권한 있는 사람이 자기 계정으로 로그인해 보여 주는 것이다(새 로그인으로 시작한다)
                fresh = bool(menu and any(a["kind"] == "perm" and a["menu"] == menu["id"] for a in self.asks))
                ok = self.start_take(by, menu["id"] if menu else None, fresh=fresh)
                msg = "직접 조작으로 전환했습니다." if ok else "이미 직접 조작 중입니다."
            else:
                self.n_human += 1
                self._log("human", f"{by}님 지시: \"{text}\" (메모로 남김)")
                ok, msg = True, "지시를 기록했습니다. 메뉴 이름과 '보지 마', '건너뛰어' 같은 표현만 탐색에 반영하고, 이 말은 메모로만 남깁니다."
            return {"op": op, "ok": ok, "msg": msg}

    # ── 용도 기입 ───────────────────────────────────────────────────────────

    def set_purpose(self, key: str, use: str, qa: List[int], by: str = "사람", label: str = "") -> dict:
        with self.lock:
            use = " ".join((use or "").split())[:60]
            qa = sorted({i for i in qa if isinstance(i, int) and 0 <= i < len(self.ques)})
            self.purp[key] = {"use": use, "qa": qa}
            self.n_human += 1
            self._log("human", f"{by}님이 {label or key} 용도를 \"{use}\"(으)로 기입했습니다")
            return self.purp[key]

    def qshot(self, qid: str) -> Optional[bytes]:
        with self.lock:
            return self.shots.get(qid)

    # ── 보기, 저장 ──────────────────────────────────────────────────────────

    def counts(self) -> dict:
        return {"human": self.n_human, "auto": self.n_auto, "take": self.n_take, "pending": len(self.pending())}

    def view(self) -> dict:
        """화면이 폴링으로 받는 모양. 질문 하나하나의 task 와 열쇠는 안에서만 쓴다."""
        with self.lock:
            self.tick()
            act = self.active()
            asks = [{k: v for k, v in a.items() if k not in ("task", "key")} for a in self.asks]
            for a in asks:
                if not act or a["id"] != act["id"]:
                    a.pop("left", None)
            return {"level": self.level, "wait": self.wait, "purpose": self.purpose, "ques": self.ques, "paused": self.paused,
                    "take": dict(self.take, queue=self.inputs.qsize()) if self.take else None, "held": self._clock() < self._hold_until,
                    "plan": {"ready": self.plan_ready, "by": self.plan_by, "items": [dict(p) for p in self.plan]},
                    "asks": asks, "active": act["id"] if act else None, "counts": self.counts(), "purp": {k: dict(v) for k, v in self.purp.items()}}

    def snapshot(self) -> dict:
        with self.lock:
            return {"level": self.level, "wait": self.wait, "purpose": self.purpose, "ques": list(self.ques), "plan": [dict(p) for p in self.plan],
                    "planReady": self.plan_ready, "planBy": self.plan_by, "dec": dict(self.dec), "purp": {k: dict(v) for k, v in self.purp.items()},
                    "asks": [{k: v for k, v in a.items() if k != "task"} for a in self.asks],
                    "counts": {"human": self.n_human, "auto": self.n_auto, "take": self.n_take}}

    @classmethod
    def restore(cls, d: dict, **kw) -> "Hitl":
        """끝난 작업의 기록을 다시 연다. 이어서 돌릴 수는 없고, 결과 화면이 읽는 용도다."""
        h = cls(level=d.get("level", "never"), wait=d.get("wait", 120), purpose=d.get("purpose", ""), ques=d.get("ques", []), **kw)
        h.plan, h.plan_ready, h.plan_by = [dict(p) for p in d.get("plan", [])], bool(d.get("planReady")), d.get("planBy", "")
        h.dec, h.purp = dict(d.get("dec", {})), {k: dict(v) for k, v in d.get("purp", {}).items()}
        h.asks = [dict(a, task=None) for a in d.get("asks", [])]
        c = d.get("counts", {})
        h.n_human, h.n_auto, h.n_take = c.get("human", 0), c.get("auto", 0), c.get("take", 0)
        h._applied = {a["id"] for a in h.asks}
        return h

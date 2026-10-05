"""탐색 작업(탐색 한 번)의 수명 관리: 시작, 진행 이벤트, 결과, 취소, 예약, 도구 등록.

화면은 이 모듈이 쌓는 이벤트를 폴링해서 그린다. 이벤트의 모양은 콘솔의 탐색 화면(discovery.js)과 약속돼 있다.

    sys  stage|note     준비, 교차 확인, 검증 같은 전체 단계와 메모
    git  stage|file     소스 분석: 저장소 복제, 프레임워크 감지, 컨트롤러 파일마다 찾은 API
    web  page|act|req|skip|done   화면 탐색: 연 화면, 누른 것, 캡처한 요청, 건너뛴 것
    vfy  call           검증 호출

작업 상태: scheduled → running → review(결과 검토) → done(도구 등록) / failed / cancelled / interrupted.
탐색은 몇 분이 걸려서 스레드로 돌고, 서버가 재시작되면 이어갈 수 없어 interrupted 로 표시한다.
"""
import copy
import threading
import time
import uuid
from typing import Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum import config
from app.ieum.discovery import merge, options, repo, scan_proc, verify
from app.ieum.discovery.browser import BrowserUnavailable, capabilities
from app.ieum.discovery.crawler import Crawler
from app.ieum.discovery.masking import Masker
from app.ieum.discovery.policy import Policy
from app.ieum.gateway import credentials, session_auth
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.store import JsonStore

store = JsonStore("discovery", "jobs")
MAX_EVENTS = 3000
SAVE_EVERY = 3.0
ALWAYS_KEEP = ("page", "stage", "done", "call", "file", "act", "note")      # 이벤트가 넘쳐도 버리지 않는 종류
STAGES = ("src", "web", "merge", "verify", "review")
ACTIVE = ("running",)


class JobError(ValueError):
    """사용자에게 그대로 보일 오류."""


def _vk(job_id: str) -> str:
    """금고에 넣는 키. 원본 시스템 id 와 겹치지 않게 접두사를 붙인다."""
    return "disc:" + job_id


class Job:
    def __init__(self, d: dict):
        self.d = d
        self.lock = threading.RLock()
        self.cancel = threading.Event()
        self.shot: Optional[bytes] = None
        self.crawler: Optional[Crawler] = None
        self.thread: Optional[threading.Thread] = None
        self.scan_files: List[tuple] = []
        self._saved_at = 0.0

    # ── 이벤트 ──────────────────────────────────────────────────────────────

    def emit(self, l: str, k: str, **fields) -> dict:
        with self.lock:
            self.d["seq"] += 1
            ev = {"seq": self.d["seq"], "t": round(time.time() - (self.d.get("startedAt") or time.time()), 1), "l": l, "k": k}
            ev.update({a: b for a, b in fields.items() if b is not None})
            if len(self.d["events"]) < MAX_EVENTS or k in ALWAYS_KEEP:
                self.d["events"].append(ev)
            if fields.get("msg"):
                self.d["act"] = fields["msg"]
        self.save()
        return ev

    def set_shot(self, data: bytes) -> int:
        with self.lock:
            self.shot = data
            self.d["shotSeq"] = self.d.get("shotSeq", 0) + 1
            return self.d["shotSeq"]

    def stage(self, **kw) -> None:
        with self.lock:
            self.d["stage"].update(kw)
        self.save(force=True)

    def save(self, force: bool = False) -> None:
        if not force and time.time() - self._saved_at < SAVE_EVERY:
            return
        self._saved_at = time.time()
        _save_all()

    # ── 보기 ────────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        s = dict(self.d["stats"])
        c = self.crawler
        if c and self.d["status"] in ACTIVE:
            s.update(requests=c.res.total, blocked=c.res.blocked, skipped=len(c.res.skipped), pages=len(c.res.pages))
        s["controllers"] = len(self.scan_files) if self.scan_files else s.get("controllers", 0)
        if self.d["status"] in ACTIVE:
            keys = {k for _f, eps in self.scan_files for k in eps}
            if c:
                pol = c.policy
                keys |= {merge._stem(pol.rel(urlsplit(o.url).path)) for o in c.res.observed if not o.out_of_scope and urlsplit(o.url).path != c.res.login_path}
            s["found"] = len(keys)
        return s

    def view(self, after: int = 0, limit: int = 600) -> dict:
        with self.lock:
            d = self.d
            fresh = [e for e in d["events"] if e["seq"] > after]
            evs = fresh[:limit]
            out = {k: d.get(k) for k in ("id", "name", "status", "stage", "act", "opts", "error", "notes", "registered", "sourceId", "browser",
                                         "framework", "files", "createdAt", "startAt", "startedAt", "finishedAt", "shotSeq", "codeTables")}
            out.update(events=copy.deepcopy(evs), seq=(evs[-1]["seq"] if evs else after), more=len(fresh) > limit, stats=self.stats(), elapsed=self.elapsed())
            if d["status"] in ("review", "done"):
                out["apis"] = copy.deepcopy(d["apis"])
            return out

    def summary(self) -> dict:
        v = self.view(limit=0)
        v.pop("events", None)
        v["apiCount"] = len([a for a in self.d["apis"] if a["verify"]["k"] != "out"])
        return v

    def elapsed(self) -> float:
        d = self.d
        if not d.get("startedAt"):
            return 0.0
        return round((d.get("finishedAt") or time.time()) - d["startedAt"], 1)


# ── 저장소 ──────────────────────────────────────────────────────────────────

_REG: Dict[str, object] = {"dir": None, "jobs": {}}
_REG_LOCK = threading.RLock()
_SAVE_LOCK = threading.Lock()


def _jobs() -> Dict[str, Job]:
    """작업 목록. 상태 폴더가 바뀌면(테스트) 다시 읽는다."""
    with _REG_LOCK:
        cur = str(config.state_dir())
        if _REG["dir"] != cur:
            _REG["dir"], _REG["jobs"] = cur, {}
            for d in store.load():
                if d["status"] in ACTIVE:
                    d.update(status="interrupted", error="서버가 다시 시작되어 탐색이 중단되었습니다.", finishedAt=d.get("finishedAt") or time.time())
                    d["stage"] = {k: ("fail" if v == "run" else v) for k, v in d["stage"].items()}
                _REG["jobs"][d["id"]] = Job(d)
        return _REG["jobs"]  # type: ignore[return-value]


def _save_all() -> None:
    with _SAVE_LOCK:
        rows = []
        for j in list(_jobs().values()):
            with j.lock:
                rows.append(copy.deepcopy(j.d))
        store.save(rows)


def get(job_id: str) -> Job:
    job = _jobs().get(job_id)
    if job is None:
        raise KeyError(job_id)
    return job


def list_jobs() -> List[dict]:
    ensure_scheduler()
    return sorted((j.summary() for j in _jobs().values()), key=lambda s: s["createdAt"], reverse=True)


def environment() -> dict:
    return {"capabilities": capabilities(), "defaults": {"ban": options.default_ban(), "maxPages": 50, "frameworks": list(options.FRAMEWORKS)}}


# ── 시작 ────────────────────────────────────────────────────────────────────

def _new(opts: dict, name: str) -> Job:
    d = {"id": uuid.uuid4().hex[:10], "name": name, "status": "queued", "createdAt": time.time(), "startAt": opts.get("startAt"),
         "startedAt": None, "finishedAt": None, "opts": opts, "seq": 0, "events": [], "apis": [], "notes": [], "error": None, "registered": 0,
         "sourceId": None, "recipe": None, "browser": "", "framework": "", "files": 0, "codeTables": 0, "shotSeq": 0,
         "stats": {"pages": 0, "requests": 0, "blocked": 0, "skipped": 0, "controllers": 0, "masked": 0, "found": 0, "both": 0, "src": 0, "tr": 0},
         "stage": {"src": "skip" if not opts["git"] else "wait", "web": "skip" if not opts["crawl"] else "wait", "merge": "wait", "verify": "wait", "review": "wait"}}
    return Job(d)


def start(raw: dict) -> Job:
    """설정을 검증하고 작업을 만든다. 지금 시작이면 바로, 예약이면 시각에 맞춰 돈다."""
    try:
        opts, secrets = options.clean(raw)
    except ValueError as exc:
        raise JobError(str(exc))
    if opts["crawl"] and not capabilities()["browser"]:
        raise JobError("이 서버에서 쓸 수 있는 브라우저가 없어 운영 화면 탐색을 할 수 없습니다. "
                       "Chrome 을 설치하거나 서버에서 `python -m playwright install chromium` 을 실행해 주세요. Git 소스 분석만 하려면 화면 탐색을 꺼 주세요.")
    if any(j.d["status"] in ACTIVE for j in _jobs().values()):
        raise JobError("다른 탐색이 진행 중입니다. 운영 시스템에 부하를 주지 않으려고 한 번에 하나만 돌립니다.")
    name = opts["name"] or (urlsplit(opts["base"]).netloc if opts["base"] else "새 원본 시스템")
    job = _new(opts, name)
    job.d["name"] = name
    credentials.put(_vk(job.d["id"]), secrets)
    _jobs()[job.d["id"]] = job
    if opts["when"] == "at":
        job.d["status"] = "scheduled"
        job.save(force=True)
        ensure_scheduler()
    else:
        _launch(job)
    return job


def rerun(job_id: str) -> Job:
    """같은 설정으로 다시 탐색한다. 비밀은 금고에 남아 있어야 한다."""
    old = get(job_id)
    sec = credentials.get(_vk(job_id))
    if old.d["opts"].get("crawl") and not sec.get("password"):
        raise JobError("저장된 계정 정보가 없어 다시 탐색할 수 없습니다. 연결 마법사에서 새로 시작해 주세요.")
    raw = dict(old.d["opts"], password=sec.get("password", ""), token=sec.get("token", ""), name=old.d["name"], when="now")
    return start(raw)


def _launch(job: Job) -> None:
    job.d["status"] = "running"
    job.d["startedAt"] = time.time()
    job.save(force=True)
    job.thread = threading.Thread(target=_run, args=(job,), name=f"ieum-disc-{job.d['id']}", daemon=True)
    job.thread.start()


def cancel(job_id: str) -> Job:
    job = get(job_id)
    if job.d["status"] == "scheduled":
        job.d.update(status="cancelled", finishedAt=time.time())
        job.save(force=True)
    else:
        job.cancel.set()
    return job


def delete(job_id: str) -> None:
    job = get(job_id)
    job.cancel.set()
    credentials.delete(_vk(job_id))
    _jobs().pop(job_id, None)
    _save_all()


# ── 예약 ────────────────────────────────────────────────────────────────────

_SCHED = {"thread": None}


def ensure_scheduler() -> None:
    """예약된 작업을 시각에 맞춰 시작하는 스레드. 서버가 떠 있는 동안에만 동작한다(스케줄러 서비스는 없다)."""
    with _REG_LOCK:
        t = _SCHED["thread"]
        if t is not None and t.is_alive():
            return
        t = threading.Thread(target=_scheduler_loop, name="ieum-disc-scheduler", daemon=True)
        _SCHED["thread"] = t
        t.start()


def _scheduler_loop() -> None:
    while True:
        time.sleep(15)
        try:
            for job in list(_jobs().values()):
                if job.d["status"] == "scheduled" and (job.d.get("startAt") or 0) <= time.time():
                    if any(j.d["status"] in ACTIVE for j in _jobs().values()):
                        continue                                    # 다른 탐색이 끝나면 다음 주기에
                    _launch(job)
        except Exception:
            pass


def stop(timeout: float = 20.0) -> None:
    """서버가 내려갈 때: 돌고 있는 탐색을 멈추고 헤드리스 브라우저를 닫을 시간을 준다."""
    running = [j for j in _jobs().values() if j.d["status"] in ACTIVE]
    for j in running:
        j.cancel.set()
    deadline = time.time() + timeout
    for j in running:
        if j.thread is not None:
            j.thread.join(max(0.0, deadline - time.time()))


def resume() -> None:
    """서버가 뜰 때: 중단된 작업을 표시하고, 예약이 남아 있으면 스케줄러를 켠다."""
    if any(j.d["status"] == "scheduled" for j in _jobs().values()):
        ensure_scheduler()


# ── 실행 ────────────────────────────────────────────────────────────────────

def _run(job: Job) -> None:
    d, o = job.d, job.d["opts"]
    sec = credentials.get(_vk(d["id"]))
    masker = Masker(pii=o.get("mask", True))
    policy = Policy(base=o.get("base", ""), scope=o.get("scope", ""), exclude=o.get("exclude", ""), read_post=o.get("readPost", ""),
                    ban=o.get("ban", []), max_pages=o["maxPages"], max_depth=o["maxDepth"], max_seconds=o["maxSeconds"], delay_ms=o["delayMs"]) if o.get("base") else None
    out: dict = {}
    try:
        job.emit("sys", "note", msg="탐색을 준비하고 있습니다")
        workers = []
        if o["git"]:
            workers.append(threading.Thread(target=_scan, args=(job, o, sec, out), daemon=True))
        if o["crawl"]:
            workers.append(threading.Thread(target=_crawl, args=(job, o, sec, policy, out), daemon=True))
        for w in workers:
            w.start()
        for w in workers:
            w.join()
        if job.cancel.is_set():
            return _finish(job, "cancelled")
        scan_res, crawl_res = out.get("scan"), out.get("crawl")
        if not (scan_res and scan_res.endpoints) and not (crawl_res and crawl_res.observed):
            reason = out.get("error") or "찾은 API 가 없습니다. 주소, 계정, 탐색 범위를 확인해 주세요."
            return _finish(job, "failed", error=reason)

        policy = policy or Policy(base=o.get("base") or "http://localhost")
        job.stage(merge="run")
        job.emit("sys", "stage", st="merge", msg="소스와 트래픽을 대조하고 있습니다", det="값만 다른 요청은 경로 하나로 묶었습니다")
        merged = merge.build(scan_res, crawl_res, policy, masker)
        for note in merged["notes"]:
            job.emit("sys", "note", msg=note)
        d["notes"], d["codeTables"] = merged["notes"], merged["codeTables"]
        apis = merged["apis"]

        job.stage(merge="done", verify="run")
        job.emit("sys", "stage", st="verify", msg="실제 호출로 검증하고 있습니다")
        recipe = _recipe(crawl_res, policy, o)
        d["recipe"] = recipe
        if o.get("base"):
            verify.Verifier(policy, crawl_res.cookies if crawl_res else [], recipe, {"username": sec.get("username", ""), "password": sec.get("password", "")}, o,
                            emit=job.emit, cancelled=job.cancel.is_set).run(apis)
        if job.cancel.is_set():
            return _finish(job, "cancelled")
        merge.finalize(apis, masker)

        d["apis"] = [_public(a) for a in apis]
        d["stats"].update(_final_stats(job, crawl_res, merged, masker, apis))
        job.stage(verify="done", review="run")
        job.emit("sys", "stage", st="review", msg="탐색을 마쳤습니다. 결과를 검토해 주세요")
        _finish(job, "review")
    except Exception as exc:
        _finish(job, "failed", error=f"탐색 중 오류가 났습니다. ({type(exc).__name__}: {str(exc)[:200]})")


def _finish(job: Job, status: str, error: Optional[str] = None) -> None:
    with job.lock:
        job.d.update(status=status, finishedAt=time.time(), error=error)
        if status != "review":
            job.d["stage"] = {k: ("fail" if v == "run" else v) for k, v in job.d["stage"].items()}
    job.crawler = None
    job.save(force=True)


def _scan(job: Job, o: dict, sec: dict, out: dict) -> None:
    job.stage(src="run")
    cleanup = lambda: None
    try:
        root, cleanup, name = repo.prepare(o["repo"], o.get("branch", ""), sec.get("token", ""), job.cancel.is_set)
        local = not o["repo"].startswith(("http", "ssh", "git@"))
        branch = f", {o['branch']} 브랜치" if o.get("branch") and not local else ""
        job.emit("git", "stage", msg="소스 디렉터리 읽기" if local else "저장소 복제", det=f"{name}{branch}, 파일 {repo.count_files(root):,}개")

        def on_file(info, endpoints) -> None:
            api = [e for e in endpoints if e.kind in ("api", "file")]
            notes = [f"화면 이동 매핑 {info.page}개 제외"] if info.page else []
            if info.deprecated:
                notes.append(f"@Deprecated {info.deprecated}개")
            job.scan_files.append((info.file, {merge._stem(e.path) for e in api}))
            job.emit("git", "file", f=info.file.rsplit("/", 1)[-1], dir=info.file, apis=[{"m": e.method or "", "path": e.path, "dep": e.deprecated} for e in api],
                     note=", ".join(notes))

        res = scan_proc.run(root, o.get("framework", "auto"), on_file=on_file, should_cancel=job.cancel.is_set)
        job.emit("git", "stage", msg="프레임워크 감지", det=res.framework or "지원하는 프레임워크를 찾지 못했습니다")
        if res.sql_counts:
            job.emit("git", "stage", msg="매퍼로 읽기, 쓰기 분류", det=", ".join(f"{k} {v}개" for k, v in sorted(res.sql_counts.items())))
        for note in res.notes[:5]:
            job.emit("sys", "note", msg=note)
        job.d["framework"], job.d["files"] = res.framework, res.files
        out["scan"] = res
        job.stage(src="done")
    except (repo.SourceError, scan_proc.ScanAborted, ValueError) as exc:
        out["error"] = f"Git 소스 분석을 하지 못했습니다. {exc}"
        job.emit("sys", "note", msg=out["error"])
        job.stage(src="fail")
    finally:
        cleanup()


def _crawl(job: Job, o: dict, sec: dict, policy: Policy, out: dict) -> None:
    job.stage(web="run")
    try:
        crawler = Crawler(policy, o["start"], sec, emit=job.emit, on_shot=job.set_shot, cancelled=job.cancel.is_set)
        job.crawler = crawler
        res = crawler.run()
        out["crawl"] = res
        job.d["browser"] = res.browser
        if res.error:
            out["error"] = f"화면 탐색을 하지 못했습니다. {res.error}"
            job.emit("sys", "note", msg=out["error"])
        job.emit("web", "done", cnt=len(res.pages), msg="화면 탐색을 마쳤습니다")
        job.stage(web="done" if res.pages and (res.observed or not res.error) else "fail")
    except BrowserUnavailable as exc:
        out["error"] = str(exc)
        job.emit("sys", "note", msg=str(exc))
        job.stage(web="fail")


def _recipe(crawl_res, policy: Policy, o: dict) -> Optional[dict]:
    """로그인 레시피. 화면 탐색이 관찰한 것이 있으면 그것을, 없으면 로그인 화면을 읽어 알아낸다."""
    r = crawl_res.recipe if crawl_res else None
    if r:
        return {"userField": r["userField"], "passField": r["passField"], "extra": r["extra"], "json": r["json"], "loginRel": _rel(policy, r["loginUrl"]),
                "actionRel": _rel(policy, r["action"])}
    if o.get("base") and o.get("start"):
        try:
            return session_auth.discover_recipe(o["start"], lambda x: _rel(policy, x))
        except session_auth.LoginError:
            return None
    return None


def _rel(policy: Policy, url: str) -> str:
    """운영 주소 아래의 주소는 base 를 뗀 상대 경로로, 그 밖은 그대로. 스테이징처럼 base 가 다른 곳에 같은 레시피를 쓰려는 것이다."""
    u = urlsplit(url)
    under = policy.same_origin(url) and (not policy.base_path or u.path == policy.base_path or u.path.startswith(policy.base_path + "/"))
    return policy.rel(u.path) + (f"?{u.query}" if u.query else "") if under else url


def _public(a: dict) -> dict:
    return {k: v for k, v in a.items() if not k.startswith("_")}


def _final_stats(job: Job, crawl_res, merged: dict, masker: Masker, apis: List[dict]) -> dict:
    s = dict(merged["stats"])
    s.update(masked=masker.count, found=len([a for a in apis if a["verify"]["k"] != "out"]), controllers=len(job.scan_files) or job.d["stats"].get("controllers", 0),
             stgVerified=len([a for a in apis if a["verify"]["k"] in ("stg", "stgerr")]))
    if crawl_res:
        s.update(pages=len(crawl_res.pages), requests=crawl_res.total, blocked=crawl_res.blocked, skipped=len(crawl_res.skipped))
    return s


# ── 도구 등록 ───────────────────────────────────────────────────────────────

def _slug(name: str, taken: set, fallback: str = "") -> str:
    """원본 시스템 id. 이름이 한글뿐이면 영문이 남지 않으므로 운영 주소의 호스트(localhost-8000)로 대신한다."""
    import re
    flat = lambda text: re.sub(r"[^0-9a-z]+", "-", text.lower()).strip("-")
    base = flat(name) or flat(fallback) or "legacy"
    sid, n = base, 2
    while sid in taken:
        sid, n = f"{base}-{n}", n + 1
    return sid


def _tool(a: dict, job_id: str) -> dict:
    only_tr = a["ev"] == "tr"
    res = copy.deepcopy(a["res"])
    if only_tr or not res:
        for r in res:
            r["guess"] = 1
    src, tr = a.get("src"), a.get("tr")
    return {"id": a["tool"], "method": a["m"], "path": a["path"], "title": a["title"], "status": "review", "mode": a["mode"], "desc": a["desc"],
            "confirmQ": a.get("confirmQ"), "params": copy.deepcopy(a["params"]), "res": res, "guess": 1 if (only_tr or not res) else 0,
            "disc": {"job": job_id, "id": a["id"], "ev": a["ev"], "verify": a["verify"], "rec": a["rec"], "recNote": a["recNote"],
                     "src": {"file": src["file"], "line": src["line"], "fn": src["fn"], "sql": src["sql"], "mapper": src["mapper"]} if src else None,
                     "tr": {"screen": tr["screen"], "samples": tr["samples"]} if tr else None}}


def register(job_id: str, api_ids: List[str]) -> dict:
    """고른 API 후보를 원본 시스템과 도구 후보로 등록한다. 계정 정보는 금고에서 원본 시스템 금고로 옮긴다.

    같은 운영 주소의 자동 탐색 원본이 이미 있으면 그것을 쓴다. 이미 등록된 도구(같은 API)는 **그대로 두고** 새 것만 더한다.
    사용자가 변환 스튜디오에서 고친 설명과 공개 상태를 다시 탐색 때문에 잃으면 안 된다.
    """
    job = get(job_id)
    d, o = job.d, job.d["opts"]
    if d["status"] not in ("review", "done"):
        raise JobError("탐색이 끝난 뒤에 등록할 수 있습니다.")
    chosen = [a for a in d["apis"] if a["id"] in set(api_ids) and a["tool"]]
    if not chosen:
        raise JobError("도구로 만들 수 있는 API 를 하나 이상 골라 주세요.")
    sources = src_repo.list_sources()
    existing = next((x for x in sources if x.get("proto") == "disc" and x.get("base") == o["base"]), None)
    sid = d.get("sourceId") or (existing["id"] if existing else _slug(d["name"], {x["id"] for x in sources}, urlsplit(o["base"]).netloc))
    current = tool_repo.all_tools().get(sid, [])
    have = {(t.get("disc") or {}).get("id") for t in current}
    taken = {t["id"] for t in tool_repo.flat_tools()}
    new = []
    for a in chosen:
        if a["id"] in have:
            continue
        t = _tool(a, job_id)
        if t["id"] in taken:                                      # 도구 이름은 전체에서 유일해야 AI 가 구분한다
            t["id"] = f"{t['id']}_{sid.replace('-', '_')}"
        taken.add(t["id"])
        new.append(t)
    evidence = {(t.get("disc") or {}).get("ev") for t in current} | {t["disc"]["ev"] for t in new}
    how = "Git 소스와 운영 트래픽으로 추론" if "both" in evidence or {"src", "tr"} <= evidence else "Git 소스로 추론" if "src" in evidence else "운영 트래픽으로 추론"
    prev = existing or next((x for x in sources if x["id"] == sid), None)
    total = len(current) + len(new)
    src = {"id": sid, "name": prev["name"] if prev else d["name"], "desc": f"자동 탐색으로 찾은 API {total}개", "proto": "disc", "spec": how, "base": o["base"],
           "auth": "세션 (서비스 계정)", "authType": "session", "sync": "방금", "specUrl": None}
    sec = credentials.get(_vk(job_id))
    if d.get("recipe"):
        credentials.put(sid, {"type": "session", "username": sec.get("username", ""), "password": sec.get("password", ""), "recipe": d["recipe"]})
        session_auth.invalidate(sid)
    saved_src = src_repo.upsert_source(src)
    saved = tool_repo.replace_source_tools(sid, current + [tool_repo.with_defaults(t, src) for t in new])
    with job.lock:
        d.update(status="done", registered=len(chosen), sourceId=sid)
        d["stage"]["review"] = "done"
    job.save(force=True)
    return {"source": saved_src, "tools": saved, "added": len(new), "loginKnown": bool(d.get("recipe"))}

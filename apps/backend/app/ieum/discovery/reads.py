"""조회에도 POST 를 쓰는 시스템에서, 막은 POST 중 **이름이 조회처럼 보이는 것**을 가려낸다.

나라장터 같은 WebSquare 화면은 목록 조회도 전부 `POST /…/selectBidPblancList.do` 다. 쓰기 요청은 운영에 보내지 않는다는 규칙대로면 화면이
부른 조회가 모조리 막혀 빈 화면만 남는다. 그래서 두 가지를 둔다.

  1) 사람이 정한 경로 패턴(연결 마법사의 "조회용 POST", Policy.read_post)
  2) 사람이 "이름이 조회처럼 보이는 POST 는 보내도 된다"고 허락했을 때(탐색 중 질문에 답했거나 설정에서 미리 켰을 때) 이 모듈의 판정

이 모듈은 2)의 판정만 한다. 브라우저도 상태도 모른다.

판정은 **이름 규칙이고 보장이 아니다.** 화면에서 질문을 띄울 때 그렇게 밝힌다. 그래서 바닥선을 두 겹으로 둔다.
  - 경로의 어느 구간이든 쓰기 낱말(저장·삭제·수정·승인·insert·update…)이 하나라도 있으면 조회로 보지 않는다(policy.risky_call).
    `selectAndUpdateRow.do` 는 select 로 시작해도 걸러진다.
  - 로그인·비밀번호를 주고받는 이름(login, auth, password…)이 구간에 있으면 조회로 보지 않는다.
  - 마지막 구간이 조회 동사(select, get, search…)로 시작하거나 목록·검색 같은 조회 낱말로 끝나야 한다.
    `fileUpload.do`, `budgetSave.do` 는 조회 동사가 없어 걸러지고, REST 식 `POST /orders` 처럼 동사가 없는 이름도 조회로 보지 않는다.
"""
import re
from typing import Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery.policy import _TOKEN, risky_call

# 이름의 첫 낱말이 이 동사이면 조회로 본다. read 는 "읽음 처리"(상태를 바꾸는 것)로 쓰이기도 해서 뺐다.
READ_VERBS = frozenset(("select", "get", "list", "search", "find", "query", "inquiry", "retrieve", "lookup", "count", "detail", "fetch", "load",
                        "srch", "sch", "sel", "inq", "inqr", "lst"))              # 약어(나라장터의 srchBidPbanc 는 공고 검색이다)
# 이름의 마지막 낱말이 이것이면 조회로 본다(orderList.do, bidSearch.do)
READ_ENDS = frozenset(("list", "search", "detail", "count", "inquiry", "lookup", "srch"))
# 로그인·비밀번호를 주고받는 요청은 조회가 아니다(이름이 selectUser 여도). 계정 정보가 오가는 요청은 이 규칙으로 풀어 주지 않는다.
_CREDENTIAL = frozenset(("login", "logon", "signin", "auth", "authenticate", "password", "passwd", "pwd", "credential"))
MAX_PATHS = 200              # 막은 조회형 요청을 경로별로 세는 상한. 폴링 화면이 메모리를 먹지 않게


def _last(path: str) -> str:
    seg = urlsplit(path).path.rstrip("/").rsplit("/", 1)[-1]
    return re.sub(r"\.\w+$", "", seg)


def looks_read(path: str) -> bool:
    """경로의 이름이 조회처럼 보이는가. 쓰기 낱말이 어느 구간에든 있으면 아니다."""
    if risky_call(path):
        return False
    if any(t.lower() in _CREDENTIAL for seg in urlsplit(path).path.split("/") for t in _TOKEN.findall(re.sub(r"\.\w+$", "", seg))):
        return False
    toks = [t.lower() for t in _TOKEN.findall(_last(path))]
    return bool(toks) and (toks[0] in READ_VERBS or toks[-1] in READ_ENDS)


def verb_of(path: str) -> str:
    """질문에 보일 묶음 이름. `selectBidPblancList.do` → `select…`, `orderList.do` → `…List`."""
    seg = _last(path)
    toks = [t for t in _TOKEN.findall(seg)]
    if not toks:
        return seg
    if toks[0].lower() in READ_VERBS:
        return f"{toks[0]}…"
    return f"…{toks[-1]}"


class Seen:
    """막은 조회형 POST 의 기록: 경로 → 횟수. 질문과 결과 안내가 읽는다."""

    def __init__(self) -> None:
        self.paths: Dict[str, int] = {}

    def add(self, path: str) -> bool:
        """처음 보는 경로면 True."""
        p = urlsplit(path).path
        if p not in self.paths and len(self.paths) >= MAX_PATHS:
            return False
        new = p not in self.paths
        self.paths[p] = self.paths.get(p, 0) + 1
        return new

    def __bool__(self) -> bool:
        return bool(self.paths)

    def total(self) -> int:
        return sum(self.paths.values())

    def names(self, limit: int = 4) -> List[str]:
        """사람이 읽을 예시: 마지막 구간만, 많이 막힌 순."""
        order = sorted(self.paths.items(), key=lambda kv: (-kv[1], kv[0]))
        out: List[str] = []
        for p, _n in order:
            seg = p.rsplit("/", 1)[-1]
            if seg not in out:
                out.append(seg)
            if len(out) >= limit:
                break
        return out

    def groups(self) -> List[str]:
        """묶음 이름(select…, get…) 목록."""
        out: List[str] = []
        for p in self.paths:
            g = verb_of(p)
            if g not in out:
                out.append(g)
        return sorted(out)

    def info(self, state: str, limit: int = 8) -> Optional[dict]:
        """작업 결과에 남기는 요약. 막은 것이 없으면 None."""
        if not self.paths:
            return None
        order = sorted(self.paths.items(), key=lambda kv: (-kv[1], kv[0]))
        return {"state": state, "n": self.total(), "paths": [p for p, _n in order[:limit]], "groups": self.groups()}

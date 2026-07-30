"""포털 URL 하나를 등록하면 그 안의 API 를 일괄 수집한다.

상세페이지를 한 장씩 확장으로 넘기는 방식(services/spec_parser.py)은 "가능하다"를
보여주지만, 서비스 하나에 상세기능이 다섯 개면 목록을 다섯 번 바꿔야 한다.
여기서는 목록 URL 하나로 그 전부를 모은다.

    목록 페이지  →  상세페이지 N개  →  각 서비스의 오퍼레이션 전부

상세기능 전환이 `POST /tcs/dss/selectApiDetailFunction.do` 로 조각 HTML 을 준다는 점이
핵심이다. 이게 없으면 서비스당 하나밖에 못 가져온다.

예의:
- 요청 간 최소 1초. executor 의 MIN_INTERVAL_SEC 과 같은 기준이다.
- 수집 상한을 둔다. 무제한 순회하지 않는다.
- 사용자가 URL 을 직접 등록했을 때만 돈다. 스케줄러도, 자동 재크롤도 없다.
"""

import re
import time
from dataclasses import dataclass, field
from typing import Callable, Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

import httpx

from app.services.spec_parser import ParsedOperation, _available_operations, _text, parse_datagokr

BASE = "https://www.data.go.kr"
LIST_PATH = "/tcs/dss/selectDataSetList.do"
DETAIL_FN_PATH = "/tcs/dss/selectApiDetailFunction.do"

# 브라우저처럼 보이려는 게 아니라, 서버가 이 헤더 없이는 다른 응답을 준다.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

MIN_INTERVAL_SEC = 1.0      # 공공 서버 배려. 낮추지 않는다.
DEFAULT_LIMIT = 30          # 오퍼레이션 기준 상한
MAX_LIMIT = 60
PER_PAGE = 10               # 포털 목록의 기본 페이지 크기


@dataclass
class CrawlProgress:
    """진행 상황. 화면이 폴링해 읽는다."""

    status: str = "running"          # running | completed | failed
    phase: str = "목록 조회"
    services_found: int = 0
    services_done: int = 0
    operations: int = 0
    current: str = ""
    message: str = ""
    errors: list = field(default_factory=list)


@dataclass
class ServiceResult:
    public_data_pk: str
    service_name: str
    provider: str
    detail_url: str
    operations: list = field(default_factory=list)


def normalize_list_url(url: str, page: int = 1) -> str:
    """등록된 URL 을 목록 조회 URL 로 정규화한다.

    사용자가 검색 결과 주소를 그대로 붙여넣는 것이 자연스럽다. 키워드만 넣은
    주소든, 필터가 잔뜩 붙은 주소든 페이지 번호만 갈아끼워 재사용한다.
    """
    parsed = urlparse(url)
    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    params.setdefault("dType", "API")
    params["currentPage"] = str(page)
    params.setdefault("perPage", str(PER_PAGE))
    path = parsed.path or LIST_PATH
    return f"{BASE}{path}?{urlencode(params)}"


def is_supported_list_url(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return host in {"www.data.go.kr", "data.go.kr"}


def _sleep_between():
    time.sleep(MIN_INTERVAL_SEC)


def parse_list_page(html_text: str) -> list:
    """목록 HTML 에서 상세페이지 링크를 뽑는다. 순서를 유지하며 중복 제거."""
    seen, out = set(), []
    for match in re.finditer(r'href="(/data/(\d+)/openapi\.do)"', html_text):
        pk = match.group(2)
        if pk in seen:
            continue
        seen.add(pk)
        out.append({"public_data_pk": pk, "url": urljoin(BASE, match.group(1))})
    return out


def _detail_pk(html_text: str) -> Optional[str]:
    m = re.search(r'id="publicDataDetailPk"[^>]*value="([^"]*)"', html_text)
    return m.group(1) if m else None


def fetch_operation_fragment(client: httpx.Client, detail_url: str, public_data_pk: str,
                             detail_pk: str, oprtin_seq_no: str) -> str:
    """상세기능 하나의 명세 조각을 받아온다.

    페이지는 select 로 전환하지만 실제로는 이 엔드포인트가 조각 HTML 을 돌려준다.
    Referer 와 X-Requested-With 가 없으면 서버가 다른 응답을 준다.
    """
    response = client.post(
        f"{BASE}{DETAIL_FN_PATH}",
        headers={"X-Requested-With": "XMLHttpRequest", "Referer": detail_url},
        data={
            "oprtinSeqNo": oprtin_seq_no,
            "publicDataDetailPk": detail_pk,
            "publicDataPk": public_data_pk,
        },
    )
    response.raise_for_status()
    return response.text


def crawl_service(client: httpx.Client, detail_url: str, public_data_pk: str,
                  remaining: int) -> ServiceResult:
    """상세페이지 하나에서 오퍼레이션을 **전부** 모은다.

    초기 HTML 에는 현재 선택된 하나만 실려 있다. 나머지는 select 항목마다
    조각을 따로 받아 붙인다.
    """
    response = client.get(detail_url)
    response.raise_for_status()
    page_html = response.text

    page = parse_datagokr(page_html, detail_url)
    result = ServiceResult(
        public_data_pk=public_data_pk,
        service_name=page.service_name,
        provider=page.provider,
        detail_url=detail_url,
        operations=list(page.operations),
    )

    detail_pk = _detail_pk(page_html)
    if detail_pk is None:
        return result

    collected = {op.op_name for op in result.operations}
    for item in _available_operations(page_html):
        if len(result.operations) >= remaining:
            break
        _sleep_between()
        try:
            fragment = fetch_operation_fragment(
                client, detail_url, public_data_pk, detail_pk, item["id"]
            )
        except httpx.HTTPError:
            # 조각 하나가 실패해도 나머지는 계속 모은다. 서비스 전체를 버리는 것이
            # 더 나쁘다.
            continue

        # 조각에는 서비스 메타(og:title)가 없다. 페이지에서 읽은 값을 물려준다.
        fragment_page = parse_datagokr(fragment, detail_url)
        for op in fragment_page.operations:
            if op.op_name in collected:
                continue
            collected.add(op.op_name)
            op.service_name = page.service_name
            op.provider = page.provider
            op.summary = item["label"] or op.summary
            result.operations.append(op)

    return result


def crawl_portal(list_url: str, limit: int = DEFAULT_LIMIT,
                 on_progress: Optional[Callable[[CrawlProgress], None]] = None) -> tuple:
    """목록 URL 에서 시작해 오퍼레이션이 limit 에 닿을 때까지 모은다.

    (수집 결과 목록, 진행 상황) 을 돌려준다. 진행 상황은 중간에도 콜백으로 넘긴다 —
    수십 초가 걸리는 작업이라 화면이 멈춘 것처럼 보이면 안 된다.
    """
    limit = max(1, min(limit, MAX_LIMIT))
    progress = CrawlProgress()

    def report():
        if on_progress:
            on_progress(progress)

    results: list = []
    seen_services: set = set()

    with httpx.Client(timeout=25.0, headers=HEADERS, follow_redirects=True) as client:
        page_no = 1
        while progress.operations < limit and page_no <= 10:
            progress.phase = f"목록 {page_no}쪽 조회"
            report()
            try:
                listing = client.get(normalize_list_url(list_url, page_no))
                listing.raise_for_status()
            except httpx.HTTPError as exc:
                progress.errors.append(f"목록 {page_no}쪽 실패: {exc}")
                break

            entries = [e for e in parse_list_page(listing.text)
                       if e["public_data_pk"] not in seen_services]
            if not entries:
                break

            progress.services_found += len(entries)
            report()

            for entry in entries:
                if progress.operations >= limit:
                    break
                seen_services.add(entry["public_data_pk"])
                progress.phase = "상세 명세 수집"
                progress.current = entry["url"]
                report()

                _sleep_between()
                try:
                    service = crawl_service(
                        client, entry["url"], entry["public_data_pk"],
                        remaining=limit - progress.operations,
                    )
                except httpx.HTTPError as exc:
                    progress.errors.append(f"{entry['url']} 실패: {exc}")
                    progress.services_done += 1
                    report()
                    continue

                if service.operations:
                    results.append(service)
                    progress.operations += len(service.operations)
                    progress.current = service.service_name
                progress.services_done += 1
                report()

            page_no += 1

    progress.status = "completed"
    progress.phase = "완료"
    progress.current = ""
    progress.message = (
        f"서비스 {len(results)}개에서 오퍼레이션 {progress.operations}개를 수집했습니다"
        if results else "수집된 API가 없습니다. 검색 결과가 있는 목록 URL인지 확인하세요"
    )
    report()
    return results, progress

"""포털 공개 기반 수집 — 기관 포털이 공개한 명세 페이지를 읽어 오퍼레이션을 뽑는다.

트래픽 기반 수집(services/scoring.py 경로)은 "실행되는 API"를 관측하지만,
공공 포털의 API는 대부분 그 페이지에서 실행되지 않는다. 포털은 명세를 게시할 뿐이다.
그래서 여기서는 페이지의 명세 표를 직접 읽는다.

HTML 은 확장이 보내준다. 서버가 포털을 직접 순회하지 않는다 —
data.go.kr robots.txt 가 목록 페이지(/tcs/dss/selectDataSetList.do)를 Disallow 하고 있고,
사용자가 이미 연 페이지를 파싱하는 것과 서버가 긁는 것은 성격이 다르다.

포털이 늘어나면 PARSERS 에 함수 하나만 등록하면 된다. 상위 흐름은 바뀌지 않는다.
"""

import html as html_lib
import re
from dataclasses import dataclass, field
from typing import Callable, Optional
from urllib.parse import urlparse

# 표의 "항목구분" 열에서 필수를 뜻하는 값. 포털이 '필수'로 쓰는 경우도 있어 둘 다 받는다.
_REQUIRED_TOKENS = {"필", "필수"}

# 샘플이 이 값이면 예시로 쓰지 않는다. 포털이 빈칸 대신 넣는 자리표시자다.
_EMPTY_SAMPLE = {"", "-", "–", "—", "없음"}


@dataclass
class SpecParam:
    name: str
    type: str = "string"
    required: bool = False
    description: str = ""
    example: Optional[str] = None


@dataclass
class ParsedOperation:
    op_name: str
    method: str
    base_url: str
    path: str
    service_name: str = ""
    provider: str = ""
    summary: str = ""
    params: list = field(default_factory=list)
    response_fields: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


@dataclass
class ParsedPage:
    """한 번의 수집으로 얻은 것.

    포털 상세페이지는 상세기능을 select 로 전환하는 구조라, 초기 HTML 에는
    **선택된 오퍼레이션 하나의 명세만** 들어 있다. 그래서 이번에 실제로 뽑은 것
    (operations)과 이 서비스에 존재하는 전체 목록(available)을 나눠서 돌려준다.
    화면은 "5개 중 1개 수집됨"을 보여주고, 사용자가 목록을 바꿔 다시 수집하면 누적된다.
    """

    portal: str = ""
    service_name: str = ""
    provider: str = ""
    operations: list = field(default_factory=list)
    available: list = field(default_factory=list)


def _text(fragment: str) -> str:
    """태그를 걷어내고 공백을 정리한다."""
    return re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def _rows(table_html: str) -> list:
    """<tr> 안의 <td> 들을 텍스트 배열로. 헤더(th)만 있는 행은 버린다."""
    out = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, re.S):
        cells = [_text(td) for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if cells:
            out.append(cells)
    return out


def _table_after(html_text: str, heading: str, start: int = 0) -> str:
    """지정한 제목 다음에 오는 첫 <table> 을 잘라낸다.

    포털 페이지는 제목(h4)과 표가 형제로 놓여 있어서, 제목 위치부터 앞으로 훑는 게
    가장 안전하다. 클래스명에 기대면 포털이 스타일을 바꿀 때 바로 깨진다.
    """
    idx = html_text.find(heading, start)
    if idx == -1:
        return ""
    m = re.search(r"<table[^>]*>(.*?)</table>", html_text[idx:], re.S)
    return m.group(1) if m else ""


def _infer_type(size: str, sample: str) -> tuple:
    """항목크기·샘플데이터로 타입을 추정한다. 확신이 없으면 string 으로 두고 사유를 남긴다.

    포털 표에는 타입 열이 아예 없다. 그래서 샘플이 유일한 근거인데,
    '20201114' 같은 날짜 문자열이 숫자로 보이는 함정이 있어 길이를 함께 본다.
    """
    s = (sample or "").strip()
    if s in _EMPTY_SAMPLE:
        return "string", "샘플 없음 — 타입 추정 불가"
    if re.fullmatch(r"-?\d+", s):
        # 8자리 이상 순수 숫자는 날짜·코드일 가능성이 높아 문자열로 둔다
        if len(s.lstrip("-")) >= 8:
            return "string", f"숫자형이나 자릿수({len(s)})가 커 코드·날짜로 판단"
        return "integer", ""
    return "string", ""


def _param_from_row(cells: list) -> Optional[SpecParam]:
    """요청변수 표의 한 행을 파라미터로.

    표준 열: 항목명(국문) | 항목명(영문) | 항목크기 | 항목구분 | 샘플데이터 | 항목설명
    포털·서비스마다 열이 하나씩 모자란 경우가 있어 인덱스로 단정하지 않고 길이로 방어한다.
    """
    if len(cells) < 4:
        return None
    ko, en, size, kind = cells[0], cells[1], cells[2], cells[3]
    sample = cells[4] if len(cells) > 4 else ""
    desc = cells[5] if len(cells) > 5 else ""

    name = re.sub(r"[^A-Za-z0-9_\-]", "", en)
    if not name:
        return None

    ptype, warn = _infer_type(size, sample)
    # 국문 항목명을 설명 앞에 붙인다. LLM 이 한국어 질의에서 파라미터를 고를 때 근거가 된다.
    description = f"{ko} — {desc}".strip(" —") if ko else desc

    return SpecParam(
        name=name,
        type=ptype,
        required=kind.strip() in _REQUIRED_TOKENS,
        description=description,
        example=None if sample.strip() in _EMPTY_SAMPLE else sample.strip(),
    )


def _service_and_provider(page_html: str) -> tuple:
    """og:title 에서 서비스명과 제공기관을 얻는다.

    <title> 은 " | 공공데이터포털" 접미사가 붙어 지저분하다. og:title 은 깨끗하고,
    포털이 '제공기관_서비스명' 규칙으로 짓기 때문에 앞 토큰이 기관명이 된다.
    """
    m = re.search(r'<meta[^>]+og:title[^>]+content="([^"]+)"', page_html)
    if not m:
        m = re.search(r"<title>(.*?)</title>", page_html, re.S)
        if not m:
            return "", ""
    raw = _text(m.group(1)).replace("공공데이터 포털", "").replace("공공데이터포털", "").strip(" |-")
    provider, _, rest = raw.partition("_")
    return (raw, provider) if rest else (raw, "")


def _available_operations(page_html: str) -> list:
    """상세기능 select 에서 이 서비스의 전체 오퍼레이션 목록을 읽는다."""
    m = re.search(r'<select[^>]+id="open_api_detail_select"[^>]*>(.*?)</select>', page_html, re.S)
    if not m:
        return []
    return [
        {"id": opt.group(1), "label": _text(opt.group(2))}
        for opt in re.finditer(r'<option[^>]+value="([^"]+)"[^>]*>(.*?)</option>', m.group(1), re.S)
        if _text(opt.group(2))
    ]


def parse_datagokr(page_html: str, source_url: str = "") -> ParsedPage:
    """공공데이터포털(data.go.kr) 오픈API 상세페이지 → 수집 결과.

    '요청주소'가 오퍼레이션의 시작점이고, 요청변수·출력결과 표가 그 뒤에 따라온다.
    같은 요청주소가 마크업에 두 번 실리는 페이지가 있어 엔드포인트 기준으로 중복을 제거한다.
    """
    service_name, provider = _service_and_provider(page_html)

    operations = []
    seen = set()
    for m in re.finditer(r"요청주소\s*</strong>\s*([^<\s]+)", page_html):
        endpoint = html_lib.unescape(m.group(1)).strip()
        if endpoint in seen:
            continue
        seen.add(endpoint)
        parsed = urlparse(endpoint)
        segments = [s for s in parsed.path.split("/") if s]
        if not segments:
            continue
        op_name = segments[-1]
        base_url = f"{parsed.scheme}://{parsed.netloc}/" + "/".join(segments[:-1])

        req_table = _table_after(page_html, "요청변수(Request Parameter)", m.end())
        res_table = _table_after(page_html, "출력결과(Response Element)", m.end())

        params, warnings = [], []
        for cells in _rows(req_table):
            p = _param_from_row(cells)
            if p is None:
                continue
            params.append(p)
            _, warn = _infer_type("", p.example or "")
            if warn and p.example:
                warnings.append(f"{p.name}: {warn}")

        response_fields = []
        for cells in _rows(res_table):
            if len(cells) >= 2:
                field_name = re.sub(r"[^A-Za-z0-9_\-]", "", cells[1])
                if field_name:
                    response_fields.append({"name": field_name, "description": cells[0]})

        if not params:
            warnings.append("요청변수 표를 찾지 못했습니다 — 파라미터 없이 등록됩니다")

        operations.append(ParsedOperation(
            op_name=op_name,
            method="GET",  # 공공 오픈API 조회는 GET 이 표준. 예외는 검수 단계에서 바로잡는다.
            base_url=base_url,
            path=f"/{op_name}",
            service_name=service_name,
            provider=provider,
            summary=op_name,
            params=params,
            response_fields=response_fields,
            warnings=warnings,
        ))

    return ParsedPage(
        portal="data.go.kr",
        service_name=service_name,
        provider=provider,
        operations=operations,
        available=_available_operations(page_html),
    )


# 포털을 추가할 때 여기에 한 줄만 늘리면 된다.
PARSERS: dict = {
    "www.data.go.kr": parse_datagokr,
    "data.go.kr": parse_datagokr,
}

PORTAL_LABELS: dict = {
    "www.data.go.kr": "공공데이터포털",
    "data.go.kr": "공공데이터포털",
}


def detect_portal(url: str) -> Optional[str]:
    """URL 로 지원 포털인지 판정한다. 확장의 페이지 감지와 백엔드가 같은 기준을 쓴다."""
    host = urlparse(url).netloc.lower()
    return host if host in PARSERS else None


def parse(page_html: str, source_url: str) -> ParsedPage:
    """지원 포털이면 파싱 결과를, 아니면 빈 ParsedPage 를 반환한다."""
    portal = detect_portal(source_url)
    if portal is None:
        return ParsedPage()
    parser: Callable = PARSERS[portal]
    return parser(page_html, source_url)

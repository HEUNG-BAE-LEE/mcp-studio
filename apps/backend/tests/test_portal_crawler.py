"""포털 일괄 수집 — 네트워크 없이 검증되는 부분만 고정한다.

실제 포털을 때리는 테스트는 두지 않는다. 남의 서버 상태에 따라 빨간불이 켜지는
테스트는 신뢰를 잃고, 결국 아무도 안 보게 된다. 대신 URL 정규화·목록 파싱·
오퍼레이션 병합처럼 **우리 코드가 책임지는 부분**을 고정한다.
"""

from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from app.services.portal_crawler import (
    MAX_LIMIT,
    is_supported_list_url,
    normalize_list_url,
    parse_list_page,
)

FIXTURE = Path(__file__).parent / "fixtures" / "datagokr_airkorea.html"


def test_지원_포털만_받는다():
    assert is_supported_list_url("https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=x")
    assert is_supported_list_url("https://data.go.kr/tcs/dss/selectDataSetList.do")
    assert not is_supported_list_url("https://kosis.kr/openapi/index.jsp")


def test_검색_주소를_그대로_붙여넣어도_페이지만_갈아끼운다():
    """사용자가 브라우저 주소창의 값을 그대로 넣는 것이 자연스럽다."""
    pasted = "https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&keyword=미세먼지&sort=updtDt"
    query = parse_qs(urlparse(normalize_list_url(pasted, page=3)).query)

    assert query["currentPage"] == ["3"]
    assert query["keyword"] == ["미세먼지"]
    assert query["sort"] == ["updtDt"]      # 사용자가 건 필터를 잃지 않는다
    assert query["dType"] == ["API"]


def test_dType이_없으면_API로_채운다():
    """파일데이터까지 긁으면 오퍼레이션이 나오지 않는 페이지만 훑게 된다."""
    query = parse_qs(urlparse(normalize_list_url(
        "https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=날씨")).query)
    assert query["dType"] == ["API"]


def test_목록에서_상세_링크를_순서대로_중복없이_뽑는다():
    html = """
    <a href="/data/15073861/openapi.do">에어코리아</a>
    <a href="/data/15073861/openapi.do">에어코리아(중복)</a>
    <a href="/data/3082721/openapi.do">다른 서비스</a>
    <a href="/data/15012345/fileData.do">파일데이터는 제외</a>
    """
    entries = parse_list_page(html)
    assert [e["public_data_pk"] for e in entries] == ["15073861", "3082721"]
    assert entries[0]["url"].startswith("https://www.data.go.kr/data/15073861/")


def test_목록이_비면_빈_결과를_준다():
    assert parse_list_page("<html><body>검색 결과가 없습니다</body></html>") == []


@pytest.mark.skipif(not FIXTURE.exists(), reason="명세 페이지 픽스처 없음")
def test_상세페이지에서_전체_오퍼레이션_목록을_읽는다():
    """초기 HTML 에는 명세가 하나뿐이지만, 몇 개가 더 있는지는 알 수 있어야
    조각을 몇 번 더 받아올지 정할 수 있다."""
    from app.services.spec_parser import _available_operations

    html = FIXTURE.read_text(encoding="utf-8", errors="ignore")
    items = _available_operations(html)
    assert len(items) == 5
    assert all(item["id"].isdigit() for item in items)


def test_상한은_안전한_범위로_묶인다():
    """무제한 순회는 남의 서버에 대한 예의가 아니다."""
    from app.services.portal_crawler import DEFAULT_LIMIT

    assert DEFAULT_LIMIT <= MAX_LIMIT
    assert MAX_LIMIT <= 60

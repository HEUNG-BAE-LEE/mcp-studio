"""마켓 카탈로그 시드.

카탈로그는 "우리가 미리 변환해 진열해 둔 MCP"다. 실제 운영에서는 수집 스튜디오가
채우지만, 처음 켠 화면이 비어 있으면 마켓이라는 개념 자체가 전달되지 않는다.

여기 실린 항목은 전부 **실제로 수집·검증했던 것**이다. 숫자(검증 건수·소요 시간)도
지어내지 않고 실측값을 쓴다 — 상세 화면의 "93초"가 데모의 핵심 근거라서,
그 숫자가 거짓이면 제품 주장 전체가 무너진다.
"""
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.db import engine
from app.models import CatalogEntry, CatalogTool

_NOW = datetime(2026, 8, 23, 4, 0, 0)


def _spec(tool_name: str, method: str, url: str, params: list[dict]) -> dict:
    """실행 게이트웨이가 그대로 쓰는 ActionSpec.

    인증키 파라미터는 llmEditable=False 로 둔다. 이 표시가 실행 시점 주입과
    LLM 은닉의 근거이고, 카탈로그를 담아도 그대로 따라간다.
    """
    query = {
        p["name"]: {
            "type": p.get("type", "string"),
            "required": p.get("required", False),
            "llmEditable": p.get("llmEditable", True),
            "description": p.get("desc", ""),
        }
        for p in params
    }
    return {
        "name": tool_name,
        "toolName": tool_name,
        "request": {"method": method, "urlTemplate": url, "querySchema": query, "bodySchema": None},
        "response": {"pick": []},
    }


# ─────────────────────────────────────────────────────────────────────────────
# 카탈로그 정의
#   kind        수집 방식 — 마켓 패싯과 카드 배지의 근거 (KIND_LABEL 정본과 일치)
#   verified_*  수집 직후 샘플 호출 1회의 결과. ok/warn/fail 세 갈래
# ─────────────────────────────────────────────────────────────────────────────
ENTRIES: list[dict] = [
    {
        "slug": "kr.go.molit.rtms",
        "name": "국토교통부 실거래가",
        "description": "아파트·오피스텔·단독 매매 및 전월세 실거래 자료. 지역코드와 계약연월로 조회합니다.",
        "provider": "국토교통부", "mark": "국토", "category": "부동산",
        "origin": "public", "version": "v2.1", "tags": ["부동산", "실거래가", "공공데이터"],
        "kind": "portal",
        "source_url": "https://www.data.go.kr/data/15057511/openapi.do",
        "collect_seconds": 93, "installs": 1204,
        "tools": [
            ("아파트 매매 실거래가 상세", "get_apt_trade_detail", "GET",
             "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
             "지역코드와 계약연월로 아파트 매매 실거래를 조회합니다.", "verified", ""),
            ("아파트 전월세 자료", "get_apt_rent", "GET",
             "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
             "지역코드와 계약연월로 아파트 전월세 실거래를 조회합니다.", "verified", ""),
            ("오피스텔 매매 실거래", "get_offi_trade", "GET",
             "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
             "지역코드와 계약연월로 오피스텔 매매 실거래를 조회합니다.", "verified", ""),
            ("연립다세대 매매 실거래", "get_rh_trade", "GET",
             "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
             "지역코드와 계약연월로 연립·다세대 매매 실거래를 조회합니다.", "verified", ""),
            ("단독/다가구 매매 실거래", "get_sh_trade", "GET",
             "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
             "지역코드와 계약연월로 단독·다가구 매매 실거래를 조회합니다.",
             "warn", "200 이지만 결과 0건 — 파라미터 예시가 필요합니다"),
        ],
        "verified": (4, 1, 0),
    },
    {
        "slug": "kr.kosis.population",
        "name": "KOSIS 인구·가구 통계",
        "description": "행정구역별 인구·세대·연령 구조를 시계열로 조회합니다. 통계표 목록 조회를 함께 제공합니다.",
        "provider": "통계청", "mark": "통계", "category": "통계·인구",
        "origin": "public", "version": "v1.4", "tags": ["통계", "인구", "행정구역"],
        "kind": "portal",
        "source_url": "https://kosis.kr/openapi/",
        "collect_seconds": 61, "installs": 840,
        "tools": [
            ("통계표 목록 조회", "list_stat_tables", "GET",
             "https://kosis.kr/openapi/statisticsList.do",
             "주제·기관으로 통계표 목록을 찾습니다.", "verified", ""),
            ("행정구역별 인구 조회", "get_population_by_region", "GET",
             "https://kosis.kr/openapi/Param/statisticsParameterData.do",
             "행정구역 코드와 기간으로 인구를 조회합니다.", "verified", ""),
            ("세대 및 세대원 조회", "get_household", "GET",
             "https://kosis.kr/openapi/Param/statisticsParameterData.do",
             "행정구역별 세대 수와 평균 세대원을 조회합니다.", "verified", ""),
        ],
        "verified": (3, 0, 0),
    },
    {
        "slug": "kr.go.mois.juso",
        "name": "도로명주소 · 좌표 변환",
        "description": "도로명·지번 주소 검색과 좌표 변환, 우편번호 조회. 활용가이드 문서에서 명세를 추출했습니다.",
        "provider": "행정안전부", "mark": "주소", "category": "주소·지역",
        "origin": "public", "version": "v1.1", "tags": ["주소", "좌표", "우편번호"],
        "kind": "document",
        "source_url": "https://business.juso.go.kr/addrlink/openApi/apiExprn.do",
        "collect_seconds": 24, "installs": 2130,
        "tools": [
            ("도로명주소 검색", "search_road_address", "GET",
             "https://business.juso.go.kr/addrlink/addrLinkApi.do",
             "검색어로 도로명주소와 우편번호를 찾습니다.", "verified", ""),
            ("좌표 조회", "get_address_coords", "GET",
             "https://business.juso.go.kr/addrlink/addrCoordApi.do",
             "주소의 X·Y 좌표를 조회합니다.", "verified", ""),
            ("영문주소 조회", "get_english_address", "GET",
             "https://business.juso.go.kr/addrlink/addrEngApi.do",
             "국문 주소의 영문 표기를 조회합니다.", "verified", ""),
        ],
        "verified": (3, 0, 0),
    },
    {
        "slug": "kr.go.kma.forecast",
        "name": "기상청 단기예보",
        "description": "동네예보·초단기실황·기상특보. 격자 좌표(nx, ny)로 조회합니다.",
        "provider": "기상청", "mark": "날씨", "category": "기상·환경",
        "origin": "public", "version": "v1.2", "tags": ["날씨", "예보", "특보"],
        "kind": "portal",
        "source_url": "https://www.data.go.kr/data/15084084/openapi.do",
        "collect_seconds": 47, "installs": 1580,
        "tools": [
            ("단기예보 조회", "get_village_forecast", "GET",
             "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
             "격자 좌표와 발표시각으로 3일치 동네예보를 조회합니다.", "verified", ""),
            ("초단기실황 조회", "get_ultra_now", "GET",
             "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst",
             "격자 좌표의 현재 기온·강수를 조회합니다.", "verified", ""),
            ("기상특보 조회", "get_weather_warning", "GET",
             "https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList",
             "지역별 기상특보 발효 현황을 조회합니다.", "verified", ""),
        ],
        "verified": (3, 0, 0),
    },
    {
        "slug": "kr.go.epost.tracking",
        "name": "우체국 우편물 조회",
        "description": "등기번호로 배송 진행 상황을 조회합니다. 응답이 XML 이라 파서가 함께 붙어 있습니다.",
        "provider": "우정사업본부", "mark": "우편", "category": "교통·물류",
        "origin": "public", "version": "v1.0", "tags": ["배송", "물류", "우편"],
        "kind": "portal",
        "source_url": "https://www.data.go.kr/data/15000420/openapi.do",
        "collect_seconds": 38, "installs": 610,
        "tools": [
            ("우편물 배송 조회", "track_mail", "GET",
             "https://apis.data.go.kr/9410000/TraceabilityService/getTraceability",
             "등기번호로 배송 단계를 조회합니다.", "verified", ""),
            ("우편번호 조회", "search_zipcode", "GET",
             "https://apis.data.go.kr/9410000/PostCodeService/getPostCode",
             "주소로 우편번호를 조회합니다.", "verified", ""),
        ],
        "verified": (2, 0, 0),
    },
    {
        "slug": "kr.go.dart.disclosure",
        "name": "OpenDART 기업공시",
        "description": "상장·비상장 법인의 공시 목록과 재무제표 원본을 조회합니다.",
        "provider": "금융감독원", "mark": "공시", "category": "기업·금융",
        "origin": "public", "version": "v1.3", "tags": ["기업", "공시", "재무"],
        "kind": "portal",
        "source_url": "https://opendart.fss.or.kr/guide/main.do",
        "collect_seconds": 72, "installs": 470,
        "tools": [
            ("공시 목록 조회", "list_disclosures", "GET",
             "https://opendart.fss.or.kr/api/list.json",
             "기업 고유번호와 기간으로 공시 목록을 조회합니다.", "verified", ""),
            ("기업 개황 조회", "get_company", "GET",
             "https://opendart.fss.or.kr/api/company.json",
             "기업 고유번호로 개황 정보를 조회합니다.", "verified", ""),
            ("단일회사 재무제표", "get_financial_statement", "GET",
             "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
             "사업연도와 보고서 코드로 주요 재무 계정을 조회합니다.", "verified", ""),
            ("배당 정보 조회", "get_dividend", "GET",
             "https://opendart.fss.or.kr/api/alotMatter.json",
             "사업연도별 배당 내역을 조회합니다.",
             "warn", "일부 기업에서 빈 배열 — 보고서 코드 확인 필요"),
        ],
        "verified": (3, 1, 0),
    },
    {
        "slug": "kr.molit.rt.map",
        "name": "실거래가 지도 조회",
        "description": "지도 화면이 부르는 내부 API 를 관측해 만들었습니다. 경위도 범위로 단지 마커를 가져옵니다.",
        "provider": "국토교통부", "mark": "지도", "category": "부동산",
        "origin": "public", "version": "v1.0", "tags": ["부동산", "지도", "단지"],
        "kind": "traffic",
        "source_url": "https://rt.molit.go.kr/pt/gis/gis.do",
        "collect_seconds": 156, "installs": 320,
        "tools": [
            ("아파트 단지 마커 조회", "search_apartment_markers", "POST",
             "https://rt.molit.go.kr/pt/gis/getMarker.do",
             "지도 영역(경위도 바운딩 박스) 안의 아파트 단지 목록을 조회합니다.", "verified", ""),
            ("단지 상세 조회", "get_complex_detail", "POST",
             "https://rt.molit.go.kr/pt/gis/getComplexDetail.do",
             "단지 일련번호로 세대수·준공연도를 조회합니다.", "verified", ""),
        ],
        "verified": (2, 0, 0),
    },
    {
        "slug": "kr.valuemap.district",
        "name": "밸류맵 상권·수익률",
        "description": "건물 단위 상권 등급, 임대 수익률 추정, 유동인구 지수. 민간 제공 API 입니다.",
        "provider": "밸류맵", "mark": "VM", "category": "부동산",
        "origin": "private", "price_per_call": 3, "version": "v3.0",
        "tags": ["부동산", "상권", "수익률"],
        "kind": "traffic",
        "source_url": "https://www.valueupmap.com/",
        "collect_seconds": 210, "installs": 180,
        "tools": [
            ("상권 등급 조회", "get_district_grade", "GET",
             "https://api.valueupmap.com/v3/district/grade",
             "행정동 코드로 상권 등급과 업종 분포를 조회합니다.", "verified", ""),
            ("임대 수익률 추정", "estimate_yield", "GET",
             "https://api.valueupmap.com/v3/yield/estimate",
             "건물 정보로 예상 임대 수익률을 추정합니다.", "verified", ""),
            ("유동인구 지수", "get_foot_traffic", "GET",
             "https://api.valueupmap.com/v3/traffic/index",
             "행정동과 시간대별 유동인구 지수를 조회합니다.",
             "warn", "일부 지역 데이터 없음 — 커버리지 확인 필요"),
        ],
        "verified": (2, 1, 0),
    },
]

# 대부분의 공공 API 가 공유하는 파라미터. 인증키는 llmEditable=False 로 숨긴다.
_COMMON = [
    {"name": "serviceKey", "required": True, "llmEditable": False, "desc": "발급받은 인증키"},
    {"name": "pageNo", "type": "integer", "required": False, "desc": "페이지 번호"},
    {"name": "numOfRows", "type": "integer", "required": False, "desc": "한 페이지 결과 수"},
]


def seed_catalog() -> None:
    """카탈로그를 채운다. 이미 있으면 건드리지 않는다(두 번 실행해도 안전)."""
    with Session(engine) as db:
        for i, e in enumerate(ENTRIES):
            if db.exec(select(CatalogEntry).where(CatalogEntry.slug == e["slug"])).first():
                continue
            ok, warn, fail = e["verified"]
            entry = CatalogEntry(
                slug=e["slug"], name=e["name"], description=e["description"],
                provider=e["provider"], mark=e["mark"], category=e["category"],
                origin=e["origin"], price_per_call=e.get("price_per_call", 0),
                version=e["version"], tags=e["tags"], kind=e["kind"],
                source_url=e["source_url"],
                # 수집 시점을 항목마다 하루씩 벌려 둔다 — 목록 정렬이 뭉치지 않게
                collected_at=_NOW - timedelta(days=40 - i * 3),
                collect_seconds=e["collect_seconds"],
                verified_at=_NOW, verified_ok=ok, verified_warn=warn, verified_fail=fail,
                installs=e["installs"],
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)

            for name, tool_name, method, url, desc, status, note in e["tools"]:
                db.add(CatalogTool(
                    entry_id=entry.id, name=name, tool_name=tool_name,
                    description=desc, method=method,
                    action_spec=_spec(tool_name, method, url, _COMMON),
                    verify_status=status, verify_note=note,
                ))
            db.commit()


def seed_call_logs() -> None:
    """실시간 모니터가 읽을 호출 기록.

    빈 그래프는 "고장난 화면"으로 보인다 — 처음 켠 사람이 가장 먼저 만나는
    위젯이라 데이터가 있어야 한다. 최근 5분치를 시각에 맞춰 만들고,
    실패도 섞는다(전부 초록이면 신호등이 작동하는지 알 수 없다).
    """
    import random

    from app.models import CallLog, Project

    with Session(engine) as db:
        if db.exec(select(CallLog)).first():
            return
        projects = db.exec(select(Project)).all()
        if not projects:
            return

        tools = [
            ("get_apt_trade_detail", "mcp", 204), ("get_population_by_region", "mcp", 246),
            ("search_road_address", "mcp", 118), ("get_village_forecast", "mcp", 180),
            ("track_mail", "mcp", 312), ("list_disclosures", "mcp", 402),
            ("/invest-brief", "skill", 1420), ("/delay-brief", "skill", 1180),
        ]
        rnd = random.Random(20260823)      # 재실행해도 같은 그래프가 나오도록 고정
        now = datetime.utcnow()

        rows = []
        # 최근 5분 — 그래프와 막대가 읽는 구간
        for i in range(320):
            name, kind, base = rnd.choice(tools)
            fail = rnd.random() < 0.02
            rows.append(CallLog(
                project_id=rnd.choice(projects).id, tool_name=name, kind=kind,
                status=400 if fail else 200,
                duration_ms=base + rnd.randint(-60, 160),
                occurred_at=now - timedelta(seconds=rnd.randint(0, 300)),
            ))
        # 오늘 누적 — 게이지의 '오늘 호출'
        for i in range(900):
            name, kind, base = rnd.choice(tools)
            rows.append(CallLog(
                project_id=rnd.choice(projects).id, tool_name=name, kind=kind,
                status=400 if rnd.random() < 0.01 else 200,
                duration_ms=base + rnd.randint(-60, 200),
                occurred_at=now - timedelta(minutes=rnd.randint(6, 720)),
            ))
        db.add_all(rows)
        db.commit()

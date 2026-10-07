"""소스 분석 결과 모델. 화면 탐색(트래픽)과 대조하는 쪽이 이 모양만 안다."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SrcParam:
    name: str                 # 요청에 실리는 원본 이름 (예: "fromDt")
    type: str                 # 소스에 적힌 타입 그대로 ("String", "int", "List<String>", "Date")
    required: bool = False
    loc: str = "query"        # "query" | "form" | "body" | "path"
    desc: str = ""            # 필드 주석/Javadoc 첫 줄


@dataclass
class SrcEndpoint:
    method: Optional[str]     # "GET"/"POST"/"PUT"/"PATCH"/"DELETE". 매핑에 지정이 없으면 None
    path: str                 # 클래스 접두사까지 합친 전체 매핑 ("/poList.do"). 슬래시로 시작
    file: str                 # 저장소 루트 기준 상대 경로 (POSIX 구분자)
    line: int                 # 1부터. 메서드 이름이 선언된 줄
    cls: str                  # 컨트롤러 클래스(또는 JS/Py 모듈) 이름
    fn: str                   # 메서드/함수 이름
    kind: str                 # "api" | "file" | "page"
    mode: str                 # "read" | "write" | "unknown"
    sql: Optional[str]        # 호출 사슬에서 찾은 매퍼 구문 중 가장 강한 것: "SELECT"|"INSERT"|"UPDATE"|"DELETE"
    mapper: Optional[str]     # "PoMapper.selectPoList" 처럼 (클래스 단순명.구문 id). 찾지 못하면 None
    ret: str                  # 반환 타입 문자열 ("Map<String, Object>", "ModelAndView" ...)
    vo: Optional[str]         # 대표 VO 타입 이름 ("PoSearchVO"). 없으면 None
    deprecated: bool = False
    title: str = ""           # Javadoc/주석의 첫 문장 (없으면 "")
    params: list = field(default_factory=list)   # list[SrcParam]
    snippet: str = ""         # 어노테이션부터 메서드 끝까지 원문, 최대 40줄(넘으면 앞 40줄 + "// ..." 한 줄)
    lang: str = "java"        # "java" | "js" | "py"


@dataclass
class ControllerInfo:
    file: str
    cls: str
    api: int = 0              # kind in (api, file)
    page: int = 0             # kind == page (화면 이동 매핑)
    deprecated: int = 0


@dataclass
class ScanResult:
    framework: str            # 사람이 읽는 라벨 ("전자정부 표준프레임워크 3.10 (Spring MVC, MyBatis)")
    endpoints: list = field(default_factory=list)     # list[SrcEndpoint]  (page 포함. 거르는 일은 호출 측)
    files: int = 0            # 훑은 소스 파일 수 (java/xml/js/ts/py/gradle/pom 등 읽은 것)
    controllers: list = field(default_factory=list)   # list[ControllerInfo]  (엔드포인트가 1개 이상인 파일만)
    sql_counts: dict = field(default_factory=dict)    # api/file 엔드포인트의 sql 별 개수. {"SELECT": 8, "INSERT": 2}
    notes: list = field(default_factory=list)         # 사용자에게 보일 한 줄 메모들 (한계, 건너뛴 것)

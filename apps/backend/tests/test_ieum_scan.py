"""Git 소스 분석 엔진 테스트: 시연용 전자정부 샘플(po-web) 전체와 작은 합성 저장소들.

샘플의 기대값 표(EXPECTED)가 정답이다. 값이 안 맞으면 샘플과 스캐너 중 어느 쪽이 틀렸는지 먼저 따진다.
"""
import time
from pathlib import Path

import pytest

from app.ieum.discovery import scan as scanner
from app.ieum.discovery.scan import ControllerInfo, ScanResult, SrcEndpoint
from app.ieum.discovery.scan.java import name_mode

SAMPLE = Path(__file__).resolve().parent.parent / "app" / "ieum" / "demo_legacy" / "po-web"
S = "String"

SEARCH_PO = [("fromDt", S, False, "query"), ("toDt", S, False, "query"), ("vendCd", S, False, "query"), ("sttsCd", S, False, "query")]
PAGE = ("page", "unknown", None, None, [])

# (컨트롤러, 경로, HTTP, kind, mode, sql, mapper, 파라미터[(이름, 타입, 필수, loc)])
EXPECTED = [
    ("LoginController", "/login.do", None, *PAGE),
    ("LoginController", "/loginProc.do", "POST", "api", "read", "SELECT", "LoginMapper.selectLoginUser",
     [("userId", S, False, "form"), ("userPw", S, False, "form")]),
    ("LoginController", "/logout.do", None, *PAGE),
    ("LoginController", "/main.do", None, *PAGE),
    ("PoController", "/poListView.do", None, *PAGE),
    ("PoController", "/poRegView.do", None, *PAGE),
    ("PoController", "/poPopupView.do", None, *PAGE),
    ("PoController", "/poList.do", "GET", "api", "read", "SELECT", "PoMapper.selectPoList", SEARCH_PO),
    ("PoController", "/poDetail.do", "GET", "api", "read", "SELECT", "PoMapper.selectPoDetail", [("poNo", S, True, "query")]),
    ("PoController", "/poSave.do", "POST", "api", "write", "INSERT", "PoMapper.insertPo",
     [("vendCd", S, False, "form"), ("itemCd", S, False, "form"), ("qty", "int", False, "form"),
      ("unitPrice", "int", False, "form"), ("payTerm", S, False, "form")]),
    ("PoController", "/poApprove.do", "POST", "api", "write", "UPDATE", "PoMapper.updatePoStatus", [("poNo", S, True, "form")]),
    ("PoController", "/poExcelDown.do", "GET", "file", "read", "SELECT", "PoMapper.selectPoList", SEARCH_PO),
    ("PoController", "/oldPoList.do", None, "api", "read", "SELECT", "PoMapper.selectOldPoList", []),
    ("VendController", "/vendListView.do", None, *PAGE),
    ("VendController", "/vendList.do", "GET", "api", "read", "SELECT", "VendMapper.selectVendList", [("vendNm", S, False, "query")]),
    ("ItemController", "/itemPrice.do", "GET", "api", "read", "SELECT", "ItemMapper.selectItemPrice",
     [("itemCd", S, True, "query"), ("vendCd", S, False, "query")]),
    ("PrController", "/prListView.do", None, *PAGE),
    ("PrController", "/prRegView.do", None, *PAGE),
    ("PrController", "/prList.do", "GET", "api", "read", "SELECT", "PrMapper.selectPrList",
     [("deptCd", S, False, "query"), ("sttsCd", S, False, "query")]),
    ("PrController", "/prDraftSave.do", "POST", "api", "write", "INSERT", "PrMapper.insertPrDraft",
     [("title", S, False, "form"), ("content", S, False, "form")]),
    ("PrController", "/prSubmit.do", "POST", "api", "write", "UPDATE", "PrMapper.updatePrSubmit", [("prNo", S, True, "form")]),
    ("BudgetController", "/budgetRemain.do", "GET", "api", "read", "SELECT", "BudgetDAO.selectBudgetRemain",
     [("deptCd", S, False, "query"), ("yyyy", S, False, "query")]),
]
VO_OF = {"/loginProc.do": "LoginVO", "/poList.do": "PoSearchVO", "/poSave.do": "PoVO", "/poExcelDown.do": "PoSearchVO",
         "/vendList.do": "VendSearchVO", "/prList.do": "PrSearchVO", "/prDraftSave.do": "PrVO", "/budgetRemain.do": "BudgetSearchVO"}


# ---------------------------------------------------------------- 도우미
def write(root: Path, files: dict) -> Path:
    for rel, content in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            p.write_bytes(content)
        else:
            p.write_text(content, encoding="utf-8")
    return root


def by_path(res: ScanResult) -> dict:
    return {e.path: e for e in res.endpoints}


def flat(e: SrcEndpoint) -> list:
    return [(p.name, p.type, p.required, p.loc) for p in e.params]


SPRING_IMPORTS = """package t;

import java.util.*;
import javax.servlet.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.ModelAndView;
"""


def spring(tmp_path: Path, body: str, extra: dict = None, name: str = "T") -> ScanResult:
    """컨트롤러 하나(+ 곁다리 파일)를 만들어 분석한다."""
    files = {"src/main/java/t/%sController.java" % name: SPRING_IMPORTS + body}
    files.update(extra or {})
    return scanner.scan(write(tmp_path, files))


@pytest.fixture(scope="module")
def sample() -> ScanResult:
    return scanner.scan(SAMPLE)


# ---------------------------------------------------------------- 시연용 샘플 전체
def test_샘플_프레임워크_라벨은_전자정부_3_10(sample):
    # 매퍼 XML 과 iBatis sqlMap 이 함께 있으므로 둘 다 적힌다
    assert sample.framework == "전자정부 표준프레임워크 3.10 (Spring MVC, MyBatis, iBatis)"


def test_샘플_엔드포인트_표_전체(sample):
    got = {e.path: e for e in sample.endpoints}
    assert sorted(got) == sorted(row[1] for row in EXPECTED)
    for cls, path, method, kind, mode, sql, mapper, params in EXPECTED:
        e = got[path]
        assert (e.cls, e.method, e.kind, e.mode, e.sql, e.mapper) == (cls, method, kind, mode, sql, mapper), path
        assert flat(e) == params, path
        assert e.vo == VO_OF.get(path), path
        assert e.lang == "java"


def test_샘플_api_13_page_9_전체_22(sample):
    kinds = [e.kind for e in sample.endpoints]
    assert len(sample.endpoints) == 22
    assert kinds.count("api") + kinds.count("file") == 13
    assert kinds.count("page") == 9
    assert kinds.count("file") == 1


def test_샘플에_없는_공통_모듈과_테스트_매핑은_나오지_않는다(sample):
    paths = {e.path for e in sample.endpoints}
    # 공통 모듈이라는 설정으로 소스에 일부러 없다. src/test 의 가짜 컨트롤러도 건너뛴다.
    assert not paths & {"/chart/monthly.do", "/common/codeList.do", "/statView.do", "/testOnly.do"}


def test_샘플_deprecated는_oldPoList_하나(sample):
    assert [e.path for e in sample.endpoints if e.deprecated] == ["/oldPoList.do"]
    old = by_path(sample)["/oldPoList.do"]
    assert old.snippet.lstrip().startswith("@Deprecated")      # @Deprecated 는 스니펫에 들어간다
    assert "구 발주 목록" in old.title


def test_샘플_title_ret_파일_줄번호(sample):
    got = by_path(sample)
    assert got["/poList.do"].title == "발주 목록 조회"
    assert got["/poList.do"].ret == "Map<String, Object>"
    assert got["/poExcelDown.do"].ret == "ModelAndView"
    assert got["/login.do"].ret == "String"
    assert got["/oldPoList.do"].ret == "List<Map<String, Object>>"
    for e in sample.endpoints:
        src = (SAMPLE / e.file).read_text(encoding="utf-8").split("\n")
        assert e.file.startswith("src/main/java/") and "\\" not in e.file
        assert e.fn in src[e.line - 1], (e.path, e.line)           # 메서드 이름이 선언된 줄
        assert e.snippet.rstrip().endswith("}")
        assert "/**" not in e.snippet                               # Javadoc 은 스니펫이 아니다


def test_샘플_여러_경로를_가진_매핑은_엔드포인트가_경로_수만큼(sample):
    got = by_path(sample)
    reg, popup = got["/poRegView.do"], got["/poPopupView.do"]
    assert (reg.fn, reg.line) == (popup.fn, popup.line) == ("poRegView", reg.line)


def test_샘플_파라미터_설명은_VO_필드_주석에서(sample):
    descs = {p.name: p.desc for p in by_path(sample)["/poList.do"].params}
    assert descs == {"fromDt": "발주일 시작 (yyyyMMdd)", "toDt": "발주일 종료 (yyyyMMdd)",
                     "vendCd": "거래처 코드", "sttsCd": "상태 코드 (R:요청, A:승인, C:취소)"}
    # 롬복 VO 도 같다
    assert {p.name: p.desc for p in by_path(sample)["/budgetRemain.do"].params} == {"deptCd": "부서 코드", "yyyy": "예산 연도 (yyyy)"}


def test_샘플_controllers_sql_counts_files(sample):
    assert [(c.cls, c.api, c.page, c.deprecated) for c in sample.controllers] == [
        ("BudgetController", 1, 0, 0), ("ItemController", 1, 0, 0), ("LoginController", 1, 3, 0),
        ("PoController", 6, 3, 1), ("PrController", 3, 2, 0), ("VendController", 1, 1, 0)]
    assert all(isinstance(c, ControllerInfo) and c.file.endswith(c.cls + ".java") for c in sample.controllers)
    assert sample.sql_counts == {"SELECT": 9, "INSERT": 2, "UPDATE": 2}
    # src/test 를 뺀 java, xml 파일 수
    expected = [p for p in SAMPLE.rglob("*") if p.is_file() and p.suffix in (".java", ".xml") and "src/test" not in p.as_posix()]
    assert sample.files == len(expected)
    assert sample.notes == []          # 샘플은 사슬로 전부 판정돼 추정도 건너뜀도 없다


def test_샘플_on_file은_컨트롤러마다_한_번(sample):
    calls = []
    res = scanner.scan(SAMPLE, on_file=lambda info, eps: calls.append((info, eps)))
    assert [i.cls for i, _ in calls] == ["BudgetController", "ItemController", "LoginController", "PoController",
                                         "PrController", "VendController"]
    assert sum(len(eps) for _, eps in calls) == len(res.endpoints) == 22
    info, eps = calls[3]
    assert (info.api, info.page) == (6, 3) and len(eps) == 9 and all(e.cls == "PoController" for e in eps)


def test_샘플_취소_즉시면_빈_결과(sample):
    calls = []
    res = scanner.scan(SAMPLE, should_cancel=lambda: True, on_file=lambda i, e: calls.append(i))
    assert res.endpoints == [] and res.controllers == [] and calls == []
    assert any("취소" in n for n in res.notes)


def test_샘플_취소는_중간에도_멈춘다():
    seen = []
    res = scanner.scan(SAMPLE, on_file=lambda i, e: seen.append(i), should_cancel=lambda: len(seen) >= 2)
    assert len(res.controllers) == len(seen) == 2          # 두 번째 컨트롤러를 해석한 뒤 멈춘다
    assert any("취소" in n for n in res.notes)


def test_샘플_스캐너는_소스를_바꾸지_않는다(sample):
    assert (SAMPLE / "src/test/java/egovframework/po/web/PoControllerTest.java").exists()


# ---------------------------------------------------------------- 매핑 읽기
def test_클래스_접두사와_경로_배열_인자(tmp_path):
    res = spring(tmp_path, """
@Controller
@RequestMapping({"/a", "/b"})
public class TController {
    @RequestMapping(value = {"/x.do", "/y.do"})
    public String xy() { return "v"; }

    @GetMapping(path = "/g.do")
    public String g() { return "v"; }
}
""")
    got = sorted((e.path, e.method, e.fn) for e in res.endpoints)
    assert got == [("/a/g.do", "GET", "g"), ("/a/x.do", None, "xy"), ("/a/y.do", None, "xy"),
                   ("/b/g.do", "GET", "g"), ("/b/x.do", None, "xy"), ("/b/y.do", None, "xy")]


def test_접두사_value_path_이름과_슬래시_정리(tmp_path):
    res = spring(tmp_path, """
@Controller
@RequestMapping(path = "/api/")
public class TController {
    @RequestMapping(value = "list")
    public String noSlash() { return "v"; }
    @RequestMapping("//dup")
    public String dup() { return "v"; }
    @GetMapping
    public String root() { return "v"; }
    @GetMapping("/{id:\\\\d+}")
    public String byId(@PathVariable("id") long id) { return "v"; }
}
""")
    assert sorted(by_path(res)) == ["/api/", "/api/dup", "/api/list", "/api/{id}"]          # 경로 없는 매핑은 접두사 그대로
    assert flat(by_path(res)["/api/{id}"]) == [("id", "long", True, "path")]


def test_GetMapping_계열과_method_지정(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @GetMapping("/g.do") public String g() { return "v"; }
    @PostMapping(value = "/p.do") public String p() { return "v"; }
    @PutMapping(path = "/u.do") public String u() { return "v"; }
    @PatchMapping("/pa.do") public String pa() { return "v"; }
    @DeleteMapping("/d.do") public String d() { return "v"; }
    @RequestMapping("/any.do") public String any() { return "v"; }
    @RequestMapping(value = "/two.do", method = {RequestMethod.POST, RequestMethod.GET}) public String two() { return "v"; }
    @RequestMapping(value = "/one.do", method = RequestMethod.PUT, produces = "text/html") public String one() { return "v"; }
}
""")
    assert {e.path: e.method for e in res.endpoints} == {
        "/g.do": "GET", "/p.do": "POST", "/u.do": "PUT", "/pa.do": "PATCH", "/d.do": "DELETE",
        "/any.do": None, "/two.do": "POST", "/one.do": "PUT"}          # 여럿이면 첫 번째, 지정이 없으면 None
    assert res.notes == []                                              # 첫 번째를 쓰는 건 알릴 일이 아니다


def test_경로_상수와_이어_붙인_문자열(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    public static final String BASE = "/v1";
    public static final String DETAIL = BASE + "/detail";

    @GetMapping(DETAIL) public String a() { return "v"; }
    @GetMapping(BASE + "/list.do") public String b() { return "v"; }
    @GetMapping("/lit" + "eral.do") public String c() { return "v"; }
    @GetMapping(Unknown.PATH) public String d() { return "v"; }
}
""")
    assert sorted(by_path(res)) == ["/literal.do", "/v1/detail", "/v1/list.do"]
    assert any("경로를 해석하지 못한 매핑 1개" in n for n in res.notes)     # 풀 수 없는 것은 지어내지 않고 알린다


def test_주석_속_매핑과_문자열_속_기호는_구조를_깨지_않는다(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    // @RequestMapping("/commented.do")
    /* @GetMapping("/commented2.do") */

    @RequestMapping("/first.do")
    public String first() {
        String s = "}{ // not a comment /* nor this */ \\" still string";
        char c = '{';
        char q = '"';
        String url = "http://example.com/{id}";
        return "v"; // 꼬리 { 주석
    }

    @RequestMapping("/second.do")
    public String second() { return "v"; }
}
""")
    got = by_path(res)
    assert sorted(got) == ["/first.do", "/second.do"]
    src = (tmp_path / "src/main/java/t/TController.java").read_text(encoding="utf-8").split("\n")
    assert "String second()" in src[got["/second.do"].line - 1]          # 줄 번호가 원문 기준이다
    assert got["/first.do"].snippet.splitlines()[0].strip() == '@RequestMapping("/first.do")'
    assert got["/first.do"].snippet.rstrip().endswith("}")
    assert "second" not in got["/first.do"].snippet


def test_EUC_KR로_저장된_소스(tmp_path):
    src = (SPRING_IMPORTS + """
@Controller
public class KController {
    /** 발주 목록 조회 */
    @RequestMapping("/poList.do")
    @ResponseBody
    public String poList(@RequestParam("거래처") String vend) { return "한글"; }
}
""").replace("@RequestParam(\"거래처\")", "@RequestParam(\"vend\")")
    write(tmp_path, {"src/main/java/t/KController.java": src.encode("cp949")})
    res = scanner.scan(tmp_path)
    assert [(e.path, e.title) for e in res.endpoints] == [("/poList.do", "발주 목록 조회")]


def test_UTF8_BOM과_CRLF(tmp_path):
    method_line = "    public String b() { return \"v\"; }"
    body = SPRING_IMPORTS + "\n@Controller\npublic class BController {\n    /** 제목 */\n    @GetMapping(\"/b.do\")\n" + method_line + "\n}\n"
    write(tmp_path, {"src/main/java/t/BController.java": b"\xef\xbb\xbf" + body.replace("\n", "\r\n").encode("utf-8")})
    res = scanner.scan(tmp_path)
    e = res.endpoints[0]
    assert (e.path, e.title, e.line) == ("/b.do", "제목", body.split("\n").index(method_line) + 1)
    assert "\r" not in e.snippet


# ---------------------------------------------------------------- kind
def test_kind_판정_api_file_page(tmp_path):
    res = spring(tmp_path, """
@RestController
@RequestMapping("/rest")
class RController {
    @GetMapping("/a") public String a() { return "x"; }
}

@Controller
class CController {
    @RequestMapping("/page.do") public String page() { return "po/poList"; }
    @RequestMapping("/redir.do") public String redir() { return "redirect:/login.do"; }
    @RequestMapping("/fwd.do") public String fwd() { return "forward:/x.do"; }
    @RequestMapping("/mav.do") public ModelAndView mav() { return new ModelAndView("po/list"); }
    @RequestMapping("/void.do") public void noView() { }
    @RequestMapping("/json.do") public ModelAndView json() { return new ModelAndView("jsonView"); }
    @RequestMapping("/json2.do") public ModelAndView json2() { return new ModelAndView(new MappingJackson2JsonView()); }
    @RequestMapping("/json3.do") public String json3() { return "jsonView"; }
    @RequestMapping("/body.do") @ResponseBody public String body() { return "x"; }
    @RequestMapping("/entity.do") public ResponseEntity<String> entity() { return null; }
    @RequestMapping("/excel.do") public ModelAndView excel() { return new ModelAndView("excelView", map); }
    @RequestMapping("/excel2.do") public ModelAndView excel2() { return new ModelAndView(new PoExcelView(), map); }
    @RequestMapping("/excel3.do") public ModelAndView excel3() { return new ModelAndView("poExcelView"); }
    @RequestMapping("/dl.do") public ModelAndView dl() { return new ModelAndView("downloadView"); }
    @RequestMapping("/popup.do") public ModelAndView popup() { return new ModelAndView("po/downloadPopupView"); }
    @RequestMapping("/exceldown.do") public ModelAndView exceldown() { return new ModelAndView("excelDownView"); }
    @RequestMapping("/disp.do") public void disp(HttpServletResponse response) { response.setHeader("Content-Disposition", "attachment"); }
    @RequestMapping("/out.do") public void out(HttpServletResponse response) throws Exception { response.getOutputStream().write(1); }
    @RequestMapping("/writer.do") public void writer(HttpServletResponse response) throws Exception { response.getWriter().print("{}"); }
    @RequestMapping("/resource.do") @ResponseBody public byte[] resource(HttpServletResponse r) { r.setHeader("Content-Disposition", "x"); return null; }
    @GetMapping("/res2.do") public ResponseEntity<Resource> res2() { return null; }
    @GetMapping("/bytes.do") @ResponseBody public byte[] bytes() { return null; }
    @GetMapping("/stream.do") public StreamingResponseBody stream() { return null; }
    @GetMapping("/resources.do") @ResponseBody public List<ResourceVO> resources() { return null; }
    @GetMapping("/dto.do") public ResponseEntity<UserResource> dto() { return null; }
}
""")
    assert {e.path: e.kind for e in res.endpoints} == {
        "/rest/a": "api", "/page.do": "page", "/redir.do": "page", "/fwd.do": "page", "/mav.do": "page", "/void.do": "page",
        "/json.do": "api", "/json2.do": "api", "/json3.do": "api", "/body.do": "api", "/entity.do": "api",
        "/excel.do": "file", "/excel2.do": "file", "/excel3.do": "file", "/dl.do": "file", "/popup.do": "page", "/exceldown.do": "file", "/disp.do": "file", "/out.do": "file",
        "/writer.do": "api", "/resource.do": "file", "/res2.do": "file", "/bytes.do": "file", "/stream.do": "file", "/resources.do": "api", "/dto.do": "api"}


def test_RequestMapping만_있는_클래스도_컨트롤러(tmp_path):
    res = spring(tmp_path, """
@RequestMapping("/legacy")
class LController {
    @RequestMapping("/a.do") @ResponseBody public String a() { return "x"; }
}
class NotController {
    @RequestMapping("/b.do") public String b() { return "x"; }
}
""")
    assert [e.path for e in res.endpoints] == ["/legacy/a.do"]


# ---------------------------------------------------------------- 파라미터
def test_RequestParam_필수와_기본값_이름(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @GetMapping("/g.do")
    public String g(@RequestParam("a") String a, @RequestParam(value = "b", required = false) int b,
                    @RequestParam(name = "c", defaultValue = "1") long c, @RequestParam String d,
                    @RequestParam(required = true) String e, @RequestParam(required = false) Optional<String> f,
                    @RequestParam("ids") List<String> ids) { return "v"; }

    @PostMapping("/p.do")
    public String p(@RequestParam("a") String a, @RequestParam(value = "n") Integer n) { return "v"; }
}
""")
    got = by_path(res)
    assert flat(got["/g.do"]) == [("a", "String", True, "query"), ("b", "int", False, "query"), ("c", "long", False, "query"),
                                  ("d", "String", True, "query"), ("e", "String", True, "query"),
                                  ("f", "Optional<String>", False, "query"), ("ids", "List<String>", True, "query")]
    assert flat(got["/p.do"]) == [("a", "String", True, "form"), ("n", "Integer", True, "form")]   # POST 는 form


def test_PathVariable_RequestBody_와_VO_펼치기(tmp_path):
    res = spring(tmp_path, """
@RestController
public class TController {
    @PutMapping("/po/{poNo}/lines/{no}")
    public Map<String, Object> put(@PathVariable("poNo") String poNo, @PathVariable int no, @Valid @RequestBody PoBody body) { return null; }
}
class PoBody extends Base {
    @JsonProperty("po_memo") private String memo;
    @JsonIgnore private String hidden;
    @NotNull private int qty;
    @NotBlank @Size(max = 10) private String title;
    private List<String> tags;
    private static final String CONST = "x";
    private transient String tmp;
    private static final long serialVersionUID = 1L;
}
class Base { private String regDt; }
""")
    e = res.endpoints[0]
    assert e.path == "/po/{poNo}/lines/{no}" and e.vo == "PoBody"
    assert flat(e) == [("poNo", "String", True, "path"), ("no", "int", True, "path"),
                       ("po_memo", "String", False, "body"), ("qty", "int", True, "body"), ("title", "String", True, "body"),
                       ("tags", "List<String>", False, "body"), ("regDt", "String", False, "body")]     # 상속 필드는 뒤에


def test_VO_상속_롬복_그리고_필드_주석(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @GetMapping("/s.do")
    @ResponseBody
    public String s(@ModelAttribute("searchVO") ChildVO vo, PlainVO plain) { return "x"; }
}
""", extra={"src/main/java/t/ChildVO.java": """package t;
import lombok.Data;

@Data
public class ChildVO extends ParentVO {
    /** 검색어. 두 번째 문장은 버린다. */
    private String keyword;
    // 줄 주석 설명
    private String type;
    private String trailing; // 꼬리 설명
    private String doc; /** 꼬리 Javadoc */
    private int prev; // 이 꼬리 주석은 다음 필드 것이 아니다
    private String next;
}
""", "src/main/java/t/ParentVO.java": """package t;
public class ParentVO extends GrandVO { protected int pageIndex; }
class GrandVO { String grand; }
""", "src/main/java/t/PlainVO.java": "package t;\npublic class PlainVO { public String open; }\n"})
    e = res.endpoints[0]
    assert [(p.name, p.desc) for p in e.params] == [
        ("keyword", "검색어"), ("type", "줄 주석 설명"), ("trailing", "꼬리 설명"), ("doc", "꼬리 Javadoc"),
        ("prev", "이 꼬리 주석은 다음 필드 것이 아니다"), ("next", ""), ("pageIndex", ""), ("grand", ""), ("open", "")]
    assert e.vo == "ChildVO"                                          # 대표 VO 는 첫 번째


def test_request_getParameter_를_파라미터로(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @RequestMapping(value = "/old.do", method = RequestMethod.POST)
    @ResponseBody
    public String old(HttpServletRequest request, HttpSession session, ModelMap model, Model m2, Locale locale, BindingResult br) {
        String a = request.getParameter("alpha");
        String[] b = request.getParameterValues("beta");
        String again = EgovWebUtil.clean(request.getParameter("alpha"));
        String id = (String) session.getAttribute("id");
        return a;
    }

    @GetMapping("/mixed.do")
    @ResponseBody
    public String mixed(@RequestParam("x") String x, HttpServletRequest req) {
        return req.getParameter("x") + req.getParameter("y");
    }
}
""")
    got = by_path(res)
    assert flat(got["/old.do"]) == [("alpha", "String", False, "form"), ("beta", "String", False, "form")]
    assert flat(got["/mixed.do"]) == [("x", "String", True, "query"), ("y", "String", False, "query")]   # 이미 있는 이름은 한 번만


def test_Map_파라미터는_본문에서_꺼낸_키를_파라미터로(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @PostMapping("/m.do")
    @ResponseBody
    public String m(@RequestParam Map<String, String> paramMap, ModelMap model) {
        String x = paramMap.get("poNo");
        boolean y = paramMap.containsKey("force");
        return x;
    }
    @PostMapping("/b.do")
    @ResponseBody
    public String b(@RequestBody Map<String, Object> body) { return (String) body.get("name"); }
}
""")
    got = by_path(res)
    assert flat(got["/m.do"]) == [("poNo", "String", False, "form"), ("force", "String", False, "form")]
    assert flat(got["/b.do"]) == [("name", "Object", False, "body")]


def test_단순_타입_열거형_파일_인자와_제외_타입(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @PostMapping("/up.do")
    @ResponseBody
    public String up(@RequestParam("file") MultipartFile file, MultipartFile other, String plain, int n, Status st,
                     @RequestHeader("X-A") String h, @CookieValue("c") String ck, Principal pr, HttpServletResponse res,
                     Pageable pg, @SessionAttribute("u") String u, UnknownVO unknown) { return "x"; }
}
enum Status { A }
""")
    assert flat(res.endpoints[0]) == [("file", "MultipartFile", True, "form"), ("other", "MultipartFile", False, "form"),
                                      ("plain", "String", False, "form"), ("n", "int", False, "form"), ("st", "Status", False, "form")]
    assert any("UnknownVO" in n for n in res.notes)                     # 클래스를 못 찾은 VO 는 알린다


def test_VO_loc_은_GET이면_query_그_외_form(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @GetMapping("/g.do") @ResponseBody public String g(V v) { return ""; }
    @PostMapping("/p.do") @ResponseBody public String p(V v) { return ""; }
    @RequestMapping("/any.do") @ResponseBody public String any(V v) { return ""; }
    @PostMapping("/b.do") @ResponseBody public String b(@RequestBody V v, @RequestParam("q") String q) { return ""; }
}
class V { private String name; }
""")
    got = by_path(res)
    assert flat(got["/g.do"]) == [("name", "String", False, "query")]
    assert flat(got["/p.do"]) == [("name", "String", False, "form")]
    assert flat(got["/any.do"]) == [("name", "String", False, "query")]      # 메서드 지정이 없으면 어느 쪽에서든 되는 쿼리
    assert flat(got["/b.do"]) == [("name", "String", False, "body"), ("q", "String", True, "query")]   # 본문이 있으면 @RequestParam 은 쿼리


# ---------------------------------------------------------------- title, deprecated, snippet
def test_title은_Javadoc_첫_문장_없으면_줄_주석(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    /**
     * 발주 목록을 조회한다. 뒤 문장은 버린다.
     * @param x 설명
     */
    @GetMapping("/a.do") public String a(@RequestParam("x") String x) { return "v"; }

    /** 제목 줄
     *  본문 줄은 제목이 아니다
     */
    @GetMapping("/b.do") public String b() { return "v"; }

    // 직전 줄 주석
    @GetMapping("/c.do") public String c() { return "v"; }

    @GetMapping("/d.do") public String d() { return "v"; }

    private int x; // 필드의 꼬리 주석
    @GetMapping("/e.do") public String e() { return "v"; }

    // ===== 구획 제목 =====

    @GetMapping("/f.do") public String f() { return "v"; }

    /** The first line wraps
     *  onto the second. Then more. */
    @GetMapping("/g.do") public String g() { return "v"; }

    /** @deprecated 쓰지 말 것 */
    @GetMapping("/h.do") public String h() { return "v"; }

    @ApiOperation(value = "스웨거 설명")
    @GetMapping("/i.do") public String i() { return "v"; }
}
""")
    got = by_path(res)
    assert {p: got[p].title for p in got} == {
        "/a.do": "발주 목록을 조회한다", "/b.do": "제목 줄", "/c.do": "직전 줄 주석", "/d.do": "", "/e.do": "", "/f.do": "",
        "/g.do": "The first line wraps onto the second", "/h.do": "", "/i.do": "스웨거 설명"}
    assert got["/h.do"].deprecated and not got["/a.do"].deprecated      # Javadoc @deprecated 도 본다
    assert flat(got["/a.do"])[0] == ("x", "String", True, "query")
    assert got["/a.do"].params[0].desc == "설명"                        # @param 설명이 파라미터 설명이 된다


def test_클래스에_붙은_Deprecated는_모든_매핑에(tmp_path):
    res = spring(tmp_path, """
@Deprecated
@Controller
public class TController {
    @GetMapping("/a.do") public String a() { return "v"; }
}
""")
    assert res.endpoints[0].deprecated and res.controllers[0].deprecated == 1


def test_스니펫은_40줄까지_넘으면_생략_표시(tmp_path):
    lines = "\n".join("        int v%d = %d;" % (i, i) for i in range(60))
    res = spring(tmp_path, """
@Controller
public class TController {
    /** 긴 메서드 */
    @Deprecated
    @RequestMapping("/long.do")
    @ResponseBody
    public String long1() {
%s
        return "x";
    }

    @RequestMapping("/short.do")
    public String short1() { return "v"; }
}
""" % lines)
    got = by_path(res)
    snip = got["/long.do"].snippet.split("\n")
    assert len(snip) == 41 and snip[-1] == "    // ..."
    assert snip[0].strip() == "@Deprecated" and "긴 메서드" not in got["/long.do"].snippet
    assert got["/short.do"].snippet.rstrip().endswith("{ return \"v\"; }")


def test_한_파일의_여러_컨트롤러(tmp_path):
    seen = []
    res = scanner.scan(write(tmp_path, {"src/main/java/t/Two.java": SPRING_IMPORTS + """
@Controller
class OneController { @GetMapping("/one.do") public String one() { return "v"; } }
@RestController
class TwoController { @GetMapping("/two.do") public String two() { return "v"; } }
"""}), on_file=lambda info, eps: seen.append((info.cls, [e.path for e in eps])))
    assert seen == [("OneController", ["/one.do"]), ("TwoController", ["/two.do"])]
    assert [e.cls for e in res.endpoints] == ["OneController", "TwoController"]


# ---------------------------------------------------------------- 읽기/쓰기: 호출 사슬
MAPPER_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="t.XMapper">
    <!-- <delete id="commentedOut">DELETE FROM T</delete> -->
    <select id="selectOne" resultType="map">SELECT * FROM T</select>
    <select resultType="map" id="selectAll">SELECT * FROM T</select>
    <insert id="insertOne">INSERT INTO T VALUES (1)</insert>
    <update id="updateOne">UPDATE T SET A = 1</update>
    <delete id="deleteOne">DELETE FROM T</delete>
    <select id="selectButWrites">
        <![CDATA[ UPDATE T SET B = 2 ]]>
    </select>
    <select id="selectKeyUser"><selectKey keyProperty="id" resultType="int" order="BEFORE">SELECT 1</selectKey>SELECT 2</select>
</mapper>
"""
CHAIN_FILES = {
    "src/main/resources/mapper/XMapper.xml": MAPPER_XML,
    "src/main/java/t/XMapper.java": "package t;\npublic interface XMapper { Object selectOne(); Object selectAll(); int insertOne(); int updateOne(); int deleteOne(); Object selectButWrites(); }\n",
}


def chain(tmp_path, service_body: str, controller_call: str):
    files = dict(CHAIN_FILES)
    files["src/main/java/t/XService.java"] = "package t;\npublic interface XService { void run(Object o) throws Exception; Object get() throws Exception; }\n"
    files["src/main/java/t/XServiceImpl.java"] = """package t;
import javax.annotation.Resource;
@Service
public class XServiceImpl implements XService {
    @Resource(name = "xMapper") private XMapper xMapper;
    %s
}
""" % service_body
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private XService xService;
    @PostMapping("/run.do") @ResponseBody
    public String run() throws Exception { %s return "x"; }
}
""" % controller_call, files)
    return res.endpoints[0], res


def test_사슬_가장_강한_구문이_정한다(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception {
        xMapper.selectOne();
        xMapper.insertOne();
        xMapper.deleteOne();
        xMapper.updateOne();
    }
    public Object get() { return null; }""", "xService.run(null);")
    assert (e.mode, e.sql, e.mapper) == ("write", "DELETE", "XMapper.deleteOne")     # DELETE > UPDATE > INSERT > SELECT


def test_사슬_INSERT와_UPDATE면_UPDATE(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { xMapper.insertOne(); xMapper.updateOne(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert (e.mode, e.sql, e.mapper) == ("write", "UPDATE", "XMapper.updateOne")


def test_사슬_SELECT만이면_읽기_같은_구문이_둘이면_먼저_나온_것(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { xMapper.selectAll(); xMapper.selectOne(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert (e.mode, e.sql, e.mapper) == ("read", "SELECT", "XMapper.selectAll")


def test_select_태그_안의_SQL이_쓰기면_쓰기(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { xMapper.selectButWrites(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert (e.mode, e.sql) == ("write", "UPDATE")                        # 태그가 아니라 SQL 이 말해 준다


def test_selectKey_는_구문이_아니다(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { xMapper.selectKeyUser(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert e.sql == "SELECT"


def test_주석_처리된_매퍼_구문은_없는_것(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { xMapper.commentedOut(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert (e.sql, e.mapper) == (None, None)                              # 구문이 없으니 이름 추정으로 넘어간다


def test_사슬은_같은_클래스의_도우미_메서드와_this를_따라간다(tmp_path):
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { this.step1(); }
    private void step1() { step2(); }
    private void step2() { this.xMapper.deleteOne(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert (e.sql, e.mapper) == ("DELETE", "XMapper.deleteOne")


def test_사슬은_깊이_5까지만_순환은_막는다(tmp_path):
    levels = "\n".join("    private void l%d() { l%d(); }" % (i, i + 1) for i in range(1, 8))
    e, _ = chain(tmp_path, """
    public void run(Object o) throws Exception { l1(); }
%s
    private void l8() { xMapper.deleteOne(); }
    public Object get() { return null; }""" % levels, "xService.run(null);")
    # 컨트롤러 → run(1) → l1(2) → l2(3) → l3(4) → l4(5) 에서 멈춘다. l8 까지는 닿지 않는다
    assert e.sql is None
    e2, _ = chain(tmp_path / "ok", """
    public void run(Object o) throws Exception { l1(); }
    private void l1() { l2(); }
    private void l2() { l3(); }
    private void l3() { xMapper.deleteOne(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert e2.sql == "DELETE"
    e3, _ = chain(tmp_path / "cycle", """
    public void run(Object o) throws Exception { a(); }
    private void a() { b(); }
    private void b() { a(); xMapper.updateOne(); }
    public Object get() { return null; }""", "xService.run(null);")
    assert e3.sql == "UPDATE"                                            # a ↔ b 순환에도 끝난다


def test_구현체가_둘이어도_이름으로_이어진다(tmp_path):
    files = dict(CHAIN_FILES)
    files["src/main/java/t/Svc.java"] = "package t;\npublic interface Svc { void go() throws Exception; }\n"
    files["src/main/java/t/SvcImpl.java"] = "package t;\npublic class SvcImpl implements Svc { @Autowired private XMapper m; public void go() { m.insertOne(); } }\n"
    files["src/main/java/t/OtherSvc.java"] = "package t;\npublic class OtherSvc implements Svc { @Autowired private XMapper m; public void go() { m.deleteOne(); } }\n"
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private Svc svc;
    @PostMapping("/go.do") @ResponseBody public String go() throws Exception { svc.go(); return "x"; }
}
""", files)
    assert res.endpoints[0].sql == "DELETE"                              # 구현체가 여럿이면 가장 강한 것으로 안전하게


def test_생성자_주입과_Autowired와_Resource(tmp_path):
    files = dict(CHAIN_FILES)
    files["src/main/java/t/A.java"] = "package t;\npublic class A { private final XMapper m; public A(XMapper m) { this.m = m; } public void doIt() { m.insertOne(); } }\n"
    files["src/main/java/t/B.java"] = "package t;\npublic class B { @Resource(name = \"xMapper\") private XMapper m; public void doIt() { m.deleteOne(); } }\n"
    files["src/main/java/t/C.java"] = "package t;\npublic class C { @Autowired private XMapper m; public void doIt() { m.updateOne(); } }\n"
    res = spring(tmp_path, """
@Controller
public class TController {
    private final A a;
    @Resource(name = "b") private B b;
    @Autowired private C c;
    public TController(A a) { this.a = a; }
    @PostMapping("/a.do") @ResponseBody public String ra() { a.doIt(); return "x"; }
    @PostMapping("/b.do") @ResponseBody public String rb() { b.doIt(); return "x"; }
    @PostMapping("/c.do") @ResponseBody public String rc() { c.doIt(); return "x"; }
    @PostMapping("/d.do") @ResponseBody public String rd() { XMapper local = null; local.insertOne(); return "x"; }
}
""", files)
    assert {e.path: e.sql for e in res.endpoints} == {"/a.do": "INSERT", "/b.do": "DELETE", "/c.do": "UPDATE", "/d.do": "INSERT"}


def test_문자열_id로_부르는_DAO_iBatis와_SqlSession(tmp_path):
    files = {
        "src/main/resources/sqlmap/Po_SQL.xml": """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE sqlMap PUBLIC "-//ibatis.apache.org//DTD SQL Map 2.0//EN" "http://ibatis.apache.org/dtd/sql-map-2.dtd">
<sqlMap namespace="Po">
    <select id="poDAO.selectPo" resultClass="egovMap">SELECT * FROM TB_PO</select>
    <update id="poDAO.updatePo">UPDATE TB_PO SET A = 1</update>
</sqlMap>
""",
        "src/main/resources/mapper/Po.xml": """<mapper namespace="po">
    <select id="selectPoList">SELECT 1</select>
    <delete id="deletePoRow">DELETE FROM TB_PO</delete>
</mapper>""",
        "src/main/java/t/PoDAO.java": """package t;
@Repository("poDAO")
public class PoDAO extends EgovAbstractDAO {
    public List selectPo(Object vo) { return list("poDAO.selectPo", vo); }
    public int updatePo(Object vo) { return update("poDAO.updatePo", vo); }
    public Object viaSession(Object vo) { return sqlSession.selectList("po.selectPoList", vo); }
    public int viaSession2(Object vo) { return sqlSession.delete("po.deletePoRow"); }
    public String notAStatement(Object vo) { return "po.nothing" + "view"; }
}
""",
    }
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private PoDAO dao;
    @GetMapping("/a.do") @ResponseBody public Object a() { return dao.selectPo(null); }
    @PostMapping("/b.do") @ResponseBody public Object b() { return dao.updatePo(null); }
    @GetMapping("/c.do") @ResponseBody public Object c() { return dao.viaSession(null); }
    @PostMapping("/d.do") @ResponseBody public Object d() { return dao.viaSession2(null); }
    @GetMapping("/e.do") @ResponseBody public Object e() { return dao.notAStatement(null); }
}
""", files)
    got = by_path(res)
    assert [(got[p].mode, got[p].sql, got[p].mapper) for p in ("/a.do", "/b.do", "/c.do", "/d.do")] == [
        ("read", "SELECT", "PoDAO.selectPo"), ("write", "UPDATE", "PoDAO.updatePo"),
        ("read", "SELECT", "po.selectPoList"), ("write", "DELETE", "po.deletePoRow")]     # 클래스가 없으면 쓴 그대로의 네임스페이스
    assert got["/e.do"].sql is None


def test_어노테이션_매퍼(tmp_path):
    files = {"src/main/java/t/AnnoMapper.java": """package t;
@Mapper
public interface AnnoMapper {
    @Select("SELECT * FROM T WHERE ID = #{id}")
    Object find(String id);
    @Update("UPDATE T SET A = 1")
    int touch();
    @InsertProvider(type = Prov.class, method = "sql")
    int add(Object o);
}
"""}
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private AnnoMapper mapper;
    @GetMapping("/f.do") @ResponseBody public Object f() { return mapper.find("1"); }
    @PostMapping("/t.do") @ResponseBody public Object t() { return mapper.touch(); }
    @PostMapping("/a.do") @ResponseBody public Object a() { return mapper.add(null); }
}
""", files)
    got = by_path(res)
    assert [(got[p].sql, got[p].mapper) for p in ("/f.do", "/t.do", "/a.do")] == [
        ("SELECT", "AnnoMapper.find"), ("UPDATE", "AnnoMapper.touch"), ("INSERT", "AnnoMapper.add")]
    assert res.framework == "Spring MVC (MyBatis)"


def test_getMapper_로_부르는_매퍼(tmp_path):
    files = dict(CHAIN_FILES)
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private SqlSession sqlSession;
    @PostMapping("/g.do") @ResponseBody public Object g() { return sqlSession.getMapper(XMapper.class).deleteOne(); }
}
""", files)
    assert (res.endpoints[0].sql, res.endpoints[0].mapper) == ("DELETE", "XMapper.deleteOne")


def test_page는_판정하지_않는다(tmp_path):
    e, _ = chain(tmp_path, "public void run(Object o) { xMapper.deleteOne(); } public Object get() { return null; }", "xService.run(null);")
    assert e.kind == "api"
    res = spring(tmp_path / "page", """
@Controller
public class TController {
    @Autowired private XService xService;
    @RequestMapping("/pageDelete.do") public String page() throws Exception { xService.run(null); return "view"; }
}
""", {**CHAIN_FILES, "src/main/java/t/XService.java": "package t;\npublic interface XService { void run(Object o) throws Exception; }\n"})
    p = res.endpoints[0]
    assert (p.kind, p.mode, p.sql, p.mapper) == ("page", "unknown", None, None)


# ---------------------------------------------------------------- 읽기/쓰기: 이름 추정
@pytest.mark.parametrize("name,expected", [
    ("selectPoList", "read"), ("getPo", "read"), ("listAll", "read"), ("searchPo", "read"), ("findById", "read"),
    ("queryX", "read"), ("countPo", "read"), ("viewPo", "read"), ("detailPo", "read"), ("inqPo", "read"), ("checkId", "read"),
    ("chkDup", "read"), ("get", "read"), ("list", "read"),
    ("insertPo", "write"), ("savePo", "write"), ("updatePo", "write"), ("deletePo", "write"), ("removePo", "write"),
    ("createPo", "write"), ("modifyPo", "write"), ("cancelPo", "write"), ("approvePo", "write"), ("regPo", "write"),
    ("registerPo", "write"), ("addPo", "write"), ("applyPo", "write"), ("procPo", "write"), ("setStatus", "write"),
    ("mergePo", "write"), ("sendMail", "write"), ("submitPo", "write"), ("save", "write"), ("SAVE_PO", "write"),
    ("poList", "unknown"), ("doIt", "unknown"), ("address", "unknown"), ("setting", "unknown"), ("getter", "unknown"),
    ("listening", "unknown"), ("checkout", "unknown"), ("process_", "write"), ("", "unknown"),
])
def test_메서드_이름_추정(name, expected):
    assert name_mode(name) == expected


def test_사슬로_못_찾으면_이름으로_추정하고_알린다(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private PoService poService;
    @Autowired private MessageSource messageSource;
    @GetMapping("/a.do") @ResponseBody public Object a() { return poService.selectPoList(); }
    @PostMapping("/b.do") @ResponseBody public Object b() { return poService.removePo(); }
    @GetMapping("/c.do") @ResponseBody public Object c() { return poService.doIt(); }
    @PostMapping("/d.do") @ResponseBody public Object deletePoNow() { return poService.doIt(); }
    @GetMapping("/e.do") @ResponseBody public Object selectAndSave() { poService.selectNo(); return poService.savePo(); }
    @GetMapping("/f.do") @ResponseBody public Object f() { messageSource.getMessage("a"); return poService.go(); }
    @GetMapping("/g.do") @ResponseBody public Object g(HttpSession session) { session.setAttribute("a", 1); return null; }
}
""")
    got = by_path(res)
    assert {p: (got[p].mode, got[p].sql, got[p].mapper) for p in got} == {
        "/a.do": ("read", None, None), "/b.do": ("write", None, None), "/c.do": ("unknown", None, None),
        "/d.do": ("write", None, None), "/e.do": ("write", None, None),     # 읽기와 쓰기가 섞이면 쓰기(보수적)
        "/f.do": ("unknown", None, None),                                   # 서비스 계층이 아닌 호출(getMessage)은 근거가 아니다
        "/g.do": ("unknown", None, None)}                                   # 세션 호출(setAttribute)도 근거가 아니다
    assert any("메서드 이름으로" in n and "6개" not in n for n in res.notes)
    assert any("알 수 없는" in n for n in res.notes)


# ---------------------------------------------------------------- 프레임워크 라벨
POM = """<project><properties>%s</properties><dependencies>%s</dependencies></project>"""
MYBATIS = {"src/main/resources/m/A.xml": '<mapper namespace="a.A"><select id="s">SELECT 1</select></mapper>'}
IBATIS = {"src/main/resources/m/B.xml": '<sqlMap namespace="B"><select id="s">SELECT 1</select></sqlMap>'}
CTRL = {"src/main/java/egovframework/x/XController.java": "package egovframework.x;\nimport org.springframework.stereotype.Controller;\n"
        "import org.springframework.web.bind.annotation.*;\n@Controller\npublic class XController { @GetMapping(\"/x.do\") public String x() { return \"v\"; } }\n"}


@pytest.mark.parametrize("pom,extra,label", [
    (POM % ("<egovframework.rte.version>3.10.0</egovframework.rte.version>", ""), MYBATIS, "전자정부 표준프레임워크 3.10 (Spring MVC, MyBatis)"),
    (POM % ("<egovframework.rte.version>3.10.0</egovframework.rte.version>", ""), {}, "전자정부 표준프레임워크 3.10 (Spring MVC)"),
    (POM % ("<egovframework.rte.version>3.9.0</egovframework.rte.version>", ""), IBATIS, "전자정부 표준프레임워크 3.9 (Spring MVC, iBatis)"),
    (POM % ("", ""), {**MYBATIS, **IBATIS}, "전자정부 표준프레임워크 (Spring MVC, MyBatis, iBatis)"),
    (POM % ("", "<dependency><groupId>egovframework.rte</groupId><artifactId>egovframework.rte.ptl.mvc</artifactId>"
              "<version>4.0.0</version></dependency>"), MYBATIS, "전자정부 표준프레임워크 4.0 (Spring MVC, MyBatis)"),
    (POM % ("<rte.v>3.8.1</rte.v>", "<dependency><groupId>egovframework.rte</groupId><artifactId>x</artifactId><version>${rte.v}</version></dependency>"),
     {}, "전자정부 표준프레임워크 3.8 (Spring MVC)"),
])
def test_전자정부_라벨(tmp_path, pom, extra, label):
    res = scanner.scan(write(tmp_path, {"pom.xml": pom, **CTRL, **extra}))
    assert res.framework == label


def test_전자정부는_소스_패키지만으로도_감지(tmp_path):
    res = scanner.scan(write(tmp_path, CTRL))
    assert res.framework == "전자정부 표준프레임워크 (Spring MVC)"


def test_스프링_부트_라벨(tmp_path):
    boot = {"src/main/java/b/B.java": "package b;\nimport org.springframework.web.bind.annotation.*;\n@RestController\npublic class B { @GetMapping(\"/b\") public String b() { return \"\"; } }\n"}
    pom = "<project><parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>2.7.18</version></parent><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>"
    assert scanner.scan(write(tmp_path / "a", {"pom.xml": pom, **boot})).framework == "Spring Boot 2.7"
    assert scanner.scan(write(tmp_path / "b", {"pom.xml": pom, **boot, **MYBATIS})).framework == "Spring Boot 2.7 (MyBatis)"
    gradle = "plugins { id 'org.springframework.boot' version '3.2.1' }\ndependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }"
    assert scanner.scan(write(tmp_path / "c", {"build.gradle": gradle, **boot})).framework == "Spring Boot 3.2"
    nover = "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }"
    assert scanner.scan(write(tmp_path / "d", {"build.gradle": nover, **boot})).framework == "Spring Boot"


def test_순수_스프링_MVC_라벨(tmp_path):
    res = spring(tmp_path, "@Controller\npublic class TController { @GetMapping(\"/a\") public String a() { return \"v\"; } }\n")
    assert res.framework == "Spring MVC"


# ---------------------------------------------------------------- 건너뛰기
def test_제외_디렉터리와_테스트_소스(tmp_path):
    ctrl = SPRING_IMPORTS + "@Controller\npublic class %s { @GetMapping(\"%s\") public String x() { return \"v\"; } }\n"
    files = {"src/main/java/t/RealController.java": ctrl % ("RealController", "/real.do")}
    for i, d in enumerate([".git", "node_modules", "target", "build", "out", "dist", ".gradle", ".idea", "__pycache__", ".venv", "venv",
                           "src/test/java/t", "module/target/classes", "module/build"]):
        files["%s/Skip%dController.java" % (d, i)] = ctrl % ("Skip%dController" % i, "/skip%d.do" % i)
    # 자바 패키지 이름이 build, target, out, test 인 것은 소스다
    for i, d in enumerate(["src/main/java/t/build", "src/main/java/t/target", "src/main/java/t/out", "src/main/java/t/test"]):
        files["%s/Pkg%dController.java" % (d, i)] = ctrl % ("Pkg%dController" % i, "/pkg%d.do" % i)
    res = scanner.scan(write(tmp_path, files))
    assert sorted(by_path(res)) == ["/pkg0.do", "/pkg1.do", "/pkg2.do", "/pkg3.do", "/real.do"]


def test_1MB를_넘는_파일은_건너뛰고_알린다(tmp_path):
    big = SPRING_IMPORTS + "@Controller\npublic class BigController { @GetMapping(\"/big.do\") public String b() { return \"v\"; } }\n// " + "x" * (1024 * 1024) + "\n"
    ok = SPRING_IMPORTS + "@Controller\npublic class OkController { @GetMapping(\"/ok.do\") public String b() { return \"v\"; } }\n"
    res = scanner.scan(write(tmp_path, {"src/main/java/t/BigController.java": big, "src/main/java/t/OkController.java": ok,
                                        "web/huge.js": "x" * (1024 * 1024 + 1)}))
    assert [e.path for e in res.endpoints] == ["/ok.do"]
    assert any("1MB" in n and "BigController.java" in n for n in res.notes)
    assert not any("huge.js" in n for n in res.notes)                 # 선택한 프레임워크와 관계없는 파일은 말하지 않는다


def test_파싱이_터진_파일은_건너뛰고_알린다(tmp_path, monkeypatch):
    from app.ieum.discovery.scan import java as java_mod

    real = java_mod.parse_java

    def flaky(rel, raw):
        if "Bad" in rel:
            raise RuntimeError("boom")
        return real(rel, raw)

    monkeypatch.setattr(java_mod, "parse_java", flaky)
    ctrl = SPRING_IMPORTS + "@Controller\npublic class %s { @GetMapping(\"/%s.do\") public String x() { return \"v\"; } }\n"
    res = scanner.scan(write(tmp_path, {"src/main/java/t/BadController.java": ctrl % ("BadController", "bad"),
                                        "src/main/java/t/GoodController.java": ctrl % ("GoodController", "good")}))
    assert [e.path for e in res.endpoints] == ["/good.do"]
    assert any("BadController.java" in n for n in res.notes)


def test_깨진_자바_소스에도_예외가_없다(tmp_path):
    junk = {
        "src/main/java/t/Junk1.java": "@@@ { { ( \" ' /* ",
        "src/main/java/t/Junk2.java": "package t;\n@Controller\npublic class Junk2 { @RequestMapping(\"/x.do\" public String x( { }\n",
        "src/main/java/t/Junk3.java": "\x00\x01\x02 class } } { @",
        "src/main/java/t/Junk4.java": b"\xff\xfe\x00\x00\xd8\x00",
    }
    ok = SPRING_IMPORTS + "@Controller\npublic class OkController { @GetMapping(\"/ok.do\") public String b() { return \"v\"; } }\n"
    res = scanner.scan(write(tmp_path, {**junk, "src/main/java/t/OkController.java": ok}))
    assert "/ok.do" in by_path(res)


# ---------------------------------------------------------------- Express
EXPRESS_FILES = {
    "app.js": """const express = require('express');
const usersRouter = require('./routes/users');
const app = express();

app.use('/api/users', usersRouter);
app.use('/auth', require('./routes/auth'));
app.use(express.json());

/** 헬스 체크 */
app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/', (req, res) => {
  res.render('index', { title: 'home' });
});
""",
    "routes/users.js": """const router = require('express').Router();
const userController = require('../controllers/userController');
const { create } = require('../controllers/userController');

/**
 * @desc 사용자 목록
 * @route GET /api/users
 */
router.get('/', async (req, res) => {
  const { page, size } = req.query;
  const q = req.query.q;
  res.json([]);
});

router.get('/:id', userController.detail);
router.post('/', auth, create);
router.put('/:id', (req, res) => {
  const name = req.body.name;
  res.json({ id: req.params.id, name });
});

// 삭제 (구버전)
router.delete('/:id(\\\\d+)', function (req, res) {
  res.sendStatus(204);
});

router.route('/:id/avatar')
  .get((req, res) => res.sendFile('/tmp/a.png'))
  .post((req, res) => { res.json({ size: req.body['size'] }); });

module.exports = router;
""",
    "routes/auth.js": """import { Router } from 'express';
const r = Router();
r.post('/login', (req, res) => { res.json({ token: req.body.userId }); });
r.get('/download/:name', (req, res) => { res.download('/files/' + req.params.name); });
export default r;
""",
    "controllers/userController.js": """exports.detail = async (req, res) => {
  const user = await findUser(req.params.id, req.query.expand);
  res.json(user);
};

exports.create = function (req, res) {
  const { name, email = '', age: years } = req.body;
  res.status(201).json({ name });
};
""",
    "test/users.test.js": "const router = require('express').Router();\nrouter.get('/shouldNotAppear', (req, res) => res.send('x'));\n",
    "client.js": "import axios from 'axios';\naxios.get('/api/users').then(r => r);\nconst http = axios.create();\nhttp.get('/api/other');\n",
}


def test_Express_라우터_접두사와_경로_변수(tmp_path):
    res = scanner.scan(write(tmp_path, EXPRESS_FILES))
    assert res.framework == "Express"
    got = {(e.method, e.path): e for e in res.endpoints}
    assert sorted(got) == sorted([
        ("GET", "/health"), ("GET", "/"), ("POST", "/auth/login"), ("GET", "/auth/download/{name}"),
        ("GET", "/api/users"), ("GET", "/api/users/{id}"), ("POST", "/api/users"), ("PUT", "/api/users/{id}"),
        ("DELETE", "/api/users/{id}"), ("GET", "/api/users/{id}/avatar"), ("POST", "/api/users/{id}/avatar")])
    assert all(e.lang == "js" and e.sql is None and e.mapper is None and e.vo is None for e in res.endpoints)   # 테스트·클라이언트 호출은 없다


def test_Express_핸들러_본문에서_파라미터와_kind(tmp_path):
    got = {(e.method, e.path): e for e in scanner.scan(write(tmp_path, EXPRESS_FILES)).endpoints}
    assert flat(got[("GET", "/api/users")]) == [("page", "", False, "query"), ("size", "", False, "query"), ("q", "", False, "query")]
    assert flat(got[("GET", "/api/users/{id}")]) == [("id", "", True, "path"), ("expand", "", False, "query")]      # 다른 파일의 핸들러
    assert flat(got[("POST", "/api/users")]) == [("name", "", False, "body"), ("email", "", False, "body"), ("age", "", False, "body")]
    assert flat(got[("PUT", "/api/users/{id}")]) == [("id", "", True, "path"), ("name", "", False, "body")]
    assert flat(got[("POST", "/auth/login")]) == [("userId", "", False, "body")]
    assert got[("GET", "/api/users/{id}/avatar")].kind == "page"          # res.sendFile 만 하면 화면
    assert got[("GET", "/")].kind == "page" and got[("GET", "/")].mode == "unknown"
    assert got[("GET", "/auth/download/{name}")].kind == "file"
    assert got[("GET", "/health")].kind == "api"
    assert [got[k].mode for k in (("GET", "/health"), ("POST", "/auth/login"), ("DELETE", "/api/users/{id}"))] == ["read", "write", "write"]


def test_Express_title_fn_cls_줄번호(tmp_path):
    res = scanner.scan(write(tmp_path, EXPRESS_FILES))
    got = {(e.method, e.path): e for e in res.endpoints}
    assert got[("GET", "/health")].title == "헬스 체크"
    assert got[("GET", "/api/users")].title == "사용자 목록"               # @desc 태그
    assert got[("DELETE", "/api/users/{id}")].title == "삭제 (구버전)"
    assert (got[("GET", "/api/users/{id}")].fn, got[("POST", "/api/users")].fn, got[("PUT", "/api/users/{id}")].fn) == ("detail", "create", "PUT /:id")
    e = got[("PUT", "/api/users/{id}")]
    assert (e.cls, e.file) == ("users", "routes/users.js")
    assert "router.put('/:id'" in EXPRESS_FILES["routes/users.js"].split("\n")[e.line - 1]
    assert e.snippet.startswith("router.put('/:id'") and e.snippet.rstrip().endswith("});")
    assert sorted(c.file for c in res.controllers) == ["app.js", "routes/auth.js", "routes/users.js"]
    assert res.files == 5                                                  # 테스트 파일은 읽지 않는다


def test_Express_접두사를_못_풀면_접두사_없이(tmp_path):
    res = scanner.scan(write(tmp_path, {"orphan.js": "const router = require('express').Router();\nrouter.get('/orphan', (req, res) => res.json({}));\n"}))
    assert [e.path for e in res.endpoints] == ["/orphan"]


def test_Express_중첩_마운트(tmp_path):
    res = scanner.scan(write(tmp_path, {
        "server.js": "const express = require('express');\nconst api = require('./api');\nconst app = express();\napp.use('/v1', api);\n",
        "api/index.js": "const router = require('express').Router();\nconst items = require('./items');\nrouter.use('/items', items);\nmodule.exports = router;\n",
        "api/items.js": "const router = require('express').Router();\nrouter.get('/:sku', (req, res) => res.json(req.params.sku));\nmodule.exports = router;\n",
    }))
    assert [e.path for e in res.endpoints] == ["/v1/items/{sku}"]


def test_Express_정규식_리터럴과_템플릿이_구조를_깨지_않는다(tmp_path):
    res = scanner.scan(write(tmp_path, {"a.js": r"""const express = require('express');
const router = express.Router();
const clean = (s) => s.replace(/['"`]/g, '').replace(/\//g, '-');
router.get('/one', (req, res) => { res.json({ q: clean(req.query.q), t: `${req.query.t}/x` }); });
router.get(`/dyn/${id}`, (req, res) => res.json({}));
router.get('/two', (req, res) => { res.json({ a: req.query.a / 2 }); });
"""}))
    got = {e.path: flat(e) for e in res.endpoints}
    assert got == {"/one": [("q", "", False, "query"), ("t", "", False, "query")], "/two": [("a", "", False, "query")]}


# ---------------------------------------------------------------- FastAPI / Flask
FASTAPI_FILES = {
    "app/__init__.py": "",
    "app/schemas.py": '''from typing import List, Optional
from pydantic import BaseModel, Field


class PoBase(BaseModel):
    vend_cd: str                       # 거래처 코드
    memo: Optional[str] = None


class PoCreate(PoBase):
    """발주 등록 요청"""
    item_cd: str = Field(..., description="품목 코드")
    qty: int = 1
    tags: List[str] = Field(
        default_factory=list,
        description="태그",
    )
    pay_term: Optional[str] = Field(None, alias="payTerm")
''',
    "app/routers/po.py": '''from fastapi import APIRouter, Depends, Query, Request, Body
from sqlalchemy.orm import Session

from ..schemas import PoCreate
from ..deps import get_db

router = APIRouter(prefix="/po", tags=["po"])


@router.get("/", summary="발주 목록")
def list_po(request: Request, from_dt: str, to_dt: Optional[str] = None, limit: int = Query(10, ge=1),
            db: Session = Depends(get_db)):
    return {"items": []}


@router.get("/{po_no}")
async def get_po(po_no: str, expand: bool = False):
    """발주 상세 조회

    상세 설명은 여기부터.
    """
    return {"po": po_no}


@router.post("/", status_code=201)
def create_po(body: PoCreate, db: Session = Depends(get_db)):
    return {"ok": True}


@router.delete("/{po_no}", deprecated=True)
def delete_po(po_no: str, reason: str = Body(...)):
    return {}
''',
    "app/web/pages.py": '''from fastapi import APIRouter
from fastapi.responses import HTMLResponse

pages = APIRouter()


@pages.get("/login", response_class=HTMLResponse)
def login_page():
    return "<html></html>"
''',
    "app/main.py": '''from fastapi import FastAPI
from .routers import po
from .web.pages import pages

app = FastAPI()
app.include_router(po.router, prefix="/api/v1")
app.include_router(pages)


@app.get("/health")
def health():
    return {"status": "ok"}
''',
    "tests/test_main.py": "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/shouldNotAppear')\ndef t():\n    return {}\n",
}


def test_FastAPI_라우터_접두사와_include_router(tmp_path):
    res = scanner.scan(write(tmp_path, FASTAPI_FILES))
    assert res.framework == "FastAPI"
    got = {(e.method, e.path): e for e in res.endpoints}
    assert sorted(got) == sorted([("GET", "/health"), ("GET", "/api/v1/po"), ("GET", "/api/v1/po/{po_no}"), ("POST", "/api/v1/po"),
                                  ("DELETE", "/api/v1/po/{po_no}"), ("GET", "/login")])
    assert all(e.lang == "py" and e.sql is None and e.mapper is None for e in res.endpoints)
    assert res.files == 5                                                  # tests/ 는 읽지 않는다


def test_FastAPI_파라미터_pydantic_본문과_Depends_제외(tmp_path):
    got = {(e.method, e.path): e for e in scanner.scan(write(tmp_path, FASTAPI_FILES)).endpoints}
    assert flat(got[("GET", "/api/v1/po")]) == [("from_dt", "str", True, "query"), ("to_dt", "Optional[str]", False, "query"),
                                                ("limit", "int", False, "query")]          # Request, Depends 는 파라미터가 아니다
    assert flat(got[("GET", "/api/v1/po/{po_no}")]) == [("po_no", "str", True, "path"), ("expand", "bool", False, "query")]
    post = got[("POST", "/api/v1/po")]
    assert post.vo == "PoCreate"
    assert flat(post) == [("item_cd", "str", True, "body"), ("qty", "int", False, "body"), ("tags", "List[str]", False, "body"),
                          ("payTerm", "Optional[str]", False, "body"), ("vend_cd", "str", True, "body"), ("memo", "Optional[str]", False, "body")]
    assert {p.name: p.desc for p in post.params} == {"item_cd": "품목 코드", "qty": "", "tags": "태그", "payTerm": "",
                                                      "vend_cd": "거래처 코드", "memo": ""}
    assert flat(got[("DELETE", "/api/v1/po/{po_no}")]) == [("po_no", "str", True, "path"), ("reason", "str", True, "body")]


def test_FastAPI_title_deprecated_kind_mode(tmp_path):
    got = {(e.method, e.path): e for e in scanner.scan(write(tmp_path, FASTAPI_FILES)).endpoints}
    assert got[("GET", "/api/v1/po")].title == "발주 목록"                  # summary=
    assert got[("GET", "/api/v1/po/{po_no}")].title == "발주 상세 조회"       # 독스트링 첫 줄
    assert got[("DELETE", "/api/v1/po/{po_no}")].deprecated and not got[("POST", "/api/v1/po")].deprecated
    assert (got[("GET", "/login")].kind, got[("GET", "/login")].mode) == ("page", "unknown")
    assert [got[k].mode for k in (("GET", "/health"), ("POST", "/api/v1/po"), ("DELETE", "/api/v1/po/{po_no}"))] == ["read", "write", "write"]
    e = got[("POST", "/api/v1/po")]
    assert (e.fn, e.cls, e.file) == ("create_po", "po", "app/routers/po.py")
    assert "def create_po" in FASTAPI_FILES["app/routers/po.py"].split("\n")[e.line - 1]
    assert e.snippet.startswith('@router.post("/"') and e.snippet.rstrip().endswith('return {"ok": True}')


FLASK_FILES = {
    "shop/__init__.py": '''from flask import Flask
from .orders import bp as orders_bp

app = Flask(__name__)
app.register_blueprint(orders_bp, url_prefix="/orders")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/items/<int:item_id>", methods=["GET", "POST"])
def item(item_id):
    name = request.form.get("name")
    q = request.args["q"]
    return jsonify(id=item_id)
''',
    "shop/orders.py": '''from flask import Blueprint, request, jsonify

bp = Blueprint("orders", __name__, url_prefix="/ignored")


@bp.route("/<order_id>", methods=["PUT"])
def update_order(order_id):
    data = request.get_json()
    return jsonify({"id": order_id, "status": data["status"], "note": data.get("note")})


@bp.get("/list")
def list_orders():
    """주문 목록"""
    page = request.args.get("page", 1)
    return jsonify([])
''',
}


def test_Flask_methods_블루프린트_접두사(tmp_path):
    res = scanner.scan(write(tmp_path, FLASK_FILES))
    assert res.framework == "Flask" and scanner.detect_framework(tmp_path) == "fastapi"       # fastapi 는 Flask 도 뜻한다
    got = {e.path: e for e in res.endpoints}
    assert sorted(got) == ["/", "/items/{item_id}", "/orders/list", "/orders/{order_id}"]    # 등록할 때 준 url_prefix 가 우선
    assert (got["/items/{item_id}"].method, got["/items/{item_id}"].mode) == ("GET", "write")  # 첫 메서드, POST 가 있으니 쓰기
    assert (got["/orders/{order_id}"].method, got["/orders/{order_id}"].mode) == ("PUT", "write")
    assert (got["/orders/list"].method, got["/orders/list"].mode, got["/orders/list"].title) == ("GET", "read", "주문 목록")
    assert (got["/"].kind, got["/"].mode) == ("page", "unknown")


def test_Flask_파라미터(tmp_path):
    got = {e.path: e for e in scanner.scan(write(tmp_path, FLASK_FILES)).endpoints}
    assert flat(got["/items/{item_id}"]) == [("item_id", "int", True, "path"), ("name", "", False, "form"), ("q", "", False, "query")]
    assert flat(got["/orders/{order_id}"]) == [("order_id", "", True, "path"), ("status", "", False, "body"), ("note", "", False, "body")]
    assert flat(got["/orders/list"]) == [("page", "", False, "query")]


def test_FastAPI와_Flask가_함께_있으면_라벨에_둘_다(tmp_path):
    res = scanner.scan(write(tmp_path, {**FASTAPI_FILES, **{"flask_app/" + k: v for k, v in FLASK_FILES.items()}}))
    assert res.framework == "FastAPI, Flask"


# ---------------------------------------------------------------- 감지, 오류, 성능
def test_프레임워크_감지_근거_파일이_가장_많은_것(tmp_path):
    spring_ctrl = SPRING_IMPORTS + "@Controller\npublic class C%d { @GetMapping(\"/c%d\") public String c() { return \"v\"; } }\n"
    files = {"src/main/java/t/C%d.java" % i: spring_ctrl % (i, i) for i in range(3)}
    files["proxy/server.js"] = "const express = require('express');\nconst app = express();\napp.get('/p', (req, res) => res.json({}));\n"
    files["tools/a.py"] = "from fastapi import FastAPI\napp = FastAPI()\n"
    for i in range(50):                               # 화면용 JS 가 아무리 많아도 근거가 아니면 세지 않는다
        files["web/js/lib%d.js" % i] = "var x = %d;\n" % i
    root = write(tmp_path, files)
    assert scanner.detect_framework(root) == "spring"
    assert scanner.scan(root).framework.startswith("Spring")
    # 같은 저장소를 프레임워크를 지정해 읽을 수도 있다
    assert [e.path for e in scanner.scan(root, "express").endpoints] == ["/p"]
    assert scanner.scan(root, "express").framework == "Express"
    assert scanner.scan(root, "FASTAPI").framework == "FastAPI" and scanner.scan(root, "fastapi").endpoints == []


def test_감지_결과_Express가_더_많으면_Express(tmp_path):
    files = {"a/%d.js" % i: "const express = require('express');\nconst r = express.Router();\nr.get('/x%d', (q, s) => s.json(1));\n" % i
             for i in range(3)}
    files["only.py"] = "from flask import Flask\n"
    root = write(tmp_path, files)
    assert scanner.detect_framework(root) == "express"


def test_프레임워크가_없는_디렉터리(tmp_path):
    write(tmp_path, {"README.md": "# hi", "src/util.js": "console.log(1);", "lib/a.py": "x = 1\n", "Main.java": "public class Main {}\n"})
    assert scanner.detect_framework(tmp_path) == ""
    res = scanner.scan(tmp_path)
    assert res.framework == "" and res.endpoints == [] and res.controllers == [] and res.sql_counts == {} and res.files == 0
    assert any("지원하는 프레임워크를 찾지 못했습니다" in n for n in res.notes)
    empty = tmp_path / "empty"
    empty.mkdir()
    assert scanner.scan(empty).framework == ""


def test_빌드_파일만_스프링이어도_스프링으로_본다(tmp_path):
    res = scanner.scan(write(tmp_path, {"pom.xml": "<project><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></project>",
                                        "src/main/java/t/Util.java": "package t;\npublic class Util {}\n"}))
    assert res.framework == "Spring Boot" and res.endpoints == []


def test_없는_경로와_디렉터리가_아닌_경로는_ValueError(tmp_path):
    with pytest.raises(ValueError, match="찾을 수 없"):
        scanner.scan(tmp_path / "nope")
    with pytest.raises(ValueError, match="찾을 수 없"):
        scanner.detect_framework(tmp_path / "nope")
    f = tmp_path / "file.java"
    f.write_text("class A {}", encoding="utf-8")
    with pytest.raises(ValueError, match="디렉터리"):
        scanner.scan(f)
    with pytest.raises(ValueError, match="지원하지 않는"):
        scanner.scan(tmp_path, "django")


def test_문자열_경로도_받는다():
    assert scanner.scan(str(SAMPLE)).framework.startswith("전자정부")


def test_컨트롤러_300개를_5초_안에(tmp_path):
    template = """package perf;

import javax.annotation.Resource;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

/** 모듈 %(i)d 컨트롤러 */
@Controller
@RequestMapping("/m%(i)d")
public class Mod%(i)dController {

    @Resource(name = "mod%(i)dService")
    private Mod%(i)dService service;

    /** 목록 화면 */
    @RequestMapping("/listView.do")
    public String listView() { return "m%(i)d/list"; }

    /** 목록 조회 */
    @RequestMapping(value = "/list.do", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> list(@ModelAttribute("searchVO") Mod%(i)dSearchVO searchVO) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("list", service.selectList(searchVO));
        return result;
    }

    /** 저장 */
    @PostMapping("/save.do")
    @ResponseBody
    public Map<String, Object> save(Mod%(i)dVO vo, @RequestParam("id") String id) throws Exception {
        service.save(vo);
        return new HashMap<String, Object>();
    }

    /** 삭제 */
    @PostMapping("/delete.do")
    @ResponseBody
    public Map<String, Object> delete(@RequestParam("id") String id) throws Exception {
        service.delete(id);
        return new HashMap<String, Object>();
    }
}
"""
    files = {}
    for i in range(300):
        v = {"i": i}
        files["src/main/java/perf/Mod%dController.java" % i] = template % v
        files["src/main/java/perf/Mod%dService.java" % i] = "package perf;\npublic interface Mod%(i)dService {\n    java.util.List<java.util.Map<String, Object>> selectList(Mod%(i)dSearchVO vo) throws Exception;\n    void save(Mod%(i)dVO vo) throws Exception;\n    void delete(String id) throws Exception;\n}\n" % v
        files["src/main/java/perf/Mod%dServiceImpl.java" % i] = "package perf;\n@Service(\"mod%(i)dService\")\npublic class Mod%(i)dServiceImpl implements Mod%(i)dService {\n    @Resource(name = \"mod%(i)dMapper\") private Mod%(i)dMapper mapper;\n    public java.util.List<java.util.Map<String, Object>> selectList(Mod%(i)dSearchVO vo) throws Exception { return mapper.selectList(vo); }\n    public void save(Mod%(i)dVO vo) throws Exception { mapper.insert(vo); }\n    public void delete(String id) throws Exception { mapper.delete(id); }\n}\n" % v
        files["src/main/java/perf/Mod%dMapper.java" % i] = "package perf;\n@Mapper(\"mod%(i)dMapper\")\npublic interface Mod%(i)dMapper {\n    java.util.List<java.util.Map<String, Object>> selectList(Mod%(i)dSearchVO vo) throws Exception;\n    int insert(Mod%(i)dVO vo) throws Exception;\n    int delete(String id) throws Exception;\n}\n" % v
        files["src/main/java/perf/Mod%dSearchVO.java" % i] = "package perf;\npublic class Mod%(i)dSearchVO {\n    private String a; private String b; // 비고\n    /** 설명 */\n    private String c;\n}\n" % v
        files["src/main/java/perf/Mod%dVO.java" % i] = "package perf;\npublic class Mod%(i)dVO { private String x; private int y; private String z; }\n" % v
        files["src/main/resources/mapper/Mod%dMapper.xml" % i] = (
            '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">\n'
            '<mapper namespace="perf.Mod%(i)dMapper">\n  <select id="selectList" resultType="map">SELECT * FROM T%(i)d WHERE A = #{a}</select>\n'
            '  <insert id="insert">INSERT INTO T%(i)d VALUES (#{x})</insert>\n  <delete id="delete">DELETE FROM T%(i)d WHERE ID = #{id}</delete>\n</mapper>\n' % v)
    write(tmp_path, files)
    t0 = time.time()
    res = scanner.scan(tmp_path)
    assert time.time() - t0 < 5
    assert len(res.controllers) == 300 and len(res.endpoints) == 1200
    assert res.sql_counts == {"SELECT": 300, "INSERT": 300, "DELETE": 300}
    assert res.notes == []


# ---------------------------------------------------------------- 추가 사례: 자바
def test_코드_속_SQL_문자열과_JPA_Query도_근거(tmp_path):
    files = {
        "src/main/java/t/RawDao.java": """package t;
public class RawDao {
    public List<Map<String, Object>> find() { return jdbcTemplate.queryForList("SELECT * FROM TB_PO WHERE A = ?"); }
    public int add() { return jdbcTemplate.update("insert into TB_PO (A) values (?)"); }
    public int touch() { return jdbcTemplate.update("UPDATE TB_PO SET A = 1"); }
    public int wipe() { return jdbcTemplate.update("delete from TB_PO"); }
    public String log() { return "Update failed for the vendor"; }
    public String msg() { return "Select one of the following options"; }
}
""",
        "src/main/java/t/PoRepository.java": """package t;
public interface PoRepository extends JpaRepository<Po, Long> {
    @Query("select p from Po p where p.no = :no")
    Po byNo(String no);
    @Modifying
    @Query(value = "UPDATE tb_po SET stts = 'A' WHERE po_no = :no", nativeQuery = true)
    int approve(String no);
    @Query("delete from Po p where p.old = true")
    int purge();
    @Query("from Po")
    List<Po> all();
}
""",
    }
    res = spring(tmp_path, """
@RestController
public class TController {
    @Autowired private RawDao dao;
    @Autowired private PoRepository repo;
    @GetMapping("/find") public Object find() { return dao.find(); }
    @PostMapping("/add") public Object add() { return dao.add(); }
    @PostMapping("/touch") public Object touch() { return dao.touch(); }
    @PostMapping("/wipe") public Object wipe() { return dao.wipe(); }
    @GetMapping("/log") public Object log() { return dao.log(); }
    @GetMapping("/msg") public Object msg() { return dao.msg(); }
    @GetMapping("/byNo") public Object byNo() { return repo.byNo("1"); }
    @PostMapping("/approve") public Object approve() { return repo.approve("1"); }
    @PostMapping("/purge") public Object purge() { return repo.purge(); }
    @GetMapping("/all") public Object all() { return repo.all(); }
}
""", files)
    got = by_path(res)
    assert [(got[p].mode, got[p].sql, got[p].mapper) for p in ("/find", "/add", "/touch", "/wipe")] == [
        ("read", "SELECT", "RawDao.find"), ("write", "INSERT", "RawDao.add"), ("write", "UPDATE", "RawDao.touch"), ("write", "DELETE", "RawDao.wipe")]
    assert got["/log"].sql is None and got["/msg"].sql is None                  # 로그 문구는 SQL 이 아니다
    assert [(got[p].sql, got[p].mapper) for p in ("/byNo", "/approve", "/purge", "/all")] == [
        ("SELECT", "PoRepository.byNo"), ("UPDATE", "PoRepository.approve"), ("DELETE", "PoRepository.purge"), ("SELECT", "PoRepository.all")]
    assert res.framework == "Spring MVC"                                         # @Query 는 MyBatis 가 아니다


def test_record_VO와_인터페이스_상수_경로(tmp_path):
    files = {
        "src/main/java/t/Paths.java": 'package t;\npublic interface Paths { String PO = "/po"; String LIST = PO + "/list"; }\n',
        "src/main/java/t/SearchReq.java": """package t;
public record SearchReq(@NotBlank String keyword, int page, List<String> tags) {}
""",
    }
    res = spring(tmp_path, """
@RestController
public class TController {
    @GetMapping(Paths.LIST) public Object list(SearchReq req) { return null; }
    @PostMapping(value = Paths.PO) public Object add(@RequestBody SearchReq req) { return null; }
}
""", files)
    got = by_path(res)
    assert sorted(got) == ["/po", "/po/list"]
    assert flat(got["/po/list"]) == [("keyword", "String", True, "query"), ("page", "int", False, "query"), ("tags", "List<String>", False, "query")]
    assert flat(got["/po"])[0] == ("keyword", "String", True, "body")


def test_VO를_둘_받아_겹치는_필드는_한_번만(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @PostMapping("/add.do") public String add(@ModelAttribute("searchVO") BaseVO searchVO, ChildVO child) { return "v"; }
}
class BaseVO { private String q; private int page; }
class ChildVO extends BaseVO { private String name; }
""")
    assert [p.name for p in res.endpoints[0].params] == ["q", "page", "name"]


def test_iBatis_네임스페이스_점_id_방식도_조회된다(tmp_path):
    files = {
        "src/main/resources/Budget_SQL.xml": '<sqlMap namespace="budgetDAO"><select id="selectRemain">SELECT 1</select><update id="updateRemain">UPDATE T SET A = 1</update></sqlMap>',
        "src/main/java/t/BudgetDAO.java": """package t;
public class BudgetDAO extends EgovAbstractDAO {
    public Object remain() { return select("budgetDAO.selectRemain"); }
    public Object upd() { return update("budgetdao.updateRemain"); }
}
""",
    }
    res = spring(tmp_path, """
@RestController
public class TController {
    @Autowired private BudgetDAO dao;
    @GetMapping("/remain") public Object remain() { return dao.remain(); }
    @PostMapping("/upd") public Object upd() { return dao.upd(); }
}
""", files)
    got = by_path(res)
    assert (got["/remain"].mapper, got["/remain"].sql) == ("BudgetDAO.selectRemain", "SELECT")      # 빈 이름 budgetDAO → 소스의 BudgetDAO
    assert (got["/upd"].mapper, got["/upd"].sql) == ("BudgetDAO.updateRemain", "UPDATE")           # 대소문자는 가리지 않는다
    assert res.framework == "Spring MVC (iBatis)"


def test_경로_변수_정규식과_중괄호_정리():
    from app.ieum.discovery.scan.paths import express_template, flask_template, join_path
    assert join_path("/api", "/y/{year:\\d{4}}/{id:[0-9]+}") == "/api/y/{year}/{id}"
    assert join_path("", "x") == "/x" and join_path("/p/", "") == "/p/" and join_path("/p", "/") == "/p" and join_path("", "") == "/"
    assert express_template("/u/:id(\\d+)/p/:name?") == "/u/{id}/p/{name}"
    assert flask_template("/u/<int:id>/<name>") == "/u/{id}/{name}"


def test_심볼릭_링크는_따라가지_않는다(tmp_path):
    import os
    outside = tmp_path / "outside"
    write(outside, {"Secret.java": SPRING_IMPORTS + "@Controller\npublic class Secret { @GetMapping(\"/secret\") public String s() { return \"v\"; } }\n"})
    repo = tmp_path / "repo"
    write(repo, {"src/main/java/t/OkController.java": SPRING_IMPORTS + "@Controller\npublic class OkController { @GetMapping(\"/ok\") public String s() { return \"v\"; } }\n"})
    try:
        os.symlink(str(outside / "Secret.java"), str(repo / "src/main/java/t/Linked.java"))
        os.symlink(str(outside), str(repo / "src/main/java/t/linkdir"))
    except OSError:
        pytest.skip("이 환경은 심볼릭 링크를 만들 수 없다")
    assert [e.path for e in scanner.scan(repo).endpoints] == ["/ok"]


# ---------------------------------------------------------------- 추가 사례: FastAPI, Express
def test_FastAPI_파라미터_위치는_타입_규칙을_따른다(tmp_path):
    res = scanner.scan(write(tmp_path, {"main.py": '''from enum import Enum
from typing import Annotated, Any, Dict, List, Optional
from fastapi import FastAPI, Query, Body, File, UploadFile, Depends, Header
from pydantic import BaseModel

app = FastAPI()


class Color(str, Enum):
    red = "red"


class Item(BaseModel):
    name: str


@app.post("/items/{item_id}")
def f(item_id: int, q: str, color: Color, tags: List[str], ids: List[int] = Query(None), payload: dict = None,
      raw: Dict[str, int] = {}, anything: Any = None, item: Item = None, items: List[Item] = [], other: Foreign = None,
      page: Annotated[int, Query(ge=1)] = 1, title: Annotated[str, Body()] = "x", upload: UploadFile = File(...),
      token: str = Header(None), db: Annotated[Session, Depends(get_db)] = None, opt: Optional[int] = None):
    return {}
'''}))
    e = res.endpoints[0]
    assert flat(e) == [
        ("item_id", "int", True, "path"), ("q", "str", True, "query"), ("color", "Color", True, "query"),
        ("tags", "List[str]", True, "body"),                       # Query() 없는 List 는 본문
        ("ids", "List[int]", False, "query"), ("payload", "dict", False, "body"), ("raw", "Dict[str, int]", False, "body"),
        ("anything", "Any", False, "body"), ("name", "str", True, "body"),         # item: Item 은 필드로 펼친다
        ("items", "List[Item]", False, "body"),                                    # 모델 목록은 펼 수 없다
        ("other", "Foreign", False, "query"),                                      # 소스에 없는 타입은 쿼리
        ("page", "int", False, "query"), ("title", "str", False, "body"), ("upload", "UploadFile", True, "form"),
        ("opt", "Optional[int]", False, "query")]
    assert e.vo == "Item"


def test_Express_이름_핸들러와_래퍼_download(tmp_path):
    res = scanner.scan(write(tmp_path, {"app.js": """const express = require('express');
const app = express();
function list(req, res) { res.json({ q: req.query.q }); }
const create = async (req, res) => { res.json(req.body.title); };
app.get('/items', list);
app.post('/items', asyncHandler(async (request, res) => { res.json({ t: request.body.title }); }));
app.get('/dl', (req, res) => res.download('x'));
app.get('/files/:id', create);
app.get('/missing', notDefinedAnywhere);
"""}))
    got = {(e.method, e.path): e for e in res.endpoints}
    assert flat(got[("GET", "/items")]) == [("q", "", False, "query")] and got[("GET", "/items")].fn == "list"
    assert flat(got[("POST", "/items")]) == [("t", "", False, "body")] or flat(got[("POST", "/items")]) == [("title", "", False, "body")]
    assert got[("GET", "/dl")].kind == "file"
    assert flat(got[("GET", "/files/{id}")]) == [("id", "", True, "path"), ("title", "", False, "body")]
    assert flat(got[("GET", "/missing")]) == [] and got[("GET", "/missing")].kind == "api"     # 핸들러를 못 찾아도 라우트는 남는다


@pytest.mark.parametrize("limit", [1, 5, 20, 40, 60, 80, 100, 120, 140])
def test_어느_단계에서_취소돼도_예외_없이_부분_결과(limit):
    calls = []

    def cancel():
        calls.append(1)
        return len(calls) > limit

    res = scanner.scan(SAMPLE, should_cancel=cancel)
    assert isinstance(res, ScanResult) and len(res.endpoints) <= 22
    assert all(e.file for e in res.endpoints)


def test_Flask_앱_팩토리_안에서_만든_앱과_블루프린트(tmp_path):
    res = scanner.scan(write(tmp_path, {
        "shop/__init__.py": '''from flask import Flask


def create_app():
    app = Flask(__name__)
    from .views import bp
    app.register_blueprint(bp, url_prefix="/v1")

    @app.route("/ping")
    def ping():
        return "pong"

    return app
''',
        "shop/views.py": '''from flask import Blueprint, request

bp = Blueprint("views", __name__)


@bp.route("/items", methods=["POST"])
def add_item():
    return request.form["name"]
''',
    }))
    got = {e.path: (e.method, [p.name for p in e.params]) for e in res.endpoints}
    assert got == {"/ping": ("GET", []), "/v1/items": ("POST", ["name"])}


def test_오버로드는_인자_수가_맞는_것을_따라간다(tmp_path):
    files = dict(CHAIN_FILES)
    files["src/main/java/t/Svc.java"] = "package t;\npublic interface Svc { Object get(String id); Object get(String id, boolean lock); Object any(Object... xs); }\n"
    files["src/main/java/t/SvcImpl.java"] = """package t;
public class SvcImpl implements Svc {
    @Autowired private XMapper m;
    public Object get(String id) { return m.selectOne(); }
    public Object get(String id, boolean lock) { return m.deleteOne(); }
    public Object any(Object... xs) { return m.updateOne(); }
}
"""
    res = spring(tmp_path, """
@Controller
public class TController {
    @Autowired private Svc svc;
    @GetMapping("/one.do") @ResponseBody public Object one() { return svc.get("1"); }
    @GetMapping("/two.do") @ResponseBody public Object two() { return svc.get("1", true); }
    @GetMapping("/var.do") @ResponseBody public Object var() { return svc.any(1, 2, 3); }
    @GetMapping("/gen.do") @ResponseBody public Object gen() { return svc.get(new HashMap<String, Object>().toString()); }
}
""", files)
    got = by_path(res)
    assert [(got[p].sql) for p in ("/one.do", "/two.do", "/var.do", "/gen.do")] == ["SELECT", "DELETE", "UPDATE", "SELECT"]


def test_파라미터_설명은_Javadoc_param_다음에_스웨거(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    /**
     * 조회
     * @param a 첫째 값
     */
    @GetMapping("/g.do") @ResponseBody
    public String g(@RequestParam("a") String a, @RequestParam("b") @ApiParam(value = "둘째 값") String b,
                    @RequestParam("c") @Parameter(description = "셋째 값") String c, @RequestParam("d") String d) { return ""; }
}
""")
    assert [(p.name, p.desc) for p in res.endpoints[0].params] == [("a", "첫째 값"), ("b", "둘째 값"), ("c", "셋째 값"), ("d", "")]


def test_모르는_어노테이션이_붙은_인자는_요청_파라미터로_보지_않는다(tmp_path):
    res = spring(tmp_path, """
@Controller
public class TController {
    @PostMapping("/a.do") @ResponseBody
    public String a(@LoginUser UserVO me, @Valid SearchVO search, @CommandMap Map<String, Object> cmd, @RequestParam("n") String n) { return ""; }
}
class UserVO { private String userId; }
class SearchVO { private String q; }
""")
    assert flat(res.endpoints[0]) == [("q", "String", False, "form"), ("n", "String", True, "form")]        # @Valid 는 검증일 뿐 바인딩은 그대로
